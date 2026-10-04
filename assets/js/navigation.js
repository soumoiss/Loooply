import { APP_CONFIG } from "./config.js";

export function navigate(routeKey) {
  const destination = APP_CONFIG.routes[routeKey] || routeKey;
  window.location.assign(destination);
}

export function bindNavigation(root = document) {
  root.querySelectorAll("[data-route]").forEach((element) => {
    element.addEventListener("click", () => navigate(element.dataset.route));
  });
}
