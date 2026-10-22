/**
 * Corpo `aparelho` que o app manda pro revenuecat-sync (iOS 1.0.17): o IDFA
 * só sai com o ATT autorizado AGORA; Android/web não mandam nada.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarCorpoAparelho, versaoDoIosNoUA } from "./meta-dados-aparelho";

const IDFA = "6D92078A-8246-4BA4-AE5B-76104861E7DC";

describe("montarCorpoAparelho — gate do ATT", () => {
  it("autorizado: leva o IDFA, o status e as versões", () => {
    expect(montarCorpoAparelho({
      plataforma: "ios", attNativo: "authorized", idfa: IDFA,
      appVersao: "1.0.17", appBuild: "44", osVersao: "18.6",
    })).toEqual({ plataforma: "ios", att: "authorized", idfa: IDFA, app_versao: "1.0.17", app_build: "44", os_versao: "18.6" });
  });

  it.each(["denied", "restricted", "notDetermined"])("%s: NUNCA leva IDFA, mesmo se o plugin mandar um", (att) => {
    const c = montarCorpoAparelho({ plataforma: "ios", attNativo: att, idfa: IDFA, appVersao: "1.0.17" });
    expect(c).toEqual({ plataforma: "ios", att, app_versao: "1.0.17" });
    expect(c).not.toHaveProperty("idfa");
  });

  it("o status ATUAL do nativo vence o guardado (revogou nos Ajustes)", () => {
    const c = montarCorpoAparelho({ plataforma: "ios", attNativo: "denied", attGuardado: "authorized", idfa: IDFA });
    expect(c?.att).toBe("denied");
    expect(c).not.toHaveProperty("idfa");
  });

  it("build sem o campo att: usa o guardado; sem nada vira unknown (sem IDFA)", () => {
    expect(montarCorpoAparelho({ plataforma: "ios", attGuardado: "authorized", idfa: IDFA })?.idfa).toBe(IDFA);
    const sem = montarCorpoAparelho({ plataforma: "ios", idfa: IDFA });
    expect(sem).toEqual({ plataforma: "ios", att: "unknown" });
  });

  it("status estranho do nativo não cai no guardado: unknown, sem IDFA", () => {
    const c = montarCorpoAparelho({ plataforma: "ios", attNativo: "talvez", attGuardado: "authorized", idfa: IDFA });
    expect(c).toEqual({ plataforma: "ios", att: "unknown" });
  });

  it("IDFA zerado ou malformado não sai nem com aceite", () => {
    expect(montarCorpoAparelho({ plataforma: "ios", attNativo: "authorized", idfa: "00000000-0000-0000-0000-000000000000" })).not.toHaveProperty("idfa");
    expect(montarCorpoAparelho({ plataforma: "ios", attNativo: "authorized", idfa: "abc" })).not.toHaveProperty("idfa");
    expect(montarCorpoAparelho({ plataforma: "ios", attNativo: "authorized", idfa: "" })).not.toHaveProperty("idfa");
  });

  it.each(["android", "web"])("%s: sem corpo (o sync segue como era)", (plataforma) => {
    expect(montarCorpoAparelho({ plataforma, attNativo: "authorized", idfa: IDFA })).toBeNull();
  });

  it("nunca põe IP nem user-agent no corpo", () => {
    const c = montarCorpoAparelho({ plataforma: "ios", attNativo: "authorized", idfa: IDFA, appVersao: "1.0.17" }) as unknown as Record<string, unknown>;
    expect(Object.keys(c).sort()).toEqual(["app_versao", "att", "idfa", "plataforma"]);
  });
});

describe("versaoDoIosNoUA", () => {
  it("lê a versão do iOS do UA do WebView", () => {
    expect(versaoDoIosNoUA("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")).toBe("18.6.2");
    expect(versaoDoIosNoUA("Mozilla/5.0 (Linux; Android 14)")).toBe("");
  });
});

describe("lerCorpoAparelho — plugin", () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock("@capacitor/core"); vi.doUnmock("@/lib/native-shell"); });

  const carregar = async (plataforma: string, resposta: unknown) => {
    vi.resetModules();
    vi.doMock("@/lib/native-shell", async (orig) => ({ ...(await orig<object>()), plataformaApp: () => plataforma, isNativeShell: () => plataforma !== "web" }));
    const idPublicidade = vi.fn().mockResolvedValue(resposta);
    vi.doMock("@capacitor/core", async (orig) => ({ ...(await orig<object>()), registerPlugin: () => ({ idPublicidade }) }));
    const m = await import("./meta-dados-aparelho");
    return { m, idPublicidade };
  };

  it("iPhone autorizado: IDFA do plugin entra", async () => {
    const { m } = await carregar("ios", { gaid: IDFA, anonId: "x", att: "authorized" });
    const c = await m.lerCorpoAparelho();
    expect(c?.att).toBe("authorized");
    expect(c?.idfa).toBe(IDFA);
  });

  it("iPhone negado: só o status", async () => {
    const { m } = await carregar("ios", { gaid: "", anonId: "x", att: "denied" });
    const c = await m.lerCorpoAparelho();
    expect(c?.att).toBe("denied");
    expect(c).not.toHaveProperty("idfa");
  });

  it("Android: nem chama o plugin", async () => {
    const { m, idPublicidade } = await carregar("android", { gaid: "g", att: "authorized" });
    expect(await m.lerCorpoAparelho()).toBeNull();
    expect(idPublicidade).not.toHaveBeenCalled();
  });
});
