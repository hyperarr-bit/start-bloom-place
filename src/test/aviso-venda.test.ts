// @vitest-environment node
/**
 * AVISO DE VENDA (29/10) — o push "💰 Venda · R$ 97,90 · Apple anual" no iPhone do dono:
 *   · a mensagem por origem/plano; só avisa quando ENTRA dinheiro (teste grátis não; e-mail de teste não);
 *   · uma venda = um aviso (mesmo pedido/tx 2x dá 1);
 *   · Web Push de verdade (VAPID ES256 + aes128gcm): o "aparelho" do teste decifra e lê o texto;
 *   · a migração (NÃO aplicada): RLS fechada nas 2 tabelas, gatilhos chamam o avisar-venda só no caso certo e nunca
 *     quebram a gravação da assinatura;
 *   · a PWA isolada: manifest e service worker só do /vendas; o SW dos clientes (kill-switch + limpeza do main.tsx)
 *     continua igual e não derruba o do /vendas.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import {
  corpoVenda, dadosPush, ehEmailTeste, lojaDoTx, rotuloPlano, tituloVenda, vendaLoja, vendaPix, vendaRenovacao, type LinhaSub,
} from "../../supabase/functions/_shared/aviso-venda";
import { b64urlParaBytes, bytesParaB64url, cifrarAes128gcm, enviarPush, jwtVapid } from "../../supabase/functions/_shared/webpush";
import { mandarParaTodos } from "../../supabase/functions/_shared/push-dono";
import { ehSwDoAvisoDeVenda } from "@/vendas/escopo";
import { bancoComMigracoes, comoAnon, comoUsuario } from "./seguranca/pglite-supabase";

const RAIZ = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(RAIZ, p), "utf8");
const DIA = 86400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const T0 = Date.parse("2026-10-29T15:00:00Z");

/* linhas no formato real do banco */
const pix = (x: Partial<LinhaSub> = {}): LinhaSub => ({
  id: "11111111-1111-4111-8111-111111111111", user_id: "u1", status: "active", plan: "lifetime", billing_period: "lifetime",
  payment_method: "pix", amount_cents: 2790, customer_email: "maria@exemplo.com", current_period_start: iso(T0), current_period_end: iso(T0 + 365 * DIA),
  created_at: iso(T0), abacatepay_billing_id: "pay_abc123", revenuecat_subscription_id: null, ...x,
});
const loja = (x: Partial<LinhaSub> = {}): LinhaSub => ({
  id: "22222222-2222-4222-8222-222222222222", user_id: "u2", status: "active", plan: "app", billing_period: "annual",
  payment_method: "play_store", amount_cents: 9790, customer_email: "ana@exemplo.com", current_period_start: iso(T0 - 3 * DIA),
  current_period_end: iso(T0), created_at: iso(T0 - 3 * DIA), abacatepay_billing_id: null, revenuecat_subscription_id: "subAapXYZ", ...x,
});
const marcador = (tx: string, nome = "meta_capi_app_enviado") => ({ event_name: nome, event_data: { tx, valor: 97.9 }, created_at: iso(T0) });

