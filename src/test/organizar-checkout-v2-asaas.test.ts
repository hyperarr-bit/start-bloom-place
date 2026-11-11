// @vitest-environment-options {"url":"https://www.coreaplicativo.com.br/organizar"}
/**
 * /organizar no DOMÍNIO DE PRODUÇÃO com um ASAAS FALSO (08/11, checkout novo do /organizar — SPEC §7).
 * Aqui o Pix NÃO é o simulado da página: é o caminho de verdade — landing.ts → pagamento.ts (gerarPix / emailAntesDoPix /
 * conferirPix / finalizarConta) → supabase.functions.invoke("asaas-pix") — e o Purchase sai do purchase-tracking.ts de verdade
 * (firePixPurchaseOnce: reserva → prova na subscriptions → fbq com eventID = order_id). Falsos: o Supabase (as respostas do asaas-pix,
 * a sessão, a subscriptions), a sessão anônima e a gravação da atribuição. Nada sai pra rede (setup.ts bloqueia).
 *
 * A fixture src/test/fixtures/organizar-asaas-07-11.json foi gravada do HEAD 08bc1145 ANTES de mexer na página: o que vai pro asaas-pix
 * (cada corpo), o que vai pro pixel (InitiateCheckout + Purchase) e o que vai pra atribuição da conta, nos 2 braços do AB_LP.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const h = vi.hoisted(() => {
  const s = {
    seq: 0,
    pagos: new Set<string>(),
    emailSessao: null as string | null,
    invoke: [] as Array<{ fn: string; body: Record<string, unknown> }>,
    atribuicao: [] as Array<Record<string, unknown>>,
    otp: [] as string[],
    falharCreate: 0,
  };
  return s;
});

vi.mock("@/integrations/supabase/client", () => {
  const UID = "c0ffee00-0000-4000-8000-0000000000aa";
  const consulta = () => {
    const q: Record<string, unknown> = {};
    q.select = () => q; q.eq = () => q; q.in = () => q; q.order = () => q;
    q.limit = () => Promise.resolve({ data: [...h.pagos].map((id) => ({ abacatepay_billing_id: id })), error: null });
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    return q;
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: UID }, access_token: "x" } } }),
        signInWithOtp: async ({ email }: { email: string }) => { h.otp.push(email); return { error: null }; },
        verifyOtp: async ({ token }: { token: string }) => (token === "12345678" ? { data: { session: {} }, error: null } : { data: {}, error: { message: "Token has expired or is invalid" } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      functions: {
        invoke: async (fn: string, o: { body: Record<string, unknown> }) => {
          h.invoke.push({ fn, body: JSON.parse(JSON.stringify(o.body)) });
          const b = o.body;
          if (fn !== "asaas-pix") return { data: null, error: { message: "fora" } };
          if (b.action === "create" && typeof b.offer === "string" && b.offer.startsWith("LN_")) {
            if (/\+jatem@/.test(String(b.email ?? ""))) return { data: { ja_tem: true, via: "servidor" }, error: null };
            if (h.falharCreate > 0) { h.falharCreate -= 1; return { data: null, error: { message: "Edge Function returned a non-2xx status code" } }; }
            h.seq += 1;
            return { data: { orderId: `asaasfalso${String(h.seq).padStart(4, "0")}`, qrCode: `00020101021226870014br.gov.bcb.pix2565qrcode.asaas.com/pix/v2/FALSO${h.seq}5204000053039865405279005802BR5904CORE6009SAO PAULO62070503***6304ABCD`, qrCodeBase64: null, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }, error: null };
          }
          if (b.action === "check") return { data: { paid: h.pagos.has(String(b.id)) }, error: null };
          return { data: null, error: { message: "nao_simulado" } };
        },
      },
      from: () => consulta(),
    },
  };
});
vi.mock("@/pages/hoje/conta", () => ({
  EMAIL_OK: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  abrirSessaoParaPagar: async () => "ok",
  sessaoViva: async () => true,
  emailAtual: async () => h.emailSessao,
  salvarEmailDaCompra: async () => ({ ok: true }),
  trazerCompraParaConta: async () => "movida",
  gravarAtribuicao: async (a: Record<string, unknown>) => { h.atribuicao.push(JSON.parse(JSON.stringify(a))); },
  pedirBoasVindas: async () => {},
}));
vi.mock("@/lib/sessao-anonima", () => ({
  definirEmailDaCompra: async (e: string) => (/\+(existe|jatem)@/.test(e) ? { erro: "email_em_uso" } : ((h.emailSessao = e), { erro: null })),
  guardarCompraAnonima: async () => {}, limparBatismo: () => {}, vincularCompraAnonima: async () => false,
}));
vi.mock("@/pages/venda/rastreio", () => ({ cookiesDaMeta: () => ({ fbp: "fb.1.1762560000000.123456789", fbc: null }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/google-ads", () => ({ firePurchaseConversion: vi.fn() }));

import { abrirPagina, botaoFixo, camadaAberta, clicar, digitar, dormir, encerrarPagina, espera, esperaCamada, esperaCamadaFechar, eventos, fbq, limparEventos, semCko, type Ev, type Lp } from "./organizar-cko-roteiro";

// 08/11 (revisão): a página de cada teste "fecha" no fim (ouvintes e timers dela saem) — nenhuma página velha mexe na do teste seguinte
afterEach(() => encerrarPagina());
/** 3 compras por braço do AB_LP: 1 teste por braço, com teto folgado (máquina carregada) */
const TETO_BRACO = 240_000;

