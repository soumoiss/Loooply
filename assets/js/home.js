import { APP_CONFIG, CARD_STATUS } from "./config.js";
import { bindNavigation, navigate } from "./navigation.js";
import { requireAuth, logout } from "./session.js";
import { getReadCards, markCardRead } from "./storage.js";
import {
  CardRepository,
  buildCardRow,
  updateCardRow,
  unlockCard
} from "./cards.js";
import { formatShort, formatFull, formatMonthYear, toISO, fromISO, sameDay, firstDayOfMonth, addMonths } from "./date-parser.js";

const state = {
  session: null,
  repository: null,
  reads: {},
  filter: { mode: "all", iso: null },
  calendarOpen: false,
  calendarMonth: firstDayOfMonth(new Date()),
  modalNumber: null,
  lastFocused: null,
  loadingFinished: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = String(value ?? "");
}

function getRow(number) {
  return $(`.card-row[data-number="${number}"]`);
}

function updateOverview() {
  const count = Object.values(state.reads).filter(Boolean).length;
  setText("#readCount", `${count}/${APP_CONFIG.totalCards} lidas`);
  setText("#contador", `${count}/${APP_CONFIG.totalCards} lidas`);
  setText("#collectionNote", count === APP_CONFIG.totalCards
    ? "Todas as cartas já foram lidas"
    : count === 0
      ? `${APP_CONFIG.totalCards} cartas para guardar`
      : `${APP_CONFIG.totalCards - count} cartas ainda esperam por você`);
}

function visibleCards() {
  const cards = state.repository?.getAll() || [];
  if (state.filter.mode === "date") return cards.filter((card) => card.iso === state.filter.iso);
  if (state.filter.mode === "no-date") return cards.filter((card) => card.status === CARD_STATUS.ready && !card.iso);
  return cards;
}

function updateFilterStatus() {
  const total = state.repository?.getAll().length || 0;
  const visible = visibleCards().filter((card) => card.status !== CARD_STATUS.loading || state.filter.mode === "all").length;
  let text = `Mostrando ${visible} carta${visible === 1 ? "" : "s"}`;
  if (state.filter.mode === "date") {
    const date = fromISO(state.filter.iso);
    text = date ? `${visible} carta${visible === 1 ? "" : "s"} em ${formatFull(date)}` : "Data selecionada";
  } else if (state.filter.mode === "no-date") {
    text = `${visible} carta${visible === 1 ? "" : "s"} sem data reconhecida`;
  }
  setText("#filterStatus", text);
  const empty = $("#emptyState");
  if (empty) empty.classList.toggle("is-visible", state.loadingFinished && visible === 0);
  setText("#loadingSummary", `${state.repository?.stats.loaded || 0} disponíveis · ${state.repository?.stats.unavailable || 0} ausentes`);
  return total;
}

function updateRowsVisibility() {
  const matches = new Set(visibleCards().map((card) => card.number));
  $$(".card-row").forEach((row) => {
    row.hidden = !matches.has(Number(row.dataset.number));
  });
  updateFilterStatus();
}

function createRows() {
  const container = $("#cartasContainer");
  if (!container || !state.repository) return;
  const fragment = document.createDocumentFragment();
  state.repository.cards.clear();
  state.repository.total = APP_CONFIG.totalCards;
  for (let number = 1; number <= APP_CONFIG.totalCards; number += 1) state.repository.seed(number);
  for (let number = 1; number <= APP_CONFIG.totalCards; number += 1) state.repository.seedPrivate(number);
  for (const card of state.repository.getAll()) {
    const number = card.number;
    const row = buildCardRow({ card, read: state.reads[number] === true });
    row.addEventListener("click", () => openCard(number));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCard(number);
      }
    });
    fragment.appendChild(row);
  }
  container.replaceChildren(fragment);
  updateRowsVisibility();
}

function updateRow(card) {
  const row = getRow(card.number);
  if (!row) return;
  updateCardRow(row, card, state.reads[card.number] === true);
  updateRowsVisibility();
}

function filterAll() {
  state.filter = { mode: "all", iso: null };
  setFilterButton("all");
  renderCalendar();
  updateRowsVisibility();
}

function filterNoDate() {
  state.filter = { mode: "no-date", iso: null };
  setFilterButton("no-date");
  updateRowsVisibility();
}

function filterDate(iso) {
  if (!fromISO(iso)) return;
  state.filter = { mode: "date", iso };
  setFilterButton("date");
  state.calendarMonth = firstDayOfMonth(fromISO(iso));
  renderCalendar();
  updateRowsVisibility();
}

