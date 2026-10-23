import { localDayKey } from "@/lib/utils";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { computeMonthlyOutflow } from "@/lib/finance-totals";
import { somaParcelasDoMes } from "@/lib/finance-parcelas";
import { aguaDoMes, atividadeDoMes, ehRetroCurta, habitoCampeao, lerDadosDaVida, lerFinancasDoMes, type FinancasDoMes, type Leitor } from "@/lib/retrospectiva";
import { lerMesesArquivados } from "@/components/gamification/badges-financas";
import { RETRO_OUTUBRO } from "@/lib/retro-outubro";
import { maiorCorrida } from "./calendario";
import { diaDoMes, diasNoMes, numeroBR, porcento } from "./textos";
import type { DadosAgua, DadosAzul, DadosCard, DadosHabitos, DadosLancamentos, DadosLivros, DadosMetas, DadosRetroAbertura, DadosRetroResumo, DadosTreinos, ItemDoResumo, Livro, ModuloDaRetro } from "./tipos";

/**
 * OS DADOS DA RETROSPECTIVA DE OUTUBRO (23/10) — conta pura, testada em
 * src/test/retro-outubro.test.tsx. Lê as MESMAS chaves e as MESMAS contas da
 * retrospectiva de setembro (lib/retrospectiva.ts) e dos cards de 29/09.
 *
 * REGRAS (não quebrar):
 *  1. JANELA: só o que tem data de 01/10 a 31/10 (dia local "AAAA-MM-DD"
 *     começando com "2026-10-"). Antes de 01/11 (só o QA vê) o "hoje" corta
 *     os dias que ainda não chegaram.
 *  2. SÓ MÓDULO COM REGISTRO DE VERDADE, com o mínimo abaixo (MINIMOS_RETRO).
 *     Módulo sem o mínimo NÃO tem card — nunca card vazio, nunca "0 treinos".
 *  3. ABERTURA E RESUMO SEMPRE (quando a retrospectiva existe). Sem nenhum
 *     card de módulo e sem nenhum dia com registro → null (a tela fica com a
 *     retrospectiva antiga; ninguém vê uma sequência vazia).
 *  4. POUCO DADO (`poucoDado`, a mesma régua da retrospectiva curta de
 *     setembro: < 5 dias com registro ou < 15 registros): a sequência é só
 *     abertura → o(s) card(s) que tem → resumo. Nada é inventado nem
 *     "completado".
 *  5. DINHEIRO: R$ nunca por padrão (`valoresLigados` começa false; quem liga
 *     é o interruptor da tela, por sessão). Sem R$, o card mostra %.
 *  6. "FECHOU NO AZUL" SÓ COM O MÊS ANOTADO (CRITERIO_AZUL): pelo menos 1
 *     entrada; pelo menos 10 saídas lançadas (gastos + fixos + parcelas);
 *     gastos com data em pelo menos 8 dias diferentes; algum gasto do dia 24
 *     em diante (a pessoa acompanhou até o fim do mês); e entrou − saiu > 0.
 *     Faltou qualquer um → o card de Finanças é o NEUTRO ("87 lançamentos
 *     anotados", o calendário dos dias com lançamento), que não diz se
 *     sobrou. Os meses ANTERIORES da corrida usam a régua do badge "mês no
 *     azul" que já está no ar (lerMesesArquivados: receita + ≥ 5 gastos).
 *  7. METAS: os textos são da pessoa — vão TAPADOS por padrão
 *     (`mostrarTextos` false; a tela tem o interruptor).
 *  8. LIVROS: as capas são o `cover` que a Biblioteca guarda em `lib-books`
 *     (URL do Storage ou a importada pelo fetch-book-metadata: Google Books,
 *     Open Library, Amazon). Sem capa (ou a imagem não vem com CORS), a capa
 *     tipográfica com título/autor (postar.ts › prepararCapas).
 */

export const MINIMOS_RETRO = {
  /** dias distintos com treino */
  treino: 2,
  /** dias do hábito campeão */
  rotina: 3,
  /** dias na meta de água */
  agua: 3,
  /** livros terminados no mês */
  leitura: 1,
  /** metas do mês marcadas como feitas */
  metas: 1,
  /** lançamentos com data no mês (o card neutro de Finanças) */
  lancamentos: 5,
} as const;

