/**
 * GUARDA DOS ATRIBUTOS DA MEDIÇÃO TOTAL (1.0.16).
 *
 * data-track, data-track-bloco, data-folha, data-camada-guia, data-card, data-tour e data-spotlight
 * entram na chave do `uso_resumo` SEM passar pela peneira — valem como "texto do código". Então o valor
 * deles nunca pode vir de dado da pessoa. Este teste lê cada .tsx (TypeScript, só leitura) e falha se
 * algum desses atributos receber algo que não seja: texto literal, ou template/condição montados só com
 * literais e IDs do código (`tab.id`, `item.tipo`, `o.key`…), ou uma das props revisadas abaixo.
 * As props repassadas (dataCard/card/testid/camada) têm as CHAMADAS conferidas do mesmo jeito.
 *
 * Valor novo que não passa aqui? Use um id do código (nunca nome/descrição/título digitado) e, se for
 * uma prop repassada, acrescente o componente em CHAMADAS_CONFERIDAS.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SRC = path.resolve(__dirname, "..");
const ATRIBUTOS = new Set(["data-track", "data-track-bloco", "data-folha", "data-camada-guia", "data-card", "data-tour", "data-spotlight"]);
/** Nome de propriedade que é ID do código (nunca texto da pessoa). */
const PROP_ID = /^(id|tipo|key|v|modulo|rar|spotlight)$/;
/** Identificadores revisados: props repassadas cujas chamadas são conferidas, ou estado com id do código. */
const IDENTIFICADORES_OK = new Set(["id", "rotulo", "activeAction", "testid", "dataCard", "card", "camada", "testId"]);
/** Componentes que repassam a prop pra um desses atributos: a CHAMADA também é conferida. */
const CHAMADAS_CONFERIDAS: Record<string, string[]> = { CartaoPet: ["dataCard"], Secao: ["card"], Casca: ["testid"] };

const listar = (dir: string, out: string[] = []): string[] => {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) { if (!/[\\/](test|dev)$/.test(p)) listar(p, out); }
    else if (nome.endsWith(".tsx") && !/\.test\./.test(nome)) out.push(p);
  }
  return out;
};

/** O valor só pode ser literal / id do código. Devolve o motivo quando não é. */
function problema(e: ts.Expression, sf: ts.SourceFile): string | null {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return null;
  if (ts.isIdentifier(e)) return e.text === "undefined" || IDENTIFICADORES_OK.has(e.text) ? null : `identificador "${e.text}"`;
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return problema(e.expression, sf);
  if (ts.isPropertyAccessExpression(e)) return PROP_ID.test(e.name.text) ? null : `propriedade ".${e.name.text}"`;
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && /^to(Upper|Lower)Case$/.test(e.expression.name.text)) return problema(e.expression.expression, sf);
  if (ts.isTemplateExpression(e)) {
    for (const s of e.templateSpans) { const p = problema(s.expression, sf); if (p) return p; }
    return null;
  }
  if (ts.isConditionalExpression(e)) return problema(e.whenTrue, sf) ?? problema(e.whenFalse, sf); // a condição não vai pra chave
  if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    return problema(e.left, sf) ?? problema(e.right, sf);
  }
  return `expressão "${e.getText(sf).slice(0, 60)}"`;
}

describe("atributos que viram chave sem peneira só levam texto do código", () => {
  it("nenhum data-track/-bloco/-folha/-camada-guia/-card/-tour/-spotlight com dado da pessoa", () => {
    const erros: string[] = [];
    for (const arq of listar(SRC)) {
      const codigo = fs.readFileSync(arq, "utf8");
      if (!/data-(track|folha|camada-guia|card|tour|spotlight)|dataCard=|card=|testid=/.test(codigo)) continue;
      const sf = ts.createSourceFile(arq, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visitar = (n: ts.Node): void => {
        if (ts.isJsxAttribute(n)) {
          const nome = n.name.getText(sf);
          const dono = n.parent?.parent as ts.JsxOpeningLikeElement | undefined;
          const tag = dono && (ts.isJsxOpeningElement(dono) || ts.isJsxSelfClosingElement(dono)) ? dono.tagName.getText(sf) : "";
          const conferir = ATRIBUTOS.has(nome) || (CHAMADAS_CONFERIDAS[tag]?.includes(nome) ?? false);
          if (conferir && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) {
            const p = problema(n.initializer.expression, sf);
            if (p) {
              const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
              erros.push(`${path.relative(SRC, arq)}:${line + 1} ${nome}: ${p}`);
            }
          }
        }
        ts.forEachChild(n, visitar);
      };
      visitar(sf);
    }
    expect(erros).toEqual([]);
  });

  it("o próprio guarda pega valor com dado da pessoa", () => {
    const sf = ts.createSourceFile("x.tsx", "const a = <b data-track={habito.nome} data-folha={`f-${pessoa.name}`} />;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const achados: string[] = [];
    const visitar = (n: ts.Node): void => {
      if (ts.isJsxAttribute(n) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) {
        const p = problema(n.initializer.expression, sf);
        if (p) achados.push(p);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    expect(achados).toEqual(['propriedade ".nome"', 'propriedade ".name"']);
  });
});