describe("a mensagem do aviso", () => {
  it("Pix do site com o prazo; Apple/Play com o plano", () => {
    expect(tituloVenda(vendaPix(pix())!)).toBe("💰 Venda · R$ 27,90 · Pix do site (1 ano)");
    expect(tituloVenda(vendaPix(pix({ current_period_end: iso(T0 + 100 * 365 * DIA) }))!)).toBe("💰 Venda · R$ 27,90 · Pix do site (vitalício)");
    expect(tituloVenda(vendaPix(pix({ amount_cents: 990, current_period_end: iso(T0 + 30 * DIA) }))!)).toBe("💰 Venda · R$ 9,90 · Pix do site (1 mês)");
    expect(tituloVenda(vendaLoja(marcador("subAapXYZ"), loja())!)).toBe("💰 Venda · R$ 97,90 · Apple anual");
    expect(tituloVenda(vendaLoja(marcador("GPA.1234"), loja({ revenuecat_subscription_id: "GPA.1234", billing_period: "monthly", amount_cents: 2490 }))!))
      .toBe("💰 Venda · R$ 24,90 · Google Play mensal");
    expect(tituloVenda({ origem: "apple", valor_cents: 1990, plano: "mensal", renovacao: true })).toBe("💰 Renovação · R$ 19,90 · Apple mensal");
  });
  it("valor grande com milhar, corpo com o total do dia, push abre o /vendas com o ícone do CORE", () => {
    expect(tituloVenda({ origem: "pix", valor_cents: 123456, plano: "1 ano", renovacao: false })).toBe("💰 Venda · R$ 1.234,56 · Pix do site (1 ano)");
    expect(corpoVenda(41230, 5)).toBe("Hoje: 5 vendas · R$ 412,30");
    expect(corpoVenda(2790, 1)).toBe("Hoje: 1 venda · R$ 27,90");
    expect(dadosPush("t", "c", "k")).toEqual({ title: "t", body: "c", tag: "k", url: "/vendas", icon: "/icon-192.png", badge: "/icon-192.png" });
  });
  it("iPhone pelo prefixo do tx do RevenueCat", () => {
    expect(lojaDoTx("subAap123")).toBe("apple");
    expect(lojaDoTx("otpA99")).toBe("apple");
    expect(lojaDoTx("GPA.3399")).toBe("play");
    expect(rotuloPlano({ billing_period: "monthly_prepaid" }, "play")).toBe("mensal");
  });
});

describe("só avisa quando entra dinheiro", () => {
  it("Pix: pendente, sem valor ou e-mail de teste não avisam", () => {
    expect(vendaPix(pix({ status: "pending" }))).toBeNull();
    expect(vendaPix(pix({ amount_cents: 0 }))).toBeNull();
    expect(vendaPix(pix({ payment_method: "presente" }))).toBeNull();
    for (const e of ["fulano.teste@exemplo.com", "x-hyperarr-y@exemplo.com", "x-jv20101958-y@exemplo.com"]) expect(vendaPix(pix({ customer_email: e }))).toBeNull();
    expect(ehEmailTeste("maria@exemplo.com")).toBe(false);
  });
  it("loja: o marcador do TESTE GRÁTIS não avisa; o da cobrança confirmada sim", () => {
    expect(vendaLoja(marcador("subAapXYZ", "meta_capi_trial_enviado"), loja())).toBeNull();
    expect(vendaLoja(marcador("subAapXYZ"), loja({ customer_email: "x.teste@exemplo.com" }))).toBeNull();
    expect(vendaLoja(marcador("subAapXYZ"), loja({ payment_method: "pix" }))).toBeNull();
    expect(vendaLoja(marcador("subAapXYZ"), loja())).toMatchObject({ chave: "loja:subAapXYZ", origem: "apple", valor_cents: 9790 });
  });
  it("renovação: a 1ª cobrança depois do teste NÃO é renovação (vem pelo marcador); a do ano seguinte é", () => {
    // teste de 3 dias virando ano pago: período antigo de 3 dias → fica com o marcador
    expect(vendaRenovacao(loja({ current_period_end: iso(T0 + 365 * DIA) }), iso(T0))).toBeNull();
    // mensal pago renovando: período antigo de 30 dias, fim anda 30 dias
    const mensal = loja({ billing_period: "monthly", amount_cents: 1990, current_period_start: iso(T0 - 30 * DIA), current_period_end: iso(T0 + 30 * DIA) });
    expect(vendaRenovacao(mensal, iso(T0))).toMatchObject({ origem: "apple", valor_cents: 1990, renovacao: true, plano: "mensal" });
    // carência/ajuste pequeno do fim não é cobrança
    expect(vendaRenovacao({ ...mensal, current_period_end: iso(T0 + 5 * DIA) }, iso(T0))).toBeNull();
    expect(vendaRenovacao({ ...mensal, customer_email: "teste@x.com" }, iso(T0))).toBeNull();
  });
});

