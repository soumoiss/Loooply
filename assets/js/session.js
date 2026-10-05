import { APP_CONFIG } from "./config.js";
import { canonicalUsername, getUser, userExists } from "./users.js";
import {
  readJSON,
  readString,
  writeJSON,
  writeString,
  clearSessionStorage
} from "./storage.js";

async function sha256Hex(value) {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto API não disponível.");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeUsername(value) {
  return canonicalUsername(value);
}

export async function authenticate(username, password) {
  const normalized = normalizeUsername(username);
  const user = getUser(normalized);
  if (!user || !password) return null;
  const hash = await sha256Hex(String(password));
  return hash === user.passwordHash ? { username: normalized, ...user } : null;
}

export function createSession(username) {
  const normalized = normalizeUsername(username);
  const user = getUser(normalized);
  if (!user) return false;

  const session = {
    authenticated: true,
    username: normalized,
    profilePic: user.profilePic,
    createdAt: new Date().toISOString()
  };

  writeString(APP_CONFIG.storage.loggedIn, "true");
  writeString(APP_CONFIG.storage.username, normalized);
  writeString(APP_CONFIG.storage.profilePic, user.profilePic);
  writeJSON(APP_CONFIG.storage.sessionV2, session);
  return true;
}

export function getSession() {
  const loggedIn = readString(APP_CONFIG.storage.loggedIn, "") === "true";
  const username = normalizeUsername(readString(APP_CONFIG.storage.username, ""));
  const legacyProfilePic = readString(APP_CONFIG.storage.profilePic, "");
  const user = username ? getUser(username) : null;
  const v2 = readJSON(APP_CONFIG.storage.sessionV2, null);

  const valid = loggedIn && Boolean(user) && (!v2 || v2.authenticated === true ? true : false);
  if (!valid) return null;

  const session = {
    authenticated: true,
    username,
    profilePic: user.profilePic || legacyProfilePic,
    createdAt: v2?.createdAt || null
  };

  if (legacyProfilePic !== user.profilePic) {
    writeString(APP_CONFIG.storage.profilePic, user.profilePic);
  }

  if (!v2 || v2.username !== username || v2.profilePic !== user.profilePic) {
    writeJSON(APP_CONFIG.storage.sessionV2, session);
  }

  return session;
}

export function isAuthenticated() {
  return Boolean(getSession());
}

export function requireAuth(redirect = APP_CONFIG.routes.login) {
  const session = getSession();
  if (!session) {
    window.location.replace(redirect);
    return null;
  }
  return session;
}

export function logout() {
  clearSessionStorage();
  window.location.replace(APP_CONFIG.routes.login);
}

export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.replace(APP_CONFIG.routes.home);
    return true;
  }
  return false;
}

export function canAccessUser(username) {
  return userExists(username);
}
