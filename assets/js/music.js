import { getSession } from "./session.js";
import { cloudConfigured } from "./cloud.js";
import { getThread, addComment, attachmentURL, formatCommentDate, subscribeThread } from "./comments-store.js";

/*
 * LOOPLY — SISTEMA DE MÚSICAS
 *
 * Este arquivo carrega diretamente uma playlist
 * do YouTube através da YouTube Data API v3.
 *
 * Não depende de data/musicas-index.json.
 */


"use strict";


/* =========================================================
   CONFIGURAÇÃO DA PLAYLIST
   ========================================================= */


const YOUTUBE_API_KEY =
  "AIzaSyDrJdOQ9y5SxLR_1_nNt8fY5DGNIg8pskU";


const PLAYLISTS_BY_USER = Object.freeze({
  misol: "PLUZFdmgmipvI",
  yara: "PLCn4CAsA_tiM",
  patati: "PLE0tcB0gaSzM"
});
const DEFAULT_PLAYLIST_ID = "PLMeQ_QyqhY7s";
let activePlaylistId = DEFAULT_PLAYLIST_ID;
let loadVersion = 0;

function playlistForCurrentUser() {
  let username = "";
  try { username = localStorage.getItem("username") || ""; } catch {}
  const key = username.trim().toLocaleLowerCase("pt-BR");
  return PLAYLISTS_BY_USER[key] || DEFAULT_PLAYLIST_ID;
}


const YOUTUBE_API_URL =
  "https://www.googleapis.com/youtube/v3/playlistItems";


const MAX_RESULTS =
  50;


/* =========================================================
   ESTADO
   ========================================================= */


const state = {

  tracks: [],

  filtered: [],

  query: "",

  loading: false

};


/* =========================================================
   ELEMENTOS DA PÁGINA
   ========================================================= */


let musicList = null;

let musicSearch = null;

let musicStatus = null;

let musicEmpty = null;

let musicError = null;

let musicErrorText = null;


/* =========================================================
   UTILITÁRIOS
   ========================================================= */


