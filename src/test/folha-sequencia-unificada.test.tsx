/**
 * 26/10 — A FOLHA DA SEQUÊNCIA UNIFICADA (components/fogo/FolhaSequencia): a mesma na Home nova e nas Conquistas.
 *   · fogo unificado + "N dias seguidos"; "Recorde de N dias" só se o recorde for MAIOR que a atual;
 *   · status: "Hoje já conta." + próxima faixa (nomes do caderno) OU "Pra continuar hoje: <ação>" que leva a fazer;
 *   · a semana em 7 bolinhas com os estados reais (feito / gelo / hoje / vazio / futuro); "Ver mais" = 4 semanas;
 *   · "Sua evolução" compacta, posicionada no próximo marco (conquistados à esquerda), tocar amplia (onAdesivo);
 *   · protetores numa linha + ⓘ; rodapé "O que conta"; sem "Últimas 4 semanas" nem o botão de lembrete do Codex;
 *   · 26/10: a linha "🔔 Me lembrar da sequência" (só no app) liga o lembrete de hoje; ligado, leva a Lembretes;
 *   · eventos sequencia_folha_aberta / _acao com a origem.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
vi.mock("@/lib/notificacoes", () => ({ temPermissao: async () => true, pedirPermissao: async () => true }));
vi.mock("@/lib/reagendar", () => ({ reagendarTudo: async () => {} }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));

import { FolhaSequencia, fraseDaProximaFaixaDoCaderno } from "@/components/fogo/FolhaSequencia";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import type { Badge } from "@/components/gamification/types";
import { faixaDoFogo } from "@/lib/fogo-sequencia";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

// quarta-feira 28/10/2026: a semana vai de 26 (seg) a 1/11 (dom)
const HOJE = "2026-10-28";
const badge = (marco: number, unlocked: boolean): Badge => ({
  id: `sequencia-${marco}`, name: `${marco} dias`, description: "", icon: "🔥", category: "sequencia" as Badge["category"],
  unlocked, color: "#000", xp: 100, raridade: "comum",
});
const TRILHA = [badge(1, true), badge(2, true), badge(3, true), badge(7, true), badge(14, false), badge(30, false), badge(100, false)];
const seqDe = (p: Partial<Sequencia> & { dias: number; hojeFeito: boolean }): Sequencia => ({
  dias: p.dias, hojeFeito: p.hojeFeito, saldo: 2, usados: p.usados ?? [], recorde: p.recorde ?? p.dias, hoje: HOJE,
  lista: p.lista ?? [], acao: p.acao ?? ({ id: "habito", texto: "marcar um hábito hoje", rota: "/rotina" } as unknown as Sequencia["acao"]),
  faixa: faixaDoFogo(p.dias), protegidoOntem: false,
});
const montar = (seq: Sequencia, extra: Partial<Parameters<typeof FolhaSequencia>[0]> = {}, dados: Dados = {}) => {
  const onAdesivo = vi.fn(); const onIr = vi.fn(); const onFechar = vi.fn();
  const n = criarNuvem(dados); // a folha lê a conta (o lembrete da sequência)
  render(<n.Provedor><FolhaSequencia aberta onFechar={onFechar} seq={seq} trilha={TRILHA} origem="home" onAdesivo={onAdesivo} onIr={onIr} {...extra} /></n.Provedor>);
  return { onAdesivo, onIr, onFechar, n };
};

beforeAll(() => { prepararJsdom(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-28T12:00:00")); });
beforeEach(() => { eventos.length = 0; nativo.v = false; });
afterEach(() => cleanup());

describe("cabeçalho e status", () => {
  it("'9 dias seguidos' sem recorde (igual à atual); com recorde maior, 'Recorde de 30 dias'", () => {
    montar(seqDe({ dias: 9, hojeFeito: true, lista: ["2026-10-27", HOJE] }));
    expect(screen.getByTestId("he-seq-dias").textContent).toBe("9");
    expect(screen.getByText(/dias seguidos/)).toBeTruthy();
    expect(screen.queryByTestId("he-seq-recorde")).toBeNull();
    cleanup();
    montar(seqDe({ dias: 9, hojeFeito: true, recorde: 30, lista: ["2026-10-27", HOJE] }));
    expect(screen.getByTestId("he-seq-recorde").textContent).toBe("Recorde de 30 dias");
    expect(screen.getByTestId("he-seq-fogo").getAttribute("data-fogo")).toBe("aceso");
    expect(screen.getByTestId("he-seq-fogo").getAttribute("data-faixa")).toBe("ambar");
  });

  it("garantido: '✓ Hoje já conta.' + a próxima faixa nos nomes do caderno; no topo (ouro), a frase do topo", () => {
    montar(seqDe({ dias: 9, hojeFeito: true, lista: [HOJE] }));
    expect(screen.getByTestId("he-seq-garantido").textContent).toContain("Hoje já conta.");
    expect(screen.getByTestId("he-seq-garantido").textContent).toContain("Faltam 5 dias pro fogo petróleo.");
    expect(screen.queryByTestId("he-seq-acao")).toBeNull();
    expect(fraseDaProximaFaixaDoCaderno(2)).toBe("Falta 1 dia pro fogo laranja vivo");
    expect(fraseDaProximaFaixaDoCaderno(120)).toBeNull();
    cleanup();
    montar(seqDe({ dias: 120, hojeFeito: true, lista: [HOJE] }));
    expect(screen.getByTestId("he-seq-garantido").textContent).toContain("fogo ouro");
  });

  it("não garantido: 'Pra continuar hoje: <ação>' leva a fazer (onIr com a rota + evento com a origem); fogo apagado", () => {
    const { onIr, onFechar } = montar(seqDe({ dias: 9, hojeFeito: false, lista: ["2026-10-27"] }), { origem: "conquistas" });
    expect(screen.getByTestId("he-seq-fogo").getAttribute("data-fogo")).toBe("apagado");
    const acao = screen.getByTestId("he-seq-acao");
    expect(acao.textContent).toContain("Pra continuar hoje");
    expect(acao.textContent).toContain("Marcar um hábito");
    expect(screen.queryByTestId("he-seq-garantido")).toBeNull();
    fireEvent.click(acao);
    expect(onFechar).toHaveBeenCalled();
    vi.useRealTimers();
    return new Promise<void>((r) => setTimeout(() => {
      expect(onIr).toHaveBeenCalledWith("/rotina");
      expect(eventos.some(([e, d]) => e === "sequencia_folha_acao" && d.destino === "/rotina" && d.origem === "conquistas")).toBe(true);
      expect(eventos.some(([e, d]) => e === "sequencia_folha_aberta" && d.origem === "conquistas" && d.garantido === false)).toBe(true);
      vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-28T12:00:00"));
      r();
    }, 250));
  });
});

describe("a semana", () => {
  it("estados reais: registrado = feito (✓ na cor), protetor usado = gelo, hoje sem nada = hoje (tracejado), perdido = vazio, futuro = futuro", () => {
    montar(seqDe({ dias: 3, hojeFeito: false, lista: ["2026-10-24", "2026-10-27"], usados: ["2026-10-26"] }));
    const dias = screen.getAllByTestId("he-seq-dia").map((d) => [d.getAttribute("data-estado"), d.getAttribute("data-hoje")]);
    // seg 26 = gelo · ter 27 = feito · qua 28 = hoje · qui..dom = futuro
    expect(dias).toEqual([["gelo", "0"], ["feito", "0"], ["hoje", "1"], ["futuro", "0"], ["futuro", "0"], ["futuro", "0"], ["futuro", "0"]]);
    cleanup();
    montar(seqDe({ dias: 4, hojeFeito: true, lista: ["2026-10-26", HOJE] }));
    const d2 = screen.getAllByTestId("he-seq-dia").map((d) => d.getAttribute("data-estado"));
    expect(d2).toEqual(["feito", "vazio", "feito", "futuro", "futuro", "futuro", "futuro"]);
  });

  it("'Ver as últimas 4 semanas' expande 28 bolinhas com os mesmos estados; a grade cinza e o lembrete não existem", () => {
    montar(seqDe({ dias: 3, hojeFeito: true, lista: ["2026-10-20", "2026-10-27", HOJE], usados: ["2026-10-26"] }));
    expect(screen.queryByTestId("he-seq-quatro-semanas")).toBeNull();
    fireEvent.click(screen.getByTestId("he-seq-ver-mais"));
    const grade = screen.getByTestId("he-seq-quatro-semanas");
    expect(grade.children.length).toBe(28);
    expect(grade.querySelector('[aria-label="2026-10-20"]')).toBeTruthy();
    expect(screen.queryByText(/Últimas 4 semanas/)).toBeNull();
    expect(screen.queryByTestId("cn-lembrete")).toBeNull();
    expect(screen.queryByText(/lembrete/i)).toBeNull();
  });
});

describe("a evolução (as figurinhas da sequência)", () => {
  it("compacta: sem repetir 'N dias'; conquistadas à esquerda, o PRÓXIMO marco em destaque ('Faltam 5 dias'), o resto 'A conquistar'; sem o Voltei", () => {
    const { onAdesivo } = montar(seqDe({ dias: 9, hojeFeito: true, lista: [HOJE] }));
    const evolucao = screen.getByTestId("he-seq-evolucao");
    expect(evolucao.getAttribute("data-destaque")).toBe("sequencia-14");
    const itens = Array.from(evolucao.querySelectorAll("li"));
    expect(itens.map((li) => li.getAttribute("data-marco"))).toEqual(["1", "3", "7", "14", "30", "100"]);
    const textos = within(evolucao).getAllByTestId("he-seq-marco").map((b) => b.querySelector("small")?.textContent);
    expect(textos).toEqual(["Conquistada", "Conquistada", "Conquistada", "Faltam 5 dias", "A conquistar", "A conquistar"]);
    expect(itens[3].hasAttribute("data-destaque")).toBe(true);
    expect(itens.slice(0, 3).every((li) => li.hasAttribute("data-conquistada"))).toBe(true);
    expect(evolucao.textContent).not.toMatch(/\b14 dias\b/); // o rótulo "N dias" já está na arte
    fireEvent.click(within(evolucao).getAllByTestId("he-seq-marco")[3]);
    expect(onAdesivo).toHaveBeenCalledWith(expect.objectContaining({ id: "sequencia-14" }));
    expect(eventos.some(([e, d]) => e === "sequencia_folha_acao" && d.acao === "figurinha" && d.destino === "sequencia-14" && d.origem === "home")).toBe(true);
  });
  it("0 dias e nada conquistado: o 1º marco em destaque, tudo 'A conquistar'", () => {
    cleanup();
    const trilha = TRILHA.map((b) => ({ ...b, unlocked: false }));
    const n = criarNuvem({});
    render(<n.Provedor><FolhaSequencia aberta onFechar={() => {}} seq={seqDe({ dias: 0, hojeFeito: false })} trilha={trilha} origem="home" onAdesivo={() => {}} onIr={() => {}} /></n.Provedor>);
    expect(screen.getByTestId("he-seq-evolucao").getAttribute("data-destaque")).toBe("sequencia-1");
    expect(screen.getByTestId("he-seq-fogo").getAttribute("data-fogo")).toBe("neutro");
    expect(screen.getByTestId("he-seq-dias").textContent).toBe("0");
  });
});

describe("protetores e rodapé", () => {
  it("'2 protetores guardados' numa linha; o ⓘ abre a explicação; o rodapé 'O que conta'", () => {
    montar(seqDe({ dias: 9, hojeFeito: true, lista: [HOJE] }));
    expect(screen.getByTestId("he-seq-protetores").textContent).toBe("2 protetores guardados");
    expect(screen.queryByTestId("he-seq-protetores-explica")).toBeNull();
    fireEvent.click(screen.getByTestId("he-seq-protetores-info"));
    expect(screen.getByTestId("he-seq-protetores-explica").textContent).toContain("A cada 7 dias seguidos você ganha 1.");
    expect(screen.getByTestId("he-seq-o-que-conta").textContent).toContain("Só abrir o app não conta.");
  });
});

describe("o lembrete da sequência na folha (26/10)", () => {
  it("no site não existe; no app, 'Me lembrar da sequência' liga o lembrete de hoje (mesmo evento) e vira 'Lembrete ligado · 20h'", async () => {
    montar(seqDe({ dias: 9, hojeFeito: true, lista: [HOJE] }));
    expect(screen.queryByTestId("he-seq-lembrete")).toBeNull();
    cleanup();
    nativo.v = true;
    const { n } = montar(seqDe({ dias: 9, hojeFeito: true, lista: [HOJE] }));
    const linha = screen.getByTestId("he-seq-lembrete");
    expect(linha.getAttribute("data-ligado")).toBe("0");
    expect(linha.textContent).toContain("Me lembrar da sequência");
    fireEvent.click(linha);
    expect(eventos.some(([e]) => e === "sequencia_lembrete_ligar")).toBe(true);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 30));
    expect((n.ler<{ sequencia?: boolean }>("notif-prefs") ?? {}).sequencia).toBe(true);
    expect(screen.getByTestId("he-seq-lembrete").getAttribute("data-ligado")).toBe("1");
    expect(screen.getByTestId("he-seq-lembrete").textContent).toContain("Lembrete ligado · 20h");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-28T12:00:00"));
  });
  it("já ligado: 'Lembrete ligado · 20h' e o toque fecha a folha e leva a Lembretes (evento com a origem)", async () => {
    nativo.v = true;
    const { onFechar, onIr } = montar(seqDe({ dias: 9, hojeFeito: true, lista: [HOJE] }), { origem: "conquistas" }, { "notif-prefs": { sequencia: true, horaSequencia: 20 } });
    const linha = screen.getByTestId("he-seq-lembrete");
    expect(linha.getAttribute("data-ligado")).toBe("1");
    expect(linha.textContent).toContain("Lembrete ligado · 20h");
    fireEvent.click(linha);
    expect(onFechar).toHaveBeenCalled();
    expect(eventos.some(([e, d]) => e === "sequencia_folha_acao" && d.acao === "lembretes" && d.destino === "/notificacoes" && d.origem === "conquistas")).toBe(true);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 250));
    expect(onIr).toHaveBeenCalledWith("/notificacoes");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-28T12:00:00"));
  });
});
