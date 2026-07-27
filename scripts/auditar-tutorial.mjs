#!/usr/bin/env node
/**
 * AUDITORIA DO TUTORIAL — roda no gate de deploy.
 *
 * Por que existe (27/07). O dono achou dois bugs no mesmo dia — "no passo 9
 * crie um limite não tá passando pro 10" e o tour de Metas caindo em "não
 * estou encontrando este item na tela" — e a bronca foi justa: "não sei se é
 * você que tá codando ruim ou só reaproveitando código antigo sem ver
 * direito". Os dois eram a MESMA falha estrutural, não azar:
 *
 *   1. BECO SEM SAÍDA. Um passo cujo único jeito de avançar é o auto-avanço
 *      por dado (checkKey). Esse auto-avanço é DESLIGADO no "Rever tutorial"
 *      — senão o tour de quem já tem dados voa sozinho. Resultado: no replay
 *      o passo fica intransponível e o tutorial morre ali.
 *
 *   2. ALVO FANTASMA. Um selector que não existe em lugar nenhum do código —
 *      o tour para no cartão "não estou encontrando este item na tela".
 *
 * Este script relê os passos de TODOS os módulos e falha se qualquer um dos
 * dois voltar. É barato e determinístico: não abre navegador, só lê o fonte.
 *
 * Uso: node scripts/auditar-tutorial.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname;

const arquivos = (dir, acc = []) => {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.tsx?$/.test(nome)) acc.push(p);
  }
  return acc;
};

const todos = arquivos(join(RAIZ, "src"));

// 1. onde cada data-spotlight existe de fato
const alvosVivos = new Map();
for (const f of todos) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/data-spotlight="([^"]+)"/g)) {
    if (!alvosVivos.has(m[1])) alvosVivos.set(m[1], []);
    alvosVivos.get(m[1]).push(relative(RAIZ, f));
  }
}

// 2. os passos declarados em cada módulo
const passos = [];
for (const f of todos) {
  const src = readFileSync(f, "utf8");
  if (!src.includes("<SpotlightOverlay")) continue;
  const mod = (src.match(/moduleKey="([a-z]+)"/) || [])[1] ?? relative(RAIZ, f);
  for (const m of src.matchAll(/\{\s*selector:\s*'\[data-spotlight="([^"]+)"\]'(.*?)\},\s*\n/gs)) {
    const [, alvo, resto] = m;
    passos.push({
      modulo: mod,
      arquivo: relative(RAIZ, f),
      alvo,
      temAcao: /advanceOnAction:\s*"/.test(resto),
      temClique: !/advanceOnClick:\s*false/.test(resto),
      temDado: /checkKey:\s*"/.test(resto),
      podePular: /skippable:\s*true/.test(resto),
    });
  }
}

const fantasmas = passos.filter((p) => !alvosVivos.has(p.alvo));
// no replay o auto-avanço por DADO não vale — sobra ação, clique ou pular
const becos = passos.filter((p) => !p.temAcao && !p.temClique && !p.podePular);

console.log(`tutorial: ${passos.length} passos em ${new Set(passos.map((p) => p.modulo)).size} módulos`);

let falhou = false;
if (fantasmas.length) {
  falhou = true;
  console.error(`\n❌ ${fantasmas.length} passo(s) apontam pra um alvo que não existe:`);
  for (const p of fantasmas) console.error(`   ${p.modulo}: [data-spotlight="${p.alvo}"] — ${p.arquivo}`);
}
if (becos.length) {
  falhou = true;
  console.error(`\n❌ ${becos.length} passo(s) travam no "Rever tutorial" (só avançam por checkKey):`);
  for (const p of becos) console.error(`   ${p.modulo}: ${p.alvo} — dê um advanceOnAction, ou deixe avançar por clique, ou skippable`);
}

if (falhou) process.exit(1);
console.log("✅ nenhum alvo fantasma, nenhum passo sem saída");