export const CRITERIO_AZUL = {
  entradasMin: 1,
  saidasMin: 10,
  diasComGastoMin: 8,
  ultimoGastoAPartirDoDia: 24,
} as const;

export interface CardDaRetro {
  /** "abertura" · "financas" · "treino" · "rotina" · "agua" · "leitura" · "metas" · "resumo" */
  id: "abertura" | ModuloDaRetro | "resumo";
  dados: DadosCard;
}

export interface RetroOutubro {
  ano: number;
  mesIdx: number;
  cards: CardDaRetro[];
  poucoDado: boolean;
  /** Finanças: "azul" (passou no critério) · "neutro" (só o que foi anotado) · null (sem card). */
  financas: "azul" | "neutro" | null;
}

type Item = { id?: unknown; date?: unknown; value?: unknown; perfil?: unknown };
const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const valor = (i: Item) => Number(i?.value) || 0;
const soma = (itens: Item[]) => itens.reduce((s, i) => s + valor(i), 0);

/** O resultado de Finanças do mês: passa no critério do azul? E os dias com lançamento. */
export function avaliarFinancas(fin: FinancasDoMes, prefixo: string, hoje: string) {
  const datado = (i: Item) => typeof i?.date === "string" && i.date.trim().startsWith(prefixo) && i.date.trim().slice(0, 10) <= hoje;
  const gastos = (fin.expenses as Item[]).filter(datado);
  const entradas = (fin.incomes as Item[]).filter(datado);
  const receitas = soma(fin.incomes as Item[]);
  const saiu = computeMonthlyOutflow(soma(fin.expenses as Item[]), soma(fin.fixed as Item[]), somaParcelasDoMes(fin.parcelas), fin.avulsas ?? 0);
  const saidas = fin.expenses.length + fin.fixed.length + fin.parcelas.length;
  const diasGasto = [...new Set(gastos.map((g) => String(g.date).trim().slice(0, 10)))];
  const ultimoDiaGasto = diasGasto.length ? Math.max(...diasGasto.map((d) => Number(d.slice(8, 10)))) : 0;
  const saldo = receitas - saiu;
  const azul =
    entradas.length >= CRITERIO_AZUL.entradasMin &&
    receitas > 0 &&
    saidas >= CRITERIO_AZUL.saidasMin &&
    diasGasto.length >= CRITERIO_AZUL.diasComGastoMin &&
    ultimoDiaGasto >= CRITERIO_AZUL.ultimoGastoAPartirDoDia &&
    saldo > 0;
  const dias = [...new Set([...gastos, ...entradas].map((i) => String(i.date).trim().slice(0, 10)))].sort();
  return { azul, receitas, saiu, saldo, lancamentos: gastos.length + entradas.length, dias };
}

/**
 * Monta a retrospectiva de outubro. `agora` decide o "hoje" (antes de 01/11,
 * só o QA, corta os dias que não chegaram). null = nada pra mostrar.
 */
