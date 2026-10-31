/**
 * PLANNER 2027, VERSÃO B (31/10 — novidades-guardadas/2026-10-31/upsell-planner/BRIEF.md).
 *
 * O planner pra imprimir do "Seu 2027" passa a sair MONTADO COM OS DADOS DELA: o plano do Seu 2027 (3 metas, gastar e
 * guardar por mês, datas, cofrinho, revisões) + o que ela já tem no CORE (hábitos da Rotina, contas fixas do Finanças no
 * perfil ativo). 14 folhas A4 (eram 12; v2 de 31/10 na escala do original do Codex) no layout do "baixar planner" do Codex (papel, painéis arredondados, "CORE | PLANNER"), em
 * DUAS DIREÇÕES de cara, escolhidas por constante:
 *   "codex"  o design do Codex como está: creme, 4 pastéis, Instrument Serif itálica, flor.
 *   "core"   o mesmo layout com a cara dos módulos de hoje: cada painel na cor + ícone do módulo dele (grade da Home,
 *            src/lib/modulos.tsx), Inter, grafite + magenta, capa com os 16 ícones.
 *
 * Uma composição só, em px de uma folha A4 a 150 dpi (1240×1754): a prévia do app, o PNG do iPhone (gerarPng, folha
 * nativa) e a impressão do site (zoom pra caber em 210×297 mm) são o MESMO HTML — nada de desenho paralelo.
 *
 * Chave PLANNER_2027 "off" (padrão): o app fica na versão A (src/lib/pacote-2027-pdf.ts, byte a byte). QA no aparelho:
 * ?planner27=on|off|auto e ?planner-estilo=codex|core|auto (guardados em localStorage).
 */
import {
  ANO_2027, MESES_2027, SEMANAS_COFRINHO, TOTAL_COFRINHO, metasPreenchidas, revisaoFeita, totalGuardado, valorDaSemana,
  type Cofrinho2027, type Plano2027,
} from "@/lib/pacote-2027";
import { doPerfil, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { nomesDosHabitos } from "@/lib/rotina-habitos";
import { svgDoIcone, type IconeDoPlanner } from "@/lib/planner-2027-icones";

/* ───────────────────────── as chaves (src/lib/planner-2027-chave.ts: a landing lê sem baixar o planner) ───────────────────────── */
export {
  PLANNER_2027, PLANNER_ESTILO, PARAM_QA_PLANNER, PARAM_QA_ESTILO, CHAVE_FORCA_PLANNER, CHAVE_FORCA_ESTILO, plannerNovoLigado, estiloDoPlanner,
  type ModoPlanner, type EstiloPlanner,
} from "@/lib/planner-2027-chave";
import type { EstiloPlanner } from "@/lib/planner-2027-chave";

/* ───────────────────────── os dados ───────────────────────── */

export interface ContaFixa { nome: string; valor: number; dia: number | null }
export interface DadosDoPlanner {
  plano: Plano2027;
  cofrinho: Cofrinho2027;
  /** os hábitos da Rotina, na ordem da tabela */
  habitos: string[];
  /** as contas fixas do Finanças (perfil ativo), na ordem do dia de vencimento */
  contas: ContaFixa[];
}
type Get = <T>(k: string, f: T) => T;

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const limpa = (v: unknown, max = 60) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** O que o planner lê da Rotina e do Finanças (tolerante: qualquer formato estranho vira lista vazia). */
export function lerExtrasDoPlanner(get: Get): Pick<DadosDoPlanner, "habitos" | "contas"> {
  const habitos = nomesDosHabitos(get<unknown>("rotina-habits", [])).map((h) => limpa(h)).filter(Boolean).slice(0, 12);
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const fixas = doPerfil(lista(get<unknown>("finance-fixed-expenses", [])).filter((i): i is Record<string, unknown> => !!i && typeof i === "object"), perfil);
  const contas: ContaFixa[] = fixas
    .map((f) => {
      const o = f as Record<string, unknown>;
      const dia = Number(o.day);
      const valor = Number(o.value) || Number(o.amount) || 0;
      return { nome: limpa(o.description ?? o.name, 60), valor: valor > 0 ? Math.round(valor * 100) / 100 : 0, dia: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null };
    })
    .filter((c) => c.nome)
    .sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99));
  return { habitos, contas };
}

/** O resumo do que entrou dos dados dela (a prévia do app mostra; o "pouco" chama pra planejar). */
export function resumoDoPlanner(d: DadosDoPlanner) {
  const metas = metasPreenchidas(d.plano).length;
  const r = { metas, dinheiro: d.plano.gastarMes > 0 || d.plano.guardarMes > 0, datas: d.plano.datas.length, habitos: d.habitos.length, contas: d.contas.length, cofrinho: d.cofrinho.marcadas.length };
  return { ...r, pouco: !d.plano.salvoEm && metas === 0 && !r.dinheiro && r.datas === 0 };
}

/* ───────────────────────── a composição ───────────────────────── */

export const A4_PX = { largura: 1240, altura: 1754 } as const;
export const TOTAL_DE_FOLHAS = 14;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Os tons dos painéis. Cada um vira um módulo na direção "core" e um pastel na "codex". */
type Tom = "metas" | "dinheiro" | "datas" | "rotina" | "cofrinho" | "revisao" | "nota" | "mes" | "entrada" | "saida" | "orcamento" | "vencimento" | "agenda" | "importa" | "rev" | "meta-n" | IconeDoPlanner;
const MODULO_DO_TOM: Record<string, IconeDoPlanner> = {
  metas: "desenvolvimento", dinheiro: "financas", datas: "relacionamentos", rotina: "rotina", cofrinho: "financas", revisao: "desenvolvimento", nota: "hiperfoco",
  mes: "relacionamentos", entrada: "financas", saida: "financas", orcamento: "financas", vencimento: "financas", agenda: "rotina", importa: "desenvolvimento", rev: "desenvolvimento", "meta-n": "desenvolvimento",
};
const ICONE_DO_TOM: Record<string, IconeDoPlanner> = {
  metas: "meta", dinheiro: "carteira", datas: "bolo", rotina: "rotina", cofrinho: "cofrinho", revisao: "calendario", nota: "caneta",
  mes: "calendario", entrada: "entrada", saida: "saida", orcamento: "orcamento", vencimento: "vencimento", agenda: "agenda", importa: "lista", rev: "calendario", "meta-n": "meta",
};