function setFilterButton(active) {
  const map = { all: "#btnTodas", date: "#btnCalendario", "no-date": "#btnSemData" };
  for (const [key, selector] of Object.entries(map)) {
    const el = $(selector);
    if (!el) continue;
    const selected = key === active;
    el.classList.toggle("active", selected);
    el.setAttribute("aria-pressed", selected ? "true" : "false");
  }
  const panel = $("#calendarPanel");
  const calendarButton = $("#btnCalendario");
  const open = state.calendarOpen;
  panel?.classList.toggle("is-open", open);
  panel?.setAttribute("aria-hidden", open ? "false" : "true");
  calendarButton?.setAttribute("aria-expanded", open ? "true" : "false");
}

function getDateMap() {
  const map = new Map();
  for (const card of state.repository?.getWithDate() || []) {
    const list = map.get(card.iso) || [];
    list.push(card.number);
    map.set(card.iso, list);
  }
  return map;
}

function renderCalendar() {
  const grid = $("#calendarGrid");
  const monthLabel = $("#calendarMonth");
  if (!grid) return;
  const month = firstDayOfMonth(state.calendarMonth);
  state.calendarMonth = month;
  if (monthLabel) monthLabel.textContent = formatMonthYear(month);

  const dateMap = getDateMap();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-blank";
    cells.push(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day, 12);
    const iso = toISO(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    const cards = dateMap.get(iso) || [];
    const selected = state.filter.mode === "date" && state.filter.iso === iso;
    const today = sameDay(date, new Date());
    button.classList.toggle("has-cards", cards.length > 0);
    button.classList.toggle("selected", selected);
    button.classList.toggle("today", today);
    button.disabled = cards.length === 0;
    button.title = cards.length ? `${cards.length} carta${cards.length === 1 ? "" : "s"}` : "Nenhuma carta com data reconhecida";
    button.setAttribute("aria-label", cards.length ? `${day}, ${cards.length} carta${cards.length === 1 ? "" : "s"}` : `${day}, sem cartas`);
    if (cards.length) button.addEventListener("click", () => filterDate(iso));
    cells.push(button);
  }

  grid.replaceChildren(...cells);
  const availableDates = dateMap.size;
  setText("#calendarInfo", `${availableDates} dia${availableDates === 1 ? "" : "s"} com cartas`);

  const sorted = [...dateMap.keys()].sort();
  const minMonth = sorted.length ? sorted[0].slice(0, 7) : null;
  const maxMonth = sorted.length ? sorted[sorted.length - 1].slice(0, 7) : null;
  const currentMonthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const previous = document.querySelector('[data-calendar="previous"]');
  const next = document.querySelector('[data-calendar="next"]');
  if (previous) previous.disabled = Boolean(minMonth && currentMonthKey <= minMonth);
  if (next) next.disabled = Boolean(maxMonth && currentMonthKey >= maxMonth);
}

function moveCalendar(amount) {
  const nextMonth = addMonths(state.calendarMonth, amount);
  state.calendarMonth = nextMonth;
  renderCalendar();
}

function toggleCalendar() {
  state.calendarOpen = !state.calendarOpen;
  if (state.calendarOpen) renderCalendar();
  setFilterButton(state.filter.mode === "no-date" ? "no-date" : state.calendarOpen || state.filter.mode === "date" ? "date" : "all");
}

function initializeCalendarMonth() {
  const dated = state.repository?.getWithDate() || [];
  if (dated.length) {
    const latest = [...dated].sort((a, b) => a.iso.localeCompare(b.iso)).at(-1);
    state.calendarMonth = firstDayOfMonth(latest.date);
  }
  renderCalendar();
}

function modalElements() {
  return {
    modal: $("#modal"),
    title: $("#modalTitulo"),
    date: $("#modalData"),
    text: $("#modalTexto"),
    unlock: $("#modalUnlock"),
    hint: $("#modalHint"),
    password: $("#modalPassword"),
    unlockButton: $("#modalUnlockButton"),
    unlockError: $("#modalUnlockError"),
    previous: $("#modalPrevious"),
    next: $("#modalNext")
  };
}

function showModalContent(value) {
  const { text, unlock } = modalElements();

  if (unlock) unlock.hidden = true;

  if (text) {
    text.hidden = false;
    text.textContent = String(value || "");
  }
}

