/**
 * O PRESENTE NO DIA 3 (31/10) — supabase/functions/_shared/presente-dia3.ts com banco falso + leitura da fonte do cron
 * (pix-pendente-email), da função presente-resgatar e do medidor de uso (a demo da venda não conta como "entrou no app").
 *   · quem recebe: vitalício web (Pix, ativo, vitalício, com valor), 72–96 h, 9h–20h de Brasília, com e-mail, fora das
 *     contas de teste, entrou no app (uso 30 min ou mais depois da compra), nunca comprou presente, 1 vez só;
 *   · chave off (sem o secret PRESENTE_DIA3=on) = nada roda;
 *   · o e-mail: curto, sem gênero, sem "só hoje", sem brinde, sem código Pix (o link leva o TOKEN);
 *   · a página pelo token: o Pix pv149 de 24 h, 1 por conta (a 2ª abertura devolve o mesmo), pago → o código do cartão;
 *     o pedido de outra conta não vale; o webhook atrasado → confere na Asaas e cria o código (idempotente).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENTROU_DEPOIS_MS, JANELA_DIA3, TOKEN_VALIDO_MS, assuntoDia3, chaveEnvioDia3, chaveTokenDia3, dia3Ligado, donoDoToken, ehVitalicioWeb, estadoDia3,
  gerarToken, horaDeMandar, htmlDia3, linkDarPresente, motivoDia3, nomeDia3, previewDia3, tokenDoDono, tokenValido, varrerPresenteDia3,
} from "../../supabase/functions/_shared/presente-dia3";
import { EXPIRA_UPSELL_S, type CriarQr } from "../../supabase/functions/_shared/pix-upsell";
import type { RespostaDia3 } from "../../supabase/functions/_shared/presente-dia3";

const pedidoDe = (r: RespostaDia3): string | undefined => (r.ok === true && r.pago === false ? r.pix?.orderId : undefined);
import { ehDemoDaVenda } from "@/lib/caminho-demo";

/* ───────── banco falso (eq/gte/lte/contains, select/insert/update/delete) ───────── */
type Linha = Record<string, unknown>;
function bancoFalso(inicial: Record<string, Linha[]> = {}) {
  const t: Record<string, Linha[]> = { webhook_events: [], analytics_events: [], subscriptions: [], user_data: [], presentes: [], module_analytics: [], ...inicial };
  type F = [string, string, unknown];
  const confere = (l: Linha, f: F[]) => f.every(([op, c, v]) => {
    if (op === "eq") return l[c] === v;
    if (op === "is") return (l[c] ?? null) === v;
    if (op === "gte") return String(l[c]) >= String(v);
    if (op === "lte") return String(l[c]) <= String(v);
    if (op === "contains") return Object.entries(v as Linha).every(([k, x]) => (l[c] as Linha | undefined)?.[k] === x);
    return true;
  });
  const admin = {
    from: (nome: string) => {
      const tab = (t[nome] ??= []);
      const f: F[] = [];
      let op: "select" | "update" | "delete" = "select";
      let patch: Linha = {};
      let comSelect = false;
      const exec = () => {
        if (op === "select") return { data: tab.filter((l) => confere(l, f)), error: null };
        if (op === "update") { const hit = tab.filter((l) => confere(l, f)); hit.forEach((l) => Object.assign(l, patch)); return { data: comSelect ? hit.map((l) => ({ id: l.id, codigo: l.codigo })) : null, error: null }; }
        const fica = tab.filter((l) => !confere(l, f)); tab.splice(0, tab.length, ...fica); return { data: null, error: null };
      };
      const q: Record<string, unknown> = {
        select: () => { if (op === "update") comSelect = true; return q; },
        eq: (c: string, v: unknown) => { f.push(["eq", c, v]); return q; },
        is: (c: string, v: unknown) => { f.push(["is", c, v]); return q; },
        gte: (c: string, v: unknown) => { f.push(["gte", c, v]); return q; },
        lte: (c: string, v: unknown) => { f.push(["lte", c, v]); return q; },
        contains: (c: string, v: unknown) => { f.push(["contains", c, v]); return q; },
        limit: () => q,
        order: () => q,
        maybeSingle: async () => { const r = exec(); return { data: (r.data as Linha[])[0] ?? null, error: null }; },
        update: (p: Linha) => { op = "update"; patch = p; return q; },
        delete: () => { op = "delete"; return q; },
        insert: async (l: Linha) => {
          if (nome === "webhook_events" && tab.some((x) => x.id === l.id)) return { error: { code: "23505" } };
          if (nome === "presentes" && tab.some((x) => x.pedido === l.pedido)) return { error: { code: "23505" } };
          tab.push({ ...l }); return { error: null };
        },
        then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, ko),
      };
      return q;
    },
  };
  return { admin, t };
}

