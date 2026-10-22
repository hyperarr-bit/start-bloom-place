// @vitest-environment node
/**
 * REGRAS DE ACESSO DO BANCO (revisão de segurança 21/10) — PGlite (Postgres de verdade em WASM, sem rede) com TODAS
 * as migrações de supabase/migrations e um chão que imita o Supabase (papéis anon/authenticated/service_role,
 * auth.uid(), GRANT padrão do schema public). Ver ./pglite-supabase.ts.
 *
 * Cobre: RLS ligada em toda tabela; dados de pessoa só do dono; tabelas sensíveis fechadas pra anon/authenticated;
 * SECURITY DEFINER com search_path fixo; RPCs de admin recusam quem não é admin; e a migração
 * 20261022120000_seguranca_eventos_servidor (eventos só do servidor, pending_discount_for_user, skin-photos).
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bancoComMigracoes, comoAnon, comoPapel, comoUsuario } from "./pglite-supabase";

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BIA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "2c896992-6849-4ca6-9a66-5c2414bb9424"; // o admin semeado em 20260426155338

let db: PGlite;
let falhas: { arquivo: string; erro: string }[] = [];

const tenta = async (fn: () => Promise<unknown>): Promise<"ok" | string> => {
  try { await fn(); return "ok"; } catch (e) { return (e as Error).message; }
};

beforeAll(async () => {
  const c = await bancoComMigracoes();
  db = c.db;
  falhas = c.falhas;
  await db.query(`insert into auth.users (id, email) values ($1, 'ana@x.com'), ($2, 'bia@x.com') on conflict do nothing`, [ANA, BIA]);
  await db.query(`insert into auth.users (id, email) values ($1, 'dono@x.com') on conflict do nothing`, [ADMIN]);
  await db.query(`insert into public.subscriptions (user_id, status) values ($1, 'active'), ($2, 'active')`, [ANA, BIA]);
  await db.query(`insert into public.user_data (user_id, key, value) values ($1, 'core-financas', '{"x":1}'), ($2, 'core-financas', '{"x":2}')`, [ANA, BIA]);
}, 120_000);

describe("a carga das migrações", () => {
  it("a migração de segurança roda inteira", () => {
    expect(falhas.filter((f) => f.arquivo.startsWith("20261022120000"))).toEqual([]);
  });
});

describe("toda tabela do public tem RLS", () => {
  it("relrowsecurity em todas", async () => {
    const r = await db.query<{ relname: string }>(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });
});

describe("tabelas sensíveis: anon não lê nada", () => {
  const SENSIVEIS = [
    "subscriptions", "support_tickets", "user_data", "profiles", "user_roles", "webhook_events", "porta_handoff",
    "porta_handoff_erros", "meta_dados_aparelho", "afiliados", "afiliado_vendas", "afiliado_pagamentos",
    "retention_offers_used", "trial_email_schedule", "push_subscriptions", "analytics_events", "referral_rewards",
  ];
  for (const t of SENSIVEIS) {
    it(t, async () => {
      const r = await comoAnon(db, async () => tenta(async () => {
        const q = await db.query(`select * from public.${t} limit 5`);
        if (q.rows.length) throw new Error(`anon leu ${q.rows.length} linha(s)`);
      }));
      // ou o GRANT barra (permission denied) ou a RLS devolve zero linhas — nunca linha nenhuma
      expect(r === "ok" || /permission denied/.test(r)).toBe(true);
    });
  }
});

describe("dados de pessoa: só o dono", () => {
  it("Ana não lê a assinatura nem o user_data da Bia", async () => {
    const subs = await comoUsuario(db, ANA, () => db.query<{ user_id: string }>(`select user_id from public.subscriptions`));
    expect(subs.rows.map((r) => r.user_id)).toEqual([ANA]);
    const dados = await comoUsuario(db, ANA, () => db.query<{ user_id: string }>(`select user_id from public.user_data`));
    expect(dados.rows.map((r) => r.user_id)).toEqual([ANA]);
  });
  it("Ana não grava no user_data da Bia nem apaga o dela", async () => {
    expect(await comoUsuario(db, ANA, () => tenta(() => db.query(`insert into public.user_data (user_id, key, value) values ($1, 'x', '{}')`, [BIA])))).toMatch(/row-level security/);
    await comoUsuario(db, ANA, () => db.query(`delete from public.user_data where user_id = $1`, [BIA]));
    const r = await db.query(`select 1 from public.user_data where user_id = $1`, [BIA]);
    expect(r.rows).toHaveLength(1);
  });
  it("ninguém se dá assinatura nem papel de admin pelo cliente", async () => {
    expect(await comoUsuario(db, ANA, () => tenta(() => db.query(`insert into public.subscriptions (user_id, status) values ($1, 'active')`, [ANA])))).toMatch(/row-level security|permission denied/);
    await comoUsuario(db, ANA, () => db.query(`update public.subscriptions set status = 'active', current_period_end = now() + interval '100 years' where user_id = $1`, [ANA]));
    const r = await db.query<{ current_period_end: string | null }>(`select current_period_end from public.subscriptions where user_id = $1`, [ANA]);
    expect(r.rows[0].current_period_end).toBeNull();
    expect(await comoUsuario(db, ANA, () => tenta(() => db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [ANA])))).toMatch(/row-level security|permission denied/);
  });
  it("chamado de suporte: só os próprios", async () => {
    await db.query(`insert into public.support_tickets (user_id, message) values ($1, 'ajuda da bia')`, [BIA]).catch(async () => {
      await db.query(`insert into public.support_tickets (user_id) values ($1)`, [BIA]);
    });
    const r = await comoUsuario(db, ANA, () => db.query(`select * from public.support_tickets`));
    expect(r.rows).toHaveLength(0);
  });
});

describe("SECURITY DEFINER", () => {
  it("toda função SECURITY DEFINER do public fixa o search_path", async () => {
    const r = await db.query<{ proname: string }>(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(r.rows.map((x) => x.proname)).toEqual([]);
  });
  it("RPCs de admin recusam anon e usuário comum", async () => {
    const r = await db.query<{ sig: string }>(`select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.proname like 'admin\\_%'`);
    expect(r.rows.length).toBeGreaterThan(3);
    for (const { sig } of r.rows) {
      const nome = sig.slice(0, sig.indexOf("("));
      const tipos = sig.slice(sig.indexOf("(") + 1, -1).split(",").map((t) => t.trim()).filter(Boolean);
      const args = tipos.map((t) => (t.startsWith("timestamp") ? "now()" : t === "uuid" ? `'${BIA}'::uuid` : t === "integer" ? "10" : "'x'"));
      const chamada = `select ${nome}(${args.join(", ")})`;
      for (const [papel, uid] of [["anon", null], ["authenticated", ANA]] as const) {
        const res = await comoPapel(db, papel, uid, () => tenta(() => db.query(chamada)));
        expect(res, `${papel} ${chamada}`).not.toBe("ok");
      }
    }
  });
  it("pending_discount_for_user: só o servidor executa (migração de segurança)", async () => {
    expect(await comoAnon(db, () => tenta(() => db.query(`select * from public.pending_discount_for_user($1)`, [BIA])))).toMatch(/permission denied/);
    expect(await comoUsuario(db, ANA, () => tenta(() => db.query(`select * from public.pending_discount_for_user($1)`, [BIA])))).toMatch(/permission denied/);
    expect(await comoPapel(db, "service_role", null, () => tenta(() => db.query(`select * from public.pending_discount_for_user($1)`, [BIA])))).toBe("ok");
  });
});

describe("analytics_events: eventos que só o servidor grava (migração de segurança)", () => {
  const inserir = (uid: string | null, nome: string) =>
    db.query(`insert into public.analytics_events (user_id, event_name, event_data) values ($1, $2, $3)`, [uid, nome, JSON.stringify({ order_id: "QR_DA_BIA", offer: "w27" })]);

  it("logado NÃO grava pix_order_created (nem com o próprio user_id)", async () => {
    expect(await comoUsuario(db, ANA, () => tenta(() => inserir(ANA, "pix_order_created")))).toMatch(/row-level security/);
  });
  it("anon NÃO grava o disjuntor da Cakto nem pix_order_created", async () => {
    expect(await comoAnon(db, () => tenta(() => inserir(null, "cakto_disjuntor_aberto")))).toMatch(/row-level security/);
    expect(await comoAnon(db, () => tenta(() => inserir(null, "pix_order_created")))).toMatch(/row-level security/);
  });
  it("as travas de 1x por conta também ficam só pro servidor", async () => {
    for (const nome of ["porta_email_enviado", "porta_capi_cr", "meta_capi_app_enviado", "pix_pendente_email_enviado"]) {
      expect(await comoUsuario(db, ANA, () => tenta(() => inserir(ANA, nome))), nome).toMatch(/row-level security/);
    }
  });
  it("o evento comum do app continua entrando (logado e anon) — a medição não quebra", async () => {
    expect(await comoUsuario(db, ANA, () => tenta(() => inserir(ANA, "pix_generated")))).toBe("ok");
    expect(await comoUsuario(db, ANA, () => tenta(() => inserir(null, "porta_view")))).toBe("ok");
    expect(await comoAnon(db, () => tenta(() => inserir(null, "page_view")))).toBe("ok");
  });
  it("logado continua sem gravar evento com o user_id de outra pessoa", async () => {
    expect(await comoUsuario(db, ANA, () => tenta(() => inserir(BIA, "page_view")))).toMatch(/row-level security/);
  });
  it("o servidor (service_role) grava pix_order_created", async () => {
    expect(await comoPapel(db, "service_role", null, () => tenta(() => inserir(BIA, "pix_order_created")))).toBe("ok");
  });
});

describe("storage", () => {
  it("nenhuma policy deixa anon ler o bucket skin-photos", async () => {
    const r = await db.query(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and 'anon' = any(roles) and cmd = 'SELECT'`);
    expect(r.rows).toEqual([]);
  });
});
