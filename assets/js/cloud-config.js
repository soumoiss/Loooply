/* Configure no Supabase Dashboard > Project Settings > API.
 * Use apenas a URL do projeto e a chave anon/publishable. NUNCA coloque service_role aqui.
 */
export const CLOUD_CONFIG = Object.freeze({
  supabaseUrl: "https://kgrxvsizfmaxlosiitec.supabase.co",
  supabaseAnonKey: "sb_publishable_pQz-Q8I_yaBZNDrXWt6EMw_f1_FUveY",
  

enabled() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(this.supabaseUrl)
    && this.supabaseAnonKey.length > 30
    && !this.supabaseUrl.includes("https://kgrxvsizfmaxlosiitec.supabase.co")
    && !this.supabaseAnonKey.includes("sb_publishable_pQz-Q8I_yaBZNDrXWt6EMw_f1_FUveY");
}