const H = 3600e3;
/** 31/10 15:00 UTC = 12:00 em Brasília (dentro das 9h–20h) */
const AGORA = Date.parse("2026-10-31T15:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const linhaVit = (uid: string, horasAtras: number, extra: Linha = {}): Linha => ({
  user_id: uid, created_at: iso(AGORA - horasAtras * H), status: "active", payment_method: "pix", billing_period: "lifetime", plan: "lifetime", amount_cents: 2790,
  current_period_end: "2126-10-28T00:00:00Z", abacatepay_billing_id: `ped_${uid}`, ...extra,
});
const uso = (uid: string, horasAtras: number): Linha => ({ user_id: uid, module_id: "financas", entered_at: iso(AGORA - horasAtras * H) });
let seq = 0;
const tokenFixo = () => `T${String(++seq).padStart(31, "x")}`;

function qrFalso() {
  let n = 0;
  const chamadas: Array<Parameters<CriarQr>[0]> = [];
  const criar: CriarQr = async (a) => { chamadas.push(a); n++; return { id: `qr_pv_${n}`, payload: `00020126pv149-${n}-5204000053039865405${(a.valorCentavos / 100).toFixed(2)}6304ABCD`, encodedImage: null, expirationDate: null }; };
  return { criar, chamadas };
}
const envioFalso = (ok = true) => {
  const enviados: Array<{ para: string; assunto: string; html: string; tags: Record<string, string> }> = [];
  return { enviados, enviar: async (para: string, assunto: string, html: string, tags: Record<string, string>) => { enviados.push({ para, assunto, html, tags }); return ok; } };
};
const contas: Record<string, { email: string | null; nome?: string | null }> = {
  ana: { email: "ana@exemplo.com.br", nome: "Ana Paula" }, bia: { email: "bia@exemplo.com.br" }, semmail: { email: null }, qa: { email: "qa+teste@exemplo.com.br" },
};
const conta = async (uid: string) => contas[uid] ?? { email: `${uid}@exemplo.com.br` };

describe("a chave e a janela", () => {
  it("o secret PRESENTE_DIA3 liga só com 'on' (sem o secret = off)", () => {
    expect(dia3Ligado("on")).toBe(true);
    for (const v of [undefined, null, "", "off", "ON", "1"]) expect(dia3Ligado(v as string)).toBe(false);
  });
  it("9h–20h em Brasília", () => {
    expect(horaDeMandar(Date.parse("2026-10-31T12:00:00Z"))).toBe(true); // 9h
    expect(horaDeMandar(Date.parse("2026-10-31T11:59:00Z"))).toBe(false); // 8h59
    expect(horaDeMandar(Date.parse("2026-10-31T22:59:00Z"))).toBe(true); // 19h59
    expect(horaDeMandar(Date.parse("2026-10-31T23:00:00Z"))).toBe(false); // 20h
  });
  it("vitalício web = Pix, ativo, vitalício, com valor (presente recebido, loja, anual e grátis ficam de fora)", () => {
    expect(ehVitalicioWeb(linhaVit("a", 80))).toBe(true);
    expect(ehVitalicioWeb(linhaVit("a", 80, { payment_method: "presente" }))).toBe(false);
    expect(ehVitalicioWeb(linhaVit("a", 80, { payment_method: "play_store" }))).toBe(false);
    expect(ehVitalicioWeb(linhaVit("a", 80, { billing_period: "annual", plan: "core-pro" }))).toBe(false);
    expect(ehVitalicioWeb(linhaVit("a", 80, { amount_cents: 0 }))).toBe(false);
    expect(ehVitalicioWeb(linhaVit("a", 80, { status: "canceled" }))).toBe(false);
  });
  it("motivoDia3: 72–96 h, e-mail, teste, uso, já comprou, já avisado", () => {
    const base = { agora: AGORA, email: "ana@exemplo.com.br", entrouNoApp: true, jaComprouPresente: false, jaAvisado: false };
    expect(motivoDia3({ ...base, linha: linhaVit("a", 80) })).toBe("ok");
    expect(motivoDia3({ ...base, linha: linhaVit("a", 71.9) })).toBe("fora_da_janela");
    expect(motivoDia3({ ...base, linha: linhaVit("a", 96) })).toBe("fora_da_janela");
    expect(motivoDia3({ ...base, linha: linhaVit("a", 72) })).toBe("ok");
    expect(motivoDia3({ ...base, agora: Date.parse("2026-10-31T02:00:00Z"), linha: { ...linhaVit("a", 80), created_at: iso(Date.parse("2026-10-31T02:00:00Z") - 80 * H) } })).toBe("fora_do_horario");
    expect(motivoDia3({ ...base, email: null, linha: linhaVit("a", 80) })).toBe("sem_email");
    expect(motivoDia3({ ...base, email: "x+teste@exemplo.com.br", linha: linhaVit("a", 80) })).toBe("teste");
    expect(motivoDia3({ ...base, entrouNoApp: false, linha: linhaVit("a", 80) })).toBe("nao_entrou");
    expect(motivoDia3({ ...base, jaComprouPresente: true, linha: linhaVit("a", 80) })).toBe("ja_comprou");
    expect(motivoDia3({ ...base, jaAvisado: true, linha: linhaVit("a", 80) })).toBe("ja_avisado");
    expect(JANELA_DIA3).toEqual({ deMs: 72 * H, ateMs: 96 * H });
  });
});

