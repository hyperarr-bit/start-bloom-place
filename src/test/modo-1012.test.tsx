/**
 * 1.0.21 — MODO DE BUILD "1.0.12" (`VITE_MODO_1012=1`, lib/modo-1012; dono 27/10, pelos dados).
 *
 * A experiência da 1.0.12 (build 34) + Home nova + sem tutorial/dicas + os consertos de hoje. A env deixa FIXOS os
 * comportamentos da 1.0.12 e IGNORA as chaves remotas que contrariam (a metadata do RevenueCat vale também pros apps
 * no ar). Sem a env: o app de hoje (os testes antigos seguem passando).
 *
 * Aqui: as decisões das libs (funil antigo, paywall longo, sem sino/motivos/ofertas, cobrança da 1.0.14 LIGADA,
 * avaliação da 1.0.12, enxuto fixo, braço "1 por dia"), a missão nas telas da 1.0.12 por cima da Home nova (convite
 * "Seu CORE tá pronto" com "Trocar os 3 módulos" sem a Beleza, "Qual foi o seu último gasto?", "Primeiro registro
 * feito!" com a hora do lembrete, 1 dose por dia) e a regra das festas do dono (dia 1 até 3, dias 2–3 até 2, 1 por
 * abertura, rara sempre, sem esperar a missão sair). O paywall e o pós-compra estão em
 * src/pages/funis/ios/paywall-ios.test.tsx e cadastro-ios-v1017.test.tsx (blocos "modo 1.0.12").
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString(), assina: true }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, isSubscribed: conta.assina }) }));
const notif = vi.hoisted(() => ({ pedirDia2: vi.fn(async (_o: string) => "concedeu" as const), regua: vi.fn(async () => {}), pedir: vi.fn(async () => true) }));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: (...a: unknown[]) => notif.regua(...(a as [])),
  pedirPermissao: () => notif.pedir(),
  pedirPermissaoDia2: (o: string) => notif.pedirDia2(o),
}));

import { modo1012, camposModo1012 } from "@/lib/modo-1012";
import { funilCalaiLigado } from "@/lib/funil-calai";
import { onboarding1TelaLigado } from "@/lib/onboarding-1tela";
import { ofertaLigada, type NomeDaOferta } from "@/lib/ofertas-saida";
import { modoSino, registrarSinoRemoto } from "@/lib/sino-paywall";
import { modoMotivos } from "@/lib/mensal-degraus";
import { cobrancaV14Ligada } from "@/lib/cobranca-recusada";
import { avaliacaoV14Ligada } from "@/lib/avaliacao-v14";
import { modoAvaliacaoTesteDia2 } from "@/lib/avaliacao-teste-dia2";
import { modoDias23 } from "@/lib/dias23";
import { modoAttMomento } from "@/lib/att-momento";
import { fluxoEnxutoLigado, registrarFluxoEnxutoRemoto } from "@/lib/fluxo-enxuto";
import { bracoDia1, modoUmPorDia, registrarUmPorDiaRemoto } from "@/lib/dia1-cheio";
import { montarFinancasLigado } from "@/lib/montar-financas";
import { montarRotinaLigado } from "@/lib/montar-rotina";
import { introLigada } from "@/lib/intro-modulo";
import { cartoesLigados, tourHomeLigado } from "@/lib/tour-home";
import { consumirAvisoMenuNovo } from "@/lib/menu-novo";
import { deveMostrarDica } from "@/components/conquistas/DicaDoPlanner";
import {
  DIAS_DE_CALMA, MAX_FESTAS_DIA_1, MAX_FESTAS_DIAS_2_E_3, MIN_NO_FUNDO_NOVA_ABERTURA_MS, _fundoFestas, _novaAberturaFestas,
  aplicarCalma, calmaDasFestasVale, diaDaConta, maxFestasNoDia, registrarFestaNaCalma,
} from "@/lib/festas-calma";
import { UserDataContext } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { CHAVE_ESTADO_MISSAO_DOSES, doseAbreHoje, iniciarMissao, lerMissao, modulosDaEscolha, opcoesDoDia2, type EstadoMissaoDoses } from "@/lib/missao-doses";

const G = globalThis as { __MODO_1012__?: unknown; __FLUXO_ENXUTO_PADRAO_APP__?: string };
let padraoEnxuto: string | undefined;
const iPhone = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  padraoEnxuto = G.__FLUXO_ENXUTO_PADRAO_APP__;
  G.__MODO_1012__ = true;
  iPhone();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete G.__MODO_1012__;
  G.__FLUXO_ENXUTO_PADRAO_APP__ = padraoEnxuto;
  delete (window as { Capacitor?: unknown }).Capacitor;
});

/* ───────────────────────────── as decisões das libs ───────────────────────────── */
describe("o modo fixa os comportamentos da 1.0.12 (e ignora as chaves remotas que contrariam)", () => {
  it("sem a env/global o modo está desligado (o app de hoje)", () => {
    delete G.__MODO_1012__;
    expect(modo1012()).toBe(false);
    expect(camposModo1012()).toEqual({});
    G.__MODO_1012__ = true;
    expect(modo1012()).toBe(true);
    expect(camposModo1012()).toEqual({ modo_1012: true });
  });

  it("funil antigo: sem Cal AI e sem o onboarding de 1 tela, mesmo com a força de QA ligando", () => {
    localStorage.setItem("funil-calai-force", "on");
    localStorage.setItem("onboarding-1tela-force", "on");
    expect(funilCalaiLigado("on")).toBe(false);
    expect(onboarding1TelaLigado("on")).toBe(false);
  });

  it("paywall longo: nenhuma oferta de saída da 1.0.14 (curto, X → presente, recuperação, textos, mensal 19…)", () => {
    localStorage.setItem("ofertas-saida-force", "on");
    const nomes: NomeDaOferta[] = ["x_paywall", "mensal_19", "escada", "textos", "enxuto", "recuperacao", "curto", "cadeado", "direto_19"];
    for (const n of nomes) expect(ofertaLigada(n)).toBe(false);
  });

  it("sem o sino e sem 'O que te fez parar?', mesmo com a metadata ligando", () => {
    registrarSinoRemoto({ current: { metadata: { sino_paywall: "on" } }, all: {} });
    localStorage.setItem("motivos-folha-force", "on");
    expect(modoSino()).toBe("off");
    expect(modoMotivos()).toBe("off");
  });

  it("a cobrança da 1.0.14 SEMPRE ligada (sem ela o card da recusa volta sem segurar a folha da Apple)", () => {
    expect(cobrancaV14Ligada()).toBe(true);
    delete G.__MODO_1012__;
    expect(cobrancaV14Ligada()).toBe(false); // build de hoje sem VITE_V14_LOJA: desligada (o motivo do modo)
  });

  it("avaliação como na 1.0.12: sem os momentos da missão/menu (v14) e sem o dia 2 do teste", () => {
    localStorage.setItem("avaliacao-v14-force", "on");
    expect(avaliacaoV14Ligada()).toBe(false);
    expect(modoAvaliacaoTesteDia2()).toBe("off");
  });

  it("dias 2–3 da 1.0.18 desligados; ATT na welcome (auto3s)", () => {
    expect(modoDias23()).toBe("off");
    expect(modoAttMomento()).toBe("auto3s");
  });

  it("enxuto FIXO ligado (um 'off' remoto não religa tutorial): sem montar, intro, cartões, tour", () => {
    registrarFluxoEnxutoRemoto({ current: { metadata: { fluxo_enxuto: "off" } }, all: {} });
    localStorage.setItem("fluxo-enxuto-force", "off");
    expect(fluxoEnxutoLigado()).toBe(true);
    expect(montarFinancasLigado()).toBe(false);
    expect(montarRotinaLigado()).toBe(false);
    expect(introLigada()).toBe(false);
    expect(cartoesLigados("on")).toBe(false);
    expect(tourHomeLigado("on")).toBe(false);
  });

  it("missão: o braço '1 por dia' (A) pra todo mundo, mesmo com a metadata pedindo o sorteio ou o dia 1 cheio", () => {
    registrarUmPorDiaRemoto({ current: { metadata: { missao_1_por_dia: "off" } }, all: {} });
    localStorage.setItem("core-dia1-braco", "B");
    expect(modoUmPorDia()).toBe("on");
    expect(bracoDia1()).toBe("A");
  });

  it("o lembrete 'seu teste acaba amanhã' na hora da 1.0.12: fim − 36 h, puxado pra 9h–20h30 (o dia 2 do lembrete diário fica livre)", async () => {
    const { diaDoAvisoDoTeste, quandoLembrarDoTeste } = await vi.importActual<typeof import("@/lib/notificacoes")>("@/lib/notificacoes");
    const inicio = new Date(2026, 9, 27, 16, 30).getTime();
    const fim = inicio + 3 * 86_400_000; // 30/10 16h30
    const q = quandoLembrarDoTeste(fim, inicio + 60_000, { inicioMs: inicio, horaMin: 12 * 60 })!;
    expect(q.getDate()).toBe(29);
    expect([q.getHours(), q.getMinutes()]).toEqual([9, 0]); // 29/10 04h30 → 9h
    expect(diaDoAvisoDoTeste(fim, inicio)).toBe("2026-10-29");
    const tarde = new Date(2026, 9, 27, 23, 0).getTime();
    expect(quandoLembrarDoTeste(tarde + 3 * 86_400_000, tarde + 60_000)!.getHours()).toBe(11); // fim 30/10 23h − 36 h = 29/10 11h
    const cedo = new Date(2026, 9, 27, 7, 0).getTime();
    const q2 = quandoLembrarDoTeste(cedo + 4 * 86_400_000 + 2 * 3600e3, cedo)!; // fim 31/10 9h − 36 h = 29/10 21h → 20h30
    expect([q2.getDate(), q2.getHours(), q2.getMinutes()]).toEqual([29, 20, 30]);
    delete G.__MODO_1012__;
    expect(diaDoAvisoDoTeste(fim, inicio)).toBe("2026-10-28"); // a regra de hoje (o "dia 2" do calendário)
  });

  it("as duas dicas que sobraram saem: a do planner (Conquistas antiga) e o balão do menu novo", () => {
    expect(deveMostrarDica(undefined)).toBe(false);
    expect(consumirAvisoMenuNovo("dark", "original")).toBe(false);
  });

  it("a Beleza sai das opções da missão (troca dos 3 e 'escolhe o seu')", () => {
    expect(modulosDaEscolha()).not.toContain("beleza");
    expect(modulosDaEscolha()).toContain("casa");
    const m: EstadoMissaoDoses = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-02", undefined, "A"), boasVindas: true };
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    expect(opcoesDoDia2(m, "dinheiro", () => true)).toEqual(["casa", "estudos", "dieta"]);
  });
});

