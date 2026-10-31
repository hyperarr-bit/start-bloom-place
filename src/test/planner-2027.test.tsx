/**
 * PLANNER 2027 VERSÃO B (31/10 — novidades-guardadas/2026-10-31/upsell-planner/BRIEF.md).
 *   · chaves: tudo OFF; com a chave off o app, o planner (A, byte a byte) e a oferta (/organizar e Fluxo2027) ficam na versão A;
 *   · o planner: 14 folhas (v2 de 31/10, eram 12) nas 2 direções, com os dados dela (Seu 2027 + Rotina + Finanças do perfil ativo), escapados;
 *     conta VAZIA = linhas pra escrever (nada de "undefined", "NaN", "R$ 0");
 *   · o app com a chave: prévia + o que entrou + convite pra planejar quando é pouco; site = janela de impressão;
 *     iPhone = as 12 folhas em PNG pela folha nativa (Share.share com 12 arquivos), nunca <a download>;
 *   · a oferta com a chave: as 2 folhas reais (imagem na direção do app) + a frase nova.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig()), isNativeShell: () => nativo.v }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com" }, isSubscribed: true, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig()), trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const foto = vi.hoisted(() => ({ gerarPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));
vi.mock("@/components/conquistas/gerar-imagem", () => ({ gerarPng: foto.gerarPng }));
const cap = vi.hoisted(() => ({ escrever: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///cache/${path}` })), share: vi.fn(async () => ({})) }));
vi.mock("@capacitor/filesystem", () => ({ Filesystem: { writeFile: cap.escrever }, Directory: { Cache: "CACHE" } }));
vi.mock("@capacitor/share", () => ({ Share: { share: cap.share } }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { Pacote2027 } from "@/components/pacote-2027/Pacote2027";
import { CHAVE_PACOTE_2027, CHAVE_PLANO_2027, CHAVE_DICA_2027, novoPlano2027, type Plano2027 } from "@/lib/pacote-2027";
import { htmlDoPlanner2027 } from "@/lib/pacote-2027-pdf";
import {
  CONTRASTE_DA_LINHA, EXEMPLO_DO_PLANNER, PLANNER_2027, PLANNER_ESTILO, TOTAL_DE_FOLHAS, estiloDoPlanner, folhasDoPlanner, htmlDoPlannerNovo, lerExtrasDoPlanner,
  linhasDosTons, contraste, plannerNovoLigado, ROTULOS_DAS_FOLHAS, resumoDoPlanner, cssDoPlanner, type DadosDoPlanner,
} from "@/lib/planner-2027";
import { NOTA_U2027_PLANNER, PLANNER_B_NO_APP_IPHONE, U27_PLANNER, ehLinkDoPlannerB, imagemDoPlanner, portaDoLink, srcsetDoPlanner, u27PlannerLigado } from "@/lib/planner-2027-chave";
import { destinoSeguro } from "@/lib/destino-seguro";
import { compartilharImagens } from "@/lib/compartilhar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { modoDeEntrega } from "@/lib/planner-2027-baixar";
import { DESC_U2027, criarUpsell2027 } from "@/landing/upsell-2027";
import { Fluxo2027 } from "@/upsell-2027/Fluxo2027";

const raiz = resolve(__dirname, "../..");
const VAZIO: DadosDoPlanner = { plano: novoPlano2027(), cofrinho: { marcadas: [], invertido: false }, habitos: [], contas: [] };

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/"); nativo.v = false; });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

/* ───────────────────────── as chaves ───────────────────────── */

