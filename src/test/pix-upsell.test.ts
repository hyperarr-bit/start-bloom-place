/**
 * O PIX DE UPSELL DE 24 H, UM POR COMPRA (31/10) — supabase/functions/_shared/pix-upsell.ts com banco falso, + leitura da
 * fonte das 3 funções da Asaas (asaas-pix, asaas-webhook, pix-reconcile) e do e-mail de compra confirmada.
 *   · u2027/pv149 = 24 h; o vitalício, os LN_*, o w27 = 30 min (como sempre);
 *   · 1 Pix por chave: a 2ª chamada devolve o MESMO; a corrida página × e-mail dá 1 QR só; dono = a conta final;
 *   · META_PURCHASE_UPSELL = false: nos 3 caminhos o upsell só manda a UTMify;
 *   · preço 19,90; o bloco do e-mail só com a chave + LN_* + sem o pacote, depois dos 3 passos de "Como entrar".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPIRA_PADRAO_S, EXPIRA_UPSELL_S, META_PURCHASE_UPSELL, PRECO_U2027_CENTAVOS, REUSO_MIN_MS, avisarPronto2027, blocoLigado, blocoU2027,
  chavePixUpsell, chaveU2027, compraDoUpsell, expiraSegundos, garantirPixUpsell, htmlBlocoU2027, htmlPronto2027, linkU2027, mandaPurchaseMeta, sessaoPodePedir,
  blocoFoiProEmail, chaveBlocoNoEmail, consultarUpsellAgora, donoNaHora, registrarDobro2027, validadeNoEmail, ehDobro2027, NOTA_ONDE_EMAIL, TETO_BLOCO_MS,
  type CriarQr,
} from "../../supabase/functions/_shared/pix-upsell";
import { PRECOS_HOJE } from "../../supabase/functions/_shared/ofertas-hoje";
import { htmlVenda } from "../../supabase/functions/_shared/email-venda";
import { VALOR_U2027, voltaDoEmailU2027 } from "@/landing/regras";
import { VALOR_2027 } from "@/lib/upsell-2027";

/* ───────── banco falso: tabelas como listas, filtros eq/contains, select/insert/update/delete ───────── */
type Linha = Record<string, unknown>;
function bancoFalso(inicial: Record<string, Linha[]> = {}, opts: { falharPonte?: boolean } = {}) {
  const t: Record<string, Linha[]> = { webhook_events: [], analytics_events: [], subscriptions: [], user_data: [], ...inicial };
  const confere = (l: Linha, f: Array<[string, string, unknown]>) => f.every(([op, c, v]) => {
    if (op === "eq") return l[c] === v;
    if (op === "contains") return Object.entries(v as Linha).every(([k, x]) => (l[c] as Linha | undefined)?.[k] === x);
    return true;
  });
  const admin = {
    from: (nome: string) => {
      const tab = (t[nome] ??= []);
      const f: Array<[string, string, unknown]> = [];
      let op: "select" | "update" | "delete" = "select";
      let patch: Linha = {};
      let comSelect = false;
      const exec = () => {
        if (op === "select") return { data: tab.filter((l) => confere(l, f)), error: null };
        if (op === "update") { const hit = tab.filter((l) => confere(l, f)); hit.forEach((l) => Object.assign(l, patch)); return { data: comSelect ? hit.map((l) => ({ id: l.id })) : null, error: null }; }
        const fica = tab.filter((l) => !confere(l, f)); const n = tab.length - fica.length; tab.splice(0, tab.length, ...fica); return { data: null, error: null, n };
      };
      const q: Record<string, unknown> = {
        select: () => { if (op === "update") comSelect = true; return q; },
        eq: (c: string, v: unknown) => { f.push(["eq", c, v]); return q; },
        contains: (c: string, v: unknown) => { f.push(["contains", c, v]); return q; },
        limit: () => q,
        maybeSingle: async () => { const r = exec(); return { data: (r.data as Linha[])[0] ?? null, error: null }; },
        update: (p: Linha) => { op = "update"; patch = p; return q; },
        delete: () => { op = "delete"; return q; },
        insert: async (l: Linha) => {
          if (nome === "analytics_events" && opts.falharPonte) return { error: { message: "x" } };
          if (nome === "webhook_events" && tab.some((x) => x.id === l.id)) return { error: { code: "23505" } };
          tab.push({ ...l }); return { error: null };
        },
        then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, ko),
      };
      return q;
    },
  };
  return { admin, t };
}

