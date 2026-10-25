/**
 * CONQUISTAS 2 (16/10): a chave, a mecânica pura (próximo prêmio, formato do
 * aviso, adesivos novos da sequência, o lembrete com o prêmio), o álbum por
 * módulo com a figurinha esperando pra ser COLADA, a tela e os momentos
 * (toast × tela cheia) — com dados em memória, nada vai pro servidor.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown>) => { eventos.push([nome, dados]); },
}));
const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));

import { UserDataContext } from "@/hooks/use-user-data";
import { ConquistasNova, LEVANTAR_MS, semHojeNoFim } from "@/components/conquistas/nova/ConquistasNova";
import { EVENTOS2, festaDoMarcoNovo, formatoDoAviso, fraseDaColecao, fraseDaPagina, fraseDaPaginaMaisPerto, fraseCompactaDoPremio, fraseDoPremio, podeCompartilhar, premioDoLembrete, proximoPremio } from "@/components/conquistas/nova/recompensas";
import { MomentosConquistas, TOAST_MS, lerFestasMostradas, outraTelaAberta } from "@/components/conquistas/Momentos";
import { montarAlbumPorModulo, paginaDaFigurinha } from "@/components/conquistas/album-paginas";
import { CAPA_SAI_MS } from "@/components/conquistas/AlbumTela";
import { ADESIVOS_SEQUENCIA_NOVOS, buildBadgesSequencia } from "@/lib/conquistas-registro";
import { CHAVE_FORCA_CONQUISTAS2, _zerarChaveRemotaConquistas2, conquistas2Ligada, guardarForcaConquistas2, lerChaveRemotaConquistas2, registrarChaveRemotaConquistas2 } from "@/lib/conquistas2";
import { IDS_COM_ARTE } from "@/components/conquistas/adesivos-arte";
import { somarDias } from "@/lib/sequencia";
import { gravarMissao, iniciarMissao } from "@/lib/missao-doses";

const HOJE = "2026-10-16"; // sexta
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));
const nomes = () => eventos.map(([n]) => n);

const AGORA = new Date(2026, 9, 16, 10, 0);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  eventos.length = 0;
  localStorage.clear();
  nativo.v = false;
  _zerarChaveRemotaConquistas2();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ------------------------------------------------------------------ a chave */

describe("a chave conquistas2", () => {
  it("padrão: ligada no app, desligada no site; a metadata do RevenueCat e a força de QA mandam por cima", () => {
    expect(conquistas2Ligada()).toBe(false);
    nativo.v = true;
    expect(conquistas2Ligada()).toBe(true);
    registrarChaveRemotaConquistas2({ current: { identifier: "default", metadata: { conquistas2: "off" } }, all: {} });
    expect(conquistas2Ligada()).toBe(false);
    expect(lerChaveRemotaConquistas2({ current: { metadata: {} }, all: { anual_97: { metadata: { conquistas2: "on" } } } })).toBe("on");
    guardarForcaConquistas2("?conquistas2=on");
    expect(localStorage.getItem(CHAVE_FORCA_CONQUISTAS2)).toBe("on");
    expect(conquistas2Ligada()).toBe(true);
    guardarForcaConquistas2("?conquistas2=auto");
    expect(conquistas2Ligada()).toBe(false);
  });
});

/* ------------------------------------------------------------------ a mecânica */

describe("os adesivos novos da sequência (no registro de verdade)", () => {
  it("1, 2, 3 e 14 dias existem em buildBadgesSequencia, com arte, e abrem pelo recorde", () => {
    const lista = buildBadgesSequencia(0);
    expect(lista.map((b) => b.id)).toEqual(["sequencia-1", "sequencia-2", "sequencia-3", "sequencia-7", "sequencia-14", "sequencia-30", "sequencia-100", "protetor-1", "ano-365"]);
    expect(lista.every((b) => IDS_COM_ARTE.includes(b.id))).toBe(true);
    const com3 = buildBadgesSequencia(3);
    expect(com3.filter((b) => b.unlocked).map((b) => b.id)).toEqual(["sequencia-1", "sequencia-2", "sequencia-3"]);
    expect(com3.find((b) => b.id === "sequencia-2")?.name).toBe("Voltei");
    expect(buildBadgesSequencia(0).find(b => b.id === "sequencia-1")?.unlocked).toBe(false);
    expect(buildBadgesSequencia(1).find(b => b.id === "sequencia-1")).toMatchObject({unlocked:true,raridade:"comum",xp:50});
    expect(festaDoMarcoNovo("sequencia-1", {dias:1,hojeFeito:true})).toBe(true);
    expect(festaDoMarcoNovo("sequencia-1", {dias:12,hojeFeito:true})).toBe(false);
    expect(festaDoMarcoNovo("sequencia-1", {dias:1,hojeFeito:false})).toBe(false);
    expect(ADESIVOS_SEQUENCIA_NOVOS[3].raridade).toBe("raro");
    expect(buildBadgesSequencia(14).find((b) => b.id === "sequencia-14")?.raridade).toBe("raro");
  });

  it("comum vira aviso, rara vira cartão e primeira/épicas/lendárias ganham tela cheia; compartilhar só nos marcos", () => {
    const lista = buildBadgesSequencia(100);
    const de = (id: string) => lista.find((b) => b.id === id)!;
    expect(formatoDoAviso(de("sequencia-2"))).toBe("toast");
    expect(formatoDoAviso(de("sequencia-14"))).toBe("cartao");
    expect(formatoDoAviso(de("sequencia-7"))).toBe("tela_cheia");
    expect(formatoDoAviso(de("ano-365"))).toBe("tela_cheia");
    expect(formatoDoAviso({ id: "rotina-21", xp: 200 })).toBe("tela_cheia");
    expect(formatoDoAviso({ id: "first-expense", xp: 50 })).toBe("toast");
    expect(formatoDoAviso({ id: "first-expense", xp: 50 }, true)).toBe("tela_cheia");
    expect(podeCompartilhar(de("sequencia-7"))).toBe(true);
    expect(podeCompartilhar(de("sequencia-3"))).toBe(false);
    expect(podeCompartilhar({ id: "rotina-21" })).toBe(false);
  });

  it("quem já tinha o recorde cola em silêncio; só quem bateu o marco hoje tem aviso", () => {
    expect(festaDoMarcoNovo("sequencia-14", { dias: 20, hojeFeito: true })).toBe(false);
    expect(festaDoMarcoNovo("sequencia-14", { dias: 3, hojeFeito: true })).toBe(false);
    expect(festaDoMarcoNovo("sequencia-14", { dias: 14, hojeFeito: true })).toBe(true);
    expect(festaDoMarcoNovo("sequencia-2", { dias: 2, hojeFeito: false })).toBe(false);
    expect(festaDoMarcoNovo("first-expense", { dias: 0, hojeFeito: false })).toBe(true);
  });
});

