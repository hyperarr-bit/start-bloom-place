/**
 * SEQUÊNCIA DO CARTÃO RECUSADO (D0/D2/D5/D10) — 20/10/2026.
 *
 * Trava: (1) a ordem e os dias de cada passo, contados em dias de Brasília;
 * (2) parar na hora em que volta a pagar / cancela / expira / pede pra sair;
 * (3) idempotência — o mesmo passo nunca sai duas vezes, passo perdido não
 * sai atrasado, nunca 2 e-mails de cobrança no mesmo dia; (4) a conta dos
 * dias que faltam da carência de 28; (5) chave desligada = sem sequência;
 * (6) os textos: curtos, sem Pix/site, sem "24 h", botão certo.
 */
import { describe, it, expect } from "vitest";
import {
  CARENCIA_DIAS, classificarEstadoApple, decidirPasso, dentroDoHorario, diaBRT, diasDesde, diasRestantesCarencia,
  linkSair, MARCADOR, MARCADOR_FIM, MARCADOR_PIX, MARCADOR_SAIR, montarHistorico, sequenciaLigada, tokenSair,
  tokenSairValido, type Evento, type Passo,
} from "../../supabase/functions/_shared/cobranca-sequencia";
import {
  assuntoSequencia, htmlSequencia, textoSequencia, URL_PAGAMENTO_APPLE,
} from "../../supabase/functions/_shared/email-cobranca-sequencia";

// D0 às 10h de Brasília (13h UTC) de 01/10
const D0 = "2026-10-01T13:00:00.000Z";
const em = (diasDepois: number, horaBRT = 10) =>
  new Date(Date.parse(`2026-10-01T00:00:00Z`) + diasDepois * 86400_000 + (horaBRT + 3) * 3600_000);
const envio = (passo: Passo | null, quando: string | Date, extra: Record<string, unknown> = {}): Evento => ({
  event_name: MARCADOR,
  created_at: new Date(quando).toISOString(),
  event_data: passo ? { passo, via: passo === "d0" ? "webhook" : "cron", ...extra } : { via: "webhook" },
});

/** Simula o cron de hora em hora por N dias, gravando o que mandaria. */
function simular(dias: number, inicio: Evento[] = [envio("d0", D0)], pararNoDia?: number) {
  const evs = [...inicio];
  const enviados: { passo: Passo; dia: number }[] = [];
  for (let d = 0; d <= dias; d++) {
    for (let h = 9; h <= 20; h++) {
      const agora = em(d, h);
      const dec = decidirPasso(montarHistorico(evs), agora);
      if (dec.acao === "parar") evs.push({ event_name: MARCADOR_FIM, created_at: agora.toISOString(), event_data: { motivo: dec.motivo } });
      if (dec.acao !== "enviar") continue;
      if (pararNoDia !== undefined && d >= pararNoDia) {
        evs.push({ event_name: MARCADOR_FIM, created_at: agora.toISOString(), event_data: { motivo: "recuperou" } });
        continue;
      }
      evs.push(envio(dec.passo, agora));
      enviados.push({ passo: dec.passo, dia: d });
    }
  }
  return enviados;
}

describe("a chave", () => {
  it("só 'on' liga; vazio/off/qualquer outra coisa = desligada", () => {
    expect(sequenciaLigada(undefined)).toBe(false);
    expect(sequenciaLigada(null)).toBe(false);
    expect(sequenciaLigada("")).toBe(false);
    expect(sequenciaLigada("off")).toBe(false);
    expect(sequenciaLigada("true")).toBe(false);
    expect(sequenciaLigada("on")).toBe(true);
    expect(sequenciaLigada(" ON ")).toBe(true);
  });
});