const AGORA = Date.parse("2026-10-31T15:00:00Z");
function qrFalso() {
  let n = 0;
  const chamadas: Array<Parameters<CriarQr>[0]> = [];
  const criar: CriarQr = async (a) => { chamadas.push(a); n++; return { id: `qr_u27_${n}`, payload: `00020101021226870014br.gov.bcb.pix2565qrcode.exemplo/${n}5204000053039865405${(a.valorCentavos / 100).toFixed(2)}5802BR6304ABCD`, encodedImage: "iVBORw0K", expirationDate: null }; };
  return { criar, chamadas };
}
const semEspera = async () => {};

describe("a validade: upsell 24 h, o resto 30 min (o vitalício não muda)", () => {
  it("u2027 e pv149 = 86400; LN_*, w27, lifetime, h279, hv47 = 1800", () => {
    expect(EXPIRA_UPSELL_S).toBe(86_400);
    expect(EXPIRA_PADRAO_S).toBe(1800);
    for (const o of ["u2027", "pv149"]) expect(expiraSegundos(o)).toBe(86_400);
    for (const o of ["LN_sempre279", "LN_ano279", "LN_anosempre478", "w27", "lifetime", "h279", "hv47", "pk99", "", null]) expect(expiraSegundos(o as string)).toBe(1800);
  });
  it("crítica r1: o create ANTIGO do asaas-pix (o /hoje e o /inicio, no ar) segue em 30 min pra TODA oferta — as 24 h são só do garantirPixUpsell", () => {
    const s = readFileSync(join(__dirname, "../../supabase/functions/asaas-pix/index.ts"), "utf8");
    expect(s).not.toMatch(/EXPIRA_SEGUNDOS/);
    expect(s).not.toMatch(/expiraSegundos\(offer\)/);
    expect(s).toMatch(/expiraSegundos: EXPIRA_PADRAO_S, ref: `\$\{user\.id\}:\$\{offer\}`/);
    expect(s).toMatch(/from "\.\.\/_shared\/asaas-qr\.ts"/);
    const qr = readFileSync(join(__dirname, "../../supabase/functions/_shared/asaas-qr.ts"), "utf8");
    expect(qr).toMatch(/expirationSeconds: a\.expiraSegundos/);
    expect(qr).toMatch(/allowsMultiplePayments: false/);
  });
});

describe("o preço: R$ 19,90 nos 3 lugares", () => {
  it("servidor 1990 = página da landing 19,90 = /inicio e /hoje 19,90", () => {
    expect(PRECOS_HOJE.u2027).toBe(1990);
    expect(PRECO_U2027_CENTAVOS).toBe(1990);
    expect(VALOR_U2027).toBe(19.9);
    expect(VALOR_2027).toBe(19.9);
  });
});

describe("garantirPixUpsell: 1 Pix por chave", () => {
  const args = (criarQr: CriarQr, dono = "conta-final", agora = AGORA) => ({
    chave: chaveU2027("qr_vitalicio_1"), dono, oferta: "u2027", valorCentavos: 1990, descricao: "CORE seu 2027", criarQr,
    agora: () => agora, esperar: semEspera,
  });

  it("1ª chamada cria (24 h, pix_order_created com user_id = dono); a 2ª devolve o MESMO sem criar outro", async () => {
    const { admin, t } = bancoFalso();
    const qr = qrFalso();
    const a = await garantirPixUpsell(admin, args(qr.criar));
    expect("erro" in a).toBe(false);
    if ("erro" in a) return;
    expect(a).toMatchObject({ orderId: "qr_u27_1", novo: true, dono: "conta-final" });
    expect(a.qrCodeBase64).toMatch(/^data:image\/png;base64,/);
    expect(Date.parse(a.expiresAt) - AGORA).toBe(86_400_000);
    expect(qr.chamadas[0]).toMatchObject({ valorCentavos: 1990, expiraSegundos: 86_400 });
    const ponte = t.analytics_events.find((l) => l.event_name === "pix_order_created")!;
    expect(ponte).toMatchObject({ user_id: "conta-final", event_data: { order_id: "qr_u27_1", offer: "u2027", amount_cents: 1990 } });
    const b = await garantirPixUpsell(admin, args(qr.criar, "conta-final", AGORA + 3600e3));
    expect(b).toMatchObject({ orderId: "qr_u27_1", qrCode: a.qrCode, novo: false });
    expect(qr.chamadas).toHaveLength(1);
    expect(t.analytics_events.filter((l) => l.event_name === "pix_order_created")).toHaveLength(1);
    expect(t.webhook_events.map((l) => l.id)).toEqual([chavePixUpsell("u2027:qr_vitalicio_1")]);
  });

  it("corrida (página pré-aquecendo × webhook montando o e-mail ao mesmo tempo) = 1 QR só, os dois com o mesmo código", async () => {
    const { admin } = bancoFalso();
    let solta!: () => void;
    const portao = new Promise<void>((ok) => { solta = ok; });
    let n = 0;
    const lento: CriarQr = async (a) => { n++; await portao; return { id: `qr_corrida_${n}`, payload: `000201corrida${n}xxxxxxxxxxxxxxxxxxxxxxxx`, expirationDate: null, valor: a.valorCentavos } as never; };
    const esperar = async () => { solta(); await new Promise((ok) => setTimeout(ok, 5)); };
    const [p1, p2] = await Promise.all([
      garantirPixUpsell(admin, { ...args(lento), esperar }),
      garantirPixUpsell(admin, { ...args(lento), esperar }),
    ]);
    expect(n).toBe(1);
    expect("orderId" in p1 && "orderId" in p2 && p1.orderId === p2.orderId).toBe(true);
  });

  it("guardado com menos de 2 h, ou de outro dono, não é reaproveitado (cria outro)", async () => {
    const { admin } = bancoFalso();
    const qr = qrFalso();
    await garantirPixUpsell(admin, args(qr.criar));
    const quaseVencido = await garantirPixUpsell(admin, args(qr.criar, "conta-final", AGORA + 86_400_000 - REUSO_MIN_MS + 1000));
    expect(quaseVencido).toMatchObject({ orderId: "qr_u27_2", novo: true });
    const outroDono = await garantirPixUpsell(admin, args(qr.criar, "outra-conta", AGORA + 86_400_000 - REUSO_MIN_MS + 2000));
    expect(outroDono).toMatchObject({ orderId: "qr_u27_3", dono: "outra-conta" });
  });

  it("QR falhou → erro e a reserva sai (a próxima tenta); ponte falhou → erro, sem QR entregue", async () => {
    const { admin, t } = bancoFalso();
    const r = await garantirPixUpsell(admin, args(async () => null));
    expect(r).toEqual({ erro: "qr" });
    expect(t.webhook_events).toHaveLength(0);
    const b2 = bancoFalso({}, { falharPonte: true });
    expect(await garantirPixUpsell(b2.admin, args(qrFalso().criar))).toEqual({ erro: "ponte" });
    expect(b2.t.webhook_events).toHaveLength(0);
  });
});