/* ───────────────────────────── a missão nas telas da 1.0.12 ───────────────────────────── */
function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const FinancasFalsa = () => (
  <div><Rota /><header className="sticky">FINANÇAS</header><div><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div><section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
);
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<div><Rota /><p>home nova</p></div>} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const dados = () => ({ "core-user-name": "Ana", "rotina-habits": ["Água", "Andar"], "finance-expenses": [] as unknown[] });
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe("a missão da 1.0.12 por cima da Home nova (1 dose por dia)", () => {
  beforeEach(() => {
    delete G.__FLUXO_ENXUTO_PADRAO_APP__; // o padrão de verdade do iPhone
    conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = false;
    localStorage.setItem("core-funnel-area", "dinheiro");
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 9, 3, 19, 10));
    notif.pedirDia2.mockClear();
  });

  it("o convite 'Seu CORE tá pronto… 1 toque por dia' com os 3 módulos, 'Trocar os 3 módulos' (sem Beleza) e 'Explorar por conta própria'", () => {
    const store = montarStore(dados());
    montar(store, "/home");
    const tela = screen.getByTestId("missao-doses-boas-vindas");
    expect(tela).not.toHaveAttribute("data-braco"); // a tela da 1.0.12, não o "Tá dentro" do braço A
    expect(within(tela).getByRole("heading", { name: /Seu CORE tá pronto/ })).toBeInTheDocument();
    expect(tela.textContent).toMatch(/1 toque por dia/);
    expect(screen.queryByText(/Tá dentro/)).toBeNull();
    expect(within(tela).getByTestId("missao-doses-linha-1").textContent).toMatch(/Finanças/);
    expect(within(tela).getByTestId("missao-doses-linha-2").textContent).toMatch(/Rotina/);
    expect(within(tela).getByTestId("missao-doses-linha-3").textContent).toMatch(/Saúde/);
    expect(screen.getByTestId("missao-doses-explorar")).toHaveTextContent("Explorar por conta própria");
    expect(screen.getByTestId("missao-doses-comecar")).toHaveTextContent("Fazer o toque de hoje");
    expect(lerMissao()?.braco).toBe("A");
    fireEvent.click(screen.getByTestId("missao-doses-trocar"));
    avancar(600);
    expect(screen.getByTestId("missao-doses-escolha")).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-tile-beleza")).toBeNull();
    expect(screen.getByTestId("missao-doses-tile-casa")).toBeInTheDocument();
    expect(eventos.some(([n, d]) => n === "missao_doses_boas_vindas" && d.acao === "view")).toBe(true);
  });

  it("Fazer o toque de hoje → Finanças com a nota 'Qual foi o seu último gasto?' → 'Primeiro registro feito!' com a hora do lembrete, sem 'toque de amanhã agora'", () => {
    const store = montarStore(dados());
    montar(store, "/home");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    avancar(600);
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    avancar(400); avancar(3000);
    const postIt = screen.getByTestId("demo-guia-postit");
    expect(postIt.textContent).toMatch(/Qual foi o seu último gasto\?/);
    expect(document.querySelector("[data-montar-financas]")).toBeNull();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect((store.dados["finance-expenses"] as unknown[]).length).toBe(1);
    // o "olhar" e a comemoração (o tempo da missão)
    for (let i = 0; i < 12 && !screen.queryByTestId("missao-doses-festa"); i++) {
      const entendi = screen.queryByRole("button", { name: /Entendi|Continuar|Ver/ });
      if (entendi && !screen.queryByTestId("missao-doses-festa")) fireEvent.click(entendi);
      avancar(1200);
    }
    const festa = screen.getByTestId("missao-doses-festa");
    expect(within(festa).getByText("Primeiro registro feito!")).toBeInTheDocument();
    expect(festa.textContent).toMatch(/Missão dos 3 dias · 1 de 3 toques/);
    expect(within(festa).getByTestId("missao-doses-amanha").textContent).toMatch(/Amanhã · .*Rotina/);
    for (const h of ["8h", "12h", "20h", "sem"]) expect(within(festa).getByTestId(`missao-doses-hora-${h}`)).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull(); // 1 por dia: o de amanhã é amanhã
    fireEvent.click(within(festa).getByTestId("missao-doses-hora-12h"));
    fireEvent.click(within(festa).getByTestId("missao-doses-combinado"));
    expect(lerMissao()?.lembrete).toBe("12h");
    expect(lerMissao()?.feitos[1]).toBeTruthy();
    // dose 2 SÓ amanhã
    const m = lerMissao()!;
    expect(doseAbreHoje(m, "2026-10-03")).toBe(false);
    expect(doseAbreHoje(m, "2026-10-04")).toBe(true);
  });

  it("fechar e reabrir no mesmo dia: o convite não volta e nada da missão se repete", () => {
    const store = montarStore(dados());
    const r = montar(store, "/home");
    fireEvent.click(screen.getByTestId("missao-doses-explorar"));
    avancar(600);
    r.unmount();
    montar(store, "/home");
    avancar(2000);
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
  });
});

