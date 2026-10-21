/**
 * 1.0.17 — O ONBOARDING CALMO (dono 19/10: "muito confuso — faz minimalista; a copy do tutorial é brusca; os cortes entre
 * as telas são bruscos; deixa a pessoa pôr a opção dela; a missão de 3 dias tem informação demais").
 *
 * O que este arquivo trava (o resto mora nas suítes de cada peça: v1016-missao-1-por-dia, intro-todos-os-modulos,
 * intro-modulo, montar-*):
 *   · a EscolhaRapida: "+ Outro" abre o campo ALI MESMO (com foco), vazio não entra, Enter/Adicionar devolve a opção dela
 *     pelo mesmo `aoEscolher`; o que ela escreveu volta como chip "seu" na frente das sugestões, por lista, NA CONTA
 *     (core-escolhas-proprias), sem repetir e no máximo 4; a variante numérica (stepper) respeita min/max; a hora do
 *     lembrete tem semântica de rádio;
 *   · o movimento: os tempos do vocabulário, a troca de passo sem deslocamento e o confete/✓ fora de cena com "reduzir
 *     movimento"; a entrada do "Tá dentro" em sequência (tela → ✓ → texto → confete);
 *   · a hora do lembrete DELA ("+ Outra" → 21h) vira a hora do lembrete do dia 2;
 *   · o Montar Rotina aceita os hábitos dela (sem horário, na tabela de hábitos).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

let reduzirAgora = false;
vi.mock("framer-motion", async (orig) => {
  const real = await orig<typeof import("framer-motion")>();
  return { ...real, useReducedMotion: () => reduzirAgora };
});

import { CHAVE_ESCOLHAS_PROPRIAS, EscolhaRapida, MAX_PROPRIAS, juntarPropria, lerValorDigitado } from "@/components/ui/escolha-rapida";
import { EscolhaDeHora } from "@/components/missao-doses/EscolhaDeHora";
import { ATRASO_DO_CHECK_S, ATRASO_DO_CONFETE_S, ATRASO_DO_TEXTO_S, primeiroNome } from "@/components/missao-doses/BoasVindasDoses";
import { Confete } from "@/components/demo-guiada/pecas";
import { MOV, MOV_MS, entrada, saida, trocaDePasso } from "@/lib/movimento";
import { HORA_PROPRIA, minutosDoLembrete, type Lembrete } from "@/lib/missao-doses";
import { combinarHora, lerDia2 } from "@/lib/lembrete-dia2";
import { habitosParaGravar } from "@/lib/montar-rotina";
import { nomeDaPessoa } from "@/components/missao-doses/MissaoDosesNaWeb";
import { CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { faixaDosDias } from "@/components/intro-modulo/EscolherTreino";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados = {}) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
    const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }) as unknown as UserDataContextType, [get, set, versao]); // eslint-disable-line react-hooks/exhaustive-deps
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}

beforeEach(() => { localStorage.clear(); reduzirAgora = false; document.body.innerHTML = ""; });

describe("EscolhaRapida — chips + '+ Outro' ali mesmo + a memória das opções dela", () => {
  const opcoes = [{ id: "pao", rotulo: "Pão com café", emoji: "☕" }, { id: "ovos", rotulo: "Ovos mexidos", emoji: "🥚" }];

  it("'+ Outro' abre o campo com foco; vazio não entra; Enter devolve a opção DELA pelo mesmo aoEscolher e guarda na CONTA", () => {
    const s = criarStore();
    const escolher = vi.fn();
    render(<s.Provedor><EscolhaRapida opcoes={opcoes} lista="intro-dieta-1" outro={{ placeholder: "Ex.: Tapioca" }} aoEscolher={escolher} testid="er" /></s.Provedor>);
    expect(screen.getAllByTestId("er-chip").map((c) => c.textContent)).toEqual(["☕Pão com café", "🥚Ovos mexidos"]);
    expect(screen.queryByTestId("er-texto")).toBeNull();
    fireEvent.click(screen.getByTestId("er-outro"));
    const campo = screen.getByTestId("er-texto") as HTMLInputElement;
    expect(document.activeElement).toBe(campo);
    expect(campo.placeholder).toBe("Ex.: Tapioca");
    expect(screen.getByTestId("er-campo")).toHaveAttribute("data-escolha-campo"); // o balão não some enquanto ela escreve (useDigitando)
    expect((screen.getByTestId("er-adicionar") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(campo, { target: { value: "   " } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(escolher).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "  Tapioca   com  queijo " } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(escolher).toHaveBeenCalledWith({ id: "outro", rotulo: "Tapioca com queijo", sua: true });
    expect(s.estado.dados[CHAVE_ESCOLHAS_PROPRIAS]).toEqual({ "intro-dieta-1": [{ nome: "Tapioca com queijo" }] });
    expect(screen.getByTestId("er-outro")).toBeInTheDocument(); // o campo fecha (sai em fade) e o "+ Outro" volta
  });

  it("a opção dela volta como chip 'seu' NA FRENTE das sugestões (por lista; sem repetir; no máximo 4); tocar nela devolve 'sua: true'", () => {
    const s = criarStore({ [CHAVE_ESCOLHAS_PROPRIAS]: { "intro-dieta-1": [{ nome: "Tapioca" }, { nome: "Cuscuz" }], "missao-gasto": [{ nome: "Padaria", valor: 18 }] } });
    const escolher = vi.fn();
    render(<s.Provedor><EscolhaRapida opcoes={opcoes} lista="intro-dieta-1" outro={{}} aoEscolher={escolher} testid="er" /></s.Provedor>);
    const botoes = screen.getAllByRole("button").map((b) => b.textContent);
    expect(botoes.slice(0, 4)).toEqual(["Tapiocaseu", "Cuscuzseu", "☕Pão com café", "🥚Ovos mexidos"]);
    expect(screen.queryByText(/Padaria/)).toBeNull(); // a memória é por lista
    fireEvent.click(screen.getAllByTestId("er-sua")[1]);
    expect(escolher).toHaveBeenCalledWith(expect.objectContaining({ id: "outro", rotulo: "Cuscuz", sua: true }));
    // regras da memória
    expect(juntarPropria([{ nome: "Tapioca" }], { nome: "tapioca " })).toEqual([{ nome: "tapioca" }]); // sem repetir (sem caixa), a mais recente na frente
    const cheia = ["a", "b", "c", "d"].map((nome) => ({ nome }));
    expect(juntarPropria(cheia, { nome: "e" }).map((x) => x.nome)).toEqual(["e", "a", "b", "c"]);
    expect(juntarPropria(cheia, { nome: "e" })).toHaveLength(MAX_PROPRIAS);
    expect(juntarPropria("lixo", { nome: "  " })).toEqual([]);
  });

  it("com valor (gasto): pede nome E R$; '12,50' vira 12.5; o chip 'seu' mostra o valor", () => {
    const s = criarStore();
    const escolher = vi.fn();
    const r = render(<s.Provedor><EscolhaRapida opcoes={[]} lista="missao-gasto" outro={{ comValor: true }} aoEscolher={escolher} testid="er" /></s.Provedor>);
    fireEvent.click(screen.getByTestId("er-outro"));
    fireEvent.change(screen.getByTestId("er-texto"), { target: { value: "Padaria" } });
    expect((screen.getByTestId("er-adicionar") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId("er-reais"), { target: { value: "12,50" } });
    fireEvent.click(screen.getByTestId("er-adicionar"));
    expect(escolher).toHaveBeenCalledWith({ id: "outro", rotulo: "Padaria", valor: 12.5, sua: true });
    expect(lerValorDigitado("R$ 1.234,56")).toBe(1234.56);
    expect(lerValorDigitado("abc")).toBe(0);
    r.unmount();
    render(<s.Provedor><EscolhaRapida opcoes={[]} lista="missao-gasto" outro={{ comValor: true }} aoEscolher={escolher} testid="er" /></s.Provedor>);
    expect(screen.getByTestId("er-sua").textContent).toBe("Padaria· R$ 12,50seu");
  });

  it("sem o provider da conta (peça solta): o que ela escreve fica só na tela, nada quebra", () => {
    const escolher = vi.fn();
    render(<EscolhaRapida opcoes={opcoes} lista="x" outro={{}} aoEscolher={escolher} testid="er" multi />);
    fireEvent.click(screen.getByTestId("er-outro"));
    fireEvent.change(screen.getByTestId("er-texto"), { target: { value: "Bolo" } });
    fireEvent.click(screen.getByTestId("er-adicionar"));
    expect(escolher).toHaveBeenCalledWith(expect.objectContaining({ rotulo: "Bolo" }));
    expect(screen.getByTestId("er-sua").textContent).toContain("Bolo");
  });

  it("numérica: o '+ Outro' vira um stepper que respeita min/max (copos, dias, hora)", () => {
    const escolher = vi.fn();
    render(<EscolhaRapida opcoes={[]} numero={{ min: 1, max: 3, inicial: 2, formatar: (n) => `${n} dias` }} aoEscolher={escolher} testid="er" />);
    fireEvent.click(screen.getByTestId("er-outro"));
    expect(screen.getByTestId("er-valor").textContent).toBe("2 dias");
    fireEvent.click(screen.getByLabelText("Mais"));
    expect(screen.getByTestId("er-valor").textContent).toBe("3 dias");
    expect((screen.getByLabelText("Mais") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Menos")); fireEvent.click(screen.getByLabelText("Menos"));
    expect((screen.getByLabelText("Menos") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("er-adicionar"));
    expect(escolher).toHaveBeenCalledWith({ id: "outro", rotulo: "1 dias", valor: 1, sua: true });
    expect(faixaDosDias(1)).toBe("2-3"); expect(faixaDosDias(4)).toBe("4"); expect(faixaDosDias(7)).toBe("5-6");
  });
});

describe("a hora do lembrete: 8h · 12h · 20h + a hora DELA ('+ Outra', 6h–22h)", () => {
  it("rádio de verdade; a hora dela vira chip marcado e o lembrete do dia 2 usa ela", () => {
    let valor: Lembrete = "12h";
    const r = render(<EscolhaDeHora valor={valor} aoMudar={(h) => { valor = h; }} comSem={false} testid="h" />);
    expect(screen.getByRole("radiogroup", { name: "Hora do lembrete" })).toBeInTheDocument();
    expect(screen.getByTestId("h-12h")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("h-sem")).toBeNull();
    fireEvent.click(screen.getByTestId("h-outro"));
    for (let i = 0; i < 30; i++) fireEvent.click(screen.getByLabelText("Mais"));
    expect(screen.getByTestId("h-valor").textContent).toBe(`${HORA_PROPRIA.max}h`);
    fireEvent.click(screen.getByLabelText("Menos"));
    fireEvent.click(screen.getByTestId("h-adicionar"));
    expect(valor).toBe("21h");
    r.rerender(<EscolhaDeHora valor={valor} aoMudar={(h) => { valor = h; }} comSem={false} testid="h" />);
    expect(screen.getByTestId("h-21h")).toHaveAttribute("aria-checked", "true");
    expect(minutosDoLembrete("21h")).toBe(21 * 60);
    expect(minutosDoLembrete("sem")).toBe("sem");
    expect(minutosDoLembrete("99h")).toBeNull();
    combinarHora("21h");
    expect(lerDia2()?.horaEscolhida).toBe(21 * 60);
    combinarHora("8h");
    expect(lerDia2()?.horaEscolhida).toBe(8 * 60);
  });
});

describe("movimento calmo — um vocabulário só, e 'reduzir movimento' respeitado", () => {
  it("os tempos: rápido < base < calmo; o respiro ≥ 500 ms; a troca de passo é 260 ms com 24 px", () => {
    expect(MOV.rapido).toBeLessThan(MOV.base);
    expect(MOV.base).toBeLessThan(MOV.calmo);
    expect(MOV_MS.respiro).toBeGreaterThanOrEqual(500);
    expect(MOV_MS.troca).toBe(260);
    const v = trocaDePasso(false);
    expect((v.entra as (d: number) => { x: number })(1).x).toBe(24);
    expect((v.entra as (d: number) => { x: number })(-1).x).toBe(-24); // Voltar entra do outro lado
    expect(entrada(false)).toMatchObject({ duration: 0.42, ease: [0.22, 1, 0.36, 1] });
  });
  it("com 'reduzir movimento': só fade de 150 ms, sem deslocamento, e sem confete", () => {
    const v = trocaDePasso(true);
    expect(v.entra).toEqual({ opacity: 0 });
    expect(entrada(true, MOV.calmo, 0.6)).toEqual({ duration: 0.15, delay: 0, ease: "linear" });
    expect(saida(true)).toMatchObject({ duration: 0.15 });
    reduzirAgora = true;
    const { container } = render(<Confete atraso={1} />);
    expect(container.innerHTML).toBe("");
    reduzirAgora = false;
    const r2 = render(<Confete atraso={1} />);
    expect(r2.getByTestId("demo-guia-confete")).toBeInTheDocument();
  });
  it("'Tá dentro': uma coisa por vez — a tela, depois o ✓, depois o texto, por último o confete", () => {
    expect(ATRASO_DO_CHECK_S).toBeGreaterThan(0);
    expect(ATRASO_DO_TEXTO_S).toBeGreaterThan(ATRASO_DO_CHECK_S);
    expect(ATRASO_DO_CONFETE_S).toBeGreaterThan(ATRASO_DO_TEXTO_S);
    expect(ATRASO_DO_CONFETE_S).toBeGreaterThanOrEqual(ATRASO_DO_CHECK_S + MOV.calmo); // o confete só depois do ✓ assentar
  });
});

describe("o nome do 'Tá dentro, Lucas' — nunca o começo do e-mail", () => {
  it("conta > metadados; e-mail nunca; nome longo ou vazio = 'Tá dentro'", () => {
    expect(nomeDaPessoa("Lucas Andrade", { full_name: "Outro" })).toBe("Lucas Andrade");
    expect(nomeDaPessoa("", { full_name: "Marina Souza" })).toBe("Marina Souza");
    expect(nomeDaPessoa("lucas@exemplo.com", {})).toBe("");
    expect(primeiroNome("lucas andrade")).toBe("Lucas");
    expect(primeiroNome("joao@gmail.com")).toBe("");
    expect(primeiroNome("")).toBe("");
  });
});

describe("Montar Rotina: os hábitos DELA ('+ Outro') entram na tabela, sem horário e sem repetir", () => {
  it("habitosParaGravar junta os do dia + os dela", () => {
    expect(habitosParaGravar("07:00", ["agua"], [], ["Caminhar 10 min", "beber água", "Caminhar 10 min"])).toEqual(["Beber água", "Caminhar 10 min"]);
    expect(habitosParaGravar("07:00", [], ["Ler"], ["Orar"])).toEqual(["Ler", "Orar"]);
  });
});

describe("a memória das opções é da CONTA (não do aparelho)", () => {
  it("core-escolhas-proprias está classificada como da conta (sobe pro user_data; a vassoura do cache local pode levar a cópia)", () => {
    expect(CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS.conta).toContain(CHAVE_ESCOLHAS_PROPRIAS);
    expect(vassouraLeva(CHAVE_ESCOLHAS_PROPRIAS)).toBe(true);
  });
});

describe("acessibilidade do campo", () => {
  it("Escape fecha o campo sem escolher", () => {
    const escolher = vi.fn();
    render(<EscolhaRapida opcoes={[]} outro={{}} aoEscolher={escolher} testid="er" />);
    fireEvent.click(screen.getByTestId("er-outro"));
    act(() => { fireEvent.keyDown(screen.getByTestId("er-texto"), { key: "Escape" }); });
    expect(screen.getByTestId("er-outro")).toBeInTheDocument();
    expect(escolher).not.toHaveBeenCalled();
  });
});

describe("tour_home_quando (RevenueCat): QUANDO o tour curto entra — dia1 (padrão) | dia2", () => {
  it("ausente = dia1; a current vence; a última resposta fica no aparelho e vale até o RevenueCat responder de novo", async () => {
    const { lerTourQuandoRemoto, registrarUmPorDiaRemoto, tourHomeQuando, _zerarUmPorDiaRemoto, CHAVE_TOUR_QUANDO_APARELHO } = await import("@/lib/dia1-cheio");
    const { RESPIRO_ANTES_DO_TOUR_MS } = await import("@/components/home/TourDaHome");
    _zerarUmPorDiaRemoto();
    expect(tourHomeQuando()).toBe("dia1"); // nunca respondeu
    expect(lerTourQuandoRemoto({ current: { metadata: {} } })).toBeNull();
    expect(lerTourQuandoRemoto({ current: { metadata: { tour_home_quando: "DIA2" } } })).toBe("dia2");
    expect(lerTourQuandoRemoto({ current: { metadata: { tour_home_quando: "dia1" } }, all: { x: { metadata: { tour_home_quando: "dia2" } } } })).toBe("dia1");
    expect(lerTourQuandoRemoto({ current: { metadata: { tour_home_quando: "lixo" } } })).toBeNull();
    registrarUmPorDiaRemoto({ current: { metadata: { missao_1_por_dia: "on", tour_home_quando: "dia2" } } });
    expect(tourHomeQuando()).toBe("dia2");
    expect(localStorage.getItem(CHAVE_TOUR_QUANDO_APARELHO)).toBe("dia2");
    _zerarUmPorDiaRemoto(); // nova abertura, RevenueCat ainda não respondeu: vale a do aparelho
    expect(tourHomeQuando()).toBe("dia2");
    registrarUmPorDiaRemoto({ current: { metadata: { missao_1_por_dia: "on" } } }); // a chave saiu = volta ao padrão
    expect(tourHomeQuando()).toBe("dia1");
    expect(localStorage.getItem(CHAVE_TOUR_QUANDO_APARELHO)).toBeNull();
    expect(vassouraLeva(CHAVE_TOUR_QUANDO_APARELHO)).toBe(false); // chave do aparelho
    expect(RESPIRO_ANTES_DO_TOUR_MS).toBeGreaterThanOrEqual(1500);
  });
});