describe("uma venda = um aviso (chave)", () => {
  it("Pix: os 3 caminhos do mesmo pedido dão a mesma chave; outro pedido na mesma linha é outra venda", () => {
    expect(vendaPix(pix())!.chave).toBe("pix:pay_abc123");
    expect(vendaPix(pix({ id: "outro-id" }))!.chave).toBe("pix:pay_abc123");
    expect(vendaPix(pix({ abacatepay_billing_id: "pay_novo" }))!.chave).toBe("pix:pay_novo");
  });
  it("loja: webhook e cron gravando o mesmo tx dão a mesma chave; renovação tem a data do novo fim", () => {
    expect(vendaLoja(marcador("subAapXYZ"), loja())!.chave).toBe(vendaLoja({ ...marcador("subAapXYZ"), created_at: iso(T0 + 60_000) }, loja())!.chave);
    const mensal = loja({ billing_period: "monthly", current_period_start: iso(T0 - 30 * DIA), current_period_end: iso(Date.parse("2026-11-28T12:00:00Z")) });
    expect(vendaRenovacao(mensal, iso(T0))!.chave).toBe("renov:subAapXYZ:2026-11-28");
  });
});

/* -------------------------------------------------- Web Push de verdade */
async function decifrar(corpo: Uint8Array, uaPrivada: CryptoKey, uaPublica: Uint8Array, auth: Uint8Array): Promise<string> {
  const te = new TextEncoder();
  const salt = corpo.slice(0, 16);
  const idlen = corpo[20];
  const asPublica = corpo.slice(21, 21 + idlen);
  const cifrado = corpo.slice(21 + idlen);
  const h = async (k: Uint8Array, d: Uint8Array) => new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), d));
  const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
  const asChave = await crypto.subtle.importKey("raw", asPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asChave } as EcdhKeyDeriveParams, uaPrivada, 256));
  const ikm = (await h(await h(auth, ecdh), cat(te.encode("WebPush: info\0"), uaPublica, asPublica, new Uint8Array([1])))).slice(0, 32);
  const prk = await h(salt, ikm);
  const cek = (await h(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await h(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]), cifrado));
  expect(claro[claro.length - 1]).toBe(2);
  return new TextDecoder().decode(claro.slice(0, -1));
}

async function aparelho() {
  const par = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { par, pub, auth, insc: { endpoint: "https://web.push.apple.com/QAbc", p256dh: bytesParaB64url(pub), auth: bytesParaB64url(auth) } };
}
async function vapid() {
  const par = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  return { par, chaves: { publica: bytesParaB64url(pub), privada: String(jwk.d), subject: "mailto:contato@coreaplicativo.com.br" } };
}

