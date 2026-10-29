/**
 * OS PLANOS DE 30 DIAS POR ÁREA (21/10) — o motor do kit estendido de forma aditiva (src/lib/plano-30-areas.ts):
 *   · 6 áreas (Dinheiro = o PLANO_30_DIAS de sempre; Rotina, Corpo, Saúde, Metas, Tudo), 30 tarefas cada, 4 semanas;
 *   · todo destino é uma tela que EXISTE: a rota do módulo + uma aba que o módulo de verdade lê da URL (conferido no
 *     código de cada módulo), e todo módulo de destino monta a intro do módulo (nenhum abre pela 1ª vez sem tutorial);
 *   · a compra grava a área; sem área = Dinheiro (kits antigos intocados: a aba de Finanças e os desafios seguem só
 *     pra Dinheiro); as outras áreas moram na /plano-30 com porta no menu da conta;
 *   · marcar o dia grava o progresso (sistema) e, ao reabrir, o dia continua feito (nada repete).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PLANO_30_DIAS, SEMANAS_DO_KIT, CHAVE_KIT } from "@/lib/kit-primeiro-mes";
import {
  ABAS_NA_URL, AREAS_DO_PLANO, PLANOS_30, areaDoKit, areaDoPlano, planoDaArea, tarefaDoDia, urlDoDestino, type AreaDoPlano, type DestinoDoPlano,
} from "@/lib/plano-30-areas";
import { liberarPlano30, areaPlano30, AREAS_PLANO30 } from "../../supabase/functions/_shared/presente";

const raiz = resolve(__dirname, "../..");
const ler = (f: string) => readFileSync(resolve(raiz, f), "utf8");
const ELE_ELA = /\b(ela|ele|dela|dele)\b/i;

/* o kit da conta (mock do hook, com um "banco" que sobrevive a desmontar/montar = reabrir) */
const conta: { kit: Record<string, unknown> | null; progresso: { inicio: string; feitos: Record<string, string>; desafios: string[] } | null } = { kit: null, progresso: null };
const salvarProgresso = vi.fn((p: typeof conta.progresso) => { conta.progresso = p; });
vi.mock("@/hooks/use-kit-primeiro-mes", () => ({
  useKitPrimeiroMes: () => ({ kit: conta.kit, progresso: conta.progresso, salvarProgresso, loaded: true }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));

import { PlanoDe30Dias } from "@/components/kit/PlanoDe30Dias";
import Plano30 from "@/pages/Plano30";

const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** As abas que cada módulo lê da URL, tiradas do CÓDIGO do módulo. */
const idsDoBloco = (fonte: string, inicio: string): string[] => {
  const i = fonte.indexOf(inicio);
  expect(i, inicio).toBeGreaterThanOrEqual(0);
  const bloco = fonte.slice(i, fonte.indexOf("];", i));
  return [...bloco.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
};
const PAGINA_DO_MODULO: Record<DestinoDoPlano["modulo"], string> = {
  "/financas": "src/pages/Index.tsx", "/rotina": "src/pages/Rotina.tsx", "/saude": "src/pages/Saude.tsx", "/treino": "src/pages/Treino.tsx",
  "/dieta": "src/pages/Dieta.tsx", "/casa": "src/pages/Casa.tsx", "/desenvolvimento": "src/pages/DesenvolvimentoPessoal.tsx",
};

beforeEach(() => { conta.kit = null; conta.progresso = null; salvarProgresso.mockClear(); cleanup(); });

describe("o conteúdo", () => {
  it("6 áreas × 30 tarefas (dias 1..30), 4 semanas cobrindo 1–7 · 8–14 · 15–21 · 22–30, 3 linhas no dia 30", () => {
    expect([...AREAS_DO_PLANO]).toEqual(["dinheiro", "rotina", "corpo", "saude", "metas", "tudo"]);
    expect([...AREAS_PLANO30]).toEqual([...AREAS_DO_PLANO]); // o servidor aceita as mesmas áreas
    for (const a of AREAS_DO_PLANO) {
      const p = PLANOS_30[a];
      expect(p.area).toBe(a);
      expect(p.tarefas.map((t) => t.dia)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      expect(p.semanas.map((s) => [...s.dias])).toEqual([[1, 7], [8, 14], [15, 21], [22, 30]]);
      expect(p.fim).toHaveLength(3);
      for (const t of p.tarefas) {
        expect(t.titulo.length, `${a} ${t.dia}`).toBeGreaterThan(5);
        expect(t.titulo.length, `${a} ${t.dia} título curto`).toBeLessThanOrEqual(46);
        expect(t.como.length, `${a} ${t.dia} como curto`).toBeLessThanOrEqual(90);
        expect(t.titulo.endsWith("."), `${a} ${t.dia} título sem ponto`).toBe(false);
        expect(`${t.titulo} ${t.como}`, `${a} ${t.dia}`).not.toMatch(ELE_ELA);
      }
    }
  });
  it("Dinheiro É o kit de sempre (as mesmas 30 tarefas, semanas e abas de Finanças)", () => {
    const d = PLANOS_30.dinheiro;
    expect(d.tarefas.map((t) => [t.titulo, t.como])).toEqual(PLANO_30_DIAS.map((t) => [t.titulo, t.como]));
    expect(d.semanas.map((s) => s.titulo)).toEqual(SEMANAS_DO_KIT.map((s) => s.titulo));
    d.tarefas.forEach((t, i) => expect(t.destino).toEqual({ modulo: "/financas", aba: PLANO_30_DIAS[i].destino.aba, rotulo: PLANO_30_DIAS[i].destino.rotulo }));
  });
  it("Tudo = 30 dias pra vida entrar nos eixos: semana 1 dinheiro, 2 rotina, 3 casa e corpo, 4 metas", () => {
    const p = PLANOS_30.tudo;
    expect(p.titulo).toBe("30 dias pra vida entrar nos eixos");
    expect(p.semanas.map((s) => s.titulo)).toEqual(["Dinheiro", "Rotina", "Casa e corpo", "Metas"]);
    expect(p.tarefas.slice(0, 7).every((t) => t.destino.modulo === "/financas")).toBe(true);
    expect(p.tarefas.slice(7, 14).every((t) => t.destino.modulo === "/rotina")).toBe(true);
    expect(new Set(p.tarefas.slice(14, 21).map((t) => t.destino.modulo))).toEqual(new Set(["/casa", "/saude", "/treino", "/dieta", "/rotina"]));
    expect(p.tarefas.slice(21).some((t) => t.destino.modulo === "/desenvolvimento")).toBe(true);
  });
});

describe("os destinos abrem telas que existem", () => {
  it("ABAS_NA_URL = as abas que cada módulo LÊ da URL (tiradas do código)", () => {
    expect([...ABAS_NA_URL["/rotina"]]).toEqual(idsDoBloco(ler("src/pages/Rotina.tsx"), "const ABAS_ROTINA = ["));
    expect([...ABAS_NA_URL["/saude"]]).toEqual(idsDoBloco(ler("src/pages/Saude.tsx"), "const tabs = ["));
    expect([...ABAS_NA_URL["/treino"]]).toEqual(idsDoBloco(ler("src/pages/Treino.tsx"), "const ABAS: { id: Aba;"));
    // 21/10 (integração com o upsell-2027): a aba SEU 2027 também é lida da URL, mas só existe pra quem comprou o pacote —
    // não é destino do plano de 30 dias, então fica fora do ABAS_NA_URL
    expect(ler("src/pages/DesenvolvimentoPessoal.tsx")).toContain(`get("tab");\n      return t && ${JSON.stringify([...ABAS_NA_URL["/desenvolvimento"]]).replace(/,/g, ", ").replace(/\]$/, ", ABA_2027.id]")}.includes(t)`);
    const index = ler("src/pages/Index.tsx");
    // 28/10 (sem repetição): + "viagem" no fim — link antigo, abre o atalho pra Viagens › Budget (não é aba nem destino)
    expect(index).toContain(`export const ABAS_DE_FINANCAS_NA_URL = ${JSON.stringify([...ABAS_NA_URL["/financas"], "viagem"]).replace(/,/g, ", ")} as const;`);
    expect(index).toContain('{activeTab === "viagem" && (');
    for (const a of ABAS_NA_URL["/financas"]) expect(index).toContain(`{ id: "${a}", label:`);
    // Rotina/Saúde/Treino leem `aba`; Desenvolvimento lê `tab`; Dieta e Casa não leem nada (abrem na aba de entrada)
    expect(ler("src/pages/Rotina.tsx")).toContain('new URLSearchParams(window.location.search).get("aba")');
    expect(ler("src/pages/Saude.tsx")).toContain('new URLSearchParams(window.location.search).get("aba")');
    expect(ler("src/pages/Treino.tsx")).toContain('new URLSearchParams(window.location.search).get("aba")');
    expect(ler("src/pages/Dieta.tsx")).not.toMatch(/get\("aba"\)|get\("tab"\)/);
    // 28/10 (sem repetição): a Casa passou a ler `?aba=` (o "Ver" da lista gerada na Dieta abre o Mercado); o plano de
    // 30 dias continua abrindo a Casa na aba de entrada (PARAM_DA_ABA "/casa" = null)
    expect(ler("src/pages/Casa.tsx")).toContain('new URLSearchParams(window.location.search).get("aba")');
  });
  it("toda tarefa de toda área: rota de módulo do App + aba válida pra ele; a URL sai certa", () => {
    const app = ler("src/App.tsx");
    // Dinheiro roda DENTRO da aba "KIT 30 DIAS" de Finanças (navegação de aba do próprio Index, inclusive a "kit" da
    // planilha de dívidas) — as abas dele têm que existir no Index; as outras áreas navegam por URL
    const index = ler("src/pages/Index.tsx");
    for (const t of PLANOS_30.dinheiro.tarefas) expect(index, t.destino.aba).toContain(`id: "${t.destino.aba}", label:`);
    for (const a of AREAS_DO_PLANO.filter((x) => x !== "dinheiro")) for (const t of PLANOS_30[a].tarefas) {
      const d = t.destino;
      expect(app, d.modulo).toContain(`<Route path="${d.modulo}" element={<ProtectedRoute>`);
      if (d.aba) expect(ABAS_NA_URL[d.modulo], `${a} dia ${t.dia}: ${d.modulo}?${d.aba}`).toContain(d.aba);
      else expect(ABAS_NA_URL[d.modulo], `${a} dia ${t.dia}`).toHaveLength(0);
      expect(d.rotulo.startsWith("Abrir") || d.rotulo.startsWith("Anotar"), d.rotulo).toBe(true);
    }
    expect(urlDoDestino({ modulo: "/rotina", aba: "semana", rotulo: "x" })).toBe("/rotina?aba=semana");
    expect(urlDoDestino({ modulo: "/desenvolvimento", aba: "metas", rotulo: "x" })).toBe("/desenvolvimento?tab=metas");
    expect(urlDoDestino({ modulo: "/dieta", rotulo: "x" })).toBe("/dieta");
    expect(urlDoDestino({ modulo: "/financas", aba: "limites", rotulo: "x" })).toBe("/financas?aba=limites");
  });
  it("nenhum módulo de destino abre pela 1ª vez sem tutorial: todos montam a intro (BoasVindasDoModulo) e têm INTROS", () => {
    const intros = ler("src/lib/intro-modulo.ts");
    const usados = new Set(AREAS_DO_PLANO.flatMap((a) => PLANOS_30[a].tarefas.map((t) => t.destino.modulo)));
    for (const m of usados) {
      expect(ler(PAGINA_DO_MODULO[m]), m).toMatch(/<BoasVindasDoModulo|<CartoesDoModulo|<IntroDoModulo/);
      const id = m === "/desenvolvimento" ? "desenvolvimento" : m.slice(1);
      expect(intros, id).toContain(`\n  ${id}: {`);
    }
    // o Treino com tutorial pendente volta pro HOJE mesmo com ?aba= (o alvo do tutorial)
    expect(ler("src/pages/Treino.tsx")).toContain('if (tutorialPendente()) setActiveTab("hoje");');
  });
});

describe("a compra grava a área; sem área = Dinheiro (os kits antigos não mudam)", () => {
  it("areaDoKit / areaDoPlano", () => {
    expect(areaDoKit({ comprado: true })).toBe("dinheiro");
    expect(areaDoKit({ comprado: true, area: "rotina" })).toBe("rotina");
    expect(areaDoKit({ comprado: true, area: "xpto" })).toBe("dinheiro");
    expect(areaDoKit(null)).toBe("dinheiro");
    expect(areaDoPlano(null)).toBe("tudo");
    expect(areaDoPlano("corpo")).toBe("corpo");
    expect(tarefaDoDia(planoDaArea("saude"), 99).dia).toBe(30);
  });
  it("servidor: liberarPlano30 grava a área válida (e ignora a inválida)", async () => {
    const linhas: Array<Record<string, unknown>> = [];
    const admin = { from: () => {
      const q: Record<string, unknown> = {
        select: () => q, eq: () => q, maybeSingle: async () => ({ data: null }),
        upsert: async (l: Record<string, unknown>) => { linhas.push(l); return { error: null }; },
      };
      return q;
    } };
    await liberarPlano30(admin, { userId: "u", orderId: "o", area: "metas" });
    await liberarPlano30(admin, { userId: "u2", orderId: "o2", area: "<x>" });
    expect((linhas[0].value as Record<string, unknown>).area).toBe("metas");
    expect(linhas[1].value).not.toHaveProperty("area");
    expect(areaPlano30("tudo")).toBe("tudo");
    expect(areaPlano30(3)).toBeNull();
    const pix = ler("supabase/functions/asaas-pix/index.ts");
    expect(pix).toContain("...(ehOfertaPlano30(offer) && areaPlano30(body.area) ? { area: areaPlano30(body.area) } : {}),");
    expect(ler("supabase/functions/asaas-webhook/index.ts")).toContain("area: regData.area });");
    expect(ler("supabase/functions/pix-reconcile/index.ts")).toContain("area: o.area });");
  });
  it("Finanças: a aba KIT 30 DIAS e os desafios das 4 semanas seguem só pra Dinheiro; o menu tem a porta das outras áreas", () => {
    expect(ler("src/pages/Index.tsx")).toContain('const temKit = !!kitPrimeiroMes && !isPreview && areaDoKit(kitPrimeiroMes) === "dinheiro";');
    expect(ler("src/hooks/use-kit-primeiro-mes.ts")).toContain('if (areaDoKit(bruto) !== "dinheiro") return;');
    const menu = ler("src/components/home/AccountDrawer.tsx");
    expect(menu).toContain('kitLiberado(kitDaConta) && areaDoKit(kitDaConta) !== "dinheiro"');
    expect(menu).toContain('label: "Plano de 30 dias", onClick: () => go("/plano-30")');
    expect(ler("src/App.tsx")).toContain('<Route path="/plano-30" element={<ProtectedRoute>');
    expect(CHAVE_KIT).toBe("core-kit-primeiro-mes");
  });
});

const comKit = (area: AreaDoPlano | null, feitos: Record<string, string> = {}) => {
  conta.kit = { comprado: true, em: new Date().toISOString(), pedido: "qr_pk", ...(area ? { area } : {}) };
  conta.progresso = { inicio: hojeISO(), feitos, desafios: [] };
};

describe("a tela do plano (cada área)", () => {
  for (const area of ["rotina", "corpo", "saude", "metas", "tudo"] as const) {
    it(`${area}: hoje = dia 1; o botão abre o destino do dia 1; marcar grava e, ao reabrir, continua feito`, () => {
      comKit(area);
      const irPara = vi.fn();
      const r = render(<PlanoDe30Dias irPara={irPara} />);
      const p = PLANOS_30[area];
      expect(screen.getByTestId("plano-30-dias").getAttribute("data-area")).toBe(area);
      expect(screen.getByTestId("plano-hoje").textContent).toContain(p.tarefas[0].titulo);
      fireEvent.click(screen.getByTestId("plano-hoje-abrir"));
      expect(irPara).toHaveBeenCalledWith(p.tarefas[0].destino);
      fireEvent.click(screen.getByTestId("plano-hoje-feito"));
      expect(salvarProgresso).toHaveBeenCalledTimes(1);
      expect(conta.progresso!.feitos["1"]).toBe(hojeISO());
      r.unmount();
      render(<PlanoDe30Dias irPara={irPara} />);
      expect(screen.getByTestId("plano-hoje-feito").getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByTestId("plano-hoje-feito").textContent).toContain("Feito");
      // os dias futuros não abrem nem marcam
      expect((screen.getByTestId("plano-dia-2").querySelector("button") as HTMLButtonElement).disabled).toBe(true);
      expect(salvarProgresso).toHaveBeenCalledTimes(1);
    });
  }
  it("cada tarefa do checklist (dias liberados) leva pro SEU destino", () => {
    comKit("tudo");
    conta.progresso!.inicio = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
    const irPara = vi.fn();
    render(<PlanoDe30Dias irPara={irPara} />);
    for (const t of PLANOS_30.tudo.tarefas) {
      fireEvent.click(screen.getByTestId(`plano-dia-${t.dia}`).querySelectorAll("button")[1]);
      expect(irPara).toHaveBeenLastCalledWith(t.destino);
    }
    expect(irPara).toHaveBeenCalledTimes(30);
  });
});

describe("a página /plano-30", () => {
  const montar = () => render(
    <MemoryRouter initialEntries={["/plano-30"]}>
      <Routes>
        <Route path="/plano-30" element={<Plano30 />} />
        <Route path="/" element={<div data-testid="home">home</div>} />
        <Route path="/financas" element={<div data-testid="financas">financas</div>} />
        <Route path="/rotina" element={<div data-testid="rotina">rotina</div>} />
      </Routes>
    </MemoryRouter>,
  );
  it("sem a compra → Home; Dinheiro → Finanças (a aba do kit de sempre); outra área → o plano, e a tarefa abre o módulo", () => {
    montar();
    expect(screen.getByTestId("home")).toBeTruthy();
    cleanup();
    comKit(null);
    montar();
    expect(screen.getByTestId("financas")).toBeTruthy();
    cleanup();
    comKit("rotina");
    montar();
    expect(screen.getByTestId("pagina-plano-30")).toBeTruthy();
    fireEvent.click(screen.getByTestId("plano-hoje-abrir"));
    expect(screen.getByTestId("rotina")).toBeTruthy();
  });
});