describe("a passada do cron (varrerPresenteDia3)", () => {
  const cenario = () => bancoFalso({
    subscriptions: [
      linhaVit("ana", 80), // ok
      linhaVit("bia", 90), // não entrou no app (só usou a demo logo depois da compra)
      linhaVit("cris", 50), // cedo demais
      linhaVit("dani", 100), // tarde demais
      linhaVit("edu", 85), // já comprou presente
      linhaVit("semmail", 80),
      linhaVit("qa", 80),
      linhaVit("anual", 80, { billing_period: "annual", plan: "core-pro" }),
    ],
    module_analytics: [uso("ana", 30), uso("bia", 89.8), uso("edu", 10), uso("semmail", 5), uso("qa", 5), uso("anual", 5)],
    presentes: [{ codigo: "ABCDEFGH", comprador_id: "edu", pedido: "qr_x", valor_centavos: 1490, de_nome: null, resgatado_por: null, resgatado_em: null }],
  });

  it("manda 1 e-mail só pra quem entrou no app, na janela, com e-mail de verdade — e nunca repete", async () => {
    const { admin, t } = cenario();
    const env = envioFalso();
    const r = await varrerPresenteDia3(admin, { agora: AGORA, conta, enviar: env.enviar, gerar: tokenFixo });
    expect(env.enviados.map((e) => e.para)).toEqual(["ana@exemplo.com.br"]);
    expect(r).toMatchObject({ enviados: 1, naoEntrou: 1, jaComprou: 1, semEmail: 1, testes: 1, falhas: 0 });
    expect(t.webhook_events.some((w) => w.id === chaveEnvioDia3("ana"))).toBe(true);
    expect(t.analytics_events.filter((e) => e.event_name === "presente_d3_email_enviado")).toHaveLength(1);
    // o e-mail leva o link com o token da conta (nada de código Pix): o Pix nasce quando a página abre
    const html = env.enviados[0].html;
    expect(html).toMatch(/\/presente\/dar\?t=[A-Za-z0-9]{32}/);
    expect(html).not.toMatch(/00020126/);
    expect(t.analytics_events.some((e) => e.event_name === "pix_order_created")).toBe(false);
    expect(html).toMatch(/Ana, dê o CORE pra sempre pra quem você quer bem\./);
    // 2ª passada (10 min depois): ninguém recebe de novo
    const env2 = envioFalso();
    const r2 = await varrerPresenteDia3(admin, { agora: AGORA + 10 * 60e3, conta, enviar: env2.enviar, gerar: tokenFixo });
    expect(env2.enviados).toHaveLength(0);
    expect(r2.jaAvisados).toBe(1);
  });

  it("fora das 9h–20h não lê nada nem manda", async () => {
    const { admin } = cenario();
    const env = envioFalso();
    const noite = Date.parse("2026-11-01T01:00:00Z"); // 22h em Brasília
    const r = await varrerPresenteDia3(admin, { agora: noite, conta, enviar: env.enviar });
    expect(env.enviados).toHaveLength(0);
    expect(r.foraDoHorario).toBe(1);
  });

  it("o envio falhou → solta a trava (a próxima passada tenta de novo)", async () => {
    const { admin, t } = cenario();
    const falha = envioFalso(false);
    const r = await varrerPresenteDia3(admin, { agora: AGORA, conta, enviar: falha.enviar, gerar: tokenFixo });
    expect(r.falhas).toBe(1);
    expect(t.webhook_events.some((w) => w.id === chaveEnvioDia3("ana"))).toBe(false);
    const ok = envioFalso();
    await varrerPresenteDia3(admin, { agora: AGORA + 10 * 60e3, conta, enviar: ok.enviar, gerar: tokenFixo });
    expect(ok.enviados).toHaveLength(1);
  });

  it("'entrou no app' só conta uso 30 min ou mais depois da compra", () => {
    expect(ENTROU_DEPOIS_MS).toBe(30 * 60e3);
  });
});

