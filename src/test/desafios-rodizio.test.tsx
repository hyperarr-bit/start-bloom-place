/**
 * DESAFIO DA SEMANA EM RODÍZIO (17/10) — components/challenges/{catalogo,rodizio}.
 * Conta vazia, elegibilidade pelo dado, sem repetir chave em 4 semanas, a TRAVA
 * DE REGISTRO (quem para de anotar não vence), a virada da semana com relógio
 * simulado, o calendário, a chave remota e a compatibilidade com o app antigo.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach, type Mock } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-rodizio" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { WeeklyChallenge } from "@/components/challenges/WeeklyChallenge";
import { useFechamentoDoDesafio } from "@/hooks/use-fechamento-desafio";
import { fecharSemanaDoDesafio, lerDesafios, type ChallengesState, type GastoDoDesafio } from "@/components/challenges/challenges";
import {
  CATALOGO, MIN_DIAS_ANOTADOS, avaliarNoCatalogo, blackFridayDe, defDoCatalogo, inferirDiaDoPagamento, montarDados, semanaDoAno, semanaPreBlackFriday,
  type DadosDaSemana,
} from "@/components/challenges/catalogo";
import { escolher, fecharSemana, montarOfertas, nivelParaOferta, variacaoDaSemanaPassada } from "@/components/challenges/rodizio";
import { CHAVE_FORCA_DESAFIOS_RODIZIO, _zerarDesafiosRodizioRemoto, desafiosRodizioLigado, lerChaveRemotaDesafiosRodizio, registrarDesafiosRodizioRemoto } from "@/lib/desafios-rodizio";
import { medirFinancas } from "@/components/gamification/badges-financas";

beforeAll(() => { Element.prototype.scrollIntoView = () => {}; });
afterEach(() => {
  vi.useRealTimers();
  localStorage.removeItem(CHAVE_FORCA_DESAFIOS_RODIZIO);
  _zerarDesafiosRodizioRemoto();
  (trackEvent as Mock).mockClear();
});

/* ───────── fixtures ───────── */

const quando = (a: number, m: number, d: number, h = 10) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(a, m - 1, d, h, 0));
};
let seq = 0;
const gasto = (date: string, value: number, category = "alimentacao", extra: Partial<GastoDoDesafio> & { description?: string } = {}): GastoDoDesafio =>
  ({ id: `g${++seq}`, date, value, category, description: extra.description ?? category, ...extra });
const lerDe = (dados: Record<string, unknown>) => (k: string) => dados[k];
const dadosDe = (dados: Record<string, unknown>, weekStart: string, hoje: Date, meta: Record<string, unknown> = {}) =>
  montarDados({ ler: lerDe(dados), weekStart, perfil: "pessoal", hoje, meta });
const keys = (ofertas: { itens: { key: string }[] }) => ofertas.itens.map((i) => i.key);
const def = (key: string) => defDoCatalogo(key)!;

/** Semana de 12 a 18/10/2026 vista da quarta 14/10; o hábito das 4 semanas antes mora em setembro (arquivo) e outubro (vivo). */
const SEMANA = "2026-10-12";
const QUARTA = new Date(2026, 9, 14, 10);
const habito = (): Record<string, unknown> => ({
  "finance-expenses": [
    gasto("2026-10-01", 48, "delivery", { description: "iFood" }), gasto("2026-10-06", 22, "transporte", { description: "Uber" }),
    gasto("2026-10-07", 19, "transporte", { description: "99" }), gasto("2026-10-08", 31, "transporte", { description: "Uber casa" }),
    gasto("2026-10-05", 120, "mercado"), gasto("2026-10-08", 60, "mercado"), gasto("2026-10-09", 80, "mercado"),
    gasto("2026-10-06", 45, "restaurante"), gasto("2026-10-08", 38, "delivery", { description: "iFood" }),
    gasto("2026-10-05", 90, "vestuario", { description: "Shopee", paymentMethod: "credito" }), gasto("2026-10-07", 140, "lazer", { paymentMethod: "credito" }),
    gasto("2026-10-09", 12, "alimentacao", { description: "café" }), gasto("2026-10-09", 9, "alimentacao", { description: "pão de queijo" }),
    gasto("2026-10-10", 15, "restaurante", { description: "lanche" }), gasto("2026-10-11", 18, "alimentacao", { description: "docinho" }),
    gasto("2026-10-10", 70, "outros"),
  ],
  "finance-2026-setembro-expenses": [gasto("2026-09-22", 55, "delivery", { description: "iFood" }), gasto("2026-09-28", 200, "mercado", { paymentMethod: "credito" })],
  "finance-fixed-expenses": [
    { id: "f1", description: "Netflix", value: 45, category: "assinaturas" }, { id: "f2", description: "Spotify", value: 22, category: "assinaturas" }, { id: "f3", description: "Aluguel", value: 1500, category: "moradia" },
  ],
  "finance-dueDays": [{ day: 15, color: "yellow", bills: [{ id: "b1", name: "Luz", paid: false }, { id: "b2", name: "Internet", paid: true }] }],
  "finance-emergency-fund": { meses: 6, guardado: 500, registrada: true },
  "finance-incomes": [{ id: "r1", description: "Salário", value: 3200, date: "2026-10-05" }],
  "finance-2026-setembro-incomes": [{ id: "r0", description: "Salário", value: 3200, date: "2026-09-05" }],
});

