import { cloudConfigured, cloudGetThread, cloudAddComment } from "./cloud.js";

// IndexedDB é fallback local; com Supabase ativo, a nuvem é a fonte principal.
const DB_NAME = "looply-comments";
const DB_VERSION = 1;
const STORE_NAME = "threads";
let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("Este navegador não disponibiliza armazenamento local para comentários."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento de comentários."));
  });
  return databasePromise;
}

export async function getThread(key) {
  key = String(key || "").trim();
  if (!key) throw new Error("A faixa não possui uma chave de comentários válida.");
  if (cloudConfigured()) return cloudGetThread(key);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(Array.isArray(request.result?.comments) ? request.result.comments : []);
    request.onerror = () => reject(request.error || new Error("Não foi possível ler os comentários."));
  });
}

export async function saveThread(key, comments) {
  if (cloudConfigured()) throw new Error("Com a nuvem ativa, publique comentários usando addComment.");
  key = String(key || "").trim();
  if (!key) throw new Error("A faixa não possui uma chave de comentários válida.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ key, comments, updatedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Não foi possível salvar os comentários."));
    tx.onabort = () => reject(tx.error || new Error("O salvamento dos comentários foi cancelado."));
  });
}

export async function addComment(key, text, files = [], author = "") {
  key = String(key || "").trim();
  if (!key) throw new Error("A faixa não possui uma chave de comentários válida.");
  if (cloudConfigured()) return cloudAddComment(key, text, files);
  const normalizedText = String(text || "").trim();
  if (!normalizedText && !files.length) throw new Error("Escreva um comentário ou anexe uma fotografia.");
  if (files.length > 6) throw new Error("Anexe no máximo 6 fotografias por comentário.");
  if (files.some(file => !String(file.type || "").startsWith("image/"))) throw new Error("Anexe somente fotografias.");
  const current = await getThread(key);
  const attachments = files.map(file => ({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name || "fotografia", type: file.type || "application/octet-stream",
    size: Number(file.size || 0), blob: file
  }));
  const comment = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: normalizedText, author: String(author || ""), createdAt: new Date().toISOString(), attachments
  };
  current.push(comment);
  await saveThread(key, current);
  return comment;
}

export function attachmentURL(attachment) {
  if (attachment?.url) return attachment.url;
  if (!attachment?.blob) return "";
  return URL.createObjectURL(attachment.blob);
}

export function formatCommentDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