function escapeHtml(value) {

  return String(value || "")
    .replace(
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


/* =========================================================
   EXTRAÇÃO DO ID DA PLAYLIST
   ========================================================= */


function extrairPlaylistId(valor) {

  const texto =
    String(valor || "")
      .trim();


  if (!texto) {
    return "";
  }


  /*
   * Se já for somente o ID.
   */

  if (
    !texto.includes("youtube.com") &&
    !texto.includes("youtu.be")
  ) {

    return texto;

  }


  try {

    const url =
      new URL(texto);


    const id =
      url.searchParams.get("list");


    return id
      ? id.trim()
      : "";


  } catch {

    const match =
      texto.match(
        /[?&]list=([^&#]+)/i
      );


    return match
      ? decodeURIComponent(
          match[1]
        ).trim()
      : "";

  }

}


/* =========================================================
   LIMPEZA DOS TÍTULOS
   ========================================================= */


function limparTexto(valor) {

  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();

}


/* =========================================================
   THUMBNAIL
   ========================================================= */


function thumbnailDaMusica(
  item,
  videoId
) {

  const thumbnails =
    item?.snippet?.thumbnails || {};


  return (

    thumbnails.maxres?.url ||

    thumbnails.standard?.url ||

    thumbnails.high?.url ||

    thumbnails.medium?.url ||

    thumbnails.default?.url ||

    `https://i.ytimg.com/vi/${encodeURIComponent(
      videoId
    )}/hqdefault.jpg`

  );

}


/* =========================================================
   VERIFICAÇÃO DE ITEM INVÁLIDO
   ========================================================= */


function ehItemInvalido(item) {

  const videoId =
    item?.snippet
      ?.resourceId
      ?.videoId || "";


  const privacy =
    item?.status
      ?.privacyStatus || "";


  if (!videoId) {

    return true;

  }


  if (
    privacy === "private"
  ) {

    return true;

  }


  const titulo =
    limparTexto(
      item?.snippet?.title || ""
    ).toLowerCase();


  return (

    titulo === "deleted video" ||

    titulo === "private video" ||

    titulo === "[deleted video]" ||

    titulo === "[private video]"

  );

}


/* =========================================================
   TRANSFORMA ITEM DA API EM MÚSICA
   ========================================================= */


function transformarItem(item) {

  if (
    ehItemInvalido(item)
  ) {

    return null;

  }


  const snippet =
    item.snippet;


  const videoId =
    snippet.resourceId.videoId;


  const position =
    Number(snippet.position);


  return {

    videoId,

    title:
      limparTexto(
        snippet.title
      ) ||
      "Vídeo sem título",


    description:
      limparTexto(
        snippet.description
      ),


    thumbnail:
      thumbnailDaMusica(
        item,
        videoId
      ),


    position:
      Number.isFinite(position)
        ? position
        : Number.MAX_SAFE_INTEGER,


    url:
      `https://www.youtube.com/watch?v=${encodeURIComponent(
        videoId
      )}&list=${encodeURIComponent(
        activePlaylistId
      )}`

  };

}


/* =========================================================
   CONSULTA DE UMA PÁGINA DA PLAYLIST
   ========================================================= */


async function consultarPaginaPlaylist(
  playlistId,
  pageToken = ""
) {

  const params =
    new URLSearchParams({

      part:
        "snippet,status",

      playlistId,

      maxResults:
        String(MAX_RESULTS),

      key:
        YOUTUBE_API_KEY

    });


  if (pageToken) {

    params.set(
      "pageToken",
      pageToken
    );

  }


  const resposta =
    await fetch(
      `${YOUTUBE_API_URL}?${params.toString()}`,
      {

        method:
          "GET",

        cache:
          "no-store",

        headers: {

          Accept:
            "application/json"

        }

      }
    );


  let dados = null;


  try {

    dados =
      await resposta.json();


  } catch {

    throw new Error(
      `Resposta inválida da YouTube Data API (${resposta.status}).`
    );

  }


  if (
    !resposta.ok ||
    dados?.error
  ) {

    const apiError =
      dados?.error;


    const motivo =
      apiError
        ?.errors
        ?.find(Boolean)
        ?.reason || "";


    const mensagem =
      apiError?.message ||
      `HTTP ${resposta.status}`;


    const erro =
      new Error(
        mensagem
      );


    erro.status =
      resposta.status;


    erro.reason =
      motivo;


    erro.apiMessage =
      mensagem;


    throw erro;

  }


  return dados;

}


/* =========================================================
   BUSCA TODAS AS PÁGINAS DA PLAYLIST
   ========================================================= */


async function obterTodosOsVideos(
  playlistId
) {

  const itens = [];

  let pageToken = "";

  let paginas = 0;


  do {

    paginas += 1;


    /*
     * Proteção contra uma resposta
     * inesperadamente infinita da API.
     */

    if (paginas > 200) {

      throw new Error(
        "Número inesperado de páginas da playlist."
      );

    }


    const dados =
      await consultarPaginaPlaylist(
        playlistId,
        pageToken
      );


    if (
      Array.isArray(
        dados.items
      )
    ) {

      itens.push(
        ...dados.items
      );

    }


    pageToken =
      dados.nextPageToken || "";


    if (musicStatus) {

      musicStatus.textContent =
        pageToken

          ? `Carregando playlist… ${itens.length} itens`

          : "Organizando músicas…";

    }


  } while (pageToken);


  return itens;

}


/* =========================================================
   FILTRO DE BUSCA
   ========================================================= */


function matches(track) {

  const query =
    state.query
      .trim()
      .toLocaleLowerCase(
        "pt-BR"
      );


  if (!query) {

    return true;

  }


  const texto = [

    track.title,

    track.description

  ]
    .join(" ")
    .toLocaleLowerCase(
      "pt-BR"
    );


  return texto.includes(
    query
  );

}


/* =========================================================
   ÍCONE DE PLAY
   ========================================================= */


function criarIconePlay() {

  const svg =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );


  svg.setAttribute(
    "viewBox",
    "0 0 24 24"
  );


  svg.setAttribute(
    "fill",
    "currentColor"
  );


  svg.setAttribute(
    "aria-hidden",
    "true"
  );


  const path =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );


  path.setAttribute(
    "d",
    "M8 5.5v13l10-6.5z"
  );


  svg.appendChild(
    path
  );


  return svg;

}


/* =========================================================
   ÍCONE DE NOTA MUSICAL
   ========================================================= */


function criarIconeNota() {

  const svg =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );


  svg.setAttribute(
    "viewBox",
    "0 0 24 24"
  );


  svg.setAttribute(
    "fill",
    "none"
  );


  svg.setAttribute(
    "stroke",
    "currentColor"
  );


  svg.setAttribute(
    "stroke-width",
    "1.7"
  );


  svg.setAttribute(
    "stroke-linecap",
    "round"
  );


  svg.setAttribute(
    "stroke-linejoin",
    "round"
  );


  svg.setAttribute(
    "aria-hidden",
    "true"
  );


  const path =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );


  path.setAttribute(
    "d",
    "M9 18V5l11-2v13"
  );


  const circle1 =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );


  circle1.setAttribute(
    "cx",
    "6"
  );


  circle1.setAttribute(
    "cy",
    "18"
  );


  circle1.setAttribute(
    "r",
    "3"
  );


  const circle2 =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );


  circle2.setAttribute(
    "cx",
    "17"
  );


  circle2.setAttribute(
    "cy",
    "16"
  );


  circle2.setAttribute(
    "r",
    "3"
  );


  svg.append(
    path,
    circle1,
    circle2
  );


  return svg;

}