/* ═══════════════════ o catálogo ═══════════════════ */

describe("catálogo: elegibilidade pelo dado da pessoa", () => {
  it("conta vazia: só os desafios que não dependem de hábito (anotar, dias zerados, categoria) — e nada quebra", () => {
    const d = dadosDe({}, SEMANA, QUARTA);
    const elegiveis = CATALOGO.filter((c) => c.elegivel(d)).map((c) => c.key);
    expect(elegiveis.sort()).toEqual(["registro-5-dias", "sem-outros", "tres-dias-zero"]);
    const ofertas = montarOfertas(d, { active: null, history: [] });
    expect(keys(ofertas).sort()).toEqual(["registro-5-dias", "sem-outros", "tres-dias-zero"]);
    for (const c of CATALOGO) expect(() => avaliarNoCatalogo(c, 1, d)).not.toThrow();
  });

  it("com hábito nas últimas 4 semanas tudo fica elegível: Uber (3 corridas), crédito (3 no credito), mercado (3 dias), marmita, formiga, comprinha, contas da semana, assinaturas, guarda", () => {
    const d = dadosDe(habito(), SEMANA, QUARTA);
    const elegiveis = CATALOGO.filter((c) => c.elegivel(d)).map((c) => c.key);
    for (const k of ["uber-2x", "sem-credito", "mercado-1x", "marmita", "gasto-formiga", "sem-comprinha-online", "contas-em-dia", "faxina-assinaturas", "guarda-da-semana", "sem-delivery", "sem-outros", "menos-que-passada", "role-com-teto"]) {
      expect(elegiveis, k).toContain(k);
    }
  });

  it("Uber só pra quem anotou 3+ corridas de app; 'transporte' sem Uber/99 na descrição é ônibus e não conta", () => {
    const dados = { "finance-expenses": [gasto("2026-10-06", 4.4, "transporte", { description: "ônibus" }), gasto("2026-10-07", 4.4, "transporte", { description: "metrô" }), gasto("2026-10-08", 22, "transporte", { description: "Uber" })] };
    expect(def("uber-2x").elegivel(dadosDe(dados, SEMANA, QUARTA))).toBe(false);
  });

  it("sem cartão de crédito só pra quem preenche paymentMethod 'credito' (3+); quem deixa o padrão não recebe", () => {
    const dados = { "finance-expenses": [gasto("2026-10-06", 20, "alimentacao", { paymentMethod: "boleto" }), gasto("2026-10-07", 20, "alimentacao", { paymentMethod: "pix" }), gasto("2026-10-08", 20, "alimentacao")] };
    expect(def("sem-credito").elegivel(dadosDe(dados, SEMANA, QUARTA))).toBe(false);
  });

  it("rolê com teto precisa de lazer na semana anterior (≥ R$ 40) e o teto é a metade, arredondado a R$ 5", () => {
    const dados = { "finance-expenses": [gasto("2026-10-06", 70, "lazer"), gasto("2026-10-09", 55, "entretenimento")] };
    const d = dadosDe(dados, SEMANA, QUARTA);
    expect(def("role-com-teto").elegivel(d)).toBe(true);
    expect(def("role-com-teto").titulo(1, d)).toBe("Rolê com teto: R$ 65"); // 125 / 2 = 62,5 → 65
    expect(def("role-com-teto").elegivel(dadosDe({ "finance-expenses": [gasto("2026-10-06", 30, "lazer")] }, SEMANA, QUARTA))).toBe(false);
  });

  it("'gastar menos que semana passada' só com semana anterior anotada em 3+ dias (senão a comparação não vale)", () => {
    expect(def("menos-que-passada").elegivel(dadosDe({ "finance-expenses": [gasto("2026-10-06", 500)] }, SEMANA, QUARTA))).toBe(false);
    expect(def("menos-que-passada").elegivel(dadosDe({ "finance-expenses": [gasto("2026-10-05", 50), gasto("2026-10-07", 50), gasto("2026-10-09", 50)] }, SEMANA, QUARTA))).toBe(true);
  });
});