describe("o texto do e-mail", () => {
  const html = htmlDia3({ link: linkDarPresente({ t: "A".repeat(32) }) });
  const texto = html.replace(/<[^>]+>/g, " ");
  it("curto, sem gênero, sem pressa falsa, sem brinde", () => {
    expect(assuntoDia3()).toBe("Leve alguém junto");
    expect(texto).toMatch(/Leve alguém junto/);
    expect(texto).toMatch(/pra quem você quer bem/);
    expect(texto).toMatch(/R\$ 14,90, uma vez\./);
    expect(texto).toMatch(/Sem mensalidade/);
    expect(texto).toMatch(/Dar de presente/);
    expect(texto).not.toMatch(/só hoje|hoje só|últim[oa]s? (hora|dia|chance)|acaba|expira em|corre/i);
    expect(texto).not.toMatch(/\b(ele|ela|dele|dela|amiga|amigo|namorad[oa]|esposa|marido)\b/i);
    expect(texto).not.toMatch(/brinde|grátis|de graça/i);
    expect(texto.split(/\s+/).filter(Boolean).length).toBeLessThan(110);
  });
  it("o link: /presente/dar com o token e as UTMs do e-mail", () => {
    const u = new URL(linkDarPresente({ t: "B".repeat(32) }));
    expect(u.pathname).toBe("/presente/dar");
    expect(u.searchParams.get("t")).toBe("B".repeat(32));
    expect(u.searchParams.get("utm_source")).toBe("email_dia3");
    expect(previewDia3().html).toMatch(/email_dia3_preview/);
  });
});

describe("o token", () => {
  it("32 letras; 1 por conta (o e-mail e o aviso do app usam o mesmo); vence em 30 dias", async () => {
    expect(tokenValido(gerarToken())).toBe(true);
    expect(tokenValido("curto")).toBe(false);
    const { admin } = bancoFalso();
    const t1 = await tokenDoDono(admin, "ana", { agora: AGORA, gerar: tokenFixo });
    const t2 = await tokenDoDono(admin, "ana", { agora: AGORA + H, gerar: tokenFixo });
    expect(t1).toBeTruthy();
    expect(t2).toBe(t1);
    expect(await donoDoToken(admin, t1, AGORA)).toBe("ana");
    expect(await donoDoToken(admin, t1, AGORA + TOKEN_VALIDO_MS + 1)).toBeNull();
    expect(await donoDoToken(admin, "x".repeat(32), AGORA)).toBeNull();
    // perto de vencer → um token novo (o velho continua valendo até o fim)
    const t3 = await tokenDoDono(admin, "ana", { agora: AGORA + 25 * 24 * H, gerar: tokenFixo });
    expect(t3).not.toBe(t1);
    expect(await donoDoToken(admin, t3, AGORA + 25 * 24 * H)).toBe("ana");
  });
});

