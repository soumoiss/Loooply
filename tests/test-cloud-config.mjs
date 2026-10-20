import fs from "node:fs";
import { pathToFileURL } from "node:url";

const source = fs.readFileSync(new URL("../assets/js/cloud-config.js", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
const { CLOUD_CONFIG, isCloudConfigValid } = await import(moduleUrl);

const validKey = "sb_publishable_test_key_with_sufficient_length_12345";
const cases = [
  [true, "https://example.supabase.co", validKey],
  [false, "http://example.supabase.co", validKey],
  [false, "https://example.supabase.co", "short"],
  [false, "https://example.supabase.co", "COLE_AQUI_A_CHAVE_ANON_PUBLICA"],
  [false, "COLE_AQUI_A_URL_DO_SUPABASE", validKey],
  [false, "https://example.supabase.com", validKey],
];
for (const [expected, url, key] of cases) {
  const actual = isCloudConfigValid(url, key);
  if (actual !== expected) throw new Error(`Falha de validação Supabase para URL ${url}: esperado ${expected}, obtido ${actual}`);
}
if (CLOUD_CONFIG.enabled() !== isCloudConfigValid(CLOUD_CONFIG.supabaseUrl, CLOUD_CONFIG.supabaseAnonKey)) {
  throw new Error("enabled() diverge do validador público.");
}
console.log("OK: testes de configuração Supabase concluídos.");