/** As cores da grade da Home (Tailwind: 50 papel do painel · 100 o quadrado do ícone · 700 título · 600 forte · 200 linha). */
const COR_DO_MODULO: Record<string, [string, string, string, string, string]> = {
  financas: ["#fffbeb", "#fef3c7", "#b45309", "#d97706", "#fde68a"],
  treino: ["#eff6ff", "#dbeafe", "#1d4ed8", "#2563eb", "#bfdbfe"],
  dieta: ["#f0fdf4", "#dcfce7", "#15803d", "#16a34a", "#bbf7d0"],
  rotina: ["#ecfdf5", "#d1fae5", "#047857", "#059669", "#a7f3d0"],
  desenvolvimento: ["#faf5ff", "#f3e8ff", "#7e22ce", "#9333ea", "#e9d5ff"],
  saude: ["#fef2f2", "#fee2e2", "#b91c1c", "#dc2626", "#fecaca"],
  casa: ["#ecfeff", "#cffafe", "#0e7490", "#0891b2", "#a5f3fc"],
  estudos: ["#eef2ff", "#e0e7ff", "#4338ca", "#4f46e5", "#c7d2fe"],
  biblioteca: ["#fff7ed", "#ffedd5", "#c2410c", "#ea580c", "#fed7aa"],
  beleza: ["#fdf2f8", "#fce7f3", "#be185d", "#db2777", "#fbcfe8"],
  viagens: ["#f0fdfa", "#ccfbf1", "#0f766e", "#0d9488", "#99f6e4"],
  carreira: ["#f8fafc", "#f1f5f9", "#334155", "#475569", "#cbd5e1"],
  hiperfoco: ["#f5f3ff", "#ede9fe", "#6d28d9", "#7c3aed", "#ddd6fe"],
  relacionamentos: ["#fff1f2", "#ffe4e6", "#be123c", "#e11d48", "#fecdd3"],
  pet: ["#fffbeb", "#fef3c7", "#b45309", "#f59e0b", "#fde68a"],
  detox: ["#f7fee7", "#ecfccb", "#4d7c0f", "#65a30d", "#d9f99d"],
};
/** Os 4 pastéis do Codex (rotina-codex-share.css / finance-notebook): sálvia, rosa, manteiga, lavanda. */
const PASTEL: Record<string, [string, string, string, string, string]> = {
  salvia: ["#eaf3ed", "#d9e9de", "#36563f", "#55734c", "#bac8ad"],
  rosa: ["#f8e8ef", "#f1d4e1", "#92566f", "#b7607f", "#e2bccb"],
  manteiga: ["#f6eccd", "#efdfae", "#776844", "#a08a45", "#d9c88f"],
  lavanda: ["#ebe5f0", "#ddd2e6", "#706278", "#8b6fa3", "#c9bad5"],
};
const PASTEL_DO_TOM: Record<string, keyof typeof PASTEL> = {
  metas: "lavanda", dinheiro: "manteiga", datas: "rosa", rotina: "salvia", cofrinho: "rosa", revisao: "lavanda", nota: "lavanda",
  // folhas v2: os blocos do "Meu mês" e da "Minha semana" nos pastéis do original do Codex ("mes", "rev" e "meta-n" ficam
  // de fora: um pastel por painel, na roda — 6 meses ou 3 metas no mesmo lilás pareciam uma folha só)
  entrada: "salvia", saida: "rosa", orcamento: "lavanda", vencimento: "manteiga", agenda: "rosa", importa: "manteiga",
  // crítica r2 (visual BAIXA 8): as áreas que têm folha própria seguem a cor dela (Finanças = manteiga, como "Meu dinheiro")
  financas: "manteiga", relacionamentos: "rosa", desenvolvimento: "lavanda",
};
const RODA_PASTEL: (keyof typeof PASTEL)[] = ["salvia", "rosa", "manteiga", "lavanda"];

/* crítica r1 (visual ALTA 2): a linha de escrever e o contorno das bolinhas eram o tom 200 a 1,5 px (contraste 1,16–1,29 na
 * B: some no P&B). Agora é uma cor própria (--w), o tom 700 misturado no 200 só até dar contraste ≥ 1,9 com o papel do
 * painel, e 2 px. A borda decorativa do painel segue no --l. */
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luz = (h: string) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contraste = (a: string, b: string) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mistura = (a: string, b: string, t: number) => `#${rgb(a).map((v, i) => Math.round(v * t + rgb(b)[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
export const CONTRASTE_DA_LINHA = 1.9;
const linhaDe = (papel: string, tx: string, ln: string) => {
  for (let t = 0.2; t < 1; t += 0.05) { const c = mistura(tx, ln, t); if (contraste(c, papel) >= CONTRASTE_DA_LINHA) return c; }
  return tx;
};
const cacheLinha = new Map<string, string>();
function varsDoTom(tom: Tom, estilo: EstiloPlanner, i = 0): string {
  const [papel, tile, tx, forte, ln] = estilo === "core"
    ? COR_DO_MODULO[MODULO_DO_TOM[tom] ?? tom] ?? COR_DO_MODULO.desenvolvimento
    : PASTEL[PASTEL_DO_TOM[tom] ?? RODA_PASTEL[(i + 3) % 4]];
  const k = papel + tx + ln;
  if (!cacheLinha.has(k)) cacheLinha.set(k, linhaDe(papel, tx, ln));
  return `--p:${papel};--t:${tile};--x:${tx};--f:${forte};--l:${ln};--w:${cacheLinha.get(k)}`;
}
/** A cor da linha de escrever de cada tom (os testes conferem o contraste com o papel). */
export const linhasDosTons = (estilo: EstiloPlanner) =>
  (estilo === "core" ? Object.values(COR_DO_MODULO) : Object.values(PASTEL)).map(([papel, , tx, , ln]) => ({ papel, linha: linhaDe(papel, tx, ln) }));

/** A flor do Codex (RotinaFlower), na cor do painel. */
const FLOR = (cor: string, tam: number) =>
  `<svg class="pl-flor" width="${tam}" height="${tam}" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M49 54C48 70 54 83 64 93" stroke="#8fa993" stroke-width="3" stroke-linecap="round"/><path d="M54 77C66 64 79 71 79 71C76 83 66 87 54 77Z" fill="#a5b9a1"/><g fill="${cor}">${[0, 72, 144, 216, 288].map((a) => `<path d="M49 48C32 37 27 19 38 13C53 4 63 29 49 48Z" transform="rotate(${a} 49 45)"/>`).join("")}</g><circle cx="49" cy="45" r="9" fill="#ead09a"/></svg>`;
const CORES_DA_FLOR = ["#d9b3cf", "#e2a9be", "#c6b4dc", "#e9c98a"];

const icone = (tom: Tom, estilo: EstiloPlanner) =>
  estilo === "core" ? `<span class="pl-ico">${svgDoIcone(ICONE_DO_TOM[tom] ?? (tom as IconeDoPlanner), 26, 2.2)}</span>` : "";

function painel(tom: Tom, estilo: EstiloPlanner, titulo: string, corpo: string, extra = "", classe = "", i = 0): string {
  return `<section class="pl-painel ${classe}" style="${varsDoTom(tom, estilo, i)}"><div class="pl-ptopo">${icone(tom, estilo)}<h3>${titulo}</h3>${extra ? `<span class="pl-extra">${extra}</span>` : ""}</div>${corpo}</section>`;
}
/** folhas v2: o bloco do "Planner financeiro" do Codex — cabeçalho com cor, corpo claro, faixa de total embaixo. */
function bloco(tom: Tom, estilo: EstiloPlanner, titulo: string, extra: string, corpo: string, total: string): string {
  return `<section class="pl-painel pl-bloco" style="${varsDoTom(tom, estilo)}"><div class="pl-bcab">${icone(tom, estilo)}<h3>${titulo}</h3>${extra ? `<span class="pl-extra">${extra}</span>` : ""}</div><div class="pl-bcorpo">${corpo}</div><div class="pl-btot">${total}</div></section>`;
}
const linhas = (n: number, cls = "") => Array.from({ length: n }, () => `<div class="pl-ln ${cls}"></div>`).join("");
/** crítica r1 (visual MEDIA 5): painel sem pauta embaixo parece erro de impressão — as linhas vão até o fundo do painel
 * (a área cresce com flex; a linha que não cabe inteira quebra pra uma "coluna" escondida à direita: nunca sai cortada). */
const preencher = (n: number, linha = '<div class="pl-ln"></div>', antes = "") => `<div class="pl-pauta">${antes}${linha.repeat(n)}</div>`;
/** o nome do hábito: até 2 linhas ("Beber 2 litros de água" inteiro), ou a linha pra escrever */
const nomeDoHabito = (h: string | undefined) => (h ? `<span class="pl-hab-nome"><span class="pl-2l">${esc(h)}</span></span>` : '<span class="pl-hab-nome"><span class="pl-ln"></span></span>');
/** "R$ ____" grande (cartões) */
const RS_LINHA = `<span class="pl-escrever">R$</span>`;

