/**
 * DEMO GUIADA (28/09) — a chave, o braço do A/B e o item que viaja.
 *
 *   · chave desligada = a URL da demo é a MESMA string de hoje;
 *   · o braço sai do sorteio NA ENTRADA e vai carimbado na URL (o storage do
 *     navegador do Instagram apaga; a URL não);
 *   · o item que vem de fora (URL) é validado: tipo de lista fechada, nome
 *     limpo, valor com teto — lixo vira null e nada segue;
 *   · o item sobrevive à troca de módulo: URL > memória > sessão.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_GUIADA, DEMO_GUIADA_FATIA, sortearBracoDaDemo, urlDaDemoComBraco } from "@/lib/demo-guiada-braco";
import { temItemDaDemo } from "@/lib/demo-guiada-volta";
import {
  bracoDaDemo, codificarItem, decodificarItem, normalizarItem, limparNome, comItem, comBraco,
  itemDaDemo, gravarEstadoDaMissao, estadoDaMissao, esquecerMissao, rotuloDoItem, tipoDoModulo,
  MODULO_DO_TIPO, TIPOS_DO_ITEM, NOME_MAX, type ItemDaDemo,
} from "@/lib/demo-guiada";

const DEMO = "/preview/financas?funnel=1&tour=vida&from=dia14";
const CAFE: ItemDaDemo = { tipo: "gasto", nome: "Café", valor: 12 };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  esquecerMissao();
  window.history.replaceState({}, "", "/");
});

describe("a chave (DEMO_GUIADA) e o sorteio na entrada da demo", () => {
  it("a chave é uma das três (28/09: \"on\" — ligada pra todo o funil do dia 14, decisão do dono)", () => {
    expect(["off", "ab", "on"]).toContain(DEMO_GUIADA);
  });

  it("desligada (o botão de voltar atrás): sem braço e a URL da demo é a MESMA string de hoje", () => {
    expect(sortearBracoDaDemo("off")).toBeNull();
    expect(urlDaDemoComBraco(DEMO, sortearBracoDaDemo("off"))).toBe(DEMO);
    expect(urlDaDemoComBraco(DEMO, null)).toBe(DEMO);
  });

  it("ligada: todo mundo que entra na demo do funil do dia 14 cai na missão", () => {
    expect(sortearBracoDaDemo("on", () => 0.99)).toBe("1");
  });

  it("A/B: sorteia pela fatia e carimba o braço na URL", () => {
    expect(sortearBracoDaDemo("ab", () => DEMO_GUIADA_FATIA - 0.01)).toBe("1");
    expect(sortearBracoDaDemo("ab", () => DEMO_GUIADA_FATIA + 0.01)).toBe("0");
    expect(urlDaDemoComBraco(DEMO, "1")).toBe(`${DEMO}&guia=1`);
    expect(urlDaDemoComBraco(DEMO, "0")).toBe(`${DEMO}&guia=0`);
    expect(urlDaDemoComBraco("/preview/rotina", "1")).toBe("/preview/rotina?guia=1");
  });

  it("'on' manda todo mundo pra missão", () => {
    expect(sortearBracoDaDemo("on", () => 0.99)).toBe("1");
  });

  it("força de QA no aparelho: on liga, off devolve a URL de hoje (mesmo com a chave em A/B)", () => {
    localStorage.setItem("demo-guiada-force", "on");
    expect(sortearBracoDaDemo("off")).toBe("1");
    localStorage.setItem("demo-guiada-force", "off");
    expect(sortearBracoDaDemo("ab", () => 0)).toBeNull();
    expect(urlDaDemoComBraco(DEMO)).toBe(DEMO);
  });
});

describe("o braço dentro da demo", () => {
  it("vem da URL: guia=1 → on, guia=0 → off, sem nada → fora do experimento", () => {
    expect(bracoDaDemo("?funnel=1&guia=1")).toBe("on");
    expect(bracoDaDemo("?funnel=1&guia=0")).toBe("off");
    expect(bracoDaDemo("?funnel=1&tour=vida")).toBeNull();
  });

  it("a força de QA vale mais que a URL", () => {
    localStorage.setItem("demo-guiada-force", "off");
    expect(bracoDaDemo("?guia=1")).toBe("off");
    localStorage.setItem("demo-guiada-force", "on");
    expect(bracoDaDemo("?guia=0")).toBe("on");
  });
});

describe("o item na URL (c=<tipo>|<nome>|<valor>)", () => {
  it("vai e volta igual", () => {
    for (const item of [CAFE, { tipo: "gasto", nome: "Uber pro trabalho", valor: 23.5 }, { tipo: "habito", nome: "Beber água" }, { tipo: "exercicio", nome: "Agachamento" }, { tipo: "agua", nome: "1 copo d'água", valor: 300 }, { tipo: "meta", nome: "Correr 5 km" }] as ItemDaDemo[]) {
      expect(decodificarItem(codificarItem(item))).toEqual(item);
    }
  });

  it("sobrevive à codificação da URL (acento, espaço, barra vertical escapada)", () => {
    const url = comItem("/inicio?step=signup&porta=vida", { tipo: "gasto", nome: "Pão de queijo", valor: 7.5 });
    expect(url).toContain("step=signup");
    expect(url).toContain("porta=vida");
    const c = new URLSearchParams(url.split("?")[1]).get("c");
    expect(decodificarItem(c)).toEqual({ tipo: "gasto", nome: "Pão de queijo", valor: 7.5 });
  });

  it("lixo de fora vira null: tipo desconhecido, nome vazio, valor inválido, partes demais, texto enorme", () => {
    expect(decodificarItem(null)).toBeNull();
    expect(decodificarItem("")).toBeNull();
    expect(decodificarItem("senha|x|1")).toBeNull();
    expect(decodificarItem("gasto||12")).toBeNull();
    expect(decodificarItem("gasto|Café")).toBeNull(); // gasto sem valor
    expect(decodificarItem("gasto|Café|0")).toBeNull();
    expect(decodificarItem("gasto|Café|-5")).toBeNull();
    expect(decodificarItem("gasto|Café|abc")).toBeNull();
    expect(decodificarItem("gasto|Café|99999999")).toBeNull();
    expect(decodificarItem("gasto|Café|12|extra")).toBeNull();
    expect(decodificarItem(`habito|${"a".repeat(300)}`)).toBeNull();
  });

  it("nome limpo e curto: sem caractere de controle, sem '|', espaços colapsados, até 60", () => {
    expect(limparNome("  Café\n\tda   manhã ")).toBe("Café da manhã");
    expect(limparNome("a|b")).toBe("a b");
    expect(limparNome("x".repeat(90))).toHaveLength(NOME_MAX);
    expect(normalizarItem({ tipo: "habito", nome: "<script>alert(1)</script>" })?.nome).toBe("<script>alert(1)</script>"); // React escapa; só o tamanho importa
  });

  it("valor do gasto com centavos e água com teto", () => {
    expect(normalizarItem({ tipo: "gasto", nome: "a", valor: 12.345 })?.valor).toBe(12.35);
    expect(normalizarItem({ tipo: "agua", nome: "copo", valor: 99999 })?.valor).toBe(2000);
    expect(normalizarItem({ tipo: "agua", nome: "copo" })?.valor).toBe(250);
    expect(normalizarItem({ tipo: "meta", nome: "Viajar", valor: 3 })).toEqual({ tipo: "meta", nome: "Viajar" });
  });

  it("rótulos em português", () => {
    expect(rotuloDoItem(CAFE)).toBe("Café · R$ 12");
    expect(rotuloDoItem({ tipo: "gasto", nome: "Uber", valor: 23.5 })).toBe("Uber · R$ 23,50");
    expect(rotuloDoItem({ tipo: "agua", nome: "1 copo d'água", valor: 250 })).toBe("1 copo d'água · 250 ml");
  });

  it("cada tipo tem o módulo dele (e só esses 5 módulos têm missão)", () => {
    for (const t of TIPOS_DO_ITEM) expect(tipoDoModulo(MODULO_DO_TIPO[t])).toBe(t);
    expect(tipoDoModulo("dieta")).toBeNull();
    expect(tipoDoModulo("pet")).toBeNull();
  });
});

describe("os links da demo", () => {
  it("sem braço e sem item, a MESMA string", () => {
    expect(comBraco(DEMO, null)).toBe(DEMO);
    expect(comItem(DEMO, null)).toBe(DEMO);
  });

  it("com braço e item: as pílulas levam os dois; um c= antigo é trocado, não duplicado", () => {
    const pilula = comItem(comBraco(DEMO, "on"), CAFE);
    const p = new URLSearchParams(pilula.split("?")[1]);
    expect(p.get("guia")).toBe("1");
    expect(p.get("c")).toBe("gasto|Café|12");
    const outra = comItem(pilula, { tipo: "gasto", nome: "Pão", valor: 5 });
    expect(new URLSearchParams(outra.split("?")[1]).getAll("c")).toEqual(["gasto|Pão|5"]);
  });
});

describe("o item sobrevive à troca de módulo (URL > memória > sessão)", () => {
  it("a URL manda", () => {
    gravarEstadoDaMissao({ item: { tipo: "gasto", nome: "Outro", valor: 1 } });
    expect(itemDaDemo("?c=gasto%7CCaf%C3%A9%7C12")).toEqual(CAFE);
  });

  it("sem c= na URL (pílula antiga, volta do Google), vem da memória/sessão", () => {
    gravarEstadoDaMissao({ inicio: "financas", item: CAFE });
    expect(itemDaDemo("?funnel=1")).toEqual(CAFE);
    expect(JSON.parse(sessionStorage.getItem("core-demo-guia") ?? "{}").item).toEqual(CAFE);
  });

  it("sessão com lixo não vira item", () => {
    sessionStorage.setItem("core-demo-guia", JSON.stringify({ item: { tipo: "gasto", nome: "", valor: 12 } }));
    expect(itemDaDemo("")).toBeNull();
    sessionStorage.setItem("core-demo-guia", "{quebrado");
    expect(estadoDaMissao()).toEqual({});
  });

  it("o paywall sabe que tem item pela URL ou pela sessão (sem carregar a missão)", () => {
    expect(temItemDaDemo()).toBe(false);
    window.history.replaceState({}, "", "/inicio?step=signup&c=gasto%7CCaf%C3%A9%7C12");
    expect(temItemDaDemo()).toBe(true);
    window.history.replaceState({}, "", "/inicio?step=signup");
    expect(temItemDaDemo()).toBe(false);
    gravarEstadoDaMissao({ item: CAFE });
    expect(temItemDaDemo()).toBe(true);
  });
});
