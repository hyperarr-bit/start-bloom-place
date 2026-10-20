/**
 * 1.0.17 (dono, 20/10): UMA superfície de cobrança por abertura, e a do app ganha. A ponte pede ao nativo que a
 * folha do StoreKit espere a resposta do app (aguardarApp) e repassa o "segura/libera" do AvisoCobrancaRecusada.
 * Binário antigo sem o método: nada quebra.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const nativo = vi.hoisted(() => ({
  telaAtual: vi.fn(async () => {}),
  ativarFolhaDeCobranca: vi.fn(async () => ({ ativo: true, suportado: true })),
  segurarFolhaDeCobranca: vi.fn(async () => {}),
  addListener: vi.fn(async () => ({ remove: async () => {} })),
}));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => nativo }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { ligarPonteDaFolhaDeCobranca, segurarFolhaNativa } from "@/lib/cobranca-nativa";
import { CHAVE_FORCA_COBRANCA_V14 } from "@/lib/cobranca-recusada";

describe("folha do StoreKit × tela cheia do app", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(nativo).forEach((f) => f.mockClear());
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  });

  it("com a chave, o nativo começa SEGURANDO a folha até o app responder (aguardarApp)", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    await ligarPonteDaFolhaDeCobranca();
    expect(nativo.ativarFolhaDeCobranca).toHaveBeenCalledWith({ aguardarApp: true });
  });

  it("sem a chave, não observa a fila (o iOS mostra a folha dele — a reserva)", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "off");
    await ligarPonteDaFolhaDeCobranca();
    expect(nativo.ativarFolhaDeCobranca).not.toHaveBeenCalled();
  });

  it("segurarFolhaNativa repassa true/false; binário sem o método não lança", async () => {
    await segurarFolhaNativa(true);
    await segurarFolhaNativa(false);
    expect(nativo.segurarFolhaDeCobranca.mock.calls).toEqual([[{ segurar: true }], [{ segurar: false }]]);
    nativo.segurarFolhaDeCobranca.mockRejectedValueOnce(new Error('"CoreNativo" plugin is not implemented'));
    await expect(segurarFolhaNativa(true)).resolves.toBeUndefined();
  });

  it("fora do iPhone: nada", async () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    await segurarFolhaNativa(true);
    expect(nativo.segurarFolhaDeCobranca).not.toHaveBeenCalled();
  });
});
