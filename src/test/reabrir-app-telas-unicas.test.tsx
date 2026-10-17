/**
 * USAR → FECHAR O APP → REABRIR (14/10, chamado: "toda vez que eu entro aparece o tutorial").
 *
 * Cada abertura monta o UserDataProvider com `lastUserIdRef = null`; quando o usuário chega,
 * o efeito de troca de conta roda a vassoura (purgeUserLocalCache). Aqui a abertura é de
 * verdade: o provedor monta, varre e hidrata (servidor mockado, vazio) — duas vezes seguidas —
 * e depois a pessoa ainda sai da conta (purgeLocalUserCache, a vassoura do logout).
 * As telas de uma vez só continuam "vistas"; o cache da conta continua indo embora.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";

const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
vi.mock("@/hooks/use-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-auth")>()),
  useAuth: () => auth,
}));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), markActivation: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => {
  const selecao = { eq: () => selecao, order: () => selecao, range: () => selecao, in: () => Promise.resolve({ data: [], error: null }), abortSignal: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) };
  return {
    supabase: {
      from: () => ({ select: () => selecao, upsert: () => Promise.resolve({ error: null }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      // 16/10: a sessão do auth acompanha o usuário logado do useAuth — o use-user-data só aceita a
      // leitura da conta com token desta conta (sem sessão, a RLS devolve vazio sem erro).
      auth: { getSession: async () => ({ data: { session: { access_token: "t", user: auth.user } } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});

import { UserDataProvider, useUserData } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { CHAVE_TOUR_FEITO, cartoesVistosNesteAparelho, marcarCartoesVistos, marcarTourFeito, tourFeitoNesteAparelho } from "@/lib/tour-home";
import { CHAVE_DICA_DESLIZAR } from "@/components/cartoes-modulo/CartoesDoModulo";
import { CHAVE_DIA_100_VISTO } from "@/components/home/DayScoreRing";
import { diasDeUso, registrarRecusaDeValor } from "@/lib/avaliacao";
import { momentoRuimRecente, registrarMomentoRuim } from "@/lib/momento-ruim";
import { localDayKey } from "@/lib/utils";

const MODULOS = ["financas", "treino", "saude", "rotina", "dieta"];

/** Uma abertura do app: monta o provedor, espera varrer e hidratar, e fecha. */
const abrirEFecharOApp = async () => {
  let carregou = false;
  const Sonda = () => { carregou = useUserData().loaded; return null; };
  render(<UserDataProvider><Sonda /></UserDataProvider>);
  await waitFor(() => expect(carregou).toBe(true));
  cleanup();
};

/** O que a pessoa "viu"/fez neste aparelho no 1º uso. */
const usarOApp = () => {
  marcarTourFeito();
  MODULOS.forEach(marcarCartoesVistos);
  localStorage.setItem(CHAVE_DICA_DESLIZAR, new Date().toISOString());
  localStorage.setItem(CHAVE_DIA_100_VISTO, localDayKey());
  localStorage.setItem("core-dias-de-uso", JSON.stringify(["2026-10-12", "2026-10-13"]));
  registrarRecusaDeValor();
  registrarMomentoRuim("aviso_cobranca_view");
  for (const [k, v] of [
    ["core-avaliacao-total", "1"], ["core-avaliacao-ultima", String(Date.now())], ["core-avaliacao-convite-em", String(Date.now())],
    ["core-att-status", "denied"], ["core-saida-vista", "123"], ["core-lembrete-teste", JSON.stringify({ fimMs: Date.now() + 3 * 864e5, precoAno: "R$ 97,90" })],
    ["core-funil-w-area", JSON.stringify({ v: "dinheiro", t: Date.now() })], ["core-area-landed", "true"],
    ["core-boas-vindas-visto", "1"], ["core-dia2", "{}"], ["core-presente69-cancelou-visto", "1"],
    // 1.0.16: o teste "missão 1 por dia" — a resposta do RevenueCat, o braço e o convite do dia (dentro da missão),
    // o Montar Finanças decidido, as aberturas do tour curto, a resposta remota do tour e as decisões do dia 1
    // (boas-vindas, plano de amanhã, dicas, adesivos mostrados, o score de antes) — tudo dentro da missão
    ["core-missao-1-por-dia", "ab"], ["core-dia1-braco", "A"], ["core-tour-home-remoto", "curto"], ["core-home-tour-vistas", "1"],
    ["core-montar-financas", JSON.stringify({ r: "pronto", em: "2026-10-12T15:00:00.000Z" })],
    ["missao-doses", JSON.stringify({
      v: 1, inicio: "2026-10-12", modulos: ["financas", "rotina", "saude"], feitos: { 1: { dia: "2026-10-12", rotulo: "Pode gastar R$ 61 por dia" } }, boasVindas: true, braco: "A",
      convites: { "2026-10-13": "depois" }, convitesVistos: { "2026-10-13": 1 }, lembrete: "20h", dicas: { 2: "2026-10-13" }, adesivosMostrados: ["first-income"], scoreAntes: { 2: 20 },
    })],
    // 16/10: a força de QA da Conquistas 2 (sem prefixo varrido) e o toast que já apareceu (core-festas-mostradas)
    ["conquistas2-force", "on"], ["core-festas-mostradas", JSON.stringify(["first-expense", "sequencia-2"])],
  ] as const) localStorage.setItem(k, v);
  // dado da CONTA (cache do user_data) e chaves antigas sem namespace: a vassoura leva
  localStorage.setItem("u:u1:finance-expenses", JSON.stringify([{ id: 1 }]));
  localStorage.setItem("u:u1:conquistas-vistas", JSON.stringify({ adesivos: ["a"], marcos: [] }));
  localStorage.setItem("finance-expenses", "[]");
  localStorage.setItem("core-dieta-log", "{}");
};

