import { APP_CONFIG, CARD_STATUS } from "./config.js";
import { extractDate, formatShort, toISO } from "./date-parser.js";

export function generateTitleFromText(text) {
  const clean = String(text || "").replace(/^\s+/, "").replace(/\r/g, "");
  if (!clean) return "Carta sem conteúdo";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 6) return words.slice(0, 9).join(" ");
  let title = words.slice(6, 14).join(" ").replace(/\s+/g, " ").trim();
  if (!title) title = words.slice(0, 8).join(" ");
  if (words.length > 14 && !/[.!?…]$/.test(title)) title += "…";
  return title;
}

export class CardRepository {
  constructor({ username, total = APP_CONFIG.totalCards } = {}) {
    this.username = String(username || "").trim();
    this.total = total;
    this.cards = new Map();
    this.abortController = new AbortController();
    this.pending = new Map();
    this.stats = { startedAt: null, loaded: 0, errors: 0, unavailable: 0 };
  }

  getFileName(number) {
    return APP_CONFIG.cardPath(this.username, number);
  }

  get(number) {
    return this.cards.get(Number(number)) || null;
  }

  getAll() {
    return [...this.cards.values()].sort((a, b) => a.number - b.number);
  }

  getAvailable() {
    return this.getAll().filter((card) => card.status === CARD_STATUS.ready);
  }

  getWithDate() {
    return this.getAvailable().filter((card) => card.date);
  }

  getWithoutDate() {
    return this.getAvailable().filter((card) => !card.date);
  }

  seed(number) {
    const n = Number(number);
    if (!this.cards.has(n)) {
      this.cards.set(n, {
        number: n,
        fileName: this.getFileName(n),
        title: "Carregando título...",
        text: "",
        date: null,
        iso: null,
        status: CARD_STATUS.loading,
        error: null
      });
    }
    return this.cards.get(n);
  }

  async loadOne(number) {
    const n = Number(number);
    if (this.pending.has(n)) return this.pending.get(n);

    const task = (async () => {
      const card = this.seed(n);
      card.status = CARD_STATUS.loading;
      card.error = null;

      try {
        const response = await fetch(card.fileName, {
          cache: "no-cache",
          signal: this.abortController.signal,
          headers: { Accept: "text/plain" }
        });

        if (!response.ok) {
          card.status = response.status === 404 ? CARD_STATUS.unavailable : CARD_STATUS.error;
          card.title = response.status === 404 ? "Carta indisponível" : "Não foi possível carregar esta carta";
          card.text = "";
          card.error = `HTTP ${response.status}`;
          if (response.status === 404) this.stats.unavailable += 1;
          else this.stats.errors += 1;
          return card;
        }

        const text = await response.text();
        const date = extractDate(text);
        card.text = text;
        card.title = generateTitleFromText(text);
        card.date = date;
        card.iso = date ? toISO(date) : null;
        card.status = CARD_STATUS.ready;
        this.stats.loaded += 1;
        return card;
      } catch (error) {
        if (error?.name === "AbortError") return card;
        card.status = CARD_STATUS.error;
        card.title = "Erro ao carregar carta";
        card.error = error?.message || "Erro desconhecido";
        this.stats.errors += 1;
        return card;
      }
    })();

    this.pending.set(n, task);
    try {
      return await task;
    } finally {
      this.pending.delete(n);
    }
  }

  async loadAll({ concurrency = 6, onEach } = {}) {
    this.stats.startedAt = performance.now();
    const queue = Array.from({ length: this.total }, (_, index) => index + 1);
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const number = queue[cursor++];
        const card = await this.loadOne(number);
        onEach?.(card);
      }
    };

    const workerCount = Math.min(Math.max(Number(concurrency) || 1, 1), queue.length || 1);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return this.getAll();
  }

  abort() {
    this.abortController.abort();
  }
}

export function buildCardRow({ card, read }) {
  const row = document.createElement("article");
  row.className = "card-row";
  row.dataset.number = String(card.number);
  row.dataset.status = card.status;
  row.tabIndex = 0;
  row.setAttribute("role", "button");

  row.innerHTML = `
    <div class="card-number" aria-hidden="true">${String(card.number).padStart(2, "0")}</div>
    <div class="card-info">
      <span class="card-label">Carta ${String(card.number).padStart(2, "0")}</span>
      <h3 class="card-title"></h3>
      <p class="card-date"></p>
    </div>
    <span class="card-check" aria-label=""></span>
  `;

  updateCardRow(row, card, read);
  return row;
}

export function updateCardRow(row, card, read) {
  if (!row || !card) return;
  row.dataset.status = card.status;
  row.classList.toggle("is-unavailable", card.status === CARD_STATUS.unavailable || card.status === CARD_STATUS.error);

  const title = row.querySelector(".card-title");
  const date = row.querySelector(".card-date");
  const check = row.querySelector(".card-check");

  if (title) title.textContent = card.title || "Sem título";
  if (date) {
    date.textContent = card.date ? formatShort(card.date) : (card.status === CARD_STATUS.loading ? "Procurando data…" : "Sem data");
    date.classList.toggle("is-empty", !card.date);
  }
  if (check) {
    check.textContent = read ? "✓" : "○";
    check.classList.toggle("is-read", Boolean(read));
    check.setAttribute("aria-label", read ? "Carta lida" : "Carta não lida");
  }
}