export function montarRetroOutubro(ler: Leitor, opts: { agora?: Date; valoresLigados?: boolean; mostrarTextosDasMetas?: boolean; ano?: number; mesIdx?: number } = {}): RetroOutubro | null {
  const agora = opts.agora ?? new Date();
  const ano = opts.ano ?? RETRO_OUTUBRO.ano;
  const mesIdx = opts.mesIdx ?? RETRO_OUTUBRO.mesIdx;
  const ultimo = diaDoMes(ano, mesIdx, diasNoMes(ano, mesIdx));
  const hojeLocal = localDayKey(agora);
  const hoje = hojeLocal < ultimo ? hojeLocal : ultimo;
  const prefixo = diaDoMes(ano, mesIdx, 1).slice(0, 8); // "2026-10-"
  const noMes = (d: unknown): d is string => typeof d === "string" && d.startsWith(prefixo) && d.slice(0, 10) <= hoje;
  const dados = lerDadosDaVida(ler);
  const perfil = texto(ler("finance-perfil-ativo")) || PERFIL_PESSOAL;
  const fin = lerFinancasDoMes(ano, mesIdx, ler, perfil, agora);
  const atividade = atividadeDoMes(ano, mesIdx, dados, fin);
  const diasAtivos = atividade.dias.map((d) => diaDoMes(ano, mesIdx, d)).filter((d) => d <= hoje);
  const valoresLigados = !!opts.valoresLigados;

  const modulos: CardDaRetro[] = [];
  const resumo: ItemDoResumo[] = [];

  // FINANÇAS
  let financas: RetroOutubro["financas"] = null;
  const av = avaliarFinancas(fin, prefixo, hoje);
  if (av.azul) {
    // a corrida: os meses ANTERIORES no azul (régua do badge), terminando em outubro
    const antes = [];
    const get = <T,>(k: string, fb: T): T => { const v = ler(k); return (v === undefined || v === null ? fb : v) as T; };
    for (const m of lerMesesArquivados(get, new Date(ano, mesIdx, 15), perfil)) {
      if (!m.medido || m.saldo <= 0) break;
      antes.push({ mes: m.mes, pct: m.receitas > 0 ? Math.round((m.saldo / m.receitas) * 100) : null, saldo: m.saldo });
    }
    const pct = Math.round((av.saldo / av.receitas) * 100);
    const azul: DadosAzul = { tipo: "azul", meses: [...antes.reverse(), { mes: prefixo.slice(0, 7), pct, saldo: av.saldo }], valoresLigados };
    modulos.push({ id: "financas", dados: azul });
    resumo.push({ modulo: "financas", numero: porcento(pct), rotulo: "sobrou, no azul" });
    financas = "azul";
  } else if (av.lancamentos >= MINIMOS_RETRO.lancamentos) {
    const neutro: DadosLancamentos = { tipo: "lancamentos", ano, mesIdx, hoje, lancamentos: av.lancamentos, dias: av.dias };
    modulos.push({ id: "financas", dados: neutro });
    resumo.push({ modulo: "financas", numero: numeroBR(av.lancamentos), rotulo: "lançamentos anotados" });
    financas = "neutro";
  }

  // TREINO (os dias de `saude-workout-log`)
  const diasTreino = [...new Set(lista<string>(dados.treinos).filter(noMes).map((d) => d.slice(0, 10)))].sort();
  if (diasTreino.length >= MINIMOS_RETRO.treino) {
    const treino: DadosTreinos = { tipo: "treinos", periodo: "mes", ano, mesIdx, hoje, dias: diasTreino, melhorSequencia: maiorCorrida(diasTreino.map((d) => Number(d.slice(8, 10)))) };
    modulos.push({ id: "treino", dados: treino });
    resumo.push({ modulo: "treino", numero: String(diasTreino.length), rotulo: diasTreino.length === 1 ? "dia de treino" : "dias de treino" });
  }

  // ROTINA (o hábito campeão)
  const campeao = habitoCampeao(ano, mesIdx, dados);
  if (campeao) {
    const alvo = campeao.nome.toLowerCase();
    const nomes = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()) : Object.entries(objeto(v)).filter(([, f]) => !!f).map(([n]) => n.trim().toLowerCase());
    const dias = new Set<string>();
    for (const reg of [dados.habitos, dados.habitosLegado]) for (const [k, v] of Object.entries(reg ?? {})) if (noMes(k) && nomes(v).includes(alvo)) dias.add(k.slice(0, 10));
    if (dias.size >= MINIMOS_RETRO.rotina) {
      const hab: DadosHabitos = { tipo: "habitos", ano, mesIdx, hoje, habito: campeao.nome, dias: [...dias].sort() };
      modulos.push({ id: "rotina", dados: hab });
      resumo.push({ modulo: "rotina", numero: String(dias.size), rotulo: `dias de ${campeao.nome.toLowerCase()}` });
    }
  }

  // ÁGUA (a maior do dia entre water-log e core-saude-water; a meta da pessoa, padrão 8 copos)
  const meta = dados.metaAgua && dados.metaAgua > 0 ? dados.metaAgua : 8;
  const agua = aguaDoMes(ano, mesIdx, dados);
  const diasAteHoje = Number(hoje.slice(8, 10));
  const porDia = Array.from({ length: diasAteHoje }, (_, i) => (agua.porDia.get(i + 1) ?? 0) / meta);
  const naMeta = porDia.filter((f) => f >= 1).length;
  if (naMeta >= MINIMOS_RETRO.agua) {
    const a: DadosAgua = { tipo: "agua", ano, mesIdx, hoje, porDia };
    modulos.push({ id: "agua", dados: a });
    resumo.push({ modulo: "agua", numero: String(naMeta), rotulo: "dias na meta de água" });
  }

  // LEITURA (lib-books "lido" com fim no mês; a capa = `cover`)
  type LivroSalvo = { title?: unknown; author?: unknown; cover?: unknown; pages?: unknown; status?: unknown; endDate?: unknown };
  const lidos = (lista<LivroSalvo>(ler("lib-books")))
    .filter((b) => b?.status === "lido" && noMes(b.endDate))
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  if (lidos.length >= MINIMOS_RETRO.leitura) {
    const paraCard = (b: LivroSalvo): Livro => ({ titulo: texto(b.title) || "Sem título", autor: texto(b.author) || undefined, capa: texto(b.cover) || undefined, paginas: Number(b.pages) > 0 ? Number(b.pages) : undefined });
    const metaDoAno = Number(ler("lib-year-goal")) || undefined;
    const noAno = lista<LivroSalvo>(ler("lib-books")).filter((b) => b?.status === "lido" && typeof b.endDate === "string" && b.endDate.startsWith(`${ano}-`) && b.endDate.slice(0, 10) <= hoje).length;
    const l: DadosLivros = { tipo: "livros", periodo: "mes", ano, mesIdx, livros: lidos.map(paraCard), ...(metaDoAno ? { metaDoAno, noAno } : {}) };
    modulos.push({ id: "leitura", dados: l });
    resumo.push({ modulo: "leitura", numero: String(lidos.length), rotulo: lidos.length === 1 ? "livro lido" : "livros lidos" });
  }

  // METAS (month-goals["2026-10"]; os textos só com a escolha da pessoa)
  type Meta = { text?: unknown; done?: unknown };
  const metas = lista<Meta>(objeto(ler("month-goals"))[prefixo.slice(0, 7)]).filter((m) => m && texto(m.text));
  const feitas = metas.filter((m) => !!m.done);
  if (feitas.length >= MINIMOS_RETRO.metas) {
    const m: DadosMetas = { tipo: "metas", ano, mesIdx, feitas: feitas.length, total: metas.length, textos: [...feitas, ...metas.filter((x) => !x.done)].map((x) => texto(x.text)), mostrarTextos: !!opts.mostrarTextosDasMetas };
    modulos.push({ id: "metas", dados: m });
    resumo.push({ modulo: "metas", numero: `${feitas.length}/${metas.length}`, rotulo: feitas.length === 1 ? "meta batida" : "metas batidas" });
  }

  if (!modulos.length && !diasAtivos.length) return null;

  const abertura: DadosRetroAbertura = { tipo: "retro-abertura", ano, mesIdx, hoje, dias: diasAtivos, modulos: modulos.map((c) => c.id as ModuloDaRetro) };
  const fim: DadosRetroResumo = { tipo: "retro-resumo", ano, mesIdx, itens: resumo, diasComRegistro: diasAtivos.length };
  return {
    ano,
    mesIdx,
    cards: [{ id: "abertura", dados: abertura }, ...modulos, { id: "resumo", dados: fim }],
    poucoDado: ehRetroCurta(atividade),
    financas,
  };
}

/** Liga/desliga o R$ e os textos das metas num card (os interruptores da tela). */
export function comEscolhas(d: DadosCard, escolhas: { valores: boolean; textosDasMetas: boolean }): DadosCard {
  if (d.tipo === "azul") return { ...d, valoresLigados: escolhas.valores };
  if (d.tipo === "metas") return { ...d, mostrarTextos: escolhas.textosDasMetas };
  return d;
}
