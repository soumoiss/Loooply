import { APP_CONFIG } from "./config.js";
import { formatShort, fromISO } from "./date-parser.js";
import { getSession } from "./session.js";
import { USERNAMES } from "./users.js";


const state = {
  items: [],
  filtered: [],
  query: "",
  type: "all",
  sort: "random",
  view: "grid",
  exclusiveOnly: false,
  // Filtro opcional do Radar de Memórias; YYYY-MM-DD ou vazio.
  memoryDate: "",
  lightboxIndex: -1,
  username: "",
  fullscreenListenerBound: false
};


const elements = {};


function cacheElements() {
  for (const id of [
    "galleryGrid",
    "galleryEmpty",
    "galleryStatus",
    "galleryCount",
    "gallerySearch",
    "galleryType",
    "gallerySort",
    "galleryExclusive",
    "galleryGridView",
    "galleryListView",
    "galleryMasonryView",
    "memoryRadar",
    "memoryRadarDays",
    "memoryRadarChapters",
    "memoryRadarInsight",
    "memoryRadarReset",
    "lightbox",
    "lightboxBody",
    "lightboxTitle",
    "lightboxMeta",
    "lightboxFullscreen",
    "lightboxClose"
  ]) {
    elements[id] =
      document.getElementById(id);
  }
}


function canonicalUsername(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");


  return USERNAMES.find(
    (username) =>
      username.toLocaleLowerCase("pt-BR")
      === normalized
  ) || "";
}


function inferOwner(src) {
  const parts =
    String(src || "")
      .split("/")
      .filter(Boolean);


  const midiaIndex =
    parts.findIndex(
      (part) =>
        part.toLocaleLowerCase("pt-BR")
        === "midia"
    );


  if (
    midiaIndex < 0 ||
    !parts[midiaIndex + 1]
  ) {
    return "";
  }


  return canonicalUsername(
    parts[midiaIndex + 1]
  );
}


function pathIsExclusive(src) {
  const parts =
    String(src || "")
      .split("/")
      .filter(Boolean);


  const lowerParts =
    parts.map(
      (part) =>
        part.toLocaleLowerCase("pt-BR")
    );


  const stem =
    parts.at(-1)
      ?.toLocaleLowerCase("pt-BR")
      || "";


  return (
    lowerParts.includes("exclusive") ||
    lowerParts.includes("exclusivo") ||
    stem.startsWith("[exclusive]") ||
    stem.startsWith("[exclusivo]")
  );
}


function titleFromPath(src) {
  const name = String(src || "")
    .split("/")
    .filter(Boolean)
    .pop() || "";

  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Mídia sem título";
}


function mediaUrl(value) {
  const src = String(value || "").trim();
  return src ? encodeURI(src) : "";
}


function normalizeType(value) {
  const type = String(value || "").trim().toLowerCase();

  if (["image", "imagem", "foto", "fotos"].includes(type)) {
    return "image";
  }

  if (["video", "vídeo", "videos", "vídeos"].includes(type)) {
    return "video";
  }

  if (["audio", "áudio", "audios", "áudios"].includes(type)) {
    return "audio";
  }

  return "";
}


