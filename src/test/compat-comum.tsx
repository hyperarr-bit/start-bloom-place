/**
 * PEÇAS COMUNS DOS TESTES DE COMPATIBILIDADE (30/09) — app novo × app antigo das lojas.
 *
 * O app antigo (commit 78883beb: iPhone 1.0.7/1.0.8, Android 125; o 122 usa os mesmos
 * formatos) lê a MESMA nuvem que a web nova. Aqui a "nuvem" é um store em memória que:
 *  - sobrevive a desmontar (o mesmo objeto serve o módulo novo e os componentes antigos);
 *  - guarda cada escrita como JSON (é o que o Supabase guarda: `undefined` some, número
 *    continua número) — o componente antigo lê exatamente o que viajaria pela sincronização;
 *  - anota a ordem das chaves gravadas (`escritas`) pra provar que ABRIR não grava.
 */
import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

export type Dados = Record<string, unknown>;

const comoNaNuvem = (v: unknown) => JSON.parse(JSON.stringify(v));

export function criarNuvem(inicial: Dados) {
  const estado = { dados: comoNaNuvem(inicial) as Dados, escritas: [] as string[] };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [, subir] = useReducer((x: number) => x + 1, 0);
    /* Como o provider de verdade (use-user-data: `get` lê o `store` do RENDER): dentro do mesmo
       toque, quem gravou e lê de novo pelo `get` que tinha em mãos ainda vê o valor de antes.
       A identidade do `get` muda a cada escrita (quem memoiza por ele re-renderiza). */
    const retrato = estado.dados;
    const get = useCallback(<T,>(k: string, f: T): T => (k in retrato ? (retrato[k] as T) : f), [retrato]);
    const set = useCallback((k: string, v: unknown) => {
      const proximo = { ...estado.dados };
      if (v === undefined) delete proximo[k];
      else proximo[k] = comoNaNuvem(v);
      estado.dados = proximo;
      estado.escritas.push(k);
      subir();
    }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode, rota = "/") => render(<MemoryRouter initialEntries={[rota]}><Provedor>{ui}</Provedor></MemoryRouter>);
  /** Escritas de DADO: fora o carimbo do tutorial (`spotlight-done-*`), que o SpotlightOverlay grava em todo módulo pra quem tem conta. */
  const escritasDeDado = () => estado.escritas.filter((k) => !k.startsWith("spotlight-"));
  const zerarEscritas = () => { estado.escritas.length = 0; };
  const ler = <T,>(k: string) => estado.dados[k] as T;
  return { estado, Provedor, montar, escritasDeDado, zerarEscritas, ler };
}

export type Nuvem = ReturnType<typeof criarNuvem>;

/** "array" | "object" | "string" | "number" | "boolean" | "undefined" — o que o app antigo espera de cada chave. */
export const formaDe = (v: unknown): string => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

/**
 * Captura o console.error enquanto o componente ANTIGO renderiza: erro de React (componente que
 * quebra, chave duplicada, prop inválida) aparece aqui. O aviso de act() dos portais/toasts não
 * é quebra de tela e fica de fora.
 */
export function vigiarConsole() {
  const mensagens: string[] = [];
  const espiao = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    mensagens.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(" "));
  });
  return {
    mensagens,
    erros: () => mensagens.filter((m) => !/not wrapped in act\(/.test(m)),
    parar: () => espiao.mockRestore(),
  };
}

/** O que o jsdom não tem e as telas chamam (rolagem, captura de ponteiro do Radix, ResizeObserver). */
export function prepararJsdom() {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
}
