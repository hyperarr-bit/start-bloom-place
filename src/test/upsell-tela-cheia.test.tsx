/**
 * UPSELL 2027 EM TELA CHEIA + PLANNER QUE SE PREENCHE SOZINHO (31/10 — novidades-guardadas/2026-10-31/upsell-tela-cheia/BRIEF.md).
 *   · chaves: U27_PAGINA "on" só vale dentro da versão B (U27_PLANNER + PLANNER_2027, as duas off); os 2 apps das lojas = false;
 *   · "Meu mês" e "Minha semana": o mês/semana ATUAIS do Finanças e da Rotina (perfil ativo, mês visto, carimbo da semana);
 *     conta vazia = null = o modelo com linhas, IGUAL ao de antes;
 *   · a página: faixa "Pagamento confirmado", o 2027 do app (EXEMPLO), o planner que se preenche (EXEMPLO), barra com Quero e
 *     Agora não; a promessa é honesta (nada de "já preenchido"); "Agora não" fecha a página; o Pix espera a conta pronta;
 *   · o mesmo HTML não repinta (o "glitch");
 *   · o app: abrir → usar → sair → reabrir = o planner sai com o dado novo.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com" }, isSubscribed: true, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig()), trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/conquistas/gerar-imagem", () => ({ gerarPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { Pacote2027 } from "@/components/pacote-2027/Pacote2027";
import { CHAVE_PACOTE_2027, CHAVE_PLANO_2027, CHAVE_DICA_2027, novoPlano2027 } from "@/lib/pacote-2027";
import { EXEMPLO_DO_PLANNER, EXEMPLO_PREENCHIDO, folhasDoPlanner, lerMesDoPlanner, lerSemanaDoPlanner, resumoDoPlanner, type DadosDoPlanner } from "@/lib/planner-2027";
import { PLANNER_B_NO_APP_ANDROID, PLANNER_B_NO_APP_IPHONE, U27_PAGINA, imagemPreenchida, imagemPreenchidaGrande, plannerBNosApps, u27PaginaLigada } from "@/lib/planner-2027-chave";
import { criarUpsell2027, type CtxU2027 } from "@/landing/upsell-2027";
import { esquecerPerfis } from "@/lib/finance-perfil";

const raiz = resolve(__dirname, "../..");
const sujeira = /undefined|NaN|R\$ 0(?![\d,])|null|\[object/;
const VAZIO: DadosDoPlanner = { plano: novoPlano2027(), cofrinho: { marcadas: [], invertido: false }, habitos: [], contas: [] };
const AGORA = new Date(2026, 9, 31, 12, 0); // sábado, 31/10/2026 (semana 26/10–01/11)
const loja = (s: Record<string, unknown>) => <T,>(k: string, f: T) => (k in s ? (s[k] as T) : f);

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => { esquecerPerfis(); cleanup(); vi.clearAllMocks(); localStorage.clear(); document.getElementById("u27-pag")?.remove(); document.documentElement.style.removeProperty("overflow"); window.history.replaceState(null, "", "/"); });

describe("as chaves", () => {
  it("U27_PAGINA 'on' só dentro da versão B (as duas chaves off = nada muda); os 2 apps das lojas ainda sem o planner novo", () => {
    expect(U27_PAGINA).toBe("on");
    expect(u27PaginaLigada("")).toBe(false);
    expect(u27PaginaLigada("?u27planner=on&planner27=on&u27pagina=auto")).toBe(true);
    expect(u27PaginaLigada("?u27planner=on&planner27=on&u27pagina=off")).toBe(false);
    localStorage.clear(); // as forças de QA ficam guardadas no aparelho
    expect(u27PaginaLigada("?u27pagina=on")).toBe(false); // sem a B, nada
    expect([PLANNER_B_NO_APP_IPHONE, PLANNER_B_NO_APP_ANDROID, plannerBNosApps()]).toEqual([false, false, false]);
  });
  it("as imagens das folhas preenchidas existem nas 2 direções", () => {
    for (const e of ["core", "codex"] as const) for (const f of ["mes", "semana"] as const) {
      expect(existsSync(resolve(raiz, "public", imagemPreenchida(e, f).slice(1)))).toBe(true);
      expect(existsSync(resolve(raiz, "public", imagemPreenchida(e, f).slice(1).replace(".webp", "@2x.webp")))).toBe(true);
      expect(existsSync(resolve(raiz, "public", imagemPreenchidaGrande(e, f).slice(1)))).toBe(true);
    }
  });
});

const FINANCAS = {
  "finance-perfil-ativo": "pessoal",
  "finance-last-seen-month": "Outubro-2026",
  "finance-incomes": [{ id: "i1", date: "2026-10-05", value: 5000, description: "Salário" }],
  "finance-expenses": [
    { id: "e1", date: "2026-10-03", value: 200, category: "mercado", description: "Mercado" },
    { id: "e2", date: "2026-10-09", value: 50.5, category: "lazer", description: "Cinema <b>" },
    { id: "e3", date: "2026-10-10", value: 300, category: "mercado", description: "Da empresa", perfil: "pj-1" },
  ],
  "finance-fixed-expenses": [{ id: "f1", description: "Aluguel", value: 1500, category: "moradia", day: 5 }, { id: "f2", description: "Internet", value: 100, category: "internet_telefone", day: 15 }],
  "finance-dueDays": [{ day: 5, bills: [{ id: "b1", name: "Aluguel", value: 1500, paid: true, fixedId: "f1" }] }, { day: 15, bills: [{ id: "b2", name: "Internet", value: 100, paid: false, fixedId: "f2" }] }, { day: 20, bills: [{ id: "b3", name: "IPVA", value: 400, paid: false }] }],
  "finance-category-budgets": { mercado: 800, lazer: 100, moradia: 1600 },
};

describe("Meu mês: o mês ATUAL do Finanças", () => {
  it("receitas e gastos só do mês e do perfil ativo; despesas = variáveis + fixos + parcelas + avulsas (a regra do app)", () => {
    const m = lerMesDoPlanner(loja(FINANCAS), AGORA)!;
    expect(m.rotulo).toBe("Outubro de 2026");
    expect(m.receitas).toEqual([{ dia: 5, nome: "Salário", valor: 5000 }]);
    expect(m.gastos.map((g) => g.nome)).toEqual(["Mercado", "Cinema <b>"]);
    expect(m.totalGastos).toBe(250.5);
    expect(m.totalDespesas).toBe(250.5 + 1600 + 400); // a avulsa (IPVA) com valor entra; as dos fixos não contam 2×
    expect(m.vencimentos.map((v) => [v.nome, v.paga])).toEqual([["Aluguel", true], ["Internet", false], ["IPVA", false]]);
    expect(m.orcamento[0]).toEqual({ nome: "Moradia", gastei: 1500, limite: 1600 });
    expect(m.orcamento.find((o) => o.nome === "Mercado")).toEqual({ nome: "Mercado", gastei: 200, limite: 800 });
  });
  it("o Finanças ainda não virou o mês: contas saem dos fixos sem ✓ (o ✓ era do mês passado)", () => {
    const m = lerMesDoPlanner(loja({ ...FINANCAS, "finance-last-seen-month": "Setembro-2026" }), AGORA)!;
    expect(m.vencimentos.map((v) => [v.nome, v.paga])).toEqual([["Aluguel", false], ["Internet", false]]);
  });
  it("crítica r1 (técnico MEDIA 2): com o mês visto, o balde inteiro conta, como no app (receita de 30/09 no balde de outubro)", () => {
    const m = lerMesDoPlanner(loja({ "finance-last-seen-month": "Outubro-2026", "finance-incomes": [{ id: "i", date: "2026-09-30", value: 3000, description: "Salário" }] }), AGORA)!;
    expect(m).not.toBeNull();
    expect(m.totalReceitas).toBe(3000);
    // virada pendente (balde ainda de setembro): o que tem data de outubro, só
    expect(lerMesDoPlanner(loja({ "finance-last-seen-month": "Setembro-2026", "finance-incomes": [{ id: "i", date: "2026-09-30", value: 3000 }] }), AGORA)).toBeNull();
  });
  it("crítica r1 (técnico MEDIA 3 / honestidade MEDIA 3): a parcela soma no orçamento da categoria e ganha linha nos vencimentos", () => {
    const parcela = { id: "p1", description: "Celular", installmentValue: 100, totalInstallments: 10, paidInstallments: 0, category: "eletronicos", startMonth: "2026-10", parcelaDoMes: 1 };
    const m = lerMesDoPlanner(loja({ "finance-last-seen-month": "Outubro-2026", "finance-expenses": [{ id: "e", date: "2026-10-02", value: 10, category: "eletronicos", description: "Cabo" }], "finance-installments": [parcela], "finance-category-budgets": { eletronicos: 500 } }), AGORA)!;
    expect(m.orcamento).toEqual([{ nome: "Eletrônicos", gastei: 110, limite: 500 }]);
    expect(m.parcelas).toBe(100);
    expect(m.totalDespesas).toBe(110);
    const f = folhasDoPlanner({ ...VAZIO, mes: m }, "core")[5];
    expect(f).toContain("Parcelas do mês");
    expect(f).toContain("Contas + parcelas</span><b>R$ 100</b>"); // gastos 10 + contas/parcelas 100 = despesas 110
    expect(f).toContain("Soma dos limites</span><b>R$ 500</b>");
    expect(f).not.toContain("Limite do mês");
  });
  it("crítica r1 (honestidade MEDIA 3): a fatura do cartão aparece como no app, fora do total (os gastos dela já contam)", () => {
    const m = lerMesDoPlanner(loja({
      "finance-last-seen-month": "Outubro-2026",
      "finance-expenses": [{ id: "e", date: "2026-10-10", value: 100, category: "mercado", description: "Mercado", paymentMethod: "credito", cardName: "nubank" }],
      "finance-card-config": { nubank: { closingDay: 20, dueDay: 27 } },
      "finance-dueDays": [{ day: 5, bills: [{ id: "b1", name: "Aluguel", value: 1500, paid: true }] }],
    }), AGORA)!;
    expect(m.vencimentos).toEqual([{ nome: "Aluguel", dia: 5, valor: 1500, paga: true }, { nome: "Fatura Nubank", dia: 27, valor: 100, paga: false, fatura: true }]);
    const f = folhasDoPlanner({ ...VAZIO, mes: m }, "codex")[5];
    expect(f).toContain("Fatura Nubank");
    expect(f).toContain("já nos gastos");
    expect(f).toContain("Total das contas</span><b>R$ 1.500</b>");
  });
  it("'Tudo junto' lê todos os perfis; empresa apagada volta pro Pessoal (técnico BAIXA 8)", () => {
    const base = { "finance-last-seen-month": "Outubro-2026", "finance-expenses": [{ id: "a", date: "2026-10-02", value: 50, description: "PJ", perfil: "pj-1" }, { id: "b", date: "2026-10-02", value: 20, description: "Meu" }] };
    expect(lerMesDoPlanner(loja({ ...base, "finance-perfil-ativo": "__todos__" }), AGORA)!.totalGastos).toBe(70);
    expect(lerMesDoPlanner(loja({ ...base, "finance-perfis": [] }), AGORA)!.totalGastos).toBe(70); // pj-1 não existe mais
  });
  it("conta vazia (ou lixo) = null", () => {
    expect(lerMesDoPlanner(loja({}), AGORA)).toBeNull();
    expect(lerMesDoPlanner(<T,>() => "lixo" as unknown as T, AGORA)).toBeNull();
    expect(lerMesDoPlanner(<T,>() => 42 as unknown as T, AGORA)).toBeNull();
  });
});

describe("Minha semana: a semana ATUAL da Rotina", () => {
  const ROTINA = {
    "rotina-habits": ["Água", "Ler"],
    "rotina-habits-week": "2026-10-26",
    "rotina-habits-checked": { SEGUNDA: [true, false], TERÇA: [true, true] },
    "rotina-schedule": { "7:00": { Segunda: "Academia", Quarta: "Academia" }, "13:00": { Segunda: "" } },
    "rotina-compromissos": [{ id: "c1", titulo: "Dentista", data: "2026-10-29", hora: "18:00" }, { id: "c2", titulo: "Semana que vem", data: "2026-11-03", hora: "9:00" }],
    "rotina-urgencies": [{ id: "u1", text: "Pagar a fatura", done: false }, { id: "u2", text: "Feita", done: true }],
  };
  it("hábitos marcados da semana, agenda (grade + compromissos) e o que importa", () => {
    const s = lerSemanaDoPlanner(loja(ROTINA), AGORA)!;
    expect(s.rotulo).toBe("26 de out a 1 de nov");
    expect(s.dias).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(s.habitos[0].feitos.slice(0, 3)).toEqual([true, true, false]);
    expect(s.habitos[1].feitos.slice(0, 2)).toEqual([false, true]);
    expect(s.agenda).toEqual([
      { hora: "7:00", celulas: ["Academia", "", "Academia", "", "", "", ""] },
      { hora: "18:00", celulas: ["", "", "", "Dentista", "", "", ""] },
    ]);
    expect(s.importa).toEqual(["Pagar a fatura"]);
  });
  it("hábito sem nome no meio não desalinha os ✓ (técnico BAIXA 9)", () => {
    const s = lerSemanaDoPlanner(loja({ "rotina-habits": ["Água", "", "Ler"], "rotina-habits-week": "2026-10-26", "rotina-habits-checked": { SEGUNDA: [false, false, true] } }), AGORA)!;
    expect(s.habitos.map((h) => [h.nome, h.feitos[0]])).toEqual([["Água", false], ["Ler", true]]);
    expect(s.atualizado).toBe("31/10");
  });
  it("marcas de OUTRA semana não voltam; nada da Rotina = null", () => {
    const s = lerSemanaDoPlanner(loja({ ...ROTINA, "rotina-habits-week": "2026-10-19" }), AGORA)!;
    expect(s.habitos.every((h) => h.feitos.every((f) => !f))).toBe(true);
    expect(lerSemanaDoPlanner(loja({}), AGORA)).toBeNull();
  });
});

describe("as folhas", () => {
  it("sem dados = o modelo de antes, igual (null/ausente dão o mesmo HTML)", () => {
    for (const e of ["codex", "core"] as const) {
      expect(folhasDoPlanner({ ...VAZIO, mes: null, semana: null }, e)).toEqual(folhasDoPlanner(VAZIO, e));
      expect(folhasDoPlanner({ ...EXEMPLO_DO_PLANNER, mes: null, semana: null }, e)).toEqual(folhasDoPlanner(EXEMPLO_DO_PLANNER, e));
    }
  });
  it("com dados: Meu mês e Minha semana preenchidas, escapadas, sem sujeira; o resto do planner não muda", () => {
    const d: DadosDoPlanner = { ...VAZIO, mes: lerMesDoPlanner(loja(FINANCAS), AGORA), semana: EXEMPLO_PREENCHIDO.semana };
    for (const e of ["codex", "core"] as const) {
      const f = folhasDoPlanner(d, e);
      expect(f[5]).toContain("Outubro de 2026 · do seu Finanças");
      for (const s of ["Salário", "R$ 5.000", "R$ 2.250,50", "1 de 3 pagas", "Cinema &lt;b&gt;", "Total dos gastos</span><b>R$ 250,50</b>"]) expect(f[5]).toContain(s);
      expect(f[5]).not.toContain("<b>\"");
      expect(f[6]).toContain("4 de jan a 10 de jan · da sua Rotina");
      expect((f[6].match(/<i class="ok">/g) ?? []).length).toBe(EXEMPLO_PREENCHIDO.semana!.habitos.flatMap((h) => h.feitos).filter(Boolean).length);
      for (const x of f.slice(5, 7)) expect(x.replace(/data-[a-z]+="[^"]*"/g, "")).not.toMatch(sujeira);
      expect(f.filter((_, i) => i !== 5 && i !== 6)).toEqual(folhasDoPlanner(VAZIO, e).filter((_, i) => i !== 5 && i !== 6));
    }
    expect(resumoDoPlanner(d)).toMatchObject({ mes: true, semana: true });
  });
  it("lista maior que a folha: as que cabem + '+N no seu Finanças/na sua Rotina'", () => {
    const muitos = { ...EXEMPLO_PREENCHIDO.mes!, gastos: Array.from({ length: 10 }, (_, i) => ({ dia: i + 1, nome: `G${i}`, valor: 10 })) };
    const f = folhasDoPlanner({ ...VAZIO, mes: muitos, semana: { ...EXEMPLO_PREENCHIDO.semana!, importa: ["a", "b", "c", "d", "e"] } }, "core");
    expect(f[5]).toContain("+5 no seu Finanças");
    expect(f[5]).toContain("G9");
    expect(f[6]).toContain("+3 na sua Rotina");
  });
});

/* ───────────────────────── a página da oferta ───────────────────────── */

