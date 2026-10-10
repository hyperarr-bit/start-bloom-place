/**
 * FICHA DO APARELHO pros eventos (10/10, versão 1.0.14) — sem PostHog.
 *
 * Por que existe: nenhuma pergunta de retenção fecha hoje sem user_id. Quem
 * instala, abre, faz o funil e some antes de criar conta é invisível entre
 * sessões (a session_id morre com a aba; o aparelho não). Quem desloga e entra
 * de novo vira "outra pessoa". E "de qual versão veio este evento?" só a ficha
 * app_device_info (1× por boot) sabia — juntar por sessão é caro e furado.
 *
 * Toda chamada de trackEvent/trackEventBeacon passa a levar, SEM mexer no
 * payload de ninguém (só soma; o `data` do evento vence se repetir a chave):
 *   · device_id    uuid gerado no 1º boot, guardado em `core_device_id` (sublinhado,
 *                  de propósito: o signOut apaga as chaves `core-`, e esta tem que
 *                  sobreviver ao logout — é do aparelho, não da pessoa);
 *   · app_versao / app_build   do App.getInfo() (lido 1× por boot e guardado, pra
 *                  os eventos dos primeiros ms já saírem com a última versão vista);
 *   · plataforma   ios | android | web;
 *   · turma        data BRT da 1ª abertura neste aparelho (`core_turma`) — é a
 *                  coorte: "a turma de 12/10 ficou?";
 *   · att          estado do ATT no iPhone, se já lido (att-ios grava em
 *                  core-att-status). Só no iOS.
 *
 * O que NÃO vai: e-mail, nome, uid de ninguém. O device_id é aleatório e nosso —
 * não é IDFA/GAID, não sai do nosso banco.
 *
 * `app_primeira_abertura` sai UMA vez por aparelho (só no app das lojas): quando
 * a turma nasce. Em aparelho que já rodava o app antes desta versão o evento vai
 * com `nova: false` (e a turma é a 1ª data de uso que achamos, ou hoje) — pra
 * não contar a base antiga como instalação do dia da atualização.
 */
import { isNativeShell, plataformaApp } from "@/lib/native-shell";

export const CHAVE_DEVICE_ID = "core_device_id";
export const CHAVE_TURMA = "core_turma";
const CHAVE_VERSAO = "core_app_versao";
const CHAVE_ATT = "core-att-status"; // a mesma do att-ios.ts

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* modo privado: fica na memória */ } },
};

/* O heap sobrevive ao storage zerado (ver sessaoMemoria em analytics.ts) — a
 * cópia na memória garante o MESMO id dentro da sessão mesmo sem disco. */
let deviceIdMemoria: string | null = null;
let turmaMemoria: string | null = null;
let versaoMemoria: { app_versao: string; app_build: string } | null = null;