describe("a trava de registro: desafio de restrição só vale com 4+ dias anotados", () => {
  const semDelivery = def("sem-delivery");

  it("semana inteira sem delivery mas só 2 dias anotados: NÃO vence — 'faltou anotar' (sem-registro)", () => {
    const d = dadosDe({ "finance-expenses": [gasto("2026-10-13", 30), gasto("2026-10-16", 25)] }, SEMANA, new Date(2026, 9, 19, 9));
    const ev = avaliarNoCatalogo(semDelivery, 1, d);
    expect(ev.done).toBe(false);
    expect(ev.failed).toBe(true);
    expect(ev.motivo).toBe("sem-registro");
    expect(ev.statusText).toMatch(/Faltou anotar/);
  });

  it("4 dias anotados (3 gastos + 1 'não gastei nada hoje') e zero delivery: vitória com os dois contadores", () => {
    const dados = { "finance-expenses": [gasto("2026-10-12", 30), gasto("2026-10-13", 25), gasto("2026-10-15", 40)], "finance-sem-gasto": { "2026-10-17": true } };
    const ev = avaliarNoCatalogo(semDelivery, 1, dadosDe(dados, SEMANA, new Date(2026, 9, 19, 9)));
    expect(ev.done).toBe(true);
    expect(ev.motivo).toBe("cumpriu");
    expect(ev.statusText).toBe("Semana limpa, zero delivery · 4 dias anotados 👑");
  });

  it("no meio da semana a linha mostra os dois contadores: '2 de 4 dias anotados · zero delivery até aqui'", () => {
    const d = dadosDe({ "finance-expenses": [gasto("2026-10-12", 30), gasto("2026-10-13", 25)] }, SEMANA, QUARTA);
    const ev = avaliarNoCatalogo(semDelivery, 1, d);
    expect(ev.failed).toBe(false);
    expect(ev.statusText).toBe(`2 de ${MIN_DIAS_ANOTADOS} dias anotados · zero delivery até aqui`);
  });

  it("quebrou a regra (um delivery): derrota por 'regra', mesmo com registro em dia", () => {
    const d = dadosDe({ "finance-expenses": [gasto("2026-10-12", 30), gasto("2026-10-13", 48, "delivery")] }, SEMANA, QUARTA);
    const ev = avaliarNoCatalogo(semDelivery, 1, d);
    expect(ev.failed).toBe(true);
    expect(ev.motivo).toBe("regra");
    expect(ev.statusText).toMatch(/Rolou um delivery/);
  });

  it("sábado com 1 dia anotado: ainda dá (hoje + domingo + ... não) → 1 + 2 < 4, já era por falta de registro", () => {
    const d = dadosDe({ "finance-expenses": [gasto("2026-10-12", 30)] }, SEMANA, new Date(2026, 9, 17, 10));
    expect(avaliarNoCatalogo(semDelivery, 1, d).motivo).toBe("sem-registro");
  });

  it("'gastar menos que semana passada' também exige registro: R$ 0 anotados não é vitória", () => {
    const dados = { "finance-expenses": [gasto("2026-10-05", 100), gasto("2026-10-07", 100), gasto("2026-10-09", 100)] };
    const ev = avaliarNoCatalogo(def("menos-que-passada"), 1, dadosDe(dados, SEMANA, new Date(2026, 9, 19, 9)));
    expect(ev.done).toBe(false);
    expect(ev.motivo).toBe("sem-registro");
  });

  it("ação positiva não tem trava: 'Anotar em 5 dias' fecha na hora com 5 dias; 'Contas da semana' conta as pagas", () => {
    const dados = { ...habito(), "finance-expenses": [12, 13, 14, 15, 16].map((dia) => gasto(`2026-10-${dia}`, 10)) };
    const d = dadosDe(dados, SEMANA, new Date(2026, 9, 16, 20));
    expect(avaliarNoCatalogo(def("registro-5-dias"), 1, d)).toMatchObject({ done: true, motivo: "cumpriu" });
    const contas = avaliarNoCatalogo(def("contas-em-dia"), 1, d);
    expect(contas.statusText).toBe("1 de 2 contas pagas");
    expect(contas.done).toBe(false);
  });
});

