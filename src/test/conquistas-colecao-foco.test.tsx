import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Badge } from "@/components/gamification/types";
import { ColecaoTela } from "@/components/conquistas/nova/camadas";
import type { ColecaoNova } from "@/components/conquistas/nova/use-conquistas-nova";

afterEach(cleanup);

const salario: Badge = { id: "first-income", name: "Primeiro Salário", description: "Registre sua primeira receita", category: "finance", icon: "", color: "", xp: 50, unlocked: true };
const colecao: ColecaoNova = { id: "finance", label: "Finanças", emoji: "💰", rota: "/financas", adesivos: [salario], abertos: 1, total: 1, frase: "coleção completa", proximo: null, pagina: 1 };
const estado = { colecoes: [colecao], abertos: 1, total: 1 };

describe("navegação da coleção de figurinhas", () => {
  it("mantém Tab no diálogo, fecha com Escape e devolve o foco a quem abriu", () => {
    const Tela = () => {
      const [aberta, setAberta] = useState(false);
      return <><button onClick={() => setAberta(true)}>Ver todas</button>{aberta && <ColecaoTela e={estado} inicial={null} onFechar={() => setAberta(false)} onAdesivo={() => {}} />}</>;
    };
    render(<Tela />);
    const abrir = screen.getByRole("button", { name: "Ver todas" });
    abrir.focus();
    fireEvent.click(abrir);
    const fechar = screen.getByRole("button", { name: "Fechar" });
    const figurinha = screen.getByRole("button", { name: "Primeiro Salário: conquistada" });
    expect(document.activeElement).toBe(fechar);
    fireEvent.keyDown(fechar, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(figurinha);
    fireEvent.keyDown(figurinha, { key: "Tab" });
    expect(document.activeElement).toBe(fechar);
    fireEvent.keyDown(fechar, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });

  it("anuncia o módulo selecionado e preserva a consulta de raridade", () => {
    const selecionar = vi.fn();
    render(<ColecaoTela e={estado} inicial={null} onFechar={() => {}} onAdesivo={selecionar} />);
    const filtros = screen.getByRole("group", { name: "Filtrar por módulo" });
    fireEvent.click(within(filtros).getByRole("button", { name: /Finanças/ }));
    expect(within(filtros).getByRole("button", { name: /Finanças/, pressed: true })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por raridade" }), { target: { value: "lendario" } });
    expect(screen.getByRole("status").textContent).toContain("Nenhuma figurinha");
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por raridade" }), { target: { value: "todas" } });
    fireEvent.click(screen.getByRole("button", { name: "Primeiro Salário: conquistada" }));
    expect(selecionar).toHaveBeenCalledWith(salario);
  });
  it("traz sugestões para dentro da coleção e respeita módulo e raridade", () => {
    const selecionar = vi.fn();
    const despesa: Badge = {...salario, id:"first-expense", name:"Primeira Despesa", unlocked:false, progresso:{atual:0,alvo:1}};
    const poupador: Badge = {...salario, id:"saver", name:"Poupador", unlocked:false, raridade:"raro", progresso:{atual:8,alvo:10}};
    const e = {...estado, total:3, colecoes:[{...colecao, total:3, adesivos:[salario,despesa,poupador]}]};
    render(<ColecaoTela e={e} inicial={null} onFechar={() => {}} onAdesivo={selecionar}/>);
    fireEvent.click(screen.getByRole("button", {name:"Perto de conquistar"}));
    const sugestoes = screen.getByRole("region", {name:"Perto de conquistar"});
    expect(within(sugestoes).queryByText("Primeiro Salário")).toBeNull();
    expect(within(sugestoes).getByText("Poupador")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", {name:"Filtrar por raridade"}), {target:{value:"comum"}});
    expect(within(sugestoes).queryByText("Poupador")).toBeNull();
    fireEvent.click(within(sugestoes).getByRole("button", {name:/Primeira Despesa/}));
    expect(selecionar).toHaveBeenCalledWith(despesa);
    expect(screen.queryByTestId("album-tela")).toBeNull();
    fireEvent.click(within(screen.getByRole("group", {name:"Mostrar figurinhas"})).getByRole("button", {name:"Todas"}));
    expect(screen.getByRole("button", {name:"Primeiro Salário: conquistada"})).toBeTruthy();
  });

  it("mostra os próximos marcos quando a pessoa escolhe o módulo Sequência", () => {
    const marco: Badge = {...salario,id:"sequencia-14",name:"14 Dias Seguidos",category:"sequencia",unlocked:false,progresso:{atual:12,alvo:14}};
    const e = {...estado,abertos:0,total:1,colecoes:[{...colecao,id:"sequencia" as const,label:"Sequência",abertos:0,adesivos:[marco]}]};
    render(<ColecaoTela e={e} inicial={null} onFechar={() => {}} onAdesivo={() => {}}/>);
    fireEvent.click(screen.getByRole("button", {name:"Perto de conquistar"}));
    fireEvent.click(within(screen.getByRole("group", {name:"Filtrar por módulo"})).getByRole("button", {name:/Sequência/}));
    expect(within(screen.getByRole("region", {name:"Perto de conquistar"})).getByText("14 Dias Seguidos")).toBeTruthy();
  });

});

describe("coleção 'Ver todas': MINIATURAS sempre montadas (varredura 26/10 — antes: arte sob demanda de 640 px)", () => {
  it("toda célula monta a arte de cara, pela MINIATURA (<img> na conquistada, máscara na trancada); rolar não solta nada; disco neutro só até decodificar", async () => {
    const { ARTES_CADERNO } = await import("@/components/conquistas/artes-caderno");
    const { ARTES_MINI, __zerarMinis } = await import("@/components/conquistas/artes-caderno-mini");
    __zerarMinis();
    const ids = Object.keys(ARTES_CADERNO).slice(0, 60);
    const adesivos: Badge[] = ids.map((id, i) => ({ id, name: `F${i}`, description: "", category: "finance", icon: "", color: "", xp: 50, unlocked: i % 4 === 0 }));
    const muitas: ColecaoNova = { ...colecao, adesivos, abertos: 15, total: 60 };
    const { container } = render(<ColecaoTela e={{ colecoes: [muitas], abertos: 15, total: 60 }} inicial={null} onFechar={() => {}} onAdesivo={() => {}} />);
    const celulas = Array.from(container.querySelectorAll(".cn-colecao-arte"));
    expect(celulas).toHaveLength(60);
    // a conquistada: <img> (não o <image> do SVG) com a miniatura; a trancada: a máscara da miniatura
    celulas.forEach((c, i) => {
      const id = ids[i];
      if (i % 4 === 0) {
        const img = c.querySelector("img[data-arte-caderno]") as HTMLImageElement;
        expect(img).toBeTruthy();
        expect(img.getAttribute("src")).toBe(ARTES_MINI[id]);
        expect(c.querySelector("svg image")).toBeNull();
      } else {
        const oculta = c.querySelector(".fig-oculta") as HTMLElement;
        expect(oculta).toBeTruthy();
        expect(oculta.style.getPropertyValue("--fig-mascara")).toContain(ARTES_MINI[id]);
      }
    });
    // rolou até o fim e voltou: nada é solto
    await act(async () => { container.querySelector(".cn-colecao")!.dispatchEvent(new Event("scroll")); await new Promise((r) => setTimeout(r, 30)); });
    expect(celulas.filter((c) => c.querySelector("img[data-arte-caderno], .fig-oculta"))).toHaveLength(60);
    // até a miniatura decodificar: o disco neutro (data-mini-espera); no jsdom a imagem nunca carrega → fica esperando
    expect(container.querySelectorAll(".ad-rar[data-mini-espera]").length).toBe(60);
  });

  it("miniatura pré-carregada (ao abrir Conquistas) = célula já pronta, sem o disco; decode que nunca volta não segura pra sempre", async () => {
    const { ARTES_CADERNO } = await import("@/components/conquistas/artes-caderno");
    const mini = await import("@/components/conquistas/artes-caderno-mini");
    const { AdesivoRaro } = await import("@/components/conquistas/adesivos-raridade");
    mini.__zerarMinis();
    const [a, b] = Object.keys(ARTES_CADERNO);
    const criadas: Array<{ onload: null | (() => void); decode: () => Promise<void> }> = [];
    const ImageOriginal = globalThis.Image;
    class ImagemFalsa { onload: null | (() => void) = null; onerror: null | (() => void) = null; decoding = ""; src = ""; decode = () => Promise.resolve(); constructor() { criadas.push(this); } }
    globalThis.Image = ImagemFalsa as unknown as typeof Image;
    vi.useFakeTimers();
    try {
      const pa = mini.precarregar(mini.ARTES_MINI[a]);
      criadas[0].onload!();
      await vi.runAllTimersAsync(); await pa;
      expect(mini.imagemPronta(mini.ARTES_MINI[a])).toBe(true);
      // decode que nunca volta (WebKit com dezenas juntas): pronta depois de 1,5 s do load
      const pb = mini.precarregar(mini.ARTES_MINI[b]);
      criadas[1].decode = () => new Promise<void>(() => {});
      criadas[1].onload!();
      await vi.advanceTimersByTimeAsync(1000);
      expect(mini.imagemPronta(mini.ARTES_MINI[b])).toBe(false);
      await vi.advanceTimersByTimeAsync(600); await pb;
      expect(mini.imagemPronta(mini.ARTES_MINI[b])).toBe(true);
    } finally { vi.useRealTimers(); globalThis.Image = ImageOriginal; }
    const { container } = render(<AdesivoRaro id={a} raridade="comum" tamanho={96} mini />);
    expect(container.querySelector(".ad-rar")!.hasAttribute("data-mini-espera")).toBe(false);
    expect(container.querySelector("img[data-arte-caderno]")).toBeTruthy();
  });
});