function oferta(compra: string, extra: Partial<CtxU2027> = {}) {
  const caixa = document.createElement("div"), card = document.createElement("div");
  const gerar = vi.fn(async () => ({ orderId: "o1", qrCode: "0002", qrCodeBase64: null, expiresAt: "2099-01-01T00:00:00Z", donoIgual: true }));
  const aoTerminar = vi.fn();
  const u = criarUpsell2027(compra, {
    caixa, card, evento: () => {}, copiarNoToque: async () => ({ ok: true, via: "x" }), copiarTexto: async () => true, desenharQr: () => {}, email: () => "ana@exemplo.com",
    linhaConfirmada: () => "O CORE é seu pra sempre.", aoTerminar, aoMudar: () => {}, faixaConfirmada: () => "o CORE é seu pra sempre",
    api: { gerar, conferir: async () => false, simulado: true }, ...extra,
  });
  u.render();
  return { caixa, u, gerar, aoTerminar };
}

describe("a oferta em PÁGINA PRÓPRIA (versão B)", () => {
  it("abre por cima da landing: faixa, o 2027 do app (EXEMPLO), o planner que se preenche (EXEMPLO), Quero + Agora não na barra", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on&planner-estilo=core");
    const { caixa, u } = oferta("c-pag");
    const pag = document.getElementById("u27-pag")!;
    expect(pag.getAttribute("data-estilo")).toBe("core");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(pag.querySelector("[data-testid=u2027-faixa]")!.textContent).toBe("Pagamento confirmado · o CORE é seu pra sempre");
    const t = pag.textContent!;
    for (const s of ["Espera, tem mais uma coisa", "Seu 2027 organizado", "Você planeja em 5 minutos", "3 metas", "Por mês", "R$ 3.200", "12 revisões", "Cofrinho", "52 semanas", "O planner se preenche sozinho", "Baixe quando quiser", "mês em que você baixar", "Toque numa folha", "R$ 14,90", "Quero · copiar o Pix", "Agora não · ver minha conta"]) expect(t).toContain(s);
    expect(pag.querySelectorAll(".u27p-ex").length).toBe(3); // o app e as 2 folhas: todos marcados EXEMPLO
    expect(pag.querySelector('[data-folha="mes"] img')!.getAttribute("src")).toBe("/landing/planner-2027-core-mes.webp");
    // honestidade: ela acabou de comprar, a conta está vazia — nada de "já vem preenchido"
    expect(t).not.toMatch(/já (vem|está|sai) preenchid|seu planner já/i);
    // crítica r1 (honestidade ALTA 1): ANTES de pagar ela sabe que o Android ainda não tem (as 2 chaves das lojas off)
    expect(pag.querySelector("[data-testid=u2027-onde-pagina]")!.textContent).toBe("Por enquanto, no site e no app do iPhone (o planner baixa pelo site). No Android, na próxima versão.");
    expect(caixa.querySelector("[data-testid=u2027-na-pagina]")).not.toBeNull();
    u.parar();
    expect(document.getElementById("u27-pag")).toBeNull();
  });
  it("'Agora não' fecha a página e devolve pra landing (conta pronta)", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on&planner-estilo=codex");
    const { u, aoTerminar } = oferta("c-nao");
    expect(document.getElementById("u27-pag")!.getAttribute("data-estilo")).toBe("codex");
    (document.getElementById("u27-nao") as HTMLButtonElement).click();
    expect(document.getElementById("u27-pag")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
    expect(aoTerminar).toHaveBeenCalled();
    u.parar();
  });
  it("Quero → QR na página → Já paguei → Pronto na página (a faixa continua)", async () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on");
    const { u } = oferta("c-qr");
    (document.getElementById("u27-quero") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector("#u27-pag [data-testid=u2027-qr]")).not.toBeNull());
    expect((document.querySelector("#u27-pag .u27p-barra") as HTMLElement).hidden).toBe(true);
    // crítica r1 (honestidade MEDIA 5): em cima do Pix a pagar, a faixa é neutra (sem "Pagamento confirmado") e não repete
    const faixa = document.querySelector<HTMLElement>("#u27-pag [data-testid=u2027-faixa]")!;
    expect(faixa.dataset.tipo).toBe("neutra");
    expect(faixa.textContent).toBe("Seu CORE está pago · este Pix é só do 2027");
    expect(document.querySelector("#u27-pag").textContent).not.toContain("Pagamento confirmado");
    expect(document.querySelectorAll("#u27-pag [data-testid=u2027-ja-pago]").length).toBe(1);
    (document.getElementById("u27-ja-paguei") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector("#u27-pag [data-testid=u2027-pronto]")).not.toBeNull());
    expect(faixa.hidden).toBe(true);
    expect(document.querySelector("#u27-pag")!.textContent).toContain("Planner que se preenche com o que você anota");
    expect(document.querySelector("#u27-pag [data-testid=u2027-onde]")!.textContent).toContain("No Android, na próxima versão.");
    u.parar();
  });
  it("o 'glitch': o Pix do 2027 espera a conta pronta (contaPronta); o mesmo render não repinta", async () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&u27pagina=on");
    let pronta!: () => void;
    const conta = new Promise<void>((ok) => { pronta = ok; });
    const { u, gerar } = oferta("c-glitch", { contaPronta: () => conta });
    await new Promise((r) => setTimeout(r, 10));
    expect(gerar).not.toHaveBeenCalled();
    const antes = document.querySelector("#u27-pag .u27p-miolo");
    u.render(); u.render();
    expect(document.querySelector("#u27-pag .u27p-miolo")).toBe(antes); // o mesmo nó: nada piscou
    pronta();
    await vi.waitFor(() => expect(gerar).toHaveBeenCalledTimes(1));
    u.parar();
  });
  it("crítica r1 (técnico MEDIA 1): o Voltar do celular fecha a página como o 'Agora não' — e não sai do site", async () => {
    window.history.replaceState({ outra: 1 }, "", "/organizar?u27planner=on&planner27=on&u27pagina=on");
    const eventos: [string, Record<string, unknown>][] = [];
    const { u, aoTerminar } = oferta("c-volta", { evento: (n, d = {}) => { eventos.push([n, d]); } });
    expect(window.history.state).toMatchObject({ outra: 1, u27Pagina: "c-volta" }); // 1 entrada nova, com a marca desta compra
    u.render(); u.render();
    expect(window.history.state.u27Pagina).toBe("c-volta");
    window.history.back();
    await vi.waitFor(() => expect(document.getElementById("u27-pag")).toBeNull());
    expect(aoTerminar).toHaveBeenCalled();
    expect(eventos.find(([n]) => n === "landing_u2027_nao")?.[1]).toMatchObject({ de: "voltar", etapa: "oferta" });
    expect(window.location.pathname).toBe("/organizar");
    u.parar();
  });
  it("recarga com a página aberta (a marca já está no histórico): não empilha de novo; 'Agora não' volta a entrada dela", async () => {
    window.history.replaceState({ u27Pagina: "c-rec" }, "", "/organizar?u27planner=on&planner27=on&u27pagina=on");
    const antes = window.history.length;
    const { u, aoTerminar } = oferta("c-rec");
    expect(window.history.length).toBe(antes);
    (document.getElementById("u27-nao") as HTMLButtonElement).click();
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(aoTerminar).toHaveBeenCalledTimes(1); // o popstate do nosso back() não fecha 2×
    u.parar();
  });
  it("versão A (chaves off): a oferta no cartão, sem página; o render repetido também não repinta", () => {
    const { caixa, u } = oferta("c-a");
    expect(document.getElementById("u27-pag")).toBeNull();
    const el = caixa.firstElementChild;
    u.render();
    expect(caixa.firstElementChild).toBe(el);
    u.parar();
  });
});

