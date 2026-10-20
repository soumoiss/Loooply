import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "index.html", "login.html", "home.html", "galeria.html", "musicas.html", "perfil.html",
  "manifest.webmanifest", "assets/css/app.css", "assets/js/app-core.js", "assets/js/config.js",
  "assets/js/users.js", "assets/js/storage.js", "assets/js/session.js", "assets/js/navigation.js",
  "assets/js/date-parser.js", "assets/js/cards.js", "assets/js/home.js", "assets/js/gallery.js",
  "assets/js/music.js", "assets/js/profile.js", "assets/js/comments-store.js", "assets/js/cloud.js", "assets/js/cloud-config.js", "assets/js/admin.js", "admin.html", "supabase/schema.sql", "CONFIGURAR-NUVEM-LOOOPLY.md", "data/midia-index.json", "data/musicas-index.json",
  "scripts/gerar-midia-index.py", "scripts/restaurar-midias-github.py", "tests/test-cloud-config.mjs",
  "scripts/migrations/20261015021004_enable_music_comments_realtime.sql", "scripts/migrations/20261015021133_consolidate_profiles_rls_policies.sql", ".github/workflows/atualizar-galeria.yml"
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Arquivo ausente: ${relative}`);
}

const jsonFiles = ["manifest.webmanifest", "data/midia-index.json", "data/musicas-index.json"];
for (const relative of jsonFiles) JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

function checkModuleSyntax(source, label) {
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: source,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Sintaxe JavaScript inválida em ${label}:\n${result.stderr || result.stdout}`);
  }
}
const jsDirectory = path.join(root, "assets/js");
for (const name of fs.readdirSync(jsDirectory).filter(name => name.endsWith(".js"))) {
  checkModuleSyntax(fs.readFileSync(path.join(jsDirectory, name), "utf8"), `assets/js/${name}`);
}
for (const relative of ["index.html", "login.html", "home.html", "galeria.html", "musicas.html", "perfil.html", "admin.html"]) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  const modules = html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi);
  let index = 0;
  for (const match of modules) {
    if (match[1].trim()) checkModuleSyntax(match[1], `${relative} (script module ${++index})`);
  }
}

const galleryModule = fs.readFileSync(path.join(root, "assets/js/gallery.js"), "utf8");
const musicModule = fs.readFileSync(path.join(root, "assets/js/music.js"), "utf8");
const commentStore = fs.readFileSync(path.join(root, "assets/js/comments-store.js"), "utf8");
if (!galleryModule.includes("lightboxCommentButton") || !galleryModule.includes("media-comment-window")) throw new Error("A galeria não oferece a janela de comentário no visualizador.");
if (!musicModule.includes("youtube-nocookie.com/embed/") || musicModule.includes("window.open(")) throw new Error("O player musical não está integrado ao aplicativo.");
if (!musicModule.includes("musicCommentForm") || !musicModule.includes("addComment(") || !commentStore.includes("indexedDB.open")) throw new Error("Persistência de comentários/anexos não está integrada.");
const cloudConfigSource = fs.readFileSync(path.join(root, "assets/js/cloud-config.js"), "utf8");
const cloudConfigUrl = `data:text/javascript;base64,${Buffer.from(cloudConfigSource, "utf8").toString("base64")}`;
const { CLOUD_CONFIG, isCloudConfigValid } = await import(cloudConfigUrl);
if (CLOUD_CONFIG.enabled() !== isCloudConfigValid(CLOUD_CONFIG.supabaseUrl, CLOUD_CONFIG.supabaseAnonKey)) {
  throw new Error("A validação da configuração da nuvem diverge da validação dos valores configurados.");
}
const testPublishableKey = "sb_publishable_test_key_with_sufficient_length_12345";
if (!isCloudConfigValid("https://example.supabase.co", testPublishableKey)) throw new Error("Configuração Supabase válida foi rejeitada.");
if (isCloudConfigValid("https://example.supabase.co", "COLE_AQUI_A_CHAVE_ANON_PUBLICA")) throw new Error("Chave de exemplo foi aceita como configuração real.");
if (isCloudConfigValid("COLE_AQUI_A_URL_DO_SUPABASE", testPublishableKey)) throw new Error("URL de exemplo foi aceita como configuração real.");