const uuid = (): string => {
  try { return crypto.randomUUID(); } catch { /* WebView velho */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** Data de hoje no fuso de Brasília (YYYY-MM-DD) — a turma é BRT, não a do aparelho. */
export const diaBRT = (d: Date = new Date()): string => {
  try {
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
    const s = `${p("year")}-${p("month")}-${p("day")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  } catch { /* Intl sem fuso: cai no local */ }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** O id deste aparelho — cria no 1º uso, estável entre sessões e logouts. */
export const deviceId = (): string => {
  if (typeof window === "undefined") return "ssr";
  let id = ls.get(CHAVE_DEVICE_ID);
  if (!id || !/^[0-9a-f-]{20,40}$/i.test(id)) {
    id = deviceIdMemoria ?? uuid();
    ls.set(CHAVE_DEVICE_ID, id);
  }
  deviceIdMemoria = id;
  return id;
};

/** Sinais de que o app JÁ rodava neste aparelho antes de existir a turma. */
const usoAnterior = (): { houve: boolean; primeiroDia: string | null } => {
  let primeiroDia: string | null = null;
  try {
    const dias = JSON.parse(localStorage.getItem("core-dias-de-uso") ?? "[]");
    if (Array.isArray(dias) && dias.length) primeiroDia = [...dias].filter((x) => typeof x === "string").sort()[0] ?? null;
  } catch { /* noop */ }
  if (primeiroDia) return { houve: true, primeiroDia };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("u:") || k.startsWith("sb-") || k === "core_utm" || k === "core_install_referrer_done" || k === "core-onboarding-done" || k === "core-user-name" || k === "core-welcome-done" || k === "core-dia2") {
        return { houve: true, primeiroDia: null };
      }
    }
  } catch { /* noop */ }
  return { houve: false, primeiroDia: null };
};

export type NascimentoDaTurma = { turma: string; nova: boolean; nasceuAgora: boolean };

/** A turma (data BRT da 1ª abertura). Cria se não existir e diz se acabou de nascer. */
export const turmaDoAparelho = (agora: Date = new Date()): NascimentoDaTurma => {
  if (typeof window === "undefined") return { turma: "", nova: false, nasceuAgora: false };
  const salva = ls.get(CHAVE_TURMA);
  if (salva && /^\d{4}-\d{2}-\d{2}$/.test(salva)) { turmaMemoria = salva; return { turma: salva, nova: false, nasceuAgora: false }; }
  if (turmaMemoria) { ls.set(CHAVE_TURMA, turmaMemoria); return { turma: turmaMemoria, nova: false, nasceuAgora: false }; }
  const antes = usoAnterior();
  const turma = antes.primeiroDia ?? diaBRT(agora);
  turmaMemoria = turma;
  ls.set(CHAVE_TURMA, turma);
  return { turma, nova: !antes.houve, nasceuAgora: true };
};

export const turma = (): string => turmaDoAparelho().turma;

const lerVersaoGuardada = (): { app_versao: string; app_build: string } | null => {
  try {
    const v = JSON.parse(ls.get(CHAVE_VERSAO) ?? "null");
    return v && typeof v.app_versao === "string" && typeof v.app_build === "string" ? v : null;
  } catch { return null; }
};

/** Versão/build do app, do App.getInfo(); na web, "web" + vazio. */
export const versaoDoApp = (): { app_versao: string; app_build: string } => {
  if (versaoMemoria) return versaoMemoria;
  if (!isNativeShell()) return { app_versao: "web", app_build: "" };
  return lerVersaoGuardada() ?? { app_versao: "", app_build: "" };
};

/** Lê a versão do plugin e guarda (1× por boot). Nunca lança. */
export async function carregarVersaoDoApp(): Promise<void> {
  if (!isNativeShell()) return;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    versaoMemoria = { app_versao: String(info.version ?? ""), app_build: String(info.build ?? "") };
    ls.set(CHAVE_VERSAO, JSON.stringify(versaoMemoria));
  } catch { /* sem plugin: fica a guardada */ }
}

/** As propriedades comuns de TODO evento. Só soma: o `data` do evento vence. */
export const propriedadesComuns = (): Record<string, unknown> => {
  if (typeof window === "undefined") return {};
  try {
    const plataforma = plataformaApp();
    const att = plataforma === "ios" ? ls.get(CHAVE_ATT) : null;
    return {
      device_id: deviceId(),
      ...versaoDoApp(),
      plataforma,
      turma: turma(),
      ...(att ? { att } : {}),
    };
  } catch {
    return {};
  }
};

/**
 * Boot: garante id e turma, carrega a versão e, no app das lojas, emite
 * `app_primeira_abertura` uma vez por aparelho. `emitir` é injetado pra não
 * importar o analytics daqui (ele importa este módulo).
 */
export async function iniciarFichaDoAparelho(emitir: (nome: string, dados: Record<string, unknown>) => void): Promise<void> {
  try {
    deviceId();
    const t = turmaDoAparelho();
    await carregarVersaoDoApp();
    if (t.nasceuAgora && isNativeShell()) emitir("app_primeira_abertura", { nova: t.nova });
  } catch { /* telemetria nunca derruba o app */ }
}