/* ───────────────────────── o app: abrir → usar → sair → reabrir ───────────────────────── */

const Provedor = ({ store, children }: { store: Record<string, unknown>; children?: React.ReactNode }) => {
  const [s] = useState(store);
  const get = useCallback(<T,>(k: string, fb: T): T => (k in s ? (s[k] as T) : fb), [s]);
  const set = useCallback((k: string, v: unknown) => { s[k] = v; }, [s]);
  const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }) as unknown as UserDataContextType, [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const montar = (store: Record<string, unknown>) => render(
  <MemoryRouter initialEntries={["/desenvolvimento?tab=2027"]}>
    <Provedor store={store}><Routes><Route path="/desenvolvimento" element={<Pacote2027 />} /></Routes></Provedor>
  </MemoryRouter>,
);

describe("o app (chave on): o planner sai sempre atualizado", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/?planner27=on&planner-estilo=core"); });
  it("conta VAZIA: Meu mês e Minha semana no modelo + 'se preenche quando você anotar'; depois de anotar e reabrir, sai preenchido", async () => {
    const store: Record<string, unknown> = { [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-31T15:00:00-03:00", pedido: "qr_1" }, [CHAVE_DICA_2027]: "true", [CHAVE_PLANO_2027]: novoPlano2027() };
    const r1 = montar(store);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    await screen.findByTestId("planner-b", {}, { timeout: 8000 });
    const itens = screen.getByTestId("planner-b-itens").textContent!;
    expect(itens).toContain("Meu mês: se preenche quando você anotar no Finanças");
    expect(itens).toContain("Minha semana: se preenche quando você usar a Rotina");
    expect(screen.getByRole("img", { name: "Folha 6: Meu mês" }).innerHTML).toContain("Mês: ");
    r1.unmount();
    // usou o app: um gasto de hoje e um hábito
    const hoje = new Date();
    const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    store["finance-expenses"] = [{ id: "e1", date: dia, value: 42.5, category: "mercado", description: "Padaria da esquina" }];
    store["rotina-habits"] = ["Beber água"];
    montar(store);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    await screen.findByTestId("planner-b", {}, { timeout: 8000 });
    const mes = screen.getByRole("img", { name: "Folha 6: Meu mês" }).innerHTML;
    expect(mes).toContain("Padaria da esquina");
    expect(mes).toContain("R$ 42,50");
    expect(screen.getByRole("img", { name: "Folha 7: Minha semana" }).innerHTML).toContain("Beber água");
    expect(screen.getByTestId("planner-b-itens").textContent).toMatch(/Meu mês: .+, do seu Finanças/);
  });
});