const RODAPE_FRASE = "Meu ano, do meu jeito.";

/** `sub` é HTML: quem chama escapa o que vem dos dados dela. */
function cabecalho(estilo: EstiloPlanner, rotulo: string, a: string, b: string, sub: string, tomArte: Tom, n: number): string {
  const titulo = estilo === "codex" ? `${esc(a)} <em>${esc(b)}.</em>` : `${esc(a)} <b>${esc(b)}</b>.`;
  const arte = estilo === "codex"
    ? FLOR(CORES_DA_FLOR[n % 4], 128)
    : `<span class="pl-arte" style="${varsDoTom(tomArte, estilo)}">${svgDoIcone(ICONE_DO_TOM[tomArte] ?? (tomArte as IconeDoPlanner), 58, 2)}</span>`;
  return `<header class="pl-cab"><div class="pl-marca"><span>${estilo === "core" ? '<i class="pl-ponto"></i>' : ""}CORE</span><span>${esc(rotulo)}</span></div><h2>${titulo}</h2><p>${sub}</p>${arte}</header>`;
}
const rodape = (n: number) => `<footer class="pl-rod"><span>${RODAPE_FRASE}</span><span>${n} / ${TOTAL_DE_FOLHAS} · feito com CORE</span></footer>`;
const folha = (n: number, corpo: string, classe = "") => `<section class="pg pl-folha ${classe}" data-folha="${n}">${corpo}${rodape(n)}</section>`;

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const ICONE_DA_DATA: Record<string, IconeDoPlanner> = { aniversario: "bolo", checkup: "checkup", data: "pino" };
const DIAS_DA_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];
const DIAS_DA_AGENDA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/* ───────────── as 14 folhas (v2, 31/10: a escala do original do Codex — letra grande, pouco por folha, muito respiro) ─────────────
 *  1 capa · 2 meu ano · 3–4 calendário (6 meses por folha) · 5 metas · 6 MEU MÊS (Finanças, modelo pra imprimir 1 por mês)
 *  7 MINHA SEMANA (Rotina, modelo pra imprimir 1 por semana) · 8 cofrinho · 9–10 revisões (6 por folha) · 11–14 as 16 áreas */

const CAPA_CORE: IconeDoPlanner[] = ["desenvolvimento", "financas", "relacionamentos", "rotina"];
function fCapa(d: DadosDoPlanner, e: EstiloPlanner): string {
  const MODS: [IconeDoPlanner, string][] = [["financas", "Finanças"], ["rotina", "Rotina"], ["desenvolvimento", "Metas"], ["relacionamentos", "Datas"]];
  // crítica r1 (visual BAIXA 9): a grade de 16 competia com o "Meu 2027." — na capa só os 4 módulos que entram no planner
  const arte = e === "core"
    ? `<div class="pl-capa-grade">${CAPA_CORE.map((m) => MODS.find((x) => x[0] === m)!).map(([m, nome]) => `<div style="${varsDoTom(m, e)}"><span class="pl-ico">${svgDoIcone(m, 60, 2)}</span><small>${nome}</small></div>`).join("")}</div>`
    : `<div class="pl-capa-flores">${FLOR(CORES_DA_FLOR[0], 300)}${FLOR(CORES_DA_FLOR[2], 190)}${FLOR(CORES_DA_FLOR[3], 140)}</div>`;
  const metas = metasPreenchidas(d.plano);
  return folha(1, `
    <div class="pl-capa">
      <div class="pl-marca"><span>${e === "core" ? '<i class="pl-ponto"></i>' : ""}CORE</span><span>PLANNER ${ANO_2027}</span></div>
      <h1>${e === "codex" ? "Meu <em>2027.</em>" : "Meu <b>2027</b>."}</h1>
      <p class="pl-capa-sub">Metas, dinheiro, datas e rotina.<br/>Um ano inteiro num lugar só.</p>
      ${arte}
      <div class="pl-capa-metas"><small>ESTE ANO EU VOU</small>${metas.slice(0, 3).map((m) => `<b>${esc(m)}</b>`).join("")}${linhas(Math.max(0, 3 - metas.length))}</div>
      <div class="pl-capa-dono"><small>ESTE PLANNER É DE</small><div class="pl-ln"></div></div>
    </div>`, "pl-f-capa");
}

/** os 3 cartões do topo (o "Receitas / Despesas / Saldo" do Codex): na codex um pastel cada, na core o tom do Finanças */
function cartoes(e: EstiloPlanner, itens: { rotulo: string; valor: number; nota?: string }[], tons: Tom[]): string {
  // crítica r2 (técnico BAIXA 6): valor de 7 dígitos quebrava o "R$" numa linha separada — letra menor, numa linha só
  return `<div class="pl-cards">${itens.map((c, i) => {
    const t = c.valor > 0 ? brl(c.valor) : "";
    return `<div style="${varsDoTom(e === "core" ? "dinheiro" : tons[i], e)}"><small>${c.rotulo}</small><b${t.length > 11 ? ' class="pl-longo"' : ""}>${t || RS_LINHA}</b>${c.nota ? `<span class="pl-card-nota">${c.nota}</span>` : ""}</div>`;
  }).join("")}</div>`;
}

function fAno(d: DadosDoPlanner, e: EstiloPlanner): string {
  const p = d.plano;
  const metas = [0, 1, 2].map((i) => metasPreenchidas(p)[i] ?? "");
  const pMetas = painel("metas", e, "Minhas 3 metas", `<ol class="pl-metas">${metas.map((m, i) => `<li><span>${i + 1}</span>${m ? `<b class="pl-2l">${esc(m)}</b>` : '<div class="pl-ln"></div>'}</li>`).join("")}</ol>`);
  const cards = cartoes(e, [
    { rotulo: "Posso gastar por mês", valor: p.gastarMes },
    { rotulo: "Quero guardar por mês", valor: p.guardarMes },
    { rotulo: "Guardado no fim do ano", valor: p.guardarMes > 0 ? p.guardarMes * 12 : 0 },
  ], ["rotina", "datas", "dinheiro"]);
  // crítica r1: o "+N no calendário" é a 6ª linha da lista
  const mais = p.datas.length > 6;
  const datas = [...p.datas].sort((a, b) => a.dia.localeCompare(b.dia)).slice(0, mais ? 5 : 6);
  const pDatas = painel("datas", e, "Datas que importam", `<ul class="pl-datas">${datas.map((x) => `<li><b>${ddmm(x.dia)}</b><span class="pl-dico">${svgDoIcone(ICONE_DA_DATA[x.tipo] ?? "pino", 24, 2)}</span><span class="pl-txt">${esc(x.titulo)}</span></li>`).join("")}${mais ? `<li class="mais">+${p.datas.length - 5} no calendário</li>` : ""}${Array.from({ length: Math.max(0, 6 - datas.length - (mais ? 1 : 0)) }, () => `<li class="vazia"><b>__/__</b><span class="pl-ln"></span></li>`).join("")}</ul>`);
  const pFrase = painel("nota", e, "Uma frase pro meu 2027", preencher(8), "", "pl-enche");
  return folha(2, `${cabecalho(e, "PLANNER 2027", "Meu", "ano", "2027 numa página", "metas", 2)}
    <div class="pl-corpo">${pMetas}${cards}${pDatas}${pFrase}</div>`);
}

