import { APP_CONFIG } from "./config.js";

const state = { tracks: [], query: "", currentId: null, audio: null };
let list;
let status;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

async function fetchMusicIndex() {
  const response = await fetch(APP_CONFIG.data.music, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Índice de músicas indisponível (${response.status}).`);
  const data = await response.json();
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
}

function matches(track) {
  const q = state.query.trim().toLocaleLowerCase("pt-BR");
  return !q || [track.title, track.artist, ...(track.tags || [])].join(" ").toLocaleLowerCase("pt-BR").includes(q);
}

function render() {
  if (!list) return;
  const filtered = state.tracks.filter(matches);
  list.replaceChildren(...filtered.map((track) => {
    const row = document.createElement("article");
    row.className = "track-card";
    row.innerHTML = `
      <div class="track-art" aria-hidden="true">♫</div>
      <div class="track-info">
        <div class="media-badges"><span class="badge">Música</span>${track.exclusive ? '<span class="badge badge-exclusive">Exclusivo</span>' : ''}</div>
        <h3>${escapeHtml(track.title || "Faixa sem título")}</h3>
        <p>${escapeHtml(track.artist || "Artista não informado")}</p>
      </div>
      <button class="play-button" type="button" aria-label="Reproduzir">▶</button>
    `;
    row.querySelector(".play-button")?.addEventListener("click", () => playTrack(track));
    return row;
  }));
  if (status) status.textContent = `${filtered.length} faixa${filtered.length === 1 ? "" : "s"}`;
}

function playTrack(track) {
  if (!track?.src) return;
  if (!state.audio) state.audio = new Audio();
  if (state.currentId === track.id && !state.audio.paused) {
    state.audio.pause();
    return;
  }
  state.currentId = track.id;
  state.audio.src = track.src;
  state.audio.play().catch((error) => console.warn("Looply: reprodução bloqueada.", error));
}

export async function initMusic() {
  list = document.getElementById("musicList");
  status = document.getElementById("musicStatus");
  document.getElementById("musicSearch")?.addEventListener("input", (event) => { state.query = event.target.value; render(); });

  try {
    const data = await fetchMusicIndex();
    state.tracks = data.map((item, index) => ({
      id: String(item.id || `track-${index + 1}`),
      title: String(item.title || "Faixa sem título"),
      artist: String(item.artist || ""),
      src: String(item.src || ""),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      exclusive: Boolean(item.exclusive)
    })).filter((track) => track.src);
  } catch (error) {
    state.tracks = [];
    if (status) status.textContent = "Nenhuma música cadastrada ainda";
    console.warn(error);
  }
  render();
}