const FIXTURE = resolve(__dirname, "fixtures/organizar-asaas-07-11.json");
type Rodada = { invoke: Array<{ fn: string; body: Record<string, unknown> }>; pixel: unknown[]; atribuicao: Array<Record<string, unknown>>; eventos: Ev[]; otp: string[] };

const zerar = () => { h.seq = 0; h.pagos.clear(); h.emailSessao = null; h.invoke = []; h.atribuicao = []; h.otp = []; };
/** tira o que muda (hora, ids da sessão) — e, na comparação, o braco_cko (o único campo novo permitido na atribuição) */
const limparAtrib = (a: Record<string, unknown>, semCko = true) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== "em" && k !== "landing_session_id" && k !== "landing_device_id" && !(semCko && k === "braco_cko")));
/** 11/11: o main passou a mandar os ids da sessão e do aparelho (sorteados a cada página) no corpo do asaas-pix e na atribuição
 *  (contextoAtribuicao): em qualquer profundidade viram "<id>" — a fixture compara o resto inteiro. */
const semIds = <T,>(x: T): T => JSON.parse(JSON.stringify(x, (k, v) => (k === "landing_session_id" || k === "landing_device_id") && typeof v === "string" ? "<id>" : v));
/** cada corpo 1× (o "Já paguei" e o relógio de 3 s podem pedir o mesmo `check` duas vezes, conforme a máquina) */
const unicos = <T,>(l: T[]): T[] => { const vistos = new Set<string>(); return l.filter((x) => { const k = JSON.stringify(x); if (vistos.has(k)) return false; vistos.add(k); return true; }); };
const fotografar = (semCamada = false): Rodada => ({
  invoke: unicos(semIds(h.invoke)),
  pixel: JSON.parse(JSON.stringify(fbq.mock.calls)),
  atribuicao: h.atribuicao.map((a) => limparAtrib(a)),
  eventos: semCamada ? semCko(limparEventos(eventos())) : limparEventos(eventos()),
  otp: [...h.otp],
});

