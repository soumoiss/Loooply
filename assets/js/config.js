export const APP_CONFIG = Object.freeze({
  name: "Looply",
  company: "MoissWorld",
  language: "pt-BR",
  totalCards: 50,
  storage: Object.freeze({
    loggedIn: "isLoggedIn",
    username: "username",
    profilePic: "profilePic",
    sessionV2: "looply_session_v2",
    preferences: "looply_preferences"
  }),
  routes: Object.freeze({
    index: "index.html",
    login: "login.html",
    home: "home.html",
    gallery: "galeria.html",
    music: "musicas.html",
    profile: "perfil.html"
  }),
  data: Object.freeze({
    gallery: "data/midia-index.json",
    music: "data/musicas-index.json"
  }),
  cardPath(username, number) {
    return `${username}carta${number}.txt`;
  }
});

export const CARD_STATUS = Object.freeze({
  loading: "loading",
  ready: "ready",
  unavailable: "unavailable",
  error: "error"
});
