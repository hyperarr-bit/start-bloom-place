/**
 * OFERTA "ANUAL" DO /inicio (26/10) — a marca no aparelho, a chave de emergência, a medição (1 por aparelho por etapa)
 * e o fluxo do upgrade (o X do upsell abre o downsell UMA vez). Regras em src/lib/oferta-anual.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));

import {
  CHAVE_OFERTA, OFERTA_ANUAL, OFERTA_DOWN_VITALICIO, OFERTA_UP_VITALICIO, POR_MES_ANUAL, VALIDADE_OFERTA_MS,
  _forcarChaveOfertaAnual, _zerarEstadoUpgrade, _zerarOfertaAnual, aoAceitar, aoPagar, aoRecusar, aoVoltarDoPix,
  capturarOferta, ehOfertaAnual, ehOfertaDaVariante, fimDoAnual, gravarEstadoUpgrade, landingDaOferta, lerEstadoUpgrade,
  marcarEtapaOferta, novoEstadoUpgrade, ofertaAnualAqui, posCompraSegurado, resultadoDoUpgrade, segurarPosCompra, varianteOferta,
} from "@/lib/oferta-anual";

const limparCookie = () => { document.cookie = `${CHAVE_OFERTA}=; max-age=0; path=/`; };

beforeEach(() => {
  vi.clearAllMocks();
  _forcarChaveOfertaAnual(null);
  _zerarOfertaAnual();
  _zerarEstadoUpgrade();
  limparCookie();
  try { localStorage.clear(); } catch { /* noop */ }
  window.history.replaceState(null, "", "/inicio");
});
afterEach(() => { _forcarChaveOfertaAnual(null); vi.useRealTimers(); });

describe("ativação pelo link (?oferta=anual)", () => {
  it("sem o parâmetro (e sem marca): controle — o /inicio de sempre", () => {
    expect(capturarOferta("?utm_source=ig", "/inicio")).toBe("controle");
    expect(ehOfertaAnual()).toBe(false);
    expect(localStorage.getItem(CHAVE_OFERTA)).toBeNull();
  });

  it("?oferta=anual liga e GUARDA no localStorage e no cookie (30 dias); a volta da demo sem o parâmetro segue anual", () => {
    expect(capturarOferta("?oferta=anual&utm_source=ig", "/inicio")).toBe("anual");
    expect(JSON.parse(localStorage.getItem(CHAVE_OFERTA)!)).toMatchObject({ v: "anual", landing: "/inicio" });
    expect(document.cookie).toContain(`${CHAVE_OFERTA}=`);
    expect(capturarOferta("?step=signup", "/inicio")).toBe("anual");
    expect(landingDaOferta()).toBe("/inicio");
  });

  it("o Instagram zerou o localStorage: o cookie devolve a marca (e re-semeia o storage)", () => {
    capturarOferta("?oferta=anual", "/inicio");
    const cookie = document.cookie;
    _zerarOfertaAnual(); // apaga storage + cookie + heap
    document.cookie = cookie.split("; ").find((c) => c.startsWith(`${CHAVE_OFERTA}=`))! + "; path=/";
    expect(localStorage.getItem(CHAVE_OFERTA)).toBeNull();
    expect(varianteOferta()).toBe("anual");
    expect(localStorage.getItem(CHAVE_OFERTA)).not.toBeNull();
  });

  it("depois de 30 dias a marca vence (volta o controle)", () => {
    vi.useFakeTimers({ now: new Date("2026-10-26T12:00:00Z") });
    capturarOferta("?oferta=anual", "/inicio");
    expect(varianteOferta()).toBe("anual");
    vi.setSystemTime(Date.now() + VALIDADE_OFERTA_MS + 1000);
    // o heap ainda tem a marca: a validade vale pra ele também
    expect(varianteOferta()).toBe("controle");
  });

  it("?oferta=controle (ou off) apaga a marca — QA volta ao normal", () => {
    capturarOferta("?oferta=anual", "/inicio");
    expect(capturarOferta("?oferta=controle", "/inicio")).toBe("controle");
    capturarOferta("?oferta=anual", "/inicio");
    expect(capturarOferta("?oferta=off", "/inicio")).toBe("controle");
    expect(localStorage.getItem(CHAVE_OFERTA)).toBeNull();
  });

  it("CHAVE DE EMERGÊNCIA desligada: todo mundo no controle, até quem já tem a marca", () => {
    capturarOferta("?oferta=anual", "/inicio");
    _forcarChaveOfertaAnual(false);
    expect(varianteOferta()).toBe("controle");
    expect(ofertaAnualAqui()).toBe(false);
    _forcarChaveOfertaAnual(null);
    expect(varianteOferta()).toBe("anual");
  });

  it("só vale no funil do /inicio (o paywall do app e o /planos nunca mudam)", () => {
    capturarOferta("?oferta=anual", "/inicio");
    expect(ofertaAnualAqui()).toBe(true);
    window.history.replaceState(null, "", "/planos");
    expect(ofertaAnualAqui()).toBe(false);
  });

  it("valores: 27,90 = R$ 2,33/mês; as 3 ofertas com as marcas pedidas", () => {
    expect(POR_MES_ANUAL).toBe("2,33");
    expect([OFERTA_ANUAL, OFERTA_UP_VITALICIO, OFERTA_DOWN_VITALICIO]).toEqual(["OFB_anual27", "OFB_up47", "OFB_down27"]);
    expect(ehOfertaDaVariante("OFB_up47")).toBe(true);
    expect(ehOfertaDaVariante("w27")).toBe(false);
  });

  it("fim do anual = compra + 365 dias (dd/mm/aaaa, Brasília)", () => {
    expect(fimDoAnual(Date.parse("2026-10-26T15:00:00Z"))).toBe("26/10/2027");
  });
});