describe("as chaves (tudo desligado)", () => {
  it("PLANNER_2027 e U27_PLANNER saem 'off'; a direção é o teste A/B ('ab', 31/10 — planner-2027-ab.test.tsx)", () => {
    expect(PLANNER_2027).toBe("off");
    expect(U27_PLANNER).toBe("off");
    expect(PLANNER_ESTILO).toBe("ab");
    expect(plannerNovoLigado("")).toBe(false);
    expect(u27PlannerLigado("")).toBe(false);
    expect(estiloDoPlanner("")).toBe("codex"); // "ab" sem e-mail nem reserva (só QA): o padrão do sorteio
  });
  it("QA: ?planner27=on fica guardado no aparelho; ?planner27=auto volta pra chave; o mesmo pro estilo e pra oferta", () => {
    expect(plannerNovoLigado("?planner27=on")).toBe(true);
    expect(plannerNovoLigado("")).toBe(true);
    expect(plannerNovoLigado("?planner27=auto")).toBe(false);
    expect(plannerNovoLigado("")).toBe(false);
    expect(estiloDoPlanner("?planner-estilo=codex")).toBe("codex");
    expect(estiloDoPlanner("")).toBe("codex");
    expect(estiloDoPlanner("?planner-estilo=lixo")).toBe("codex");
    expect(estiloDoPlanner("?planner-estilo=auto", { email: "b@x.com" })).toBe("core"); // volta pro sorteio (b@x.com = core)
    // crítica r2: a oferta B só liga com a entrega B junto (u27planner sozinho não faz nada)
    expect(u27PlannerLigado("?u27planner=on&planner27=off")).toBe(false);
    expect(u27PlannerLigado("?u27planner=on&planner27=on")).toBe(true);
    expect(u27PlannerLigado("?u27planner=off")).toBe(false);
    expect(imagemDoPlanner("codex")).toBe("/landing/planner-2027-codex.webp");
  });
  it("o planner da versão A não mudou (byte a byte)", () => {
    const p = { ...novoPlano2027(), metas: ["Juntar <R$ 5 mil>", "Viajar", ""], gastarMes: 3200, guardarMes: 300, datas: [{ id: "a", tipo: "aniversario" as const, titulo: "Mãe", dia: "2027-03-14" }] };
    const h = htmlDoPlanner2027(p, { marcadas: [1, 2], invertido: false }, new Date(2026, 9, 21));
    expect(createHash("sha256").update(h).digest("hex")).toBe("3b6097b2f88f2b7b6cc1b1d1acc50f13a9a7248036cc93f594c6fccf1c4f32d6");
  });
  it("as miniaturas da oferta existem em 1x/2x/3x + a folha 'Meu ano' grande (scripts/planner-2027-miniaturas.ts) e são leves", () => {
    for (const e of ["core", "codex"]) {
      for (const [nome, teto] of [["", 80], ["@2x", 160], ["@3x", 240], ["-ano", 160]] as const) {
        const f = resolve(raiz, `public/landing/planner-2027-${e}${nome}.webp`);
        expect(existsSync(f)).toBe(true);
        expect(statSync(f).size).toBeLessThan(teto * 1024);
      }
    }
    expect(srcsetDoPlanner("core")).toBe("/landing/planner-2027-core.webp 1x, /landing/planner-2027-core@2x.webp 2x, /landing/planner-2027-core@3x.webp 3x");
  });
  it("crítica r1: a oferta não promete o planner B no app do iPhone enquanto a build não estiver na loja", () => {
    expect(PLANNER_B_NO_APP_IPHONE).toBe(false);
  });
  it("crítica r2: as chaves não se contradizem — U27_PLANNER 'on' exige PLANNER_2027 'on' (a oferta B nunca vende o que o app não entrega)", () => {
    if (U27_PLANNER === "on") expect(PLANNER_2027).toBe("on");
    localStorage.clear();
    expect(u27PlannerLigado("?u27planner=on")).toBe(false); // PLANNER_2027 off → a oferta fica na A
  });
  it("crítica r2: a nota da oferta diz o que ela recebe (sem 'sai pelo site')", () => {
    expect(NOTA_U2027_PLANNER).toBe("É separado do CORE que você já pagou. O planner sai em 14 folhas pra salvar no celular ou imprimir.");
  });
  it("crítica r2: os links do planner passam pela porta /entrar (código por e-mail) e voltam pro planner", () => {
    expect(portaDoLink("/desenvolvimento?tab=2027&planner=1")).toBe("/entrar?next=%2Fdesenvolvimento%3Ftab%3D2027%26planner%3D1");
    expect(portaDoLink("/desenvolvimento?tab=2027&planejar=1", "ana@x.com")).toBe("/entrar?e=ana%40x.com&next=%2Fdesenvolvimento%3Ftab%3D2027%26planejar%3D1");
    expect(destinoSeguro("/desenvolvimento?tab=2027&planner=1")).toBe("/desenvolvimento?tab=2027&planner=1");
    expect(ehLinkDoPlannerB("/desenvolvimento", "?tab=2027&planner=1")).toBe(true);
    expect(ehLinkDoPlannerB("/desenvolvimento", "?tab=2027&planejar=1")).toBe(true);
    expect(ehLinkDoPlannerB("/desenvolvimento", "?tab=2027")).toBe(false);
    expect(ehLinkDoPlannerB("/financas", "?tab=2027&planner=1")).toBe(false);
  });
});

/* ───────────────────────── o planner ───────────────────────── */