describe("o próximo prêmio (amanhã você ganha) e o lembrete", () => {
  it("a frase compacta respeita hoje, amanhã e os protetores de quem já ganhou as figurinhas", () => {
    expect(fraseCompactaDoPremio(proximoPremio(1, false, buildBadgesSequencia(1)))).toBe("Anote hoje e ganhe uma nova figurinha.");
    expect(fraseCompactaDoPremio(proximoPremio(1, true, buildBadgesSequencia(1)))).toBe("Amanhã tem uma nova figurinha.");
    expect(fraseCompactaDoPremio(proximoPremio(12, false, buildBadgesSequencia(100)))).toBe("Mais 2 dias para seu próximo protetor.");
    expect(fraseCompactaDoPremio(proximoPremio(13, false, buildBadgesSequencia(100)))).toBe("Anote hoje e ganhe mais um protetor.");
  });
  it("dia 1 do teste, já anotou hoje: 'Amanhã: adesivo \"Voltei\" 🔥'", () => {
    const p = proximoPremio(1, true, buildBadgesSequencia(1));
    expect(p.marco).toBe(2);
    expect(p.quando).toBe("amanha");
    expect(fraseDoPremio(p)).toBe('Amanhã: adesivo "Voltei" 🔥');
    expect(p.instrucao).toBe("Vale qualquer anotação: gasto, hábito, água, página lida");
  });
  it("dia 2 do teste, ainda sem anotar: 'Anota algo hoje e ganha o adesivo \"Voltei\"'", () => {
    const p = proximoPremio(1, false, buildBadgesSequencia(1));
    expect(p.quando).toBe("hoje");
    expect(fraseDoPremio(p)).toBe('Anota algo hoje e ganha o adesivo "Voltei"');
    expect(p.instrucao).toBe("Anota algo hoje pra não perder a sequência");
  });
  it("12 dias até ontem: 'Faltam 2 dias pro adesivo de 14 dias 🔥' (+ protetor)", () => {
    const p = proximoPremio(12, false, buildBadgesSequencia(12));
    expect(p.marco).toBe(14);
    expect(p.faltam).toBe(2);
    expect(p.daProtetor).toBe(true);
    expect(p.adesivo?.name).toBe("14 Dias Seguidos");
    expect(fraseDoPremio(p)).toBe("Faltam 2 dias pro adesivo de 14 dias 🔥");
  });
  it("2 dias anotados: 'Amanhã: adesivo de 3 dias 🔥'", () => {
    expect(fraseDoPremio(proximoPremio(2, true, buildBadgesSequencia(2)))).toBe("Amanhã: adesivo de 3 dias 🔥");
  });
  it("recorde antigo já colou o 3 e o 7: pula o 3, mas o 7 fica (dá protetor) sem adesivo", () => {
    const p = proximoPremio(2, true, buildBadgesSequencia(10));
    expect(p.marco).toBe(7);
    expect(p.adesivo).toBeNull();
    expect(fraseDoPremio(p)).toBe("Faltam 5 dias pro próximo protetor 🔥");
  });
  it("o lembrete das 20h cita o prêmio de hoje ou de amanhã", () => {
    const a = buildBadgesSequencia(12);
    expect(premioDoLembrete(13, a)).toBe("Amanhã vem o adesivo de 14 dias 🔥");
    expect(premioDoLembrete(14, a)).toBe("Hoje cola o adesivo de 14 dias 🔥");
    expect(premioDoLembrete(9, a)).toBeNull();
    expect(premioDoLembrete(2, buildBadgesSequencia(12))).toBeNull(); // já colado
  });
  it("as frases da coleção e da página", () => {
    expect(fraseDaColecao(4, 7)).toBe("4 de 7");
    expect(fraseDaColecao(7, 10)).toBe("faltam 3 pra fechar");
    expect(fraseDaColecao(0, 3)).toBe("0 de 3");
    expect(fraseDaColecao(0, 2)).toBe("0 de 2");
    expect(fraseDaColecao(1, 3)).toBe("1 de 3");
    expect(fraseDaColecao(3, 3)).toBe("coleção completa");
    expect(fraseDaPagina(6, 8)).toBe("Faltam 2 figurinhas nesta página");
    expect(fraseDaPagina(7, 8)).toBe("Falta 1 figurinha nesta página");
    expect(fraseDaPagina(8, 8)).toMatch(/completa/);
    expect(fraseDaPaginaMaisPerto(2, "raras")).toBe("Faltam 2 na página das raras");
    expect(fraseDaPaginaMaisPerto(1, "comuns", 2)).toBe("Falta 1 na página 2 das comuns");
    // o chip da ação do dia começa com "Hoje:", então o "de hoje"/"hoje" do fim da frase sai
    expect(semHojeNoFim("anote o gasto de hoje")).toBe("anote o gasto");
    expect(semHojeNoFim("anote como você está hoje")).toBe("anote como você está");
    expect(semHojeNoFim("marque o treino de sexta")).toBe("marque o treino de sexta");
    expect(semHojeNoFim("marque um hábito")).toBe("marque um hábito");
  });
});

describe("o álbum por módulo (função guardada; a tela usa o álbum por raridade de 02/10)", () => {
  it("1ª página os mais raros; depois uma página por módulo, com vaga fixa e parelhas quando passa de 16", () => {
    const paginas = montarAlbumPorModulo(buildBadgesSequencia(3));
    expect(paginas[0].id).toBe("mais-raros");
    expect(paginas[1].modulo).toBe("sequencia");
    expect(paginas[1].vagas).toHaveLength(9);
    expect(paginas[1].abertos).toBe(3);
    expect(paginaDaFigurinha(paginas, "sequencia-14")).toBe(1);
  });
});

/* ------------------------------------------------------------------ a tela */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: Array<[string, unknown, unknown]> = [];
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown, opts?: { system?: boolean }) => { escritas.push([k,v,opts]); dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, escritas, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const cenario = (extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
  "conquistas-desbloqueadas": { "sequencia-1": "2026-10-04", "sequencia-7": "2026-10-10", "sequencia-3": "2026-10-06", "sequencia-2": "2026-10-05", "first-expense": "2026-09-01" },
  // o "Primeira Despesa" colou desde a última visita: espera no álbum
  "conquistas-album-visto": ["sequencia-1", "sequencia-7", "sequencia-3", "sequencia-2"],
  "finance-expenses": [{ id: 1, value: 10, date: "2026-10-10" }],
  ...extra,
});
const montar = (props: Partial<Parameters<typeof ConquistasNova>[0]> = {}, extra = {}, estado?: Record<string, unknown>) => {
  const store = montarStore(cenario(extra));
  const r = render(
    <MemoryRouter initialEntries={[{ pathname: "/conquistas", state: estado }]}>
      <Provedor store={store}><ConquistasNova testeDia={null} {...props} /></Provedor>
    </MemoryRouter>,
  );
  return { store, ...r };
};
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** Quantas vezes um texto aparece na tela (a frase do próximo adesivo só pode aparecer UMA vez: na trilha). */
const vezes = (txt: string) => (document.body.textContent ?? "").split(txt).length - 1;