/* =========================================================
   CRIA CARD
   ========================================================= */


function criarCard(
  musica
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "track-card";


  card.tabIndex =
    0;


  card.setAttribute(
    "role",
    "button"
  );


  card.setAttribute(
    "aria-label",
    `Reproduzir ${musica.title} no Looply`
  );


  /*
   * Arte.
   */

  const art =
    document.createElement(
      "div"
    );


  art.className =
    "track-art";


  art.setAttribute(
    "aria-hidden",
    "true"
  );


  const img =
    document.createElement(
      "img"
    );


  img.src =
    musica.thumbnail;


  img.alt =
    "";


  img.loading =
    "lazy";


  img.decoding =
    "async";


  /*
   * Caso a thumbnail falhe,
   * mostramos a nota musical.
   */

  const fallback =
    document.createElement(
      "span"
    );


  fallback.textContent =
    "♫";


  fallback.style.fontSize =
    "24px";


  fallback.style.color =
    "var(--primary-strong)";


  art.appendChild(
    fallback
  );


  img.addEventListener(
    "load",
    () => {

      fallback.remove();

      art.prepend(img);

    },
    {
      once: true
    }
  );


  img.addEventListener(
    "error",
    () => {

      img.remove();

    },
    {
      once: true
    }
  );


  /*
   * Informações.
   */

  const info =
    document.createElement(
      "div"
    );


  info.className =
    "track-info";


  const badges =
    document.createElement(
      "div"
    );


  badges.className =
    "media-badges";


  const badge =
    document.createElement(
      "span"
    );


  badge.className =
    "badge";


  badge.textContent =
    "YouTube";


  badges.appendChild(
    badge
  );


  const title =
    document.createElement(
      "h3"
    );


  title.textContent =
    musica.title;


  const description =
    document.createElement(
      "p"
    );


  description.textContent =
    "Reproduzir no Looply · Comentários";


  info.append(
    badges,
    title,
    description
  );


  /*
   * Botão.
   */

  const play =
    document.createElement(
      "button"
    );


  play.type =
    "button";


  play.className =
    "play-button";


  play.setAttribute(
    "aria-label",
    `Reproduzir ${musica.title}`
  );


  play.appendChild(
    criarIconePlay()
  );


  /*
   * Abre a música.
   */

  const abrir = () => {
    void abrirMusica(musica);
  };


  card.addEventListener(
    "click",
    (event) => {

      /*
       * Se o clique veio do botão,
       * o botão já tratará o evento.
       */

      if (
        event.target.closest(
          ".play-button"
        )
      ) {

        return;

      }


      abrir();

    }
  );


  card.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" ||
        event.key === " "
      ) {

        event.preventDefault();

        abrir();

      }

    }
  );


  play.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      abrir();

    }
  );


  card.append(
    art,
    info,
    play
  );


  return card;

}