describe("conta dos dias (Brasília)", () => {
  it("dia do calendário em BRT", () => {
    expect(diaBRT("2026-10-02T02:30:00Z")).toBe("2026-10-01"); // 23h30 de 01/10 em Brasília
    expect(diaBRT("2026-10-02T03:00:00Z")).toBe("2026-10-02");
  });
  it("dias de calendário, não de 24 h", () => {
    expect(diasDesde("2026-10-02T02:00:00Z", new Date("2026-10-02T04:00:00Z"))).toBe(1); // 23h → 1h
    expect(diasDesde(D0, em(0, 20))).toBe(0);
    expect(diasDesde(D0, em(2, 9))).toBe(2);
    expect(diasDesde(D0, em(10, 9))).toBe(10);
  });
  it("carência de 28: no D10 faltam 18; nunca negativo", () => {
    expect(CARENCIA_DIAS).toBe(28);
    expect(diasRestantesCarencia(D0, em(10))).toBe(18);
    expect(diasRestantesCarencia(D0, em(27))).toBe(1);
    expect(diasRestantesCarencia(D0, em(40))).toBe(0);
  });
  it("horário do cron: 9h–20h de Brasília", () => {
    expect(dentroDoHorario(em(1, 8))).toBe(false);
    expect(dentroDoHorario(em(1, 9))).toBe(true);
    expect(dentroDoHorario(em(1, 20))).toBe(true);
    expect(dentroDoHorario(em(1, 21))).toBe(false);
  });
});

describe("sequência", () => {
  it("cron de hora em hora por 20 dias manda D2, D5 e D10 — cada um 1 vez, no dia certo", () => {
    expect(simular(20)).toEqual([
      { passo: "d2", dia: 2 },
      { passo: "d5", dia: 5 },
      { passo: "d10", dia: 10 },
    ]);
  });
  it("D0 antigo (marcador sem `passo`, de antes de 20/10) conta como D0", () => {
    expect(simular(12, [envio(null, D0)]).map((x) => x.passo)).toEqual(["d2", "d5", "d10"]);
  });
  it("sem D0 não há sequência (o cron nunca manda o D0)", () => {
    expect(decidirPasso(montarHistorico([]), em(3))).toEqual({ acao: "esperar", motivo: "sem_d0" });
    expect(simular(12, [])).toEqual([]);
  });
  it("dias 0 e 1: cedo", () => {
    const h = montarHistorico([envio("d0", D0)]);
    expect(decidirPasso(h, em(1, 15))).toEqual({ acao: "esperar", motivo: "cedo" });
  });
  it("D10 leva os dias que faltam da carência", () => {
    const h = montarHistorico([envio("d0", D0), envio("d2", em(2)), envio("d5", em(5))]);
    expect(decidirPasso(h, em(10))).toEqual({ acao: "enviar", passo: "d10", dias: 10, diasRestantes: 18 });
  });
  it("recusa nova (outro D0 depois) reinicia a contagem a partir dela", () => {
    const evs = [envio("d0", "2026-08-01T13:00:00Z"), envio("d2", "2026-08-03T13:00:00Z"), envio("d0", D0)];
    const h = montarHistorico(evs);
    expect(h.inicio).toBe(new Date(D0).toISOString());
    expect(h.enviados).toEqual(["d0"]);
    expect(decidirPasso(h, em(2))).toMatchObject({ acao: "enviar", passo: "d2" });
  });
});