describe("níveis, retrato e confirmação", () => {
  it("Uber: 2x → 1x → semana do busão; o nível oferecido é um acima do maior vencido", () => {
    const uber = def("uber-2x");
    expect([1, 2, 3].map((n) => uber.titulo(n, dadosDe({}, SEMANA, QUARTA)))).toEqual(["Uber só 2x", "Uber só 1x", "Semana do busão"]);
    expect(nivelParaOferta(uber, [])).toBe(1);
    expect(nivelParaOferta(uber, [{ key: "uber-2x", weekStart: "2026-08-03", result: "win", nivel: 2 }])).toBe(3);
    expect(nivelParaOferta(uber, [{ key: "uber-2x", weekStart: "2026-08-03", result: "win", nivel: 3 }])).toBe(3);
    const d = dadosDe({ "finance-expenses": [gasto("2026-10-12", 22, "transporte", { description: "Uber" }), gasto("2026-10-13", 22, "transporte", { description: "99" }), gasto("2026-10-14", 22, "transporte", { description: "Uber" })] }, SEMANA, QUARTA);
    expect(avaliarNoCatalogo(uber, 1, d)).toMatchObject({ failed: true, motivo: "regra" });
    expect(avaliarNoCatalogo(uber, 1, { ...d, semana: d.semana.slice(0, 2) }).statusText).toBe("3 de 4 dias anotados · 2 de 2 corridas usadas");
  });

  it("guarda da semana: semana 42 do ano pede R$ 42; o retrato guarda quanto já tinha e o progresso é a diferença", () => {
    expect(semanaDoAno("2026-10-12")).toBe(42);
    expect(semanaDoAno("2026-01-05")).toBe(2);
    const guarda = def("guarda-da-semana");
    const d = dadosDe(habito(), SEMANA, QUARTA);
    expect(guarda.titulo(1, d)).toBe("Guarda R$ 42 (semana 42)");
    expect(guarda.titulo(2, d)).toBe("Guarda R$ 84");
    const ativo = escolher({ key: "guarda-da-semana", nivel: 1 }, d);
    expect(ativo).toEqual({ key: "guarda-da-semana", weekStart: SEMANA, nivel: 1, meta: { base: 500 } });
    const depois = dadosDe({ ...habito(), "finance-emergency-fund": { meses: 6, guardado: 520, registrada: true } }, SEMANA, QUARTA, ativo.meta);
    expect(avaliarNoCatalogo(guarda, 1, depois).statusText).toBe("R$ 20 de R$ 42 guardados");
    const venceu = dadosDe({ ...habito(), "finance-emergency-fund": { meses: 6, guardado: 545, registrada: true } }, SEMANA, QUARTA, ativo.meta);
    expect(avaliarNoCatalogo(guarda, 1, venceu).done).toBe(true);
  });

  it("faxina de assinaturas: vence tirando uma assinatura (contra o retrato) OU confirmando 'Revisei, todas valem'", () => {
    const faxina = def("faxina-assinaturas");
    const d = dadosDe(habito(), SEMANA, QUARTA);
    expect(faxina.desc(1, d)).toBe("Revisar suas 2 assinaturas (R$ 67/mês): cancela o que não usa ou confirma que todas valem");
    const ativo = escolher({ key: "faxina-assinaturas", nivel: 1 }, d);
    expect(ativo.meta).toEqual({ ids: ["f1", "f2"], total: 67 });
    expect(avaliarNoCatalogo(faxina, 1, d).statusText).toBe("2 assinaturas · R$ 67/mês · revisa e confirma");
    const semSpotify = dadosDe({ ...habito(), "finance-fixed-expenses": [{ id: "f1", description: "Netflix", value: 45, category: "assinaturas" }] }, SEMANA, QUARTA, ativo.meta);
    expect(avaliarNoCatalogo(faxina, 1, semSpotify)).toMatchObject({ done: true, statusText: "Faxina feita: 1 assinatura a menos 🧹" });
    const confirmou = dadosDe(habito(), SEMANA, QUARTA, { ...ativo.meta, revisado: "2026-10-14" });
    expect(avaliarNoCatalogo(faxina, 1, confirmou)).toMatchObject({ done: true, statusText: "Revisadas: todas valem ✓" });
  });

  it("'dias sem gastar': hoje só conta zerado com 'não gastei nada hoje'; dia passado sem gasto é zerado", () => {
    const zero = def("tres-dias-zero");
    const d = dadosDe({ "finance-expenses": [gasto("2026-10-12", 30)], "finance-sem-gasto": { "2026-10-14": true } }, SEMANA, QUARTA);
    // seg gastou, ter zerado (passou sem gasto), qua zerado (marcado) → 2 de 2 → vitória do nível 1, com 3 dias anotados? não: trava de 4
    const ev = avaliarNoCatalogo(zero, 1, d);
    expect(ev.done).toBe(false);
    expect(ev.statusText).toBe("2 de 4 dias anotados · regra cumprida, anota hoje e fecha 👊");
  });
});

/* ═══════════════════ o rodízio ═══════════════════ */

describe("rodízio: 3 opções, sem repetir em 4 semanas, variação e revanche", () => {
  const d = () => dadosDe(habito(), SEMANA, QUARTA);

  it("monta 3 opções, estáveis dentro da semana, com ao menos 1 ação positiva", () => {
    const a = montarOfertas(d(), { active: null, history: [] });
    const b = montarOfertas(d(), { active: null, history: [] });
    expect(a.itens).toHaveLength(3);
    expect(a).toEqual(b);
    expect(a.itens.some((i) => def(i.key).tipo === "acao")).toBe(true);
    expect(new Set(keys(a)).size).toBe(3);
  });

  it("chave usada há 2 semanas não volta; há 5 semanas volta", () => {
    const todas = new Set<string>();
    for (const h of [{ key: "uber-2x", weekStart: "2026-09-28", result: "win" as const, nivel: 3 }]) {
      const o = montarOfertas(d(), { active: null, history: [h] });
      keys(o).forEach((k) => todas.add(k));
      expect(keys(o)).not.toContain("uber-2x");
    }
    // 5 semanas atrás: livre de novo — força a situação em que seria escolhida (tudo o mais em descanso)
    const descanso = CATALOGO.filter((c) => c.key !== "uber-2x").map((c) => ({ key: c.key, weekStart: "2026-10-05", result: "loss" as const, nivel: 1, motivo: "regra" as const }));
    const o = montarOfertas(d(), { active: null, history: [...descanso, { key: "uber-2x", weekStart: "2026-09-07", result: "win", nivel: 1 }] });
    expect(keys(o)).toContain("uber-2x");
    expect(o.itens.find((i) => i.key === "uber-2x")?.nivel).toBe(2);
  });

  it("venceu semana passada → a mesma chave volta como VARIAÇÃO no nível seguinte; venceu o último nível → descansa", () => {
    const venceu1 = montarOfertas(d(), { active: null, history: [{ key: "uber-2x", weekStart: "2026-10-05", result: "win", nivel: 1 }] });
    expect(venceu1.itens[0]).toEqual({ key: "uber-2x", nivel: 2, origem: "variacao" });
    const venceu3 = montarOfertas(d(), { active: null, history: [{ key: "uber-2x", weekStart: "2026-10-05", result: "win", nivel: 3 }] });
    expect(keys(venceu3)).not.toContain("uber-2x");
  });

  it("perdeu por FALTA DE REGISTRO → revanche (mesma chave, mesmo nível); perdeu quebrando a regra → descansa", () => {
    const faltou = montarOfertas(d(), { active: null, history: [{ key: "sem-delivery", weekStart: "2026-10-05", result: "loss", nivel: 1, motivo: "sem-registro" }] });
    expect(faltou.itens[0]).toEqual({ key: "sem-delivery", nivel: 1, origem: "revanche" });
    const quebrou = montarOfertas(d(), { active: null, history: [{ key: "sem-delivery", weekStart: "2026-10-05", result: "loss", nivel: 1, motivo: "regra" }] });
    expect(keys(quebrou)).not.toContain("sem-delivery");
    // registro antigo (sem nivel) vencido: a variação também vale, como nível 1 → 2
    expect(variacaoDaSemanaPassada(d(), [{ key: "tres-dias-zero", weekStart: "2026-10-05", result: "win" }])).toEqual({ key: "tres-dias-zero", nivel: 2, origem: "variacao" });
  });

  it("tudo em descanso: repete a usada há mais tempo em vez de deixar o card vazio", () => {
    const dConta = dadosDe({}, SEMANA, QUARTA); // só 3 elegíveis
    const history = [
      { key: "registro-5-dias", weekStart: "2026-09-21", result: "loss" as const, nivel: 1, motivo: "nao-cumpriu" as const },
      { key: "tres-dias-zero", weekStart: "2026-09-28", result: "loss" as const, nivel: 1, motivo: "regra" as const },
      { key: "sem-outros", weekStart: "2026-10-05", result: "loss" as const, nivel: 1, motivo: "nao-cumpriu" as const },
    ];
    const o = montarOfertas(dConta, { active: null, history });
    expect(keys(o)).toEqual(["registro-5-dias", "tres-dias-zero", "sem-outros"]); // da mais antiga pra mais recente
  });
});