/* =========================================================
   RENDERIZAÇÃO
   ========================================================= */


function render() {

  if (!musicList) {
    return;
  }


  const filtered =
    state.tracks.filter(
      matches
    );


  state.filtered =
    filtered;


  musicList.replaceChildren();


  const fragment =
    document.createDocumentFragment();


  for (
    const musica
    of filtered
  ) {

    fragment.appendChild(
      criarCard(
        musica
      )
    );

  }


  musicList.appendChild(
    fragment
  );


  musicList.setAttribute(
    "aria-busy",
    "false"
  );


  if (musicStatus) {

    musicStatus.textContent =
      filtered.length
        ? `${filtered.length} ${
            filtered.length === 1
              ? "música"
              : "músicas"
          }`
        : "Nenhuma música encontrada";

  }


  if (musicEmpty) {

    musicEmpty.hidden =
      filtered.length !== 0;

  }

}


/* =========================================================
   PLAYER INTEGRADO + COMENTÁRIOS PERSISTENTES
   ========================================================= */

let musicOverlay = null;
let musicAttachmentURLs = [];
let activeMusic = null;
let stopMusicCommentsSubscription = null;
let musicCommentsRenderVersion = 0;

function revokeMusicAttachmentURLs() {
  for (const url of musicAttachmentURLs) URL.revokeObjectURL(url);
  musicAttachmentURLs = [];
}

function ensureMusicOverlay() {
  if (musicOverlay?.isConnected) return musicOverlay;
  musicOverlay = document.createElement("div");
  musicOverlay.id = "musicPlayerOverlay";
  musicOverlay.className = "music-player-overlay";
  musicOverlay.setAttribute("aria-hidden", "true");
  musicOverlay.innerHTML = `
    <section class="music-player-window" role="dialog" aria-modal="true" aria-labelledby="musicPlayerTitle">
      <header class="music-player-header">
        <div class="music-player-heading"><h2 id="musicPlayerTitle"></h2><p id="musicPlayerMeta"></p></div>
        <button type="button" class="icon-action" id="musicPlayerClose" aria-label="Fechar player">×</button>
      </header>
      <div class="music-player-scroll">
        <div class="music-player-frame" id="musicPlayerFrame"></div>
        <section class="music-comments-section" aria-labelledby="musicCommentsTitle">
          <h3 id="musicCommentsTitle">Comentários</h3>
          <div class="music-comments-list" id="musicCommentsList" aria-live="polite"></div>
          <form id="musicCommentForm" class="music-comment-form">
            <label class="sr-only" for="musicCommentText">Comentário</label>
            <textarea id="musicCommentText" rows="3" maxlength="5000" placeholder="Escreva um comentário…"></textarea>
            <div class="music-comment-tools">
              <label class="music-attach-button" for="musicCommentPhotos">＋ Fotos</label>
              <input id="musicCommentPhotos" type="file" accept="image/*" multiple hidden>
              <span id="musicCommentFiles" class="music-comment-files"></span>
              <button type="submit" class="login-button">Publicar</button>
            </div>
            <p id="musicCommentStatus" class="music-comment-status" role="status" aria-live="polite"></p>
          </form>
        </section>
      </div>
    </section>`;
  document.body.appendChild(musicOverlay);
  document.getElementById("musicPlayerClose").addEventListener("click", fecharMusica);
  musicOverlay.addEventListener("click", event => { if (event.target === musicOverlay) fecharMusica(); });
  document.getElementById("musicCommentPhotos").addEventListener("change", () => {
    const files = [...document.getElementById("musicCommentPhotos").files];
    document.getElementById("musicCommentFiles").textContent = files.map(file => file.name).join(", ");
  });
  document.getElementById("musicCommentForm").addEventListener("submit", salvarComentarioMusica);
  return musicOverlay;
}