describe("a página pelo token (estadoDia3)", () => {
  const preparar = async () => {
    const b = bancoFalso({ subscriptions: [linhaVit("ana", 80)] });
    const tok = (await tokenDoDono(b.admin, "ana", { agora: AGORA, gerar: tokenFixo }))!;
    return { admin: b.admin, tabelas: b.t, tok };
  };

  it("token inválido ou de outro banco → 'token'; conta sem o CORE pra sempre → 'sem_acesso'; nada de QR", async () => {
    const { admin } = await preparar();
    const qr = qrFalso();
    expect(await estadoDia3(admin, { t: "nada", gerar: true, criarQr: qr.criar })).toEqual({ ok: false, motivo: "token" });
    expect(await estadoDia3(admin, { t: "Q".repeat(32), gerar: true, criarQr: qr.criar })).toEqual({ ok: false, motivo: "token" });
    const z = bancoFalso({ subscriptions: [linhaVit("zeca", 80, { status: "canceled" })] });
    const tz = (await tokenDoDono(z.admin, "zeca", { gerar: tokenFixo }))!;
    expect(await estadoDia3(z.admin, { t: tz, gerar: true, criarQr: qr.criar })).toEqual({ ok: false, motivo: "sem_acesso" });
    expect(qr.chamadas).toHaveLength(0);
  });

  it("abre → 1 Pix pv149 de R$ 14,90 e 24 h; a 2ª abertura devolve o MESMO; o registro do create sai com user_id = a conta", async () => {
    const { admin, tabelas, tok } = await preparar();
    const qr = qrFalso();
    const r1 = await estadoDia3(admin, { t: tok, gerar: true, criarQr: qr.criar, agora: () => AGORA });
    const r2 = await estadoDia3(admin, { t: tok, gerar: true, criarQr: qr.criar, agora: () => AGORA + 5 * 60e3 });
    expect(pedidoDe(r1)).toBe("qr_pv_1");
    expect(pedidoDe(r2)).toBe("qr_pv_1");
    expect(qr.chamadas).toHaveLength(1);
    expect(qr.chamadas[0]).toMatchObject({ valorCentavos: 1490, expiraSegundos: EXPIRA_UPSELL_S });
    const reg = tabelas.analytics_events.filter((e) => e.event_name === "pix_order_created");
    expect(reg).toHaveLength(1);
    expect(reg[0]).toMatchObject({ user_id: "ana", event_data: { order_id: "qr_pv_1", offer: "pv149", amount_cents: 1490, origem: "dia3" } });
    // a conferência (sem gerar) devolve o Pix vivo, sem criar outro
    const r3 = await estadoDia3(admin, { t: tok, criarQr: qr.criar, agora: () => AGORA + 10 * 60e3 });
    expect(pedidoDe(r3)).toBe("qr_pv_1");
    expect(qr.chamadas).toHaveLength(1);
  });

  it("pago (o webhook criou o código) → { pago, codigo } pro cartão; o nome só pelo token de quem comprou", async () => {
    const { admin, tabelas, tok } = await preparar();
    const qr = qrFalso();
    const r1 = await estadoDia3(admin, { t: tok, gerar: true, criarQr: qr.criar, agora: () => AGORA });
    const pedido = pedidoDe(r1) as string;
    tabelas.presentes.push({ codigo: "PRESENTE", comprador_id: "ana", pedido, valor_centavos: 1490, de_nome: null, resgatado_por: null, resgatado_em: null });
    expect(await estadoDia3(admin, { t: tok, pedido, criarQr: qr.criar })).toEqual({ ok: true, pago: true, pedido, codigo: "PRESENTE", de: null, resgatado: false });
    // mesmo sem a página mandar o pedido (recarregou sem estado): o guardado da conta acha
    expect((await estadoDia3(admin, { t: tok, criarQr: qr.criar })).ok).toBe(true);
    expect(await nomeDia3(admin, { t: tok, pedido, nome: "Ana <b>" })).toEqual({ ok: true, de: "Ana b" });
    expect(await nomeDia3(admin, { t: "Z".repeat(32), pedido, nome: "Outro" })).toEqual({ ok: false });
  });
});