describe("calendário", () => {
  it("Black Friday 2026 é 27/11; as semanas de tentação são 09–15/11 e 23–29/11", () => {
    expect(blackFridayDe(2026)).toBe("2026-11-27");
    expect(semanaPreBlackFriday("2026-11-09")).toBe(true);
    expect(semanaPreBlackFriday("2026-11-23")).toBe(true);
    expect(semanaPreBlackFriday("2026-11-16")).toBe(false);
  });

  it("na semana da Black Friday 'sem comprinha online' vem na frente, mesmo em descanso, e basta ter roupa/eletrônico no histórico", () => {
    const dados = { "finance-expenses": [gasto("2026-11-03", 150, "vestuario", { description: "tênis" })], "finance-2026-outubro-expenses": [gasto("2026-10-20", 90, "eletronicos")] };
    const d = dadosDe(dados, "2026-11-23", new Date(2026, 10, 23, 9));
    expect(d.calendario.blackFriday).toBe(true);
    const o = montarOfertas(d, { active: null, history: [{ key: "sem-comprinha-online", weekStart: "2026-11-09", result: "win", nivel: 1 }] });
    expect(o.itens[0]).toEqual({ key: "sem-comprinha-online", nivel: 2, origem: "calendario" });
  });

  it("dia do pagamento inferido do 'Salário' em 2 meses (dia 5) → a semana que contém o dia 5 prioriza 'guarda da semana'", () => {
    const dados = habito();
    expect(inferirDiaDoPagamento(lerDe(dados), "pessoal", new Date(2026, 9, 14))).toBe(5);
    expect(inferirDiaDoPagamento(lerDe({ "finance-incomes": dados["finance-incomes"] }), "pessoal", new Date(2026, 9, 14))).toBeNull(); // 1 mês só: não sabe
    const semanaDo5 = dadosDe(dados, "2026-10-05", new Date(2026, 9, 5, 9));
    expect(semanaDo5.calendario.pagamento).toBe(true);
    expect(montarOfertas(semanaDo5, { active: null, history: [] }).itens[0]).toMatchObject({ key: "guarda-da-semana", origem: "calendario" });
    expect(dadosDe(dados, SEMANA, QUARTA).calendario.pagamento).toBe(false);
  });

  it("dezembro prioriza 'rolê com teto' (quando a semana anterior teve lazer)", () => {
    const dados = { "finance-expenses": [gasto("2026-12-03", 120, "lazer"), gasto("2026-12-04", 60, "entretenimento")] };
    const d = dadosDe(dados, "2026-12-07", new Date(2026, 11, 7, 9));
    expect(d.calendario.dezembro).toBe(true);
    expect(montarOfertas(d, { active: null, history: [] }).itens[0]).toMatchObject({ key: "role-com-teto", origem: "calendario" });
  });
});

/* ═══════════════════ fechamento e compatibilidade ═══════════════════ */

