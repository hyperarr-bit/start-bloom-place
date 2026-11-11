/**
 * BUG versao-missao (07/11). Os eventos da missão em doses levam `versao` — é por ela que as consultas separam a
 * turma de uma build da outra. Mas o campo lia `__APP_VERSION__`, que é a versão do build.gradle (Android): no
 * iPhone todo evento saía com "1.0.133 (134)" em vez de "1.0.24 (55)". Agora é `versaoVisivel()` (a mesma do
 * "Meu acesso", QA 1.0.18): no iPhone a do project.pbxproj (__APP_VERSION_IOS__); Android e web sem mudança.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eventoDaMissao } from "@/lib/missao-doses";

const g = globalThis as unknown as { __APP_VERSION__?: string; __APP_VERSION_IOS__?: string };
const w = window as unknown as { Capacitor?: unknown };
const shell = (plataforma: "ios" | "android" | "web") => {
  w.Capacitor = { isNativePlatform: () => plataforma !== "web", getPlatform: () => plataforma };
};

beforeEach(() => { localStorage.clear(); g.__APP_VERSION__ = "1.0.133 (134)"; g.__APP_VERSION_IOS__ = "1.0.24 (55)"; });
afterEach(() => { delete w.Capacitor; delete g.__APP_VERSION__; delete g.__APP_VERSION_IOS__; });

describe("versão nos eventos da missão", () => {
  it("iPhone: leva a versão do iPhone, não a do Android", () => {
    shell("ios");
    expect(eventoDaMissao({ dia: 1 })).toEqual({ dia: 1, prototipo: "app", plataforma: "ios", versao: "1.0.24 (55)" });
  });
  it("Android: segue a do build.gradle, como sempre", () => {
    shell("android");
    expect(eventoDaMissao({ dia: 1 })).toEqual({ dia: 1, prototipo: "app", plataforma: "android", versao: "1.0.133 (134)" });
  });
  it("web: sem versão, como sempre", () => {
    shell("web");
    expect(eventoDaMissao({ dia: 1 })).toEqual({ dia: 1, prototipo: "web" });
  });
  it("sem a constante do iPhone (fora do Vite): 'dev', nunca a do Android", () => {
    shell("ios");
    delete g.__APP_VERSION_IOS__;
    expect(eventoDaMissao({}).versao).toBe("dev");
  });
});