function fCalendario(d: DadosDoPlanner, e: EstiloPlanner, parte: 0 | 1): string {
  const porDia = new Set(d.plano.datas.map((x) => x.dia));
  const meses = MESES_2027.slice(parte * 6, parte * 6 + 6).map((nome, k) => {
    const i = parte * 6 + k, m = i + 1;
    const dias = new Date(ANO_2027, m, 0).getDate();
    const vazio = (new Date(ANO_2027, i, 1).getDay() + 6) % 7;
    const doMes = d.plano.datas.filter((x) => Number(x.dia.slice(5, 7)) === m).sort((a, b) => a.dia.localeCompare(b.dia));
    const cel = [...Array.from({ length: vazio }, () => "<i></i>"), ...Array.from({ length: dias }, (_, q) => {
      const chave = `${ANO_2027}-${String(m).padStart(2, "0")}-${String(q + 1).padStart(2, "0")}`;
      return `<i class="${porDia.has(chave) ? "marca" : ""}">${q + 1}</i>`;
    })].join("");
    const lista = doMes.slice(0, 2).map((x) => `<li><b>${x.dia.slice(8, 10)}</b><span class="pl-txt">${esc(x.titulo)}</span></li>`).join("") + (doMes.length > 2 ? `<li class="mais">+${doMes.length - 2} neste mês</li>` : "");
    return painel("mes", e, nome, `<div class="pl-mes"><div class="pl-sem">${DIAS_DA_SEMANA.map((x) => `<i>${x}</i>`).join("")}</div><div class="pl-dias">${cel}</div>${lista ? `<ul class="pl-mes-datas">${lista}</ul>` : ""}${preencher(3)}</div>`, "", "pl-mesp", i);
  }).join("");
  const sub = d.plano.datas.length ? "As datas que importam já marcadas" : "Marque as datas que importam";
  return folha(3 + parte, `${cabecalho(e, `PLANNER 2027 · ${parte ? "JUL–DEZ" : "JAN–JUN"}`, "Meu", "calendário", sub, "datas", 3 + parte)}
    <div class="pl-corpo"><div class="pl-cal">${meses}</div></div>`);
}

function fMetas(d: DadosDoPlanner, e: EstiloPlanner): string {
  const metas = [0, 1, 2].map((i) => metasPreenchidas(d.plano)[i] ?? "");
  const blocos = metas.map((m, i) => painel("meta-n", e, `Meta ${i + 1}`, `
      <div class="pl-meta-t">${m ? `<b class="pl-txt">${esc(m)}</b>` : '<div class="pl-ln"></div>'}</div>
      <div class="pl-tri">${["Jan–Mar", "Abr–Jun", "Jul–Set", "Out–Dez"].map((t) => `<div><div class="pl-rotulo">${t}</div>${linhas(2)}</div>`).join("")}</div>
      <div class="pl-passo"><span class="pl-caixa"></span><span class="pl-rotulo">Primeiro passo</span><div class="pl-ln"></div></div>`, "", "pl-meta", i)).join("");
  return folha(5, `${cabecalho(e, "PLANNER 2027", "Minhas", "metas", "3 metas, um trimestre de cada vez", "metas", 5)}<div class="pl-corpo">${blocos}</div>`);
}

/* folhas v2: FINANÇAS = o "Meu mês" do Codex (cartões Receitas/Despesas/Saldo + Receitas, Gastos, Orçamento, Vencimentos).
 * É UM MODELO pra imprimir 12 vezes (antes: uma tabela de 12 meses repetindo o mesmo valor, letra miúda). O que ela já tem
 * entra pronto: o "posso gastar" vira o limite do orçamento, o "quero guardar" vai no saldo, as contas fixas viram os
 * vencimentos com dia e valor (e o total). O resto é linha pra escrever. */
const CATEGORIAS = ["Moradia", "Mercado", "Transporte", "Saúde", "Lazer", "Outros"];
const MAX_CONTAS = 6;
function fMeuMes(d: DadosDoPlanner, e: EstiloPlanner): string {
  const p = d.plano;
  const cards = cartoes(e, [
    { rotulo: "Receitas", valor: 0 },
    { rotulo: "Despesas", valor: 0, nota: p.gastarMes > 0 ? `posso gastar ${brl(p.gastarMes)}` : "" },
    { rotulo: "Saldo do mês", valor: 0, nota: p.guardarMes > 0 ? `quero guardar ${brl(p.guardarMes)}` : "" },
  ], ["entrada", "saida", "vencimento"]);
  const cab = (...c: string[]) => `<div class="pl-lv pl-lv-cab">${c.map((x) => `<span>${x}</span>`).join("")}</div>`;
  const linhaValor = `<div class="pl-lv"><span class="pl-ln"></span><span class="pl-ln"></span><span class="pl-rs">R$</span><span class="pl-ln"></span></div>`;
  const total = (rot: string, v = 0) => `<span>${rot}</span><b>${v > 0 ? brl(v) : RS_LINHA}</b>`;
  const pReceitas = bloco("entrada", e, "Receitas", "No mês", preencher(8, linhaValor, cab("Dia", "De onde", "", "Valor")), total("Total do mês"));
  const pGastos = bloco("saida", e, "Gastos", "No mês", preencher(12, linhaValor, cab("Dia", "Com o quê", "", "Valor")), total("Total do mês"));
  const pOrc = bloco("orcamento", e, "Orçamento", "Gastei · Limite", `<div class="pl-orc">${CATEGORIAS.map((c) => `<div><span>${c}</span><span class="pl-ln"></span><span class="pl-ln"></span></div>`).join("")}</div>`,
    total("Limite do mês", p.gastarMes));
  const mais = d.contas.length > MAX_CONTAS;
  const contas = d.contas.slice(0, mais ? MAX_CONTAS - 1 : MAX_CONTAS);
  const soma = Math.round(d.contas.reduce((s, c) => s + c.valor, 0) * 100) / 100;
  const vazias = mais ? 0 : MAX_CONTAS - contas.length;
  const pVenc = bloco("vencimento", e, "Vencimentos", d.contas.length ? "do seu Finanças" : "Contas do mês", `<div class="pl-venc">${
    contas.map((c) => `<div><span class="pl-caixa"></span><span class="pl-vn"><b class="pl-txt">${esc(c.nome)}</b><small>${c.dia ? `Dia ${c.dia}` : "Dia __"}</small></span><b class="pl-vv">${c.valor > 0 ? brl(c.valor) : RS_LINHA}</b></div>`).join("")}${
    mais ? `<div class="pl-venc-mais">+${d.contas.length - contas.length} no seu Finanças</div>` : ""}${
    Array.from({ length: vazias }, () => `<div class="vazia"><span class="pl-caixa"></span><span class="pl-ln"></span><small>Dia __</small></div>`).join("")}</div>`,
    total(d.contas.length ? "Total das contas" : "Total", soma));
  return folha(6, `${cabecalho(e, "PLANNER FINANCEIRO", "Meu", "mês", `Mês: <span class="pl-ln pl-curta"></span> · uma folha pra cada mês`, "dinheiro", 6)}
    <div class="pl-corpo">${cards}<div class="pl-dupla">${pReceitas}${pGastos}</div><div class="pl-dupla pl-auto">${pOrc}${pVenc}</div></div>`, "pl-f-mes");
}

/* folhas v2: ROTINA = a "Minha semana" do Codex (Pequenos hábitos com bolinhas grandes S–D, Minha agenda, O que importa,
 * Uma nota pra mim), com os hábitos dela. Modelo pra imprimir 1 por semana (antes: grade de 31 dias com bolinha de 22 px). */