function showUnlockPrompt(card) {
  const { text, unlock, hint, password, unlockError } = modalElements();

  if (text) {
    text.hidden = true;
    text.textContent = "";
  }

  if (unlock) unlock.hidden = false;

  if (hint) {
    hint.textContent = card?.hint
      ? `Dica: ${card.hint}`
      : "Dica: nenhuma dica foi configurada para esta carta.";
  }

  if (password) {
    password.value = "";
    password.focus();
  }

  if (unlockError) {
    unlockError.textContent = "";
    unlockError.classList.remove("show");
  }
}

function showUnlockError() {
  const { unlockError, password } = modalElements();

  if (unlockError) {
    unlockError.textContent = "Senha incorreta. Tente novamente.";
    unlockError.classList.add("show");
  }

  password?.focus();
  password?.select?.();
}

function setModal(open) {
  const { modal } = modalElements();
  if (!modal) return;
  modal.classList.toggle("is-open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("modal-open", open);
  if (open) {
    modal.removeAttribute("inert");
  } else {
    modal.setAttribute("inert", "");
  }
}

function updateModalNavigation() {
  const numbers = visibleCards().filter((card) => card.status === CARD_STATUS.ready).map((card) => card.number);
  const index = numbers.indexOf(state.modalNumber);
  const { previous, next } = modalElements();
  if (previous) previous.disabled = index <= 0;
  if (next) next.disabled = index < 0 || index >= numbers.length - 1;
}

function focusModalText() {
  const { text } = modalElements();
  requestAnimationFrame(() => text?.focus());
}

async function openCard(number) {
  const card = state.repository?.get(number);
  if (!card) return;

  state.lastFocused = document.activeElement;
  state.modalNumber = Number(number);

  const { title, date } = modalElements();

  if (title) {
    title.textContent = card.isProtected && !card.unlocked
      ? "Carta protegida"
      : card.title || "Carregando…";
  }

  if (date) {
    date.textContent = card.date ? formatShort(card.date) : "";
  }

  if (card.isProtected && !card.unlocked) {
    showUnlockPrompt(card);
  } else {
    showModalContent(card.text || "Carregando carta…");
  }

  setModal(true);

  let current = card;

  if (current.status !== CARD_STATUS.ready) {
    current = await state.repository.loadOne(number);
    updateRow(current);

    if (title) {
      title.textContent = current.isProtected && !current.unlocked
        ? "Carta protegida"
        : current.title;
    }

    if (date) {
      date.textContent = current.date ? formatShort(current.date) : "";
    }
  }

  if (current.status !== CARD_STATUS.ready) {
    showModalContent(
      current.status === CARD_STATUS.unavailable
        ? "Esta carta ainda não está disponível no conjunto de arquivos enviado."
        : "Não foi possível carregar esta carta."
    );
  } else if (current.isProtected && !current.unlocked) {
    showUnlockPrompt(current);
  } else {
    showModalContent(current.text);
    state.reads = markCardRead(state.session.username, number);
    updateRow(current);
    updateOverview();
  }

  updateModalNavigation();
}


function submitUnlock() {
  const card = state.repository?.get(state.modalNumber);
  if (!card?.isProtected) return;

  const { password, title } = modalElements();
  const result = unlockCard(card, password?.value || "");

  if (!result.ok) {
    showUnlockError();
    return;
  }

  if (title) title.textContent = card.title || "Carta";
  showModalContent(result.text);

  state.reads = markCardRead(state.session.username, card.number);
  updateRow(card);
  updateOverview();
  updateModalNavigation();

  focusModalText();
}

function closeCard() {
  const { text, unlock, password, hint, unlockError } = modalElements();

  setModal(false);

  if (text) {
    text.textContent = "";
    text.hidden = false;
  }

  if (unlock) unlock.hidden = true;
  if (password) password.value = "";
  if (hint) hint.textContent = "";

  if (unlockError) {
    unlockError.textContent = "";
    unlockError.classList.remove("show");
  }

  state.modalNumber = null;
  state.lastFocused?.focus?.();
}

function moveModal(step) {
  const list = visibleCards().filter((card) => card.status === CARD_STATUS.ready);
  const index = list.findIndex((card) => card.number === state.modalNumber);
  const next = list[index + step];
  if (next) openCard(next.number);
}

function setupModal() {
  const {
    modal,
    previous,
    next,
    unlockButton,
    password
  } = modalElements();

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeCard();
  });

  $("#modalClose")?.addEventListener("click", closeCard);
  $("#modalCloseFooter")?.addEventListener("click", closeCard);
  previous?.addEventListener("click", () => moveModal(-1));
  next?.addEventListener("click", () => moveModal(1));

  unlockButton?.addEventListener("click", submitUnlock);

  password?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitUnlock();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!$("#modal")?.classList.contains("is-open")) return;
    if (event.key === "Escape") closeCard();

    const active = document.activeElement;
    const typing =
      active?.tagName === "INPUT" ||
      active?.tagName === "TEXTAREA" ||
      active?.isContentEditable;

    if (!typing && event.key === "ArrowLeft") moveModal(-1);
    if (!typing && event.key === "ArrowRight") moveModal(1);
  });
}

