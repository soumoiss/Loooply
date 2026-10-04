import { APP_CONFIG } from "./config.js";
import { formatShort, fromISO } from "./date-parser.js";

const state = {
  items: [],
  filtered: [],
  query: "",
  type: "all",
  sort: "newest",
  view: "grid",
  exclusiveOnly: false,
  lightboxIndex: -1
};

const elements = {};

function cacheElements() {
  for (const id of ["galleryGrid", "galleryEmpty", "galleryStatus", "galleryCount", "gallerySearch", "galleryType", "gallerySort", "galleryExclusive", "galleryGridView", "galleryListView", "lightbox", "lightboxBody", "lightboxTitle", "lightboxMeta"]) {
    elements[id] = document.getElementById(id);
  }
}

function normalizeItem(item, index) {
  const source = item || {};
  const type = String(source.type || "image").toLowerCase();
  return {
    id: String(source.id || `media-${index + 1}`),
    title: String(source.title || "Mídia sem título"),
    type: ["image", "video", "audio"].includes(type) ? type : "image",
    src: String(source.src || ""),
    thumb: String(source.thumb || source.src || ""),
    date: fromISO(source.date),
    iso: String(source.date || ""),
    tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
    exclusive: Boolean(source.exclusive),
    downloadable: source.downloadable !== false,
    description: String(source.description || "")
  };
}

async function fetchIndex() {
  const response = await fetch(APP_CONFIG.data.gallery, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Não foi possível carregar a galeria (${response.status}).`);
  const data = await response.json();
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
}

function matches(item) {
  const q = state.query.trim().toLocaleLowerCase("pt-BR");
  const text = [item.title, item.description, ...item.tags].join(" ").toLocaleLowerCase("pt-BR");
  return (!q || text.includes(q)) && (state.type === "all" || item.type === state.type) && (!state.exclusiveOnly || item.exclusive);
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (state.sort === "oldest") return (a.date?.getTime() || 0) - (b.date?.getTime() || 0);
    if (state.sort === "title") return a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
    return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
  });
}

function typeLabel(type) {
  return type === "video" ? "Vídeo" : type === "audio" ? "Áudio" : "Foto";
}

function renderCard(item, index) {
  const card = document.createElement("article");
  card.className = "media-card";
  card.dataset.index = String(index);

  const visual = item.type === "image"
    ? `<img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title)}" loading="lazy">`
    : item.type === "video"
      ? `<div class="media-placeholder"><span>▶</span><small>Vídeo</small></div>`
      : `<div class="media-placeholder"><span>♫</span><small>Áudio</small></div>`;

  card.innerHTML = `
    <button class="media-visual" type="button" aria-label="Abrir ${escapeHtml(item.title)}">${visual}</button>
    <div class="media-card-body">
      <div class="media-badges">
        <span class="badge">${typeLabel(item.type)}</span>
        ${item.exclusive ? '<span class="badge badge-exclusive">Exclusivo</span>' : ''}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${item.date ? escapeHtml(formatShort(item.date)) : "Sem data"}</p>
    </div>
  `;

  card.querySelector(".media-visual")?.addEventListener("click", () => openLightbox(index));
  return card;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function applyFilters() {
  state.filtered = sortItems(state.items.filter(matches));
  if (elements.galleryGrid) {
    elements.galleryGrid.classList.toggle("list-view", state.view === "list");
    elements.galleryGrid.replaceChildren(...state.filtered.map((item) => renderCard(item, state.items.indexOf(item))));
  }
  const total = state.items.length;
  const visible = state.filtered.length;
  if (elements.galleryCount) elements.galleryCount.textContent = `${visible}/${total}`;
  if (elements.galleryStatus) elements.galleryStatus.textContent = total ? `${visible} mídia${visible === 1 ? "" : "s"} exibida${visible === 1 ? "" : "s"}` : "Nenhuma mídia cadastrada ainda";
  elements.galleryEmpty?.classList.toggle("is-visible", visible === 0);
}

function openLightbox(index) {
  const item = state.items[index];
  if (!item || !elements.lightbox) return;
  state.lightboxIndex = index;
  const body = elements.lightboxBody;
  if (!body) return;
  body.replaceChildren();
  if (item.type === "image") {
    const image = new Image();
    image.alt = item.title;
    image.src = item.src || item.thumb;
    body.appendChild(image);
  } else if (item.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.src = item.src;
    body.appendChild(video);
  } else {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = item.src;
    body.appendChild(audio);
  }
  if (elements.lightboxTitle) elements.lightboxTitle.textContent = item.title;
  if (elements.lightboxMeta) elements.lightboxMeta.textContent = [typeLabel(item.type), item.date ? formatShort(item.date) : "Sem data", item.exclusive ? "Exclusivo" : ""].filter(Boolean).join(" · ");
  const download = document.getElementById("lightboxDownload");
  if (download) {
    download.href = item.src || item.thumb || "#";
    download.download = item.src ? item.src.split("/").pop() || item.id : item.id;
    download.hidden = !item.downloadable || !item.src;
  }
  elements.lightbox.classList.add("is-open");
  elements.lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  if (!elements.lightbox) return;
  elements.lightbox.classList.remove("is-open");
  elements.lightbox.setAttribute("aria-hidden", "true");
  elements.lightboxBody?.replaceChildren();
  state.lightboxIndex = -1;
}

function moveLightbox(step) {
  if (!state.filtered.length || state.lightboxIndex < 0) return;
  const currentItem = state.items[state.lightboxIndex];
  const currentFilteredIndex = state.filtered.indexOf(currentItem);
  const next = state.filtered[(currentFilteredIndex + step + state.filtered.length) % state.filtered.length];
  openLightbox(state.items.indexOf(next));
}

export async function initGallery() {
  cacheElements();
  elements.gallerySearch?.addEventListener("input", (event) => { state.query = event.target.value; applyFilters(); });
  elements.galleryType?.addEventListener("change", (event) => { state.type = event.target.value; applyFilters(); });
  elements.gallerySort?.addEventListener("change", (event) => { state.sort = event.target.value; applyFilters(); });
  elements.galleryExclusive?.addEventListener("change", (event) => { state.exclusiveOnly = event.target.checked; applyFilters(); });
  elements.galleryGridView?.addEventListener("click", () => { state.view = "grid"; applyFilters(); });
  elements.galleryListView?.addEventListener("click", () => { state.view = "list"; applyFilters(); });
  document.getElementById("lightboxClose")?.addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev")?.addEventListener("click", () => moveLightbox(-1));
  document.getElementById("lightboxNext")?.addEventListener("click", () => moveLightbox(1));
  elements.lightbox?.addEventListener("click", (event) => { if (event.target === elements.lightbox) closeLightbox(); });
  document.addEventListener("keydown", (event) => {
    if (!elements.lightbox?.classList.contains("is-open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") moveLightbox(-1);
    if (event.key === "ArrowRight") moveLightbox(1);
  });

  try {
    const raw = await fetchIndex();
    state.items = raw.map(normalizeItem).filter((item) => item.src || item.thumb);
  } catch (error) {
    state.items = [];
    if (elements.galleryStatus) elements.galleryStatus.textContent = "Não foi possível carregar o índice da galeria";
    console.warn(error);
  }

  applyFilters();
}
