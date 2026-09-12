/**
 * Medição de cards (12/09): detecção automática pelo desenho que os módulos
 * já usam, view uma vez por sessão, interact uma vez por sessão, card
 * dentro de card não conta duas vezes, data-card manda.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const eventos: [string, Record<string, unknown>][] = [];
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); } }));

import { instalarMedicaoDeCards, normalizarChave, tituloDoCard } from "@/lib/medicao-cards";

// IntersectionObserver do jsdom: não existe. Este finge que tudo o que é
// observado entra na tela na hora.
class IOFalso {
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
  observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IOFalso;
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return 120; } });

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => { eventos.length = 0; sessionStorage.clear(); document.body.innerHTML = ""; });

describe("chave do card", () => {
  it("normaliza: sem emoji, acento, número ou pontuação; caixa alta; 32 letras", () => {
    expect(normalizarChave("🔁 O QUE VOCÊ REPETE NO DIA")).toBe("O QUE VOCE REPETE NO DIA");
    expect(normalizarChave("Tarefas 0/2 feitas")).toBe("TAREFAS FEITAS");
    expect(normalizarChave("POMODORO — FOCO · 0 sessões hoje • 0min foco total")).toBe("POMODORO FOCO SESSOES HOJE MIN F");
  });
  it("título = primeiro texto forte em caixa alta ou heading; data-card manda; sem título, nada", () => {
    const el = document.createElement("div");
    el.innerHTML = '<div><span class="text-sm font-black uppercase">✅ Lidos (6)</span><span class="font-bold">6</span></div>';
    expect(tituloDoCard(el)).toBe("LIDOS");
    el.setAttribute("data-card", "estante-lidos");
    expect(tituloDoCard(el)).toBe("estante-lidos");
    const semTitulo = document.createElement("div"); semTitulo.innerHTML = "<p>texto qualquer em minúsculas</p>";
    expect(tituloDoCard(semTitulo)).toBeNull();
  });
});

describe("instalarMedicaoDeCards", () => {
  it("view uma vez por sessão por módulo/aba/card; interact no primeiro clique; card interno não conta", async () => {
    const root = document.createElement("div"); root.id = "root"; document.body.appendChild(root);
    root.innerHTML = `
      <div class="rounded-xl border border-border"><h3>URGÊNCIAS</h3>
        <div class="rounded-lg border border-border"><span class="font-bold">ITEM INTERNO</span><button id="b1">x</button></div>
      </div>
      <div class="rounded-xl border border-border"><span class="font-black uppercase">Como você está hoje?</span><input id="i1"></div>
      <div class="rounded-xl border border-border"><p>sem título</p></div>`;
    let aba = "semana";
    const parar = instalarMedicaoDeCards("rotina", () => aba);
    await esperar(400);
    const views = eventos.filter(([n]) => n === "card_view").map(([, d]) => d.card);
    expect(views).toEqual(["URGENCIAS", "COMO VOCE ESTA HOJE"]);

    document.getElementById("b1")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("b1")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("i1")!.dispatchEvent(new Event("input", { bubbles: true }));
    const usos = eventos.filter(([n]) => n === "card_interact").map(([, d]) => `${d.aba}/${d.card}`);
    expect(usos).toEqual(["semana/URGENCIAS", "semana/COMO VOCE ESTA HOJE"]);

    // troca de aba: o mesmo card noutra aba conta de novo (é outra tela)
    aba = "mes";
    root.innerHTML = '<div class="rounded-xl border border-border"><h3>URGÊNCIAS</h3></div>';
    await esperar(400);
    expect(eventos.filter(([n, d]) => n === "card_view" && d.aba === "mes").length).toBe(1);
    parar();
  });
});
