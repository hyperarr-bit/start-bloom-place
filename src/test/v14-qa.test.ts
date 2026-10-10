/**
 * A BUILD DE QA DA 1.0.14 (lib/v14-qa): `VITE_V14_QA=1` liga TODAS as chaves da versão só
 * nessa build; sem a env, nada muda (é o que esta suíte trava). A força de QA pelo link
 * continua mandando por cima da env (o dono consegue desligar uma coisa na build de QA).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { v14Qa } from "@/lib/v14-qa";
import { CARTOES_MODULO, MODULO_OCULTA_PENDENCIAS, TOUR_HOME, CHAVE_FORCA_TOUR_HOME, cartoesLigados, moduloOcultaPendenciasLigado, tourHomeLigado } from "@/lib/tour-home";
import { OFERTA_MENSAL_19, OFERTA_X_PAYWALL, PAYWALL_CURTO, PAYWALL_ENXUTO, PAYWALL_TEXTOS, PLANO_CADEADO, RECUPERACAO_PAYWALL, SAIDA_TESTE_ESCADA, guardarForcaDasOfertas, ofertaLigada, type NomeDaOferta } from "@/lib/ofertas-saida";
import { ONBOARDING_1TELA, onboarding1TelaLigado } from "@/lib/onboarding-1tela";
import { DIA1_CHEIO, bracoDia1, dia1CheioLigado, guardarForcaDia1Cheio, modoDia1Cheio } from "@/lib/dia1-cheio";
import { COBRANCA_V14, cobrancaV14Ligada } from "@/lib/cobranca-recusada";
import { AVALIACAO_V14, avaliacaoV14Ligada } from "@/lib/avaliacao-v14";
import { FUNIL_CALAI, funilCalaiLigado, guardarForcaFunilCalai } from "@/lib/funil-calai";

const OFERTAS: NomeDaOferta[] = ["x_paywall", "mensal_19", "escada", "textos", "enxuto", "recuperacao", "curto", "cadeado"];
const shell = (ligado: boolean) => {
  if (ligado) (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};

beforeEach(() => { localStorage.clear(); shell(false); });
afterEach(() => { vi.unstubAllEnvs(); shell(false); });

describe("sem a env: a build de LOJA", () => {
  it("todas as constantes nascem desligadas e nenhuma lib responde 'ligado'", () => {
    expect(v14Qa()).toBe(false);
    expect([CARTOES_MODULO, TOUR_HOME, MODULO_OCULTA_PENDENCIAS]).toEqual(["off", "off", "off"]);
    expect([OFERTA_X_PAYWALL, OFERTA_MENSAL_19, SAIDA_TESTE_ESCADA, PAYWALL_TEXTOS, PAYWALL_ENXUTO, RECUPERACAO_PAYWALL, PAYWALL_CURTO, PLANO_CADEADO]).toEqual(["off", "off", "off", "off", "off", "off", "off", "off"]);
    expect(ONBOARDING_1TELA).toBe("off");
    expect(DIA1_CHEIO).toBe("off");
    expect(COBRANCA_V14).toBe("off");
    expect(AVALIACAO_V14).toBe("off");
    expect(FUNIL_CALAI).toBe("off");
    for (const nativo of [false, true]) {
      shell(nativo);
      expect(cartoesLigados()).toBe(false);
      expect(tourHomeLigado()).toBe(false);
      expect(moduloOcultaPendenciasLigado()).toBe(false);
      for (const n of OFERTAS) expect(ofertaLigada(n), n).toBe(false);
      expect(onboarding1TelaLigado()).toBe(false);
      expect(dia1CheioLigado()).toBe(false);
      expect(modoDia1Cheio()).toBe("off");
      expect(bracoDia1()).toBeNull();
      expect(cobrancaV14Ligada()).toBe(false);
      expect(avaliacaoV14Ligada()).toBe(false);
      expect(funilCalaiLigado()).toBe(false);
    }
  });
});

describe("VITE_V14_QA=1: a build de QA", () => {
  beforeEach(() => vi.stubEnv("VITE_V14_QA", "1"));

  it("liga tudo — no navegador e no app das lojas; dia 1 cheio vale 'on' (todo mundo no B, sem sorteio)", () => {
    expect(v14Qa()).toBe(true);
    for (const nativo of [false, true]) {
      shell(nativo);
      expect(cartoesLigados()).toBe(true);
      expect(tourHomeLigado()).toBe(true);
      expect(moduloOcultaPendenciasLigado()).toBe(true);
      for (const n of OFERTAS) expect(ofertaLigada(n), n).toBe(true);
      expect(onboarding1TelaLigado()).toBe(true);
      expect(dia1CheioLigado()).toBe(true);
      expect(modoDia1Cheio()).toBe("on");
      expect(bracoDia1()).toBe("B");
      expect(localStorage.getItem("core-dia1-braco")).toBeNull();
      expect(cobrancaV14Ligada()).toBe(true);
      expect(avaliacaoV14Ligada()).toBe(true);
      expect(funilCalaiLigado()).toBe(true);
    }
  });

  it("a força do link ainda manda por cima da env (desligar uma coisa na build de QA)", () => {
    guardarForcaDasOfertas("?ofertas-saida=off");
    expect(ofertaLigada("textos")).toBe(false);
    expect(ofertaLigada("enxuto")).toBe(false);
    guardarForcaDasOfertas("?ofertas-saida=auto");
    expect(ofertaLigada("textos")).toBe(true);
    localStorage.setItem(CHAVE_FORCA_TOUR_HOME, "off");
    expect(tourHomeLigado()).toBe(false);
    guardarForcaDia1Cheio("?dia1-cheio=ab");
    expect(modoDia1Cheio()).toBe("ab");
    guardarForcaDia1Cheio("?dia1-cheio=off");
    expect(dia1CheioLigado()).toBe(false);
    guardarForcaFunilCalai("?funil-calai=off");
    expect(funilCalaiLigado()).toBe(false);
    guardarForcaFunilCalai("?funil-calai=auto");
    expect(funilCalaiLigado()).toBe(true);
  });

  it("qualquer outro valor da env é desligado", () => {
    vi.stubEnv("VITE_V14_QA", "true");
    expect(v14Qa()).toBe(false);
    expect(cartoesLigados()).toBe(false);
    vi.stubEnv("VITE_V14_QA", "0");
    expect(v14Qa()).toBe(false);
  });
});
