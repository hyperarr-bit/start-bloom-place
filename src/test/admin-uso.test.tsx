import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  agregarCards, agregarUso, classificarAbas, diaBRT, diasDoPeriodo, janelaDeDias, medianaDeCima, variacao,
  type AbaUso, type LinhaVisita, type UsoPayload,
} from "@/pages/admin/uso-contas";

/**
 * ABA "USO" DO /admin (27/09). A conta em TS é a mesma da função admin_uso
 * (conferida no banco de teste do scratchpad/pgtest); aqui ficam as regras
 * que o dono lê na tela: dia de Brasília, teto de 30 min por visita, aba
 * vazia só no módulo, "voltou" = 2+ dias, período anterior do mesmo tamanho.
 */

const rpcMock = vi.fn();
const reserva = {
  buscarAssinantes: vi.fn(),
  buscarVisitas: vi.fn(),
  buscarCardsDoModulo: vi.fn(),
};

vi.mock("@/pages/admin/rpc", async (original) => ({
  ...(await original<typeof import("@/pages/admin/rpc")>()),
  rpcAdmin: (...a: unknown[]) => rpcMock(...a),
}));
vi.mock("@/pages/admin/uso-reserva", () => ({
  buscarAssinantes: (...a: unknown[]) => reserva.buscarAssinantes(...a),
  buscarVisitas: (...a: unknown[]) => reserva.buscarVisitas(...a),
  buscarCardsDoModulo: (...a: unknown[]) => reserva.buscarCardsDoModulo(...a),
}));

const v = (user_id: string, module_id: string, tab_id: string | null, duration_seconds: number, entered_at: string): LinhaVisita =>
  ({ user_id, module_id, tab_id, duration_seconds, entered_at });

describe("dia e janela no calendário de Brasília", () => {
  it("23h59 de Brasília ainda é o mesmo dia; 00h00 já é o seguinte", () => {
    expect(diaBRT("2026-09-27T02:59:59Z")).toBe("2026-09-26");
    expect(diaBRT("2026-09-27T03:00:00Z")).toBe("2026-09-27");
  });

  it("7 dias = hoje + 6 dias inteiros, começando à meia-noite de Brasília", () => {
    const agora = new Date("2026-09-27T13:00:00Z");
    const j = janelaDeDias(7, agora);
    expect(j.de).toBe("2026-09-21T03:00:00.000Z");
    expect(j.ate).toBe("2026-09-27T13:00:00.000Z");
    // anterior: mesmo tamanho, logo antes
    expect(Date.parse(j.de) - Date.parse(j.de_anterior)).toBe(Date.parse(j.ate) - Date.parse(j.de));
    expect(diasDoPeriodo(j.de, j.ate)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27",
    ]);
  });

  it("às 23h de Brasília (02h UTC do dia seguinte) o 'hoje' continua sendo o dia de Brasília", () => {
    const j = janelaDeDias(1, new Date("2026-09-27T02:00:00Z"));
    expect(j.de).toBe("2026-09-26T03:00:00.000Z");
  });
});