describe("fechamento da semana que passou (regra nova × regra antiga)", () => {
  const dadosDa = (dados: Record<string, unknown>, hoje: Date) => (weekStart: string, meta: Record<string, unknown>) => dadosDe(dados, weekStart, hoje, meta);
  const SEG_SEGUINTE = new Date(2026, 9, 19, 9);

  it("ativo do catálogo (com nivel), sem delivery mas só 2 dias anotados → derrota 'sem-registro'", () => {
    const estado: ChallengesState = { active: { key: "sem-delivery", weekStart: SEMANA, nivel: 1 }, history: [] };
    const r = fecharSemana(estado, dadosDa({ "finance-expenses": [gasto("2026-10-13", 30), gasto("2026-10-16", 25)] }, SEG_SEGUINTE), SEG_SEGUINTE);
    expect(r?.registro).toEqual({ key: "sem-delivery", weekStart: SEMANA, nivel: 1, result: "loss", motivo: "sem-registro" });
    expect(r?.estado.active).toBeNull();
  });

  it("o mesmo ativo ESCOLHIDO PELO APP ANTIGO (sem nivel) fecha pela regra antiga: 2 dias anotados e zero delivery = vitória", () => {
    const estado: ChallengesState = { active: { key: "sem-delivery", weekStart: SEMANA }, history: [] };
    const r = fecharSemana(estado, dadosDa({ "finance-expenses": [gasto("2026-10-13", 30), gasto("2026-10-16", 25)] }, SEG_SEGUINTE), SEG_SEGUINTE);
    expect(r?.registro).toEqual({ key: "sem-delivery", weekStart: SEMANA, result: "win" });
  });

  it("4 dias anotados e zero delivery → vitória 'cumpriu' com nivel; ofertas de semana velha saem", () => {
    const estado: ChallengesState = { active: { key: "sem-delivery", weekStart: SEMANA, nivel: 1 }, history: [], ofertas: { weekStart: SEMANA, itens: [{ key: "sem-delivery", nivel: 1 }] } };
    const dados = { "finance-expenses": [12, 13, 15, 17].map((dia) => gasto(`2026-10-${dia}`, 20)) };
    const r = fecharSemana(estado, dadosDa(dados, SEG_SEGUINTE), SEG_SEGUINTE);
    expect(r?.registro).toEqual({ key: "sem-delivery", weekStart: SEMANA, nivel: 1, result: "win", motivo: "cumpriu" });
    expect(r?.estado.ofertas).toBeUndefined();
  });

  it("desafio desta semana não é mexido; vitória já no histórico só libera", () => {
    expect(fecharSemana({ active: { key: "sem-delivery", weekStart: SEMANA, nivel: 1 }, history: [] }, dadosDa({}, QUARTA), QUARTA)).toBeNull();
    const r = fecharSemana({ active: { key: "uber-2x", weekStart: SEMANA, nivel: 1 }, history: [{ key: "uber-2x", weekStart: SEMANA, result: "win", nivel: 1 }] }, dadosDa({}, SEG_SEGUINTE), SEG_SEGUINTE);
    expect(r).toEqual({ estado: { active: null, history: [{ key: "uber-2x", weekStart: SEMANA, result: "win", nivel: 1 }] }, registro: null });
  });
});

describe("compatibilidade com o app antigo (a chave sincroniza; só ganhou campos opcionais)", () => {
  const estadoNovo = {
    active: { key: "faxina-assinaturas", weekStart: SEMANA, nivel: 1, meta: { ids: ["f1"], total: 45 } },
    history: [
      { key: "sem-delivery", weekStart: "2026-09-28", result: "win" },
      { key: "uber-2x", weekStart: "2026-10-05", result: "loss", nivel: 1, motivo: "sem-registro" },
      { key: "guarda-da-semana", weekStart: "2026-10-05", result: "win", nivel: 2, motivo: "cumpriu" },
    ],
    ofertas: { weekStart: SEMANA, itens: [{ key: "faxina-assinaturas", nivel: 1, origem: "nova" }] },
  };

  /** O leitor do app publicado (challenges.ts até 1.0.15), copiado como está. */
  const lerDesafiosAntigo = (v: unknown) => {
    const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    const a = o.active as { key?: unknown; weekStart?: unknown } | undefined;
    const active = a && typeof a.key === "string" && typeof a.weekStart === "string" ? { key: a.key, weekStart: a.weekStart } : null;
    const history = Array.isArray(o.history) ? o.history.filter((h) => h && typeof h.key === "string" && typeof h.weekStart === "string") : [];
    return { active, history };
  };

  it("o leitor antigo lê o estado novo sem quebrar e vê active/history como sempre", () => {
    const lido = lerDesafiosAntigo(estadoNovo);
    expect(lido.active).toEqual({ key: "faxina-assinaturas", weekStart: SEMANA });
    expect(lido.history).toHaveLength(3);
  });

  it("as insígnias (badges-financas) contam qualquer vitória, antiga ou nova: 2 vencidos", () => {
    const get = <T,>(k: string, f: T): T => (k === "finance-challenges" ? (estadoNovo as unknown as T) : f);
    expect(medirFinancas(get).challengeWins).toBe(2);
  });

  it("o fechamento ANTIGO (fecharSemanaDoDesafio) com uma chave que ele não conhece não quebra: libera e marca derrota (limitação conhecida, dedupe por semana+key)", () => {
    const r = fecharSemanaDoDesafio(estadoNovo, () => [], new Date(2026, 9, 19, 9));
    expect(r?.active).toBeNull();
    expect(r?.history[3]).toEqual({ key: "faxina-assinaturas", weekStart: SEMANA, result: "loss" });
  });

  it("o leitor novo tolera lixo: texto, lista, nivel inválido, ofertas tortas", () => {
    expect(lerDesafios("x")).toEqual({ active: null, history: [] });
    expect(lerDesafios([1, 2])).toEqual({ active: null, history: [] });
    expect(lerDesafios({ active: { key: "a", weekStart: "2026-10-12", nivel: "2", meta: [1] }, history: [{ key: "b" }, null, { key: "c", weekStart: "2026-10-05", result: "win", nivel: 0 }], ofertas: { weekStart: 5 } }))
      .toEqual({ active: { key: "a", weekStart: "2026-10-12" }, history: [{ key: "c", weekStart: "2026-10-05", result: "win" }] });
  });
});