describe("medição: oferta_etapa 1x por aparelho por etapa, com variante e landing", () => {
  it("anual: cada etapa sai UMA vez, com variante 'anual' e a landing", () => {
    capturarOferta("?oferta=anual", "/inicio");
    expect(marcarEtapaOferta("landing")).toBe(true);
    expect(marcarEtapaOferta("landing")).toBe(false);
    marcarEtapaOferta("checkout", { offer: OFERTA_ANUAL });
    marcarEtapaOferta("checkout", { offer: OFERTA_ANUAL });
    const ev = m.track.mock.calls.filter((c) => c[0] === "oferta_etapa");
    expect(ev).toHaveLength(2);
    expect(ev[0][1]).toMatchObject({ etapa: "landing", variante: "anual", landing: "/inicio" });
    expect(ev[1][1]).toMatchObject({ etapa: "checkout", variante: "anual", offer: "OFB_anual27" });
  });

  it("controle também é medido (pra comparar), com variante 'controle'", () => {
    marcarEtapaOferta("landing");
    expect(m.track).toHaveBeenCalledWith("oferta_etapa", expect.objectContaining({ etapa: "landing", variante: "controle", landing: "/inicio" }));
  });

  it("fora do /inicio não mede nada", () => {
    window.history.replaceState(null, "", "/hoje");
    expect(marcarEtapaOferta("landing")).toBe(false);
    expect(m.track).not.toHaveBeenCalled();
  });
});

describe("o fluxo do upgrade: upsell 47,90 → (X/não) downsell 27,90 UMA vez → acesso", () => {
  it("X (ou não) no upsell abre o downsell; X (ou não) no downsell termina no anual", () => {
    let e = novoEstadoUpgrade("ord1");
    expect(e.etapa).toBe("up");
    e = aoRecusar(e);
    expect(e).toMatchObject({ etapa: "down", downVisto: true });
    e = aoRecusar(e);
    expect(e.etapa).toBe("fim");
    expect(resultadoDoUpgrade(e)).toBe("anual");
  });

  it("o downsell aparece UMA vez: voltando pro upsell com ele já visto, recusar termina (não abre de novo)", () => {
    let e = aoRecusar(novoEstadoUpgrade("ord1"));
    e = { ...e, etapa: "up" };
    expect(aoRecusar(e).etapa).toBe("fim");
  });

  it("X no Pix do upsell conta como recusa: abre o downsell (1x)", () => {
    const e = aoAceitar(novoEstadoUpgrade("ord1"));
    expect(e.etapa).toBe("up_pix");
    expect(aoRecusar(e)).toMatchObject({ etapa: "down", downVisto: true, pix: null });
  });

  it("Voltar do Pix volta pra oferta (não é recusa)", () => {
    const e = aoAceitar(novoEstadoUpgrade("ord1"));
    expect(aoVoltarDoPix(e)).toMatchObject({ etapa: "up", downVisto: false });
  });

  it("pagou o upsell → vitalício (OFB_up47); pagou o downsell → vitalício (OFB_down27)", () => {
    const up = aoPagar(aoAceitar(novoEstadoUpgrade("ord1")), "qr_up");
    expect(up).toMatchObject({ etapa: "fim", pedido: "qr_up", oferta: "OFB_up47" });
    expect(resultadoDoUpgrade(up)).toBe("vitalicio");
    const down = aoPagar(aoAceitar(aoRecusar(novoEstadoUpgrade("ord1"))), "qr_down");
    expect(down).toMatchObject({ etapa: "fim", pedido: "qr_down", oferta: "OFB_down27" });
  });

  it("o estado fica no aparelho por compra (ida ao banco e volta); outra compra começa do zero", () => {
    gravarEstadoUpgrade(aoRecusar(novoEstadoUpgrade("ord1")));
    expect(lerEstadoUpgrade("ord1").etapa).toBe("down");
    expect(lerEstadoUpgrade("ord2").etapa).toBe("up");
  });

  it("o pós-compra segurado (o /inicio não manda pro app no meio do upsell)", () => {
    expect(posCompraSegurado()).toBe(false);
    segurarPosCompra(true);
    expect(posCompraSegurado()).toBe(true);
    segurarPosCompra(false);
    expect(posCompraSegurado()).toBe(false);
  });
});