describe("o webhook atrasou: a página confere na Asaas (só com `conferir`)", () => {
  it("pago e valor certo → cria o código (comprador = a conta do token); pedido de outra conta não vale", async () => {
    const b = bancoFalso({ subscriptions: [linhaVit("ana", 80), linhaVit("bia", 80)] });
    const t = (await tokenDoDono(b.admin, "ana", { gerar: tokenFixo }))!;
    const qr = qrFalso();
    const r1 = await estadoDia3(b.admin, { t, gerar: true, criarQr: qr.criar });
    const pedido = pedidoDe(r1) as string;
    const pagamento = async () => ({ pago: true, valor: 14.9 });
    const r2 = await estadoDia3(b.admin, { t, pedido, criarQr: qr.criar, pagamento });
    expect(r2.ok && r2.pago).toBe(true);
    const pres = b.t.presentes;
    expect(pres).toHaveLength(1);
    expect(pres[0]).toMatchObject({ comprador_id: "ana", pedido, valor_centavos: 1490 });
    // o pedido de outra conta (bia) mandado com o token da ana: não confere, não cria
    const tb = (await tokenDoDono(b.admin, "bia", { gerar: tokenFixo }))!;
    const rb = await estadoDia3(b.admin, { t: tb, gerar: true, criarQr: qr.criar });
    const pedidoBia = pedidoDe(rb) as string;
    const r3 = await estadoDia3(b.admin, { t, pedido: pedidoBia, criarQr: qr.criar, pagamento });
    expect(r3.ok && r3.pago && (r3 as { pedido: string }).pedido).toBe(pedido); // a da ana continua; a da bia não vira dela
    expect(pres.filter((p) => p.pedido === pedidoBia)).toHaveLength(0);
  });
  it("valor menor que 14,90 ou não pago → segue esperando", async () => {
    const b = bancoFalso({ subscriptions: [linhaVit("ana", 80)] });
    const t = (await tokenDoDono(b.admin, "ana", { gerar: tokenFixo }))!;
    const qr = qrFalso();
    const r1 = await estadoDia3(b.admin, { t, gerar: true, criarQr: qr.criar });
    const pedido = pedidoDe(r1) as string;
    for (const pg of [{ pago: true, valor: 9.9 }, { pago: false, valor: null }]) {
      const r = await estadoDia3(b.admin, { t, pedido, criarQr: qr.criar, pagamento: async () => pg });
      expect(r.ok && r.pago).toBe(false);
    }
  });
});

describe("a fonte: o cron, a função, o medidor de uso", () => {
  const ler = (p: string) => readFileSync(join(__dirname, "../..", p), "utf8");
  it("o cron só roda a passada com PRESENTE_DIA3=on e tem preview só pra equipe", () => {
    const s = ler("supabase/functions/pix-pendente-email/index.ts");
    expect(s).toMatch(/if \(dia3Ligado\(Deno\.env\.get\(SECRET_PRESENTE_DIA3\)\)\)/);
    expect(s).toMatch(/varrerPresenteDia3\(supabase/);
    expect(s).toMatch(/body\.presente === "d3"/);
    expect(s.indexOf('body.presente === "d3"')).toBeGreaterThan(s.indexOf("destinoDePreview(body.preview)"));
  });
  it("presente-resgatar: dia3/dia3_nome ANTES do login; dia3_token DEPOIS (com login); Asaas só com conferir", () => {
    const s = ler("supabase/functions/presente-resgatar/index.ts");
    const login = s.indexOf("// daqui pra baixo: com login");
    expect(s.indexOf('acao === "dia3"')).toBeGreaterThan(0);
    expect(s.indexOf('acao === "dia3"')).toBeLessThan(login);
    expect(s.indexOf('acao === "dia3_nome"')).toBeLessThan(login);
    expect(s.indexOf('acao === "dia3_token"')).toBeGreaterThan(login);
    expect(s).toMatch(/body\.conferir === true \? pagamentoNaAsaas/);
  });
  it("a demo dentro da venda (/organizar/demo, /hoje/demo) não grava module_analytics; as outras demos seguem medindo", () => {
    expect(ehDemoDaVenda("/organizar/demo")).toBe(true);
    expect(ehDemoDaVenda("/hoje/demo")).toBe(true);
    expect(ehDemoDaVenda("/preview/financas")).toBe(false);
    expect(ehDemoDaVenda("/financas")).toBe(false);
    const s = ler("src/hooks/use-module-tracker.ts");
    expect(s).toMatch(/if \(!user \|\| emDemoDaVenda\(\)\) return;/);
    expect(s).toMatch(/currentTab\.current !== null && !emDemoDaVenda\(\)/);
  });
  it("o presente não manda Purchase pra Meta (só UTMify), em nenhum dos 3 caminhos", () => {
    for (const f of ["asaas-pix", "asaas-webhook"]) expect(ler(`supabase/functions/${f}/index.ts`)).toMatch(/if \(mandaPurchaseMeta\(offer\)\) await sendMetaCapi/);
    expect(ler("supabase/functions/pix-reconcile/index.ts")).toMatch(/mandaPurchaseMeta\("pv149"\)/);
    expect(ler("src/pages/presente/DarPresente.tsx")).not.toMatch(/firePixPurchaseOnce|markPixPurchasePending|fbq\(/);
  });
});