const MAX_HABITOS = 6;
function fSemana(d: DadosDoPlanner, e: EstiloPlanner): string {
  const mais = d.habitos.length > MAX_HABITOS;
  const hab = d.habitos.slice(0, mais ? MAX_HABITOS - 1 : MAX_HABITOS);
  const n = mais ? MAX_HABITOS - 1 : Math.max(5, hab.length);
  const pHab = painel("rotina", e, "Pequenos hábitos", `<div class="pl-hab"><span class="pl-hab-cab">MEUS CUIDADOS</span>${DIAS_DA_SEMANA.map((x) => `<span class="pl-dia">${x}</span>`).join("")}
      ${Array.from({ length: n }, (_, i) => `${nomeDoHabito(hab[i])}${"<i></i>".repeat(7)}`).join("")}${mais ? `<span class="pl-hab-mais">+${d.habitos.length - hab.length} na sua Rotina</span>` : ""}</div>`,
    d.habitos.length ? "da sua Rotina" : "");
  const pAgenda = painel("agenda", e, "Minha agenda", `<div class="pl-agenda"><span></span>${DIAS_DA_AGENDA.map((x) => `<span class="pl-ag-dia">${x}<span class="pl-ln"></span></span>`).join("")}
      ${["Manhã", "Tarde", "Noite"].map((t) => `<span class="pl-ag-hora">${t}</span>${"<i></i>".repeat(7)}`).join("")}</div>`);
  const pImporta = painel("importa", e, "O que importa", preencher(8, `<div class="pl-tarefa"><span class="pl-caixa"></span><div class="pl-ln"></div></div>`), "", "pl-enche");
  const pNota = painel("nota", e, "Uma nota pra mim", preencher(8), "", "pl-enche");
  return folha(7, `${cabecalho(e, "PLANNER SEMANAL", "Minha", "semana", `De <span class="pl-ln pl-curta"></span> a <span class="pl-ln pl-curta"></span> · uma folha por semana`, "rotina", 7)}
    <div class="pl-corpo">${pHab}${pAgenda}<div class="pl-dupla">${pImporta}${pNota}</div></div>`);
}

function fCofrinho(d: DadosDoPlanner, e: EstiloPlanner): string {
  const c = d.cofrinho;
  const total = totalGuardado(c);
  const grade = `<div class="pl-cof">${Array.from({ length: SEMANAS_COFRINHO }, (_, i) => {
    const s = i + 1;
    return `<div class="${c.marcadas.includes(s) ? "ok" : ""}"><small>sem ${s}</small><b>R$ ${valorDaSemana(s, c.invertido)}</b></div>`;
  }).join("")}</div>`;
  const barra = `<div class="pl-barra"><i style="width:${Math.max(0, Math.min(100, (total / TOTAL_COFRINHO) * 100)).toFixed(1)}%"></i></div>
    <p class="pl-pe">${total > 0 ? `<b>${brl(total)}</b> guardados de ${brl(TOTAL_COFRINHO)}` : `Pinte a semana quando guardar. No fim do ano: <b>${brl(TOTAL_COFRINHO)}</b>.`}</p>`;
  return folha(8, `${cabecalho(e, "PLANNER 2027", "Meu", "cofrinho", c.invertido ? "Semana 1 = R$ 52 · semana 52 = R$ 1" : "Semana 1 = R$ 1 · semana 52 = R$ 52", "cofrinho", 8)}
    <div class="pl-corpo">${painel("cofrinho", e, "52 semanas", grade + barra, "", "pl-cheio")}</div>`);
}

function fRevisoes(d: DadosDoPlanner, e: EstiloPlanner, parte: 0 | 1): string {
  const caixas = MESES_2027.slice(parte * 6, parte * 6 + 6).map((m, k) => {
    const i = parte * 6 + k;
    const feita = revisaoFeita(d.plano, i + 1) >= 5;
    return painel("rev", e, m, `<div class="pl-rev"><div class="pl-rotulo">O que funcionou</div>${preencher(4)}<div class="pl-rotulo">O que vou mudar</div>${preencher(4)}</div>`,
      `${feita ? "feita" : "feita?"} <span class="pl-caixa${feita ? " ok" : ""}"></span>`, "pl-revp", i);
  }).join("");
  const hora = d.plano.horaRevisao ? `, às ${esc(d.plano.horaRevisao)}` : "";
  return folha(9 + parte, `${cabecalho(e, `PLANNER 2027 · ${parte ? "JUL–DEZ" : "JAN–JUN"}`, "Minhas", "revisões", `Dia 1 de cada mês${hora} · 5 minutos`, "revisao", 9 + parte)}
    <div class="pl-corpo"><div class="pl-revs">${caixas}</div></div>`);
}

export const AREAS_B: { m: IconeDoPlanner; nome: string; pergunta: string }[] = [
  { m: "financas", nome: "Finanças", pergunta: "Quanto quero ter guardado no fim do ano?" },
  { m: "rotina", nome: "Rotina", pergunta: "Como quero que sejam as minhas manhãs?" },
  { m: "treino", nome: "Treino", pergunta: "Quantas vezes por semana eu me mexo?" },
  { m: "dieta", nome: "Dieta", pergunta: "O que quero comer mais (e menos)?" },
  { m: "saude", nome: "Saúde", pergunta: "Quais exames e consultas não posso pular?" },
  { m: "casa", nome: "Casa", pergunta: "Que canto da casa quero arrumar?" },
  { m: "desenvolvimento", nome: "Dev. Pessoal", pergunta: "Quem eu quero ser no fim de 2027?" },
  { m: "estudos", nome: "Estudos", pergunta: "O que quero aprender?" },
  { m: "biblioteca", nome: "Biblioteca", pergunta: "Quais livros quero ler?" },
  { m: "beleza", nome: "Beleza", pergunta: "Que cuidado quero manter?" },
  { m: "viagens", nome: "Viagens", pergunta: "Pra onde quero ir?" },
  { m: "carreira", nome: "Carreira", pergunta: "Qual o próximo passo no trabalho?" },
  { m: "hiperfoco", nome: "Mente", pergunta: "O que me deixa em paz?" },
  { m: "relacionamentos", nome: "Relações", pergunta: "Com quem quero passar mais tempo?" },
  { m: "pet", nome: "Pet", pergunta: "O que meu pet precisa este ano?" },
  { m: "detox", nome: "Detox", pergunta: "De que tela quero me afastar?" },
];

function fAreas(parte: number, e: EstiloPlanner): string {
  const quatro = AREAS_B.slice(parte * 4, parte * 4 + 4);
  const n = 11 + parte;
  const blocos = quatro.map((a, i) => painel(a.m, e, a.nome, `<p class="pl-q">${esc(a.pergunta)}</p>${preencher(10)}
      <div class="pl-passo"><span class="pl-caixa"></span><span class="pl-rotulo">Primeiro passo</span><div class="pl-ln"></div></div>
      <div class="pl-chk"><span><span class="pl-caixa"></span>revisei em junho</span><span><span class="pl-caixa"></span>em dezembro</span></div>`, "", "pl-area", parte * 4 + i)).join("");
  return folha(n, `${cabecalho(e, "PLANNER 2027", "As 16", "áreas", `${parte + 1} de 4 · ${quatro.map((a) => a.nome).join(", ")}`, quatro[0].m, n)}<div class="pl-corpo pl-areas">${blocos}</div>`);
}

/** O nome de cada folha, na ordem (a prévia do app usa no aria-label "Folha N: nome"). */
export const ROTULOS_DAS_FOLHAS = [
  "Capa", "Meu ano", "Calendário (jan–jun)", "Calendário (jul–dez)", "Metas", "Meu mês", "Minha semana", "Cofrinho",
  "Revisões (jan–jun)", "Revisões (jul–dez)", "16 áreas", "16 áreas", "16 áreas", "16 áreas",
] as const;

