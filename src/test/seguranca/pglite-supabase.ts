/**
 * Banco de teste: PGlite (Postgres em WASM, roda dentro do vitest, sem rede) com um "chão" que imita o
 * Supabase — papéis anon/authenticated/service_role, auth.uid()/auth.jwt(), auth.users, storage, os
 * stubs de pg_cron/pg_net e os privilégios padrão do schema public (no Supabase toda tabela e função
 * nova nasce com GRANT pra anon e authenticated; é por isso que RLS e REVOKE importam).
 *
 * Carrega TODAS as migrações de supabase/migrations na ordem do nome. Uso:
 *   const db = await bancoComMigracoes();
 *   await comoUsuario(db, uid, async () => db.query("select * from subscriptions"));
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PASTA_MIGRACOES = resolve(__dirname, "../../../supabase/migrations");

const CHAO_SUPABASE = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS net;
GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  is_anonymous boolean DEFAULT false,
  banned_until timestamptz,
  deleted_at timestamptz
);
CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, provider text, identity_data jsonb, created_at timestamptz DEFAULT now());

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$f$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$f$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$f$;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT auth.jwt() ->> 'email' $f$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false, owner uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$f$;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;

CREATE TABLE cron.job (jobid bigserial PRIMARY KEY, jobname text, schedule text, command text);
CREATE FUNCTION cron.schedule(jobname text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $f$
  INSERT INTO cron.job (jobname, schedule, command) VALUES ($1, $2, $3) RETURNING jobid
$f$;
CREATE FUNCTION cron.schedule(schedule text, command text) RETURNS bigint LANGUAGE sql AS $f$
  INSERT INTO cron.job (schedule, command) VALUES ($1, $2) RETURNING jobid
$f$;
CREATE FUNCTION cron.unschedule(jobname text) RETURNS boolean LANGUAGE sql AS $f$
  WITH d AS (DELETE FROM cron.job WHERE cron.job.jobname = $1 RETURNING 1) SELECT true
$f$;
CREATE FUNCTION cron.unschedule(jobid bigint) RETURNS boolean LANGUAGE sql AS $f$
  WITH d AS (DELETE FROM cron.job WHERE cron.job.jobid = $1 RETURNING 1) SELECT true
$f$;
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000) RETURNS bigint LANGUAGE sql AS $f$ SELECT 1::bigint $f$;

-- Supabase: o que nasce em public já vem com GRANT pra anon/authenticated/service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`;

/** Tira o que o PGlite não tem (pg_cron/pg_net viram os stubs do chão). */
function adaptar(sql: string): string {
  return sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?(pg_cron|pg_net|pgcrypto|pg_trgm|uuid-ossp)"?[^;]*;/gi, "");
}

export interface Carga {
  db: PGlite;
  falhas: { arquivo: string; erro: string }[];
}

export function listarMigracoes(extras: string[] = []): string[] {
  const arquivos = readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith(".sql")).sort();
  return [...arquivos.map((f) => resolve(PASTA_MIGRACOES, f)), ...extras];
}

/**
 * Quebra um arquivo SQL em comandos, respeitando aspas simples/duplas, $tag$ … $tag$ e comentários.
 * Serve pra carregar comando a comando: o histórico do Lovable tem migrações que recriam tabelas que já
 * existem (no banco de verdade elas rodaram sobre outro estado); um comando que falha não pode levar os
 * outros do mesmo arquivo junto (ex.: um CREATE POLICY depois de um CREATE TABLE repetido).
 */
export function dividirComandos(sql: string): string[] {
  const out: string[] = [];
  let atual = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const dois = sql.slice(i, i + 2);
    if (dois === "--") {
      const fim = sql.indexOf("\n", i);
      i = fim === -1 ? sql.length : fim;
      continue;
    }
    if (dois === "/*") {
      const fim = sql.indexOf("*/", i + 2);
      i = fim === -1 ? sql.length : fim + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c) { j += 2; continue; }
        if (sql[j] === c) break;
        j++;
      }
      atual += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "$") {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const fim = sql.indexOf(tag, i + tag.length);
        const ate = fim === -1 ? sql.length : fim + tag.length;
        atual += sql.slice(i, ate);
        i = ate;
        continue;
      }
    }
    if (c === ";") {
      if (atual.trim()) out.push(atual.trim());
      atual = "";
      i++;
      continue;
    }
    atual += c;
    i++;
  }
  if (atual.trim()) out.push(atual.trim());
  return out;
}

/** Carrega o chão + todas as migrações, comando a comando. Comando que falha vai pra `falhas` e a carga segue. */
export async function bancoComMigracoes(extras: string[] = []): Promise<Carga> {
  const db = new PGlite();
  await db.exec(CHAO_SUPABASE);
  const falhas: Carga["falhas"] = [];
  for (const caminho of listarMigracoes(extras)) {
    const arquivo = caminho.split("/").pop()!;
    for (const comando of dividirComandos(adaptar(readFileSync(caminho, "utf8")))) {
      try {
        await db.exec(comando);
      } catch (e) {
        falhas.push({ arquivo, erro: `${(e as Error).message} :: ${comando.slice(0, 90).replace(/\s+/g, " ")}` });
      }
    }
  }
  return { db, falhas };
}

/** Roda `fn` como o papel do Supabase (anon/authenticated) com o JWT de `uid`. Volta pro superusuário no fim. */
export async function comoPapel<T>(
  db: PGlite,
  papel: "anon" | "authenticated" | "service_role",
  uid: string | null,
  fn: () => Promise<T>,
  claimsExtras: Record<string, unknown> = {},
): Promise<T> {
  const claims = JSON.stringify({ sub: uid, role: papel, ...claimsExtras });
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false), set_config('request.jwt.claims', $3, false)`, [uid ?? "", papel, claims]);
  await db.exec(`SET ROLE ${papel}`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
  }
}

export const comoUsuario = <T>(db: PGlite, uid: string, fn: () => Promise<T>) => comoPapel(db, "authenticated", uid, fn);
export const comoAnon = <T>(db: PGlite, fn: () => Promise<T>) => comoPapel(db, "anon", null, fn);
