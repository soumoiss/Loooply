import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const required = [
  "index.html", "login.html", "home.html", "galeria.html", "musicas.html", "perfil.html",
  "manifest.webmanifest", "assets/css/app.css", "assets/js/app-core.js", "assets/js/config.js",
  "assets/js/users.js", "assets/js/storage.js", "assets/js/session.js", "assets/js/navigation.js",
  "assets/js/date-parser.js", "assets/js/cards.js", "assets/js/home.js", "assets/js/gallery.js",
  "assets/js/music.js", "assets/js/profile.js", "data/midia-index.json", "data/musicas-index.json",
  "scripts/gerar-midia-index.py", ".github/workflows/atualizar-galeria.yml"
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Arquivo ausente: ${relative}`);
}

const jsonFiles = ["manifest.webmanifest", "data/midia-index.json", "data/musicas-index.json"];
for (const relative of jsonFiles) JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const htmlFiles = ["index.html", "login.html", "home.html", "galeria.html", "musicas.html", "perfil.html"];
for (const relative of htmlFiles) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  if (!/^<!doctype html>/i.test(text)) throw new Error(`${relative} sem doctype HTML5.`);
  if (!/lang="pt-BR"/i.test(text)) throw new Error(`${relative} sem idioma pt-BR.`);
}

const home = fs.readFileSync(path.join(root, "home.html"), "utf8");
if (!home.includes("assets/js/home.js")) throw new Error("Home não carrega o módulo principal.");
if (!home.includes("50 cartas para guardar")) throw new Error("Texto base das cartas não preservado.");

console.log("OK: validação estática concluída.");
