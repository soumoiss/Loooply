import { APP_CONFIG } from "./config.js";

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readString(key, fallback = "") {
  const storage = safeLocalStorage();
  if (!storage) return fallback;
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeString(key, value) {
  const storage = safeLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.warn("Looply: falha ao salvar armazenamento local.", error);
    return false;
  }
}

export function removeKey(key) {
  const storage = safeLocalStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback = null) {
  const raw = readString(key, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    return writeString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function clearSessionStorage() {
  removeKey(APP_CONFIG.storage.loggedIn);
  removeKey(APP_CONFIG.storage.username);
  removeKey(APP_CONFIG.storage.profilePic);
  removeKey(APP_CONFIG.storage.sessionV2);
}

export function getReadCardsKey(username) {
  return `moissworld_cartas_lidas_${encodeURIComponent(String(username || "usuario"))}`;
}

export function getReadCards(username) {
  const data = readJSON(getReadCardsKey(username), {});
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => /^\d+$/.test(key) && value === true)
  );
}

export function setReadCards(username, cards) {
  return writeJSON(getReadCardsKey(username), cards && typeof cards === "object" ? cards : {});
}

export function markCardRead(username, number) {
  const cards = getReadCards(username);
  cards[String(number)] = true;
  setReadCards(username, cards);
  return cards;
}

export function getPreferences() {
  return readJSON(APP_CONFIG.storage.preferences, {}) || {};
}

export function setPreferences(value) {
  return writeJSON(APP_CONFIG.storage.preferences, value || {});
}