describe("a chave remota desafios_rodizio", () => {
  it("padrão ligado; metadata 'off' desliga (a current vence); força de QA na web manda em tudo", () => {
    expect(desafiosRodizioLigado()).toBe(true);
    expect(lerChaveRemotaDesafiosRodizio({ current: { metadata: { desafios_rodizio: "off" } }, all: { x: { metadata: { desafios_rodizio: "on" } } } })).toBe("off");
    registrarDesafiosRodizioRemoto({ current: { metadata: { desafios_rodizio: "off" } }, all: {} });
    expect(desafiosRodizioLigado()).toBe(false);
    localStorage.setItem(CHAVE_FORCA_DESAFIOS_RODIZIO, "on");
    expect(desafiosRodizioLigado()).toBe(true);
  });
});

/* ═══════════════════ o card ═══════════════════ */

const criarStore = (inicial: Record<string, unknown>) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const sistema: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown, opts?: { system?: boolean }) => { dados[key] = JSON.parse(JSON.stringify(value)); if (opts?.system) sistema.push(key); },
    loaded: true,
    isGuest: false,
    fetchKey: async () => null,
  };
  return { dados, sistema, valor };
};
const desafios = (dados: Record<string, unknown>) => dados["finance-challenges"] as ChallengesState;
const eventos = (nome: string) => (trackEvent as Mock).mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
const montar = (store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}><WeeklyChallenge expenses={(store.dados["finance-expenses"] as never) ?? []} /></UserDataContext.Provider>);