function musicThreadKey(track) {
  // A mesma música na mesma playlist mantém seu histórico ao reabrir a janela.
  return `music:${activePlaylistId}:${track.videoId || "playlist"}`;
}

async function abrirMusica(track) {
  if (!track || (!track.videoId && !track.playlistId)) return;
  if (stopMusicCommentsSubscription) {
    await stopMusicCommentsSubscription();
    stopMusicCommentsSubscription = null;
  }
  activeMusic = track;
  revokeMusicAttachmentURLs();
  const overlay = ensureMusicOverlay();
  document.getElementById("musicPlayerTitle").textContent = track.title;
  document.getElementById("musicPlayerMeta").textContent = "YouTube";
  const frameHost = document.getElementById("musicPlayerFrame");
  frameHost.replaceChildren();
  const frame = document.createElement("iframe");
  frame.src = track.videoId
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(track.videoId)}?autoplay=1&playsinline=1&rel=0&list=${encodeURIComponent(activePlaylistId)}`
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(track.playlistId || activePlaylistId)}&autoplay=1&playsinline=1&rel=0`;
  frame.title = `Reprodutor: ${track.title}`;
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frameHost.appendChild(frame);
  document.getElementById("musicCommentText").value = "";
  document.getElementById("musicCommentPhotos").value = "";
  document.getElementById("musicCommentFiles").textContent = "";
  document.getElementById("musicCommentStatus").textContent = "";
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("music-player-open");
  const threadKey = musicThreadKey(track);
  if (getSession()?.cloudAuthenticated === true) {
    try {
      const unsubscribe = await subscribeThread(threadKey, () => {
        if (activeMusic && musicThreadKey(activeMusic) === threadKey) void renderMusicComments();
      }, (status, error) => {
        if (["CHANNEL_ERROR", "TIMED_OUT", "CALLBACK_ERROR"].includes(status)
            && activeMusic && musicThreadKey(activeMusic) === threadKey) {
          const message = document.getElementById("musicCommentStatus");
          if (message) message.textContent = "A sincronização em tempo real foi interrompida; os comentários ainda podem ser atualizados manualmente.";
          if (error) console.warn("Sincronização dos comentários:", error.message || error);
        }
      });
      if (!activeMusic || musicThreadKey(activeMusic) !== threadKey) await unsubscribe();
      else stopMusicCommentsSubscription = unsubscribe;
    } catch (error) {
      const message = document.getElementById("musicCommentStatus");
      if (message) message.textContent = error.message || "Não foi possível iniciar a sincronização em tempo real.";
    }
  }
  await renderMusicComments();
  document.getElementById("musicPlayerClose").focus();
}

function fecharMusica() {
  if (!musicOverlay) return;
  if (stopMusicCommentsSubscription) {
    void stopMusicCommentsSubscription();
    stopMusicCommentsSubscription = null;
  }
  musicCommentsRenderVersion++;
  musicOverlay.setAttribute("aria-hidden", "true");
  document.getElementById("musicPlayerFrame")?.replaceChildren();
  document.body.classList.remove("music-player-open");
  revokeMusicAttachmentURLs();
  activeMusic = null;
}

