/**
 * CONQUISTAS 2 (16/10): a chave, a mecânica pura (próximo prêmio, formato do
 * aviso, adesivos novos da sequência, o lembrete com o prêmio), o álbum por
 * módulo com a figurinha esperando pra ser COLADA, a tela e os momentos
 * (toast × tela cheia) — com dados em memória, nada vai pro servidor.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
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
import { EVENTOS2, festaDoMarcoNovo, formatoDoAviso, fraseDaColecao, fraseDaPagina, fraseDaPaginaMaisPerto, fraseDoPremio, podeCompartilhar, premioDoLembrete, proximoPremio } from "@/components/conquistas/nova/recompensas";
import { MomentosConquistas, TOAST_MS, outraTelaAberta } from "@/components/conquistas/Momentos";
import { montarAlbumPorModulo, paginaDaFigurinha } from "@/components/conquistas/album-paginas";
import { CAPA_SAI_MS } from "@/components/conquistas/AlbumTela";
import { ADESIVOS_SEQUENCIA_NOVOS, buildBadgesSequencia } from "@/lib/conquistas-registro";
import { CHAVE_FORCA_CONQUISTAS2, _zerarChaveRemotaConquistas2, conquistas2Ligada, guardarForcaConquistas2, lerChaveRemotaConquistas2, registrarChaveRemotaConquistas2 } from "@/lib/conquistas2";
import { IDS_COM_ARTE } from "@/components/conquistas/adesivos-arte";
import { somarDias } from "@/lib/sequencia";

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
    expect(lerChaveRemotaConquistas2({ current: { metadata: {} }, all: { anual_69: { metadata: { conquistas2: "on" } } } })).toBe("on");
    guardarForcaConquistas2("?conquistas2=on");
    expect(localStorage.getItem(CHAVE_FORCA_CONQUISTAS2)).toBe("on");
    expect(conquistas2Ligada()).toBe(true);
    guardarForcaConquistas2("?conquistas2=auto");
    expect(conquistas2Ligada()).toBe(false);
  });
});

/* ------------------------------------------------------------------ a mecânica */

describe("os adesivos novos da sequência (no registro de verdade)", () => {
  it("2, 3 e 14 dias existem em buildBadgesSequencia, com arte, e abrem pelo recorde", () => {
    const lista = buildBadgesSequencia(0);
    expect(lista.map((b) => b.id)).toEqual(["sequencia-2", "sequencia-3", "sequencia-7", "sequencia-14", "sequencia-30", "sequencia-100", "protetor-1", "ano-365"]);
    expect(lista.every((b) => IDS_COM_ARTE.includes(b.id))).toBe(true);
    const com3 = buildBadgesSequencia(3);
    expect(com3.filter((b) => b.unlocked).map((b) => b.id)).toEqual(["sequencia-2", "sequencia-3"]);
    expect(com3.find((b) => b.id === "sequencia-2")?.name).toBe("Voltei");
    expect(ADESIVOS_SEQUENCIA_NOVOS[3].raridade).toBe("raro");
    expect(buildBadgesSequencia(14).find((b) => b.id === "sequencia-14")?.raridade).toBe("raro");
  });

  it("comum e raro viram toast; marcos de 7/30/100 e épicos/lendários, tela cheia; compartilhar só nos marcos", () => {
    const lista = buildBadgesSequencia(100);
    const de = (id: string) => lista.find((b) => b.id === id)!;
    expect(formatoDoAviso(de("sequencia-2"))).toBe("toast");
    expect(formatoDoAviso(de("sequencia-14"))).toBe("toast");
    expect(formatoDoAviso(de("sequencia-7"))).toBe("tela_cheia");
    expect(formatoDoAviso(de("ano-365"))).toBe("tela_cheia");
    expect(formatoDoAviso({ id: "rotina-21", xp: 200 })).toBe("tela_cheia");
    expect(formatoDoAviso({ id: "first-expense", xp: 50 })).toBe("toast");
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
    expect(fraseDaColecao(4, 7)).toBe("faltam 3 pra fechar");
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
    expect(paginas[1].vagas).toHaveLength(8);
    expect(paginas[1].abertos).toBe(2);
    expect(paginaDaFigurinha(paginas, "sequencia-14")).toBe(1);
  });
});

