import { afterEach, describe, expect, it } from "vitest";
import { outraTelaAberta } from "@/components/conquistas/Momentos";

describe("festa × balão do menu novo (1.0.18)", () => {
  afterEach(() => { document.body.innerHTML = ""; });
  it("com o balão na tela a festa espera; sem ele, segue", () => {
    expect(outraTelaAberta()).toBe(false);
    const b = document.createElement("button");
    b.setAttribute("data-aviso-menu-novo", "");
    document.body.appendChild(b);
    expect(outraTelaAberta()).toBe(true);
    b.remove();
    expect(outraTelaAberta()).toBe(false);
  });
});