const esperarTudoVisto = () => {
  expect(tourFeitoNesteAparelho()).toBe(true);
  for (const m of MODULOS) expect(cartoesVistosNesteAparelho(m), `cartões de ${m}`).toBe(true);
  expect(localStorage.getItem(CHAVE_DICA_DESLIZAR)).not.toBeNull();
  expect(localStorage.getItem(CHAVE_DIA_100_VISTO)).toBe(localDayKey());
  expect(diasDeUso()).toBe(2);
  expect(localStorage.getItem("core-avaliacao-valor-recusas")).toBe("1");
  expect(momentoRuimRecente()).toBe(true);
  for (const k of ["core-avaliacao-total", "core-avaliacao-ultima", "core-avaliacao-convite-em", "core-att-status", "core-saida-vista",
    "core-lembrete-teste", "core-funil-w-area", "core-area-landed", "core-boas-vindas-visto", "core-dia2", "core-presente69-cancelou-visto",
    "core-missao-1-por-dia", "core-dia1-braco", "missao-doses", "core-montar-financas", "core-tour-home-remoto", "core-home-tour-vistas",
    "conquistas2-force", "core-festas-mostradas"]) {
    expect(localStorage.getItem(k), k).not.toBeNull();
  }
  const missao = JSON.parse(localStorage.getItem("missao-doses")!);
  expect(missao.convites).toEqual({ "2026-10-13": "depois" });
  expect(missao).toMatchObject({ boasVindas: true, lembrete: "20h", dicas: { 2: "2026-10-13" }, adesivosMostrados: ["first-income"], feitos: { 1: { dia: "2026-10-12" } } });
  expect(JSON.parse(localStorage.getItem("core-montar-financas")!).r).toBe("pronto");
};

const esperarContaVarrida = () => {
  for (const k of ["u:u1:finance-expenses", "u:u1:conquistas-vistas", "finance-expenses", "core-dieta-log"]) {
    expect(localStorage.getItem(k), k).toBeNull();
  }
};

describe("reabrir o app não traz de volta as telas de uma vez só", () => {
  beforeEach(() => { localStorage.clear(); cleanup(); });

  it("usar → fechar → reabrir (2×): tour, cartões, dica, dia 100 e travas da avaliação continuam vistos", async () => {
    usarOApp();
    await abrirEFecharOApp();
    esperarTudoVisto();
    esperarContaVarrida();
    await abrirEFecharOApp();
    esperarTudoVisto();
    expect(localStorage.getItem(CHAVE_TOUR_FEITO)).not.toBeNull();
  });

  it("sair da conta (vassoura do logout) também não leva o que é do aparelho", () => {
    usarOApp();
    purgeLocalUserCache();
    esperarTudoVisto();
    esperarContaVarrida();
  });
});
