/**
 * SEGURANÇA (21/10): segredo no bundle.
 *
 * `import.meta.env` usado como VALOR (ex.: `import.meta.env as Record<…>`) faz o Vite colar o objeto env INTEIRO no
 * JS público — todas as VITE_* do ambiente e dos .env. O build local do 1.0.17 (dist/ e ios/App/App/public) saiu com
 * VITE_PORTA_QA_EMAIL/SENHA (conta de QA) em texto puro por causa de revenuecat.ts e venda/conteudo.ts.
 * Conferido com build de verdade (variáveis falsas): depois da troca, 0 arquivos com o env e 0 com a senha.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { jsComEnvVazado } from "../../../scripts/env-vazado.mjs";

const RAIZ = resolve(__dirname, "../../..");

function arquivosDoApp(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== "test" && n !== "__snapshots__") arquivosDoApp(p, out); }
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && !n.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("o código do app só lê variável de ambiente PELO NOME", () => {
  it("nenhum arquivo de src usa import.meta.env como objeto", () => {
    const culpados: string[] = [];
    for (const p of arquivosDoApp(resolve(RAIZ, "src"))) {
      const s = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      if (/import\.meta\.env(?![.\w])/.test(s)) culpados.push(p.replace(RAIZ + "/", ""));
    }
    expect(culpados).toEqual([]);
  });
});

describe("a trava do preparar-loja (jsComEnvVazado)", () => {
  it("pega o env inteiro colado pelo Vite (o formato do build que vazou)", () => {
    expect(jsComEnvVazado('const e={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,VITE_X:"1"};')).toBe(true);
    expect(jsComEnvVazado('x={BASE_URL: "/", DEV: false, MODE: "production"}')).toBe(true);
  });
  it("pega nome de variável de QA / senha / admin", () => {
    expect(jsComEnvVazado('a.VITE_PORTA_QA_EMAIL')).toBe(true);
    expect(jsComEnvVazado('"VITE_ALGUMA_SENHA"')).toBe(true);
    expect(jsComEnvVazado('CORE_ADMIN_TOKEN')).toBe(true);
  });
  it("não acusa JS normal (inclusive o nome público das variáveis da Cakto)", () => {
    expect(jsComEnvVazado('const k="appl_abc";const c={VITE_VENDA_CAKTO_ANUAL:"x"};fetch("/rest/v1")')).toBe(false);
  });
  it("o preparar-loja chama a trava no build de produção e aborta", () => {
    const s = readFileSync(resolve(RAIZ, "scripts/preparar-loja.mjs"), "utf8");
    expect(s).toContain('import { jsComEnvVazado } from "./env-vazado.mjs"');
    const i = s.indexOf("jsComEnvVazado(readFileSync");
    expect(i).toBeGreaterThan(0);
    expect(s.slice(i, i + 600)).toContain("process.exit(1)");
  });
});

describe("cabeçalhos de segurança do site (vercel.json)", () => {
  const cfg = JSON.parse(readFileSync(resolve(RAIZ, "vercel.json"), "utf8")) as {
    headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    rewrites: unknown[];
  };
  const todos = cfg.headers?.find((h) => h.source === "/(.*)")?.headers ?? [];
  const valor = (k: string) => todos.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value;
  it("ninguém embute o site num iframe de fora (clickjacking no checkout/apagar conta)", () => {
    expect(valor("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(valor("Content-Security-Policy")).toMatch(/frame-ancestors 'self'/);
  });
  it("nosniff + referrer sem caminho/query pra outros domínios", () => {
    expect(valor("X-Content-Type-Options")).toBe("nosniff");
    expect(valor("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
  it("as rotas continuam as mesmas", () => {
    // 28/10: + /organizar → /landing.html (a landing nova, desligada por LANDING_NOVA; a página não carrega o app)
    expect(cfg.rewrites).toHaveLength(4);
    expect((cfg.rewrites as Array<{ source: string }>).map((r) => r.source)).toContain("/organizar");
  });
});
