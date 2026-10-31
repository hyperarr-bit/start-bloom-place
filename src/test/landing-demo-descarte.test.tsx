/**
 * 31/10 (crítica r2 da demo em tela cheia, técnico BAIXA): recarregar a /organizar com a demo carregando faz o documento do
 * iframe, que já está morrendo, lançar "Importing a module script failed" — o RouteErrorBoundary registrava route_error
 * {chunk: true} falso e chamava o recarregarPorChunkNovo. Depois do pagehide/beforeunload, nas rotas landing-demo*, sai calado;
 * o resto do app segue igual e o pageshow (volta do bfcache) desfaz.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown> | undefined]>);
const recargas = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d?: Record<string, unknown>) => { eventos.push([n, d]); },
}));
vi.mock("@/lib/chunk-novo", async (orig) => ({
  ...(await orig<typeof import("@/lib/chunk-novo")>()),
  recarregarPorChunkNovo: () => { recargas.n++; return "recarregando"; },
}));

import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

const Quebra = (): never => { throw new TypeError("Importing a module script failed."); };
const erros = () => eventos.filter(([n]) => n === "route_error");

afterEach(() => { cleanup(); eventos.length = 0; recargas.n = 0; window.dispatchEvent(new Event("pageshow")); });

describe("RouteErrorBoundary × página saindo (demo da landing)", () => {
  it("antes de sair, o erro de chunk da demo conta (route_error + recarga), como sempre", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RouteErrorBoundary routeName="landing-demo-rotina"><Quebra /></RouteErrorBoundary>);
    expect(erros()).toHaveLength(1);
    expect(erros()[0][1]).toMatchObject({ route: "landing-demo-rotina", chunk: true });
    expect(recargas.n).toBe(1);
  });

  it("depois do pagehide (ou beforeunload): a demo da landing não registra nem recarrega; outra rota segue igual; o pageshow desfaz", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.dispatchEvent(new Event("pagehide"));
    render(<RouteErrorBoundary routeName="landing-demo-rotina"><Quebra /></RouteErrorBoundary>);
    render(<RouteErrorBoundary routeName="landing-demo"><Quebra /></RouteErrorBoundary>);
    expect(erros()).toHaveLength(0);
    expect(recargas.n).toBe(0);
    render(<RouteErrorBoundary routeName="casa"><Quebra /></RouteErrorBoundary>);
    expect(erros().map(([, d]) => d?.route)).toEqual(["casa"]);
    cleanup(); eventos.length = 0; recargas.n = 0;

    window.dispatchEvent(new Event("pageshow"));
    render(<RouteErrorBoundary routeName="landing-demo-rotina"><Quebra /></RouteErrorBoundary>);
    expect(erros()).toHaveLength(1);
    cleanup(); eventos.length = 0;

    window.dispatchEvent(new Event("beforeunload"));
    render(<RouteErrorBoundary routeName="landing-demo-financas"><Quebra /></RouteErrorBoundary>);
    expect(erros()).toHaveLength(0);
  });
});