describe("a tela: sequência, álbum como herói, trilha, por módulo", () => {
  // aqui o relógio inteiro é falso: a capa levanta (260 ms) e o álbum 3D abre (CAPA_SAI_MS) sem esperar de verdade
  beforeEach(() => { vi.useRealTimers(); vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(AGORA); });
  it("salva a capa na conta como preferência, sem registrar um dia, e a restaura ao reabrir", () => {
    const {store,unmount}=montar();
    const dias=[...(store.dados["core-dias-anotados"] as string[])];
    fireEvent.click(screen.getByTestId("cn-personalizar"));
    fireEvent.click(screen.getByRole("button",{name:"Sálvia"}));
    fireEvent.click(screen.getByRole("button",{name:"Salvar minha capa"}));
    expect(store.escritas.filter(([k])=>k==="conquistas-album-capa-v1")).toEqual([["conquistas-album-capa-v1",{cor:"salvia",figurinhas:null},{system:true}]]);
    expect(store.dados["core-dias-anotados"]).toEqual(dias);
    unmount();
    render(<MemoryRouter><Provedor store={store}><ConquistasNova testeDia={null}/></Provedor></MemoryRouter>);
    fireEvent.click(screen.getByTestId("cn-personalizar"));
    expect(screen.getByRole("button",{name:"Sálvia"})).toHaveAttribute("aria-pressed","true");
  });

  it("o álbum por módulos mantém a sequência e remove as abas por raridade", () => {
    montar({ prototipoSequencia: true, camada: "pagina" });
    const pagina = screen.getByTestId("album-tela-pagina-1");
    expect(pagina.getAttribute("data-prototipo")).toBe("sequencia");
    expect(Array.from(pagina.querySelectorAll("[data-vaga]")).map(n => n.getAttribute("data-vaga"))).toEqual(["sequencia-1", "sequencia-2", "sequencia-3", "sequencia-7"]);
    expect(screen.queryByRole("tab", {name: "LENDÁRIAS"})).toBeNull();
    expect(screen.getByRole("tab", {name: "FINANÇAS"})).toBeTruthy();
    expect(screen.getByRole("tab", {name: "SEQUÊNCIA"})).toBeTruthy();
    expect(screen.getByTestId("cn-album-contagem").getAttribute("aria-label")).toContain("de 99");
  });

  it("o filtro de raridade consulta a coleção sem reorganizar o álbum", () => {
    montar();
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por raridade" }), { target: { value: "lendario" } });
    const colecao = screen.getByTestId("cn-colecao-tela");
    expect(within(colecao).queryByText("Primeiro Salário")).toBeNull();
    expect(within(colecao).getByText("Mestre do CORE")).toBeTruthy();
    expect(screen.queryByTestId("album-tela")).toBeNull();
  });

  it("a festa épica leva à colagem e só então marca a figurinha no álbum", () => {
    const { store } = montar({camada:"festa", figurinhaFesta:"mes-20"}, {"finance-expenses":[], "core-dias-anotados":[], "conquistas-desbloqueadas":{"mes-20":"2026-09-01"}, "conquistas-album-visto":[]});
    expect(screen.getByTestId("momento-adesivo").hasAttribute("data-celebracao")).toBe(true);
    expect(store.dados["conquistas-album-visto"]).toEqual([]);
    fireEvent.click(screen.getByRole("button", {name:"Colar no álbum"}));
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    for (let i=0;i<20;i++) avancar(200);
    expect(store.dados["conquistas-album-visto"]).toEqual(["mes-20"]);
    expect(eventos.filter(([n])=>n===EVENTOS2.figurinhaColar)).toHaveLength(1);
  });

  it("segue a referência: álbum primeiro, colagem principal, sequência e prévia da coleção", () => {
    montar({}, {}, { origem: "home" });
    const album = screen.getByTestId("cn-album");
    const sequencia = screen.getByTestId("cn-hero");
    expect(album.compareDocumentPosition(sequencia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(album.querySelector("#cn-titulo-album")?.textContent).toBe("Meu álbum");
    expect(screen.queryByText("FEITO DE VOCÊ")).toBeNull();
    expect(screen.getByTestId("cn-album-contagem").textContent).toBe("4 / 99coladas");
    expect(screen.getByTestId("cn-album-contagem").getAttribute("aria-label")).toBe("5 conquistadas; 4 de 99 figurinhas coladas");
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("Colar 1 figurinha");
    expect(screen.getByTestId("cn-album-abrir").textContent).toBe("Abrir álbum");
    expect(sequencia.querySelector(".cn-seq-num")?.textContent).toBe("12");
    expect(screen.getByTestId("cn-seq-semana").querySelectorAll("[data-estado]")).toHaveLength(7);
    expect(screen.getByTestId("cn-seq-resumo").getAttribute("aria-label")).toBe("Recorde 12 dias · 1 de 2 protetores · 12 dias anotados");
    expect(screen.getByTestId("cn-acao").textContent).toBe("Anote 1 coisa do seu dia");
    expect(screen.getByTestId("cn-amanha-frase").textContent).toBe("Mais 2 dias para sua próxima figurinha.");
    expect(screen.getByTestId("cn-amanha-frase").getAttribute("aria-label")).toContain("Vale qualquer anotação");
    expect(screen.queryByTestId("cn-amanha")).toBeNull();
    expect(screen.queryByText("Seu próximo passo")).toBeNull();
    expect(sequencia.nextElementSibling).toHaveClass("cn-colecao-previa");
    expect(screen.getByRole("heading", {name:"Sua coleção"})).toBeTruthy();
    expect(document.querySelectorAll(".cn-colecao-mini")).toHaveLength(3);
    expect(screen.getByTestId("cn-ver-todos").textContent).toContain("Ver todas");
    expect(document.body.textContent).not.toMatch(/INSÍGNIAS|Nível |XP/);
    expect(eventos.find(([n]) => n === EVENTOS2.abrir)?.[1]).toMatchObject({ origem: "home", dias: 12, teste_dia: null });
    expect(nomes()).toContain(EVENTOS2.amanhaVisto);
  });

  it("a encadernação mantém a cor escolhida quando a capa vira", () => {
    montar({}, { "conquistas-album-capa-v1": { cor: "salvia", figurinhas: null } });
    fireEvent.click(screen.getByTestId("cn-album-capa"));
    avancar(LEVANTAR_MS + 10);
    const livro = screen.getByTestId("album-tela");
    expect(livro).toHaveAttribute("data-cor-capa", "salvia");
    expect(livro.style.getPropertyValue("--capa-cor")).toBe("#577467");
    expect(livro.querySelector(".alb-capa")?.getAttribute("style")).toContain("#577467");
    avancar(CAPA_SAI_MS + 1000);
    expect(screen.queryByTestId("album-capa-3d")).toBeNull();
    expect(livro.style.getPropertyValue("--capa-cor")).toBe("#577467");
    expect(livro.querySelector(".alb-lombada")).toBeTruthy();
  });

  it("a sequência abre os personagens maiores, com marcos ganhos e o próximo", () => {
    montar();
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    const evolucao = screen.getByRole("list", { name: "Marcos da sequência" });
    expect(evolucao.querySelectorAll("li")).toHaveLength(6);
    expect(evolucao.querySelectorAll("button")).toHaveLength(6);
    expect(screen.getByTestId("cn-evolucao-inicio")).toHaveTextContent("1 diaConquistada");
    expect(within(evolucao).queryByRole("button", { name: /Voltei/ })).toBeNull();
    expect(Array.from(evolucao.querySelectorAll("li b"), n => n.textContent)).toEqual(["1 dia", "3 dias", "7 dias", "14 dias", "30 dias", "100 dias"]);
    expect(evolucao.textContent).toContain("Conquistada");
    expect(evolucao.textContent).toContain("Faltam 2 dias");
    fireEvent.click(screen.getByRole("button", { name: "14 Dias Seguidos: faltam 2 dias" }));
    expect(screen.getByTestId("cn-figurinha-em-foco")).toBeTruthy();
    expect(screen.queryByTestId("album-tela")).toBeNull();
  });

  it("Voltei sai da evolução, mas continua conquistada e inspecionável na coleção", () => {
    montar();
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    expect(within(screen.getByRole("list", { name: "Marcos da sequência" })).queryByRole("button", { name: /Voltei/ })).toBeNull();
    fireEvent.click(within(screen.getByTestId("cn-detalhe-sequencia")).getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    fireEvent.click(within(screen.getByTestId("cn-colecao-tela")).getByRole("button", { name: "Voltei: conquistada" }));
    expect(screen.getByTestId("cn-figurinha-em-foco")).toHaveTextContent("Voltei");
    expect(screen.queryByTestId("album-tela")).toBeNull();
  });

  it.each([
    { registros: [] as string[], conquistada: false },
    { registros: [HOJE], conquistada: true },
    { registros: [somarDias(HOJE, -10)], conquistada: true },
  ])("1 dia exige um registro real e continua ganho após pausa: $registros", ({ registros, conquistada }) => {
    const { store } = montar({}, { "core-dias-anotados": registros, "conquistas-desbloqueadas": {}, "conquistas-album-visto": [], "finance-expenses": [] });
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    const inicio = screen.getByTestId("cn-evolucao-inicio");
    expect(inicio.tagName).toBe("BUTTON");
    expect(inicio).toHaveTextContent(conquistada ? "Conquistada" : "A conquistar");
    expect(store.dados["core-dias-anotados"]).toEqual(registros);
    expect(Object.prototype.hasOwnProperty.call(store.dados["conquistas-desbloqueadas"], "sequencia-1")).toBe(conquistada);
    fireEvent.click(inicio);
    expect(screen.getByTestId("cn-figurinha-em-foco")).toHaveTextContent("1 Dia Anotado");
    expect(screen.queryByTestId("album-tela")).toBeNull();
  });

  it("1 dia aparece na coleção, cola uma vez e permanece após reabrir", () => {
    const { store, unmount } = montar({}, { "core-dias-anotados": [HOJE], "conquistas-desbloqueadas": {}, "conquistas-album-visto": [], "finance-expenses": [] });
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    expect(within(screen.getByTestId("cn-colecao-tela")).getByRole("button", {name:"1 Dia Anotado: conquistada"})).toBeTruthy();
    fireEvent.click(within(screen.getByTestId("cn-colecao-tela")).getByRole("button", {name:"Fechar"}));
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    avancar(500);
    expect(store.dados["conquistas-album-visto"]).toEqual(["sequencia-1"]);
    expect(eventos.filter(([n,d]) => n === EVENTOS2.figurinhaColar && d.id === "sequencia-1")).toHaveLength(1);
    unmount();
    store.dados["core-dias-anotados"] = [];
    render(<MemoryRouter><Provedor store={store}><ConquistasNova testeDia={null}/></Provedor></MemoryRouter>);
    expect(screen.getByTestId("cn-album-contagem")).toHaveTextContent("1 / 99");
    expect(screen.queryByTestId("cn-album-pacotinho")).toBeNull();
    expect(store.dados["conquistas-desbloqueadas"]).toHaveProperty("sequencia-1",HOJE);
  });

  it("no trial sem figurinhas oferece uma missão, sem uma segunda ação de sequência", () => {
    montar({ testeDia: 1 }, { "core-dias-anotados": [], "conquistas-desbloqueadas": {}, "conquistas-album-visto": [], "finance-expenses": [] });
    expect(screen.getByTestId("cn-album-vazio")).toHaveTextContent("primeiro registro da sua missão");
    expect(screen.getByRole("button", { name: "Ir para minha missão" })).toBeTruthy();
    expect(nomes()).not.toContain(EVENTOS2.amanhaVisto);
    expect(screen.queryByTestId("cn-hero")).toBeNull();
    expect(screen.queryByTestId("cn-acao")).toBeNull();
    expect(screen.queryByText("Seu próximo passo")).toBeNull();
    expect(screen.getByRole("button", { name: /Conhecer as figurinhas/ })).toBeTruthy();
  });

  it("a capa mostra a figurinha nova esperando (selo + pacotinho); 'ver todos' abre a grade secundária", () => {
    montar();
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("1");
    expect(screen.getByTestId("cn-album-selo").textContent).toMatch(/1 nova/);
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("Colar 1 figurinha");
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    expect(screen.getByTestId("cn-colecao-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.colecaoAbrir)?.[1]).toEqual({ colecao: "todas" });
  });

  it("sem figurinha nova: abrir o álbum e um único progresso", () => {
    montar({}, { "conquistas-album-visto": ["sequencia-1", "sequencia-7", "sequencia-3", "sequencia-2", "first-expense"] });
    expect(screen.queryByTestId("cn-album-selo")).toBeNull();
    expect(screen.queryByTestId("cn-album-pagina")).toBeNull();
    expect(screen.getByRole("progressbar", {name: "Figurinhas coladas"}).getAttribute("aria-valuenow")).toBe("5");
  });

  it("toque na capa: levanta 260 ms e abre o álbum de verdade (3D) na capa; a vaga de amanhã tem a pílula", () => {
    montar();
    fireEvent.click(screen.getByTestId("cn-album-capa"));
    expect(screen.getByTestId("cn-album-capa").hasAttribute("data-levantando")).toBe(true);
    expect(screen.queryByTestId("album-tela")).toBeNull();
    avancar(LEVANTAR_MS + 10);
    expect(screen.getByTestId("album-tela")).toBeTruthy();
    expect(screen.getByTestId("album-capa-3d")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.albumAbrir)?.[1]).toMatchObject({ origem: "capa" });
    // A capa sai e o capítulo Sequência contém a vaga de 14 dias.
    avancar(CAPA_SAI_MS + 1000);
    expect(screen.getByTestId("album-aba-sequencia")).toBeTruthy();
    fireEvent.click(screen.getByTestId("album-aba-sequencia"));
    avancar(1000);
    fireEvent.click(screen.getByTestId("album-tela-proxima"));
    avancar(1000);
    const vaga = document.querySelector('[data-papel="fundo"] [data-vaga="sequencia-14"]')!;
    expect(vaga.hasAttribute("data-destaque")).toBe(true);
    expect(vaga.querySelector('[data-testid="vaga-destaque"]')?.textContent).toBe("EM 2 DIAS");
    // vagas vazias e "Faltam N figurinhas nesta página"
    expect(document.querySelector('[data-papel="fundo"] [data-testid="album-pe-pagina"]')?.textContent).toMatch(/Faltam \d+ figurinhas nesta página/);
  });

  it("o CTA Colar abre a página e cola com um único toque, grava o visto e mede uma vez", async () => {
    const { store } = montar();
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    expect(screen.getByTestId("album-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.albumAbrir)?.[1]).toMatchObject({ origem: "pacotinho", novas: 1 });
    const vaga = () => document.querySelector('[data-papel="fundo"] [data-vaga="first-expense"]') as HTMLElement;
    expect(vaga().hasAttribute("data-pendente")).toBe(true);
    expect(document.querySelector('[data-papel="fundo"] .vaga-fig[data-cola]')).toBeNull();
    expect(vaga().querySelector('[data-testid="vaga-pendente"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="album-pe-colar"]')?.textContent).toMatch(/1 figurinha nova/);
    avancar(500);
    expect(vaga().hasAttribute("data-pendente")).toBe(false);
    expect(vaga().querySelector(".vaga-fig[data-cola]")).toBeTruthy(); // colou com o peel
    expect(store.dados["conquistas-album-visto"]).toContain("first-expense");
    expect(screen.getByRole("status").textContent).toContain("colada no álbum");
    expect(screen.getByTestId("cn-album-contagem").getAttribute("aria-label")).toBe("5 conquistadas; 5 de 99 figurinhas coladas");
    expect(eventos.find(([n]) => n === EVENTOS2.figurinhaColar)?.[1]).toMatchObject({ id: "first-expense", raridade: "comum", restantes: 0 });
    expect(screen.queryByTestId("detalhe-vaga")).toBeNull();
    avancar(3000);
    expect(eventos.filter(([n]) => n === EVENTOS2.figurinhaColar)).toHaveLength(1);
  });

  it("cola oito pendentes em páginas diferentes e permite pausar e retomar sem duplicar", () => {
    const ids = ["first-income", "first-expense", "sequencia-2", "sequencia-3", "sequencia-7", "leitura-1", "treino-1", "rotina-21"];
    const { store } = montar({}, { "core-dias-anotados": [], "finance-expenses": [], "conquistas-desbloqueadas": Object.fromEntries(ids.map(id => [id, "2026-09-01"])), "conquistas-album-visto": [] });
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    fireEvent.click(screen.getByRole("button", {name: "Pausar"}));
    avancar(2000);
    expect(store.dados["conquistas-album-visto"]).toEqual([]);
    fireEvent.click(screen.getByRole("button", {name: "Continuar"}));
    for (let i = 0; i < 100; i++) avancar(200);
    expect(new Set(store.dados["conquistas-album-visto"] as string[])).toEqual(new Set(ids));
    expect(eventos.filter(([n]) => n === EVENTOS2.figurinhaColar)).toHaveLength(8);
    expect(within(screen.getByTestId("album-tela")).getByRole("status").textContent).toContain("As 8 figurinhas foram coladas");
  });

  it("fechar o álbum antes da revelação cancela a colagem", () => {
    const { store } = montar();
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    fireEvent.click(screen.getByRole("button", { name: "Fechar o álbum" }));
    avancar(1000);
    expect(store.dados["conquistas-album-visto"]).not.toContain("first-expense");
    expect(eventos.filter(([n]) => n === EVENTOS2.figurinhaColar)).toHaveLength(0);
  });

  it("um toque na prévia abre a arte ampliada sem colar nem alterar a coleção", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AGORA);
    const { store } = montar({}, { "finance-expenses": [], "conquistas-desbloqueadas": { "first-income": "2026-09-01" }, "conquistas-album-visto": ["first-income"] });
    fireEvent.click(screen.getByRole("button", { name: "Primeiro Salário: conquistada" }));
    const detalhe = screen.getByTestId("detalhe-vaga");
    expect(detalhe.getAttribute("data-vaga-detalhe")).toBe("first-income");
    expect(detalhe.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Primeiro Salário");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar visualização da figurinha" }));
    expect(store.dados["conquistas-album-visto"]).toEqual(["first-income"]);
    fireEvent.click(screen.getByRole("button", { name: "Fechar visualização da figurinha" }));
    await waitFor(() => expect(screen.queryByTestId("detalhe-vaga")).toBeNull(), { timeout: 3000 });
    expect(screen.queryByTestId("album-tela")).toBeNull();
    expect(nomes()).not.toContain(EVENTOS2.albumAbrir);
  });

  it("a coleção mantém o filtro e a lista ao ampliar uma figurinha, sem abrir o álbum", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AGORA);
    const { store } = montar({}, { "finance-expenses": [], "conquistas-desbloqueadas": { "first-income": "2026-09-01" }, "conquistas-album-visto": ["first-income"] });
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    const colecao = screen.getByTestId("cn-colecao-tela");
    const filtro = within(colecao).getByRole("button", { name: /Finanças/ });
    fireEvent.click(filtro);
    const figurinha = within(colecao).getByText("Primeiro Salário").closest("button")!;
    figurinha.focus();
    fireEvent.click(figurinha);
    expect(screen.getByTestId("detalhe-vaga").getAttribute("data-vaga-detalhe")).toBe("first-income");
    expect(screen.queryByTestId("album-tela")).toBeNull();
    expect(screen.getByTestId("cn-colecao-tela")).toBe(colecao);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("detalhe-vaga")).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId("cn-colecao-tela")).toBe(colecao);
    expect(filtro.hasAttribute("data-ativo")).toBe(true);
    expect(document.activeElement).toBe(figurinha);
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(store.dados["conquistas-album-visto"]).toEqual(["first-income"]);
    expect(nomes()).not.toContain(EVENTOS2.albumAbrir);
  });

  it("chegando do toast (state.album): o álbum abre direto na página da figurinha", () => {
    montar({}, {}, { origem: "toast", album: "first-expense" });
    expect(screen.getByTestId("album-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.albumAbrir)?.[1]).toMatchObject({ origem: "toast" });
    expect(eventos.find(([n]) => n === EVENTOS2.abrir)?.[1]).toMatchObject({ origem: "toast" });
  });

  it("(dono 17/10) sem os chips das páginas na tela principal — o álbum tem as abas; o link 'Ver todos os adesivos' abre a grade", () => {
    montar();
    expect(screen.queryByTestId("cn-colecao")).toBeNull();
    expect(screen.queryByTestId("cn-pagina-raro")).toBeNull();
    expect(document.body.textContent).not.toMatch(/PÁGINAS DO ÁLBUM/);
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    expect(screen.getByTestId("cn-colecao-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.colecaoAbrir)?.[1]).toEqual({ colecao: "todas" });
  });

  it("no teste grátis (dia 2, sem anotar hoje): a missão, 'Hoje você ganha Voltei' e o adesivo esperando no álbum", () => {
    montar({ testeDia: 2 }, { "core-dias-anotados": [somarDias(HOJE, -1)], "conquistas-desbloqueadas": { "first-expense": somarDias(HOJE, -1) }, "conquistas-album-visto": [] });
    expect(screen.getByTestId("cn-missao").textContent).toMatch(/dia 2 de 3/);
    expect(screen.getByTestId("cn-missao-album").textContent).toBe("2 adesivos novos pra colar ›");
    // a ação do dia no teste: "anote o gasto de hoje" vira "Hoje: anote o gasto" (sem "hoje" duas vezes)
    expect(screen.getByTestId("cn-acao").textContent).toMatch(/^Anote /);
    expect(screen.getByTestId("cn-amanha-frase").textContent).toBe("Anote hoje e ganhe uma nova figurinha.");
    // o chip da missão fica; a frase do adesivo de hoje aparece UMA vez (trilha), nada no card do álbum
    expect(screen.getByTestId("cn-amanha-frase").getAttribute("aria-label")).toContain('Anota algo hoje e ganha o adesivo "Voltei"');
    expect(screen.queryByTestId("cn-album-amanha")).toBeNull();
    fireEvent.click(screen.getByTestId("cn-missao-album"));
    expect(eventos.find(([n]) => n === EVENTOS2.albumAbrir)?.[1]).toMatchObject({ origem: "missao" });
  });

  it("quem já usa (dado antigo, sem os 3 adesivos novos no visto): nada se perde — 12 dias, os 2 colados de antes, e os novos de 2/3 dias aparecem como figurinhas novas pra colar", () => {
    // o registro de antes de 16/10: só o 7, o first-expense e o visto antigo (sem sequencia-2/3)
    const { store } = montar({}, { "conquistas-desbloqueadas": { "sequencia-7": "2026-10-10", "first-expense": "2026-09-01" }, "conquistas-album-visto": ["sequencia-7", "first-expense"] });
    expect(screen.getByTestId("cn-hero").textContent).toContain("12");
    expect(screen.getByTestId("cn-album-contagem").getAttribute("aria-label")).toContain("2 de 99 figurinhas coladas"); // 7 + first-expense; 2 e 3 estão conquistadas, mas ainda esperam a colagem
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("3");
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("Colar 3 figurinhas");
    // as chaves de sempre continuam lá, intactas (a tela só lê; o visto antigo não foi reescrito)
    expect(store.dados["core-dias-anotados"]).toHaveLength(12);
    expect(store.dados["conquistas-album-visto"]).toEqual(["sequencia-7", "first-expense"]);
    // o registro ganha os 2 novos com a data de hoje (como qualquer adesivo que abre); os de antes ficam com a data deles
    const desbloqueadas = store.dados["conquistas-desbloqueadas"] as Record<string, string>;
    expect(desbloqueadas).toMatchObject({ "sequencia-7": "2026-10-10", "first-expense": "2026-09-01", "sequencia-1": HOJE, "sequencia-2": HOJE, "sequencia-3": HOJE });
  });

  it("conta vazia: capa com inicial e convite ao primeiro registro", () => {
    montar({}, { "core-dias-anotados": [], "conquistas-desbloqueadas": {}, "conquistas-album-visto": [], "finance-expenses": [] });
    expect(screen.getByTestId("cn-album-contagem").textContent).toBe("0 / 99coladas");
    expect(screen.getByTestId("cn-album-vazio").textContent).toContain("Seu álbum começa com um registro");
    // 0 dias: anotar hoje é o 1º dia, amanhã o 2º → "Faltam 2 dias pro adesivo 'Voltei'" — só na trilha, não no card do álbum
    expect(screen.getByTestId("cn-amanha-frase").textContent).toBe("Anote hoje e ganhe uma nova figurinha.");
    expect(screen.getByTestId("cn-amanha-frase").getAttribute("aria-label")).toContain('Anota algo hoje e ganha o adesivo de 1 dia');
    expect(screen.queryByTestId("cn-album-amanha")).toBeNull();
    expect(screen.getByTestId("cn-album-abrir")).toHaveTextContent("Começar minha coleção");
    expect(screen.getByTestId("cn-personalizar")).toBeEnabled();
  });

  it("a dose da missão em cena (data-missao-dose=\"1\", contrato com o ramo da missão) segura toast e festa", () => {
    expect(outraTelaAberta()).toBe(false);
    document.documentElement.dataset.missaoDose = "1";
    expect(outraTelaAberta()).toBe(true);
    delete document.documentElement.dataset.missaoDose;
    expect(outraTelaAberta()).toBe(false);
  });

  it("duas figurinhas novas em páginas diferentes: colou uma → o rodapé oferece a próxima ('Mais 1 figurinha nova em Sequência') e leva até ela", () => {
    // first-expense (comum) e sequencia-3 (rara) fora do visto
    const { store } = montar({}, { "conquistas-album-visto": ["sequencia-1", "sequencia-7", "sequencia-2"] });
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("2");
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    const tela = screen.getByTestId("album-tela");
    const paginaDeBaixo = () => tela.querySelector('[data-papel="fundo"]') as HTMLElement;
    const pendente = paginaDeBaixo().querySelector("[data-pendente]") as HTMLElement;
    expect(pendente).toBeTruthy();
    const primeiro = pendente.getAttribute("data-vaga")!;
    act(() => { fireEvent.click(pendente); });
    // colou: o rodapé desta página agora aponta pra outra página com figurinha nova
    const proxima = paginaDeBaixo().querySelector('[data-testid="album-pe-proxima"]') as HTMLElement;
    expect(proxima.textContent).toMatch(/Mais 1 figurinha nova em (Sequência|Finanças)/);
    const antes = tela.getAttribute("data-atual");
    act(() => { fireEvent.click(proxima); });
    avancar(800);
    expect(tela.getAttribute("data-atual")).not.toBe(antes);
    const segunda = tela.querySelector('[data-papel="fundo"] [data-pendente]') as HTMLElement;
    expect(segunda).toBeTruthy();
    expect(segunda.getAttribute("data-vaga")).not.toBe(primeiro);
    act(() => { fireEvent.click(segunda); });
    expect(tela.querySelector('[data-papel="fundo"] [data-pendente]')).toBeNull();
    expect(tela.querySelector('[data-testid="album-pe-proxima"]')).toBeNull();
    // as duas viraram vistas: o selo "N novas" some da capa
    expect((store.dados["conquistas-album-visto"] as string[]).sort()).toEqual(["first-expense", "sequencia-1", "sequencia-2", "sequencia-3", "sequencia-7"]);
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("0");
    expect(screen.queryByTestId("cn-album-selo")).toBeNull();
  });

  it("o detalhe da sequência abre a evolução, mantém quatro semanas e mede", () => {
    montar();
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    expect(screen.getByTestId("cn-detalhe-sequencia")).toBeTruthy();
    expect(screen.getByRole("list", {name:"Marcos da sequência"})).toBeTruthy();
    expect(screen.getByRole("button", {name:"Fechar"})).toHaveFocus();
    expect(screen.getByTestId("cn-calendario").querySelectorAll('[data-estado="feito"]').length).toBe(12);
    expect(nomes()).toContain(EVENTOS2.sequenciaAbrir);
  });

  it("(dev) o toast e a festa do marco montam e medem", () => {
    montar({ camada: "toast" });
    expect(screen.getByTestId("cn-toast").textContent).toMatch(/Colar no álbum/);
    expect(nomes()).toContain(EVENTOS2.toastView);
    cleanup();
    montar({ camada: "marco" });
    const festa = screen.getByTestId("cn-festa");
    expect(festa.textContent).toContain("7 dias seguidos!");
    expect(festa.textContent).toContain("Postar nos Stories");
    expect(eventos.find(([n]) => n === EVENTOS2.marcoView)?.[1]).toEqual({ dias: 7 });
  });
});

/* ------------------------------------------------------------------ conta NOVA: a 1ª figurinha (17/10, #95) */

describe("conta NOVA: a 1ª figurinha chega como a 2ª — '1 nova pra colar' e o momento de colar (revisão tela a tela #95)", () => {
  beforeEach(() => { vi.useRealTimers(); vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(AGORA); });
  const GASTO = [{ id: 1, value: 12, date: HOJE, description: "Café", category: "alimentacao" }];
  const abrirTela = (store: ReturnType<typeof montarStore>, testeDia: 1 | 2 | 3 | null = null) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/conquistas", state: { origem: "home" } }]}>
        <Provedor store={store}><ConquistasNova testeDia={testeDia} /></Provedor>
      </MemoryRouter>,
    );
  /** Uma tela de módulo (os Momentos montam em todas — App.tsx), o app de verdade logo que a conta chega. */
  const abrirModulo = (store: ReturnType<typeof montarStore>, rota = "/home") =>
    render(<MemoryRouter initialEntries={[rota]}><Provedor store={store}><MomentosConquistas /></Provedor></MemoryRouter>);
  const primeiroGasto = (store: ReturnType<typeof montarStore>) => {
    store.dados["finance-expenses"] = GASTO;
    store.dados["core-dias-anotados"] = [HOJE];
  };
  const colarNoAlbum = (_id: string) => {
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    for (let i = 0; i < 100; i++) avancar(200);
    expect(screen.getAllByRole("status").some(el => el.textContent?.includes("As 2 figurinhas foram coladas"))).toBe(true);
  };

  it("o caminho de sempre (Home antes do 1º gasto): as duas linhas de base nascem VAZIAS; depois do gasto, '1 nova pra colar', o álbum cola e reabrir não repete nada", () => {
    const store = montarStore({ "core-user-name": "Marina" });
    const home = abrirModulo(store);
    // a conta acabou de chegar e nada está colado: o registro e o álbum já têm base (vazia)
    expect(store.dados["conquistas-desbloqueadas"]).toEqual({});
    expect(store.dados["conquistas-album-visto"]).toEqual([]);
    home.unmount();

    primeiroGasto(store);
    const fin = abrirModulo(store, "/financas");
    // o registro grava o 1º adesivo como desbloqueio NOVO (com o evento, como o 2º) — o álbum NÃO o engole
    expect(store.dados["conquistas-desbloqueadas"]).toEqual({ "sequencia-1": HOJE, "first-expense": HOJE });
    expect(eventos.filter(([n]) => n === "adesivo_desbloqueado").map(([, d]) => d.id)).toContain("first-expense");
    expect(store.dados["conquistas-album-visto"]).toEqual([]);
    fin.unmount();

    abrirTela(store);
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("2");
    expect(screen.getByTestId("cn-album-selo").textContent).toMatch(/2 novas/);
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("Colar 2 figurinhas");
    colarNoAlbum("first-expense");
    expect([...(store.dados["conquistas-album-visto"] as string[])].sort()).toEqual(["first-expense", "sequencia-1"]);
    cleanup();

    // fechou e abriu o app de novo: nada pra colar, nenhum selo, a figurinha colada
    abrirTela(store);
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("0");
    expect(screen.queryByTestId("cn-album-pacotinho")).toBeNull();
    expect(screen.queryByTestId("cn-album-selo")).toBeNull();
    expect(screen.getByTestId("cn-album-contagem").textContent).toBe("2 / 99coladas");
    expect([...(store.dados["conquistas-album-visto"] as string[])].sort()).toEqual(["first-expense", "sequencia-1"]);
  });

  it("conta vazia que abre as Conquistas ANTES de anotar (o print #94): depois do 1º gasto, a 1ª figurinha espera pra ser colada (o print #95)", () => {
    const store = montarStore({ "core-user-name": "Marina" });
    abrirTela(store);
    expect(screen.getByTestId("cn-album-vazio")).toBeTruthy();
    expect(store.dados["conquistas-album-visto"]).toEqual([]);
    cleanup();
    primeiroGasto(store);
    abrirTela(store);
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("2");
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("Colar 2 figurinhas");
    colarNoAlbum("first-expense");
    expect([...(store.dados["conquistas-album-visto"] as string[])].sort()).toEqual(["first-expense", "sequencia-1"]);
  });

  it("no teste com a Missão em doses: a festa espera sem consumir o visto, e o álbum mostra '1 adesivo novo pra colar' e deixa colar", () => {
    nativo.v = true;
    localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 3 * 86400e3));
    gravarMissao(iniciarMissao(["financas", "rotina", "saude"]));
    const store = montarStore({ "core-user-name": "Marina" });
    abrirModulo(store).unmount();
    expect(store.dados["conquistas-album-visto"]).toEqual([]);

    primeiroGasto(store);
    abrirModulo(store, "/financas");
    avancar(2500);
    // A missão tem prioridade, mas a primeira festa continua pendente.
    expect(screen.queryByTestId("cn-toast")).toBeNull();
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).not.toContain("first-expense");
    cleanup();

    abrirTela(store, 1);
    expect(screen.getByTestId("cn-missao-album").textContent).toBe("2 adesivos novos pra colar ›");
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("2");
    colarNoAlbum("first-expense");
    expect([...(store.dados["conquistas-album-visto"] as string[])].sort()).toEqual(["first-expense", "sequencia-1"]);
    expect(screen.queryByTestId("cn-missao-album")).toBeNull();
  });

  it("(#102) 1 dia anotado: a folha da sequência diz '1 dia anotado' (não '1 dias anotados') e o resumo do leitor de tela fica no singular", () => {
    const store = montarStore({ "core-user-name": "Marina" });
    primeiroGasto(store);
    abrirTela(store);
    expect(screen.getByTestId("cn-seq-resumo").getAttribute("aria-label")).toBe("Recorde 1 dia · 0 de 2 protetores · 1 dia anotado");
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    const folha = screen.getByTestId("cn-detalhe-sequencia");
    expect(folha.textContent).toContain("Recorde de 1 dia");
    expect(folha.textContent).not.toMatch(/\b1 dias\b/);
    expect(document.body.textContent).not.toMatch(/\b1 (dias|figurinhas|adesivos)\b/);
  });

  it("quem JÁ tinha registro e nunca abriu o álbum segue como antes: o que está colado entra em silêncio na 1ª abertura do álbum", () => {
    const store = montarStore({ "core-user-name": "Ana", "core-dias-anotados": [HOJE], "conquistas-desbloqueadas": { "first-expense": "2026-09-01" }, "finance-expenses": GASTO });
    abrirModulo(store).unmount();
    expect(store.dados["conquistas-album-visto"]).toBeUndefined(); // os Momentos não mexem no álbum de quem já tinha registro
    abrirTela(store);
    expect([...(store.dados["conquistas-album-visto"] as string[])].sort()).toEqual(["first-expense", "sequencia-1"]);
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("0");
  });
});

