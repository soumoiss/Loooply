import { APP_CONFIG, CARD_STATUS } from "./config.js";
import { extractDate, formatShort, toISO } from "./date-parser.js";

const STOP_WORDS = new Set([
  "a","à","às","ao","aos","as","até","com","como","da","das","de","do","dos",
  "e","é","em","entre","era","essa","esse","esta","este","eu","foi","foram",
  "há","isso","isto","já","mais","mas","me","mesmo","minha","minhas","meu",
  "meus","na","nas","não","nem","no","nos","nossa","nossas","nosso","nossos",
  "num","numa","o","os","ou","para","pela","pelas","pelo","pelos","por",
  "qual","quando","que","quem","se","sem","ser","seu","seus","só","sob",
  "sobre","também","te","tem","têm","tendo","tenho","tua","tuas","tudo",
  "um","uma","umas","uns","vai","vamos","você","vocês","vos"
]);

const GENERIC_WORDS = new Set([
  "carta","cartas","texto","mensagem","mensagens","coisa","coisas",
  "momento","momentos","dia","dias","vez","vezes","aqui","agora",
  "hoje","ontem","amanhã","assim","então","sempre","nunca","muito",
  "muita","muitos","muitas","pouco","pouca","poucos","poucas"
]);

const GREETING_PATTERNS = [
  /^(oi|olá|ola|hey|ei|eii|oie|querid[oa]|car[oa]|meu querido|minha querida)[,!.\s]*/i,
  /^(bom dia|boa tarde|boa noite)[,!.\s]*/i
];

const CLOSING_PATTERNS = [
  /^(com carinho|com amor|com afeto|abraços?|beijos?|até mais|até logo)[,!.\s]*/i,
  /^(te amo|amo você|amo-te|um beijo|um abraço)[,!.\s]*/i
];

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseCardText(rawText) {
  const source = String(rawText || "").replace(/\r/g, "");
  const lines = source.split("\n");

  const firstLine = (lines[0] || "").trim();
  const protectedMatch = firstLine.match(
    /^Essa carta é protegida pela senha:\s*(.*)$/i
  );

  if (!protectedMatch) {
    return {
      isProtected: false,
      password: "",
      hint: "",
      text: source
    };
  }

  const password = protectedMatch[1].trim();
  const secondLine = (lines[1] || "").trim();
  const hintMatch = secondLine.match(/^Dica\s*:\s*(.*)$/i);

  return {
    isProtected: true,
    password,
    hint: hintMatch ? hintMatch[1].trim() : "",
    text: lines.slice(2).join("\n")
  };
}

