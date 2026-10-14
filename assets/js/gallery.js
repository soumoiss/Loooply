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
  username: ""
};


const elements = {};
const mediaMessageCache = new Map();


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
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Encode each path segment independently: spaces, #, ?, accents and parentheses
  // in filenames must not become URL syntax. Keep query strings and fragments intact.
  const encodePath = path => path.split("/").map(segment => {
    try { return encodeURIComponent(decodeURIComponent(segment)); }
    catch (_) { return encodeURIComponent(segment); }
  }).join("/");

  try {
    if (/^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) {
      const url = new URL(raw, document.baseURI);
      if (/^(?:data|blob):/i.test(raw)) return raw;
      url.pathname = encodePath(url.pathname);
      return url.href;
    }
  } catch (_) {}

  const match = raw.match(/^([^?#]*)([?#][\s\S]*)?$/);
  return `${encodePath(match?.[1] || raw)}${match?.[2] || ""}`;
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
  const filename = String(src || "").split(/[?#]/, 1)[0].split("/").pop() || "";
  // A data e hora exatas no nome prevalecem sobre a data de upload.
  const exact = filename.match(/(?:^|[^0-9])(\d{4})(\d{2})(\d{2})_\d{6}(?=\.[^.]+$|$)/);
  if (exact) {
    const exactDate = `${exact[1]}-${exact[2]}-${exact[3]}`;
    const parsedExact = new Date(`${exactDate}T12:00:00`);
    if (!Number.isNaN(parsedExact.getTime()) && parsedExact.toISOString().slice(0, 10) === exactDate) return exactDate;
  }

  const explicit = [source?.date, source?.createdAt, source?.uploadedAt, source?.modified]
    .map(value => String(value || "").trim())
    .find(value => /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value));
  if (explicit) return explicit.slice(0, 10);

  // Compatibilidade com nomes antigos quando o índice não contém data de upload.
  const dashed = filename.match(/(?:^|[^0-9])(\d{4}-\d{2}-\d{2})(?:[^0-9]|$)/);
  const compact = filename.match(/(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(?:[^0-9]|$)/);
  const candidate = dashed?.[1] || (compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : "");
  if (!candidate) return "";
  const parsed = new Date(`${candidate}T12:00:00`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate ? "" : candidate;
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

  // Só cria o botão quando a foto realmente possui comentário não vazio.
  if (item.type === "image") {
    loadMediaMessage(item).then(message => {
      if (!message || !card.isConnected) return;

      const commentButton = document.createElement("button");
      commentButton.type = "button";
      commentButton.className = "media-comment-toggle";
      commentButton.setAttribute("aria-label", `Ver comentário de ${item.title}`);
      commentButton.setAttribute("aria-expanded", "false");
      commentButton.title = "Ver comentário";
      commentButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>';

      const commentPanel = document.createElement("div");
      commentPanel.className = "media-comment-popover";
      commentPanel.hidden = true;
      commentPanel.setAttribute("role", "status");
      const commentText = document.createElement("p");
      commentText.textContent = message;
      commentPanel.appendChild(commentText);

      commentButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = commentPanel.hidden;
        commentPanel.hidden = !willOpen;
        commentButton.setAttribute("aria-expanded", String(willOpen));
      });
      commentPanel.addEventListener("click", event => event.stopPropagation());
      card.append(commentButton, commentPanel);
    });
  }
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


function loadMediaMessage(item) {
  const source = String(item?.src || "");
  if (!source) return Promise.resolve("");
  if (mediaMessageCache.has(source)) return mediaMessageCache.get(source);

  const task = (async () => {
    const clean = source.split(/[?#]/, 1)[0];
    const slash = clean.lastIndexOf("/");
    let filename = clean.slice(slash + 1);
    try { filename = decodeURIComponent(filename); } catch {}
    if (!filename) return "";
    const base = clean.slice(0, slash + 1);
    // Convenção existente: MSG_<nome completo do arquivo de mídia>.txt
    const messageUrl = `${base}MSG_${encodeURIComponent(filename)}.txt`;
    try {
      const response = await fetch(messageUrl, { cache: "no-cache" });
      if (!response.ok) return "";
      return (await response.text()).trim().slice(0, 5000);
    } catch (error) {
      console.debug("Looply: mensagem opcional indisponível para esta mídia.", error);
      return "";
    }
  })();
  mediaMessageCache.set(source, task);
  return task;
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
    image.classList.add("lightbox-zoomable");
    image.setAttribute("title", "Toque duas vezes para ampliar; arraste para mover; use pinça para ajustar o zoom");
    image.draggable = false;
    image.dataset.zoom = "1";
    const zoom = { scale: 1, x: 0, y: 0, pointers: new Map(), start: null, pinch: null, lastTap: 0 };
    const renderZoom = () => {
      image.dataset.zoom = String(zoom.scale);
      image.style.transform = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
      image.classList.toggle("is-zoomed", zoom.scale > 1.001);
      body.classList.toggle("is-image-zoomed", zoom.scale > 1.001);
      image.style.cursor = zoom.scale > 1.001 ? "grab" : "zoom-in";
    };
    const resetZoom = () => { zoom.scale = 1; zoom.x = 0; zoom.y = 0; renderZoom(); };
    const toggleZoom = (x = image.clientWidth / 2, y = image.clientHeight / 2) => {
      if (zoom.scale > 1.001) return resetZoom();
      zoom.scale = 2.5;
      zoom.x = (image.clientWidth / 2 - x) * (zoom.scale - 1);
      zoom.y = (image.clientHeight / 2 - y) * (zoom.scale - 1);
      renderZoom();
    };
    image.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      image.setPointerCapture?.(event.pointerId);
      zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      image.style.cursor = zoom.scale > 1.001 ? "grabbing" : "zoom-in";
      if (zoom.pointers.size === 1) {
        zoom.start = { x: event.clientX, y: event.clientY, panX: zoom.x, panY: zoom.y, time: Date.now(), moved: false };
      } else if (zoom.pointers.size === 2) {
        const points = [...zoom.pointers.values()];
        zoom.pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale: zoom.scale };
        zoom.start = null;
      }
    });
    image.addEventListener("pointermove", event => {
      if (!zoom.pointers.has(event.pointerId)) return;
      zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (zoom.pointers.size >= 2 && zoom.pinch) {
        const points = [...zoom.pointers.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        zoom.scale = Math.max(1, Math.min(5, zoom.pinch.scale * distance / Math.max(1, zoom.pinch.distance)));
        if (zoom.scale === 1) { zoom.x = 0; zoom.y = 0; }
        renderZoom();
      } else if (zoom.start) {
        const dx = event.clientX - zoom.start.x, dy = event.clientY - zoom.start.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) zoom.start.moved = true;
        if (zoom.scale > 1.001) {
          zoom.x = zoom.start.panX + dx;
          zoom.y = zoom.start.panY + dy;
          renderZoom();
        }
      }
    });
    const endPointer = event => {
      const start = zoom.start;
      const moved = Boolean(start?.moved);
      const elapsed = start ? Date.now() - start.time : 1000;
      const x = event.clientX, y = event.clientY;
      zoom.pointers.delete(event.pointerId);
      if (zoom.pointers.size < 2) zoom.pinch = null;
      if (zoom.pointers.size === 0) {
        if (!moved && elapsed < 280) {
          const now = Date.now();
          if (now - zoom.lastTap < 320) { toggleZoom(x - image.getBoundingClientRect().left, y - image.getBoundingClientRect().top); zoom.lastTap = 0; }
          else zoom.lastTap = now;
        }
        zoom.start = null;
        renderZoom();
      }
    };
    image.addEventListener("pointerup", endPointer);
    image.addEventListener("pointercancel", event => { zoom.pointers.delete(event.pointerId); zoom.pinch = null; zoom.start = null; });
    image.addEventListener("click", event => {
      // Mouse click toggles zoom; touch double-tap is handled by pointer events.
      if (event.pointerType === "mouse") toggleZoom(event.offsetX, event.offsetY);
    });

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


  // Comentários são exibidos sob demanda pelo ícone da própria fotografia.

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
  if (!panel) return;
  try {
    if (document.fullscreenElement === panel) {
      await document.exitFullscreen();
    } else if (panel.requestFullscreen) {
      await panel.requestFullscreen();
    } else {
      // Fallback para navegadores sem Fullscreen API: o lightbox já ocupa a tela.
      elements.lightbox.classList.add("is-fallback-fullscreen");
    }
  } catch (error) {
    console.warn("Looply: o navegador não permitiu entrar em tela cheia.", error);
  }
}

function syncFullscreenButton() {
  const button = elements.lightboxFullscreen;
  if (!button) return;
  const panel = elements.lightbox?.querySelector(".lightbox-panel");
  const active = Boolean(panel && document.fullscreenElement === panel);
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

  document.addEventListener("fullscreenchange", syncFullscreenButton);

  // Navegação por gesto funciona no lightbox comum e em tela cheia.
  let swipeStartX = 0;
  let swipeStartY = 0;
  elements.lightboxBody?.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    swipeStartX = event.touches[0].clientX;
    swipeStartY = event.touches[0].clientY;
  }, { passive: true });
  elements.lightboxBody?.addEventListener("touchend", event => {
    if (event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - swipeStartX;
    const dy = event.changedTouches[0].clientY - swipeStartY;
    const zoomed = elements.lightboxBody.querySelector("img.is-zoomed");
    if (!zoomed && Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      moveLightbox(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  elements.lightboxBody?.addEventListener("wheel", event => {
    const image = elements.lightboxBody.querySelector("img.lightbox-zoomable");
    if (!image || !event.ctrlKey) return;
    event.preventDefault();
    const current = Number(image.dataset.zoom || 1);
    const next = Math.max(1, Math.min(4, current + (event.deltaY < 0 ? 0.25 : -0.25)));
    image.dataset.zoom = String(next);
    image.style.transform = `scale(${next})`;
    image.style.cursor = next > 1 ? "zoom-out" : "zoom-in";
    image.classList.toggle("is-zoomed", next > 1);
    elements.lightboxBody.classList.toggle("is-image-zoomed", next > 1);
  }, { passive: false });

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