/* ------------------------------------------------------------------ os momentos com a chave ligada */

const Rota = () => { const l = useLocation(); return <span data-testid="rota">{l.pathname}|{JSON.stringify(l.state)}</span>; };
const montarMomentos = (store: ReturnType<typeof montarStore>, rota = "/financas") =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}><MomentosConquistas /><Routes><Route path="*" element={<Rota />} /></Routes></Provedor>
    </MemoryRouter>,
  );
const baseMomentos = () => ({
  "core-user-name": "Ana",
  "core-dias-anotados": corrida(HOJE, 2),
  "conquistas-desbloqueadas": { "leitura-1": "2026-09-21" },
  "conquistas-vistas": { adesivos: ["leitura-1"], marcos: [] },
  "lib-books": [{ status: "lido" }],
  "finance-expenses": [{ id: 1, value: 10, date: HOJE }],
});

const espera = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe("momentos com conquistas2 ligada: toast no lugar do popup", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_FORCA_CONQUISTAS2, "on"); });

  it("a festa entrega o álbum sem a próxima conquista cobrir a colagem; a fila retoma ao fechar", async () => {
    const store = montarStore({
      "core-dias-anotados": [],
      "conquistas-desbloqueadas": { "mes-20": HOJE, "rotina-21": HOJE },
      "conquistas-vistas": { adesivos: [], marcos: [] },
      "conquistas-album-visto": [],
    });
    render(
      <MemoryRouter initialEntries={["/conquistas"]}>
        <Provedor store={store}><MomentosConquistas /><ConquistasNova testeDia={null} /></Provedor>
      </MemoryRouter>,
    );
    await espera(1700);
    const primeira = await screen.findByTestId("momento-adesivo");
    const nome = primeira.querySelector("h2")?.textContent;
    fireEvent.click(within(primeira).getByRole("button", { name: /Colar/ }));
    await waitFor(() => expect(screen.queryByTestId("momento-adesivo")).toBeNull());
    expect(screen.getByTestId("album-tela")).toBeTruthy();
    await espera(3000);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Fechar o álbum" }));
    await waitFor(() => expect(screen.queryByTestId("album-tela")).toBeNull());
    await espera(1400);
    const proxima = await screen.findByTestId("momento-adesivo");
    expect(proxima.querySelector("h2")?.textContent).not.toBe(nome);
  });

  it("a primeira figurinha tem apresentação uma vez; fechar o app não repete", async () => {
    const store = montarStore({"core-dias-anotados":[], "conquistas-vistas":{adesivos:[],marcos:[]}, "conquistas-desbloqueadas":{"first-expense":HOJE}, "conquistas-album-visto":[]});
    const app = montarMomentos(store);
    await espera(1700);
    const festa = await screen.findByTestId("momento-adesivo");
    expect(festa).toHaveAttribute("data-primeira");
    expect(festa).toHaveTextContent("Seu álbum começou");
    expect(lerFestasMostradas("u1")).toContain("first-expense");
    app.unmount();
    montarMomentos(store);
    await espera(1800);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect((store.dados["conquistas-vistas"] as {adesivos:string[]}).adesivos).toContain("first-expense");
  });

  it("várias especiais juntas não consomem a apresentação inicial pelo limite da fila", async () => {
    const store = montarStore({"core-dias-anotados":[], "conquistas-vistas":{adesivos:[],marcos:[]}, "conquistas-desbloqueadas":Object.fromEntries(["mes-20","rotina-21","leitura-10","treino-50","treino-100"].map(id=>[id,HOJE]))});
    montarMomentos(store);
    await espera(1800);
    expect(await screen.findByTestId("momento-adesivo")).toHaveAttribute("data-primeira");
    expect((store.dados["conquistas-vistas"] as {adesivos:string[]}).adesivos).toEqual([]);
  });

  it("a primeira festa aguarda a missão terminar e não depende de estar em trial", async () => {
    nativo.v = true;
    localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 3 * 86400e3));
    const missao = gravarMissao(iniciarMissao(["financas", "rotina", "saude"]));
    const guia = document.createElement("div"); guia.setAttribute("data-camada-guia", "missao"); document.body.append(guia);
    const store = montarStore({"core-dias-anotados":[], "conquistas-vistas":{adesivos:[],marcos:[]}, "conquistas-desbloqueadas":{"first-expense":HOJE}});
    montarMomentos(store);
    await espera(1800);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect((store.dados["conquistas-vistas"] as {adesivos:string[]}).adesivos).toEqual([]);
    guia.remove();
    act(() => { gravarMissao({...missao, explorou:true}); });
    await espera(1800);
    expect(await screen.findByTestId("momento-adesivo")).toHaveAttribute("data-primeira");
  });

  it("uma rara usa cartão intermediário depois da primeira conquista", async () => {
    const store = montarStore({...baseMomentos(), "core-dias-anotados":[], "finance-expenses":[], "conquistas-desbloqueadas":{"leitura-1":HOJE,"treino-25":HOJE}});
    montarMomentos(store);
    await espera(1800);
    const festa = await screen.findByTestId("momento-adesivo");
    expect(festa).toHaveAttribute("data-tipo", "raro");
    expect(festa).not.toHaveAttribute("data-primeira");
    fireEvent.click(within(festa).getByRole("button",{name:"Colar no álbum"}));
    expect(screen.getByTestId("rota")).toHaveTextContent('"album":"treino-25","colar":true');
  });

  it("o comum vira cartão breve (6 s → visto); o 'Voltei' de hoje vem junto; o toque abre /conquistas na página da figurinha", async () => {
    const store = montarStore(baseMomentos());
    montarMomentos(store);
    await espera(1700);
    const toast = await screen.findByTestId("cn-toast");
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect(toast.getAttribute("data-quantidade")).toBe("2"); // Primeira Despesa + Voltei (2 dias seguidos, bateu hoje)
    expect(eventos.find(([n]) => n === EVENTOS2.toastView)?.[1]).toMatchObject({ quantidade: 2, suave: false });
    fireEvent.click(within(toast).getByRole("button", {name: "Ver minhas figurinhas"}));
    expect(eventos.find(([n]) => n === EVENTOS2.toastToque)).toBeTruthy();
    const v = (store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos;
    expect(v).toEqual(expect.arrayContaining(["first-expense", "sequencia-2"]));
    // o álbum abre na página da 1ª figurinha do toast (o "Voltei" vem antes no catálogo)
    expect(screen.getByTestId("rota").textContent).toMatch(/^\/conquistas\|.*"origem":"toast".*"album":"sequencia-2"/);
  });

  it("o toast some sozinho e conta como visto; fechou o app com ele aberto → já está em core-festas-mostradas", async () => {
    const store = montarStore(baseMomentos());
    montarMomentos(store);
    await espera(1700);
    await screen.findByTestId("cn-toast");
    expect(lerFestasMostradas("u1")).toContain("first-expense");
    await espera(TOAST_MS + 50);
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toContain("first-expense");
  });

  it("quem já tinha recorde de 14 ganha o 'Duas Semanas' em silêncio (vira visto, sem toast)", async () => {
    const store = montarStore({ ...baseMomentos(), "core-dias-anotados": corrida(somarDias(HOJE, -30), 20), "finance-expenses": [], "lib-books": [] });
    montarMomentos(store);
    await espera(1700);
    await waitFor(() => expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toEqual(expect.arrayContaining(["sequencia-2", "sequencia-3", "sequencia-14"])));
    expect(screen.queryByTestId("cn-toast")).toBeNull();
  });

  it("com a chave desligada, o popup de sempre", async () => {
    localStorage.removeItem(CHAVE_FORCA_CONQUISTAS2);
    const store = montarStore(baseMomentos());
    montarMomentos(store);
    await espera(1700);
    await screen.findByTestId("momento-popup");
    expect(screen.queryByTestId("cn-toast")).toBeNull();
  });
});

describe("1.0.18 (menu novo): a Retrospectiva sai do menu e ganha a porta fixa no fim das Conquistas 2", () => {
  afterEach(() => { try { localStorage.removeItem("core-menu-novo"); } catch { /* noop */ } cleanup(); });
  const montarComRotas = () => render(
    <MemoryRouter initialEntries={["/conquistas"]}>
      <Provedor store={montarStore(cenario())}>
        <Routes>
          <Route path="/conquistas" element={<ConquistasNova testeDia={null} />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
  it("menu novo (padrão): 'Retrospectiva do mês' no fim, depois de 'Ver todos os adesivos', leva à /retrospectiva", async () => {
    montarComRotas();
    const link = await screen.findByTestId("conquistas-retrospectiva");
    expect(screen.getByTestId("cn-ver-todos").compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(link);
    expect((await screen.findByTestId("rota")).textContent).toMatch(/^\/retrospectiva\|/);
  });
  it("menu_novo off: sem o link", async () => {
    localStorage.setItem("core-menu-novo", "off");
    montarComRotas();
    await screen.findByTestId("cn-ver-todos");
    expect(screen.queryByTestId("conquistas-retrospectiva")).toBeNull();
  });
});