describe("parar", () => {
  it("voltou a pagar no dia 4: sai o D2 e mais nada", () => {
    expect(simular(20, undefined, 4)).toEqual([{ passo: "d2", dia: 2 }]);
  });
  it("sequência encerrada (marcador de fim depois do D0) não manda mais nada", () => {
    const h = montarHistorico([envio("d0", D0), { event_name: MARCADOR_FIM, created_at: em(3).toISOString(), event_data: { motivo: "recuperou" } }]);
    expect(decidirPasso(h, em(5))).toEqual({ acao: "esperar", motivo: "encerrada" });
    expect(decidirPasso(h, em(10))).toEqual({ acao: "esperar", motivo: "encerrada" });
  });
  it("fim de uma sequência ANTIGA não trava a nova", () => {
    const h = montarHistorico([
      { event_name: MARCADOR_FIM, created_at: "2026-08-05T13:00:00Z", event_data: { motivo: "recuperou" } },
      envio("d0", D0),
    ]);
    expect(decidirPasso(h, em(2))).toMatchObject({ acao: "enviar", passo: "d2" });
  });
  it("pediu pra sair: para (e grava o fim 1 vez), nunca manda", () => {
    const h = montarHistorico([envio("d0", D0)], true);
    expect(decidirPasso(h, em(2))).toEqual({ acao: "parar", motivo: "saiu", dias: 2 });
    const h2 = montarHistorico([envio("d0", D0), { event_name: MARCADOR_SAIR, created_at: em(1).toISOString() }]);
    expect(h2.saiu).toBe(true);
    expect(simular(12, [envio("d0", D0), { event_name: MARCADOR_SAIR, created_at: em(1).toISOString() }])).toEqual([]);
  });
  it("estado na Apple: só 'recusada' continua; o resto vira motivo de fim", () => {
    const a = (status: string, extra: Record<string, unknown> = {}) => ({ id: "subAap123", status, ...extra });
    expect(classificarEstadoApple([a("in_grace_period", { gives_access: true, auto_renewal_status: "will_renew" })]))
      .toEqual({ estado: "recusada", comAcesso: true });
    expect(classificarEstadoApple([a("in_billing_retry", { gives_access: false })])).toEqual({ estado: "recusada", comAcesso: false });
    expect(classificarEstadoApple([a("in_grace_period", { auto_renewal_status: "will_not_renew" })]).estado).toBe("cancelou");
    expect(classificarEstadoApple([a("active", { auto_renewal_status: "will_renew" })]).estado).toBe("recuperou");
    expect(classificarEstadoApple([a("active", { auto_renewal_status: "will_not_renew" })]).estado).toBe("recuperou");
    expect(classificarEstadoApple([a("expired")]).estado).toBe("expirou");
    expect(classificarEstadoApple([]).estado).toBe("sem_assinatura");
    // Play Store não conta
    expect(classificarEstadoApple([{ id: "subGps1", status: "in_grace_period" }]).estado).toBe("sem_assinatura");
  });
});

describe("idempotência e 1 por dia", () => {
  it("o mesmo passo nunca sai duas vezes", () => {
    const h = montarHistorico([envio("d0", D0), envio("d2", em(2, 9))]);
    expect(decidirPasso(h, em(2, 15))).toEqual({ acao: "esperar", motivo: "em_dia" });
    expect(decidirPasso(h, em(4))).toEqual({ acao: "esperar", motivo: "em_dia" });
  });
  it("passo perdido não sai atrasado: cron fora do ar do dia 2 ao 6 → só o D5 no dia 6", () => {
    const h = montarHistorico([envio("d0", D0)]);
    expect(decidirPasso(h, em(6))).toMatchObject({ acao: "enviar", passo: "d5" });
    const h2 = montarHistorico([envio("d0", D0), envio("d5", em(6))]);
    expect(decidirPasso(h2, em(7))).toEqual({ acao: "esperar", motivo: "em_dia" });
  });
  it("depois do D10: completa", () => {
    const h = montarHistorico([envio("d0", D0), envio("d2", em(2)), envio("d5", em(5)), envio("d10", em(10))]);
    expect(decidirPasso(h, em(12))).toEqual({ acao: "esperar", motivo: "completa" });
  });
  it("já saiu um e-mail de cobrança hoje (até o do Pix): espera amanhã", () => {
    const h = montarHistorico([envio("d0", D0), { event_name: MARCADOR_PIX, created_at: em(5, 9).toISOString() }]);
    expect(decidirPasso(h, em(5, 14))).toEqual({ acao: "esperar", motivo: "ja_hoje" });
    expect(decidirPasso(h, em(6, 9))).toMatchObject({ acao: "enviar", passo: "d5" });
  });
  it("recusa com mais de 14 dias não recebe (ligar a chave não dispara lote atrasado)", () => {
    const h = montarHistorico([envio("d0", D0)]);
    expect(decidirPasso(h, em(15))).toEqual({ acao: "esperar", motivo: "fora_da_janela" });
  });
});

