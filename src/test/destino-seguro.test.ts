/**
 * `?next=` do link de e-mail: só caminho interno permitido (01/10).
 * Sem isto, um link do nosso domínio poderia logar a pessoa e jogá-la num
 * site de terceiros (open redirect).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { destinoSeguro, guardarDestino, pegarDestinoGuardado, urlEntrar } from "@/lib/destino-seguro";

describe("destinoSeguro", () => {
  it("aceita /planos com query (o destino do e-mail de cartão recusado)", () => {
    expect(destinoSeguro("/planos?oferta=w97&from=cobranca_recusada_pix")).toBe("/planos?oferta=w97&from=cobranca_recusada_pix");
    expect(destinoSeguro("/planos")).toBe("/planos");
    expect(destinoSeguro("/planos/")).toBe("/planos/");
  });

  it("rejeita externos, esquemas, protocolo-relativo e barras invertidas", () => {
    for (const ruim of [
      "https://evil.com/planos", "//evil.com/planos", "/\\evil.com", "javascript:alert(1)",
      "/planos:x", "http:/planos", "/planos\n?x", "/pla nos", null, undefined, "", "planos",
    ]) expect(destinoSeguro(ruim as string)).toBeNull();
    // espaço nas pontas é só sujeira de copiar/colar: limpa e aceita
    expect(destinoSeguro(" /planos ")).toBe("/planos");
  });

  it("rejeita rotas fora da lista (ex.: /admin, /planosfalso)", () => {
    expect(destinoSeguro("/admin")).toBeNull();
    expect(destinoSeguro("/planosfalso")).toBeNull();
    expect(destinoSeguro("/")).toBeNull();
  });

  it("não deixa uma query com URL externa virar destino (fica como query, interno)", () => {
    expect(destinoSeguro("/planos?volta=https://evil.com")).toBe("/planos?volta=https://evil.com");
  });
});

describe("destino guardado pro OAuth e /entrar", () => {
  beforeEach(() => localStorage.clear());

  it("guarda só destino seguro e devolve uma vez", () => {
    guardarDestino("/planos?oferta=w97");
    expect(pegarDestinoGuardado()).toBe("/planos?oferta=w97");
    expect(pegarDestinoGuardado()).toBeNull();
    guardarDestino("https://evil.com");
    expect(pegarDestinoGuardado()).toBeNull();
  });

  it("urlEntrar leva e-mail (se válido) e next codificados", () => {
    expect(urlEntrar("/planos?oferta=w97", "ana@x.com")).toBe("/entrar?e=ana%40x.com&next=%2Fplanos%3Foferta%3Dw97");
    expect(urlEntrar("/planos?oferta=w97", "nao-e-email")).toBe("/entrar?next=%2Fplanos%3Foferta%3Dw97");
  });
});
