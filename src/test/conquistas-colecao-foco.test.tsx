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

describe("coleção 'Ver todas': arte sob demanda (23/10, ~160 MB de imagem com tudo montado)", () => {
  it("só as células perto da tela montam imagem/máscara; a que chega rolando monta; a que fica bem longe solta — a moldura fica sempre", async () => {
    const { ARTES_CADERNO } = await import("@/components/conquistas/artes-caderno");
    const ids = Object.keys(ARTES_CADERNO).slice(0, 60);
    const adesivos: Badge[] = ids.map((id, i) => ({ id, name: `F${i}`, description: "", category: "finance", icon: "", color: "", xp: 50, unlocked: i % 4 === 0 }));
    const muitas: ColecaoNova = { ...colecao, adesivos, abertos: 15, total: 60 };
    // 3 por linha, 150 px por linha a partir de 300 px, tela de 800 px (o rolador no topo)
    const observadores: Array<{ cb: IntersectionObserverCallback; margem: string; alvos: Set<Element> }> = [];
    class IO {
      alvos = new Set<Element>();
      constructor(cb: IntersectionObserverCallback, o?: IntersectionObserverInit) { observadores.push({ cb, margem: o?.rootMargin ?? "", alvos: this.alvos }); }
      observe(el: Element) { this.alvos.add(el); }
      unobserve(el: Element) { this.alvos.delete(el); }
      disconnect() { this.alvos.clear(); }
      takeRecords() { return []; }
    }
    // o setup.ts põe um stub gravável (não configurável): troca e devolve no fim
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
    window.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if ((this as HTMLElement).matches?.(".cn-colecao")) return { top: 0, bottom: 800, height: 800, left: 0, right: 390, width: 390, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      const i = Array.from(document.querySelectorAll(".cn-colecao-arte")).indexOf(this);
      const top = i < 0 ? 0 : 300 + Math.floor(i / 3) * 150;
      return { top, bottom: top + 96, height: 96, left: 0, right: 96, width: 96, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      const { container } = render(<ColecaoTela e={{ colecoes: [muitas], abertos: 15, total: 60 }} inicial={null} onFechar={() => {}} onAdesivo={() => {}} />);
      const celulas = Array.from(container.querySelectorAll(".cn-colecao-arte"));
      expect(celulas).toHaveLength(60);
      const comArte = (el: Element) => !!el.querySelector("svg image, .fig-oculta");
      // perto = a tela + 1 tela abaixo (até 1600 px): linhas 0..8 = 27 células; o resto só com a moldura
      expect(celulas.filter(comArte)).toHaveLength(27);
      expect(comArte(celulas[0]) && comArte(celulas[26])).toBe(true);
      expect(comArte(celulas[27]) || comArte(celulas[59])).toBe(false);
      celulas.forEach((c) => expect(c.querySelector(".ad-rar")).toBeTruthy()); // a moldura (mesmo tamanho) sempre lá
      // rolou: a célula 59 entra na margem de carregar → monta (depois de decodificar)
      const carrega = observadores.find((o) => o.margem === "100% 0px")!;
      const solta = observadores.find((o) => o.margem === "200% 0px")!;
      expect(carrega.alvos.size).toBe(60);
      await act(async () => { carrega.cb([{ target: celulas[59], isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver); await new Promise((r) => setTimeout(r, 0)); });
      expect(comArte(celulas[59])).toBe(true);
      // 1.0.19: decode() que nunca volta (WebKit) não deixa a célula vazia pra sempre — no máximo 250 ms
      const proto = HTMLImageElement.prototype as { decode?: () => Promise<void> };
      const decodeOriginal = proto.decode;
      proto.decode = () => new Promise<void>(() => {});
      await act(async () => { carrega.cb([{ target: celulas[56], isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver); await new Promise((r) => setTimeout(r, 10)); });
      expect(comArte(celulas[56])).toBe(false);
      await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
      expect(comArte(celulas[56])).toBe(true);
      if (decodeOriginal) proto.decode = decodeOriginal; else delete proto.decode;
      // rolagem com inércia sem aviso do IntersectionObserver: a conta a cada quadro de rolagem monta quem está na tela
      rect.mockImplementation(function (this: Element) {
        if ((this as HTMLElement).matches?.(".cn-colecao")) return { top: 0, bottom: 800, height: 800, left: 0, right: 390, width: 390, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        const i = Array.from(document.querySelectorAll(".cn-colecao-arte")).indexOf(this);
        const top = i < 0 ? 0 : 300 + Math.floor(i / 3) * 150 - 2400; // rolou 2400 px
        return { top, bottom: top + 96, height: 96, left: 0, right: 96, width: 96, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      });
      expect(comArte(celulas[45])).toBe(false);
      await act(async () => { container.querySelector(".cn-colecao")!.dispatchEvent(new Event("scroll")); await new Promise((r) => setTimeout(r, 50)); });
      expect(comArte(celulas[45])).toBe(true);
      // a 0 ficou bem longe → solta a arte, a moldura fica
      act(() => { solta.cb([{ target: celulas[0], isIntersecting: false } as unknown as IntersectionObserverEntry], {} as IntersectionObserver); });
      expect(comArte(celulas[0])).toBe(false);
      expect(celulas[0].querySelector(".ad-rar")).toBeTruthy();
    } finally {
      rect.mockRestore();
      globalThis.IntersectionObserver = original;
      window.IntersectionObserver = original;
    }
  });
});