/** As 14 folhas (cada uma um <section class="pg pl-folha">), na ordem do caderno. */
export function folhasDoPlanner(d: DadosDoPlanner, estilo: EstiloPlanner): string[] {
  return [
    fCapa(d, estilo), fAno(d, estilo), fCalendario(d, estilo, 0), fCalendario(d, estilo, 1), fMetas(d, estilo), fMeuMes(d, estilo), fSemana(d, estilo),
    fCofrinho(d, estilo), fRevisoes(d, estilo, 0), fRevisoes(d, estilo, 1), ...[0, 1, 2, 3].map((p) => fAreas(p, estilo)),
  ];
}

/* ───────────────────────── o estilo ───────────────────────── */

/** Tudo escopado na raiz (padrão `.pl`; a prévia do app usa `.pl.pl-<direção>`, as duas cabem na mesma página e nada vaza). */
export function cssDoPlanner(estilo: EstiloPlanner, raiz = ".pl"): string {
  return escopar(cssBase(estilo), raiz);
}
function escopar(css: string, raiz: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^{}]+)\{([^{}]*)\}/g, (_m, sel: string, corpo: string) =>
    `${sel.split(",").map((x) => { const t = x.trim(); return /^\.pl(?![\w-])/.test(t) ? t.replace(/^\.pl/, raiz) : `${raiz} ${t}`; }).join(",")}{${corpo}}`);
}
/* folhas v2 (31/10): a escala do original do Codex (1080 de largura: corpo 20–24, título de bloco ~26, valor ~36) levada
 * pra 1240 (×1,15): corpo 26, título de painel 32, valor em destaque 44, menor letra da folha 18 (≈ 8,6 pt no A4). */