describe("agregarUso", () => {
  const de = "2026-09-21T03:00:00.000Z";
  const ate = "2026-09-28T03:00:00.000Z"; // 7 dias cheios; anterior = 14→21
  const assinantes = new Set(["ana"]);

  const linhas: LinhaVisita[] = [
    // Ana (assinante): Finanças › Meu financeiro em 2 dias → voltou
    v("ana", "financas", "financeiro", 10, "2026-09-22T12:00:00Z"),
    v("ana", "financas", "financeiro", 20, "2026-09-24T12:00:00Z"),
    // Bia (sem assinatura): Finanças sem aba (conta no módulo, não na aba) e visita de 3 h (teto 30 min)
    v("bia", "financas", "", 10_800, "2026-09-22T15:00:00Z"),
    v("bia", "rotina", "semana", 30, "2026-09-23T15:00:00Z"),
    // Caio só no período anterior
    v("caio", "financas", "financeiro", 60, "2026-09-16T12:00:00Z"),
    // fora de tudo (antes do anterior) e conta excluída
    v("dani", "financas", "financeiro", 60, "2026-09-01T12:00:00Z"),
    v("teste", "financas", "financeiro", 60, "2026-09-22T12:00:00Z"),
  ];
  const r = agregarUso(linhas, { de, ate, assinantes, excluir: new Set(["teste"]) });

  it("totais: ativos, assinantes, anterior e quem voltou", () => {
    const t = r.segmentos.todos.totais;
    expect(t.ativos).toBe(2);
    expect(t.com_assinatura).toBe(1);
    expect(t.ativos_ant).toBe(1);
    // Ana voltou a Finanças; Bia voltou ao APP (Finanças num dia, Rotina no outro)
    expect(t.voltaram).toBe(2);
    expect(t.visitas).toBe(4);
    expect(t.seg_total).toBe(10 + 20 + 1800 + 30);
  });

  it("módulo: aba vazia entra no módulo; mediana 'de cima'; teto de 30 min", () => {
    const fin = r.segmentos.todos.modulos.find((m) => m.modulo === "financas")!;
    expect(fin.pessoas).toBe(2);
    expect(fin.visitas).toBe(3);
    expect(fin.seg_total).toBe(1830);
    expect(fin.mediana_seg).toBe(20); // [10, 20, 1800] → 20
    expect(fin.voltaram).toBe(1);
    expect(fin.pessoas_ant).toBe(1);
    // ordem por pessoas
    expect(r.segmentos.todos.modulos.map((m) => m.modulo)).toEqual(["financas", "rotina"]);
  });

  it("aba: só as visitas com aba, por módulo", () => {
    const abas = r.segmentos.todos.abas.map((a) => `${a.modulo}:${a.aba}:${a.pessoas}`);
    expect(abas).toEqual(["financas:financeiro:1", "rotina:semana:1"]);
  });

  it("recortes com/sem assinatura separam as pessoas", () => {
    expect(r.segmentos.com.totais.ativos).toBe(1);
    expect(r.segmentos.sem.totais.ativos).toBe(1);
    expect(r.segmentos.com.modulos.map((m) => m.modulo)).toEqual(["financas"]);
    expect(r.segmentos.sem.modulos.map((m) => m.modulo).sort()).toEqual(["financas", "rotina"]);
  });

  it("série: pessoas por dia de Brasília, alinhada com os dias", () => {
    expect(r.dias).toHaveLength(7);
    const serie = r.segmentos.todos.serie.financas;
    expect(serie[r.dias.indexOf("2026-09-22")]).toBe(2);
    expect(serie[r.dias.indexOf("2026-09-24")]).toBe(1);
    expect(serie.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("mediana de lista par pega o valor de cima (igual ao uso.mjs)", () => {
    expect(medianaDeCima([10, 20])).toBe(20);
    expect(medianaDeCima([])).toBe(0);
  });
});

describe("variacao e classificarAbas", () => {
  it("variação contra o período anterior", () => {
    expect(variacao(10, 8)).toBeCloseTo(0.25);
    expect(variacao(5, 0)).toBeNull();
    expect(variacao(0, 0)).toBe(0);
  });

  const aba = (aba: string, pessoas: number, mediana_seg: number, voltaram: number): AbaUso => ({
    modulo: "m", aba, pessoas, mediana_seg, voltaram, com_assinatura: 0, visitas: pessoas, seg_total: 0,
    pessoas_ant: 0, visitas_ant: 0, seg_total_ant: 0,
  });

  it("corte proporcional: 1,2% dos ativos (mínimo 5)", () => {
    expect(classificarAbas([], 1243).corte).toBe(15);
    expect(classificarAbas([], 100).corte).toBe(5);
  });

  it("abre e sai, pouca gente e forte", () => {
    const { fracas, fortes } = classificarAbas([
      aba("rapida-sem-volta", 100, 8, 10),   // ≤12 s e só 10% voltam → abre e sai
      aba("rapida-com-volta", 100, 8, 60),   // check-in rápido em que a pessoa volta → não é fraca
      aba("vazia", 3, 200, 0),               // < corte → pouca gente
      aba("habito", 80, 90, 50),             // 62% voltam → forte
    ], 1000);
    expect(fracas.map((a) => `${a.aba}:${a.tipo}`)).toEqual(["rapida-sem-volta:abre_e_sai", "vazia:pouca_gente"]);
    expect(fortes.map((a) => a.aba)).toEqual(["rapida-com-volta", "habito"]);
  });
});

describe("agregarCards", () => {
  it("conta pessoas que viram e que usaram, por recorte, sem anônimos", () => {
    const porSeg = agregarCards([
      { user_id: "ana", event_name: "card_view", modulo: "financas", aba: "dashboard", card: "SALDO" },
      { user_id: "ana", event_name: "card_view", modulo: "financas", aba: "dashboard", card: "SALDO" },
      { user_id: "ana", event_name: "card_interact", modulo: "financas", aba: "dashboard", card: "SALDO" },
      { user_id: "bia", event_name: "card_view", modulo: "financas", aba: "dashboard", card: "SALDO" },
      { user_id: null, event_name: "card_view", modulo: "financas", aba: "dashboard", card: "SALDO" },
    ], new Set(["ana"]));
    expect(porSeg.todos).toEqual([{ modulo: "financas", aba: "dashboard", card: "SALDO", viram: 2, usaram: 1 }]);
    expect(porSeg.com[0]).toMatchObject({ viram: 1, usaram: 1 });
    expect(porSeg.sem[0]).toMatchObject({ viram: 1, usaram: 0 });
  });
});

describe("tela Uso", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    Object.values(reserva).forEach((f) => f.mockReset());
  });

  const payload = (): UsoPayload => {
    const j = janelaDeDias(7);
    const agora = Date.now();
    const lin = [
      v("ana", "financas", "financeiro", 120, new Date(agora - 3600e3).toISOString()),
      v("ana", "financas", "financeiro", 60, new Date(agora - 2 * 86400e3).toISOString()),
      v("bia", "rotina", "semana", 40, new Date(agora - 3600e3).toISOString()),
    ];
    return { ...agregarUso(lin, { de: j.de, ate: j.ate, assinantes: new Set(["ana"]) }), fonte: "sql" };
  };

  it("com a função no banco: mostra módulos com nome de gente e abre as abas", async () => {
    rpcMock.mockResolvedValue({ data: payload(), error: null });
    const { default: AdminUso } = await import("@/pages/admin/AdminUso");
    render(<AdminUso />);
    expect(await screen.findByText("Finanças")).toBeInTheDocument();
    expect(screen.getByText("Rotina")).toBeInTheDocument();
    expect(screen.getByText(/Fonte: banco/)).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("admin_uso", expect.objectContaining({ _from: expect.any(String), _to: expect.any(String) }));
    fireEvent.click(screen.getByText("Finanças"));
    expect(await screen.findByText("Meu financeiro")).toBeInTheDocument();
    expect(reserva.buscarVisitas).not.toHaveBeenCalled();
  });

  it("sem a função no banco: cai no modo reserva e agrega aqui", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { tipo: "sem_funcao", mensagem: "x", detalhe: "PGRST202" } });
    reserva.buscarAssinantes.mockResolvedValue(new Set(["ana"]));
    const p = payload();
    reserva.buscarVisitas.mockResolvedValue([
      v("ana", "financas", "financeiro", 120, new Date(Date.now() - 3600e3).toISOString()),
      v("bia", "rotina", "semana", 40, new Date(Date.now() - 3600e3).toISOString()),
    ]);
    const { default: AdminUso } = await import("@/pages/admin/AdminUso");
    render(<AdminUso />);
    expect(await screen.findByText("Finanças")).toBeInTheDocument();
    expect(screen.getByText(/Modo reserva/)).toBeInTheDocument();
    // período atual + o anterior do mesmo tamanho, numa leitura só
    const [deLido, ateLido] = reserva.buscarVisitas.mock.calls[0];
    expect(Date.parse(ateLido) - Date.parse(deLido)).toBeGreaterThan(Date.parse(p.periodo.ate) - Date.parse(p.periodo.de));
  });

  it("erro de verdade (tempo esgotado) aparece com 'Tentar de novo', sem cair na reserva", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { tipo: "tempo", mensagem: "A consulta demorou demais — tente um período menor.", detalhe: "57014" } });
    const { default: AdminUso } = await import("@/pages/admin/AdminUso");
    render(<AdminUso />);
    expect(await screen.findByText(/demorou demais/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeInTheDocument();
    expect(reserva.buscarVisitas).not.toHaveBeenCalled();
    rpcMock.mockResolvedValue({ data: payload(), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    await waitFor(() => expect(screen.getByText("Finanças")).toBeInTheDocument());
  });
});
