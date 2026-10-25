/**
 * 1.0.19 — a CHAVE REMOTA `home_nova` (lib/home-nova): off | admin | on | ab, no padrão de dias23 / sino_paywall.
 *   · a leitura da metadata (a `current` vence; ausente/lixo = off);
 *   · a decisão: força de QA > remoto > última resposta do aparelho > off; "admin" só com admin; "ab" pelo braço;
 *   · o sorteio: determinístico pelo id do aparelho, com SAL próprio (não compartilha braço com o sino), estável;
 *   · os campos dos eventos (`home_nova: nova|atual`) só com a chave em modo ≠ off;
 *   · as chaves novas são do aparelho (nenhuma vassoura leva).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  CHAVE_ADMIN_HOME_NOVA, CHAVE_BRACO_HOME_NOVA, CHAVE_FOGO_ACESO_HOME_NOVA, CHAVE_FORCA_HOME_NOVA, CHAVE_HOME_NOVA_APARELHO,
  _zerarHomeNova, bracoHomeNova, camposHomeNova, guardarAdmin, guardarForcaHomeNova, homeNovaLigada, homeNovaLigadaSincrona, homeNovaPrecisaDeAdmin,
  informarAdminHomeNova, lerAdminGuardado, lerHomeNovaRemoto, modoHomeNova, registrarHomeNovaRemoto, sortearBracoHomeNova,
} from "@/lib/home-nova";
import { sortearBracoSino } from "@/lib/sino-paywall";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";

const offerings = (current: Record<string, unknown> | null, outras: Record<string, Record<string, unknown>> = {}) => {
  const cur = current ? { metadata: current } : null;
  const all: Record<string, unknown> = { ...Object.fromEntries(Object.entries(outras).map(([k, m]) => [k, { metadata: m }])) };
  if (cur) all.current = cur;
  return { current: cur, all };
};

beforeEach(() => { localStorage.clear(); _zerarHomeNova(); });

describe("home_nova — leitura da metadata", () => {
  it("ausente, lixo ou RevenueCat sem resposta = off", () => {
    expect(lerHomeNovaRemoto(null)).toBe("off");
    expect(lerHomeNovaRemoto({})).toBe("off");
    expect(lerHomeNovaRemoto(offerings({}))).toBe("off");
    expect(lerHomeNovaRemoto(offerings({ home_nova: "talvez" }))).toBe("off");
    expect(lerHomeNovaRemoto(offerings({ home_nova: 1 }))).toBe("off");
  });
  it("lê os quatro valores (maiúsculas e espaços não atrapalham)", () => {
    for (const v of ["off", "admin", "on", "ab"]) expect(lerHomeNovaRemoto(offerings({ home_nova: ` ${v.toUpperCase()} ` }))).toBe(v);
  });
  it("a offering current vence as outras; sem current, a outra vale", () => {
    expect(lerHomeNovaRemoto(offerings({ home_nova: "admin" }, { velha: { home_nova: "on" } }))).toBe("admin");
    expect(lerHomeNovaRemoto(offerings({}, { velha: { home_nova: "ab" } }))).toBe("ab");
  });
  it("registrar guarda no aparelho e vale na abertura seguinte (sem resposta nova)", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "admin" }));
    expect(modoHomeNova()).toBe("admin");
    expect(localStorage.getItem(CHAVE_HOME_NOVA_APARELHO)).toBe("admin");
    _zerarHomeNova(); // outra abertura, RevenueCat ainda não respondeu
    expect(modoHomeNova()).toBe("admin");
    registrarHomeNovaRemoto("lixo"); // metadata estranha não derruba o que estava
    expect(modoHomeNova()).toBe("admin");
  });
});

describe("home_nova — a decisão", () => {
  it("off (padrão): desligada pra todo mundo, admin inclusive", () => {
    expect(homeNovaLigada(true)).toBe(false);
    expect(homeNovaLigada(null)).toBe(false);
    expect(homeNovaPrecisaDeAdmin()).toBe(false);
  });
  it("on: ligada pra todos", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "on" }));
    expect(homeNovaLigada(false)).toBe(true);
    expect(homeNovaLigada(null)).toBe(true);
  });
  it("admin: só com a checagem de admin positiva; sem resposta ainda, desligada", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "admin" }));
    expect(homeNovaPrecisaDeAdmin()).toBe(true);
    expect(homeNovaLigada(true)).toBe(true);
    expect(homeNovaLigada(false)).toBe(false);
    expect(homeNovaLigada(null)).toBe(false);
  });
  it("admin: a resposta guardada pra conta vale na abertura seguinte (e é por conta)", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "admin" }));
    guardarAdmin("dono", true);
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBe("dono:1");
    expect(lerAdminGuardado("dono")).toBe(true);
    expect(lerAdminGuardado("outra")).toBeNull();
    _zerarHomeNova();
    expect(homeNovaLigadaSincrona("dono")).toBe(true);
    expect(homeNovaLigadaSincrona("outra")).toBe(false);
    guardarAdmin("dono", false);
    expect(homeNovaLigadaSincrona("dono")).toBe(false);
  });
  it("ab: o braço decide, e fica gravado no aparelho", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "ab" }));
    const braco = bracoHomeNova();
    expect(["nova", "atual"]).toContain(braco);
    expect(localStorage.getItem(CHAVE_BRACO_HOME_NOVA)).toBe(braco);
    expect(homeNovaLigada(null)).toBe(braco === "nova");
    // gravado manda, mesmo que o id mude
    localStorage.setItem(CHAVE_BRACO_HOME_NOVA, "atual");
    expect(homeNovaLigada(true)).toBe(false);
    localStorage.setItem(CHAVE_BRACO_HOME_NOVA, "nova");
    expect(homeNovaLigada(false)).toBe(true);
  });
  it("força de QA (?home-nova=on|off) passa por cima de tudo; auto desfaz", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "admin" }));
    guardarForcaHomeNova("?home-nova=on");
    expect(localStorage.getItem(CHAVE_FORCA_HOME_NOVA)).toBe("on");
    expect(homeNovaLigada(false)).toBe(true);
    expect(homeNovaPrecisaDeAdmin()).toBe(false);
    guardarForcaHomeNova("?home-nova=off");
    registrarHomeNovaRemoto(offerings({ home_nova: "on" }));
    expect(homeNovaLigada(true)).toBe(false);
    guardarForcaHomeNova("?home-nova=auto");
    expect(localStorage.getItem(CHAVE_FORCA_HOME_NOVA)).toBeNull();
    expect(homeNovaLigada(null)).toBe(true);
    guardarForcaHomeNova("?home-nova=qualquer"); // valor estranho: nada muda
    expect(localStorage.getItem(CHAVE_FORCA_HOME_NOVA)).toBeNull();
  });
});

describe("home_nova — o sorteio", () => {
  it("é determinístico, 50/50 em volume, e não compartilha braço com o sino", () => {
    expect(sortearBracoHomeNova("abc")).toBe(sortearBracoHomeNova("abc"));
    let nova = 0, iguaisAoSino = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const id = `aparelho-${i}-${(i * 7919) % 1000}`;
      const b = sortearBracoHomeNova(id);
      if (b === "nova") nova++;
      if ((b === "nova") === (sortearBracoSino(id) === "com")) iguaisAoSino++;
    }
    expect(nova / N).toBeGreaterThan(0.45);
    expect(nova / N).toBeLessThan(0.55);
    // sal próprio: cerca de metade dos aparelhos cai em braços "diferentes" dos do sino — nunca os mesmos sempre
    expect(iguaisAoSino / N).toBeGreaterThan(0.4);
    expect(iguaisAoSino / N).toBeLessThan(0.6);
  });
});

describe("home_nova — os campos dos eventos", () => {
  it("off: nenhum campo; on: nova; admin sem admin: atual; ab: o braço", () => {
    expect(camposHomeNova("u")).toEqual({});
    registrarHomeNovaRemoto(offerings({ home_nova: "on" }));
    expect(camposHomeNova("u")).toEqual({ home_nova: "nova" });
    registrarHomeNovaRemoto(offerings({ home_nova: "admin" }));
    expect(camposHomeNova("u")).toEqual({ home_nova: "atual" });
    informarAdminHomeNova(true);
    expect(camposHomeNova("u")).toEqual({ home_nova: "nova" });
    registrarHomeNovaRemoto(offerings({ home_nova: "ab" }));
    localStorage.setItem(CHAVE_BRACO_HOME_NOVA, "atual");
    expect(camposHomeNova("u")).toEqual({ home_nova: "atual" });
  });
});

describe("home_nova — as chaves do aparelho", () => {
  it("são do aparelho e nenhuma vassoura leva", () => {
    for (const k of [CHAVE_HOME_NOVA_APARELHO, CHAVE_BRACO_HOME_NOVA, CHAVE_ADMIN_HOME_NOVA, CHAVE_FOGO_ACESO_HOME_NOVA]) {
      expect(ehChaveDoAparelho(k), k).toBe(true);
      expect(vassouraLeva(k), k).toBe(false);
    }
    // a força de QA também sobrevive ao boot (o prefixo "home-" é varrido — "home-nova-force" morria na 1ª abertura)
    expect(vassouraLeva(CHAVE_FORCA_HOME_NOVA)).toBe(false);
  });
});
