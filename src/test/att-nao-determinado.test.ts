/**
 * ATT: "notDetermined" NÃO É RESPOSTA (1.0.18 — raio-X do funil de 21/10: 28 % das instalações ficavam com o ATT
 * `notDetermined` pra sempre porque o código gravava esse valor como "já pedido").
 *   · notDetermined (o diálogo não apareceu) não grava nada: o próximo pedido natural pergunta de novo;
 *   · no máximo 1 repetição por abertura do app; a próxima abertura pode tentar de novo;
 *   · authorized / denied / restricted gravam e nunca mais se pergunta.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const nativo = vi.hoisted(() => ({
  respostas: [] as string[],
  pedir: vi.fn(async () => ({ status: nativo.respostas.shift() ?? "authorized" })),
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "ios", isNativePlatform: () => true },
  registerPlugin: () => ({ pedirRastreamento: () => nativo.pedir(), pularATT: async () => undefined }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
const ficha = vi.hoisted(() => ({ capturar: vi.fn(async () => undefined) }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
  capturarDispositivoApp: () => ficha.capturar(),
}));

import { _zerarAberturaDoATT, pedirRastreamentoIos } from "@/lib/att-ios";

const CHAVE = "core-att-status";

beforeEach(() => {
  localStorage.clear();
  nativo.respostas = [];
  nativo.pedir.mockClear();
  ficha.capturar.mockClear();
  eventos.length = 0;
  _zerarAberturaDoATT();
});

describe("ATT: notDetermined não vira 'já pedido'", () => {
  it("o diálogo não apareceu (notDetermined): nada gravado; o próximo pedido natural ('Começar') pergunta de novo e a resposta vale pra sempre", async () => {
    nativo.respostas = ["notDetermined", "authorized"];
    expect(await pedirRastreamentoIos("welcome_auto")).toBe("notDetermined");
    expect(localStorage.getItem(CHAVE)).toBeNull();
    // 1.0.18: att_pedido quando o plugin é chamado; todo evento do ATT leva o braço do `att_momento`
    expect(eventos).toEqual([
      ["att_pedido", { origem: "welcome_auto", att_braco: "auto3s", att_momento: "auto3s" }],
      ["att_resposta", { status: "notDetermined", origem: "welcome_auto", tentativa: 1, att_braco: "auto3s", att_momento: "auto3s" }],
    ]);

    expect(await pedirRastreamentoIos("welcome")).toBe("authorized");
    expect(nativo.pedir).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(CHAVE)).toBe("authorized");
    expect(ficha.capturar).toHaveBeenCalledTimes(1); // a ficha do aparelho regravada com o IDFA
    expect(eventos[3]).toEqual(["att_resposta", { status: "authorized", origem: "welcome", att_braco: "auto3s", att_momento: "auto3s" }]);

    // respondido: nunca mais pergunta (nem na Home, nem noutra abertura)
    expect(await pedirRastreamentoIos("home")).toBe("ja_pedido");
    _zerarAberturaDoATT();
    expect(await pedirRastreamentoIos("home")).toBe("ja_pedido");
    expect(nativo.pedir).toHaveBeenCalledTimes(2);
  });

  it("no máximo 1 repetição por abertura: dois notDetermined seguidos e o 3º pedido da mesma abertura não pergunta; a próxima abertura pergunta de novo", async () => {
    nativo.respostas = ["notDetermined", "notDetermined", "denied"];
    expect(await pedirRastreamentoIos("welcome_auto")).toBe("notDetermined");
    expect(await pedirRastreamentoIos("welcome")).toBe("notDetermined");
    expect(await pedirRastreamentoIos("home")).toBe("ja_pedido"); // sem chamar o plugin
    expect(nativo.pedir).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(eventos.filter(([n]) => n === "att_resposta").map(([, d]) => d.tentativa)).toEqual([1, 2]);
    expect(eventos.filter(([n]) => n === "att_pedido")).toHaveLength(2); // o 3º pedido nem chegou ao plugin

    _zerarAberturaDoATT(); // o app foi fechado e aberto de novo
    expect(await pedirRastreamentoIos("home")).toBe("denied");
    expect(nativo.pedir).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(CHAVE)).toBe("denied");
    expect(await pedirRastreamentoIos("home")).toBe("ja_pedido");
  });

  it("denied e restricted gravam na 1ª resposta e nunca se pergunta de novo; a ficha só é regravada no authorized", async () => {
    for (const status of ["denied", "restricted"]) {
      localStorage.clear(); nativo.pedir.mockClear(); _zerarAberturaDoATT();
      nativo.respostas = [status];
      expect(await pedirRastreamentoIos("welcome")).toBe(status);
      expect(localStorage.getItem(CHAVE)).toBe(status);
      expect(await pedirRastreamentoIos("home")).toBe("ja_pedido");
      expect(nativo.pedir).toHaveBeenCalledTimes(1);
    }
    expect(ficha.capturar).not.toHaveBeenCalled();
  });

  it("'notDetermined' gravado por uma versão antiga no aparelho não vale como resposta: pergunta de novo", async () => {
    // 1.0.14–1.0.17 gravaram "notDetermined" no aparelho: esses 28 % precisam ser perguntados de novo na 1.0.18
    localStorage.setItem(CHAVE, "notDetermined");
    nativo.respostas = ["authorized"];
    expect(await pedirRastreamentoIos("home")).toBe("authorized");
    expect(nativo.pedir).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHAVE)).toBe("authorized");
  });
});