/* ------------------------------------------------------------------ a tela */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const cenario = (extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
  "conquistas-desbloqueadas": { "sequencia-7": "2026-10-10", "sequencia-3": "2026-10-06", "sequencia-2": "2026-10-05", "first-expense": "2026-09-01" },
  // o "Primeira Despesa" colou desde a última visita: espera no álbum
  "conquistas-album-visto": ["sequencia-7", "sequencia-3", "sequencia-2"],
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
  it("monta as 4 peças, nada da tela antiga, e mede conquistas2_open + amanha_visto", () => {
    montar({}, {}, { origem: "home" });
    expect(screen.getByTestId("cn-hero")).toBeTruthy();
    expect(screen.getByTestId("cn-album")).toBeTruthy();
    expect(screen.getByTestId("cn-album-contagem").textContent).toMatch(/4 de \d+/);
    expect(screen.getByTestId("cn-amanha-frase").textContent).toContain("Faltam 2 dias pro adesivo de 14 dias 🔥");
    // (dono 17/10, enxugar) a explicação só no aria-label; sem "COLADO"/"30 DIAS"/contador na trilha; rótulos curtos
    expect(screen.getByTestId("cn-amanha-frase").getAttribute("aria-label")).toContain("Vale qualquer anotação");
    expect(screen.queryByTestId("cn-amanha-instrucao")).toBeNull();
    expect(screen.getByTestId("cn-amanha").textContent).not.toMatch(/COLADO|3 de 6|Seguidos/);
    expect(screen.getByTestId("cn-amanha").textContent).toMatch(/Voltei.*3 dias.*7 dias.*EM 2 DIAS.*14 dias.*30 dias.*100 dias/s);
    // (dono 17/10) a frase do próximo adesivo aparece UMA vez (na trilha): o card do álbum termina no "Abrir o álbum"
    expect(screen.queryByTestId("cn-album-amanha")).toBeNull();
    expect(vezes("Faltam 2 dias pro adesivo de 14 dias")).toBe(1);
    const album = screen.getByTestId("cn-album");
    expect(album.lastElementChild).toBe(screen.getByTestId("cn-album-abrir"));
    // sem o eyebrow e sem "coladas" visíveis (ficam pro leitor de tela); o cabeçalho com o troféu de sempre; a ação num chip "Hoje: …"
    // (dono 17/10, 2ª rodada) o eyebrow rosa "Álbum de figurinhas" e o "coladas" ficam — "textos que informam e são simples"
    expect(album.querySelector("#cn-titulo-album")?.className).toContain("cn-caps");
    expect(album.querySelector("#cn-titulo-album")?.textContent).toBe("Álbum de figurinhas");
    expect(screen.getByTestId("cn-album-contagem").textContent?.replace(/\s+/g, " ").trim()).toBe("4 de 68 coladas");
    expect(screen.getByTestId("cn-album-contagem").getAttribute("aria-label")).toBe("4 de 68 figurinhas coladas");
    expect(document.querySelector("header svg.lucide-trophy")).toBeTruthy();
    expect(document.querySelector("header [data-fogo]")).toBeNull();
    expect(screen.getByTestId("cn-acao").textContent).toMatch(/^Hoje: /);
    expect(screen.getByTestId("cn-acao").getAttribute("aria-label")).toMatch(/^Anota 1 coisa hoje pra não perder a sequência: /);
    expect(document.body.textContent).not.toMatch(/dias de anotação|a vaga já está/);
    // o cartão da sequência, compacto e com a cara dos cards do app: faixa "SEQUÊNCIA", número + "dias seguidos", os 7 pontos, o resumo numa linha — sem o anel grande
    const hero = screen.getByTestId("cn-hero");
    expect(hero.querySelector(".cn-seq-cab")?.textContent).toContain("SEQUÊNCIA");
    expect(hero.querySelector(".cn-seq-cab")?.textContent).not.toMatch(/fogo (vermelho|laranja)/);
    expect(hero.querySelector(".cn-seq-num")?.textContent).toBe("12");
    expect(screen.getByTestId("cn-seq-semana").querySelectorAll("[data-estado]")).toHaveLength(7);
    expect(screen.getByTestId("cn-seq-resumo").textContent?.replace(/\s+/g, " ")).toBe("Recorde 12 · 1 protetor");
    expect(screen.getByTestId("cn-seq-resumo").getAttribute("aria-label")).toBe("Recorde 12 dias · 1 de 2 protetores · 12 dias anotados");
    expect(hero.querySelector(".cn-b-anel")).toBeNull();
    // (dono 17/10) sem o card das páginas; só o link discreto da grade
    expect(screen.queryByTestId("cn-colecao")).toBeNull();
    expect(screen.getByTestId("cn-ver-todos").textContent).toContain("Ver todos os adesivos");
    expect(screen.queryByTestId("seletor-capa")).toBeNull();
    expect(document.body.textContent).not.toMatch(/INSÍGNIAS|Nível |XP/);
    expect(eventos.find(([n]) => n === EVENTOS2.abrir)?.[1]).toMatchObject({ origem: "home", dias: 12, teste_dia: null });
    expect(nomes()).toContain(EVENTOS2.amanhaVisto);
  });

  it("a capa mostra a figurinha nova esperando (selo + pacotinho); 'ver todos' abre a grade secundária", () => {
    montar();
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("1");
    expect(screen.getByTestId("cn-album-selo").textContent).toMatch(/1 nova/);
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("1 nova pra colar");
    fireEvent.click(screen.getByTestId("cn-ver-todos"));
    expect(screen.getByTestId("cn-colecao-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.colecaoAbrir)?.[1]).toEqual({ colecao: "todas" });
  });

  it("sem figurinha nova: 'faltam N pra completar a página'", () => {
    montar({}, { "conquistas-album-visto": ["sequencia-7", "sequencia-3", "sequencia-2", "first-expense"] });
    expect(screen.queryByTestId("cn-album-selo")).toBeNull();
    expect(screen.getByTestId("cn-album-pagina").textContent).toMatch(/^Faltam? \d+ na página (\d )?das (raras|comuns|épicas|lendárias)$/);
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
    // o álbum é o de hoje (por raridade): a capa sai e a página das RARAS tem a vaga do 14 marcada "EM 2 DIAS"
    avancar(CAPA_SAI_MS + 1000);
    expect(screen.queryByTestId("album-aba-sequencia")).toBeNull();
    fireEvent.click(screen.getByTestId("album-aba-raro"));
    avancar(1000);
    const vaga = document.querySelector('[data-papel="fundo"] [data-vaga="sequencia-14"]')!;
    expect(vaga.hasAttribute("data-destaque")).toBe(true);
    expect(vaga.querySelector('[data-testid="vaga-destaque"]')?.textContent).toBe("EM 2 DIAS");
    // vagas vazias e "Faltam N figurinhas nesta página"
    expect(document.querySelector('[data-papel="fundo"] [data-testid="album-pe-pagina"]')?.textContent).toMatch(/Faltam \d+ figurinhas nesta página/);
  });

  it("o pacotinho abre o álbum na página da figurinha nova, que espera SOLTA; o toque COLA (peel), grava o visto e mede", async () => {
    const { store } = montar();
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    expect(screen.getByTestId("album-tela")).toBeTruthy();
    expect(eventos.find(([n]) => n === EVENTOS2.albumAbrir)?.[1]).toMatchObject({ origem: "pacotinho", novas: 1 });
    avancar(CAPA_SAI_MS + 1000);
    const vaga = () => document.querySelector('[data-papel="fundo"] [data-vaga="first-expense"]') as HTMLElement;
    expect(vaga().hasAttribute("data-pendente")).toBe(true);
    expect(vaga().querySelector('[data-testid="vaga-pendente"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="album-pe-colar"]')?.textContent).toMatch(/1 figurinha nova/);
    act(() => { fireEvent.click(vaga()); });
    expect(vaga().hasAttribute("data-pendente")).toBe(false);
    expect(vaga().querySelector(".vaga-fig[data-cola]")).toBeTruthy(); // colou com o peel
    expect(store.dados["conquistas-album-visto"]).toContain("first-expense");
    expect(eventos.find(([n]) => n === EVENTOS2.figurinhaColar)?.[1]).toMatchObject({ id: "first-expense", raridade: "comum", restantes: 0 });
    expect(screen.queryByTestId("detalhe-vaga")).toBeNull(); // o toque colou, não abriu o detalhe
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
    expect(screen.getByTestId("cn-missao-album").textContent).toBe("1 adesivo novo pra colar ›");
    // a ação do dia no teste: "anote o gasto de hoje" vira "Hoje: anote o gasto" (sem "hoje" duas vezes)
    expect(screen.getByTestId("cn-acao").textContent).toMatch(/^Hoje: anote /);
    expect(screen.getByTestId("cn-amanha-frase").textContent).toContain('Anota algo hoje e ganha o adesivo "Voltei"');
    // o chip da missão fica; a frase do adesivo de hoje aparece UMA vez (trilha), nada no card do álbum
    expect(vezes('Anota algo hoje e ganha o adesivo "Voltei"')).toBe(1);
    expect(screen.queryByTestId("cn-album-amanha")).toBeNull();
    fireEvent.click(screen.getByTestId("cn-missao-album"));
    expect(eventos.find(([n]) => n === EVENTOS2.albumAbrir)?.[1]).toMatchObject({ origem: "missao" });
  });

  it("quem já usa (dado antigo, sem os 3 adesivos novos no visto): nada se perde — 12 dias, os 4 colados de antes, e os novos de 2/3 dias aparecem como figurinhas novas pra colar", () => {
    // o registro de antes de 16/10: só o 7, o first-expense e o visto antigo (sem sequencia-2/3)
    const { store } = montar({}, { "conquistas-desbloqueadas": { "sequencia-7": "2026-10-10", "first-expense": "2026-09-01" }, "conquistas-album-visto": ["sequencia-7", "first-expense"] });
    expect(screen.getByTestId("cn-hero").textContent).toContain("12");
    expect(screen.getByTestId("cn-album-contagem").textContent).toMatch(/4 de 68/); // 7 + first-expense + os 2 novos pelo recorde (2 e 3)
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("2");
    expect(screen.getByTestId("cn-album-pacotinho").textContent).toBe("2 novas pra colar");
    // as chaves de sempre continuam lá, intactas (a tela só lê; o visto antigo não foi reescrito)
    expect(store.dados["core-dias-anotados"]).toHaveLength(12);
    expect(store.dados["conquistas-album-visto"]).toEqual(["sequencia-7", "first-expense"]);
    // o registro ganha os 2 novos com a data de hoje (como qualquer adesivo que abre); os de antes ficam com a data deles
    const desbloqueadas = store.dados["conquistas-desbloqueadas"] as Record<string, string>;
    expect(desbloqueadas).toMatchObject({ "sequencia-7": "2026-10-10", "first-expense": "2026-09-01", "sequencia-2": HOJE, "sequencia-3": HOJE });
  });

  it("conta vazia: a capa com '?' e 'Nenhuma figurinha ainda. Anota algo hoje e a primeira cola.'", () => {
    montar({}, { "core-dias-anotados": [], "conquistas-desbloqueadas": {}, "conquistas-album-visto": [], "finance-expenses": [] });
    expect(screen.getByTestId("cn-album-contagem").textContent).toMatch(/0 de 68/);
    expect(screen.getByTestId("cn-album-vazio").textContent).toContain("Anota algo hoje");
    // 0 dias: anotar hoje é o 1º dia, amanhã o 2º → "Faltam 2 dias pro adesivo 'Voltei'" — só na trilha, não no card do álbum
    expect(screen.getByTestId("cn-amanha-frase").textContent).toContain('Faltam 2 dias pro adesivo "Voltei" 🔥');
    expect(vezes('Faltam 2 dias pro adesivo "Voltei"')).toBe(1);
    expect(screen.queryByTestId("cn-album-amanha")).toBeNull();
    expect(screen.getByTestId("cn-album").lastElementChild).toBe(screen.getByTestId("cn-album-abrir"));
  });

  it("a dose da missão em cena (data-missao-dose=\"1\", contrato com o ramo da missão) segura toast e festa", () => {
    expect(outraTelaAberta()).toBe(false);
    document.documentElement.dataset.missaoDose = "1";
    expect(outraTelaAberta()).toBe(true);
    delete document.documentElement.dataset.missaoDose;
    expect(outraTelaAberta()).toBe(false);
  });

  it("duas figurinhas novas em páginas diferentes: colou uma → o rodapé oferece a próxima ('Mais 1 figurinha nova em Raras') e leva até ela", () => {
    // first-expense (comum) e sequencia-3 (rara) fora do visto
    const { store } = montar({}, { "conquistas-album-visto": ["sequencia-7", "sequencia-2"] });
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("2");
    fireEvent.click(screen.getByTestId("cn-album-pacotinho"));
    avancar(CAPA_SAI_MS + 1000);
    const tela = screen.getByTestId("album-tela");
    const paginaDeBaixo = () => tela.querySelector('[data-papel="fundo"]') as HTMLElement;
    const pendente = paginaDeBaixo().querySelector("[data-pendente]") as HTMLElement;
    expect(pendente).toBeTruthy();
    const primeiro = pendente.getAttribute("data-vaga")!;
    act(() => { fireEvent.click(pendente); });
    // colou: o rodapé desta página agora aponta pra outra página com figurinha nova
    const proxima = paginaDeBaixo().querySelector('[data-testid="album-pe-proxima"]') as HTMLElement;
    expect(proxima.textContent).toMatch(/Mais 1 figurinha nova em (Raras|Comuns)/);
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
    expect((store.dados["conquistas-album-visto"] as string[]).sort()).toEqual(["first-expense", "sequencia-2", "sequencia-3", "sequencia-7"]);
    expect(screen.getByTestId("cn-album").getAttribute("data-novas")).toBe("0");
    expect(screen.queryByTestId("cn-album-selo")).toBeNull();
  });

  it("o detalhe da sequência (4 semanas, com o anel de 7 arcos) abre e mede", () => {
    montar();
    fireEvent.click(screen.getByTestId("cn-abrir-sequencia"));
    expect(screen.getByTestId("cn-detalhe-sequencia")).toBeTruthy();
    expect(screen.getByTestId("cn-anel")).toBeTruthy();
    expect(screen.getByTestId("cn-calendario").querySelectorAll('[data-estado="feito"]').length).toBe(12);
    expect(nomes()).toContain(EVENTOS2.sequenciaAbrir);
  });

  it("(dev) o toast e a festa do marco montam e medem", () => {
    montar({ camada: "toast" });
    expect(screen.getByTestId("cn-toast").textContent).toMatch(/toque pra colar no álbum/);
    expect(nomes()).toContain(EVENTOS2.toastView);
    cleanup();
    montar({ camada: "marco" });
    const festa = screen.getByTestId("cn-festa");
    expect(festa.textContent).toContain("7 dias seguidos!");
    expect(festa.textContent).toContain("Postar nos Stories");
    expect(eventos.find(([n]) => n === EVENTOS2.marcoView)?.[1]).toEqual({ dias: 7 });
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

  it("o comum vira toast (3,5 s → visto); o 'Voltei' de hoje vem junto; o toque abre /conquistas na página da figurinha", async () => {
    const store = montarStore(baseMomentos());
    montarMomentos(store);
    await espera(1700);
    const toast = await screen.findByTestId("cn-toast");
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect(toast.getAttribute("data-quantidade")).toBe("2"); // Primeira Despesa + Voltei (2 dias seguidos, bateu hoje)
    expect(eventos.find(([n]) => n === EVENTOS2.toastView)?.[1]).toMatchObject({ quantidade: 2, suave: false });
    fireEvent.click(toast);
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
    expect(JSON.parse(localStorage.getItem("core-festas-mostradas") || "[]")).toContain("first-expense");
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