// Prioriza datas explicitamente gravadas no índice; quando faltam, tenta inferir
// datas comuns do nome do arquivo (YYYY-MM-DD ou YYYYMMDD). Não inventa datas.
function inferISODate(source, src) {
  const filenameSource = String(source?.path || source?.src || source?.name || src || "");
  const filename = filenameSource.split(/[?#]/, 1)[0].split("/").pop() || "";
  const compactTimestamp = filename.match(/(?:^|[^0-9])(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?=[^0-9]|$)/);
  const dashed = filename.match(/(?:^|[^0-9])(\d{4})-(\d{2})-(\d{2})(?=[^0-9]|$)/);
  const compactDate = filename.match(/(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(?=[^0-9]|$)/);
  const filenameParts = compactTimestamp || dashed || compactDate;
  if (filenameParts) {
    const candidate = `${filenameParts[1]}-${filenameParts[2]}-${filenameParts[3]}`;
    const parsed = fromISO(candidate);
    if (parsed) return candidate;
  }

  // Preserva a fonte original do índice (date/createdAt/uploadedAt/modified).
  // Também aceita timestamps ISO com hora/fuso sem alterar o dia civil informado.
  for (const value of [source?.date, source?.createdAt, source?.uploadedAt, source?.uploadDate, source?.modified]) {
    const explicit = String(value ?? "").trim();
    const match = explicit.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
    if (match && fromISO(match[1])) return match[1];
    // Alguns índices guardam o timestamp de upload/modificação como Unix seconds
    // (mtime), não como ISO. Converter para UTC e extrair o dia civil do índice
    // evita que o fuso local desloque a data para o dia anterior/seguinte.
    const numeric = typeof value === "number" ? value : (/^\d{10}(?:\.\d+)?$/.test(explicit) ? Number(explicit) : NaN);
    if (Number.isFinite(numeric) && numeric > 0) {
      const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
      const timestampDate = new Date(milliseconds);
      if (!Number.isNaN(timestampDate.getTime())) {
        const iso = `${timestampDate.getUTCFullYear()}-${String(timestampDate.getUTCMonth() + 1).padStart(2, "0")}-${String(timestampDate.getUTCDate()).padStart(2, "0")}`;
        if (fromISO(iso)) return iso;
      }
    }
  }
  return "";
}

function normalizeItem(item, index) {
  const source = item || {};

  const src = mediaUrl(
    source.src || source.path || source.url
  );

  const type =
    normalizeType(source.type) ||
    (src.match(/\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif|jfif|tiff?|)$/i)
      ? "image"
      : src.match(/\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i)
        ? "video"
        : "audio");

  const owner =
    canonicalUsername(source.owner) ||
    inferOwner(src);

  const exclusive =
    Boolean(source.exclusive) ||
    Boolean(owner) ||
    pathIsExclusive(src);

  const dateISO = inferISODate(source, src);

  return {
    id: String(
      source.id ||
      `media-${index + 1}`
    ),

    title: String(
      source.title ||
      source.name ||
      titleFromPath(src)
    ),

    type,

    src,

    thumb: mediaUrl(
      source.thumb || source.poster ||
      (type === "image" ? src : "")
    ),
    poster: mediaUrl(source.poster || source.thumb || ""),

    date: fromISO(dateISO),

    iso: dateISO,

    tags: Array.isArray(source.tags)
      ? source.tags.map(String)
      : [],

    owner,

    exclusive,

    downloadable:
      source.downloadable !== false,

    description: String(
      source.description || ""
    )
  };
}


async function fetchIndex() {
  const response = await fetch(
    APP_CONFIG.data.gallery,
    {
      cache: "no-cache",
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar a galeria (${response.status}).`
    );
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data;
  }

  const result = [];
  const seen = new Set();

  const add = (item, owner = "") => {
    if (!item || typeof item !== "object") return;

    const candidate = {
      ...item,
      ...(owner ? { owner, exclusive: true } : {})
    };

    const key = String(
      candidate.path ||
      candidate.src ||
      `${candidate.type || ""}:${candidate.name || ""}`
    );

    if (seen.has(key)) return;

    seen.add(key);
    result.push(candidate);
  };

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      add(item);
    }
  }

  for (const item of Array.isArray(data.fotos) ? data.fotos : []) {
    add(item);
  }

  for (const item of Array.isArray(data.videos) ? data.videos : []) {
    add(item);
  }

  for (const item of Array.isArray(data.audios) ? data.audios : []) {
    add(item);
  }

  if (data.exclusivo && typeof data.exclusivo === "object") {
    for (const [owner, items] of Object.entries(data.exclusivo)) {
      if (!Array.isArray(items)) continue;

      const canonicalOwner = canonicalUsername(owner);
      if (!canonicalOwner) continue;

      for (const item of items) {
        add(item, canonicalOwner);
      }
    }
  }

  return result;
}


function canSeeItem(item) {
  /*
   * Conteúdo normal:
   * todos podem ver.
   */
  if (!item.exclusive) {
    return true;
  }


  /*
   * Exclusivo sem dono específico:
   * fica disponível para usuários
   * autenticados.
   */
  if (!item.owner) {
    return true;
  }


  /*
   * Exclusivo de usuário:
   * somente o próprio usuário vê.
   */
  return (
    item.owner.toLocaleLowerCase(
      "pt-BR"
    )
    ===
    state.username.toLocaleLowerCase(
      "pt-BR"
    )
  );
}


function matches(item) {
  if (!canSeeItem(item)) {
    return false;
  }


  const q =
    state.query
      .trim()
      .toLocaleLowerCase("pt-BR");


  const text = [
    item.title,
    item.description,
    ...item.tags
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");


  return (
    (!q || text.includes(q)) &&
    (!state.memoryDate || item.iso === state.memoryDate) &&
    (
      state.type === "all" ||
      item.type === state.type
    ) &&
    (
      !state.exclusiveOnly ||
      item.exclusive
    )
  );
}


function sortItems(items) {
  if (state.sort === "random") return [...items];
  return [...items].sort(
    (a, b) => {
      if (state.sort === "oldest") {
        return (
          (a.date?.getTime() || 0) -
          (b.date?.getTime() || 0)
        );
      }


      if (state.sort === "title") {
        return a.title.localeCompare(
          b.title,
          "pt-BR",
          {
            sensitivity: "base"
          }
        );
      }


      return (
        (b.date?.getTime() || 0) -
        (a.date?.getTime() || 0)
      );
    }
  );
}


function typeLabel(type) {
  return type === "video"
    ? "Vídeo"
    : type === "audio"
      ? "Áudio"
      : "Foto";
}


function renderCard(item, index) {
  const card = document.createElement("article");
  card.className = "media-card";
  card.dataset.index = String(index);
  const visual = document.createElement("button");
  visual.className = "media-visual";
  visual.type = "button";
  visual.setAttribute("aria-label", `Abrir ${item.title}`);

  if (item.type === "image") {
    const img = document.createElement("img");
    img.src = item.thumb || item.src;
    img.alt = item.title;
    img.loading = "lazy";
    img.decoding = "async";
    img.fetchPriority = "low";
    img.addEventListener("load", async () => {
      try { if (img.decode) await img.decode(); } catch (_) {}
      img.classList.add("media-loaded");
    }, { once: true });
    img.addEventListener("error", () => {
      img.remove();
      visual.classList.add("media-failed");
      const fallback = document.createElement("span");
      fallback.className = "media-placeholder";
      fallback.innerHTML = "<span>▧</span><small>Mídia indisponível</small>";
      visual.appendChild(fallback);
    }, { once: true });
    visual.appendChild(img);
  } else if (item.type === "video") {
    const preview = document.createElement("div");
    preview.className = "video-preview";
    if (item.poster) {
      const img = document.createElement("img");
      img.src = item.poster; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("load", async () => {
        try { if (img.decode) await img.decode(); } catch (_) {}
        img.classList.add("media-loaded");
      }, { once: true });
      img.addEventListener("error", () => { img.remove(); preview.classList.add("video-preview-fallback"); }, { once: true });
      preview.appendChild(img);
    } else {
      // Prévia nativa do primeiro frame: evita canvas, que pode falhar por CORS.
      const video = document.createElement("video");
      video.src = item.src; video.muted = true; video.playsInline = true;
      video.preload = "metadata"; video.setAttribute("aria-hidden", "true");
      video.addEventListener("loadedmetadata", () => {
        try { video.currentTime = Math.min(0.1, video.duration || 0.1); } catch (_) {}
      }, { once: true });
      video.addEventListener("loadeddata", () => video.classList.add("media-loaded"), { once: true });
      video.addEventListener("seeked", () => video.classList.add("media-loaded"), { once: true });
      video.addEventListener("error", () => { video.remove(); preview.classList.add("video-preview-fallback"); }, { once: true });
      preview.appendChild(video);
    }
    const play = document.createElement("span");
    play.className = "video-play"; play.textContent = "▶"; play.setAttribute("aria-hidden", "true");
    preview.appendChild(play); visual.appendChild(preview);
  } else {
    visual.innerHTML = '<span class="media-placeholder"><span>♫</span><small>Áudio</small></span>';
  }

  const body = document.createElement("div"); body.className = "media-card-body";
  const badges = document.createElement("div"); badges.className = "media-badges";
  const typeBadge = document.createElement("span"); typeBadge.className = "badge";
  typeBadge.textContent = typeLabel(item.type); badges.appendChild(typeBadge);
  if (item.exclusive) {
    const exclusive = document.createElement("span");
    exclusive.className = "badge badge-exclusive"; exclusive.textContent = "Exclusivo";
    badges.appendChild(exclusive);
  }
  const title = document.createElement("h3"); title.textContent = item.title;
  const date = document.createElement("p"); date.textContent = item.date ? formatShort(item.date) : "Sem data";
  body.append(badges, title, date); card.append(visual, body);
  visual.addEventListener("click", () => openLightbox(index));
  return card;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char])
  );
}


function renderMemoryRadar() {
  const host = elements.memoryRadarChapters;
  if (!host) return;

  // Só conta itens que a sessão atual pode ver; conteúdo exclusivo não vaza
  // nem para estatísticas agregadas nem para os capítulos sugeridos.
  const dated = state.items.filter(item => canSeeItem(item) && item.iso && item.type === "image");
  const groups = new Map();
  for (const item of dated) {
    if (!groups.has(item.iso)) groups.set(item.iso, { iso: item.iso, count: 0, cover: item });
    const group = groups.get(item.iso);
    group.count += 1;
    if (!group.cover || item.src) group.cover = item;
  }

  const chapters = [...groups.values()]
    .sort((a, b) => b.count - a.count || b.iso.localeCompare(a.iso));
  const formatDay = iso => {
    const date = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date).replace(" de ", " ");
  };

  if (elements.memoryRadarDays) elements.memoryRadarDays.textContent = String(groups.size);
  if (elements.memoryRadarInsight) {
    elements.memoryRadarInsight.textContent = groups.size
      ? `${dated.length} foto${dated.length === 1 ? "" : "s"} com data identificada · destaque para os dias com mais registros`
      : "Ainda não há datas suficientes para montar capítulos. Datas no nome do arquivo também são reconhecidas.";
  }

  const fragment = document.createDocumentFragment();
  for (const chapter of chapters.slice(0, 5)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-chapter";
    button.classList.toggle("is-active", state.memoryDate === chapter.iso);
    button.setAttribute("aria-pressed", String(state.memoryDate === chapter.iso));
    button.setAttribute("aria-label", `Ver ${chapter.count} foto${chapter.count === 1 ? "" : "s"} de ${formatDay(chapter.iso)}`);

    const date = document.createElement("span");
    date.className = "memory-chapter-date";
    date.textContent = formatDay(chapter.iso);
    const count = document.createElement("strong");
    count.textContent = `${chapter.count} ${chapter.count === 1 ? "foto" : "fotos"}`;
    const action = document.createElement("span");
    action.className = "memory-chapter-action";
    action.textContent = state.memoryDate === chapter.iso ? "Dia selecionado ✓" : "Revisitar dia →";
    button.append(date, count, action);
    button.addEventListener("click", () => {
      state.memoryDate = state.memoryDate === chapter.iso ? "" : chapter.iso;
      renderMemoryRadar();
      applyFilters();
    });
    fragment.appendChild(button);
  }
  host.replaceChildren(fragment);
  if (elements.memoryRadarReset) elements.memoryRadarReset.hidden = !state.memoryDate;
}


function applyFilters() {
  state.filtered =
    sortItems(
      state.items.filter(matches)
    );


  if (elements.galleryGrid) {
    elements.galleryGrid.classList.toggle("list-view", state.view === "list");
    elements.galleryGrid.classList.toggle("masonry-view", state.view === "masonry");
    elements.galleryGrid.classList.toggle("grid-view", state.view === "grid");
    for (const [id, mode] of [["galleryGridView", "grid"], ["galleryListView", "list"], ["galleryMasonryView", "masonry"]]) {
      const button = elements[id];
      if (!button) continue;
      button.classList.toggle("is-active", state.view === mode);
      button.setAttribute("aria-pressed", String(state.view === mode));
    }
    const generation = (state.renderGeneration || 0) + 1;
    state.renderGeneration = generation;
    elements.galleryGrid.replaceChildren();
    let cursor = 0;
    const appendBatch = () => {
      if (generation !== state.renderGeneration) return;
      const fragment = document.createDocumentFragment();
      const end = Math.min(cursor + 30, state.filtered.length);
      for (; cursor < end; cursor++) {
        const item = state.filtered[cursor];
        fragment.appendChild(renderCard(item, state.items.indexOf(item)));
      }
      elements.galleryGrid.appendChild(fragment);
      if (cursor < state.filtered.length) requestAnimationFrame(appendBatch);
    };
    appendBatch();
  }


  const totalVisibleToUser =
    state.items.filter(
      canSeeItem
    ).length;


  const visible =
    state.filtered.length;


  if (elements.galleryCount) {
    elements.galleryCount.textContent =
      `${visible}/${totalVisibleToUser}`;
  }


  if (elements.galleryStatus) {
    elements.galleryStatus.textContent =
      visible
        ? `${visible} mídia${visible === 1 ? "" : "s"} exibida${visible === 1 ? "" : "s"}`
        : "Nenhuma mídia encontrada";
  }


  elements.galleryEmpty
    ?.classList.toggle(
      "is-visible",
      visible === 0
    );
}


async function loadMediaMessage(item) {
  const source = String(item?.src || "");
  if (!source) return "";
  const clean = source.split(/[?#]/, 1)[0];
  const slash = clean.lastIndexOf("/");
  let filename = clean.slice(slash + 1);
  try { filename = decodeURIComponent(filename); } catch {}
  if (!filename) return "";
  const base = clean.slice(0, slash + 1);
  // Convenção estrita: MSG_<nome completo do arquivo de mídia>.txt
  const messageUrl = `${base}MSG_${encodeURIComponent(filename)}.txt`;
  try {
    const response = await fetch(messageUrl, { cache: "no-cache" });
    if (!response.ok) return "";
    return (await response.text()).trim().slice(0, 5000);
  } catch (error) {
    console.debug("Looply: mensagem opcional indisponível para esta mídia.", error);
    return "";
  }
}

function setupLightboxImageGestures(image) {
  const pointers = new Map();
  const gesture = {
    mode: "",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startDistance: 0,
    startScale: 1,
    anchorX: 0,
    anchorY: 0,
    scale: 1,
    x: 0,
    y: 0,
    baseRect: null,
    hadMultiplePointers: false
  };

  image.classList.add("lightbox-zoomable");
  image.draggable = false;
  image.style.transformOrigin = "0 0";

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function paint() {
    if (gesture.scale <= 1.001) {
      gesture.scale = 1;
      gesture.x = 0;
      gesture.y = 0;
      image.style.transform = "";
      image.classList.remove("is-zoomed");
      image.style.cursor = "zoom-in";
      return;
    }
    image.style.transform = `translate(${gesture.x}px, ${gesture.y}px) scale(${gesture.scale})`;
    image.classList.add("is-zoomed");
    image.style.cursor = "grab";
  }

  function startPinch() {
    const pair = [...pointers.values()].slice(0, 2);
    if (pair.length < 2) return;
    if (!gesture.baseRect || gesture.scale === 1) {
      image.style.transform = "";
      gesture.baseRect = image.getBoundingClientRect();
    }
    const center = midpoint(pair[0], pair[1]);
    gesture.mode = "pinch";
    gesture.hadMultiplePointers = true;
    gesture.startDistance = Math.max(1, distance(pair[0], pair[1]));
    gesture.startScale = gesture.scale;
    gesture.anchorX = (center.x - gesture.baseRect.left - gesture.x) / gesture.scale;
    gesture.anchorY = (center.y - gesture.baseRect.top - gesture.y) / gesture.scale;
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    if (!gesture.baseRect && gesture.scale === 1) {
      image.style.transform = "";
      gesture.baseRect = image.getBoundingClientRect();
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { image.setPointerCapture(event.pointerId); } catch (_) {}

    if (pointers.size >= 2) {
      startPinch();
      return;
    }
    gesture.mode = gesture.scale > 1 ? "pan" : "swipe";
    gesture.startX = gesture.lastX = event.clientX;
    gesture.startY = gesture.lastY = event.clientY;
    gesture.hadMultiplePointers = false;
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      if (gesture.mode !== "pinch") startPinch();
      const pair = [...pointers.values()].slice(0, 2);
      const center = midpoint(pair[0], pair[1]);
      const nextScale = Math.min(4, Math.max(1, gesture.startScale * distance(pair[0], pair[1]) / gesture.startDistance));
      gesture.scale = nextScale;
      gesture.x = center.x - gesture.baseRect.left - gesture.anchorX * nextScale;
      gesture.y = center.y - gesture.baseRect.top - gesture.anchorY * nextScale;
      paint();
      return;
    }

    if (gesture.mode === "pan" && gesture.scale > 1) {
      gesture.x += event.clientX - gesture.lastX;
      gesture.y += event.clientY - gesture.lastY;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      paint();
    }
  }

  function finishPointer(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const wasSwipe = gesture.mode === "swipe" && !gesture.hadMultiplePointers && gesture.scale === 1;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    pointers.delete(event.pointerId);

    if (pointers.size >= 2) {
      startPinch();
      return;
    }
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      gesture.mode = gesture.scale > 1 ? "pan" : "";
      gesture.lastX = remaining.x;
      gesture.lastY = remaining.y;
      return;
    }

    gesture.mode = "";
    if (gesture.scale <= 1.03) {
      gesture.scale = 1;
      paint();
    }
    if (!cancelled && wasSwipe && Math.abs(deltaX) >= 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      moveLightbox(deltaX < 0 ? 1 : -1);
    }
  }

  image.addEventListener("pointerdown", onPointerDown);
  image.addEventListener("pointermove", onPointerMove);
  image.addEventListener("pointerup", event => finishPointer(event));
  image.addEventListener("pointercancel", event => finishPointer(event, true));
  image.addEventListener("lostpointercapture", event => finishPointer(event, true));
  image.addEventListener("dblclick", event => {
    event.preventDefault();
    gesture.scale = 1;
    gesture.x = 0;
    gesture.y = 0;
    gesture.baseRect = null;
    paint();
  });
}


function openLightbox(index) {
  const item =
    state.items[index];


  if (
    !item ||
    !canSeeItem(item) ||
    !elements.lightbox
  ) {
    return;
  }


  state.lightboxIndex =
    index;


  const body =
    elements.lightboxBody;


  if (!body) return;


  body.replaceChildren();


  if (item.type === "image") {
    const image =
      new Image();


    image.alt =
      item.title;


    image.decoding = "async";
    image.loading = "eager";
    image.addEventListener("load", () => {
      if (typeof image.decode === "function") image.decode().catch(() => {});
    }, { once: true });
    image.addEventListener("error", () => {
      body.textContent = "Não foi possível carregar esta imagem.";
    }, { once: true });
    image.src = item.src || item.thumb;


    body.appendChild(image);
    setupLightboxImageGestures(image);

  } else if (
    item.type === "video"
  ) {
    const video =
      document.createElement(
        "video"
      );


    video.controls =
      true;

    video.playsInline =
      true;

    video.preload = "metadata";
    if (item.poster) video.poster = item.poster;
    video.addEventListener("error", () => {
      const note = document.createElement("p");
      note.textContent = "Não foi possível reproduzir este vídeo.";
      body.appendChild(note);
    }, { once: true });
    video.src = item.src;


    body.appendChild(
      video
    );

  } else {
    const audio =
      document.createElement(
        "audio"
      );


    audio.controls =
      true;


    audio.preload =
      "metadata";


    audio.src =
      item.src;


    body.appendChild(
      audio
    );
  }


  // A seção só existe quando o arquivo de mensagem contém texto.
  loadMediaMessage(item).then(message => {
    if (!message || !body.isConnected || state.items[state.lightboxIndex] !== item) return;
    const messagePanel = document.createElement("section");
    messagePanel.className = "media-message-panel";
    messagePanel.setAttribute("aria-labelledby", "mediaMessageTitle");
    const messageHeading = document.createElement("h3");
    messageHeading.id = "mediaMessageTitle";
    messageHeading.textContent = "Mensagem";
    const messageContent = document.createElement("p");
    messageContent.className = "media-message-content";
    messageContent.textContent = message;
    messagePanel.append(messageHeading, messageContent);
    body.appendChild(messagePanel);
  });

  if (elements.lightboxTitle) {
    elements.lightboxTitle.textContent =
      item.title;
  }


  if (elements.lightboxMeta) {
    elements.lightboxMeta.textContent =
      [
        typeLabel(item.type),
        item.date
          ? formatShort(item.date)
          : "Sem data",
        item.exclusive
          ? "Exclusivo"
          : ""
      ]
        .filter(Boolean)
        .join(" · ");
  }


  const download =
    document.getElementById(
      "lightboxDownload"
    );


  if (download) {
    download.href =
      item.src ||
      item.thumb ||
      "#";


    download.download =
      item.src
        ? item.src.split("/").pop()
          || item.id
        : item.id;


    download.hidden =
      !item.downloadable ||
      !item.src;
  }


  elements.lightbox
    .classList.add(
      "is-open"
    );


  elements.lightbox.setAttribute(
    "aria-hidden",
    "false"
  );
}



async function toggleLightboxFullscreen() {
  const panel = elements.lightbox?.querySelector(".lightbox-panel");
  if (!panel || !elements.lightbox) return;

  // O modo alternativo também precisa funcionar como um verdadeiro alternador.
  if (elements.lightbox.classList.contains("is-fallback-fullscreen")) {
    elements.lightbox.classList.remove("is-fallback-fullscreen");
    syncFullscreenButton();
    return;
  }

  try {
    if (document.fullscreenElement === panel) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else elements.lightbox.classList.add("is-fallback-fullscreen");
    } else if (panel.requestFullscreen) {
      await panel.requestFullscreen();
    } else {
      elements.lightbox.classList.add("is-fallback-fullscreen");
    }
  } catch (error) {
    // Alguns WebViews/navegadores expõem Fullscreen API, mas recusam a chamada.
    // Nesse caso, ativa o modo alternativo em vez de deixar o botão sem efeito.
    console.warn("Looply: API de tela cheia indisponível; usando modo alternativo.", error);
    elements.lightbox.classList.add("is-fallback-fullscreen");
  }
  syncFullscreenButton();
}

function syncFullscreenButton() {
  const button = elements.lightboxFullscreen;
  if (!button) return;
  const panel = elements.lightbox?.querySelector(".lightbox-panel");
  const active = Boolean(
    (panel && document.fullscreenElement === panel) ||
    elements.lightbox?.classList.contains("is-fallback-fullscreen")
  );
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", active ? "Sair da tela cheia" : "Abrir em tela cheia");
  button.title = active ? "Sair da tela cheia" : "Tela cheia";
}

async function exitLightboxFullscreen() {
  elements.lightbox?.classList.remove("is-fallback-fullscreen");
  if (document.fullscreenElement && document.exitFullscreen) {
    try { await document.exitFullscreen(); } catch (_) {}
  }
}

function closeLightbox() {
  // Fecha também o fullscreen nativo/fallback antes de limpar o conteúdo.
  void exitLightboxFullscreen();
  if (!elements.lightbox) {
    return;
  }


  elements.lightbox
    .classList.remove(
      "is-open"
    );


  elements.lightbox.setAttribute(
    "aria-hidden",
    "true"
  );


  elements.lightboxBody
    ?.replaceChildren();


  state.lightboxIndex =
    -1;
}


function moveLightbox(step) {
  if (
    !state.filtered.length ||
    state.lightboxIndex < 0
  ) {
    return;
  }


  const currentItem =
    state.items[
      state.lightboxIndex
    ];


  const currentFilteredIndex =
    state.filtered.indexOf(
      currentItem
    );


  if (currentFilteredIndex < 0) {
    return;
  }


  const next =
    state.filtered[
      (
        currentFilteredIndex +
        step +
        state.filtered.length
      ) %
      state.filtered.length
    ];


  openLightbox(
    state.items.indexOf(next)
  );
}


export async function initGallery() {
  cacheElements();


  const session =
    getSession();


  state.username = session?.username || "";
  try {
    const savedView = localStorage.getItem("looply_gallery_view");
    if (["grid", "list", "masonry"].includes(savedView)) state.view = savedView;
    const savedSort = localStorage.getItem("looply_gallery_sort");
    if (["random", "newest", "oldest", "title"].includes(savedSort)) state.sort = savedSort;
  } catch (_) {}
  if (elements.gallerySort) elements.gallerySort.value = state.sort;

  elements.gallerySearch
    ?.addEventListener(
      "input",
      (event) => {
        state.query =
          event.target.value;

        applyFilters();
      }
    );


  elements.galleryType
    ?.addEventListener(
      "change",
      (event) => {
        state.type =
          event.target.value;

        applyFilters();
      }
    );


  elements.gallerySort
    ?.addEventListener(
      "change",
      (event) => {
        state.sort = event.target.value;
        try { localStorage.setItem("looply_gallery_sort", state.sort); } catch (_) {}
        applyFilters();
      }
    );


  elements.galleryExclusive
    ?.addEventListener(
      "change",
      (event) => {
        state.exclusiveOnly =
          event.target.checked;

        applyFilters();
      }
    );


  elements.memoryRadarReset?.addEventListener("click", () => {
    state.memoryDate = "";
    renderMemoryRadar();
    applyFilters();
  });


  elements.galleryGridView
    ?.addEventListener(
      "click",
      () => {
        state.view = "grid";
        try { localStorage.setItem("looply_gallery_view", state.view); } catch (_) {}
        applyFilters();
      }
    );


  elements.galleryListView
    ?.addEventListener(
      "click",
      () => {
        state.view = "list";
        try { localStorage.setItem("looply_gallery_view", state.view); } catch (_) {}
        applyFilters();
      }
    );


  elements.galleryMasonryView?.addEventListener("click", () => {
    state.view = "masonry";
    try { localStorage.setItem("looply_gallery_view", state.view); } catch (_) {}
    applyFilters();
  });

  document
    .getElementById(
      "lightboxClose"
    )
    ?.addEventListener(
      "click",
      closeLightbox
    );


  document
    .getElementById(
      "lightboxPrev"
    )
    ?.addEventListener(
      "click",
      () => moveLightbox(-1)
    );


  document
    .getElementById(
      "lightboxNext"
    )
    ?.addEventListener(
      "click",
      () => moveLightbox(1)
    );


  elements.lightboxFullscreen
    ?.addEventListener("click", () => { void toggleLightboxFullscreen(); });

  if (!state.fullscreenListenerBound) {
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    state.fullscreenListenerBound = true;
  }

  elements.lightbox
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          elements.lightbox
        ) {
          closeLightbox();
        }
      }
    );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        !elements.lightbox
          ?.classList
          .contains("is-open")
      ) {
        return;
      }


      if (event.key === "Escape") {
        // Se o navegador já está saindo do fullscreen por Escape, mantém o
        // lightbox aberto; um segundo Escape fecha a visualização da galeria.
        if (document.fullscreenElement) {
          void exitLightboxFullscreen();
        } else {
          closeLightbox();
        }
      }


      if (
        event.key === "ArrowLeft"
      ) {
        moveLightbox(-1);
      }


      if (
        event.key === "ArrowRight"
      ) {
        moveLightbox(1);
      }
    }
  );


  if (elements.galleryStatus) {
    elements.galleryStatus.textContent =
      "Carregando galeria…";
  }


  try {
    const raw =
      await fetchIndex();


    state.items = raw.map(normalizeItem).filter((item) => item.src || item.thumb);
    // Fisher–Yates: embaralhamento uniforme no carregamento da galeria.
    for (let i = state.items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.items[i], state.items[j]] = [state.items[j], state.items[i]];
    }

  } catch (error) {
    state.items = [];


    if (elements.galleryStatus) {
      elements.galleryStatus.textContent =
        "Não foi possível carregar a galeria.";
    }


    console.error(
      "Looply: erro ao carregar a galeria.",
      error
    );
  }


  renderMemoryRadar();
  applyFilters();
}
