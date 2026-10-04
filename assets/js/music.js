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


const PLAYLIST_URL =
  "https://youtube.com/playlist?list=PLMeQ_QyqhY7s&si=uPKgxxgFpAnX2xIP";


const PLAYLIST_ID =
  "PLMeQ_QyqhY7s";


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
        PLAYLIST_ID
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
    "link"
  );


  card.setAttribute(
    "aria-label",
    `Abrir ${musica.title} no YouTube`
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
    "Abrir no YouTube";


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

  const abrir =
    () => {

      window.open(
        musica.url,
        "_blank",
        "noopener,noreferrer"
      );

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


async function iniciar() {

  const playlistId =
    extrairPlaylistId(
      PLAYLIST_URL
    ) ||
    PLAYLIST_ID;


  if (!playlistId) {

    throw new Error(
      "ID da playlist ausente."
    );

  }


  const itens =
    await obterTodosOsVideos(
      playlistId
    );


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


async function carregar() {

  if (
    state.loading
  ) {

    return;

  }


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

    await iniciar();


  } catch (erro) {

    console.error(
      "Looply: erro ao carregar a playlist do YouTube.",
      erro
    );


    state.tracks =
      [];


    if (musicList) {

      musicList.replaceChildren();

      musicList.setAttribute(
        "aria-busy",
        "false"
      );

    }


    if (musicStatus) {

      musicStatus.textContent =
        "Não foi possível carregar a playlist";

    }


    if (musicErrorText) {

      musicErrorText.textContent =
        normalizarErro(
          erro
        );

    }


    if (musicError) {

      musicError.hidden =
        false;

    }


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


  carregar();

      }