async function renderMusicComments() {
  const host = document.getElementById("musicCommentsList");
  if (!host || !activeMusic) return;
  const trackAtStart = activeMusic;
  const threadAtStart = musicThreadKey(trackAtStart);
  const renderVersion = ++musicCommentsRenderVersion;
  revokeMusicAttachmentURLs();
  host.replaceChildren();
  let comments;
  try {
    comments = await getThread(threadAtStart);
    if (renderVersion !== musicCommentsRenderVersion || !activeMusic || musicThreadKey(activeMusic) !== threadAtStart) return;
  } catch (error) {
    if (renderVersion !== musicCommentsRenderVersion) return;
    const note = document.createElement("p");
    note.className = "music-comments-empty";
    note.textContent = error.message || "O armazenamento de comentários está indisponível.";
    host.appendChild(note);
    return;
  }
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "music-comments-empty";
    empty.textContent = "Ainda não há comentários.";
    host.appendChild(empty);
    return;
  }
  for (const comment of [...comments].reverse()) {
    const article = document.createElement("article");
    article.className = "music-thread-comment";
    const meta = document.createElement("div");
    meta.className = "music-thread-comment-meta";
    meta.textContent = [comment.author, formatCommentDate(comment.createdAt)].filter(Boolean).join(" · ");
    article.appendChild(meta);
    if (comment.text) {
      const text = document.createElement("p");
      text.className = "music-thread-comment-text";
      text.textContent = comment.text;
      article.appendChild(text);
    }
    const attachments = document.createElement("div");
    attachments.className = "music-thread-attachments";
    for (const file of comment.attachments || []) {
      if (!String(file.type || "").startsWith("image/")) continue;
      const img = document.createElement("img");
      img.src = attachmentURL(file);
      musicAttachmentURLs.push(img.src);
      img.alt = file.name || "Fotografia anexada";
      img.loading = "lazy";
      attachments.appendChild(img);
    }
    if (attachments.childElementCount) article.appendChild(attachments);
    host.appendChild(article);
  }
}

async function salvarComentarioMusica(event) {
  event.preventDefault();
  if (!activeMusic) return;
  const form = document.getElementById("musicCommentForm");
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById("musicCommentStatus");
  const files = [...document.getElementById("musicCommentPhotos").files];
  const text = document.getElementById("musicCommentText").value;
  submit.disabled = true;
  status.textContent = "";
  try {
    if (files.length > 6) throw new Error("Anexe no máximo 6 fotografias por comentário.");
    if (files.some(file => !file.type.startsWith("image/"))) throw new Error("Anexe somente fotografias.");
    if (files.some(file => file.size > 12 * 1024 * 1024)) throw new Error("Cada fotografia deve ter no máximo 12 MB.");
    await addComment(musicThreadKey(activeMusic), text, files, getSession()?.username || "");
    document.getElementById("musicCommentText").value = "";
    document.getElementById("musicCommentPhotos").value = "";
    document.getElementById("musicCommentFiles").textContent = "";
    await renderMusicComments();
    status.textContent = cloudConfigured()
      ? (getSession()?.cloudAuthenticated === true
          ? "Comentário publicado na nuvem."
          : "Comentário salvo neste dispositivo. Esta conta ainda não foi migrada para a nuvem.")
      : "Comentário salvo neste dispositivo. Configure a nuvem para sincronizar entre aparelhos.";
  } catch (error) {
    status.textContent = error.message || "Não foi possível salvar o comentário.";
  } finally {
    submit.disabled = false;
  }
}

/* =========================================================
   ERROS DA API
   ========================================================= */


function normalizarErro(
  erro
) {

  const status =
    Number(
      erro?.status || 0
    );


  const reason =
    String(
      erro?.reason || ""
    ).toLowerCase();


  const mensagem =
    String(
      erro?.apiMessage ||
      erro?.message ||
      ""
    ).toLowerCase();


  /*
   * Cota.
   */

  if (
    reason.includes(
      "quota"
    ) ||
    mensagem.includes(
      "quota"
    )
  ) {

    return (
      "A cota diária da YouTube Data API foi atingida."
    );

  }


  /*
   * Chave inválida.
   */

  if (
    reason.includes(
      "keyinvalid"
    ) ||
    mensagem.includes(
      "api key not valid"
    )
  ) {

    return (
      "A chave da YouTube Data API não foi aceita pelo Google Cloud."
    );

  }


  /*
   * Restrição de referer.
   */

  if (
    reason.includes(
      "iprefererblocked"
    ) ||
    reason.includes(
      "refererblocked"
    ) ||
    mensagem.includes(
      "referer"
    )
  ) {

    return (
      "A chave da API está bloqueada pela restrição de aplicativo. Verifique os domínios autorizados no Google Cloud."
    );

  }


  /*
   * Playlist não encontrada.
   */

  if (
    reason.includes(
      "playlistnotfound"
    ) ||
    status === 404 ||
    mensagem.includes(
      "playlist not found"
    )
  ) {

    return (
      "A playlist não foi encontrada ou não está acessível."
    );

  }


  /*
   * Playlist inacessível.
   */

  if (
    reason.includes(
      "playlistitemsnotaccessible"
    ) ||
    mensagem.includes(
      "playlist items"
    )
  ) {

    return (
      "Os itens dessa playlist não estão acessíveis pela API."
    );

  }


  /*
   * 403.
   */

  if (
    status === 403
  ) {

    return (
      "O Google recusou a consulta à YouTube Data API."
    );

  }


  /*
   * 400.
   */

  if (
    status === 400
  ) {

    return (
      "A consulta enviada para a YouTube Data API foi recusada."
    );

  }


  /*
   * Falha de rede.
   */

  if (
    mensagem.includes(
      "failed to fetch"
    )
  ) {

    return (
      "Não foi possível conectar à YouTube Data API. Verifique a conexão e o acesso da página à internet."
    );

  }


  return (
    "Não foi possível consultar a playlist agora."
  );

}