describe("de quem é o 2027 desta compra (a conta FINAL)", () => {
  const reg = (uid: string, oferta = "LN_sempre279") => ({ event_name: "pix_order_created", user_id: uid, event_data: { order_id: "qr_vit_9", offer: oferta } });
  it("a linha do vitalício foi levada pra conta de destino → o dono é a de destino; a anônima que pagou pode pedir", async () => {
    const { admin } = bancoFalso({ analytics_events: [reg("anonima")], subscriptions: [{ user_id: "destino", status: "active", abacatepay_billing_id: "qr_vit_9" }] });
    const c = await compraDoUpsell(admin, "qr_vit_9");
    expect(c).toMatchObject({ ok: true, dono: "destino", pagador: "anonima", jaTemPacote: false });
    if (!c.ok) return;
    expect(sessaoPodePedir(c, "anonima")).toBe(true);
    expect(sessaoPodePedir(c, "destino")).toBe(true);
    expect(sessaoPodePedir(c, "intrusa")).toBe(false);
  });
  it("só compra da landing (LN_*), com linha viva; já tem o pacote → jaTemPacote", async () => {
    expect(await compraDoUpsell(bancoFalso({ analytics_events: [reg("a", "h279")] }).admin, "qr_vit_9")).toEqual({ ok: false, motivo: "oferta" });
    expect(await compraDoUpsell(bancoFalso({ analytics_events: [reg("a")] }).admin, "qr_vit_9")).toEqual({ ok: false, motivo: "sem_linha" });
    expect(await compraDoUpsell(bancoFalso().admin, "qr_vit_9")).toEqual({ ok: false, motivo: "sem_compra" });
    expect(await compraDoUpsell(bancoFalso({ analytics_events: [reg("a"), reg("b")] }).admin, "qr_vit_9")).toEqual({ ok: false, motivo: "sem_compra" }); // forjada
    const comPacote = bancoFalso({
      analytics_events: [reg("a")], subscriptions: [{ user_id: "a", status: "active", abacatepay_billing_id: "qr_vit_9" }],
      user_data: [{ user_id: "a", key: "core-pacote-2027", value: { comprado: true } }],
    });
    expect(await compraDoUpsell(comPacote.admin, "qr_vit_9")).toMatchObject({ ok: true, jaTemPacote: true });
  });
  it("o create u2027 com `compra` no asaas-pix: confere a compra, a sessão, o pacote, e responde pelo garantirPixUpsell com dono_igual", () => {
    const s = readFileSync(join(__dirname, "../../supabase/functions/asaas-pix/index.ts"), "utf8");
    const i = s.indexOf('if (eh2027(offer) && typeof body.compra === "string"');
    expect(i).toBeGreaterThan(0);
    const bloco = s.slice(i, i + 2600);
    expect(bloco).toMatch(/compraDoUpsell\(supabaseAdmin, compra\)/);
    expect(bloco).toMatch(/sessaoPodePedir\(c, user\.id\)/);
    expect(bloco).toMatch(/ja_tem_2027: true/);
    expect(bloco).toMatch(/chave: chaveU2027\(compra\), dono: c\.dono/);
    expect(bloco).toMatch(/dono_igual: c\.dono === user\.id/);
    expect(bloco).not.toMatch(/sendMetaCapi|markPixPurchasePending/);
  });
});

