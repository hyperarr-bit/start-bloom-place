import { describe, it, expect, vi, beforeEach } from "vitest";

const plat = { nativo: true, ios: true };
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plat.nativo,
  isIOS: () => plat.nativo && plat.ios,
}));

import { padraoHomeNova } from "@/lib/home-nova";
import { contaComoAnotacao } from "@/lib/sequencia";

describe("revisor 26/10: padrão da Home nova por plataforma", () => {
  beforeEach(() => { plat.nativo = true; plat.ios = true; });
  it("iPhone sem resposta do RevenueCat = novas+admin", () => expect(padraoHomeNova()).toBe("novas+admin"));
  it("Android sem resposta = off (sem QA da Home nova no Android ainda)", () => { plat.ios = false; expect(padraoHomeNova()).toBe("off"); });
  it("site = off", () => { plat.nativo = false; expect(padraoHomeNova()).toBe("off"); });
});

describe("revisor 26/10: preferências da Home nova não contam como dia anotado", () => {
  it.each(["core-home-resumos", "core-home-widgets-e"])("%s", (chave) => {
    expect(contaComoAnotacao(chave)).toBe(false);
  });
});
