/**
 * Tela do Pix "enxuta" (02/11, dono: "sim" à versão A+ enxuta da avaliação conceito-0-amais): as 2 respostas de quem vai ao
 * banco e volta sem pagar (~27%) SEM a tela crescer — a garantia vai na linha do preço (o "pagamento único" já está na faixa
 * preta), e "No banco, o CORE aparece como NATALIA…" vai na coluna ao lado do QR (que tinha espaço). + o preço sem quebrar
 * ("R$ / 27,90" em 390 e 375). Só no braço atual da página; o v2 não muda.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NOME_NO_BANCO } from "@/landing/regras";
import { EMPRESA } from "@/lib/empresa";

const raiz = resolve(__dirname, "../..");
const SRC = readFileSync(resolve(raiz, "src/landing/landing.ts"), "utf8");
const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");

describe("tela do Pix enxuta", () => {
  it("o nome no banco é a razão social da empresa", () => {
    expect(NOME_NO_BANCO).toBe(EMPRESA.razaoSocial);
  });
  it("ao lado do QR: a dica curta + 'No banco, o CORE aparece como …'", () => {
    expect(SRC).toContain('"Ou leia o <b>QR code</b> com a câmera do banco."');
    expect(SRC).toContain('<span class="lp-qr-nome">No banco, o CORE aparece como <b>${esc(NOME_NO_BANCO)}</b>.</span>');
  });
  it("a linha do preço do vitalício diz a garantia, e o preço não quebra", () => {
    expect(SRC).toContain('"Pra sempre · 7 dias de garantia"');
    expect(HTML).toContain(".lp-pix-valor b { font-size: 26px; font-weight: 850; letter-spacing: -.03em; white-space: nowrap; }");
  });
});
