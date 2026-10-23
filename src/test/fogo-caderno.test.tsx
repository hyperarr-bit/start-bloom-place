import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { FogoDaSequencia } from "@/components/conquistas/nova/FogoDaSequencia";
import { fogoDoCaderno, proximoFogoDoCaderno } from "@/components/conquistas/nova/fogo-caderno";

const estado = vi.hoisted(() => ({ vista: null as number | null, loaded: true, reduzir: false, set: vi.fn() }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ loaded: estado.loaded, get: () => estado.vista, set: estado.set }) }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => estado.reduzir }));
beforeEach(() => { estado.vista = null; estado.loaded = true; estado.reduzir = false; estado.set.mockReset(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("fogo do caderno", () => {
  it.each([[1,"salvia"],[6,"salvia"],[7,"ambar"],[13,"ambar"],[14,"petroleo"],[29,"petroleo"],[30,"violeta"],[99,"violeta"],[100,"dourado"],[365,"dourado"]])("%s dias → %s", (dias, id) => {
    expect(fogoDoCaderno(Number(dias)).id).toBe(id);
  });
  it("zero e dados inválidos ficam apagados; próximos marcos não dependem dos protetores", () => {
    for (const d of [0,-1,NaN,Infinity]) expect(fogoDoCaderno(d).nome).toBe("fogo apagado");
    expect(proximoFogoDoCaderno(0)?.min).toBe(1);
    expect(proximoFogoDoCaderno(12)?.min).toBe(14);
    expect(proximoFogoDoCaderno(35)?.min).toBe(100);
    expect(proximoFogoDoCaderno(100)).toBeNull();
  });
  it("primeira visita registra a faixa sem festa; zero mostra SVG apagado", () => {
    const {container, rerender} = render(<FogoDaSequencia dias={30}/>);
    expect(container.querySelector("[data-subiu]")).toBeNull();
    expect(estado.set).toHaveBeenCalledWith("conquistas-fogo-caderno-visto",3,{system:true});
    rerender(<FogoDaSequencia dias={0}/>);
    expect(container.querySelector("svg")?.getAttribute("data-fogo")).toBe("apagado");
  });
  it("subir anima uma vez; a gravação não corta a animação; cair não comemora", () => {
    estado.vista = 1;
    const {container,rerender} = render(<FogoDaSequencia dias={14}/>);
    expect(container.querySelector("[data-subiu]")).not.toBeNull();
    estado.vista = 2;
    rerender(<FogoDaSequencia dias={14}/>);
    expect(container.querySelector("[data-subiu]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1100));
    expect(container.querySelector("[data-subiu]")).toBeNull();
    rerender(<FogoDaSequencia dias={15}/>);
    expect(container.querySelector("[data-subiu]")).toBeNull();
    rerender(<FogoDaSequencia dias={1}/>);
    expect(container.querySelector("[data-subiu]")).toBeNull();
  });
  it("aguarda dados carregarem e respeita movimento reduzido", () => {
    estado.vista=1; estado.loaded=false;
    const {container,rerender} = render(<FogoDaSequencia dias={14}/>);
    expect(estado.set).not.toHaveBeenCalled();
    estado.loaded=true; estado.reduzir=true;
    rerender(<FogoDaSequencia dias={14}/>);
    expect(estado.set).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-subiu]")).toBeNull();
  });
});
