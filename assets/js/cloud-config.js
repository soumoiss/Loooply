/* Configuração pública do Supabase para o Loooply.
 * A publishable/anon key pode ser usada no navegador com RLS corretamente configurada.
 * NUNCA coloque uma chave service_role/secret neste ficheiro.
 */
export const CLOUD_CONFIG = Object.freeze({
  supabaseUrl: "https://kgrxvsizfmaxlosiitec.supabase.co",
  supabaseAnonKey: "sb_publishable_pQz-Q8I_yaBZNDrXWt6EMw_f1_FUveY",
  enabled() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(this.supabaseUrl)
      && typeof this.supabaseAnonKey === "string"
      && this.supabaseAnonKey.length > 20
      && !this.supabaseUrl.includes("https://kgrxvsizfmaxlosiitec.supabase.co")
      && !this.supabaseAnonKey.includes("sb_publishable_pQz-Q8I_yaBZNDrXWt6EMw_f1_FUveY");
  }
});
