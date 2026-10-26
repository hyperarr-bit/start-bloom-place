#!/usr/bin/env node
/**
 * MINIATURAS DAS FIGURINHAS (varredura 26/10, Conquistas › "Ver todas" em branco ao rolar rápido).
 *
 * A grade da coleção desenhava cada figurinha a partir da arte de 640×640 (~1,6 MB decodificada cada; ~160 MB as 99)
 * pra mostrar em ≤ 96 pt. Aqui geramos UMA miniatura por figurinha usada no app (as do mapa ARTES_CADERNO), com
 * MINI_PX de lado (3× o maior tamanho da célula no iPhone, 96 pt → nitidez igual), em
 * src/assets/conquistas-caderno/mini/<id>.webp. O mapa ARTES_MINI (artes-caderno-mini.ts) as lê por glob.
 *
 * Rodar de novo sempre que uma arte do caderno mudar ou entrar: `node scripts/miniaturas-figurinhas.mjs`
 * (há um teste que falha se faltar miniatura de alguma figurinha do mapa — src/test/miniaturas-figurinhas.test.ts).
 */
import { createServer } from "vite";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MINI_PX = 288;
const SAIDA = path.join(RAIZ, "src/assets/conquistas-caderno/mini");

// o mapa id → arte de verdade, pelo próprio Vite (resolve os imports e os import.meta.glob do artes-caderno.ts)
const vite = await createServer({ root: RAIZ, configFile: false, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom", resolve: { alias: { "@": path.join(RAIZ, "src") } } });
let mapa;
try {
  ({ ARTES_CADERNO: mapa } = await vite.ssrLoadModule("/src/components/conquistas/artes-caderno.ts"));
} finally {
  await vite.close();
}

fs.mkdirSync(SAIDA, { recursive: true });
const ids = Object.keys(mapa).sort();
const usados = new Set();
let antes = 0, depois = 0;
for (const id of ids) {
  const url = String(mapa[id]).split("?")[0];
  const fonte = url.startsWith("/@fs/") ? url.slice(4) : path.join(RAIZ, url);
  if (!fs.existsSync(fonte)) throw new Error(`arte não encontrada pra ${id}: ${url}`);
  const destino = path.join(SAIDA, `${id}.webp`);
  usados.add(`${id}.webp`);
  await sharp(fonte).resize(MINI_PX, MINI_PX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(destino);
  antes += fs.statSync(fonte).size;
  depois += fs.statSync(destino).size;
}
// miniatura de figurinha que saiu do mapa: fora (não vai pro app)
for (const f of fs.readdirSync(SAIDA)) if (!usados.has(f)) fs.rmSync(path.join(SAIDA, f));
console.log(`${ids.length} miniaturas de ${MINI_PX}px em ${path.relative(RAIZ, SAIDA)} — ${(depois / 1024).toFixed(0)} KB (as artes de origem: ${(antes / 1024).toFixed(0)} KB)`);