function cssBase(estilo: EstiloPlanner): string {
  const codex = estilo === "codex";
  const papel = codex ? "#fbfaf6" : "#ffffff";
  const tinta = codex ? "#30362f" : "#262626";
  const suave = codex ? "#656b5d" : "#737373";
  const fio = codex ? "#d8d6cc" : "#e5e5e5";
  const destaque = codex ? "#55734c" : "#d6338a";
  const forte = codex ? 600 : 800;
  const tintaCore = codex ? "" : "color:var(--tinta);";
  return `
.pl{--papel:${papel};--tinta:${tinta};--suave:${suave};--fio:${fio};--dest:${destaque};font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--tinta);-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-scheme:light}
.pl *,.pl *:before,.pl *:after{box-sizing:border-box}
.pl h1,.pl h2,.pl h3,.pl h4,.pl p,.pl ol,.pl ul,.pl dl,.pl dd{margin:0;padding:0}
.pl ol,.pl ul{list-style:none}
.pl-folha{position:relative;width:${A4_PX.largura}px;height:${A4_PX.altura}px;overflow:hidden;background:var(--papel);padding:84px 84px 60px;display:flex;flex-direction:column;gap:30px;font-size:26px;line-height:1.3}
.pl-cab{position:relative;flex:0 0 auto;padding-right:180px}
.pl-marca{display:flex;align-items:center;gap:20px;font-size:22px;letter-spacing:4px;font-weight:800;color:var(--tinta)}
.pl-marca>span:first-child{display:inline-flex;align-items:center;gap:10px}
.pl-marca>span+span{padding-left:20px;border-left:1.5px solid var(--fio);font-size:18px;font-weight:650;letter-spacing:2.6px;color:var(--suave)}
.pl-ponto{display:inline-block;width:14px;height:14px;border-radius:50%;background:#d6338a}
.pl-cab h2{margin-top:20px;font-size:80px;line-height:1.05;letter-spacing:-3px;font-weight:${codex ? 550 : 850}}
.pl-cab h2 em,.pl-capa h1 em{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;letter-spacing:-1.5px;font-size:1.22em;line-height:.8}
.pl-cab h2 b,.pl-capa h1 b{color:#d6338a;font-weight:900}
.pl-cab p{margin-top:14px;font-size:26px;color:var(--suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-cab p .pl-curta{width:150px;height:30px;border-bottom-color:var(--fio)}
.pl-cab .pl-flor{position:absolute;right:0;top:-4px}
.pl-arte{position:absolute;right:0;top:0;width:124px;height:124px;border-radius:34px;display:grid;place-items:center;background:var(--t);color:var(--f)}
.pl-corpo{flex:1;min-height:0;display:flex;flex-direction:column;gap:26px}
.pl-corpo>*{flex-shrink:0}
.pl-dupla{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;flex:1 1 0;min-height:0}
.pl-corpo>.pl-dupla{flex-shrink:1}
.pl-auto{flex:0 0 auto}
.pl-painel{position:relative;border-radius:32px;padding:30px 36px 32px;background:var(--p);color:var(--x);overflow:hidden;min-height:0;${codex ? "" : "border:1.5px solid var(--l);"}}
.pl-cheio,.pl-enche{flex:1 1 0;display:flex;flex-direction:column}
.pl-enche{min-height:180px}
.pl-enche .pl-pauta>.pl-ln{height:48px}
.pl-pauta{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;flex-wrap:wrap;align-content:flex-start}
.pl-pauta>*{width:100%;flex-shrink:0}
.pl-ptopo{display:flex;align-items:center;gap:14px;margin-bottom:16px;min-height:46px}
.pl-ptopo h3,.pl-bcab h3{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:32px;font-weight:${codex ? 650 : 800};letter-spacing:-.6px;white-space:nowrap}
.pl-extra{margin-left:auto;font-size:20px;opacity:.9;white-space:nowrap;display:inline-flex;align-items:center;gap:10px;flex-shrink:0}
.pl-ico{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--t);color:var(--f);flex-shrink:0}
.pl-txt{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}
.pl-2l{padding:.06em 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;min-width:0}
.pl-ln{display:block;height:54px;border-bottom:2px solid var(--w,var(--fio))}
.pl-curta{display:inline-block;width:160px;height:24px;vertical-align:bottom}
.pl-rotulo{font-size:18px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;margin-top:16px}
.pl-escrever{display:inline-block;min-width:200px;border-bottom:2px solid var(--w);color:var(--x);opacity:.6;font-weight:500}
.pl-caixa{display:inline-block;width:30px;height:30px;border:2px solid var(--w);border-radius:8px;flex-shrink:0;vertical-align:middle;background:#ffffff80}
.pl-caixa.ok{background:var(--f);border-color:var(--f)}
.pl-pe{margin-top:18px;font-size:24px;opacity:.95}
/* capa */
.pl-f-capa{padding:0}
.pl-capa{position:relative;flex:1;display:flex;flex-direction:column;padding:120px 110px 160px}
.pl-capa h1{margin-top:110px;white-space:nowrap;font-size:${codex ? 176 : 200}px;line-height:.95;letter-spacing:-9px;font-weight:${codex ? 550 : 900}}
.pl-capa-sub{margin-top:36px;font-size:36px;line-height:1.35;color:var(--suave)}
.pl-capa-grade{margin-top:90px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 18px}
.pl-capa-grade>div{display:flex;flex-direction:column;align-items:center;gap:12px}
.pl-capa-grade .pl-ico{width:136px;height:136px;border-radius:36px}
.pl-capa-grade small{font-size:24px;font-weight:650;color:var(--suave)}
.pl-capa-flores{position:relative;height:520px;margin-top:40px}
.pl-capa-flores svg{position:absolute}
.pl-capa-flores svg:nth-child(1){right:20px;top:0}.pl-capa-flores svg:nth-child(2){right:330px;top:250px}.pl-capa-flores svg:nth-child(3){right:150px;top:340px}
.pl-capa-metas{margin-top:40px;display:flex;flex-direction:column;gap:8px}
.pl-capa-metas small,.pl-capa-dono small{font-size:18px;letter-spacing:2.6px;font-weight:700;color:var(--suave)}
.pl-capa-metas .pl-ln{height:56px;border-bottom:2px solid var(--suave);opacity:.5}
.pl-capa-metas b{font-size:34px;font-weight:${codex ? 550 : 750};overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pl-capa-dono{margin-top:auto;max-width:640px;flex-shrink:0}
.pl-capa-dono .pl-ln{height:60px;border-bottom:2px solid var(--suave);opacity:.5}
/* meu ano */
.pl-metas{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.pl-metas li{display:flex;align-items:center;gap:20px;font-size:30px;line-height:1.2;min-height:56px;min-width:0}
.pl-metas li>span{width:48px;height:48px;border-radius:50%;background:var(--t);color:var(--${codex ? "x" : "f"});display:grid;place-items:center;font-size:24px;font-weight:800;flex-shrink:0}
.pl-metas li b{flex:1;min-width:0;font-weight:${codex ? 550 : 700};${tintaCore}}.pl-metas .pl-ln{flex:1}
.pl-datas{display:grid;grid-template-columns:minmax(0,1fr);gap:2px}
.pl-datas li{display:flex;align-items:center;gap:16px;height:54px;font-size:26px;min-width:0;border-bottom:2px solid var(--w)}
.pl-datas li:last-child{border-bottom:0}
.pl-datas li .pl-txt{flex:1;${tintaCore}}
.pl-datas li.mais{font-size:22px;font-weight:650;color:var(--f)}
.pl-datas li b{width:88px;font-weight:700;flex-shrink:0}
.pl-dico{color:var(--f);display:grid;place-items:center;flex-shrink:0}
.pl-datas li.vazia{border-bottom:0}.pl-datas li .pl-ln{flex:1;height:46px}
/* cartões (meu ano, meu mês) */
.pl-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.pl-cards>div{border-radius:28px;padding:26px 28px;background:var(--p);color:var(--x);min-width:0;${codex ? "" : "border:1.5px solid var(--l);"}}
.pl-cards small{font-size:23px;display:block}
.pl-cards b{display:block;margin-top:8px;font-size:44px;line-height:1.15;font-weight:${forte};letter-spacing:-1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-cards b.pl-longo{font-size:34px;line-height:1.5}
.pl-cards b .pl-escrever{min-width:0;width:100%;opacity:.5}
.pl-card-nota{display:block;margin-top:8px;font-size:20px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* blocos do meu mês */
.pl-bloco{padding:0;display:flex;flex-direction:column}
.pl-bcab{display:flex;align-items:center;gap:14px;min-height:76px;padding:14px 28px;background:var(--t)}
.pl-bcorpo{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 28px 14px}
.pl-btot{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:68px;padding:10px 28px;background:var(--t);font-size:23px;font-weight:600}
.pl-btot b{font-size:30px;font-weight:${forte};letter-spacing:-.5px;white-space:nowrap}.pl-btot b .pl-escrever{min-width:150px}
.pl-lv{display:grid;grid-template-columns:62px minmax(0,1fr) auto 120px;align-items:end;column-gap:12px}
.pl-lv .pl-rs{font-size:20px;padding-bottom:8px;opacity:.85}
.pl-lv-cab{font-size:18px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;height:32px;align-items:center}
.pl-orc>div{display:grid;grid-template-columns:minmax(0,1fr) 110px 110px;align-items:end;column-gap:16px;height:60px}
.pl-orc>div>span:first-child{font-size:26px;padding-bottom:10px;${tintaCore}}
.pl-venc>div{display:flex;align-items:center;gap:16px;height:70px;border-bottom:2px solid var(--w);min-width:0}
.pl-venc>div:last-child{border-bottom:0}
.pl-vn{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.15}.pl-vn b{font-size:26px;font-weight:500;${tintaCore}}
.pl-venc small{font-size:20px;opacity:.9}
.pl-vv{font-size:26px;font-weight:${codex ? 550 : 700};white-space:nowrap;${tintaCore}}
.pl-venc .vazia{border-bottom:0}.pl-venc .vazia .pl-ln{flex:1;height:52px}.pl-venc .vazia small{width:92px;flex-shrink:0}
.pl-venc .pl-venc-mais{font-size:22px;font-weight:650;color:var(--f)}
/* calendário (6 meses por folha) */
.pl-cal{flex:1;min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:24px}
.pl-mesp{padding:24px 30px 20px;display:flex;flex-direction:column}
.pl-mesp .pl-ptopo{margin-bottom:6px}
.pl-mes{min-width:0;flex:1;min-height:0;display:flex;flex-direction:column}
.pl-sem,.pl-dias{display:grid;grid-template-columns:repeat(7,1fr);text-align:center}
.pl-sem i{font-style:normal;font-size:19px;font-weight:700;padding-bottom:4px}
.pl-dias i{font-style:normal;font-size:24px;line-height:38px;height:38px;${codex ? "" : "color:var(--tinta)"}}
.pl-dias i.marca{justify-self:center;width:38px;height:38px;line-height:34px;margin-top:-1px;background:var(--f);color:#fff;border-radius:50%;font-weight:700;border:2px solid var(--x)}
.pl-mes-datas{margin-top:6px;flex-shrink:0;font-size:20px;${tintaCore}}
.pl-mesp .pl-pauta>.pl-ln{height:44px}
.pl-mes-datas li{display:flex;gap:10px;line-height:28px;min-width:0}.pl-mes-datas .pl-txt{flex:1}.pl-mes-datas b{color:var(--f);flex-shrink:0}.pl-mes-datas .mais{color:var(--x);font-weight:650}
/* metas */
.pl-meta{flex:1 1 0;display:flex;flex-direction:column;justify-content:space-between}
.pl-meta .pl-ptopo{margin-bottom:4px}
.pl-meta-t{font-size:36px;font-weight:${codex ? 550 : 750};min-height:54px;${tintaCore}}
.pl-tri{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}
.pl-tri .pl-ln{height:50px}
.pl-passo{display:flex;align-items:flex-end;gap:14px;margin-top:10px}
.pl-passo .pl-rotulo{white-space:nowrap;margin:0 0 10px}.pl-passo .pl-caixa{margin-bottom:8px}.pl-passo .pl-ln{flex:1;height:50px}
/* minha semana */
.pl-hab{display:grid;grid-template-columns:minmax(0,1fr) repeat(7,56px);column-gap:10px;row-gap:8px;align-items:center}
.pl-hab-cab{font-size:18px;font-weight:700;letter-spacing:1.6px}
.pl-dia{font-size:20px;font-weight:700;text-align:center}
.pl-hab-nome{font-size:27px;line-height:1.2;min-height:46px;min-width:0;display:flex;align-items:center;padding-right:10px;${tintaCore}}
.pl-hab-nome .pl-ln{flex:1;height:42px;margin-right:4px}
.pl-hab-mais{grid-column:1/-1;font-size:22px;font-weight:650;color:var(--f);line-height:40px}
.pl-hab i{justify-self:center;width:38px;height:38px;border-radius:50%;border:2px solid var(--w);background:#ffffff80}
.pl-agenda{display:grid;grid-template-columns:96px repeat(7,minmax(0,1fr));gap:8px;align-items:stretch}
.pl-ag-dia{font-size:19px;font-weight:700;letter-spacing:1.4px;text-align:center;display:flex;flex-direction:column;align-items:center}
.pl-ag-dia .pl-ln{width:60%;height:30px}
.pl-ag-hora{font-size:21px;font-weight:650;padding-top:10px}
.pl-agenda i{height:104px;border-radius:14px;background:#ffffffa6;border:2px solid var(--w)}
.pl-tarefa{display:flex;align-items:flex-end;gap:14px}.pl-tarefa .pl-caixa{margin-bottom:10px}.pl-tarefa .pl-ln{flex:1}
/* cofrinho */
.pl-cof{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:14px}
.pl-cof div{display:flex;flex-direction:column;justify-content:center;border-radius:18px;border:2px solid var(--w);background:#ffffff8c;text-align:center;padding:8px 4px;color:var(--tinta)}
.pl-cof div.ok{background:var(--${codex ? "f" : "x"});border-color:var(--${codex ? "f" : "x"});color:#fff}
.pl-cof div.ok small{opacity:1}
.pl-cof small{display:block;font-size:18px;opacity:.85}.pl-cof b{font-size:30px;font-weight:750;line-height:1.15}
.pl-barra{margin-top:26px;height:18px;border-radius:99px;background:#ffffffa6;border:1.5px solid var(--l);overflow:hidden}
.pl-barra i{display:block;height:100%;background:var(--f)}
/* revisões (6 por folha) */
.pl-revs{flex:1;min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:24px}
.pl-revp{display:flex;flex-direction:column;padding:26px 32px 24px}
.pl-revp .pl-ptopo{margin-bottom:0}
.pl-rev{flex:1;min-height:0;display:flex;flex-direction:column}
.pl-rev .pl-rotulo{margin-top:10px}.pl-rev .pl-ln{height:50px}
/* áreas */
.pl-areas{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:1fr 1fr;gap:26px}
.pl-area{display:flex;flex-direction:column}
.pl-area .pl-q{font-size:25px;line-height:1.3;opacity:.95}
.pl-area .pl-ln{height:52px}
.pl-chk{display:flex;gap:24px;margin-top:18px;font-size:20px}.pl-chk>span{display:inline-flex;align-items:center;gap:10px}
/* rodapé */
.pl-rod{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;font-size:19px;color:var(--suave)}
.pl-rod>span:first-child{${codex ? "font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:30px;color:#626d55" : "font-weight:650"}}
.pl-f-capa .pl-rod{position:absolute;left:110px;right:110px;bottom:64px}
`;
}