describe("link de sair da lista", () => {
  const uid = "11111111-2222-3333-4444-555555555555";
  it("assinado: confere com o segredo certo, falha com outro, outro id ou token mexido", async () => {
    const t = await tokenSair(uid, "segredo");
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await tokenSairValido(uid, t, "segredo")).toBe(true);
    expect(await tokenSairValido(uid, t, "outro")).toBe(false);
    expect(await tokenSairValido("11111111-2222-3333-4444-555555555556", t, "segredo")).toBe(false);
    expect(await tokenSairValido(uid, t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), "segredo")).toBe(false);
    expect(await tokenSairValido("nao-e-uuid", t, "segredo")).toBe(false);
    expect(await tokenSairValido(uid, t, "")).toBe(false);
  });
  it("link com sair=1, u e t", () => {
    expect(linkSair("https://x.supabase.co/functions/v1/cobranca-recusada", uid, "abc"))
      .toBe(`https://x.supabase.co/functions/v1/cobranca-recusada?sair=1&u=${uid}&t=abc`);
  });
});

describe("textos", () => {
  const base = { nome: "Ana", comAcesso: true, diasRestantes: 18, linkSair: "https://x/sair?sair=1&u=1&t=2" };
  const passos: Passo[] = ["d0", "d2", "d5", "d10"];

  it("cada passo tem assunto próprio", () => {
    const assuntos = passos.map((passo) => assuntoSequencia({ ...base, passo }));
    expect(new Set(assuntos).size).toBe(4);
    expect(assuntos[0]).toBe("Ana, o pagamento do seu CORE não passou");
    expect(assuntoSequencia({ ...base, nome: "", passo: "d0" })).toBe("O pagamento do seu CORE não passou");
  });

  it("botão 'Atualizar pagamento' pra App Store, assinatura do João e link de sair em todos", () => {
    for (const passo of passos) {
      const h = htmlSequencia({ ...base, passo });
      expect(h).toContain(`href="${URL_PAGAMENTO_APPLE}"`);
      expect(URL_PAGAMENTO_APPLE).toBe("https://apps.apple.com/account/billing");
      expect(h).toMatch(/>Atualizar pagamento</);
      expect(h).toMatch(/João, do CORE/);
      expect(h).toContain('href="https://x/sair?sair=1&amp;u=1&amp;t=2"');
      expect(h).toMatch(/Não quero mais receber estes avisos/);
      expect(textoSequencia({ ...base, passo })).toContain(base.linkSair);
    }
  });

  it("NUNCA Pix, site, link pro CORE web ou 'até 24 h antes'", () => {
    for (const passo of passos) for (const comAcesso of [true, false]) {
      const tudo = htmlSequencia({ ...base, passo, comAcesso }) + textoSequencia({ ...base, passo, comAcesso }) + assuntoSequencia({ ...base, passo });
      expect(tudo).not.toMatch(/pix/i);
      expect(tudo).not.toMatch(/coreaplicativo|\bsite\b|vital[ií]cio/i);
      expect(tudo).not.toMatch(/24\s*h|24 horas/i);
    }
  });

  it("todos mais curtos que o e-mail de 28/09 (~820 caracteres de texto)", () => {
    for (const passo of passos) {
      const t = textoSequencia({ ...base, passo }).split("Não quer mais")[0];
      expect(t.length).toBeLessThan(450);
    }
  });

  it("D10 diz quantos dias faltam (plural/singular); sem acesso ou sem prazo, não inventa número", () => {
    expect(htmlSequencia({ ...base, passo: "d10", diasRestantes: 18 })).toMatch(/por mais <b>18 dias<\/b>/);
    expect(htmlSequencia({ ...base, passo: "d10", diasRestantes: 1 })).toMatch(/por mais <b>1 dia<\/b>/);
    const sem = htmlSequencia({ ...base, passo: "d10", comAcesso: false });
    expect(sem).not.toMatch(/por mais/);
    expect(sem).toMatch(/acesso está pausado/);
    expect(htmlSequencia({ ...base, passo: "d10", diasRestantes: 0 })).not.toMatch(/por mais/);
  });

  it("D0 com e sem acesso", () => {
    expect(htmlSequencia({ ...base, passo: "d0" })).toMatch(/acesso continua liberado/);
    expect(htmlSequencia({ ...base, passo: "d0", comAcesso: false })).toMatch(/continua guardado/);
  });

  it("nome escapado (não injeta HTML)", () => {
    const h = htmlSequencia({ ...base, passo: "d2", nome: "<b>x</b>" });
    expect(h).not.toContain("<b>x</b>");
    expect(h).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
