import { cloudConfigured, getCloudClient, ensureCloudProfile } from "./cloud.js";
import { createSession, getSession } from "./session.js";

/**
 * Resolve a sessão real do Supabase primeiro; mantém compatibilidade com
 * contas locais legadas quando a autenticação em nuvem não está ativa.
 */
export async function resolveStartupSession() {
  if (cloudConfigured()) {
    try {
      const client = await getCloudClient();
      const { data, error } = await client.auth.getSession();
      if (!error && data?.session?.user) {
        const authUser = data.session.user;
        const profile = await ensureCloudProfile(authUser, authUser.email || "");
        createSession(
          profile.username,
          profile.profile_pic || "",
          profile.role || "user",
          true
        );
        return getSession();
      }
      if (error) console.warn("Looply: não foi possível restaurar a sessão Supabase.", error.message);
    } catch (error) {
      console.warn("Looply: verificação da sessão em nuvem falhou.", error);
    }
  }
  return getSession();
}