/** a compra pelo cartão de hoje: botão fixo → e-mail → Pagar → QR → "Já paguei" com o Pix pago no Asaas falso → conta */
export async function compraHoje(lp: Lp): Promise<Rodada> {
  zerar();
  await abrirPagina({ lp, pix: "atual" });
  clicar(botaoFixo(lp));
  digitar("lp-email-antes", "ana@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-codigo"]');
  h.pagos.add("asaasfalso0001");
  clicar("#lp-ja-paguei");
  await espera('[data-testid="landing-conta"]');
  await vi.waitFor(() => { if (!fbq.mock.calls.some((c) => c[1] === "Purchase")) throw new Error("sem Purchase"); }, { timeout: 3000 });
  return fotografar();
}
/** e-mail que já tem conta: código de 8 números → o Pix sai na conta dela */
async function codigoHoje(lp: Lp): Promise<Rodada> {
  zerar();
  await abrirPagina({ lp, pix: "atual" });
  digitar("lp-email-antes", "bia+existe@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-email-tem-conta"]');
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('[data-testid="landing-codigo"]');
  // termina a compra (nenhuma página fica com o QR vivo e o relógio de 3 s rodando por baixo da próxima)
  h.pagos.add("asaasfalso0001");
  clicar("#lp-ja-paguei");
  await espera('[data-testid="landing-conta"]');
  await vi.waitFor(() => { if (!fbq.mock.calls.some((c) => c[1] === "Purchase")) throw new Error("sem Purchase"); }, { timeout: 3000 });
  return fotografar();
}
/** o servidor diz que já tem o CORE */
async function jaTemHoje(lp: Lp): Promise<Rodada> {
  zerar();
  await abrirPagina({ lp, pix: "atual" });
  digitar("lp-email-antes", "cris+jatem@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-email-tem-conta"]');
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('[data-testid="landing-ja-tem"]');
  return fotografar();
}

describe("Asaas falso: o caminho do dinheiro do /organizar de hoje", () => {
  it.each(["atual", "v2"] as Lp[])("a fixture gravada antes de mexer: mesmas chamadas ao asaas-pix, mesmo pixel (1 Purchase, eventID = pedido, 27,90), mesma atribuição — AB_LP %s", async (lp) => {
    const gravar = process.env.GRAVAR_FIXTURE_CKO === "1";
    if (!gravar) expect(existsSync(FIXTURE)).toBe(true);
    const tudo: Record<string, Rodada> = {};
    tudo[`${lp}|compra`] = await compraHoje(lp);
    tudo[`${lp}|codigo`] = await codigoHoje(lp);
    tudo[`${lp}|ja_tem`] = await jaTemHoje(lp);
    if (gravar) {
      mkdirSync(resolve(__dirname, "fixtures"), { recursive: true });
      const antes = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Rodada> : {};
      writeFileSync(FIXTURE, JSON.stringify({ ...antes, ...tudo }, null, 1) + "\n");
    }
    const fx = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Rodada>;
    for (const k of Object.keys(tudo)) expect(tudo[k], k).toEqual(fx[k]);
    for (const k of [`${lp}|compra`, `${lp}|codigo`]) {
      const compras = tudo[k].pixel.filter((c) => (c as unknown[])[1] === "Purchase");
      expect(compras).toEqual([["track", "Purchase", { value: 27.9, currency: "BRL", content_name: "LN_sempre279" }, { eventID: "asaasfalso0001" }]]);
    }
  }, TETO_BRACO);
});

/* ───────────────────────── 08/11: o MESMO caminho do dinheiro pela camada do checkout novo (data-cko="v2") ───────────────────────── */
async function compraV2(lp: Lp, de: "fixo" | "cartao"): Promise<Rodada> {
  zerar();
  await abrirPagina({ lp, pix: "atual", cko: "v2" });
  clicar(de === "fixo" ? botaoFixo(lp) : "#lp-pagar");
  await esperaCamada();
  digitar("cko-email", "ana@email.com");
  clicar("#cko-gerar");
  await espera('#lp-card [data-testid="landing-codigo"]');
  await esperaCamadaFechar();
  h.pagos.add("asaasfalso0001");
  clicar("#lp-ja-paguei");
  await espera('[data-testid="landing-conta"]');
  await vi.waitFor(() => { if (!fbq.mock.calls.some((c) => c[1] === "Purchase")) throw new Error("sem Purchase"); }, { timeout: 3000 });
  return fotografar(true);
}
async function codigoV2(lp: Lp): Promise<Rodada> {
  zerar();
  await abrirPagina({ lp, pix: "atual", cko: "v2" });
  clicar("#lp-pagar");
  await esperaCamada();
  digitar("cko-email", "bia+existe@email.com");
  clicar("#cko-gerar");
  await espera('#cko [data-testid="landing-email-tem-conta"]');
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('#lp-card [data-testid="landing-codigo"]');
  await esperaCamadaFechar();
  h.pagos.add("asaasfalso0001");
  clicar("#lp-ja-paguei");
  await espera('[data-testid="landing-conta"]');
  await vi.waitFor(() => { if (!fbq.mock.calls.some((c) => c[1] === "Purchase")) throw new Error("sem Purchase"); }, { timeout: 3000 });
  return fotografar(true);
}
async function jaTemV2(lp: Lp): Promise<Rodada> {
  zerar();
  await abrirPagina({ lp, pix: "atual", cko: "v2" });
  clicar("#lp-pagar");
  await esperaCamada();
  digitar("cko-email", "cris+jatem@email.com");
  clicar("#cko-gerar");
  await espera('#cko [data-testid="landing-email-tem-conta"]');
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('#lp-card [data-testid="landing-ja-tem"]');
  await esperaCamadaFechar();
  return fotografar(true);
}

