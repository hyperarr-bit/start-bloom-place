import { describe, expect, it } from "vitest";
import { atributosDeAnuncio, corpoDoSinalCapi, ID_ANUNCIO_ZERADO } from "@/lib/meta-capi-cliente";

const ANON = "XZ7f3c0a-anon-meta";
const IDFA = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";
const IDFV = "11111111-2222-3333-4444-555555555555";
const GAID = "99999999-8888-7777-6666-555555555555";
const SESSAO = "6f1e2d3c-4b5a-6978-90ab-cdef12345678";

describe("atributos de anúncio pro RevenueCat", () => {
  it("com collectDeviceIdentifiers, só grava o $fbAnonId — $idfa/$idfv ficam com o SDK", () => {
    const attrs = atributosDeAnuncio(
      { anonId: ANON, gaid: IDFA, idfv: IDFV },
      { plataforma: "ios", coletouDispositivo: true },
    );
    expect(attrs).toEqual({ $fbAnonId: ANON });
    expect(attrs.$idfa).toBeUndefined();
    expect(attrs.$idfv).toBeUndefined();
    expect(attrs.$ip).toBeUndefined();
  });

  it("sem o método do plugin, o iPhone manda $idfv e $idfa (o plugin só enche o IDFA com ATT)", () => {
    expect(atributosDeAnuncio(
      { anonId: ANON, gaid: IDFA, idfv: IDFV },
      { plataforma: "ios", coletouDispositivo: false },
    )).toEqual({ $fbAnonId: ANON, $idfv: IDFV, $idfa: IDFA });
  });

  it("IDFA zerado não entra — ATT negado não pode apagar um madid nem mandar zeros", () => {
    const attrs = atributosDeAnuncio(
      { anonId: ANON, gaid: ID_ANUNCIO_ZERADO, idfv: IDFV },
      { plataforma: "ios", coletouDispositivo: false },
    );
    expect(attrs.$idfa).toBeUndefined();
    expect(attrs.$fbAnonId).toBe(ANON);
    expect(attrs.$idfv).toBe(IDFV);
  });

  it("Android não copia o GAID pra $idfa nem inventa $idfv", () => {
    expect(atributosDeAnuncio(
      { anonId: ANON, gaid: GAID, idfv: IDFV },
      { plataforma: "android", coletouDispositivo: false },
    )).toEqual({ $fbAnonId: ANON });
  });

  it("sem anonymousID da Meta, não manda $fbAnonId vazio", () => {
    expect(atributosDeAnuncio(
      { anonId: "  ", gaid: "", idfv: "" },
      { plataforma: "ios", coletouDispositivo: false },
    )).toEqual({});
  });
});

describe("corpo do app-capi-sinal", () => {
  it("leva sessão e o id anônimo do RevenueCat, e nenhuma chave de IP", () => {
    const body = corpoDoSinalCapi(SESSAO, "$RCAnonymousID:abc.def_123");
    expect(body).toEqual({
      session_id: SESSAO,
      rc_app_user_id: "$RCAnonymousID:abc.def_123",
    });
    expect(Object.keys(body).some((k) => /ip|user_agent|ua/i.test(k))).toBe(false);
  });

  it("aceita o UUID da conta e descarta id de loja malformado", () => {
    const conta = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(corpoDoSinalCapi(SESSAO, conta).rc_app_user_id).toBe(conta);
    expect(corpoDoSinalCapi(SESSAO, "nao-e-um-id").rc_app_user_id).toBeUndefined();
    expect(corpoDoSinalCapi("curta", null)).toEqual({});
  });

  it("não deixa um IP passado no lugar do id da loja vazar no corpo", () => {
    const body = corpoDoSinalCapi(SESSAO, "203.0.113.10");
    expect(body).toEqual({ session_id: SESSAO });
    expect(JSON.stringify(body)).not.toContain("203.0.113.10");
  });
});
