// Registro local dos usuários do aplicativo.
// A autenticação continua sendo client-side e não substitui um backend seguro.
export const USER_REGISTRY = Object.freeze({
  Patati: Object.freeze({
    passwordHash: "8e7ef22586692050a1086b01128a2deb983147a0d54fca3eb14cad4de84db5e4",
    profilePic: "user1_perf.png"
  }),
  Misol: Object.freeze({
    passwordHash: "a3cf566f7a17f6a635451b35f99836ef61d6864ab7b36a035475a26abb84df7f",
    profilePic: "user2_perf.png"
  }),
  Lilika: Object.freeze({
    passwordHash: "8b298a0cb132431e783f1fcd7dedb77a2973e1a8b5241b7469c8b42ca13b7c2e",
    profilePic: "user3_perf.png"
  }),
  YARA: Object.freeze({
    passwordHash: "21d20ea85898267034656fa33c8e0525b7737f8ae254046f9e48d57b181e0b83",
    profilePic: "user4_perf.png"
  })
});

export const USERNAMES = Object.freeze(Object.keys(USER_REGISTRY));

export function canonicalUsername(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("pt-BR");
  return USERNAMES.find(
    (username) => username.toLocaleLowerCase("pt-BR") === normalized
  ) || "";
}

export function getUser(username) {
  const canonical = canonicalUsername(username);
  return canonical ? USER_REGISTRY[canonical] : null;
}

export function userExists(username) {
  return Boolean(canonicalUsername(username));
}