const sujeira = /undefined|NaN|\bnull\b|R\$ 0(?![\d,.])|\[object/;

describe("o planner B: as folhas, 2 direções, os dados dela", () => {
  for (const estilo of ["core", "codex"] as const) {
    it(`${estilo}: as folhas com as metas, o dinheiro, as datas, os hábitos e as contas — escapados`, () => {
      const d: DadosDoPlanner = { ...EXEMPLO_DO_PLANNER, plano: { ...EXEMPLO_DO_PLANNER.plano, metas: ["Juntar <R$ 5 mil> & \"viajar\"", "Ler", ""] } };
      const f = folhasDoPlanner(d, estilo);
      expect(f).toHaveLength(TOTAL_DE_FOLHAS);
      const h = f.join("");
      expect(h).toContain("Juntar &lt;R$ 5 mil&gt; &amp; &quot;viajar&quot;");
      expect(h).not.toContain("<R$ 5 mil>");
      for (const s of ["R$ 3.200", "R$ 450", "R$ 5.400", "Aniversário da mãe", "Água ao acordar", "Aluguel", "R$ 1.450", "R$ 1.378", "Dev. Pessoal", "Detox"]) expect(h).toContain(s);
      expect(h).not.toMatch(sujeira);
      for (let i = 1; i <= TOTAL_DE_FOLHAS; i++) expect(h).toContain(`data-folha="${i}"`);
      expect(h).toContain(`${TOTAL_DE_FOLHAS} / ${TOTAL_DE_FOLHAS} · feito com CORE`);
    });
    it(`${estilo}: conta VAZIA = linhas pra escrever, sem 'R$ 0', 'undefined' nem painel sem nada`, () => {
      const h = folhasDoPlanner(VAZIO, estilo).join("");
      expect(h).not.toMatch(sujeira);
      expect((h.match(/class="pl-ln/g) ?? []).length).toBeGreaterThan(100);
      expect(h).toContain("pl-escrever"); // o "R$ ____" no lugar do valor
      // crítica r2 (visual MEDIA 2): sem metas, a capa mostra "ESTE ANO EU VOU" com 3 linhas pra escrever (antes 39% em branco)
      const capa = folhasDoPlanner(VAZIO, estilo)[0];
      expect(capa).toContain("ESTE ANO EU VOU");
      expect((capa.split('class="pl-capa-metas"')[1].split("</div></div>")[0].match(/class="pl-ln/g) ?? []).length).toBe(3);
      const umaMeta = folhasDoPlanner({ ...VAZIO, plano: { ...VAZIO.plano, metas: ["Guardar", "", ""] } }, estilo)[0];
      expect((umaMeta.split('class="pl-capa-metas"')[1].split("</div></div>")[0].match(/class="pl-ln/g) ?? []).length).toBe(2);
      expect(resumoDoPlanner(VAZIO).pouco).toBe(true);
    });
  }
  it("as 2 direções: mesmo layout, cara diferente (codex = serifada + flor; core = ícones dos módulos + magenta)", () => {
    const codex = folhasDoPlanner(EXEMPLO_DO_PLANNER, "codex").join("");
    const core = folhasDoPlanner(EXEMPLO_DO_PLANNER, "core").join("");
    expect(codex).toContain("pl-flor");
    expect(codex).not.toContain("pl-ico");
    expect(core).toContain("pl-capa-grade");
    expect((core.match(/class="pl-ico"/g) ?? []).length).toBeGreaterThan(30);
    expect(cssDoPlanner("codex")).toContain("Instrument Serif");
    expect(cssDoPlanner("core")).toContain("#d6338a");
    // o CSS escopado não vaza: toda regra começa pela raiz
    const escopado = cssDoPlanner("core", ".pl.pl-core");
    for (const regra of escopado.split("}").map((r) => r.trim()).filter(Boolean)) for (const sel of regra.split("{")[0].split(",")) expect(sel.trim().startsWith(".pl.pl-core")).toBe(true);
  });
  it("crítica r1: linha de escrever com contraste ≥ 1,8 com o papel em TODO tom (as 2 direções) e 2 px", () => {
    for (const e of ["core", "codex"] as const) for (const t of linhasDosTons(e)) expect(contraste(t.linha, t.papel)).toBeGreaterThanOrEqual(CONTRASTE_DA_LINHA);
    expect(cssDoPlanner("core")).toContain("border-bottom:2px solid var(--w");
    expect(cssDoPlanner("codex")).not.toMatch(/\.pl-sem i\{[^}]*opacity/);
  });
  it("crítica r1: trilhas de grid que encolhem (o texto longo corta com '…' em vez de estourar o painel e o calendário)", () => {
    const css = cssDoPlanner("core");
    for (const r of [".pl-metas{display:grid;grid-template-columns:minmax(0,1fr)", ".pl-datas{display:grid;grid-template-columns:minmax(0,1fr)", "grid-template-columns:repeat(3,minmax(0,1fr))", ".pl-mes{min-width:0", ".pl-extra{margin-left:auto"]) expect(css).toContain(r);
    // a régua de verdade (Chromium + WebKit, 80 letras em toda meta e data): scripts/planner-2027-medir.ts
  });
  it("crítica r1: 7+ datas → '+N no calendário' é a 6ª linha da lista (não o cabeçalho); contas fixas: 7 + '+N no seu Finanças'", () => {
    const datas = Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, tipo: "checkup" as const, titulo: "Dentista", dia: `2027-0${i + 1}-10` }));
    const contas = Array.from({ length: 12 }, (_, i) => ({ nome: `Conta ${i}`, valor: 10, dia: i + 1 }));
    const f = folhasDoPlanner({ ...EXEMPLO_DO_PLANNER, plano: { ...EXEMPLO_DO_PLANNER.plano, datas }, contas }, "core");
    expect(f[1]).toContain('<li class="mais">+4 no calendário</li>');
    expect(f[1]).not.toContain('class="pl-extra">+');
    // v2: o "Meu mês" (folha 6) mostra até 6 vencimentos; com mais, 5 + "+N no seu Finanças" (nada some sem aviso) e o total de TODAS
    expect(f[5]).toContain('<div class="pl-venc-mais">+7 no seu Finanças</div>');
    expect((f[5].match(/class="pl-vn"/g) ?? []).length).toBe(5);
    expect(f[5]).toContain("Total das contas</span><b>R$ 120</b>");
  });
  it("v2 (31/10, 'piorou o do Codex'): Finanças = 'Meu mês' do Codex (cartões + Receitas, Gastos, Orçamento, Vencimentos) com os dados dela", () => {
    expect(TOTAL_DE_FOLHAS).toBe(14);
    expect(ROTULOS_DAS_FOLHAS).toHaveLength(TOTAL_DE_FOLHAS);
    for (const e of ["codex", "core"] as const) {
      const mes = folhasDoPlanner(EXEMPLO_DO_PLANNER, e)[5];
      for (const s of ["Meu", "mês", "Receitas", "Despesas", "Saldo do mês", "Gastos", "Orçamento", "Vencimentos", "posso gastar R$ 3.200", "quero guardar R$ 450", "Limite do mês</span><b>R$ 3.200</b>", "Aluguel", "Dia 5", "R$ 1.450", "Total das contas</span><b>R$ 1.798,70</b>"]) expect(mes).toContain(s);
      expect(mes).not.toContain("Fevereiro"); // nada de tabela de 12 meses repetindo o mesmo valor
      const vazio = folhasDoPlanner(VAZIO, e)[5];
      expect(vazio).not.toMatch(sujeira);
      expect((vazio.match(/Dia __/g) ?? []).length).toBe(6); // 6 vencimentos pra escrever
    }
  });
  it("v2: Rotina = 'Minha semana' do Codex (hábitos com 7 bolinhas S–D, agenda, O que importa, Uma nota pra mim)", () => {
    for (const e of ["codex", "core"] as const) {
      const sem = folhasDoPlanner(EXEMPLO_DO_PLANNER, e)[6];
      for (const s of ["semana", "Pequenos hábitos", "Minha agenda", "O que importa", "Uma nota pra mim", "Água ao acordar", "Dormir mais cedo", "SEG", "DOM"]) expect(sem).toContain(s);
      expect((sem.split('class="pl-hab"')[1].split("</div>")[0].match(/<i><\/i>/g) ?? []).length).toBe(5 * 7);
      const longa = folhasDoPlanner({ ...EXEMPLO_DO_PLANNER, habitos: Array.from({ length: 9 }, (_, i) => `Hábito ${i}`) }, e)[6];
      expect(longa).toContain("+4 na sua Rotina");
      expect((folhasDoPlanner(VAZIO, e)[6].split('class="pl-hab"')[1].match(/class="pl-hab-nome"><span class="pl-ln"/g) ?? []).length).toBe(5);
    }
  });
  it("v2: a escala do original do Codex — corpo 26 px, título de painel 32, valor em destaque 44 (1240 de largura)", () => {
    const css = cssDoPlanner("codex");
    expect(css).toContain("font-size:26px;line-height:1.3");
    expect(css).toMatch(/\.pl-ptopo h3,\.pl \.pl-bcab h3\{[^}]*font-size:32px/);
    expect(css).toMatch(/\.pl-cards b\{[^}]*font-size:44px/);
    // nenhuma letra abaixo de 18 px no CSS das folhas (a régua de verdade no navegador: scripts/planner-2027-medir.ts)
    for (const m of css.matchAll(/font-size:(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(18);
  });
  it("crítica r1: a B tem a capa com os 4 módulos que entram e os 3 cards do dinheiro no tom do Finanças", () => {
    const f = folhasDoPlanner(EXEMPLO_DO_PLANNER, "core");
    expect((f[0].match(/class="pl-ico"/g) ?? []).length).toBe(4);
    for (const i of [1, 5]) { // os cartões do "Meu ano" e do "Meu mês"
      const cards = f[i].split('class="pl-cards"')[1].split("</div></div>")[0];
      expect((cards.match(/--p:#fffbeb/g) ?? []).length).toBe(3);
    }
  });
  it("a impressão do site: A4 sem margem, 1 folha por página, fontes carregadas (Inter + Instrument Serif)", () => {
    const h = htmlDoPlannerNovo(EXEMPLO_DO_PLANNER, "codex", "https://www.coreaplicativo.com.br");
    expect(h).toContain("@page{size:A4;margin:0}");
    expect(h).toContain("break-after:page");
    expect(h).toContain("https://www.coreaplicativo.com.br/fonts/instrument-serif-italic-latin.woff2");
    expect(h).toContain("https://www.coreaplicativo.com.br/fonts/inter-latin.woff2");
    expect(h).not.toContain("googleapis");
    expect((h.match(/class="pg pl-folha/g) ?? []).length).toBe(TOTAL_DE_FOLHAS);
    // crítica r1: no celular a janela tinha 591 px e nenhuma saída — barra Voltar/Imprimir (só na tela) e zoom que cabe
    expect(h).toContain('data-testid="planner-barra-impressao"');
    expect(h).toContain("← Voltar");
    expect(h.split("@media print")[1]).toContain(".pl-barra-imp{display:none}");
    expect(h).toContain("--z");
  });
  it("lê a Rotina e o Finanças: hábitos (formato antigo também), contas fixas SÓ do perfil ativo, por dia; lixo vira lista vazia", () => {
    const store: Record<string, unknown> = {
      "rotina-habits": ["Beber água", { name: "Treinar" }, "", 3],
      "finance-perfil-ativo": "pessoal",
      "finance-fixed-expenses": [
        { description: "Internet", value: 99.9, day: 15 }, { description: "Aluguel", value: 1450, day: 5 },
        { description: "Da empresa", value: 500, day: 1, perfil: "empresa-1" }, { name: "Luz", amount: "120" }, null, "x",
      ],
    };
    const get = <T,>(k: string, f: T) => (k in store ? (store[k] as T) : f);
    const r = lerExtrasDoPlanner(get);
    expect(r.habitos).toEqual(["Beber água", "Treinar"]);
    expect(r.contas.map((c) => c.nome)).toEqual(["Aluguel", "Internet", "Luz"]);
    expect(r.contas[2]).toEqual({ nome: "Luz", valor: 120, dia: null });
    expect(lerExtrasDoPlanner(<T,>(k: string, f: T) => (k === "finance-fixed-expenses" ? [{ description: "x".repeat(55), value: 1 }] : f) as T).contas[0].nome).toHaveLength(55);
    expect(lerExtrasDoPlanner(<T,>() => ({ lixo: 1 }) as unknown as T)).toEqual({ habitos: [], contas: [] });
  });
});

/* ───────────────────────── o app ───────────────────────── */

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => setStore((p) => ({ ...p, [k]: v })), []);
  const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }) as unknown as UserDataContextType, [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const PLANO: Plano2027 = { ...EXEMPLO_DO_PLANNER.plano };
const CONTA_CHEIA = {
  [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-31T15:00:00-03:00", pedido: "qr_1" }, [CHAVE_DICA_2027]: "true", [CHAVE_PLANO_2027]: PLANO,
  "rotina-habits": ["Água ao acordar", "Ler 10 páginas"], "finance-fixed-expenses": [{ description: "Aluguel", value: 1450, day: 5 }],
};
const CONTA_VAZIA = { [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-31T15:00:00-03:00", pedido: "qr_1" }, [CHAVE_DICA_2027]: "true" };
const montar = (inicial: Record<string, unknown>) => render(
  <MemoryRouter initialEntries={["/desenvolvimento?tab=2027"]}>
    <Provedor inicial={inicial}><Routes><Route path="/desenvolvimento" element={<Pacote2027 />} /></Routes></Provedor>
  </MemoryRouter>,
);

describe("o app: chave off = versão A", () => {
  it("o botão é o de sempre e abre a impressão da versão A (sem prévia)", () => {
    const janela = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(janela as unknown as Window);
    montar(CONTA_CHEIA);
    const b = screen.getByTestId("pacote-2027-pdf");
    expect(b.textContent).toBe("🖨️ Planner pra imprimir");
    fireEvent.click(b);
    return waitFor(() => {
      expect(abrir).toHaveBeenCalled();
      expect(String(janela.document.write.mock.calls[0][0])).toContain("Planner <em>2027</em>");
      expect(screen.queryByTestId("planner-b")).toBeNull();
    }).finally(() => abrir.mockRestore());
  });
});

describe("o app: chave on (QA ?planner27=on)", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/?planner27=on"); });

  it("conta preenchida: prévia das 12 folhas + o que entrou do Seu 2027, da Rotina e do Finanças; sem convite", async () => {
    montar(CONTA_CHEIA);
    expect(screen.getByTestId("pacote-2027-pdf").textContent).toBe("🖨️ Seu planner 2027");
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    const b = await screen.findByTestId("planner-b", {}, { timeout: 8000 }); // 1ª carga do PlannerB (lazy): sob carga passa de 1 s
    expect(b.getAttribute("data-estilo")).toBe("codex"); // 31/10 teste A/B: ana@exemplo.com (a conta do mock) cai em "codex"
    expect(screen.getAllByRole("img", { name: /^Folha \d+/ })).toHaveLength(TOTAL_DE_FOLHAS);
    const itens = screen.getByTestId("planner-b-itens").textContent!;
    for (const s of ["3 metas de 2027", "Gastar e guardar por mês", "5 datas marcadas", "2 hábitos da sua Rotina", "1 conta fixa do Finanças"]) expect(itens).toContain(s);
    expect(screen.queryByTestId("planner-b-planejar")).toBeNull();
    expect(screen.getByTestId("planner-b-baixar").textContent).toContain("Imprimir ou salvar em PDF");
    expect(document.getElementById("pl-css-codex")).not.toBeNull();
  });

  it("conta VAZIA: as folhas saem com linhas pra escrever + convite curto pra planejar (abre o Planejar)", async () => {
    montar(CONTA_VAZIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    await screen.findByTestId("planner-b");
    expect(screen.getAllByRole("img", { name: /^Folha \d+/ })).toHaveLength(TOTAL_DE_FOLHAS);
    expect(screen.getByTestId("planner-b-itens").textContent).toContain("Metas: linhas pra escrever");
    expect(screen.getByTestId("planner-b").innerHTML).not.toMatch(sujeira);
    fireEvent.click(screen.getByTestId("planner-b-planejar"));
    expect(screen.queryByTestId("planner-b")).toBeNull();
  });

  it("site: a janela de impressão com as 12 folhas da direção escolhida", async () => {
    window.history.replaceState(null, "", "/?planner27=on&planner-estilo=codex");
    const janela = { document: { write: vi.fn(), close: vi.fn(), fonts: { ready: Promise.resolve() } }, focus: vi.fn(), print: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(janela as unknown as Window);
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    fireEvent.click(await screen.findByTestId("planner-b-baixar"));
    expect(abrir).toHaveBeenCalledTimes(1);
    const html = String(janela.document.write.mock.calls[0][0]);
    expect(html).toContain('class="pl pl-codex"');
    expect((html.match(/data-folha=/g) ?? []).length).toBe(TOTAL_DE_FOLHAS);
    await waitFor(() => expect(janela.print).toHaveBeenCalled(), { timeout: 3000 });
    abrir.mockRestore();
  });

  it("app do iPhone: as 12 folhas viram PNG e vão JUNTAS pela folha nativa (nunca <a download>)", async () => {
    nativo.v = true;
    const criar = vi.spyOn(document, "createElement");
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect((await screen.findByTestId("planner-b-baixar")).textContent).toContain("Salvar ou imprimir");
    fireEvent.click(screen.getByTestId("planner-b-baixar"));
    await waitFor(() => expect(cap.share).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(foto.gerarPng).toHaveBeenCalledTimes(TOTAL_DE_FOLHAS);
    const arg = (cap.share.mock.calls[0] as unknown as [{ files: string[] }])[0];
    expect(arg.files).toHaveLength(TOTAL_DE_FOLHAS);
    expect(arg.files[0]).toMatch(/\/planner-2027-01\.png$/); // crítica r1: o nome não diz a direção
    expect(criar.mock.calls.filter((c) => c[0] === "a")).toHaveLength(0);
    criar.mockRestore();
  });

  it("chave off: o módulo não baixa o planner B (import sob demanda) — com a chave on, só quando ela abre", async () => {
    const fonte = (await import("node:fs")).readFileSync(resolve(raiz, "src/components/pacote-2027/Pacote2027.tsx"), "utf8");
    expect(fonte).toMatch(/lazy\(\(\) => import\("\.\/PlannerB"\)\)/);
    expect(fonte).not.toMatch(/from "@\/lib\/planner-2027"/);
  });

  it("crítica r1: o link do 'Pronto' (?planejar=1) abre o Planejar direto; ?planner=1 abre o planner", async () => {
    window.history.replaceState(null, "", "/desenvolvimento?tab=2027&planejar=1&planner27=on");
    const r = montar(CONTA_VAZIA);
    await waitFor(() => expect(screen.queryByTestId("pacote-2027-boas-vindas")).toBeNull());
    expect(screen.queryByTestId("pacote-2027-pdf")).toBeNull(); // está no Planejar
    r.unmount();
    window.history.replaceState(null, "", "/desenvolvimento?tab=2027&planner=1&planner27=on");
    montar(CONTA_CHEIA);
    expect(await screen.findByTestId("planner-b")).toBeTruthy();
  });
});

describe("crítica r1: o site no CELULAR não depende do window.print", () => {
  const UA = navigator.userAgent;
  const usarUA = (u: string) => Object.defineProperty(navigator, "userAgent", { value: u, configurable: true });
  const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 360.0.0.0";
  beforeEach(() => { window.history.replaceState(null, "", "/?planner27=on"); });
  afterEach(() => {
    usarUA(UA);
    delete (navigator as unknown as Record<string, unknown>).canShare;
    delete (navigator as unknown as Record<string, unknown>).share;
  });

  it("o modo de cada lugar: PC imprime; iPhone com Web Share compartilha; Instagram sem Web Share manda pro Safari; app = nativo", () => {
    expect(modoDeEntrega()).toBe("imprimir");
    usarUA(IPHONE_INSTAGRAM);
    expect(modoDeEntrega()).toBe("safari");
    Object.assign(navigator, { canShare: () => true });
    expect(modoDeEntrega()).toBe("compartilhar");
    nativo.v = true;
    expect(modoDeEntrega()).toBe("nativo");
  });

  it("Safari do iPhone: 'Preparar as 12 folhas' → 2º toque 'Salvar as 12 folhas' → navigator.share com 12 PNG (sem janela, sem <a download>)", async () => {
    usarUA(IPHONE_SAFARI);
    const share = vi.fn(async () => {});
    Object.assign(navigator, { canShare: () => true, share });
    const abrir = vi.spyOn(window, "open");
    const criar = vi.spyOn(document, "createElement");
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    const b = await screen.findByTestId("planner-b-baixar");
    expect(b.textContent).toContain("Preparar as 14 folhas");
    fireEvent.click(b);
    const de = await screen.findByTestId("planner-b-compartilhar", undefined, { timeout: 4000 });
    expect(share).not.toHaveBeenCalled(); // o share só sai do 2º toque (gesto fresco)
    fireEvent.click(de);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = (share.mock.calls[0] as unknown as [{ files: File[] }])[0];
    expect(arg.files).toHaveLength(TOTAL_DE_FOLHAS);
    expect(arg.files[11].name).toBe("planner-2027-12.png");
    expect(abrir).not.toHaveBeenCalled();
    expect(criar.mock.calls.filter((c) => c[0] === "a")).toHaveLength(0);
    abrir.mockRestore(); criar.mockRestore();
  });

  it("navegador do Instagram sem Web Share: 'Abra no Safari' + copiar o link do planner (nunca a janela de impressão)", async () => {
    usarUA(IPHONE_INSTAGRAM);
    const escrever = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
    const abrir = vi.spyOn(window, "open");
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect((await screen.findByTestId("planner-b-safari")).textContent).toContain("abra no Safari");
    expect(screen.queryByTestId("planner-b-baixar")).toBeNull();
    fireEvent.click(screen.getByTestId("planner-b-copiar-link"));
    // crítica r2 (compradora ALTA 1): o link passa pela porta /entrar e volta pro planner
    await waitFor(() => expect(escrever).toHaveBeenCalledWith(`${location.origin}/entrar?next=%2Fdesenvolvimento%3Ftab%3D2027%26planner%3D1`));
    expect(abrir).not.toHaveBeenCalled();
    abrir.mockRestore();
  });

  const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
  /** o Web Share do Chromium: canShare diz sim pra tudo, share recusa mais de 10 arquivos */
  const shareDoChromium = () => vi.fn(async (d: { files?: File[] }) => {
    if ((d.files?.length ?? 0) > 10) { const e = new Error("Exceeds maximum number of files"); e.name = "NotAllowedError"; throw e; }
  });

  it("crítica r2 (técnico ALTA 1): Chrome do Android vai pra IMPRESSÃO (o share do Chromium para em 10 arquivos)", () => {
    usarUA(ANDROID_CHROME);
    Object.assign(navigator, { canShare: () => true, share: shareDoChromium() });
    expect(modoDeEntrega()).toBe("imprimir");
  });

  it("crítica r2: compartilharImagens com 12 arquivos fora do iPhone nem chama o share (devolve 'failed' pra cair na impressão)", async () => {
    usarUA(ANDROID_CHROME);
    const share = shareDoChromium();
    Object.assign(navigator, { canShare: () => true, share });
    const blobs = Array.from({ length: 12 }, () => new Blob(["png"], { type: "image/png" }));
    expect(await compartilharImagens(blobs, blobs.map((_, i) => `f${i}.png`), "t", "teste")).toBe("failed");
    expect(share).not.toHaveBeenCalled();
    // com 10 ou menos, o share de sempre
    expect(await compartilharImagens(blobs.slice(0, 10), blobs.slice(0, 10).map((_, i) => `f${i}.png`), "t", "teste")).toBe("shared");
  });

  it("crítica r2: no iPhone, se o share recusar (NotAllowedError), o planner troca pra impressão — nunca um toast sem saída", async () => {
    usarUA(IPHONE_SAFARI);
    const share = vi.fn(async () => { const e = new Error("gesto"); e.name = "NotAllowedError"; throw e; });
    Object.assign(navigator, { canShare: () => true, share });
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    fireEvent.click(await screen.findByTestId("planner-b-baixar"));
    fireEvent.click(await screen.findByTestId("planner-b-compartilhar", undefined, { timeout: 4000 }));
    await waitFor(() => expect(screen.getByTestId("planner-b").getAttribute("data-modo")).toBe("imprimir"));
    expect(screen.getByTestId("planner-b-baixar").textContent).toContain("Imprimir ou salvar em PDF");
  });

  it("crítica r2 (técnico MEDIA 4): as folhas começam a ser preparadas quando a tela abre — no Safari, sem tocar, chega no 'Salvar as 12 folhas'", async () => {
    usarUA(IPHONE_SAFARI);
    Object.assign(navigator, { canShare: () => true, share: vi.fn(async () => {}) });
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect(await screen.findByTestId("planner-b-compartilhar", undefined, { timeout: 4000 })).toBeTruthy();
    expect(foto.gerarPng).toHaveBeenCalledTimes(TOTAL_DE_FOLHAS);
  });

  it("crítica r2 (compradora ALTA 1): no Instagram as 12 folhas viram IMAGENS na prévia (toque e segure pra salvar) + o link", async () => {
    usarUA(IPHONE_INSTAGRAM);
    const criar = vi.fn((b: Blob) => `blob:teste/${b.size}-${Math.random()}`);
    const URLx = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
    const antes = { c: URLx.createObjectURL, r: URLx.revokeObjectURL };
    URLx.createObjectURL = criar; URLx.revokeObjectURL = vi.fn();
    try {
      montar(CONTA_VAZIA);
      fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
      expect((await screen.findByTestId("planner-b-segure", undefined, { timeout: 4000 })).textContent).toBe("Toque e segure uma folha pra salvar");
      const imgs = screen.getAllByTestId("planner-b-imagem");
      expect(imgs).toHaveLength(TOTAL_DE_FOLHAS);
      // (o -webkit-touch-callout:default vai no style; o jsdom não guarda essa propriedade — conferido no Playwright)
      expect(screen.getByTestId("planner-b-copiar-link")).toBeTruthy();
      // conta vazia: o convite vem DEPOIS do bloco de salvar (crítica r2, MEDIA 5: o botão fica na 1ª tela)
      const ordem = screen.getByTestId("planner-b-safari").compareDocumentPosition(screen.getByTestId("planner-b-planejar"));
      expect(ordem & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally { URLx.createObjectURL = antes.c; URLx.revokeObjectURL = antes.r; }
  });
});

/* ───────────────────────── a oferta ───────────────────────── */

function ofertaDaOrganizar(compra = "c1") {
  const caixa = document.createElement("div"), card = document.createElement("div");
  const u = criarUpsell2027(compra, {
    caixa, card, evento: () => {}, copiarNoToque: async () => ({ ok: true, via: "x" }), copiarTexto: async () => true, desenharQr: () => {}, email: () => null,
    linhaConfirmada: () => "O CORE é seu pra sempre.", aoTerminar: () => {}, aoMudar: () => {},
    api: { gerar: async () => ({ orderId: "o1", qrCode: "0002", qrCodeBase64: null, expiresAt: "2099-01-01T00:00:00Z", donoIgual: true }), conferir: async () => false, simulado: true },
  });
  u.render();
  return { caixa, u };
}

describe("a oferta do 2027", () => {
  afterEach(() => { document.getElementById("lp-u27-planner-css")?.remove(); });
  it("/organizar com a chave off: a oferta da versão A (sem imagem, sem frase nova, sem CSS novo)", () => {
    const { caixa, u } = ofertaDaOrganizar();
    // crítica r1 (técnico BAIXA 9): o HTML inteiro travado = o da versão A (406d92e1), não só a ausência da imagem
    expect(createHash("sha256").update(caixa.innerHTML).digest("hex")).toBe("2ebec32393055093c2fd526a289465f8f88c54896a8808e37c1bda6ddabdbe15");
    expect(caixa.querySelector("[data-testid=u2027-planner]")).toBeNull();
    expect(caixa.innerHTML).toContain(`<p class="u27-desc">${DESC_U2027}</p>`);
    expect(document.getElementById("lp-u27-planner-css")).toBeNull();
    u.parar();
  });
  it("/organizar com ?u27planner=on: as 2 folhas reais (na direção do app) acima da frase nova; o preço e o botão continuam", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner27=on&planner-estilo=codex");
    const { caixa, u } = ofertaDaOrganizar();
    const fig = caixa.querySelector("[data-testid=u2027-planner]")!;
    expect(fig.querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-codex.webp");
    expect(fig.textContent).toContain("Exemplo. O seu sai com o que você planejar.");
    expect(caixa.textContent).toContain("Um planner 2027 pra imprimir ou guardar no celular, com as suas metas");
    expect(fig.querySelector("img")!.getAttribute("srcset")).toContain("planner-2027-codex@3x.webp 3x");
    expect(caixa.textContent).toContain("O planner sai em 14 folhas pra salvar no celular ou imprimir.");
    expect(caixa.textContent).not.toContain("sai pelo site");
    // tocar na imagem abre a folha "Meu ano" grande; fecha no ×
    (caixa.querySelector("#u27-zoom-abrir") as HTMLButtonElement).click();
    const z = document.getElementById("u27-zoom")!;
    expect(z.querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-codex-ano.webp");
    (z.querySelector("button") as HTMLButtonElement).click();
    expect(document.getElementById("u27-zoom")).toBeNull();
    expect(caixa.textContent).not.toMatch(/PDF|já organizado|orçamento do ano/);
    expect(caixa.querySelector("#u27-quero")).not.toBeNull();
    expect(caixa.textContent).toContain("R$ 14,90");
    expect(document.getElementById("lp-u27-planner-css")).not.toBeNull();
    u.parar();
  });
  it("/organizar 'Pronto': off = o da versão A (Continuar); on = 'Seu planner 2027, com os seus dados' + 'Planejar meu 2027' direto", async () => {
    const pronto = async (url: string, compra: string) => {
      window.history.replaceState(null, "", url);
      const { caixa, u } = ofertaDaOrganizar(compra);
      (caixa.querySelector("#u27-quero") as HTMLButtonElement).click();
      await waitFor(() => expect(caixa.querySelector("#u27-ja-paguei")).not.toBeNull());
      (caixa.querySelector("#u27-ja-paguei") as HTMLButtonElement).click();
      await waitFor(() => expect(caixa.querySelector("[data-testid=u2027-pronto]")).not.toBeNull());
      u.parar();
      return caixa;
    };
    const off = await pronto("/organizar", "c-pronto-off");
    expect(off.querySelector("#u27-planejar")).toBeNull();
    expect(off.querySelector("#u27-continuar")!.textContent).toBe("Continuar");
    expect(off.textContent).toContain("Planner 2027 pra imprimir");
    localStorage.clear(); sessionStorage.clear();
    const on = await pronto("/organizar?u27planner=on&planner27=on", "c-pronto-on");
    expect(on.textContent).toContain("Seu planner 2027, com os seus dados");
    const a = on.querySelector<HTMLButtonElement>("#u27-planejar")!;
    expect(a.textContent).toBe("Planejar meu 2027 · 5 min");
    // crítica r2 (compradora ALTA 2): pela porta /entrar (sem sessão: código por e-mail, nunca o /auth de senha)
    expect(a.getAttribute("data-href")).toBe("/entrar?next=%2Fdesenvolvimento%3Ftab%3D2027%26planejar%3D1");
    expect(on.querySelector("#u27-continuar")).not.toBeNull();
  });
  it("Fluxo2027 (/hoje e /inicio): off = o caderno desenhado; on = as folhas do planner", () => {
    const r = render(<Fluxo2027 origem="hoje" compra="c-off" valorPago={27.9} versao="visual" onFim={vi.fn()} />);
    // crítica r1: o DOM inteiro da oferta off travado = o da versão A
    expect(createHash("sha256").update(screen.getByTestId("u2027-oferta").outerHTML).digest("hex")).toBe("8861683e5cf83b137b470d0edab6d94b246b4a10c816dc7bb9213eb097d176cd");
    expect(screen.getByTestId("u2027-ilustra")).toBeTruthy();
    expect(screen.queryByTestId("u2027-planner")).toBeNull();
    r.unmount();
    window.history.replaceState(null, "", "/hoje?u27planner=on&planner27=on");
    render(<Fluxo2027 origem="hoje" compra="c-on" valorPago={27.9} versao="visual" onFim={vi.fn()} />);
    expect(screen.getByTestId("u2027-planner").querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-core.webp");
    expect(screen.queryByTestId("u2027-ilustra")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toque pra ver uma folha" }));
    expect(screen.getByTestId("u2027-zoom").querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-core-ano.webp");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByTestId("u2027-zoom")).toBeNull();
  });
});

/* ───────────────────────── crítica r2: sem sessão, o link do planner não cai no /auth de senha ───────────────────────── */
describe("crítica r2 (compradora ALTAS 1–2 / técnico MEDIA 2): ProtectedRoute sem sessão", () => {
  it("o link do planner (e o do Planejar) vai pra porta /entrar com o destino; qualquer outra rota segue no /auth", async () => {
    const auth = await import("@/hooks/use-auth");
    const espia = vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, loading: false } as unknown as ReturnType<typeof auth.useAuth>);
    const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname + l.search}</p>; };
    const rodar = (url: string) => render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/desenvolvimento" element={<ProtectedRoute><p>dentro</p></ProtectedRoute>} />
          <Route path="/entrar" element={<Onde />} />
          <Route path="/auth" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    let r = rodar("/desenvolvimento?tab=2027&planner=1");
    expect(screen.getByTestId("onde").textContent).toBe("/entrar?next=%2Fdesenvolvimento%3Ftab%3D2027%26planner%3D1");
    r.unmount();
    r = rodar("/desenvolvimento?tab=2027&planejar=1");
    expect(screen.getByTestId("onde").textContent).toBe("/entrar?next=%2Fdesenvolvimento%3Ftab%3D2027%26planejar%3D1");
    r.unmount();
    rodar("/desenvolvimento?tab=2027");
    expect(screen.getByTestId("onde").textContent).toBe("/auth");
    espia.mockRestore();
  });
});
