import { APP_CONFIG } from "./config.js";
import { getSession } from "./session.js";

const ICONS = Object.freeze({
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>'
});

export function navigate(routeKey) {
  const destination = APP_CONFIG.routes[routeKey] || routeKey;
  if (typeof destination !== "string" || !destination) return;
  window.location.assign(destination);
}

export function goBack(fallback = APP_CONFIG.routes.home) {
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer && referrer.origin === window.location.origin && window.history.length > 1) {
      window.history.back();
      return;
    }
  } catch {
    // Se a origem não puder ser validada, usa a rota segura de fallback.
  }
  window.location.assign(fallback);
}

export function bindNavigation(root = document) {
  root.querySelectorAll("[data-route]").forEach((element) => {
    if (element.dataset.navigationBound === "true") return;
    element.dataset.navigationBound = "true";
    element.addEventListener("click", (event) => {
      // Não intercepta links abertos em nova aba nem cliques modificados.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (element.tagName === "A" && element.target && element.target !== "_self") return;
      event.preventDefault();
      navigate(element.dataset.route);
    });
  });
}

export function initSharedNavigation() {
  const path = window.location.pathname.split("/").filter(Boolean).pop() || "index.html";
  const currentKey = Object.keys(APP_CONFIG.routes).find((key) => APP_CONFIG.routes[key] === path);
  document.querySelectorAll(".header-actions a, .navigation-stack [data-route]").forEach((link) => {
    const href = link.dataset.route
      ? (APP_CONFIG.routes[link.dataset.route] || link.dataset.route)
      : (link.getAttribute("href") || "");
    if (href.split("/").pop() === path) {
      link.setAttribute("aria-current", "page");
      link.classList.add("is-current");
    } else {
      link.removeAttribute("aria-current");
      link.classList.remove("is-current");
    }
  });

  const header = document.querySelector(".page-header");
  const session = getSession();
  if (header && session && !header.querySelector("[data-looply-header-profile]")) {
    const profile = document.createElement("a");
    profile.className = "looply-header-profile";
    profile.href = APP_CONFIG.routes.profile;
    profile.dataset.route = "profile";
    profile.dataset.looplyHeaderProfile = "true";
    profile.setAttribute("aria-label", "Abrir meu perfil");
    const avatar = document.createElement("img");
    avatar.className = "looply-header-avatar";
    avatar.alt = "";
    avatar.setAttribute("aria-hidden", "true");
    if (session.profilePic) avatar.src = session.profilePic;
    const fallback = document.createElement("span");
    fallback.className = "looply-header-avatar-fallback";
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = String(session.username || "EU").slice(0, 2).toLocaleUpperCase("pt-BR");
    profile.append(avatar, fallback);
    avatar.addEventListener("error", () => { avatar.hidden = true; fallback.hidden = false; }, { once: true });
    if (session.profilePic) fallback.hidden = true;
    header.append(profile);
  }
  const secondary = currentKey && !["index", "login", "home"].includes(currentKey);
  if (header && secondary && !header.querySelector("[data-looply-back]")) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "header-action looply-back";
    back.dataset.looplyBack = "true";
    back.setAttribute("aria-label", "Voltar à página anterior");
    back.title = "Voltar";
    back.innerHTML = ICONS.back;
    back.addEventListener("click", () => goBack(APP_CONFIG.routes.home));
    header.prepend(back);
  }
  bindNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSharedNavigation, { once: true });
} else {
  initSharedNavigation();
}
