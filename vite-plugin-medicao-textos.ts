/**
 * DICIONÁRIO DE TEXTOS DO CÓDIGO — a peneira de privacidade da medição total (1.0.16).
 *
 * A medição total (src/lib/medicao-total.ts) dá nome a cada botão, card e folha pelo texto que
 * aparece na tela ("SALVAR", "URGÊNCIAS", "NOVO GASTO"). Texto de tela pode ser DADO da pessoa
 * (nome do hábito, descrição do gasto, nome de alguém) — e isso nunca pode virar chave.
 *
 * Regra: um texto só entra numa chave se, normalizado, for IGUAL a um texto escrito no código
 * de uma tela. Este plugin lê `src/**\/*.tsx` no build (TypeScript, só leitura) e junta:
 *  - texto JSX literal (`<h3>Urgências</h3>`, `Adicionar {tipo}` → "ADICIONAR");
 *  - texto entre aspas dentro de JSX (`{aberto ? "Fechar" : "Abrir"}`, `aria-label="Editar nome"`,
 *    `titulo="Diário"`, pedaços fixos de template `${n} aba oculta`);
 *  - valores de propriedades de rótulo em objetos (`{ label: "Minha conta" }`, `titulo:`, `nome:`…),
 *    que é de onde vêm os menus, abas e ações rápidas montados por lista.
 * Fica de fora o que não é tela de app: testes, telas de dev, admin, funis, site.
 *
 * Sai como `virtual:medicao-textos` (um texto por linha), carregado sob demanda pela medição —
 * nunca pesa a abertura do site. A normalização é a MESMA do app (src/lib/medicao-normalizar.ts).
 * O outro lado da peneira (texto do código que também está nos dados da pessoa — sugestão escolhida,
 * categoria) é feito no app, contra o store em memória.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";
import { letrasDe, MIN_LETRAS_ROTULO, normalizarChave } from "./src/lib/medicao-normalizar";

export const ID_VIRTUAL_MEDICAO_TEXTOS = "virtual:medicao-textos";
const ID_RESOLVIDO = "\0" + ID_VIRTUAL_MEDICAO_TEXTOS;

/** Caminhos que não são tela do app logado. */
const FORA = [
  /[\\/]src[\\/]test[\\/]/,
  /[\\/]src[\\/]dev[\\/]/,
  /[\\/]src[\\/]pages[\\/](dev|admin|funis|lp|site|v2|v3)[\\/]/,
  /[\\/]src[\\/]components[\\/](admin|site)[\\/]/,
  /\.(test|spec)\.tsx$/,
];

/** Atributos JSX que nunca carregam texto de tela (classe, estilo, ids, animação, handlers…). */
const ATRIBUTOS_SEM_TEXTO = new Set([
  "className", "class", "style", "key", "id", "src", "href", "to", "type", "variant", "size", "side", "align",
  "role", "viewBox", "d", "fill", "stroke", "strokeWidth", "htmlFor", "inputMode", "autoComplete", "pattern",
  "accept", "rel", "target", "dir", "lang", "name", "value", "defaultValue", "width", "height", "sizes",
  "srcSet", "loading", "decoding", "method", "action", "form", "tabIndex", "ref", "xmlns", "transform",
  "points", "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "x2", "y1", "y2", "offset", "stopColor",
  "gradientUnits", "clipPath", "mask", "filter", "preserveAspectRatio", "draggable", "autoFocus", "spellCheck",
  "enterKeyHint", "capture", "mode", "initial", "animate", "exit", "transition", "layout", "layoutId",
  "whileTap", "whileHover", "whileInView", "variants", "custom", "orientation", "asChild", "position",
  "sideOffset", "alignOffset", "collisionPadding", "modal", "defaultOpen", "open", "checked", "disabled",
  "min", "max", "step", "overlayClassName", "cor", "corBarra", "emoji", "icon", "icone",
]);