describe("o card: segunda com 3 opções, escolha, meio da semana, virada", () => {
  it("conta vazia: as 3 opções sem hábito, a nota da trava, ofertas gravadas como ESCRITA DE SISTEMA e o evento desafio_ofertas (1x)", async () => {
    quando(2026, 10, 12);
    const store = criarStore({});
    montar(store);
    await act(async () => {});
    expect(screen.getByText("DESAFIO DA SEMANA")).toBeInTheDocument();
    expect(screen.getByTestId("oferta-registro-5-dias")).toBeInTheDocument();
    expect(screen.getByTestId("oferta-tres-dias-zero")).toBeInTheDocument();
    expect(screen.getByTestId("oferta-sem-outros")).toBeInTheDocument();
    expect(screen.getByText(/só vale com 4\+ dias anotados/)).toBeInTheDocument();
    expect(desafios(store.dados).ofertas?.weekStart).toBe("2026-10-12");
    expect(store.sistema).toEqual(["finance-challenges"]);
    expect(eventos("desafio_ofertas")).toHaveLength(1);
    expect(eventos("desafio_ofertas")[0]).toMatchObject({ weekStart: "2026-10-12" });
    expect(eventos("desafio_ofertas")[0].keys).toHaveLength(3);
  });

  it("escolher grava active com nivel (gesto da pessoa, sem system) e dispara desafio_escolhido; o card vira progresso", async () => {
    quando(2026, 10, 12);
    const store = criarStore({});
    montar(store);
    await act(async () => {});
    fireEvent.click(screen.getByTestId("oferta-registro-5-dias"));
    await act(async () => {});
    expect(desafios(store.dados).active).toEqual({ key: "registro-5-dias", weekStart: "2026-10-12", nivel: 1 });
    expect(eventos("desafio_escolhido")[0]).toMatchObject({ key: "registro-5-dias", nivel: 1 });
    expect(screen.getByTestId("desafio-ativo")).toBeInTheDocument();
    expect(screen.getByTestId("desafio-status")).toHaveTextContent("0 de 5 dias anotados");
  });

  it("meio da semana: 'Semana sem delivery' com 2 dias anotados mostra os dois contadores", async () => {
    quando(2026, 10, 14);
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-10-12", nivel: 1 }, history: [] },
      "finance-expenses": [gasto("2026-10-12", 30), gasto("2026-10-13", 25)],
    });
    montar(store);
    await act(async () => {});
    expect(screen.getByText("Semana sem delivery")).toBeInTheDocument();
    expect(screen.getByTestId("desafio-status")).toHaveTextContent("2 de 4 dias anotados · zero delivery até aqui");
  });

  it("virada com relógio simulado: ativo da semana passada sem registro fecha como 'faltou anotar' e volta como REVANCHE nas opções", async () => {
    quando(2026, 10, 19); // segunda seguinte
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-10-12", nivel: 1 }, history: [] },
      "finance-expenses": [gasto("2026-10-13", 30), gasto("2026-10-16", 25), gasto("2026-10-01", 48, "delivery", { description: "iFood" })],
    });
    montar(store);
    await act(async () => {});
    await act(async () => {});
    const s = desafios(store.dados);
    expect(s.history).toEqual([{ key: "sem-delivery", weekStart: "2026-10-12", nivel: 1, result: "loss", motivo: "sem-registro" }]);
    expect(s.active).toBeNull();
    expect(eventos("desafio_fechado")[0]).toMatchObject({ key: "sem-delivery", venceu: false, motivo: "sem-registro" });
    expect(s.ofertas?.weekStart).toBe("2026-10-19");
    expect(s.ofertas?.itens[0]).toEqual({ key: "sem-delivery", nivel: 1, origem: "revanche" });
    expect(screen.getByTestId("oferta-sem-delivery")).toHaveTextContent(/revanche/i);
  });

  it("derrota pela regra + 'Escolher outro desafio': a derrota entra no histórico com motivo 'regra' e as opções voltam sem essa chave", async () => {
    quando(2026, 10, 14);
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-10-12", nivel: 1 }, history: [], ofertas: { weekStart: "2026-10-12", itens: [{ key: "sem-delivery", nivel: 1 }, { key: "registro-5-dias", nivel: 1 }, { key: "tres-dias-zero", nivel: 1 }] } },
      "finance-expenses": [gasto("2026-10-12", 30), gasto("2026-10-13", 48, "delivery")],
    });
    montar(store);
    await act(async () => {});
    expect(screen.getByTestId("desafio-status")).toHaveTextContent(/Rolou um delivery/);
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro desafio/ }));
    await act(async () => {});
    const s = desafios(store.dados);
    expect(s.history).toEqual([{ key: "sem-delivery", weekStart: "2026-10-12", nivel: 1, result: "loss", motivo: "regra" }]);
    expect(screen.queryByTestId("oferta-sem-delivery")).toBeNull();
    expect(screen.getByTestId("oferta-registro-5-dias")).toBeInTheDocument();
  });

  it("'Revisei, todas valem' fecha a faxina de assinaturas na hora (vitória no histórico, com nivel)", async () => {
    quando(2026, 10, 14);
    const store = criarStore({
      ...habito(),
      "finance-challenges": { active: { key: "faxina-assinaturas", weekStart: "2026-10-12", nivel: 1, meta: { ids: ["f1", "f2"], total: 67 } }, history: [] },
    });
    montar(store);
    await act(async () => {});
    expect(screen.getByTestId("desafio-status")).toHaveTextContent("2 assinaturas · R$ 67/mês · revisa e confirma");
    fireEvent.click(screen.getByRole("button", { name: /Revisei, todas valem/ }));
    await act(async () => {});
    expect(screen.getByText("Desafio cumprido!")).toBeInTheDocument();
    expect(desafios(store.dados).history).toEqual([{ key: "faxina-assinaturas", weekStart: "2026-10-12", result: "win", nivel: 1, motivo: "cumpriu" }]);
  });

  it("chave DESLIGADA (força de QA 'off'): o card de sempre, com as 4 opções antigas e sem gravar ofertas", async () => {
    quando(2026, 10, 12);
    localStorage.setItem(CHAVE_FORCA_DESAFIOS_RODIZIO, "off");
    const store = criarStore({});
    montar(store);
    await act(async () => {});
    for (const t of ["Semana sem delivery", "3 dias sem gastar", "Registrar em 5 dias", "Gastar menos que semana passada"]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.queryByTestId("desafio-ofertas")).toBeNull();
    expect(store.dados["finance-challenges"]).toBeUndefined();
  });

  it("ativo escolhido pelo app antigo (sem nivel) continua com a regra antiga no card", async () => {
    quando(2026, 10, 14);
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-10-12" }, history: [] },
      "finance-expenses": [gasto("2026-10-12", 30)],
    });
    montar(store);
    await act(async () => {});
    expect(screen.getByTestId("desafio-status")).toHaveTextContent("3/7 dias limpos — segue firme.");
  });
});

describe("fecha na ABERTURA do app (hook), com a regra nova", () => {
  const SemPainel = () => { useFechamentoDoDesafio(); return <p>home</p>; };

  it("4 dias anotados e zero delivery → vitória 'cumpriu' gravada como sistema + evento desafio_fechado (origem abertura)", async () => {
    quando(2026, 10, 19);
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-10-12", nivel: 1 }, history: [] },
      "finance-expenses": [12, 13, 15, 17].map((dia) => gasto(`2026-10-${dia}`, 20)),
    });
    render(<UserDataContext.Provider value={store.valor}><SemPainel /></UserDataContext.Provider>);
    await act(async () => {});
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(desafios(store.dados).history).toEqual([{ key: "sem-delivery", weekStart: "2026-10-12", nivel: 1, result: "win", motivo: "cumpriu" }]);
    expect(store.sistema).toContain("finance-challenges");
    expect(eventos("desafio_fechado")[0]).toMatchObject({ key: "sem-delivery", venceu: true, motivo: "cumpriu", origem: "abertura" });
  });
});
