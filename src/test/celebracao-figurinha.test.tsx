import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Badge } from "@/components/gamification/types";

const movimento = vi.hoisted(() => ({ reduzido: false }));
vi.mock("framer-motion", async importar => ({ ...await importar<typeof import("framer-motion")>(), useReducedMotion: () => movimento.reduzido }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
import { CelebracaoFigurinha, DURACAO_COMUM_MS } from "@/components/conquistas/nova/CelebracaoFigurinha";

const badge: Badge = { id:"first-expense", name:"Primeira Despesa", description:"Registre 1 despesa", category:"finance", icon:"", xp:50, unlocked:true, color:"green", raridade:"comum" };
const avancar = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => { movimento.reduzido = false; vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("comemorações de papel", () => {
  it("comum não toma foco e pode ser dispensada sem colar", () => {
    const colar = vi.fn(), fechar = vi.fn();
    const antes = document.createElement("button"); document.body.append(antes); antes.focus();
    render(<CelebracaoFigurinha badge={badge} onColar={colar} onFechar={fechar} />);
    expect(document.activeElement).toBe(antes);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Figurinha conquistada: Primeira Despesa");
    fireEvent.click(screen.getByRole("button",{name:"Guardar para depois"}));
    expect(fechar).toHaveBeenCalledTimes(1); expect(colar).not.toHaveBeenCalled();
    antes.remove();
  });
  it("aviso expira uma vez, mas pausa enquanto o usuário interage", () => {
    const fechar = vi.fn();
    render(<CelebracaoFigurinha badge={badge} onFechar={fechar} onColar={() => {}} />);
    avancar(3000);
    fireEvent.mouseEnter(screen.getByTestId("cn-toast"));
    avancar(DURACAO_COMUM_MS * 2); expect(fechar).not.toHaveBeenCalled();
    fireEvent.mouseLeave(screen.getByTestId("cn-toast"));
    avancar(DURACAO_COMUM_MS - 1); expect(fechar).not.toHaveBeenCalled();
    avancar(1); expect(fechar).toHaveBeenCalledTimes(1);
  });
  it("não desaparece com foco de teclado no botão de colar", () => {
    const fechar = vi.fn();
    render(<CelebracaoFigurinha badge={badge} onFechar={fechar} onColar={() => {}} />);
    act(() => screen.getByRole("button",{name:"Colar no álbum"}).focus());
    avancar(DURACAO_COMUM_MS * 2); expect(fechar).not.toHaveBeenCalled();
  });
  it("primeira figurinha tem foco contido, Escape e restauração", () => {
    const fechar = vi.fn();
    const antes = document.createElement("button"); document.body.append(antes); antes.focus();
    const tela = render(<CelebracaoFigurinha badge={badge} primeira onFechar={fechar} onColar={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-primeira");
    expect(document.activeElement).toBe(screen.getByRole("button",{name:"Colar minha primeira figurinha"}));
    screen.getByRole("button",{name:"Continuar"}).focus(); fireEvent.keyDown(document,{key:"Tab"});
    expect(document.activeElement).toBe(screen.getByRole("button",{name:"Guardar para depois"}));
    fireEvent.keyDown(document,{key:"Escape"}); expect(fechar).toHaveBeenCalledTimes(1);
    tela.unmount(); expect(document.activeElement).toBe(antes); expect(document.body.style.overflow).not.toBe("hidden"); antes.remove();
  });
  it("toques repetidos não navegam duas vezes nem disparam o fechamento depois", () => {
    const colar = vi.fn(), fechar = vi.fn();
    render(<CelebracaoFigurinha badge={badge} onColar={colar} onFechar={fechar} />);
    const botao = screen.getByRole("button",{name:"Colar no álbum"});
    fireEvent.click(botao); fireEvent.click(botao); avancar(DURACAO_COMUM_MS);
    expect(colar).toHaveBeenCalledTimes(1); expect(fechar).not.toHaveBeenCalled();
  });
  it("movimento reduzido dispensa partículas e mantém ações imediatas", () => {
    movimento.reduzido = true;
    const colar = vi.fn();
    render(<CelebracaoFigurinha badge={{...badge, raridade:"lendario", xp:400}} onColar={colar} onFechar={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-reduzir");
    expect(document.querySelector(".cf-particulas")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Colar no álbum"})); expect(colar).toHaveBeenCalledTimes(1);
  });
});