describe("Asaas falso: pela camada do checkout novo, o MESMO dinheiro", () => {
  it.each(["atual", "v2"] as Lp[])("os mesmos corpos no asaas-pix (oferta LN_sempre279, a URL do anúncio, o e-mail), o mesmo pixel (1 Purchase, eventID = pedido, 27,90), a mesma atribuição + braco_cko \"v2\", os mesmos eventos de hoje — AB_LP %s", async (lp) => {
    const fx = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Rodada>;
    {
      // pelo botão fixo, a ordem dos eventos é a do roteiro de hoje (que também começou pelo fixo)
      const compra = await compraV2(lp, "fixo");
      expect(compra.invoke, `${lp} compra`).toEqual(fx[`${lp}|compra`].invoke);
      expect(compra.pixel, `${lp} compra`).toEqual(fx[`${lp}|compra`].pixel);
      expect(compra.atribuicao, `${lp} compra`).toEqual(fx[`${lp}|compra`].atribuicao);
      expect(compra.eventos, `${lp} compra`).toEqual(fx[`${lp}|compra`].eventos);
      expect(h.atribuicao[0]).toMatchObject({ braco_cko: "v2", braco_lp: lp, braco_checkout: "email" });
      const codigo = await codigoV2(lp);
      expect(codigo, `${lp} código`).toEqual(fx[`${lp}|codigo`]);
      const ja = await jaTemV2(lp);
      expect(ja, `${lp} já tem`).toEqual(fx[`${lp}|ja_tem`]);
      // o Purchase: 1 só, com o eventID do pedido (o mesmo id que a CAPI do servidor usa) e o valor da oferta
      for (const r of [compra, codigo]) expect(r.pixel.filter((c) => (c as unknown[])[1] === "Purchase")).toEqual([["track", "Purchase", { value: 27.9, currency: "BRL", content_name: "LN_sempre279" }, { eventID: "asaasfalso0001" }]]);
    }
  }, TETO_BRACO);

  it("o servidor não gerou o Pix: a camada continua aberta com o erro de hoje acima do botão; tocar de novo gera", async () => {
    zerar();
    await abrirPagina({ lp: "atual", pix: "atual", cko: "v2" });
    clicar(botaoFixo("atual"));
    await esperaCamada();
    h.falharCreate = 1;
    digitar("cko-email", "dani@email.com");
    clicar("#cko-gerar");
    await vi.waitFor(() => { const e = document.getElementById("cko-erro"); if (!e || e.hidden) throw new Error("sem erro"); }, { timeout: 5000 });
    expect(camadaAberta()).toBe(true);
    expect(document.getElementById("cko-erro")!.textContent).toBe("Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.");
    expect((document.getElementById("cko-email") as HTMLInputElement).value).toBe("dani@email.com"); // o e-mail continua lá
    expect(eventos().find((e) => e.nome === "landing_erro")).toMatchObject({ onde: "pix_create" });
    expect(document.getElementById("lp-card")!.getAttribute("data-fase")).toBe("oferta");
    clicar("#cko-gerar"); // tocar de novo
    await espera('#lp-card [data-testid="landing-codigo"]');
    await esperaCamadaFechar();
    expect(h.invoke.filter((i) => i.body.action === "create").map((i) => i.body.email)).toEqual(["dani@email.com", "dani@email.com"]);
    await dormir(10);
  });
});
