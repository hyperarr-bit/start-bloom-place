/**
 * O CARIMBO DA ORIGEM (31/08).
 *
 * Este arquivo existe por causa de um número: em 31/08, 25% da receita do dia
 * ficou sem origem rastreável — e é esse número que decide qual campanha é
 * desligada. A causa foi medida, não suposta: o `install_referrer` dispara no
 * boot, antes de existir conta (0% dos 701 daquele dia tinham user_id), e o
 * funil W vende ANTES do cadastro. A ligação venda→anúncio dependia de casar
 * sessão (que se perde quando a pessoa fecha o app) ou GAID (que 3% dos
 * aparelhos não expõem).
 *
 * `vincularOrigem` fecha o buraco carimbando o referrer no usuário no login.
 * O que este teste protege:
 *   · carimba UMA vez por usuário (senão vira ruído a cada boot);
 *   · recarimba quando TROCA de usuário no mesmo aparelho;
 *   · emite mesmo SEM referrer guardado — "não sabemos" tem que ser
 *     distinguível de "instalou antes desta versão";
 *   · nunca derruba o login, nem quando o localStorage explode.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const enviados: { nome: string; dados: Record<string, unknown> }[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    from: () => ({ insert: (linha: Record<string, unknown>) => {
      enviados.push({ nome: String(linha.event_name), dados: (linha.event_data ?? {}) as Record<string, unknown> });
      return { then: (f: () => void) => { f(); return Promise.resolve(); } };
    } }),
  },
}));

import { vincularOrigem } from "@/lib/analytics";

const RAW = "core_install_referrer_raw";
const FLAG = "core_origem_vinculada";
const espera = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  enviados.length = 0;
});

describe("carimbo da origem no usuário", () => {
  it("leva o referrer bruto guardado — inclusive o payload cifrado da Meta", async () => {
    const bruto = 'utm_source=apps.instagram.com&utm_campaign=ig4a&utm_content={"app":1693551238598114,"source":{"data":"abc123"}}';
    localStorage.setItem(RAW, bruto);
    await vincularOrigem("user-1");
    await espera();
    const ev = enviados.find((e) => e.nome === "origem_usuario");
    expect(ev).toBeTruthy();
    expect(ev!.dados.referrer).toBe(bruto);
    expect(ev!.dados.tem_referrer).toBe(true);
  });

  it("carimba uma vez só por usuário — não repete a cada boot", async () => {
    localStorage.setItem(RAW, "utm_source=apps.instagram.com");
    await vincularOrigem("user-1");
    await vincularOrigem("user-1");
    await vincularOrigem("user-1");
    await espera();
    expect(enviados.filter((e) => e.nome === "origem_usuario")).toHaveLength(1);
  });

  it("recarimba quando outra conta entra no mesmo aparelho", async () => {
    localStorage.setItem(RAW, "utm_source=apps.instagram.com");
    await vincularOrigem("user-1");
    await vincularOrigem("user-2");
    await espera();
    expect(enviados.filter((e) => e.nome === "origem_usuario")).toHaveLength(2);
    expect(localStorage.getItem(FLAG)).toBe("user-2");
  });

  it("emite mesmo sem referrer guardado, marcando tem_referrer=false", async () => {
    await vincularOrigem("user-3");
    await espera();
    const ev = enviados.find((e) => e.nome === "origem_usuario");
    expect(ev).toBeTruthy();
    expect(ev!.dados.tem_referrer).toBe(false);
    expect(ev!.dados.referrer).toBe("");
  });

  it("ignora chamada sem usuário", async () => {
    await vincularOrigem("");
    await espera();
    expect(enviados).toHaveLength(0);
  });

  it("não derruba o login se o localStorage explodir", async () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error("SecurityError"); };
    await expect(vincularOrigem("user-4")).resolves.toBeUndefined();
    Storage.prototype.getItem = original;
  });
});
