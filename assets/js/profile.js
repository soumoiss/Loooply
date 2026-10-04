import { APP_CONFIG } from "./config.js";

import {
  getReadCards,
  setReadCards,
  getPreferences,
  setPreferences
} from "./storage.js";

import {
  requireAuth,
  logout
} from "./session.js";


function applyMotionPreference(enabled) {
  document.documentElement.classList.toggle(
    "reduce-motion",
    enabled === true
  );
}


function updateReadCounter(username) {
  const counter = document.getElementById("profileCounter");

  if (!counter) return;

  const reads = getReadCards(username);

  const total = Object.keys(reads).length;

  counter.textContent =
    `${total}/${APP_CONFIG.totalCards}`;
}


function setupAvatar(session) {
  const avatar =
    document.getElementById("profileAvatar");

  const fallback =
    document.getElementById("profileFallback");

  if (!avatar) return;

  const initials =
    session.username
      .slice(0, 2)
      .toUpperCase();


  avatar.alt =
    `Foto de ${session.username}`;


  const showFallback = () => {
    avatar.hidden = true;

    avatar.classList.add("avatar-missing");

    if (fallback) {
      fallback.textContent = initials;

      fallback.style.display = "flex";

      fallback.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  };


  avatar.addEventListener(
    "error",
    showFallback
  );


  avatar.addEventListener(
    "load",
    () => {
      avatar.hidden = false;

      avatar.classList.remove(
        "avatar-missing"
      );

      if (fallback) {
        fallback.style.display = "none";

        fallback.setAttribute(
          "aria-hidden",
          "true"
        );
      }
    }
  );


  avatar.src =
    session.profilePic || "";


  if (!session.profilePic) {
    showFallback();
  }
}


export function initProfile() {
  const session = requireAuth();

  if (!session) return;


  const name =
    document.getElementById("profileName");

  const reset =
    document.getElementById("resetReads");

  const logoutButton =
    document.getElementById("profileLogout");

  const reduceMotion =
    document.getElementById("reduceMotion");


  if (name) {
    name.textContent =
      session.username;
  }


  setupAvatar(session);


  updateReadCounter(
    session.username
  );


  const preferences =
    getPreferences();


  const reduceMotionEnabled =
    preferences.reduceMotion === true;


  if (reduceMotion) {
    reduceMotion.checked =
      reduceMotionEnabled;

    applyMotionPreference(
      reduceMotionEnabled
    );


    reduceMotion.addEventListener(
      "change",
      () => {
        const next = {
          ...getPreferences(),
          reduceMotion:
            reduceMotion.checked
        };


        if (setPreferences(next)) {
          applyMotionPreference(
            reduceMotion.checked
          );
        }
      }
    );
  } else {
    applyMotionPreference(
      reduceMotionEnabled
    );
  }


  reset?.addEventListener(
    "click",
    () => {
      const confirmed =
        window.confirm(
          "Zerar todas as cartas lidas deste usuário?"
        );


      if (!confirmed) return;


      if (
        !setReadCards(
          session.username,
          {}
        )
      ) {
        window.alert(
          "Não foi possível zerar o estado das cartas."
        );

        return;
      }


      updateReadCounter(
        session.username
      );


      window.dispatchEvent(
        new CustomEvent(
          "looply:reads-reset",
          {
            detail: {
              username:
                session.username
            }
          }
        )
      );
    }
  );


  logoutButton?.addEventListener(
    "click",
    logout
  );
}


/*
 * IMPORTANTE:
 * O código antigo definia initProfile(),
 * mas nunca o executava.
 */
initProfile();
