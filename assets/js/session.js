import { APP_CONFIG } from "./config.js";
import { cloudConfigured, cloudSignIn, cloudSignOut } from "./cloud.js";
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
  return canonicalUsername(value) || (cloudConfigured() ? String(value || "").trim().toLocaleLowerCase("pt-BR") : "");
}

export async function authenticate(username, password) {
  const legacyUsername = canonicalUsername(username);
  const legacyUser = getUser(legacyUsername);
  if (legacyUser) {
    if (!password) return null;
    const hash = await sha256Hex(String(password));
    return hash === legacyUser.passwordHash
      ? { username: legacyUsername, ...legacyUser, role: "user", cloudAuthenticated: false }
      : null;
  }
  if (cloudConfigured()) return cloudSignIn(username, password);
  return null;
}

export function createSession(username, profilePic = "", role = "user", cloudAuthenticated = false) {
  const normalized = normalizeUsername(username) || String(username || "").trim();
  const user = getUser(normalized);
  if (!user && !cloudAuthenticated && !cloudConfigured()) return false;
  if (!user && !cloudAuthenticated) return false;
  const resolvedPic = user?.profilePic || profilePic || "";

  const session = {
    authenticated: true,
    username: normalized,
    profilePic: resolvedPic,
    role: role || "user",
    cloudAuthenticated: cloudAuthenticated === true,
    createdAt: new Date().toISOString()
  };

  writeString(APP_CONFIG.storage.loggedIn, "true");
  writeString(APP_CONFIG.storage.username, normalized);
  writeString(APP_CONFIG.storage.profilePic, resolvedPic);
  writeJSON(APP_CONFIG.storage.sessionV2, session);
  return true;
}

export function getSession() {
  const loggedIn = readString(APP_CONFIG.storage.loggedIn, "") === "true";
  const rawUsername = readString(APP_CONFIG.storage.username, "");
  const username = normalizeUsername(rawUsername) || rawUsername;
  const legacyProfilePic = readString(APP_CONFIG.storage.profilePic, "");
  const user = username ? getUser(username) : null;
  const v2 = readJSON(APP_CONFIG.storage.sessionV2, null);
  const validCloudSession = cloudConfigured()
    && v2?.authenticated === true
    && v2?.cloudAuthenticated === true
    && v2.username === username
    && Boolean(username);
  const validLegacySession = Boolean(user)
    && v2?.authenticated === true
    && v2?.cloudAuthenticated === false
    && v2.username === username;
  const validLocalSession = cloudConfigured() ? validLegacySession : Boolean(user);
  const valid = loggedIn && (validCloudSession || validLocalSession) && (!v2 || v2.authenticated === true);
  if (!valid) return null;

  const session = {
    authenticated: true,
    username,
    profilePic: user?.profilePic || legacyProfilePic || v2?.profilePic || "",
    role: validCloudSession ? (v2?.role || "user") : "user",
    cloudAuthenticated: validCloudSession,
    createdAt: v2?.createdAt || null
  };
  if (user && legacyProfilePic !== user.profilePic) writeString(APP_CONFIG.storage.profilePic, user.profilePic);
  if (!v2 || v2.username !== username || v2.profilePic !== session.profilePic || v2.role !== session.role || v2.cloudAuthenticated !== session.cloudAuthenticated) {
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

export async function logout() {
  // O usuário pediu explicitamente para sair: encerra a sessão Supabase local
  // antes do redirecionamento, evitando que o splash restaure a conta anterior.
  try {
    await cloudSignOut();
  } catch (error) {
    console.warn("Looply: não foi possível encerrar a sessão remota.", error);
  } finally {
    clearSessionStorage();
    window.location.replace(APP_CONFIG.routes.login);
  }
}

export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.replace(getSession()?.role === "admin" ? "admin.html" : APP_CONFIG.routes.home);
    return true;
  }
  return false;
}

export function canAccessUser(username) {
  return userExists(username);
}