function bindHomeEvents() {
  bindNavigation();
  $("#btnTodas")?.addEventListener("click", filterAll);
  $("#btnCalendario")?.addEventListener("click", toggleCalendar);
  $("#btnSemData")?.addEventListener("click", filterNoDate);
  document.querySelector('[data-calendar="previous"]')?.addEventListener("click", () => moveCalendar(-1));
  document.querySelector('[data-calendar="next"]')?.addEventListener("click", () => moveCalendar(1));
  $("#logoutButton")?.addEventListener("click", logout);
  setupModal();

  // Compatibilidade com chamadas antigas que ainda possam existir em favoritos/scripts externos.
  window.filtrarTodas = filterAll;
  window.filtrarSemData = filterNoDate;
  window.alternarCalendario = toggleCalendar;
  window.mudarMes = moveCalendar;
  window.abrirCarta = openCard;
  window.fecharCarta = closeCard;
  window.fecharAoClicarFora = (event) => { if (event.target === event.currentTarget) closeCard(); };
  window.abrirGaleria = () => navigate("gallery");
  window.abrirMusicas = () => navigate("music");
  window.navegarParaGaleria = () => navigate("gallery");
  window.navegarParaMusicas = () => navigate("music");
  window.logout = logout;
}

async function loadCards() {
  const loading = $("#loadingState");
  const noDateButton = $("#btnSemData");
  state.repository.loadAll({
    concurrency: 6,
    onEach(card) {
      // Arquivos privados inexistentes são sondados para descobrir quais
      // existem. Remova a linha provisória em vez de deixá-la carregando.
      if (card.isPrivateFile && card.status === CARD_STATUS.unavailable) {
        getRow(card.number)?.remove();
        updateRowsVisibility();
        return;
      }

      updateRow(card);
      if (card.status === CARD_STATUS.ready && card.iso) {
        renderCalendar();
      }
      const noDateCount = state.repository.getWithoutDate().length;
      if (noDateButton) noDateButton.hidden = noDateCount === 0;
      updateFilterStatus();
    }
  }).then(() => {
    state.loadingFinished = true;
    loading?.classList.add("is-hidden");
    initializeCalendarMonth();
    updateOverview();
    updateRowsVisibility();
    setText("#loadState", "Coleção sincronizada");
  }).catch((error) => {
    console.error("Looply: erro no carregamento das cartas.", error);
    state.loadingFinished = true;
    loading?.classList.add("is-hidden");
  });
}

function applySessionToUI() {
  setText("#welcomeMessage", `${state.session.username.toLowerCase() === "patati" ? "Bem-vindo" : "Bem-vinda"}, ${state.session.username}`);
  const initials = state.session.username.slice(0, 2).toUpperCase();
  const avatars = [document.getElementById("profilePic"), document.getElementById("profileTopAvatar")];
  avatars.forEach((avatar) => {
    if (!avatar) return;
    avatar.src = state.session.profilePic;
    avatar.alt = `Foto de perfil de ${state.session.username}`;
    avatar.addEventListener("error", () => {
      const link = avatar.closest(".profile-link");
      avatar.classList.add("avatar-missing");
      link?.classList.add("avatar-empty");
      const fallback = link?.querySelector(".profile-fallback");
      if (fallback) fallback.textContent = initials;
    }, { once: true });
  });
  document.getElementById("profileLink")?.setAttribute("aria-label", `Abrir perfil de ${state.session.username}`);
}

async function init() {
  const session = requireAuth();
  if (!session) return;
  state.session = session;
  state.reads = getReadCards(session.username);
  state.repository = new CardRepository({ username: session.username });
  applySessionToUI();
  bindHomeEvents();
  createRows();
  updateOverview();
  initializeCalendarMonth();
  updateRowsVisibility();
  await loadCards();
}

init();
