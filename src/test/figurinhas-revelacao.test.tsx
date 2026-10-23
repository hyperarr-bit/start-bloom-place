import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AdesivoRaro } from "@/components/conquistas/adesivos-raridade";
import { FigurinhaVazia } from "@/components/conquistas/FigurinhaAlbum";
import { quaseConquistada } from "@/components/conquistas/FigurinhaOculta";

afterEach(cleanup);

describe("a surpresa de conquistar", () => {
  it("só oferece uma espiada no último quinto de uma meta com várias etapas", () => {
    expect(quaseConquistada()).toBe(false);
    expect(quaseConquistada({ atual: 0, alvo: 1 })).toBe(false);
    expect(quaseConquistada({ atual: 0, alvo: 0 })).toBe(false);
    expect(quaseConquistada({ atual: 2, alvo: 7 })).toBe(false);
    expect(quaseConquistada({ atual: 5, alvo: 7 })).toBe(false);
    expect(quaseConquistada({ atual: 6, alvo: 7 })).toBe(true);
    expect(quaseConquistada({ atual: 80, alvo: 100 })).toBe(true);
  });

  it("a mesma figurinha vai de silhueta a espiada e arte completa conforme a conquista real", () => {
    const props = { id: "saver-60", raridade: "epico" as const, tamanho: 160 };
    const { container, rerender } = render(<AdesivoRaro {...props} trancado progresso={{ atual: 2, alvo: 7 }} />);
    expect(container.querySelector('.fig-oculta[data-estado="bloqueada"]')).toBeTruthy();
    expect(container.querySelector('.fig-oculta-cadeado')).toBeTruthy();
    expect(container.querySelector('svg[data-arte-caderno]')).toBeNull();
    rerender(<AdesivoRaro {...props} trancado progresso={{ atual: 6, alvo: 7 }} />);
    expect(container.querySelector('.fig-oculta[data-estado="quase"]')).toBeTruthy();
    expect(container.querySelector('.fig-oculta-espiada svg[data-arte-caderno]')).toBeTruthy();
    expect(container.querySelector('.fig-oculta-cadeado')).toBeNull();
    rerender(<AdesivoRaro {...props} progresso={{ atual: 7, alvo: 7 }} />);
    expect(container.querySelector('.fig-oculta')).toBeNull();
    expect(container.querySelector('.ad-rar > svg[data-arte-caderno]')).toBeTruthy();
    expect(container.querySelector('.ad-anel, .ad-sheen, .ad-faisca')).toBeNull();
  });

  it("as vagas do álbum usam a mesma silhueta e não deixam a cena aparecer em cinza", () => {
    const { container } = render(<FigurinhaVazia id="sequencia-14" raridade="raro" tamanho={80} progresso={{ atual: 12, alvo: 14 }} />);
    expect(container.querySelector('.fig-vazia > .fig-oculta[data-estado="quase"]')).toBeTruthy();
    expect(container.querySelector('.fig-vazia > svg')).toBeNull();
  });
});