/* ───────────────────────────── a regra das festas do dono ───────────────────────────── */
describe("festas nos 3 primeiros dias (regra do dono 27/10)", () => {
  beforeEach(() => { _novaAberturaFestas(); });

  it("o dia da conta é pelo calendário; a calma vale nos dias 1 a 3 e o 4º é normal", () => {
    const criada = new Date(2026, 9, 3, 23, 50).toISOString();
    expect(diaDaConta(criada, new Date(2026, 9, 3, 23, 59).getTime())).toBe(1);
    expect(diaDaConta(criada, new Date(2026, 9, 4, 0, 5).getTime())).toBe(2);
    expect(diaDaConta(criada, new Date(2026, 9, 5, 12, 0).getTime())).toBe(3);
    expect(calmaDasFestasVale(criada, new Date(2026, 9, 5, 12, 0).getTime())).toBe(true);
    expect(calmaDasFestasVale(criada, new Date(2026, 9, 6, 0, 1).getTime())).toBe(false);
    expect(DIAS_DE_CALMA).toBe(3);
    expect(maxFestasNoDia(1)).toBe(MAX_FESTAS_DIA_1);
    expect(MAX_FESTAS_DIA_1).toBe(3);
    expect(maxFestasNoDia(2)).toBe(MAX_FESTAS_DIAS_2_E_3);
    expect(maxFestasNoDia(3)).toBe(2);
  });

  const it_ = (k: string, raro = false) => ({ k, raro });
  type I = ReturnType<typeof it_>;
  const ap = (fila: I[], hoje: string, dia: number) => aplicarCalma(fila, (i) => i.k, (i) => [i.k], (i) => !i.raro, hoje, dia);

  it("dia 1: até 3 festas, no máximo 1 por abertura; o resto quieto", () => {
    const hoje = "2026-10-03";
    let vistas = 0;
    for (let abertura = 0; abertura < 5; abertura++) {
      _novaAberturaFestas();
      const r = ap([it_(`a${abertura}`), it_(`b${abertura}`)], hoje, 1);
      expect(r.fila.length).toBeLessThanOrEqual(1);
      expect(r.silenciar.length).toBe(r.fila.length ? 1 : 2);
      if (r.fila.length) { registrarFestaNaCalma(r.fila[0].k, hoje); vistas++; }
    }
    expect(vistas).toBe(3);
  });

  it("dias 2 e 3: até 2 por dia", () => {
    for (const hoje of ["2026-10-04", "2026-10-05"]) {
      let vistas = 0;
      for (let abertura = 0; abertura < 4; abertura++) {
        _novaAberturaFestas();
        const r = ap([it_(`${hoje}-${abertura}`)], hoje, hoje === "2026-10-04" ? 2 : 3);
        if (r.fila.length) { registrarFestaNaCalma(r.fila[0].k, hoje); vistas++; }
      }
      expect(vistas).toBe(2);
    }
  });

  it("figurinha RARA sempre comemora: não é cortada nem gasta o limite", () => {
    const hoje = "2026-10-04";
    registrarFestaNaCalma("x", hoje);
    registrarFestaNaCalma("y", hoje); // o dia 2 já deu 2
    const r = ap([it_("comum"), it_("rara", true)], hoje, 2);
    expect(r.fila.map((i) => i.k)).toEqual(["rara"]);
    expect(r.silenciar).toEqual(["comum"]);
  });

  it("voltar pro app depois de 5 min no fundo é uma abertura nova (o orçamento da abertura zera); antes disso, não", () => {
    const hoje = "2026-10-03";
    registrarFestaNaCalma("a", hoje);
    expect(ap([it_("b")], hoje, 1).fila).toHaveLength(0);
    const t0 = Date.now();
    _fundoFestas.irProFundo(t0);
    _fundoFestas.voltarDoFundo(t0 + 60_000); // 1 min: a mesma abertura
    expect(ap([it_("b")], hoje, 1).fila).toHaveLength(0);
    _fundoFestas.irProFundo(t0);
    _fundoFestas.voltarDoFundo(t0 + MIN_NO_FUNDO_NOVA_ABERTURA_MS);
    expect(ap([it_("b")], hoje, 1).fila.map((i) => i.k)).toEqual(["b"]);
  });
});