const cloudModule = fs.readFileSync(path.join(root, "assets/js/cloud.js"), "utf8");
const adminModule = fs.readFileSync(path.join(root, "assets/js/admin.js"), "utf8");
const cloudSql = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
if (!cloudModule.includes("signInWithPassword") || !cloudModule.includes("cloudAddComment") || !cloudModule.includes("createSignedUrl")) throw new Error("Integração de autenticação, comentários e anexos na nuvem incompleta.");
if (!adminModule.includes("cloudAdminOverview") || !cloudSql.includes("enable row level security") || !cloudSql.includes("is_loooply_admin")) throw new Error("Painel administrativo ou políticas de segurança incompletas.");
if (!cloudModule.includes("cloudSubscribeToThread") || !cloudModule.includes("postgres_changes") || !musicModule.includes("subscribeThread(")) throw new Error("Sincronização Realtime de comentários não está integrada.");

const galleryIndex = JSON.parse(fs.readFileSync(path.join(root, "data/midia-index.json"), "utf8"));
if (galleryIndex.schemaVersion !== 3) throw new Error("Índice da galeria precisa usar schemaVersion 3.");
for (const key of ["fotos", "audios", "videos"]) {
  if (!Array.isArray(galleryIndex[key])) throw new Error(`Índice da galeria sem coleção válida: ${key}.`);
}
if (!galleryIndex.exclusivo || typeof galleryIndex.exclusivo !== "object") throw new Error("Índice da galeria sem bloco exclusivo.");
for (const username of ["Patati", "Misol", "Lilika", "YARA"]) {
  if (!Array.isArray(galleryIndex.exclusivo[username])) throw new Error(`Índice sem coleção exclusiva de ${username}.`);
}
const galleryItems = [
  ...galleryIndex.fotos,
  ...galleryIndex.audios,
  ...galleryIndex.videos,
  ...Object.values(galleryIndex.exclusivo).flat()
];
const galleryPaths = new Set();
const sourceOnly = process.argv.includes("--source-only");
const missingMedia = [];
for (const item of galleryItems) {
  if (!item.path || galleryPaths.has(item.path)) throw new Error(`Caminho de mídia ausente ou duplicado: ${item.path || "<vazio>"}.`);
  galleryPaths.add(item.path);
  if (!fs.existsSync(path.join(root, item.path))) {
    missingMedia.push(item.path);
    if (!sourceOnly) throw new Error(`Mídia indexada não encontrada: ${item.path}.`);
  }
}

const htmlFiles = ["index.html", "login.html", "home.html", "galeria.html", "musicas.html", "perfil.html", "admin.html"];
for (const relative of htmlFiles) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  if (!/^<!doctype html>/i.test(text)) throw new Error(`${relative} sem doctype HTML5.`);
  if (!/lang="pt-BR"/i.test(text)) throw new Error(`${relative} sem idioma pt-BR.`);
}

const home = fs.readFileSync(path.join(root, "home.html"), "utf8");
if (!home.includes("assets/js/home.js")) throw new Error("Home não carrega o módulo principal.");
if (!home.includes("50 cartas para guardar")) throw new Error("Texto base das cartas não preservado.");

console.log("OK: validação estática concluída.");
if (missingMedia.length) {
  console.warn(`AVISO: ${missingMedia.length} mídias indexadas não estão fisicamente presentes neste pacote${sourceOnly ? " (modo source-only)" : ""}.`);
  if (sourceOnly) console.warn("Os registros foram preservados; os arquivos binários precisam vir do repositório completo.");
}
