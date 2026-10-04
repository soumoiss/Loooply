import { APP_CONFIG } from "./config.js";
import { getReadCards, setReadCards, getPreferences, setPreferences } from "./storage.js";
import { requireAuth, logout } from "./session.js";

export function initProfile() {
  const session = requireAuth();
  if (!session) return;

  const welcome = document.getElementById("profileName");
  const avatar = document.getElementById("profileAvatar");
  const counter = document.getElementById("profileCounter");
  const reset = document.getElementById("resetReads");
  const logoutButton = document.getElementById("profileLogout");
  const reduceMotion = document.getElementById("reduceMotion");

  if (welcome) welcome.textContent = session.username;
  if (avatar) {
    avatar.src = session.profilePic;
    avatar.alt = `Foto de ${session.username}`;
    avatar.onerror = () => {
      avatar.classList.add("avatar-missing");
      const fallback = document.getElementById("profileFallback");
      if (fallback) { fallback.textContent = session.username.slice(0, 2).toUpperCase(); fallback.style.display = "flex"; }
    };
  }
  const reads = getReadCards(session.username);
  if (counter) counter.textContent = `${Object.keys(reads).length}/${APP_CONFIG.totalCards}`;

  reset?.addEventListener("click", () => {
    if (!confirm("Apagar apenas o estado de cartas lidas deste usuário?")) return;
    setReadCards(session.username, {});
    if (counter) counter.textContent = `0/${APP_CONFIG.totalCards}`;
  });

  logoutButton?.addEventListener("click", logout);
  const preferences = getPreferences();
  if (reduceMotion) {
    reduceMotion.checked = preferences.reduceMotion === true;
    reduceMotion.addEventListener("change", () => {
      const next = { ...getPreferences(), reduceMotion: reduceMotion.checked };
      setPreferences(next);
      document.documentElement.classList.toggle("reduce-motion", reduceMotion.checked);
    });
  }
}
