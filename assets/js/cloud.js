import { CLOUD_CONFIG } from "./cloud-config.js";

let clientPromise;
export function cloudConfigured() { return CLOUD_CONFIG.enabled(); }
export async function getCloudClient() {
  if (!cloudConfigured()) throw new Error("A nuvem ainda não foi configurada. Consulte CONFIGURAR-NUVEM-LOOOPLY.md.");
  if (!clientPromise) clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => createClient(CLOUD_CONFIG.supabaseUrl, CLOUD_CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }));
  return clientPromise;
}

export function usernameToEmail(username) {
  const normalized = String(username || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "");
  if (!normalized) throw new Error("Informe seu usuário.");
  return `${normalized}@loooply.app`;
}

export async function cloudSignIn(username, password) {
  const client = await getCloudClient();
  const { data, error } = await client.auth.signInWithPassword({ email: usernameToEmail(username), password: String(password || "") });
  if (error || !data.user) throw new Error(error?.message || "Usuário ou senha inválidos.");
  const profile = await ensureCloudProfile(data.user, username);
  return { username: profile.username, profilePic: profile.profile_pic || "", role: profile.role || "user", id: data.user.id, cloudAuthenticated: true };
}

export async function ensureCloudProfile(authUser, typedUsername = "") {
  const client = await getCloudClient();
  const fallback = String(typedUsername || authUser?.email?.split("@")[0] || "usuario").trim();
  const { data: existing, error: readError } = await client.from("profiles").select("id, username, display_name, profile_pic, role").eq("id", authUser.id).maybeSingle();
  if (readError) throw new Error(`Não foi possível carregar seu perfil: ${readError.message}`);
  if (existing) return existing;
  // Usuários comuns são criados com role=user. O cliente nunca pode atribuir a si mesmo admin.
  const row = { id: authUser.id, username: fallback.toLocaleLowerCase("pt-BR"), display_name: fallback, role: "user" };
  const { data, error } = await client.from("profiles").insert(row).select("id, username, display_name, profile_pic, role").single();
  if (error) throw new Error(`Não foi possível criar seu perfil: ${error.message}`);
  return data;
}

export async function cloudSignOut() {
  if (!cloudConfigured()) return;
  try { const client = await getCloudClient(); await client.auth.signOut(); } catch (error) { console.warn("Falha ao encerrar sessão da nuvem", error); }
}

export async function getCloudProfile() {
  const client = await getCloudClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await client.from("profiles").select("id, username, display_name, profile_pic, role").eq("id", user.id).single();
  if (error) throw new Error(`Não foi possível validar o perfil: ${error.message}`);
  return { ...data, email: user.email };
}

export async function cloudGetThread(threadKey) {
  const client = await getCloudClient();
  const { data, error } = await client.from("music_comments").select("id, thread_key, user_id, author_name, body, created_at, attachments").eq("thread_key", String(threadKey)).order("created_at", { ascending: true });
  if (error) throw new Error(`Não foi possível carregar os comentários da nuvem: ${error.message}`);
  return Promise.all((data || []).map(async row => {
    const attachments = await Promise.all((row.attachments || []).map(async file => {
      const { data: signed, error: signedError } = await client.storage.from("music-comment-photos").createSignedUrl(file.path, 3600);
      return { ...file, url: signedError ? "" : signed?.signedUrl || "" };
    }));
    return { id: row.id, text: row.body, author: row.author_name, authorId: row.user_id, createdAt: row.created_at, attachments };
  }));
}

export async function cloudAddComment(threadKey, text, files = []) {
  const client = await getCloudClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Entre na sua conta para publicar comentários na nuvem.");
  const profile = await getCloudProfile();
  const body = String(text || "").trim();
  if (!body && !files.length) throw new Error("Escreva um comentário ou anexe uma fotografia.");
  if (files.length > 6) throw new Error("Anexe no máximo 6 fotografias por comentário.");
  if (files.some(file => !String(file.type || "").startsWith("image/"))) throw new Error("Anexe somente fotografias.");
  if (files.some(file => file.size > 12 * 1024 * 1024)) throw new Error("Cada fotografia deve ter no máximo 12 MB.");
  const uploaded = [];
  try {
    for (const file of files) {
      const safeName = String(file.name || "foto").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage.from("music-comment-photos").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(`Falha ao enviar fotografia: ${error.message}`);
      uploaded.push({ path, name: file.name || "Fotografia", type: file.type, size: file.size });
    }
    const { data, error } = await client.from("music_comments").insert({ thread_key: String(threadKey), user_id: user.id, author_name: profile.display_name || profile.username, body, attachments: uploaded }).select("id").single();
    if (error) throw new Error(`Falha ao publicar comentário: ${error.message}`);
    return data;
  } catch (error) {
    if (uploaded.length) await client.storage.from("music-comment-photos").remove(uploaded.map(file => file.path));
    throw error;
  }
}

export async function cloudAdminOverview() {
  const client = await getCloudClient();
  const profile = await getCloudProfile();
  if (!profile || profile.role !== "admin") throw new Error("Acesso reservado ao administrador.");
  const [{ data: users, error: usersError }, { data: comments, error: commentsError }] = await Promise.all([
    client.from("profiles").select("id, username, display_name, profile_pic, role, created_at").order("created_at", { ascending: false }),
    client.from("music_comments").select("id, thread_key, user_id, author_name, body, created_at, attachments").order("created_at", { ascending: false }).limit(500)
  ]);
  if (usersError) throw new Error(`Falha ao consultar usuários: ${usersError.message}`);
  if (commentsError) throw new Error(`Falha ao consultar comentários: ${commentsError.message}`);
  const enriched = await Promise.all((comments || []).map(async row => {
    const attachments = await Promise.all((row.attachments || []).map(async file => {
      const { data } = await client.storage.from("music-comment-photos").createSignedUrl(file.path, 3600);
      return { ...file, url: data?.signedUrl || "" };
    }));
    return { ...row, attachments };
  }));
  return { profile, users: users || [], comments: enriched };
}
