/**
 * 01/11 (dono): "na web, quem tá com a home nova vê o conquistas antigo ainda, com o planner — tem que ser tudo novo".
 * No site, Conquistas novas = Home nova; a Home de sempre segue com as de sempre. O app das lojas não muda.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));

import { conquistas2Ligada, CONQUISTAS2_WEB } from "@/lib/conquistas2";
import { guardarForcaHomeNova } from "@/lib/home-nova";

afterEach(() => { nativo.v = false; localStorage.clear(); });

describe("Conquistas no site acompanham a Home", () => {
  it("Home nova no site → Conquistas novas", () => {
    expect(CONQUISTAS2_WEB).toBe("off");
    guardarForcaHomeNova("?home-nova=on");
    expect(conquistas2Ligada()).toBe(true);
  });
  it("Home de sempre no site → Conquistas de sempre", () => {
    guardarForcaHomeNova("?home-nova=off");
    expect(conquistas2Ligada()).toBe(false);
  });
  it("app das lojas: segue a constante do app (ligada), seja qual for a Home", () => {
    nativo.v = true;
    guardarForcaHomeNova("?home-nova=off");
    expect(conquistas2Ligada()).toBe(true);
  });
});