/* crítica r1 (compradora ALTA 1): a janela de impressão no celular ficava com 591 px numa tela de 390, sem saída. Agora tem
 * uma barra fixa (só na tela) com "Voltar" e "Imprimir", e a folha cabe na largura (zoom calculado; na impressão volta
 * pros 210 mm). */
const BARRA_DA_IMPRESSAO = `<div class="pl-barra-imp" data-testid="planner-barra-impressao"><button type="button" id="pl-voltar">← Voltar</button><button type="button" id="pl-imprimir">Imprimir</button></div>`;
const SCRIPT_DA_IMPRESSAO = `<script>(function(){var r=document.documentElement;function z(){r.style.setProperty("--z",String(Math.min(.6395,(window.innerWidth-24)/${A4_PX.largura})))}z();window.addEventListener("resize",z);document.getElementById("pl-imprimir").onclick=function(){window.print()};document.getElementById("pl-voltar").onclick=function(){window.close();setTimeout(function(){if(!window.closed){if(history.length>1)history.back();else location.href="/desenvolvimento?tab=2027"}},250)}})()</script>`;

/** O documento inteiro pra imprimir no site (A4; cada folha numa página: zoom 1240px → 210 mm). */
export function htmlDoPlannerNovo(d: DadosDoPlanner, estilo: EstiloPlanner, origem = typeof location === "undefined" ? "" : location.origin): string {
  // as fontes do próprio site (Inter e Instrument Serif EMBARCADAS em /fonts, como o index.html): nada de Google na impressão
  const fonte = origem ? [
    `@font-face{font-family:'Inter';font-style:normal;font-weight:300 900;font-display:block;src:url(${origem}/fonts/inter-latin.woff2) format('woff2')}`,
    `@font-face{font-family:'Inter';font-style:normal;font-weight:300 900;font-display:block;src:url(${origem}/fonts/inter-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+20A0-20AB,U+20AD-20C0}`,
    `@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;font-display:block;src:url(${origem}/fonts/instrument-serif-italic-latin.woff2) format('woff2')}`,
  ].join("") : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planner 2027 · CORE</title>
<style>${fonte}
@page{size:A4;margin:0}
html,body{margin:0;background:#e7e5e4}
body{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px 0}
${cssDoPlanner(estilo)}
.pl .pg{zoom:.6395;box-shadow:0 2px 18px rgba(0,0,0,.12)}
@media screen{body{padding-top:76px;overflow-x:hidden}.pl .pg{zoom:var(--z,.6395)}}
.pl-barra-imp{position:fixed;top:0;left:0;right:0;z-index:9;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#fffffff2;border-bottom:1px solid #e5e5e5;font:600 15px/1.2 Inter,-apple-system,sans-serif}
.pl-barra-imp button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #d4d4d4;background:#fff;color:#262626;font:inherit;cursor:pointer}
.pl-barra-imp button+button{border:0;background:#262626;color:#fff;font-weight:800}
@media print{html,body{background:none}body{display:block;padding:0}.pl-barra-imp{display:none}.pl .pg{zoom:.6395;box-shadow:none;page-break-after:always;break-after:page}.pl .pg:last-child{page-break-after:auto;break-after:auto}}
</style></head><body class="pl pl-${estilo}">${BARRA_DA_IMPRESSAO}${folhasDoPlanner(d, estilo).join("")}${SCRIPT_DA_IMPRESSAO}</body></html>`;
}

/** Dados de exemplo (a miniatura da oferta e os prints): marcados como exemplo onde aparecem. */
export const EXEMPLO_DO_PLANNER: DadosDoPlanner = {
  plano: {
    v: 1, metas: ["Juntar R$ 5 mil de reserva", "Viajar pro Nordeste em julho", "Correr 5 km sem parar"], gastarMes: 3200, guardarMes: 450,
    datas: [
      { id: "a", tipo: "aniversario", titulo: "Aniversário da mãe", dia: "2027-03-14" },
      { id: "b", tipo: "checkup", titulo: "Check-up anual", dia: "2027-05-10" },
      { id: "c", tipo: "data", titulo: "Viagem pro Nordeste", dia: "2027-07-18" },
      { id: "d", tipo: "aniversario", titulo: "Aniversário da Bia", dia: "2027-09-02" },
      { id: "e", tipo: "data", titulo: "Renovar o seguro do carro", dia: "2027-11-20" },
    ],
    horaRevisao: "20:00", salvoEm: "2026-11-02T12:00:00.000Z", criadasMetas: [], revisoes: {},
  },
  cofrinho: { marcadas: [1, 2, 3, 4, 5, 6, 7, 8, 9], invertido: false },
  habitos: ["Água ao acordar", "Mover o corpo", "Ler 10 páginas", "Pausa sem tela", "Dormir mais cedo"],
  contas: [
    { nome: "Aluguel", valor: 1450, dia: 5 }, { nome: "Academia", valor: 149, dia: 10 }, { nome: "Internet", valor: 99.9, dia: 15 },
    { nome: "Celular", valor: 59.9, dia: 20 }, { nome: "Streaming", valor: 39.9, dia: 28 },
  ],
};
