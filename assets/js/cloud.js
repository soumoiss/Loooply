import { CLOUD_CONFIG } from "./cloud-config.js";

let clientPromise;
export function cloudConfigured() { return CLOUD_CONFIG.enabled(); }

export async function getCloudClient() {
  if (!cloudConfigured()) throw new Error("A nuvem ainda não foi configurada.");
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(CLOUD_CONFIG.supabaseUrl, CLOUD_CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }))
      .catch(() => {
        clientPromise = null;
        throw new Error("Não foi possível conectar ao Supabase. Verifique a rede e a configuração pública.");
      });
  }
  return clientPromise;
}

export function usernameToEmail(username) {
  const raw = String(username || "").trim().toLocaleLowerCase("pt-BR");
  if (!raw) throw new Error("Informe seu usuário.");
  if (raw.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error("Informe um e-mail válido.");
    return raw;
  }
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "");
  if (!normalized) throw new Error("Informe seu usuário.");
  return `${normalized}@loooply.app`;
}

export async function cloudSignIn(username, password) {
  const client = await getCloudClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: usernameToEmail(username), password: String(password || "")
  });
  if (error || !data.user) {
    console.warn("Falha de autenticação Supabase:", error?.status || "sem status", error?.code || "sem código");
    throw new Error("Não foi possível entrar. Confira seu usuário e sua senha.");
  }
  const profile = await ensureCloudProfile(data.user, username);
  return {
    username: profile.username, displayName: profile.display_name || profile.username,
    profilePic: profile.profile_pic || "", role: profile.role || "user",
    id: data.user.id, cloudAuthenticated: true
  };
}

export async function ensureCloudProfile(authUser, typedUsername = "") {
  const client = await getCloudClient();
  const fallback = String(typedUsername || authUser?.email?.split("@")[0] || "usuario").trim();
  const username = fallback.toLocaleLowerCase("pt-BR").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "") || "usuario";
  const { data: existing, error: readError } = await client.from("profiles")
    .select("id, username, display_name, profile_pic, role").eq("id", authUser.id).maybeSingle();
  if (readError) throw new Error(`Não foi possível carregar seu perfil: ${readError.message}`);
  if (existing) return existing;
  const row = { id: authUser.id, username, display_name: fallback, role: "user" };
  const { data, error } = await client.from("profiles")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true })
    .select("id, username, display_name, profile_pic, role").single();
  if (!error && data) return data;
  const { data: raced, error: racedError } = await client.from("profiles")
    .select("id, username, display_name, profile_pic, role").eq("id", authUser.id).maybeSingle();
  if (!racedError && raced) return raced;
  throw new Error(`Não foi possível criar seu perfil: ${error?.message || racedError?.message || "erro desconhecido"}`);
}

export async function cloudSignOut() {
  if (!cloudConfigured()) return;
  const client = await getCloudClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(`Não foi possível encerrar a sessão: ${error.message}`);
}

export async function getCloudProfile() {
  const client = await getCloudClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await client.from("profiles")
    .select("id, username, display_name, profile_pic, role, created_at").eq("id", user.id).single();
  if (error) throw new Error(`Não foi possível validar o perfil: ${error.message}`);
  return { ...data, email: user.email };
}

async function withSignedAttachments(client, rows) {
  return Promise.all((rows || []).map(async row => {
    const attachments = await Promise.all((Array.isArray(row.attachments) ? row.attachments : []).map(async file => {
      if (!file?.path) return { ...file, url: "" };
      const { data, error } = await client.storage.from("music-comment-photos").createSignedUrl(file.path, 3600);
      return { ...file, url: error ? "" : (data?.signedUrl || "") };
    }));
    return {
      id: row.id, thread_key: row.thread_key, text: row.body, author: row.author_name,
      authorId: row.user_id, createdAt: row.created_at, attachments
    };
  }));
}

export async function cloudGetThread(threadKey) {
  const key = String(threadKey || "").trim();
  if (!key) throw new Error("A faixa não possui uma chave de comentários válida.");
  const client = await getCloudClient();
  const { data, error } = await client.from("music_comments")
    .select("id, thread_key, user_id, author_name, body, created_at, attachments")
    .eq("thread_key", key).order("created_at", { ascending: true });
  if (error) throw new Error(`Não foi possível carregar os comentários da nuvem: ${error.message}`);
  return withSignedAttachments(client, data);
}

export async function cloudSubscribeToThread(threadKey, onChange, onStatus = () => {}) {
  const key = String(threadKey || "").trim();
  if (!key) throw new Error("A faixa não possui uma chave de comentários válida.");
  if (typeof onChange !== "function") throw new Error("A atualização dos comentários exige uma função de retorno.");
  const client = await getCloudClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Entre na sua conta para sincronizar os comentários em tempo real.");

  const channel = client.channel(`music-comments:${user.id}:${crypto.randomUUID()}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "music_comments", filter: `thread_key=eq.${key}`
    }, async () => {
      try { await onChange(await cloudGetThread(key)); }
      catch (error) { onStatus("CALLBACK_ERROR", error); }
    })
    .subscribe((status, error) => {
      onStatus(status, error || null);
      if (status === "SUBSCRIBED") {
        // Re-fetch after joining the channel so updates during initial loading are not missed.
        void cloudGetThread(key).then(onChange).catch(fetchError => onStatus("CALLBACK_ERROR", fetchError));
      }
    });

  return async () => {
    try { await client.removeChannel(channel); }
    catch (error) { onStatus("UNSUBSCRIBE_ERROR", error); }
  };
}

export async function cloudAddComment(threadKey, text, files = []) {
  const key = String(threadKey || "").trim();
  if (!key) throw new Error("A faixa não possui uma chave de comentários válida.");
  const client = await getCloudClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Entre na sua conta para publicar comentários na nuvem.");
  const profile = await getCloudProfile();
  if (!profile) throw new Error("Não foi possível validar seu perfil.");
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
      const { error } = await client.storage.from("music-comment-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(`Falha ao enviar fotografia: ${error.message}`);
      uploaded.push({ path, name: file.name || "Fotografia", type: file.type, size: file.size });
    }
    const { data, error } = await client.from("music_comments").insert({
      thread_key: key, user_id: user.id, author_name: profile.display_name || profile.username,
      body, attachments: uploaded
    }).select("id, thread_key, user_id, author_name, body, created_at, attachments").single();
    if (error) throw new Error(`Falha ao publicar comentário: ${error.message}`);
    return (await withSignedAttachments(client, [data]))[0];
  } catch (error) {
    if (uploaded.length) {
      const { error: cleanupError } = await client.storage.from("music-comment-photos").remove(uploaded.map(file => file.path));
      if (cleanupError) console.error("Não foi possível remover anexos após falha:", cleanupError.message);
    }
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
  return { profile, users: users || [], comments: await withSignedAttachments(client, comments || []) };
}
