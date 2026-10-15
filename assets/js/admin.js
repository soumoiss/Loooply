import { cloudConfigured, cloudAdminOverview } from "./cloud.js";
import { getSession, logout } from "./session.js";

const status = document.getElementById("adminStatus");
const content = document.getElementById("adminContent");
const search = document.getElementById("adminSearch");
let data = { users: [], comments: [], profile: null };
let activeTab = "comments";

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function niceDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Data desconhecida" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function render() {
  content.replaceChildren();
  const q = search.value.trim().toLocaleLowerCase("pt-BR");
  if (activeTab === "users") {
    const rows = data.users.filter(user => [user.username,user.display_name,user.role].join(" ").toLocaleLowerCase("pt-BR").includes(q));
    if (!rows.length) content.append(el("p", "admin-empty", "Nenhum usuário encontrado."));
    for (const user of rows) {
      const card = el("article", "admin-user"); const details = el("div");
      details.append(el("strong", "", user.display_name || user.username), el("br"), el("small", "", `@${user.username} · ${user.role === "admin" ? "Administrador" : "Usuário"}`));
      card.append(details, el("small", "", user.created_at ? `Criado em ${niceDate(user.created_at)}` : "Conta registrada")); content.append(card);
    }
    return;
  }
  const rows = data.comments.filter(comment => [comment.author_name,comment.thread_key,comment.body].join(" ").toLocaleLowerCase("pt-BR").includes(q));
  if (!rows.length) content.append(el("p", "admin-empty", "Nenhum comentário encontrado."));
  for (const comment of rows) {
    const card = el("article", "admin-comment");
    card.append(el("strong", "", comment.author_name || "Usuário"), el("br"), el("small", "", `${comment.thread_key} · ${niceDate(comment.created_at)}`));
    if (comment.body) card.append(el("p", "", comment.body));
    const photos = el("div", "admin-comment-photos");
    for (const file of comment.attachments || []) if (file.url) { const img = el("img"); img.src = file.url; img.alt = file.name || "Fotografia anexada"; img.loading = "lazy"; photos.append(img); }
    if (photos.childElementCount) card.append(photos);
    content.append(card);
  }
}
async function load() {
  status.textContent = "Carregando dados protegidos da nuvem…";
  content.replaceChildren();
  try {
    if (!cloudConfigured()) throw new Error("A nuvem ainda não está configurada. Siga CONFIGURAR-NUVEM-LOOOPLY.md.");
    const session = getSession();
    if (!session) { window.location.replace("login.html"); return; }
    if (session.cloudAuthenticated !== true) throw new Error("Esta conta ainda usa autenticação local e não possui acesso ao painel administrativo.");
    data = await cloudAdminOverview();
    document.getElementById("adminGreeting").textContent = `Olá, ${data.profile.display_name || "Peixinho"}. Você está no modo administrador.`;
    status.textContent = `${data.users.length} usuário(s) · ${data.comments.length} comentário(s) carregados. Conteúdo protegido por permissões do banco de dados.`;
    render();
  } catch (error) {
    status.textContent = error.message || "Não foi possível carregar o painel.";
    content.append(el("p", "admin-empty", "Acesso negado ou serviço de nuvem indisponível."));
  }
}
document.querySelectorAll(".admin-tab").forEach(button => button.addEventListener("click", () => {
  activeTab = button.dataset.tab;
  document.querySelectorAll(".admin-tab").forEach(tab => tab.setAttribute("aria-selected", String(tab === button)));
  render();
}));
search.addEventListener("input", render);
document.getElementById("adminRefresh").addEventListener("click", load);
document.getElementById("adminLogout").addEventListener("click", logout);
load();