describe("pixel: o upsell NÃO manda Purchase pra Meta (recomendação, confirmar com o dono) — só a UTMify", () => {
  it("a chave é false; o vitalício e os planos continuam mandando", () => {
    expect(META_PURCHASE_UPSELL).toBe(false);
    expect(mandaPurchaseMeta("u2027")).toBe(false);
    expect(mandaPurchaseMeta("pv149")).toBe(false);
    for (const o of ["LN_sempre279", "w27", "h279", "hv47", "lifetime"]) expect(mandaPurchaseMeta(o)).toBe(true);
  });
  it("nos 3 caminhos (check, webhook, reconcile) o CAPI do u2027 e do pv149 passa pela chave; a UTMify continua", () => {
    const fonte = (f: string) => readFileSync(join(__dirname, `../../supabase/functions/${f}/index.ts`), "utf8");
    const pix = fonte("asaas-pix");
    const doU2027 = pix.slice(pix.indexOf("if (eh2027(offer)) {"), pix.indexOf("const concessao = CONCESSAO[offer];"));
    expect(doU2027).toMatch(/sendToUtmify[\s\S]*if \(mandaPurchaseMeta\(offer\)\) await sendMetaCapi/);
    const doPresente = pix.slice(pix.indexOf("if (ehOfertaPresente(offer)) {\n        const presente"), pix.indexOf("if (ehOfertaPlano30(offer)) {\n        const lib"));
    expect(doPresente).toMatch(/if \(mandaPurchaseMeta\(offer\)\) await sendMetaCapi/);
    const wh = fonte("asaas-webhook");
    const whU = wh.slice(wh.indexOf("if (eh2027(offer) && valorCobre"), wh.indexOf("/* 16/10: oferta desconhecida"));
    expect(whU).toMatch(/sendToUtmify[\s\S]*if \(mandaPurchaseMeta\(offer\)\) await sendMetaCapi/);
    const whP = wh.slice(wh.indexOf("if (ehOfertaPresente(offer) && valorCobre"), wh.indexOf("/* 21/10 (downsell do presente, pk99)"));
    expect(whP).toMatch(/if \(mandaPurchaseMeta\(offer\)\) await sendMetaCapi/);
    const rc = fonte("pix-reconcile");
    // crítica r1: sem Meta, o reconcile manda a UTMify (a trava `capi` dele fica tomada; senão a venda some do painel)
    expect(rc).toMatch(/if \(!mandaPurchaseMeta\("u2027"\)\) \{\s*capi = await utmifyUpsell\(admin, \{[^}]*offer: "u2027"/);
    expect(rc).toMatch(/capi = mandaPurchaseMeta\("pv149"\) \? await capiPresente\(o, email, cents\)\s*: await utmifyUpsell\(admin, \{[^}]*offer: "pv149"/);
  });
  it("o e-mail \"Pronto\" sai 1x por pedido nos 3 caminhos (trava u2027-email:<pedido>; solta se o envio falhar)", async () => {
    const { admin, t } = bancoFalso();
    const enviados: string[] = [];
    let falha = true;
    const enviar = async (para: string) => { if (falha) return false; enviados.push(para); return true; };
    expect(await avisarPronto2027(admin, { orderId: "qr_u27_1", para: "maria@email.com", enviar })).toBe(false);
    expect(t.webhook_events).toHaveLength(0); // soltou
    falha = false;
    expect(await avisarPronto2027(admin, { orderId: "qr_u27_1", para: "maria@email.com", enviar })).toBe(true);
    expect(await avisarPronto2027(admin, { orderId: "qr_u27_1", para: "maria@email.com", enviar })).toBe(false);
    expect(enviados).toHaveLength(1);
    expect(await avisarPronto2027(admin, { orderId: "qr_u27_2", para: null, enviar })).toBe(false);
    for (const f of ["asaas-pix", "asaas-webhook", "pix-reconcile"]) expect(readFileSync(join(__dirname, `../../supabase/functions/${f}/index.ts`), "utf8")).toMatch(/avisarPronto2027\(/);
    const h = htmlPronto2027({ email: "maria@email.com" });
    expect(h).toContain("Pronto, seu 2027 tá no seu CORE.");
    expect(h).not.toContain("Dev. Pessoal");
    expect(h).toContain("módulo <b style=\"color:#16121c;\">Desenvolvimento Pessoal</b>, aba <b style=\"color:#16121c;\">Seu 2027</b>");
    expect(h).toContain("no site (coreaplicativo.com.br) e no app do iPhone"); // crítica r1: o Android da loja ainda não tem a aba
    expect(h).not.toMatch(/no app e no site/);
    expect(h).toMatch(/App Store[\s\S]*Google Play/);
  });
});

describe("B. o bloco do 2027 no e-mail de compra confirmada", () => {
  const banco = () => bancoFalso();
  it("chave off (sem o secret) = nada; on = o bloco com o MESMO código da página (u2027:<compra>)", async () => {
    expect(blocoLigado(undefined)).toBe(false);
    expect(blocoLigado("off")).toBe(false);
    expect(blocoLigado("on")).toBe(true);
    const { admin } = banco();
    const qr = qrFalso();
    expect(await blocoU2027(admin, { ligado: false, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: qr.criar })).toBe("");
    expect(qr.chamadas).toHaveLength(0);
    const html = await blocoU2027(admin, { ligado: true, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: qr.criar });
    expect(html).toContain("Quer o seu 2027 organizado?");
    expect(html).not.toContain("já organizado");
    expect(html).not.toContain("orçamento do ano");
    expect(html).toContain("quanto gastar e guardar por mês");
    expect(html).toContain("R$ 19,90, uma vez");
    expect(html).toContain("Vale por 24 h.");
    expect(html).toContain("Pagou? A gente avisa por e-mail quando cair.");
    expect(html).toContain("Abrir o Pix");
    // a página pede o Pix da mesma compra → o MESMO código
    const pagina = await garantirPixUpsell(admin, { chave: chaveU2027("qr_vit_1"), dono: "u1", oferta: "u2027", valorCentavos: 1990, descricao: "x", criarQr: qr.criar });
    expect("qrCode" in pagina && html.includes(pagina.qrCode)).toBe(true);
    expect(qr.chamadas).toHaveLength(1);
  });
  it("só LN_*; conta que já tem o pacote = nada", async () => {
    const { admin } = bancoFalso({ user_data: [{ user_id: "u1", key: "core-pacote-2027", value: { comprado: true } }] });
    const qr = qrFalso();
    expect(await blocoU2027(admin, { ligado: true, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: qr.criar })).toBe("");
    expect(await blocoU2027(bancoFalso().admin, { ligado: true, compra: "qr_vit_1", dono: "u1", offer: "h279", criarQr: qr.criar })).toBe("");
    expect(qr.chamadas).toHaveLength(0);
  });
  it("o link reabre o mesmo Pix na /organizar (a página entende: voltaDoEmailU2027)", () => {
    const pix = { orderId: "qr_u27_1", qrCode: "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo/1520400005303986", expiresAt: new Date(AGORA + 86_400_000).toISOString() };
    const link = linkU2027({ compra: "qr_vit_1", pix });
    expect(link).toMatch(/^https:\/\/www\.coreaplicativo\.com\.br\/organizar\?r=u2027&/);
    const v = voltaDoEmailU2027(new URL(link).searchParams, AGORA);
    expect(v).toMatchObject({ compra: "qr_vit_1", pix: { orderId: "qr_u27_1", qrCode: pix.qrCode, doEmail: true } });
    expect(voltaDoEmailU2027(new URL(link).searchParams, AGORA + 86_400_000)?.pix).toBeNull(); // vencido: a página mostra a oferta
  });
  it("no e-mail: o 'No app, toque em Entrar' (03/11) fica igual e vêm ANTES do bloco; 'No computador' depois; sem extra = igual a antes", () => {
    const pix = { orderId: "qr_u27_1", qrCode: "000201abc", expiresAt: new Date(AGORA + 86_400_000).toISOString() };
    const bloco = htmlBlocoU2027({ compra: "qr_vit_1", pix });
    const semBloco = htmlVenda({ email: "maria@email.com", periodo: "lifetime", hoje: true });
    const comBloco = htmlVenda({ email: "maria@email.com", periodo: "lifetime", hoje: true, extra: bloco });
    expect(comBloco.replace(bloco, "")).toBe(semBloco);
    const i = comBloco.indexOf('data-bloco="u2027"');
    expect(comBloco.indexOf('data-bloco="entrar"')).toBeLessThan(i); // 03/11: os passos viraram o bloco "No app, toque em Entrar"
    expect(comBloco.indexOf("Entrar sem senha")).toBeLessThan(i);
    expect(comBloco.indexOf('data-bloco="guia"')).toBeLessThan(i); // 03/11: o guia em PDF no lugar do "Passo a passo"
    expect(comBloco.indexOf("No computador")).toBeGreaterThan(i);
  });
  it("os 4 lugares que mandam o e-mail da compra da landing passam o bloco", () => {
    const pix = readFileSync(join(__dirname, "../../supabase/functions/asaas-pix/index.ts"), "utf8");
    expect(pix.match(/blocoDoEmail\(/g)!.length).toBe(4); // check + boas_vindas + os 2 destinos (check e email_pedido)
    expect(pix).toMatch(/hoje: true, extra \}\)/);
    expect(pix).toMatch(/hoje: true, extra: await blocoDoEmail\(id, user\.id, offer\)/);
    const wh = readFileSync(join(__dirname, "../../supabase/functions/asaas-webhook/index.ts"), "utf8");
    expect(wh).toMatch(/const extra = await blocoDoEmail\(qrCodeId, userId, offer\)/);
    expect(wh).toMatch(/extra: \(dono\) => blocoDoEmail\(qrCodeId, dono, offer\)/);
    const dest = readFileSync(join(__dirname, "../../supabase/functions/_shared/destino-hoje.ts"), "utf8");
    expect(dest).toMatch(/const extra = args\.extra \? await args\.extra\(para\)/);
    const rc = readFileSync(join(__dirname, "../../supabase/functions/pix-reconcile/index.ts"), "utf8");
    expect(rc).toMatch(/extra: \(dono\) => blocoU2027\(admin/);
  });
});

describe("crítica r1 (31/10): os consertos do dinheiro", () => {
  it("a validade do e-mail sai do expiresAt de verdade (o reuso aceita a partir de 2 h)", () => {
    const agora = Date.parse("2026-10-31T15:00:00Z"); // 12h de Brasília
    expect(validadeNoEmail(new Date(agora + 24 * 3600e3).toISOString(), agora)).toBe("Vale por 24 h.");
    expect(validadeNoEmail(new Date(agora + 23.5 * 3600e3).toISOString(), agora)).toBe("Vale por 24 h.");
    expect(validadeNoEmail(new Date(agora + 6 * 3600e3).toISOString(), agora)).toBe("Vale até hoje, 18h.");
    expect(validadeNoEmail(new Date(agora + 21.5 * 3600e3).toISOString(), agora)).toBe("Vale até amanhã, 9h30.");
    const pix = { orderId: "qr_u27_1", qrCode: "000201abc", expiresAt: new Date(agora + 3 * 3600e3).toISOString() };
    const html = htmlBlocoU2027({ compra: "qr_vit_1", pix, agora });
    expect(html).toContain("Vale até hoje, 15h.");
    expect(html).not.toContain("Vale por 24 h.");
  });
  it("'o código também foi pro seu e-mail' só com a marca do bloco montado (u2027-email-bloco:<compra>)", async () => {
    const { admin, t } = bancoFalso();
    const qr = qrFalso();
    expect(await blocoFoiProEmail(admin, "qr_vit_1")).toBe(false);
    await blocoU2027(admin, { ligado: false, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: qr.criar });
    expect(await blocoFoiProEmail(admin, "qr_vit_1")).toBe(false);
    await blocoU2027(admin, { ligado: true, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: qr.criar });
    expect(t.webhook_events.some((l) => l.id === chaveBlocoNoEmail("qr_vit_1"))).toBe(true);
    expect(await blocoFoiProEmail(admin, "qr_vit_1")).toBe(true);
    const pix = readFileSync(join(__dirname, "../../supabase/functions/asaas-pix/index.ts"), "utf8");
    expect(pix).toMatch(/const noEmail = blocoLigado\(Deno\.env\.get\(SECRET_U2027_EMAIL\)\) && await blocoFoiProEmail\(supabaseAdmin, compra\)/);
    expect(pix).toMatch(/no_email: noEmail/);
  });
  it("o crédito vai pra dona ATUAL da linha do vitalício (a compra mudou de conta depois do QR); sem `compra` = quem está no registro", async () => {
    const { admin } = bancoFalso({
      analytics_events: [{ event_name: "pix_order_created", user_id: "anonima", event_data: { order_id: "qr_vit_1", offer: "LN_sempre279" } }],
      subscriptions: [{ user_id: "conta-nova", status: "active", abacatepay_billing_id: "qr_vit_1" }],
    });
    expect(await donoNaHora(admin, { registrado: "conta-velha", compra: "qr_vit_1" })).toBe("conta-nova");
    expect(await donoNaHora(admin, { registrado: "conta-velha", compra: undefined })).toBe("conta-velha");
    expect(await donoNaHora(admin, { registrado: "conta-velha", compra: "qr_sem_linha" })).toBe("conta-velha");
    for (const f of ["asaas-pix", "asaas-webhook", "pix-reconcile"]) expect(readFileSync(join(__dirname, `../../supabase/functions/${f}/index.ts`), "utf8")).toMatch(/donoNaHora\(/);
  });
  it("o 2º pagamento do 2027 na mesma conta (outro QR vivo) vira evento + chamado de devolução, 1x por pedido; o mesmo pedido em 2 caminhos não", async () => {
    const { admin, t } = bancoFalso({ user_data: [{ user_id: "u1", key: "core-pacote-2027", value: { comprado: true, pedido: "qr_u27_1" } }] });
    (t as Record<string, unknown[]>).support_tickets = [];
    expect(await registrarDobro2027(admin, { userId: "u1", orderId: "qr_u27_1", amountCents: 1990 })).toBe(false);
    expect(await registrarDobro2027(admin, { userId: "u1", orderId: "qr_u27_2", amountCents: 1990 })).toBe(true);
    expect(await registrarDobro2027(admin, { userId: "u1", orderId: "qr_u27_2", amountCents: 1990 })).toBe(false);
    expect(t.analytics_events.filter((l) => l.event_name === "u2027_pago_em_dobro")).toHaveLength(1);
    const tk = (t as Record<string, Array<Record<string, unknown>>>).support_tickets;
    expect(tk).toHaveLength(1);
    expect(String(tk[0].message)).toContain("Pedido a devolver: qr_u27_2");
    for (const f of ["asaas-pix", "asaas-webhook"]) expect(readFileSync(join(__dirname, `../../supabase/functions/${f}/index.ts`), "utf8")).toMatch(/const dobro27 = p27\.r === "ja_tinha" && await ehDobro2027\([^)]*\);\s*if \(dobro27\) await registrarDobro2027\(/);
  });
  it("o reconcile: Pix de upsell pré-aquecido (com upsell_chave) é consultado sempre nas 2 primeiras horas, depois 1x por hora", () => {
    const criado = "2026-10-31T12:00:00Z";
    const t0 = Date.parse(criado);
    expect(consultarUpsellAgora(criado, false, t0 + 30 * 3600e3)).toBe(true); // /hoje, /inicio: como antes
    expect(consultarUpsellAgora(criado, true, t0 + 3600e3)).toBe(true);
    const depois = Array.from({ length: 16 }, (_, i) => consultarUpsellAgora(criado, true, t0 + 3 * 3600e3 + i * 900e3));
    expect(depois.filter(Boolean)).toHaveLength(4); // 4 horas, 4 consultas (era 16)
    const rc = readFileSync(join(__dirname, "../../supabase/functions/pix-reconcile/index.ts"), "utf8");
    // 06/11: na varredura quem faz isso agora é a agenda (_shared/pix-recuperacao.ts): 1x por hora, espalhado entre as passadas
    expect(rc).toMatch(/consultarNestaPassada\(/);
  });
  it("o check do u2027 confere o dono ANTES da Asaas (quem não é dono não gasta consulta)", () => {
    const pix = readFileSync(join(__dirname, "../../supabase/functions/asaas-pix/index.ts"), "utf8");
    const i = pix.indexOf('if (action === "check")');
    const trecho = pix.slice(i, pix.indexOf("const r = await buscarPagamento(apiKey, id);", i));
    expect(trecho).toMatch(/if \(eh2027\(String\(body\.offer \?\? ""\)\)\) \{[\s\S]*reg0\[0\]\.user_id !== user\.id\) return jsonResponse\(\{ paid: false, status: "MISMATCH" \}\)/);
  });
  it("a recomendação do pixel está escrita como recomendação (o dono ainda não confirmou)", () => {
    const s = readFileSync(join(__dirname, "../../supabase/functions/_shared/pix-upsell.ts"), "utf8");
    expect(s).not.toMatch(/DECISÃO DO DONO/);
    expect(s).toMatch(/CONFIRMAR COM O DONO/);
  });
});

describe("crítica r2 (31/10): dinheiro e honestidade", () => {
  it("o bloco do e-mail tem teto (a Asaas travada não segura o paid do vitalício): estourou → '' e sem a marca 'foi pro e-mail'", async () => {
    expect(TETO_BLOCO_MS).toBeLessThanOrEqual(5000);
    const { admin, t } = bancoFalso();
    const travado: CriarQr = () => new Promise(() => { /* a Asaas nunca responde */ });
    const ini = Date.now();
    const html = await blocoU2027(admin, { ligado: true, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: travado, tetoMs: 60 });
    expect(html).toBe("");
    expect(Date.now() - ini).toBeLessThan(1000);
    expect(t.webhook_events.some((l) => l.id === chaveBlocoNoEmail("qr_vit_1"))).toBe(false);
  });
  it("o bloco não espera a reserva da página 12 × 400 ms: 2 voltas e sai", async () => {
    const { admin } = bancoFalso({ webhook_events: [{ id: chavePixUpsell(chaveU2027("qr_vit_1")), source: "upsell", event: `reservando:${Date.now()}` }] });
    const qr = qrFalso();
    const esperas: number[] = [];
    const html = await blocoU2027(admin, { ligado: true, compra: "qr_vit_1", dono: "u1", offer: "LN_sempre279", criarQr: qr.criar, esperar: async (ms) => { esperas.push(ms); } });
    expect(html).toBe("");
    expect(esperas).toHaveLength(2);
    expect(qr.chamadas).toHaveLength(0);
  });
  it("o QR de upsell tem timeout de 4 s na Asaas (chave Pix e POST); o vitalício não muda", () => {
    const q = readFileSync(join(__dirname, "../../supabase/functions/_shared/asaas-qr.ts"), "utf8");
    expect(q).toMatch(/TIMEOUT_QR_UPSELL_MS = 4000/);
    expect(q).toMatch(/obterChavePix\(apiKey, log, sinalComTeto\(TIMEOUT_QR_UPSELL_MS\)\)/);
    expect(q).toMatch(/postarQrEstatico\(apiKey, chave, a, sinalComTeto\(TIMEOUT_QR_UPSELL_MS\)\)/);
  });
  it("o bloco: 'Já pagou o 2027 na página? Pode ignorar' acima do código e 'onde fica' antes de pagar (o Android não tem a aba)", () => {
    const h = htmlBlocoU2027({ compra: "qr_vit_1", pix: { orderId: "qr_u27_1", qrCode: "000201abc", expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString() } });
    expect(h).toContain("Já pagou o 2027 na página? Pode ignorar este bloco.");
    expect(h.indexOf("Já pagou o 2027 na página")).toBeLessThan(h.indexOf("000201abc"));
    expect(NOTA_ONDE_EMAIL).toBe("Por enquanto fica no site e no app do iPhone.");
    expect(h).toContain("É separado do CORE que você já pagou. Por enquanto fica no site e no app do iPhone.");
  });
  it("pagamento em dobro: ehDobro2027 só quando o pacote veio de OUTRO pedido; os 3 caminhos pulam o 'Pronto' nesse caso", async () => {
    const { admin } = bancoFalso({ user_data: [{ user_id: "u1", key: "core-pacote-2027", value: { comprado: true, pedido: "qr_u27_1" } }] });
    expect(await ehDobro2027(admin, { userId: "u1", orderId: "qr_u27_1" })).toBe(false);
    expect(await ehDobro2027(admin, { userId: "u1", orderId: "qr_u27_2" })).toBe(true);
    expect(await ehDobro2027(admin, { userId: "u2", orderId: "qr_u27_2" })).toBe(false);
    for (const f of ["asaas-pix", "asaas-webhook", "pix-reconcile"]) {
      const src = readFileSync(join(__dirname, `../../supabase/functions/${f}/index.ts`), "utf8");
      const i = src.indexOf("await ehDobro2027(");
      expect(i).toBeGreaterThan(0);
      const trecho = src.slice(i, src.indexOf("avisarPronto2027(", i) + 1);
      expect(trecho).toMatch(/registrarDobro2027\(/);
      expect(trecho).toMatch(/else \{/); // o "Pronto" só no else (não é dobro)
    }
  });
  it("o QR trocado (perto de vencer) fica em `anteriores` (até 3) — ainda pode ser pago", async () => {
    let agora = Date.parse("2026-10-31T12:00:00Z");
    const { admin, t } = bancoFalso();
    const qr = qrFalso();
    const pedir = () => garantirPixUpsell(admin, { chave: "pv149-d3:u1", dono: "u1", oferta: "pv149", valorCentavos: 1490, descricao: "x", criarQr: qr.criar, agora: () => agora });
    const a = await pedir();
    agora += 23 * 3600e3; // sobram < 2 h → troca
    const b = await pedir();
    expect("orderId" in a && "orderId" in b && a.orderId !== b.orderId).toBe(true);
    const linha = t.webhook_events.find((l) => l.id === chavePixUpsell("pv149-d3:u1"))!;
    expect(JSON.parse(String(linha.event)).anteriores).toEqual(["orderId" in a ? a.orderId : ""]);
  });
});
