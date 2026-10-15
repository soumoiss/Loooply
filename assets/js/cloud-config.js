/* Configuração pública do Supabase para o Loooply.
 * A publishable/anon key pode ser usada no navegador com RLS corretamente configurada.
 * NUNCA coloque uma chave service_role/secret neste ficheiro.
 */
const PLACEHOLDER_MARKERS = /(?:COLE_AQUI|YOUR_SUPABASE|YOUR_PROJECT|PROJECT_REF|REPLACE_ME|CHANGE_ME|<[^>]+>)/i;

export function isCloudConfigValid(supabaseUrl, supabaseAnonKey) {
  const url = String(supabaseUrl || "").trim();
  const key = String(supabaseAnonKey || "").trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    && key.length > 20
    && !PLACEHOLDER_MARKERS.test(url)
    && !PLACEHOLDER_MARKERS.test(key);
}

export const CLOUD_CONFIG = Object.freeze({
  supabaseUrl: "https://kgrxvsizfmaxlosiitec.supabase.co",
  supabaseAnonKey: "sb_publishable_pQz-Q8I_yaBZNDrXWt6EMw_f1_FUveY",
  enabled() {
    return isCloudConfigValid(this.supabaseUrl, this.supabaseAnonKey);
  }
});
