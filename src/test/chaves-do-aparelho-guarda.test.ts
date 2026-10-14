/**
 * GUARDA DAS CHAVES DO APARELHO (14/10).
 *
 * As vassouras do cache (abertura do app, logout, troca de conta) apagam do localStorage tudo
 * que começa com u:/finance-/home-/core-/life-/module-/daily-/offline-/nudge-. Chave gravada
 * DIRETO no localStorage com um desses prefixos e esquecida da lista do aparelho some a cada
 * abertura — foi assim que o tour da Home e os cartões dos módulos voltavam toda vez (1.0.14).
 *
 * Este teste varre o código (fs) e falha se achar uma chave dessas que não esteja classificada
 * em src/lib/chaves-do-aparelho.ts: do APARELHO (fica) ou da CONTA/transitória (pode sair).
 *
 * O que conta como "gravada direto":
 *  A) qualquer texto com prefixo varrido num arquivo que mexe no localStorage — inclusive
 *     constantes importadas de outro arquivo (`CHAVE_DIA_100_VISTO` vem do DayScoreRing);
 *  B) em QUALQUER arquivo, o 1º argumento de getItem/setItem/removeItem e dos ajudantes
 *     (`ls.get/set/del`, guardarChave/lerChave, lerNumero…), literal ou constante.
 * Template (`core-cartoes-vistos-${id}`) vira a família "core-cartoes-vistos-*".
 * `u:<id>:…` é o cache da conta por construção e fica de fora.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CHAVES_DO_APARELHO,
  CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS,
  PREFIXOS_DO_APARELHO,
  PREFIXOS_VARRIDOS,
  ehChaveDoAparelho,
  vassouraLeva,
} from "@/lib/chaves-do-aparelho";

const SRC = path.resolve(__dirname, "..");
const PREFIXOS_SEM_U: string[] = PREFIXOS_VARRIDOS.filter((p) => p !== "u:");
const ALT = PREFIXOS_SEM_U.map((p) => p.replace(/[-]/g, "\\-")).join("|");
/** "core-xyz" / 'core-xyz' / `core-xyz${…}` → core-xyz | core-xyz* */
const LITERAL = new RegExp(`(["'\`])((?:${ALT})[^"'\`$\\s]*)(\\$\\{)?`, "g");
/** sessionStorage fica de fora: a vassoura só mexe no localStorage. */
const CHAMADA_DE_STORAGE =
  /(?<!sessionStorage\.)\b(?:getItem|setItem|removeItem|safeGetItem|safeSetItem|safeRemoveItem|guardarChave|lerChave|idadeDaChave|lerNumero|lerNum|gravar|ls\.(?:get|set|del|remove))\(\s*(?:(["'`])((?:[^"'`$\s])*)(\$\{)?|([A-Za-z_$][\w$]*))/g;

/** Tira comentários (o "core-…" citado em comentário não é chave). */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

type Arquivos = Record<string, string>;

const constantesDe = (texto: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of texto.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(["'`])([^"'`$]*)(\$\{)?/g)) {
    out[m[1]] = m[3] + (m[4] ? "*" : "");
  }
  return out;
};

const resolverModulo = (arquivos: Arquivos, raiz: string, de: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? path.join(raiz, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(de), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (arquivos[c] !== undefined) return c;
  }
  return null;
};

const ehVarrida = (k: string) => PREFIXOS_SEM_U.some((p) => k.startsWith(p)) && !PREFIXOS_SEM_U.includes(k.replace(/\*$/, ""));

/** Chave → arquivos onde aparece como chave gravada direto no localStorage. */
function chavesGravadasDireto(arquivos: Arquivos, raiz: string): Map<string, Set<string>> {
  const limpos: Arquivos = {};
  const consts: Record<string, Record<string, string>> = {};
  for (const [f, t] of Object.entries(arquivos)) {
    limpos[f] = semComentarios(t);
    consts[f] = constantesDe(limpos[f]);
  }
  const achadas = new Map<string, Set<string>>();
  const anotar = (k: string, f: string) => {
    if (!ehVarrida(k)) return;
    if (!achadas.has(k)) achadas.set(k, new Set());
    achadas.get(k)!.add(path.relative(raiz, f));
  };
  for (const [f, t] of Object.entries(limpos)) {
    // nome importado → valor da constante no módulo de origem
    const importadas: Record<string, string> = {};
    for (const m of t.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      const alvo = resolverModulo(limpos, raiz, f, m[2]);
      if (!alvo) continue;
      for (const pedaco of m[1].split(",")) {
        const [orig, apelido] = pedaco.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        if (orig && consts[alvo][orig] !== undefined) importadas[(apelido ?? orig).trim()] = consts[alvo][orig];
      }
    }
    const valorDe = (nome: string) => consts[f][nome] ?? importadas[nome];

    // B) 1º argumento das chamadas de storage, em qualquer arquivo
    for (const m of t.matchAll(CHAMADA_DE_STORAGE)) {
      if (m[2] !== undefined) anotar(m[2] + (m[3] ? "*" : ""), f);
      else if (m[4]) { const v = valorDe(m[4]); if (v) anotar(v, f); }
    }
    // A) arquivo que mexe no localStorage: todo texto com prefixo varrido + constantes importadas
    if (!/\blocalStorage\b/.test(t)) continue;
    for (const m of t.matchAll(LITERAL)) anotar(m[2] + (m[3] ? "*" : ""), f);
    for (const v of Object.values(importadas)) anotar(v, f);
  }
  return achadas;
}

const REVISADAS = new Set(Object.values(CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS).flat());

/** A chave tem dono? (do aparelho, ou revisada como da conta/transitória) */
function classificada(k: string): boolean {
  if (REVISADAS.has(k)) return true; // família "x-*" só casa com o mesmo template
  if (k.endsWith("*")) {
    const base = k.slice(0, -1);
    return PREFIXOS_DO_APARELHO.some((p) => base.startsWith(p));
  }
  return ehChaveDoAparelho(k);
}

const lerFontes = (): Arquivos => {
  const walk = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const fora = path.join(SRC, "lib", "chaves-do-aparelho.ts");
  return Object.fromEntries(
    walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.d\.ts$|\.test\.|[\\/]test[\\/]/.test(f) && f !== fora)
      .map((f) => [f, fs.readFileSync(f, "utf8")]),
  );
};

describe("guarda das chaves do aparelho", () => {
  it("toda chave gravada direto no localStorage com prefixo varrido está classificada (aparelho × conta)", () => {
    const achadas = chavesGravadasDireto(lerFontes(), SRC);
    // sanidade: o varredor enxerga as chaves que motivaram a guarda
    expect([...achadas.keys()]).toEqual(expect.arrayContaining(["core-home-tour-done", "core-cartoes-vistos-*", "core-dia-100-visto", "core-cartoes-dica-deslizar"]));
    const soltas = [...achadas].filter(([k]) => !classificada(k));
    const mensagem = soltas
      .map(([k, fs_]) =>
        `Chave "${k}" (em ${[...fs_].join(", ")}) é gravada direto no localStorage com um prefixo que a vassoura do cache apaga ` +
        `em TODA abertura do app e no logout, mas não está classificada. Classifique em src/lib/chaves-do-aparelho.ts: ` +
        `do aparelho (CHAVES_DO_APARELHO / PREFIXOS_DO_APARELHO — "já vi", contadores, braços de A/B: sobrevive) ` +
        `ou da conta/transitória (CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS — sincronizada no user_data ou descartável: a vassoura pode apagar).`)
      .join("\n");
    expect(soltas.length, mensagem).toBe(0);
  });

  it("nenhuma chave está nas duas listas ao mesmo tempo", () => {
    const nasDuas = [...REVISADAS].filter((k) => !k.endsWith("*") && ehChaveDoAparelho(k));
    expect(nasDuas, `Chave(s) ${nasDuas.join(", ")} estão como do aparelho E como da conta/transitória — escolha uma.`).toEqual([]);
  });

  it("o varredor pega constante, constante importada, template e ajudante ls.*; ignora comentário", () => {
    const raiz = "/r/src";
    const achadas = chavesGravadasDireto({
      "/r/src/lib/a.ts": [
        `export const CHAVE_TOUR_FEITO = "core-home-tour-done";`,
        `export const CHAVE_IMPORTADA = "core-nova-importada";`,
        `const ls = { get: (k: string) => localStorage.getItem(k) };`,
        `export const lido = () => ls.get(CHAVE_TOUR_FEITO);`,
        `export const fam = (id: string) => localStorage.setItem(\`core-familia-\${id}\`, "1");`,
        `// "core-so-no-comentario" não conta`,
      ].join("\n"),
      "/r/src/b.tsx": [
        `import { CHAVE_IMPORTADA } from "@/lib/a";`,
        `export const x = () => localStorage.getItem(CHAVE_IMPORTADA);`,
      ].join("\n"),
      "/r/src/c.tsx": [
        `import { guardarChave } from "@/lib/retomada";`,
        `export const y = () => guardarChave("core-sem-localstorage-no-arquivo", 1);`,
        `export const z = () => get("core-da-conta-via-useUserData", null);`,
      ].join("\n"),
    }, raiz);
    expect([...achadas.keys()].sort()).toEqual(
      ["core-familia-*", "core-home-tour-done", "core-nova-importada", "core-sem-localstorage-no-arquivo"].sort(),
    );
    expect(classificada("core-home-tour-done")).toBe(true);
    expect(classificada("core-familia-*")).toBe(false);
    expect(classificada("core-cartoes-vistos-*")).toBe(true);
  });

  it("a vassoura leva o que é da conta e deixa o que é do aparelho", () => {
    for (const k of CHAVES_DO_APARELHO) expect(vassouraLeva(k), k).toBe(false);
    expect(vassouraLeva("core-cartoes-vistos-treino")).toBe(false);
    for (const k of ["u:abc:finance-expenses", "finance-expenses", "core-dieta-log", "home-x", "nudge-y", "core-teste-inicio"]) {
      expect(vassouraLeva(k), k).toBe(true);
    }
    expect(vassouraLeva("guest:finance-expenses")).toBe(false);
    expect(vassouraLeva("missao-doses")).toBe(false);
  });
});