/* =========================================================
   CARREGAMENTO DA PLAYLIST
   ========================================================= */


async function iniciar(playlistId = activePlaylistId, version = loadVersion) {

  playlistId = extrairPlaylistId(playlistId) || DEFAULT_PLAYLIST_ID;


  if (!playlistId) {

    throw new Error(
      "ID da playlist ausente."
    );

  }


  const itens =
    await obterTodosOsVideos(
      playlistId
    );
  if (version !== loadVersion) return;


  const musicas =
    itens

      .map(
        transformarItem
      )

      .filter(Boolean)

      .sort(
        (a, b) =>
          a.position -
          b.position
      );


  state.tracks =
    musicas;


  render();


  if (musicStatus) {

    musicStatus.textContent =
      musicas.length

        ? `${musicas.length} ${
            musicas.length === 1
              ? "música carregada"
              : "músicas carregadas"
          }`

        : "Playlist consultada";

  }

}


/* =========================================================
   CARREGAMENTO PRINCIPAL
   ========================================================= */


async function carregar(force = false) {

  if (state.loading && !force) return;
  const version = ++loadVersion;
  activePlaylistId = playlistForCurrentUser();


  state.loading =
    true;


  if (musicError) {

    musicError.hidden =
      true;

  }


  if (musicEmpty) {

    musicEmpty.hidden =
      true;

  }


  if (musicList) {

    musicList.setAttribute(
      "aria-busy",
      "true"
    );

  }


  if (musicStatus) {

    musicStatus.textContent =
      "Carregando músicas…";

  }


  try {

    await iniciar(activePlaylistId, version);


  } catch (erro) {

    console.error(
      "Looply: erro ao carregar a playlist do YouTube.",
      erro
    );


    if (version !== loadVersion) return;
    // Mesmo se a Data API atingir a cota ou estiver bloqueada, oferece o
    // player incorporado da playlist completa em vez de deixar a aba inutilizável.
    state.tracks = [{
      videoId: "",
      playlistId: activePlaylistId,
      title: "Playlist completa",
      description: "Reproduzir a playlist no Looply",
      thumbnail: "",
      position: 0,
      url: ""
    }];
    render();

    if (musicStatus) musicStatus.textContent = "Playlist integrada";
    if (musicError) musicError.hidden = true;
    console.warn("Looply: usando o player da playlist como alternativa à YouTube Data API.", normalizarErro(erro));


  } finally {

    state.loading =
      false;

  }

}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */


export function initMusic() {

  musicList =
    document.getElementById(
      "musicList"
    );


  musicSearch =
    document.getElementById(
      "musicSearch"
    );


  musicStatus =
    document.getElementById(
      "musicStatus"
    );


  musicEmpty =
    document.getElementById(
      "musicEmpty"
    );


  musicError =
    document.getElementById(
      "musicError"
    );


  musicErrorText =
    document.getElementById(
      "musicErrorText"
    );


  musicSearch?.addEventListener(
    "input",
    (event) => {

      state.query =
        event.target.value;


      render();

    }
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && musicOverlay?.getAttribute("aria-hidden") === "false") fecharMusica();
  });

  carregar();

      }