function normalizeWord(word) {
  return String(word || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9À-ÿ'-]/gi, "");
}

function wordsOf(text) {
  return normalizeText(text)
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

function meaningfulWords(text) {
  return wordsOf(text).filter(
    (word) =>
      word.length >= 4 &&
      !STOP_WORDS.has(word) &&
      !GENERIC_WORDS.has(word)
  );
}

function splitIntoSentences(text) {
  return normalizeText(text)
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18);
}

function cleanCandidate(text) {
  let value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of GREETING_PATTERNS) {
    value = value.replace(pattern, "").trim();
  }

  for (const pattern of CLOSING_PATTERNS) {
    value = value.replace(pattern, "").trim();
  }

  value = value.replace(/^[\s,:;.!?'"“”‘’—–-]+/, "");
  value = value.replace(/[\s,:;.!?'"“”‘’—–-]+$/, "");

  return value;
}

function splitCandidateWords(text) {
  return cleanCandidate(text)
    .split(/\s+/)
    .map((word) => word.replace(/^[("'“‘]+|[)"'”’.,!?;:]+$/g, ""))
    .filter(Boolean);
}

function buildTitleFromSentence(sentence) {
  const clean = cleanCandidate(sentence);
  if (!clean) return "";

  const words = splitCandidateWords(clean);

  if (words.length <= 7) {
    return words.join(" ");
  }

  const meaningfulIndexes = words
    .map((word, index) => ({
      index,
      word,
      normalized: normalizeWord(word)
    }))
    .filter(
      ({ normalized }) =>
        normalized.length >= 4 &&
        !STOP_WORDS.has(normalized) &&
        !GENERIC_WORDS.has(normalized)
    )
    .map(({ index }) => index);

  if (meaningfulIndexes.length >= 2) {
    const first = meaningfulIndexes[0];
    const last = meaningfulIndexes[Math.min(meaningfulIndexes.length - 1, 4)];

    const slice = words.slice(
      Math.max(0, first - 1),
      Math.min(words.length, last + 2)
    );

    if (slice.length >= 2 && slice.length <= 8) {
      return slice.join(" ");
    }
  }

  return words.slice(0, 7).join(" ");
}

function calculateWordImportance(text) {
  const words = meaningfulWords(text);
  const frequencies = new Map();

  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  return frequencies;
}

function scoreSentence(sentence, fullText, frequencies, index, total) {
  const words = meaningfulWords(sentence);

  if (!words.length) return -Infinity;

  const uniqueWords = new Set(words);
  let score = 0;

  for (const word of uniqueWords) {
    const frequency = frequencies.get(word) || 0;

    if (frequency >= 2) score += 3;
    if (frequency >= 3) score += 2;
    if (frequency >= 5) score += 2;
  }

  const lower = sentence.toLocaleLowerCase("pt-BR");

  const thematicWords = [
    "amor","amizade","saudade","carinho","medo","esperanca","esperança",
    "sonho","sonhos","vida","viver","mudanca","mudança","mudancas",
    "mudanças","tempo","futuro","passado","presente","lembranca",
    "lembrança","lembrancas","lembranças","sentimento","sentimentos",
    "coracao","coração","coragem","verdade","identidade","silencio",
    "silêncio","amizade","perdao","perdão","perder","encontro",
    "distancia","distância","familia","família","amizades","felicidade",
    "tristeza","saudade","Deus".toLocaleLowerCase("pt-BR")
  ];

  for (const word of thematicWords) {
    if (lower.includes(word)) {
      score += 3;
    }
  }

  if (/[!?]/.test(sentence)) score += 1;
  if (sentence.length >= 45 && sentence.length <= 180) score += 3;

  const positionRatio = total > 1 ? index / (total - 1) : 0;

  if (positionRatio < 0.15) score += 1;
  if (positionRatio > 0.25 && positionRatio < 0.85) score += 3;
  if (positionRatio > 0.85) score -= 1;

  const greetingPenalty = GREETING_PATTERNS.some((pattern) =>
    pattern.test(sentence)
  )
    ? 8
    : 0;

  const closingPenalty = CLOSING_PATTERNS.some((pattern) =>
    pattern.test(sentence)
  )
    ? 8
    : 0;

  score -= greetingPenalty + closingPenalty;

  return score;
}

function findBestSentence(text) {
  const sentences = splitIntoSentences(text);

  if (!sentences.length) return "";

  const frequencies = calculateWordImportance(text);

  let bestSentence = "";
  let bestScore = -Infinity;

  sentences.forEach((sentence, index) => {
    const score = scoreSentence(
      sentence,
      text,
      frequencies,
      index,
      sentences.length
    );

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  });

  return bestSentence;
}

function findStrongHeading(text) {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 12)) {
    const clean = cleanCandidate(line);
    const words = splitCandidateWords(clean);

    if (
      words.length >= 2 &&
      words.length <= 8 &&
      !/[.!?]$/.test(clean) &&
      meaningfulWords(clean).length >= 2
    ) {
      return clean;
    }
  }

  return "";
}

function makeReadableTitle(candidate) {
  let title = cleanCandidate(candidate);

  if (!title) return "";

  const words = splitCandidateWords(title);

  if (words.length <= 8) {
    return words.join(" ");
  }

  const meaningful = words.filter((word) => {
    const normalized = normalizeWord(word);
    return (
      normalized.length >= 4 &&
      !STOP_WORDS.has(normalized) &&
      !GENERIC_WORDS.has(normalized)
    );
  });

  if (meaningful.length >= 3) {
    const selected = meaningful.slice(0, 5);
    return selected.join(" ");
  }

  return words.slice(0, 7).join(" ");
}

export function generateTitleFromText(text) {
  const clean = normalizeText(text);

  if (!clean) {
    return "Carta sem conteúdo";
  }

  /*
   * O título agora é escolhido considerando a carta inteira.
   *
   * A prioridade é:
   * 1. Um possível título escrito na própria carta.
   * 2. A frase mais representativa depois da análise de todo o texto.
   * 3. Um trecho relevante da carta como fallback.
   */

  const explicitHeading = findStrongHeading(clean);

  if (explicitHeading) {
    const title = makeReadableTitle(explicitHeading);

    if (title) {
      return title;
    }
  }

  const bestSentence = findBestSentence(clean);

  if (bestSentence) {
    const title = buildTitleFromSentence(bestSentence);

    if (title) {
      return title;
    }
  }

  const meaningful = meaningfulWords(clean);

  if (meaningful.length >= 3) {
    return meaningful.slice(0, 6).join(" ");
  }

  const fallback = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");

  return fallback || "Carta sem título";
}

export class CardRepository {
  constructor({ username, total = APP_CONFIG.totalCards } = {}) {
    this.username = String(username || "").trim();
    this.total = total;
    this.cards = new Map();
    this.abortController = new AbortController();
    this.pending = new Map();
    this.stats = {
      startedAt: null,
      loaded: 0,
      errors: 0,
      unavailable: 0
    };
  }

  getFileName(number) {
    const n = Number(number);
    if (n < 0) return `${this.username}cartaprivada${Math.abs(n)}.txt`;
    return APP_CONFIG.cardPath(this.username, n);
  }

  seedPrivate(privateNumber) {
    const n = Number(privateNumber);
    const key = -n;
    if (!this.cards.has(key)) {
      this.cards.set(key, {
        number: key, privateNumber: n, isPrivateFile: true,
        fileName: this.getFileName(key), title: "Carta privada",
        text: "", protectedText: "", password: "", hint: "",
        isProtected: true, unlocked: false, date: null, iso: null,
        status: CARD_STATUS.loading, error: null
      });
    }
    return this.cards.get(key);
  }

  get(number) {
    return this.cards.get(Number(number)) || null;
  }

  getAll() {
    return [...this.cards.values()].sort((a, b) => {
      const aPrivate = Boolean(a.isPrivateFile);
      const bPrivate = Boolean(b.isPrivateFile);

      // Cartas privadas vão para o TOPO (início da lista)
      if (aPrivate && !bPrivate) return -1;
      if (!aPrivate && bPrivate) return 1;

      // Se ambas forem privadas, ordena pela numeração privada (1, 2, 3...)
      if (aPrivate && bPrivate) {
        return a.privateNumber - b.privateNumber;
      }

      // Se ambas forem normais, ordena pelo número normal (1, 2, 3...)
      return a.number - b.number;
    });
  }

  getAvailable() {
    return this.getAll().filter(
      (card) => card.status === CARD_STATUS.ready
    );
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
        title: "Analisando carta...",
        text: "",
        protectedText: "",
        password: "",
        hint: "",
        isProtected: false,
        unlocked: false,
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

    if (this.pending.has(n)) {
      return this.pending.get(n);
    }

    const task = (async () => {
      const card = n < 0 ? this.seedPrivate(Math.abs(n)) : this.seed(n);

      card.status = CARD_STATUS.loading;
      card.error = null;

      try {
        const requestOptions = {
          cache: "no-cache",
          signal: this.abortController.signal,
          headers: { Accept: "text/plain" }
        };

        let response = await fetch(card.fileName, requestOptions);

        // Alguns arquivos privados usam dois dígitos (carta01.txt),
        // enquanto outros usam um (carta1.txt). Tente ambos sem misturar
        // a numeração privada com a numeração das cartas normais.
        if (!response.ok && response.status === 404 && card.isPrivateFile) {
          const paddedFileName = `${this.username}cartaprivada${String(card.privateNumber).padStart(2, "0")}.txt`;
          if (paddedFileName !== card.fileName) {
            const paddedResponse = await fetch(paddedFileName, requestOptions);
            if (paddedResponse.ok) {
              card.fileName = paddedFileName;
              response = paddedResponse;
            }
          }
        }

        if (!response.ok) {
          card.status =
            response.status === 404
              ? CARD_STATUS.unavailable
              : CARD_STATUS.error;

          card.title =
            response.status === 404
              ? "Carta indisponível"
              : "Não foi possível carregar esta carta";

          card.text = "";
          card.error = `HTTP ${response.status}`;

          if (response.status === 404) {
            if (!card.isPrivateFile) this.stats.unavailable += 1;
          } else {
            this.stats.errors += 1;
          }

          return card;
        }

        /*
         * A carta inteira é carregada antes da geração do título.
         * Nada é cortado antes da análise.
         */
        const rawText = await response.text();
        const parsed = parseCardText(rawText);

        const date = extractDate(parsed.text);

        card.isProtected = parsed.isProtected || Boolean(card.isPrivateFile);
        card.password = parsed.password;
        card.hint = parsed.hint;
        card.unlocked = false;
        card.protectedText = card.isProtected ? parsed.text : "";

        /*
         * Cartas protegidas nunca recebem o corpo no campo público `text`
         * enquanto permanecerem trancadas. Isso impede que o leitor/modais
         * existentes exibam o conteúdo antes da autenticação local.
         */
        card.text = card.isProtected ? "" : parsed.text;

        /*
         * O corpo de uma carta protegida não é usado para gerar título.
         * Assim, nenhum trecho do texto privado vaza para a lista.
         */
        card.title = card.isPrivateFile
          ? "Carta privada protegida"
          : parsed.isProtected ? "Carta protegida" : generateTitleFromText(parsed.text);

        card.date = date;
        card.iso = date ? toISO(date) : null;
        card.status = CARD_STATUS.ready;

        this.stats.loaded += 1;

        return card;
      } catch (error) {
        if (error?.name === "AbortError") {
          return card;
        }

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

    const normalQueue = Array.from({ length: this.total }, (_, index) => index + 1);
    // IDs negativos mantêm as privadas independentes da numeração normal.
    const privateQueue = Array.from({ length: this.total }, (_, index) => -(index + 1));
    const queue = [...privateQueue, ...normalQueue];

    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const number = queue[cursor++];
        const card = number < 0 ? this.seedPrivate(Math.abs(number)) : this.seed(number);
        const loaded = await this.loadOne(number);
        // Arquivos privados ausentes são esperados: não os mostre como cartas inexistentes.
        if (loaded.isPrivateFile && loaded.status === CARD_STATUS.unavailable) {
          this.cards.delete(number);
          // A interface precisa ser avisada para remover a linha provisória;
          // caso contrário, ela fica exibindo "Carregando..." para sempre.
          onEach?.(loaded);
          continue;
        }
        onEach?.(loaded);
      }
    };

    const workerCount = Math.min(
      Math.max(Number(concurrency) || 1, 1),
      queue.length || 1
    );

    await Promise.all(
      Array.from(
        { length: workerCount },
        worker
      )
    );

    return this.getAll();
  }

  abort() {
    this.abortController.abort();
  }
}

export function unlockCard(card, password) {
  if (!card?.isProtected) {
    return { ok: true, text: card?.text || "" };
  }

  const supplied = String(password ?? "").trim();

  if (!String(card.password || "").trim() || supplied !== String(card.password || "").trim()) {
    return { ok: false, text: "" };
  }

  card.unlocked = true;
  card.text = card.protectedText || "";

  return { ok: true, text: card.text };
}

export function buildCardRow({ card, read }) {
  const row = document.createElement("article");

  row.className = "card-row";
  row.dataset.number = String(card.number);
  row.dataset.private = card.isPrivateFile ? "true" : "false";
  row.dataset.status = card.status;
  row.tabIndex = 0;
  row.setAttribute("role", "button");

  row.innerHTML = `
    <div class="card-number" aria-hidden="true">
      ${String(card.isPrivateFile ? card.privateNumber : card.number).padStart(2, "0")}
    </div>

    <div class="card-info">
      <span class="card-label">
        ${card.isPrivateFile ? "Carta privada" : "Carta"} ${String(card.isPrivateFile ? card.privateNumber : card.number).padStart(2, "0")}${card.isProtected ? " 🔒" : ""}
      </span>

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
  row.classList.toggle("is-protected", Boolean(card.isProtected));
  row.setAttribute(
    "aria-label",
    card.isProtected
      ? `${card.isPrivateFile ? "Carta privada" : "Carta"} ${String(card.isPrivateFile ? card.privateNumber : card.number).padStart(2, "0")}, protegida por senha`
      : `${card.isPrivateFile ? "Carta privada" : "Carta"} ${String(card.isPrivateFile ? card.privateNumber : card.number).padStart(2, "0")}`
  );

  row.classList.toggle(
    "is-unavailable",
    card.status === CARD_STATUS.unavailable ||
      card.status === CARD_STATUS.error
  );

  const title = row.querySelector(".card-title");
  const date = row.querySelector(".card-date");
  const check = row.querySelector(".card-check");

  if (title) {
    title.textContent = card.isProtected && !card.unlocked
      ? "Carta protegida por senha"
      : card.title || "Sem título";
  }

  if (date) {
    date.textContent = card.date
      ? formatShort(card.date)
      : card.status === CARD_STATUS.loading
        ? "Analisando conteúdo…"
        : "Sem data";

    date.classList.toggle(
      "is-empty",
      !card.date
    );
  }

  if (check) {
    check.textContent = read ? "✓" : "○";

    check.classList.toggle(
      "is-read",
      Boolean(read)
    );

    check.setAttribute(
      "aria-label",
      read ? "Carta lida" : "Carta não lida"
    );
  }
}