describe("Web Push (VAPID + aes128gcm, só WebCrypto)", () => {
  it("o aparelho decifra a mensagem", async () => {
    const a = await aparelho();
    const corpo = await cifrarAes128gcm(JSON.stringify({ title: "💰 Venda · R$ 97,90 · Apple anual" }), a.insc.p256dh, a.insc.auth);
    expect(corpo.length).toBeGreaterThan(16 + 4 + 1 + 65 + 16);
    expect(JSON.parse(await decifrar(corpo, a.par.privateKey, a.pub, a.auth)).title).toBe("💰 Venda · R$ 97,90 · Apple anual");
  });
  it("JWT ES256 com aud = origem do endpoint, assinatura confere com a chave pública", async () => {
    const v = await vapid();
    const jwt = await jwtVapid("https://web.push.apple.com/QAbc", v.chaves.publica, v.chaves.privada, v.chaves.subject, 1_800_000_000);
    const [c, p, s] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(b64urlParaBytes(c)))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(new TextDecoder().decode(b64urlParaBytes(p)))).toEqual({ aud: "https://web.push.apple.com", exp: 1_800_000_000 + 43200, sub: "mailto:contato@coreaplicativo.com.br" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, v.par.publicKey, b64urlParaBytes(s), new TextEncoder().encode(`${c}.${p}`));
    expect(ok).toBe(true);
  });
  it("cabeçalhos do POST; 410 manda remover; a inscrição morta sai da tabela e a boa ganha ultimo_ok", async () => {
    const v = await vapid();
    const a = await aparelho();
    const pedidos: Array<{ url: string; init: RequestInit }> = [];
    const f = (async (url: string, init: RequestInit) => { pedidos.push({ url, init }); return new Response(null, { status: url.includes("morto") ? 410 : 201 }); }) as unknown as typeof fetch;
    const r = await enviarPush(a.insc, { title: "x" }, v.chaves, f);
    expect(r).toEqual({ ok: true, status: 201, remover: false });
    const h = pedidos[0].init.headers as Record<string, string>;
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(h.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${v.chaves.publica}$`));
    expect(h.TTL).toBe("86400");

    const ops: string[] = [];
    const tabela = [{ id: "a", ...a.insc, falhas: 0 }, { id: "b", ...a.insc, endpoint: "https://web.push.apple.com/morto", falhas: 0 }];
    const admin = { from: () => ({
      select: async () => ({ data: tabela }),
      update: () => ({ eq: async (_c: string, id: string) => { ops.push(`update ${id}`); } }),
      delete: () => ({ eq: async (_c: string, id: string) => { ops.push(`delete ${id}`); } }),
    }) };
    expect(await mandarParaTodos(admin, v.chaves, { title: "x" }, f)).toBe(1);
    expect(ops).toEqual(["update a", "delete b"]);
    expect(await mandarParaTodos(admin, null, { title: "x" }, f)).toBe(0);
  });
});

/* -------------------------------------------------- a migração */
describe("a migração 20261029010000_aviso_venda (PGlite, todas as migrações)", () => {
  let db: PGlite;
  let falhas: { arquivo: string; erro: string }[];
  const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  beforeAll(async () => {
    const c = await bancoComMigracoes();
    db = c.db; falhas = c.falhas;
    // o stub do pg_net passa a anotar as chamadas
    await db.exec(`CREATE TABLE net.chamadas (corpo jsonb);
      CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
        headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000) RETURNS bigint LANGUAGE sql AS $f$ INSERT INTO net.chamadas VALUES (body); SELECT 1::bigint $f$;`);
    await db.query(`insert into auth.users (id, email) values ($1, 'ana@x.com') on conflict do nothing`, [ANA]);
    // colunas que existem no banco de produção mas foram criadas fora do histórico de migrações (painel do Lovable)
    await db.exec(`ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pix';
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount_cents integer;
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS customer_email text;
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_period text;`);
  }, 120_000);
  const chamadas = async () => (await db.query<{ corpo: { fonte: string } }>(`select corpo from net.chamadas`)).rows.map((r) => r.corpo.fonte);

  it("roda inteira", () => {
    expect(falhas.filter((f) => f.arquivo.startsWith("20261029010000"))).toEqual([]);
  });
  it("push_dono e venda_avisada: RLS ligada, anon e usuário logado não leem nem gravam", async () => {
    for (const t of ["push_dono", "venda_avisada"]) {
      const rls = await db.query<{ r: boolean }>(`select relrowsecurity r from pg_class where relname = $1`, [t]);
      expect(rls.rows[0].r).toBe(true);
      for (const como of [(fn: () => Promise<unknown>) => comoAnon(db, fn), (fn: () => Promise<unknown>) => comoUsuario(db, ANA, fn)]) {
        const ler = await como(() => db.query(`select * from public.${t}`).then(() => "ok", (e) => (e as Error).message));
        expect(ler).toMatch(/permission denied/);
      }
    }
    const gravar = await comoUsuario(db, ANA, () => db.query(`insert into public.push_dono (endpoint, p256dh, auth) values ('https://x/1','a','b')`).then(() => "ok", (e) => (e as Error).message));
    expect(gravar).toMatch(/permission denied/);
  });
  it("gatilhos: Pix ativo com valor chama; inativo não; inativo → ativo chama; teste grátis da loja não chama", async () => {
    await db.exec(`delete from net.chamadas`);
    await db.query(`insert into public.subscriptions (user_id, status, payment_method, amount_cents, abacatepay_billing_id) values ($1, 'inactive', 'pix', 2790, 'pay_1')`, [ANA]);
    expect(await chamadas()).toEqual([]);
    await db.query(`update public.subscriptions set status = 'active' where abacatepay_billing_id = 'pay_1'`);
    expect(await chamadas()).toEqual(["pix"]);
    // a mesma linha atualizada sem pedido novo (ex.: vincular a outra conta) não avisa de novo
    await db.query(`update public.subscriptions set customer_email = 'ana@x.com' where abacatepay_billing_id = 'pay_1'`);
    expect(await chamadas()).toEqual(["pix"]);
    // upsell com linha nova já ativa; pedido novo na linha própria
    await db.query(`insert into public.subscriptions (user_id, status, payment_method, amount_cents, abacatepay_billing_id) values ($1, 'active', 'pix', 1990, 'pay_up')`, [ANA]);
    await db.query(`update public.subscriptions set abacatepay_billing_id = 'pay_1b' where abacatepay_billing_id = 'pay_1'`);
    expect(await chamadas()).toEqual(["pix", "pix", "pix"]);
    await db.exec(`delete from net.chamadas`);
    // teste grátis do iPhone nasce ativo com preço cheio: não chama
    await db.query(`insert into public.subscriptions (user_id, status, payment_method, amount_cents, billing_period, revenuecat_subscription_id, current_period_start, current_period_end)
      values ($1, 'active', 'play_store', 9790, 'annual', 'subAapT', now(), now() + interval '3 days')`, [ANA]);
    expect(await chamadas()).toEqual([]);
    // a cobrança do teste (3 d → 1 ano) não é "renovação"
    await db.query(`update public.subscriptions set current_period_end = current_period_start + interval '368 days' where revenuecat_subscription_id = 'subAapT'`);
    expect(await chamadas()).toEqual([]);
    // a renovação do ano seguinte é
    await db.query(`update public.subscriptions set current_period_end = current_period_end + interval '365 days' where revenuecat_subscription_id = 'subAapT'`);
    expect(await chamadas()).toEqual(["renovacao"]);
  });
  it("marcador da cobrança confirmada chama; o do teste grátis e eventos comuns não", async () => {
    await db.exec(`delete from net.chamadas`);
    await db.query(`insert into public.analytics_events (event_name, event_data) values ('meta_capi_trial_enviado', '{"tx":"subAapT"}'), ('app_device_info', '{}')`);
    expect(await chamadas()).toEqual([]);
    await db.query(`insert into public.analytics_events (event_name, event_data) values ('meta_capi_app_enviado', '{"tx":"subAapT","valor":97.9}')`);
    expect(await chamadas()).toEqual(["loja"]);
  });
  it("se o pg_net falhar, a venda grava do mesmo jeito", async () => {
    // e se faltar uma coluna (surpresa no banco), também
    await db.exec(`CREATE TABLE public.subs_sem_colunas (id uuid DEFAULT gen_random_uuid(), status text);
      CREATE TRIGGER t AFTER INSERT ON public.subs_sem_colunas FOR EACH ROW EXECUTE FUNCTION public.avisar_venda_subscriptions();`);
    await db.query(`insert into public.subs_sem_colunas (status) values ('active')`);
    await db.exec(`CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
        headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000) RETURNS bigint LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'fora do ar'; END $f$;`);
    await db.query(`insert into public.subscriptions (user_id, status, payment_method, amount_cents, abacatepay_billing_id) values ($1, 'active', 'pix', 2790, 'pay_2')`, [ANA]);
    const r = await db.query(`select 1 from public.subscriptions where abacatepay_billing_id = 'pay_2'`);
    expect(r.rows.length).toBe(1);
  });
});

/* -------------------------------------------------- PWA isolada */
describe("a PWA do /vendas não encosta no app dos clientes", () => {
  it("manifest próprio: CORE Vendas, start_url/scope/id no /vendas, ícones do CORE", () => {
    const m = JSON.parse(ler("public/vendas/manifest.json"));
    expect(m).toMatchObject({ name: "CORE Vendas", short_name: "CORE", start_url: "/vendas", scope: "/vendas", id: "/vendas", display: "standalone" });
    expect(m.icons.map((i: { src: string }) => i.src)).toEqual(["/icon-192.png", "/icon-512.png"]);
  });
  it("só o vendas.html linka esse manifest; o app segue com o dele", () => {
    expect(ler("vendas.html")).toContain('<link rel="manifest" href="/vendas/manifest.json" />');
    expect(ler("vendas.html")).not.toContain("/src/main.tsx");
    for (const p of ["index.html", "landing.html", "missao.html"]) expect(ler(p)).not.toContain("/vendas/manifest.json");
    expect(ler("index.html")).toContain('<link rel="manifest" href="/manifest.json" />');
  });
  it("o SW do /vendas só trata push e clique: sem fetch, sem cache, abre só o /vendas", () => {
    const sw = ler("public/vendas/sw.js").replace(/\/\/.*$/gm, "");
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).not.toMatch(/addEventListener\("fetch"/);
    expect(sw).not.toMatch(/caches\./);
    expect(sw).toContain("showNotification");
  });
  it("o kill-switch da raiz não mudou e a limpeza do main.tsx poupa SÓ o registro do /vendas", () => {
    const raiz = ler("public/sw.js");
    expect(raiz).toContain("self.registration.unregister()");
    expect(raiz).toContain("caches.delete");
    const main = ler("src/main.tsx");
    expect(main).toContain("regs.forEach((r) => { if (!ehSwDoAvisoDeVenda(r.scope)) r.unregister(); })");
    expect(ehSwDoAvisoDeVenda("https://coreaplicativo.com.br/vendas")).toBe(true);
    expect(ehSwDoAvisoDeVenda("https://coreaplicativo.com.br/vendas/")).toBe(true);
    for (const e of ["https://coreaplicativo.com.br/", "https://coreaplicativo.com.br/vendasx", "https://coreaplicativo.com.br/app/vendas", "", null]) expect(ehSwDoAvisoDeVenda(e)).toBe(false);
  });
  it("vercel: /vendas → vendas.html; sw.js como JS, sem cache, com Service-Worker-Allowed só /vendas", () => {
    const cfg = JSON.parse(ler("vercel.json")) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>; rewrites: Array<{ source: string; destination: string }> };
    const rw = cfg.rewrites.map((r) => `${r.source}→${r.destination}`);
    expect(rw).toContain("/vendas→/vendas.html");
    expect(rw).toContain("/vendas/→/vendas.html");
    expect(rw.indexOf("/vendas→/vendas.html")).toBeLessThan(rw.indexOf("/(.*)→/index.html"));
    const sw = Object.fromEntries((cfg.headers.find((h) => h.source === "/vendas/sw.js")?.headers ?? []).map((h) => [h.key, h.value]));
    expect(sw["Content-Type"]).toMatch(/^application\/javascript/);
    expect(sw["Cache-Control"]).toMatch(/no-cache/);
    expect(sw["Service-Worker-Allowed"]).toBe("/vendas");
    expect(ler("vite.config.ts")).toContain('vendas: path.resolve(__dirname, "vendas.html")');
  });
  it("a chave PRIVADA do VAPID nunca vai pro front", () => {
    const front = ["src/vendas/VendasApp.tsx", "src/vendas/push.ts", "src/vendas/escopo.ts", "vendas.html"].map(ler).join("\n");
    expect(front).not.toMatch(/VAPID_PRIVATE|privada/i);
    expect(front).toContain("import.meta.env.VITE_VAPID_PUBLIC_KEY");
  });
});