/** Propriedades de objeto que são rótulo de tela (menus, abas, ações montadas por lista). */
const CHAVES_DE_ROTULO = new Set([
  "label", "titulo", "title", "rotulo", "nome", "name", "texto", "text", "cta", "subtitulo", "subtitle",
  "descricao", "description", "heading", "legenda", "chamada", "frase", "mensagem", "dica", "pergunta",
  "botao", "placeholder", "curto", "resumo", "tituloCurto", "rotuloCurto", "acao", "ajuda",
]);

const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (ENTIDADES[k] !== undefined) return ENTIDADES[k];
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return m;
  });

const nomeDaPropriedade = (n: ts.PropertyName): string | null =>
  ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null;

/** Junta os textos de UM arquivo .tsx em `out` (normalizados). Exportado pro teste. */
export function extrairTextos(arquivo: string, codigo: string, out: Set<string>): void {
  const sf = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const add = (bruto: string) => {
    const t = decodificar(bruto).replace(/\s+/g, " ").trim();
    if (!t || t.length > 60) return;
    const n = normalizarChave(t);
    if (letrasDe(n) >= MIN_LETRAS_ROTULO) out.add(n);
  };
  const literais = (e: ts.Node): void => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text);
    else if (ts.isTemplateExpression(e)) { add(e.head.text); for (const s of e.templateSpans) { add(s.literal.text); literais(s.expression); } }
    else if (ts.isConditionalExpression(e)) { literais(e.whenTrue); literais(e.whenFalse); }
    else if (ts.isBinaryExpression(e)) { literais(e.left); literais(e.right); }
    else if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) literais(e.expression);
  };
  const visitar = (n: ts.Node, emJsx: boolean): void => {
    if (ts.isJsxAttribute(n)) {
      const nome = n.name.getText(sf);
      if (ATRIBUTOS_SEM_TEXTO.has(nome) || nome.startsWith("data-") || /^on[A-Z]/.test(nome)
        || (nome.startsWith("aria-") && nome !== "aria-label" && nome !== "aria-valuetext")) return;
    }
    if (ts.isJsxText(n)) { add(n.text); return; }
    if (emJsx) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) add(n.text);
      else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) add(n.text);
    }
    if (ts.isPropertyAssignment(n)) {
      const k = nomeDaPropriedade(n.name);
      if (k && CHAVES_DE_ROTULO.has(k)) literais(n.initializer);
    }
    const dentro = emJsx || ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n) || ts.isJsxExpression(n);
    ts.forEachChild(n, (filho) => visitar(filho, dentro));
  };
  visitar(sf, false);
}

const listarTsx = (dir: string, out: string[] = []): string[] => {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) listarTsx(p, out);
    else if (nome.endsWith(".tsx") && !FORA.some((re) => re.test(p))) out.push(p);
  }
  return out;
};

/** O dicionário inteiro: textos normalizados do `src/`, ordenados, um por linha. */
export function gerarDicionarioDeTextos(dirSrc: string): string {
  const out = new Set<string>();
  for (const arq of listarTsx(dirSrc)) {
    try { extrairTextos(arq, fs.readFileSync(arq, "utf8"), out); } catch { /* arquivo que não parseia: fica de fora */ }
  }
  return [...out].sort().join("\n");
}

export function medicaoTextos(raiz: string): Plugin {
  let cache: string | null = null;
  return {
    name: "core-medicao-textos",
    resolveId(id) {
      return id === ID_VIRTUAL_MEDICAO_TEXTOS ? ID_RESOLVIDO : null;
    },
    load(id) {
      if (id !== ID_RESOLVIDO) return null;
      if (cache === null) cache = gerarDicionarioDeTextos(path.join(raiz, "src"));
      return `export default ${JSON.stringify(cache)};`;
    },
    // servidor de desenvolvimento: texto novo numa tela entra no dicionário sem reiniciar
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith(".tsx")) return;
      cache = null;
      const m = ctx.server.moduleGraph.getModuleById(ID_RESOLVIDO);
      if (m) ctx.server.moduleGraph.invalidateModule(m);
    },
  };
}
