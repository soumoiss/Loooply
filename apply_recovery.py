#!/usr/bin/env python3
"""Apply the verified Loooply cloud-auth recovery changes to a local checkout.

Run from any directory with: python apply_recovery.py /path/to/Loooply
The script preflights every target and every expected source fragment before it
writes anything. If the repository has changed since this patch was prepared,
it stops instead of guessing or overwriting unrelated work.
"""
from __future__ import annotations
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Preflight failed for {label}: expected 1 match, found {count}.")
    return text.replace(old, new, 1)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python apply_recovery.py /path/to/Loooply", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()

    files = {
        rel: (root / rel).read_text(encoding="utf-8")
        for rel in (
            "assets/js/cloud-config.js",
            "assets/js/session.js",
            "assets/js/comments-store.js",
            "assets/js/music.js",
            "assets/js/admin.js",
            "scripts/test-static.mjs",
            "scripts/smoke_test.py",
            "supabase/schema.sql",
        )
    }

    # Fix the false-negative cloud check. Keep the existing public project URL
    # and publishable key exactly as they are in the target repository.
    cloud = files["assets/js/cloud-config.js"]
    cloud = replace_once(
        cloud,
        "export const CLOUD_CONFIG = Object.freeze({",
        '''const PLACEHOLDER_MARKERS = /(?:COLE_AQUI|YOUR_SUPABASE|YOUR_PROJECT|PROJECT_REF|REPLACE_ME|CHANGE_ME|<[^>]+>)/i;\n\nexport function isCloudConfigValid(supabaseUrl, supabaseAnonKey) {\n  const url = String(supabaseUrl || "").trim();\n  const key = String(supabaseAnonKey || "").trim();\n  return /^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/i.test(url)\n    && key.length > 20\n    && !PLACEHOLDER_MARKERS.test(url)\n    && !PLACEHOLDER_MARKERS.test(key);\n}\n\nexport const CLOUD_CONFIG = Object.freeze({''',
        "cloud-config validator insertion",
    )
    cloud = replace_once(
        cloud,
        '''  enabled() {\n    return /^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/i.test(this.supabaseUrl)\n      && typeof this.supabaseAnonKey === "string"\n      && this.supabaseAnonKey.length > 20\n      && !this.supabaseUrl.includes("https://kgrxvsizfmaxlosiitec.supabase.co")\n      && !this.supabaseAnonKey.includes("sb_publishable_pQz-Q8I_yaBZNDrXWt6EMw_f1_FUveY");\n  }''',
        '''  enabled() {\n    return isCloudConfigValid(this.supabaseUrl, this.supabaseAnonKey);\n  }''',
        "self-referential cloud guard",
    )
    files["assets/js/cloud-config.js"] = cloud

    # Keep legacy users able to use the existing local login while routing the
    # administrator and non-legacy cloud accounts through Supabase Auth.
    session = files["assets/js/session.js"]
    session = replace_once(
        session,
        '''export async function authenticate(username, password) {\n  if (cloudConfigured()) return cloudSignIn(username, password);\n  const normalized = normalizeUsername(username);\n  const user = getUser(normalized);\n  if (!user || !password) return null;\n  const hash = await sha256Hex(String(password));\n  return hash === user.passwordHash ? { username: normalized, ...user } : null;\n}''',
        '''export async function authenticate(username, password) {\n  const legacyUsername = canonicalUsername(username);\n  const legacyUser = getUser(legacyUsername);\n  if (legacyUser) {\n    if (!password) return null;\n    const hash = await sha256Hex(String(password));\n    return hash === legacyUser.passwordHash\n      ? { username: legacyUsername, ...legacyUser, role: "user", cloudAuthenticated: false }\n      : null;\n  }\n  if (cloudConfigured()) return cloudSignIn(username, password);\n  return null;\n}''',
        "legacy/cloud authentication routing",
    )
    session = replace_once(
        session,
        '''  const validCloudSession = v2?.cloudAuthenticated === true && Boolean(username);\n  const valid = loggedIn && (cloudConfigured() ? validCloudSession : Boolean(user)) && (!v2 || v2.authenticated === true);\n  if (!valid) return null;\n\n  const session = {\n    authenticated: true,\n    username,\n    profilePic: user?.profilePic || legacyProfilePic || v2?.profilePic || "",\n    role: v2?.role || "user",\n    cloudAuthenticated: validCloudSession,\n    createdAt: v2?.createdAt || null\n  };\n  if (user && legacyProfilePic !== user.profilePic) writeString(APP_CONFIG.storage.profilePic, user.profilePic);\n  if (!v2 || v2.username !== username || v2.profilePic !== session.profilePic || v2.role !== session.role) {\n    writeJSON(APP_CONFIG.storage.sessionV2, session);\n  }''',
        '''  const validCloudSession = cloudConfigured()\n    && v2?.authenticated === true\n    && v2?.cloudAuthenticated === true\n    && v2.username === username\n    && Boolean(username);\n  const validLegacySession = Boolean(user)\n    && v2?.authenticated === true\n    && v2?.cloudAuthenticated === false\n    && v2.username === username;\n  const validLocalSession = cloudConfigured() ? validLegacySession : Boolean(user);\n  const valid = loggedIn && (validCloudSession || validLocalSession) && (!v2 || v2.authenticated === true);\n  if (!valid) return null;\n\n  const session = {\n    authenticated: true,\n    username,\n    profilePic: user?.profilePic || legacyProfilePic || v2?.profilePic || "",\n    role: validCloudSession ? (v2?.role || "user") : "user",\n    cloudAuthenticated: validCloudSession,\n    createdAt: v2?.createdAt || null\n  };\n  if (user && legacyProfilePic !== user.profilePic) writeString(APP_CONFIG.storage.profilePic, user.profilePic);\n  if (!v2 || v2.username !== username || v2.profilePic !== session.profilePic || v2.role !== session.role || v2.cloudAuthenticated !== session.cloudAuthenticated) {\n    writeJSON(APP_CONFIG.storage.sessionV2, session);\n  }''',
        "safe distinction between local and cloud sessions",
    )
    files["assets/js/session.js"] = session

    comments = files["assets/js/comments-store.js"]
    comments = replace_once(
        comments,
        'import { cloudConfigured, cloudGetThread, cloudAddComment } from "./cloud.js";\n',
        'import { cloudConfigured, cloudGetThread, cloudAddComment } from "./cloud.js";\nimport { getSession } from "./session.js";\n',
        "session-aware comment store import",
    )
    comments = replace_once(
        comments,
        "let databasePromise;\n",
        '''let databasePromise;\n\nfunction useCloudComments() {\n  return cloudConfigured() && getSession()?.cloudAuthenticated === true;\n}\n''',
        "session-aware comment mode helper",
    )
    comments = replace_once(comments, "if (cloudConfigured()) return cloudGetThread(key);", "if (useCloudComments()) return cloudGetThread(key);", "read comment source")
    comments = replace_once(comments, 'if (cloudConfigured()) throw new Error("Com a nuvem ativa, publique comentários usando addComment.");', 'if (useCloudComments()) throw new Error("Com a nuvem ativa para esta sessão, publique comentários usando addComment.");', "save comment source")
    comments = replace_once(comments, "if (cloudConfigured()) return cloudAddComment(key, text, files);", "if (useCloudComments()) return cloudAddComment(key, text, files);", "create comment source")
    files["assets/js/comments-store.js"] = comments

    music = files["assets/js/music.js"]
    music = replace_once(
        music,
        'status.textContent = cloudConfigured() ? "Comentário publicado na nuvem." : "Comentário salvo neste dispositivo. Configure a nuvem para sincronizar entre aparelhos.";',
        '''status.textContent = cloudConfigured()\n      ? (getSession()?.cloudAuthenticated === true\n          ? "Comentário publicado na nuvem."\n          : "Comentário salvo neste dispositivo. Esta conta ainda não foi migrada para a nuvem.")\n      : "Comentário salvo neste dispositivo. Configure a nuvem para sincronizar entre aparelhos.";''',
        "accurate comment-save status",
    )
    files["assets/js/music.js"] = music

    admin = files["assets/js/admin.js"]
    admin = replace_once(
        admin,
        '''    const session = getSession();\n    if (!session) { window.location.replace("login.html"); return; }\n    data = await cloudAdminOverview();''',
        '''    const session = getSession();\n    if (!session) { window.location.replace("login.html"); return; }\n    if (session.cloudAuthenticated !== true) throw new Error("Esta conta ainda usa autenticação local e não possui acesso ao painel administrativo.");\n    data = await cloudAdminOverview();''',
        "administrative session boundary",
    )
    files["assets/js/admin.js"] = admin

    static_test = files["scripts/test-static.mjs"]
    static_test = replace_once(
        static_test,
        'const cloudModule = fs.readFileSync(path.join(root, "assets/js/cloud.js"), "utf8");',
        '''const cloudConfigSource = fs.readFileSync(path.join(root, "assets/js/cloud-config.js"), "utf8");\nconst cloudConfigUrl = `data:text/javascript;base64,${Buffer.from(cloudConfigSource, "utf8").toString("base64")}`;\nconst { CLOUD_CONFIG, isCloudConfigValid } = await import(cloudConfigUrl);\nif (CLOUD_CONFIG.enabled() !== isCloudConfigValid(CLOUD_CONFIG.supabaseUrl, CLOUD_CONFIG.supabaseAnonKey)) {\n  throw new Error("A validação da configuração da nuvem diverge da validação dos valores configurados.");\n}\nconst testPublishableKey = "sb_publishable_test_key_with_sufficient_length_12345";\nif (!isCloudConfigValid("https://example.supabase.co", testPublishableKey)) throw new Error("Configuração Supabase válida foi rejeitada.");\nif (isCloudConfigValid("https://example.supabase.co", "COLE_AQUI_A_CHAVE_ANON_PUBLICA")) throw new Error("Chave de exemplo foi aceita como configuração real.");\nif (isCloudConfigValid("COLE_AQUI_A_URL_DO_SUPABASE", testPublishableKey)) throw new Error("URL de exemplo foi aceita como configuração real.");\n\nconst cloudModule = fs.readFileSync(path.join(root, "assets/js/cloud.js"), "utf8");''',
        "cloud configuration regression test",
    )
    files["scripts/test-static.mjs"] = static_test

    smoke = files["scripts/smoke_test.py"]
    smoke = replace_once(
        smoke,
        "          localStorage.setItem('profilePic','user1_perf.png');\n",
        "          localStorage.setItem('profilePic','user1_perf.png');\n          localStorage.setItem('looply_session_v2', JSON.stringify({authenticated:true, username:'Patati', profilePic:'user1_perf.png', role:'user', cloudAuthenticated:false, createdAt:new Date().toISOString()}));\n",
        "browser smoke test local-session setup",
    )
    files["scripts/smoke_test.py"] = smoke

    schema = files["supabase/schema.sql"]
    schema = replace_once(
        schema,
        "create or replace function public.is_loooply_admin()\nreturns boolean language sql stable security definer set search_path=''\nas $fn$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'); $fn$;\nrevoke all on function public.is_loooply_admin() from public, anon;\ngrant execute on function public.is_loooply_admin() to authenticated;",
        "create schema if not exists private;\nrevoke all on schema private from public, anon;\ngrant usage on schema private to authenticated;\ncreate or replace function private.is_loooply_admin()\nreturns boolean language sql stable security definer set search_path=''\nas $fn$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'); $fn$;\nrevoke all on function private.is_loooply_admin() from public, anon;\ngrant execute on function private.is_loooply_admin() to authenticated;",
        "align setup schema with live private admin function",
    )
    schema = schema.replace("public.is_loooply_admin()", "private.is_loooply_admin()")
    schema = replace_once(
        schema,
        "update public.profiles set username='peixinho',display_name='Peixinho',role='admin' where id='684fc721-13f5-4882-a645-d624e1289c27'::uuid;",
        "drop function if exists public.is_loooply_admin();\n-- Do not grant admin privileges to a hard-coded UUID in a reusable schema script.\n-- Promote the verified owner account separately after checking its Auth identity.",
        "remove hard-coded admin promotion from reusable schema script",
    )
    files["supabase/schema.sql"] = schema

    # All source fragments are preflighted before this point. Keep a rollback
    # copy in the checkout, then write the staged changes.
    backup = root / ".loooply-recovery-backup"
    if backup.exists():
        raise RuntimeError(f"Refusing to overwrite existing backup directory: {backup}")
    for rel in files:
        (backup / rel).parent.mkdir(parents=True, exist_ok=True)
        (backup / rel).write_text((root / rel).read_text(encoding="utf-8"), encoding="utf-8")
    for rel, content in files.items():
        target = root / rel
        staged = target.with_suffix(target.suffix + ".recovery-tmp")
        staged.write_text(content, encoding="utf-8")
    for rel in files:
        target = root / rel
        staged = target.with_suffix(target.suffix + ".recovery-tmp")
        staged.replace(target)

    print("Applied Loooply recovery patch to 8 source/test files.")
    print(f"Originals saved under: {backup}")
    print("Next: run node scripts/test-static.mjs --source-only")
    print("Browser test, when Playwright/Chromium are available: python scripts/smoke_test.py")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
