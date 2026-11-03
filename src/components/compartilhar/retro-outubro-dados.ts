import { localDayKey } from "@/lib/utils";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { computeMonthlyOutflow } from "@/lib/finance-totals";
import { somaParcelasDoMes } from "@/lib/finance-parcelas";
import { aguaDoMes, atividadeDoMes, ehRetroCurta, habitoCampeao, lerDadosDaVida, lerFinancasDoMes, DIAS_MINIMOS_COMPLETA, REGISTROS_MINIMOS_COMPLETA, type AtividadeDoMes, type DadosDaVida, type FinancasDoMes, type Leitor } from "@/lib/retrospectiva";
import { lerMesesArquivados } from "@/components/gamification/badges-financas";
import { RETRO_OUTUBRO } from "@/lib/retro-outubro";
import { maiorCorrida } from "./calendario";
import { diaDoMes, diasNoMes, numeroBR, porcento } from "./textos";
import type { DadosRetroFechamento, DadosRetroPouco, DadosAgua, DadosAzul, DadosCard, DadosHabitos, DadosLancamentos, DadosLivros, DadosMetas, DadosRetroAbertura, DadosRetroResumo, DadosTreinos, ItemDoResumo, Livro, ModuloDaRetro } from "./tipos";

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
 *  4. POUCO USO (`poucoDado`, 30/10 — CRITERIO_POUCO_USO / usouPouco): o
 *     CAMINHO PRÓPRIO, curto, no estilo do Codex: abertura → 1 card por
 *     módulo realmente usado (basta 1 registro; no máximo 3, os mais fortes)
 *     → fechamento acolhedor com o convite pra novembro. Nada é inventado nem
 *     "completado"; nunca "no azul" (o pouco uso não sustenta).
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
  /** "abertura" · "financas" · "treino" · "rotina" · "agua" · "leitura" · "metas" · "resumo" · "fechamento" (pouco uso)
   *  · (02/11, só na tela cheia — retro-tela-cheia-dados.ts) "perfil" · "primeiro" · "dias" · "figurinhas" */
  id: "abertura" | ModuloDaRetro | "resumo" | "fechamento" | "perfil" | "primeiro" | "dias" | "figurinhas";
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
/** Os hábitos feitos num registro do dia (lista de nomes ou { nome: feito }), em minúsculas. */
const nomes = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()) : Object.entries(objeto(v)).filter(([, f]) => !!f).map(([n]) => n.trim().toLowerCase());

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

  const diasAteHoje = Number(hoje.slice(8, 10));
  if (usouPouco(atividade)) {
    return montarPoucoUso({ ler, dados, fin, ano, mesIdx, hoje, prefixo, noMes, diasAtivos, diasAteHoje, mostrarTextosDasMetas: !!opts.mostrarTextosDasMetas });
  }

  const modulos: CardDaRetro[] = [];
  const resumo: ItemDoResumo[] = [];
  /** A força de cada destaque (0–1), pra escolher os mini-cards da abertura. */
  const forca = new Map<ModuloDaRetro, number>();

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
    forca.set("financas", forcaDoDestaque.financas(av.dias.length, diasAteHoje));
    financas = "azul";
  } else if (av.lancamentos >= MINIMOS_RETRO.lancamentos) {
    const neutro: DadosLancamentos = { tipo: "lancamentos", ano, mesIdx, hoje, lancamentos: av.lancamentos, dias: av.dias };
    modulos.push({ id: "financas", dados: neutro });
    resumo.push({ modulo: "financas", numero: numeroBR(av.lancamentos), rotulo: "lançamentos anotados" });
    forca.set("financas", forcaDoDestaque.financas(av.dias.length, diasAteHoje));
    financas = "neutro";
  }

  // TREINO (os dias de `saude-workout-log`)
  const diasTreino = [...new Set(lista<string>(dados.treinos).filter(noMes).map((d) => d.slice(0, 10)))].sort();
  if (diasTreino.length >= MINIMOS_RETRO.treino) {
    const treino: DadosTreinos = { tipo: "treinos", periodo: "mes", ano, mesIdx, hoje, dias: diasTreino, melhorSequencia: maiorCorrida(diasTreino.map((d) => Number(d.slice(8, 10)))) };
    modulos.push({ id: "treino", dados: treino });
    resumo.push({ modulo: "treino", numero: String(diasTreino.length), rotulo: diasTreino.length === 1 ? "dia de treino" : "dias de treino" });
    forca.set("treino", forcaDoDestaque.treino(diasTreino.length, diasAteHoje));
  }

  // ROTINA (o hábito campeão)
  const campeao = habitoCampeao(ano, mesIdx, dados);
  if (campeao) {
    const alvo = campeao.nome.toLowerCase();
    const dias = new Set<string>();
    for (const reg of [dados.habitos, dados.habitosLegado]) for (const [k, v] of Object.entries(reg ?? {})) if (noMes(k) && nomes(v).includes(alvo)) dias.add(k.slice(0, 10));
    if (dias.size >= MINIMOS_RETRO.rotina) {
      const hab: DadosHabitos = { tipo: "habitos", ano, mesIdx, hoje, habito: campeao.nome, dias: [...dias].sort() };
      modulos.push({ id: "rotina", dados: hab });
      resumo.push({ modulo: "rotina", numero: String(dias.size), rotulo: `dias de ${campeao.nome.toLowerCase()}` });
      forca.set("rotina", forcaDoDestaque.rotina(dias.size, diasAteHoje));
    }
  }

  // ÁGUA (a maior do dia entre water-log e core-saude-water; a meta da pessoa, padrão 8 copos)
  const meta = dados.metaAgua && dados.metaAgua > 0 ? dados.metaAgua : 8;
  const agua = aguaDoMes(ano, mesIdx, dados);
  const porDia = Array.from({ length: diasAteHoje }, (_, i) => (agua.porDia.get(i + 1) ?? 0) / meta);
  const naMeta = porDia.filter((f) => f >= 1).length;
  if (naMeta >= MINIMOS_RETRO.agua) {
    const a: DadosAgua = { tipo: "agua", ano, mesIdx, hoje, porDia };
    modulos.push({ id: "agua", dados: a });
    resumo.push({ modulo: "agua", numero: String(naMeta), rotulo: "dias na meta de água" });
    forca.set("agua", forcaDoDestaque.agua(naMeta, diasAteHoje));
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
    forca.set("leitura", forcaDoDestaque.leitura(lidos.length));
  }

  // METAS (month-goals["2026-10"]; os textos só com a escolha da pessoa)
  type Meta = { text?: unknown; done?: unknown };
  const metas = lista<Meta>(objeto(ler("month-goals"))[prefixo.slice(0, 7)]).filter((m) => m && texto(m.text));
  const feitas = metas.filter((m) => !!m.done);
  if (feitas.length >= MINIMOS_RETRO.metas) {
    const m: DadosMetas = { tipo: "metas", ano, mesIdx, feitas: feitas.length, total: metas.length, textos: [...feitas, ...metas.filter((x) => !x.done)].map((x) => texto(x.text)), mostrarTextos: !!opts.mostrarTextosDasMetas };
    modulos.push({ id: "metas", dados: m });
    resumo.push({ modulo: "metas", numero: `${feitas.length}/${metas.length}`, rotulo: feitas.length === 1 ? "meta batida" : "metas batidas" });
    forca.set("metas", forcaDoDestaque.metas(feitas.length, metas.length));
  }

  if (!modulos.length && !diasAtivos.length) return null;

  const abertura: DadosRetroAbertura = { tipo: "retro-abertura", ano, mesIdx, hoje, dias: diasAtivos, modulos: modulos.map((c) => c.id as ModuloDaRetro), destaques: escolherDestaques(resumo, forca), pouco: false };
  const fim: DadosRetroResumo = { tipo: "retro-resumo", ano, mesIdx, itens: resumo, diasComRegistro: diasAtivos.length };
  return {
    ano,
    mesIdx,
    cards: [{ id: "abertura", dados: abertura }, ...modulos, { id: "resumo", dados: fim }],
    poucoDado: false,
    financas,
  };
}

/**
 * QUEM USOU POUCO (30/10) — ~67% dos ativos de outubro, mediana de 2 dias
 * ativos. Vai pro caminho curto quando, contando TUDO que tem data no mês
 * (atividadeDoMes, a mesma conta da retrospectiva de setembro):
 *  · menos de 5 dias com registro, OU
 *  · menos de 15 registros no mês (a régua da retrospectiva curta), OU
 *  · começou do dia 22 em diante e tem menos de 8 dias com registro (chegou
 *    no fim do mês: o calendário dos cards completos ficaria quase vazio).
 * Sem nenhum registro: montarRetroOutubro devolve null e a tela mostra a
 * tela acolhedora do Codex ("Seu mês não cabe só aqui.").
 */
export const CRITERIO_POUCO_USO = {
  diasMin: DIAS_MINIMOS_COMPLETA,
  registrosMin: REGISTROS_MINIMOS_COMPLETA,
  comecouAPartirDoDia: 22,
  diasMinSeComecouTarde: 8,
} as const;

export const usouPouco = (a: AtividadeDoMes) =>
  ehRetroCurta(a) ||
  (a.primeiroDia != null && a.primeiroDia >= CRITERIO_POUCO_USO.comecouAPartirDoDia && a.diasComRegistro < CRITERIO_POUCO_USO.diasMinSeComecouTarde);

/** Quantos cards de módulo o pouco uso mostra, no máximo. */
export const MAX_MODULOS_POUCO = 3;

interface ContextoPouco {
  ler: Leitor; dados: DadosDaVida; fin: FinancasDoMes; ano: number; mesIdx: number; hoje: string; prefixo: string;
  noMes: (d: unknown) => d is string; diasAtivos: string[]; diasAteHoje: number; mostrarTextosDasMetas: boolean;
}

/**
 * O CAMINHO DO POUCO USO: cada módulo com PELO MENOS 1 registro vira um
 * candidato (o número e os dias de verdade); ficam os 3 mais fortes
 * (forcaDoDestaque), na ordem da sequência. Treino, Rotina, Água e Finanças
 * viram o card "um registro" do Codex (retro-pouco); Leitura e Metas usam os
 * cards de sempre (já são contagem, sem calendário vazio). Fecha com o
 * fechamento acolhedor. Finanças é sempre a contagem de lançamentos (nunca
 * "no azul", nunca R$).
 */
function montarPoucoUso(c: ContextoPouco): RetroOutubro | null {
  const { ler, dados, fin, ano, mesIdx, hoje, prefixo, noMes, diasAtivos, diasAteHoje } = c;
  type Candidato = { item: ItemDoResumo; card: DadosCard };
  const candidatos: Candidato[] = [];
  const forca = new Map<ModuloDaRetro, number>();
  const pouco = (modulo: ModuloDaRetro, n: number, um: string, varios: string, dias: string[]): Candidato => {
    const rotulo = n === 1 ? um : varios;
    const card: DadosRetroPouco = { tipo: "retro-pouco", modulo, ano, mesIdx, numero: numeroBR(n), rotulo: `${rotulo}.`, dias };
    return { item: { modulo, numero: numeroBR(n), rotulo }, card };
  };

  // FINANÇAS: os lançamentos com data (nunca "no azul" aqui)
  const av = avaliarFinancas(fin, prefixo, hoje);
  if (av.lancamentos >= 1) {
    candidatos.push(pouco("financas", av.lancamentos, "lançamento anotado", "lançamentos anotados", av.dias));
    forca.set("financas", forcaDoDestaque.financas(av.dias.length, diasAteHoje));
  }
  // TREINO
  const diasTreino = [...new Set(lista<string>(dados.treinos).filter(noMes).map((d) => d.slice(0, 10)))].sort();
  if (diasTreino.length >= 1) {
    candidatos.push(pouco("treino", diasTreino.length, "dia de treino", "dias de treino", diasTreino));
    forca.set("treino", forcaDoDestaque.treino(diasTreino.length, diasAteHoje));
  }
  // ROTINA: o hábito feito em mais dias (basta 1; empate: o que apareceu antes)
  const porHabito = new Map<string, { nome: string; dias: Set<string> }>();
  for (const reg of [dados.habitos, dados.habitosLegado]) {
    for (const [k, v] of Object.entries(reg ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (!noMes(k)) continue;
      const originais = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : Object.entries(objeto(v)).filter(([, f]) => !!f).map(([n]) => n);
      for (const nome of originais) {
        const chave = nome.trim().toLowerCase();
        if (!chave) continue;
        const h = porHabito.get(chave) ?? { nome: nome.trim(), dias: new Set<string>() };
        h.dias.add(k.slice(0, 10));
        porHabito.set(chave, h);
      }
    }
  }
  let campeao: { nome: string; dias: Set<string> } | null = null;
  for (const h of porHabito.values()) if (!campeao || h.dias.size > campeao.dias.size) campeao = h;
  if (campeao) {
    const nome = campeao.nome.toLowerCase();
    candidatos.push(pouco("rotina", campeao.dias.size, `dia de ${nome}`, `dias de ${nome}`, [...campeao.dias].sort()));
    forca.set("rotina", forcaDoDestaque.rotina(campeao.dias.size, diasAteHoje));
  }
  // ÁGUA: os dias na meta da pessoa; sem nenhum, os dias com água anotada
  const meta = dados.metaAgua && dados.metaAgua > 0 ? dados.metaAgua : 8;
  const agua = aguaDoMes(ano, mesIdx, dados);
  const diasDeAgua = (fn: (copos: number) => boolean) => Array.from({ length: diasAteHoje }, (_, i) => i + 1).filter((d) => fn(agua.porDia.get(d) ?? 0)).map((d) => diaDoMes(ano, mesIdx, d));
  const naMeta = diasDeAgua((x) => x >= meta);
  const anotada = diasDeAgua((x) => x > 0);
  if (naMeta.length >= 1) {
    candidatos.push(pouco("agua", naMeta.length, "dia na meta de água", "dias na meta de água", naMeta));
    forca.set("agua", forcaDoDestaque.agua(naMeta.length, diasAteHoje));
  } else if (anotada.length >= 1) {
    candidatos.push(pouco("agua", anotada.length, "dia com água anotada", "dias com água anotada", anotada));
    forca.set("agua", forcaDoDestaque.agua(anotada.length, diasAteHoje) / 2);
  }
  // LEITURA: o card de sempre (as capas)
  type LivroSalvo = { title?: unknown; author?: unknown; cover?: unknown; pages?: unknown; status?: unknown; endDate?: unknown };
  const lidos = lista<LivroSalvo>(ler("lib-books")).filter((b) => b?.status === "lido" && noMes(b.endDate)).sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  if (lidos.length >= 1) {
    const l: DadosLivros = { tipo: "livros", periodo: "mes", ano, mesIdx, livros: lidos.map((b): Livro => ({ titulo: texto(b.title) || "Sem título", autor: texto(b.author) || undefined, capa: texto(b.cover) || undefined, paginas: Number(b.pages) > 0 ? Number(b.pages) : undefined })) };
    candidatos.push({ item: { modulo: "leitura", numero: String(lidos.length), rotulo: lidos.length === 1 ? "livro lido" : "livros lidos" }, card: l });
    forca.set("leitura", forcaDoDestaque.leitura(lidos.length));
  }
  // METAS: o card de sempre (os textos tapados por padrão)
  type Meta = { text?: unknown; done?: unknown };
  const metas = lista<Meta>(objeto(ler("month-goals"))[prefixo.slice(0, 7)]).filter((m) => m && texto(m.text));
  const feitas = metas.filter((m) => !!m.done);
  if (feitas.length >= 1) {
    const m: DadosMetas = { tipo: "metas", ano, mesIdx, feitas: feitas.length, total: metas.length, textos: [...feitas, ...metas.filter((x) => !x.done)].map((x) => texto(x.text)), mostrarTextos: c.mostrarTextosDasMetas };
    candidatos.push({ item: { modulo: "metas", numero: `${feitas.length}/${metas.length}`, rotulo: feitas.length === 1 ? "meta batida" : "metas batidas" }, card: m });
    forca.set("metas", forcaDoDestaque.metas(feitas.length, metas.length));
  }

  if (!candidatos.length && !diasAtivos.length) return null;

  const escolhidos = escolherDestaques(candidatos.map((x) => x.item), forca).slice(0, MAX_MODULOS_POUCO);
  const usados = escolhidos.map((it) => candidatos.find((x) => x.item.modulo === it.modulo)!);
  const abertura: DadosRetroAbertura = { tipo: "retro-abertura", ano, mesIdx, hoje, dias: diasAtivos, modulos: usados.map((x) => x.item.modulo), destaques: escolhidos, pouco: true };
  const fechamento: DadosRetroFechamento = { tipo: "retro-fechamento", ano, mesIdx, diasComRegistro: diasAtivos.length, modulos: usados.map((x) => x.item.modulo) };
  return {
    ano,
    mesIdx,
    cards: [{ id: "abertura", dados: abertura }, ...usados.map((x): CardDaRetro => ({ id: x.item.modulo, dados: x.card })), { id: "fechamento", dados: fechamento }],
    poucoDado: true,
    financas: usados.some((x) => x.item.modulo === "financas") ? "neutro" : null,
  };
}

/**
 * A FORÇA de cada destaque (30/10, os mini-cards da abertura): quanto do mês
 * aquele card cobre, de 0 a 1. Régua simples e explicável:
 *  · Finanças (azul ou neutro), Rotina, Água: dias com registro ÷ dias do mês até hoje;
 *  · Treino: dias de treino ÷ METADE dos dias (treinar dia sim, dia não já é o máximo);
 *  · Leitura: livros ÷ 2 (2 livros no mês já é o máximo);
 *  · Metas: feitas ÷ total do mês.
 */
export const forcaDoDestaque = {
  financas: (diasComLancamento: number, diasDoMes: number) => Math.min(1, diasComLancamento / Math.max(1, diasDoMes)),
  treino: (dias: number, diasDoMes: number) => Math.min(1, dias / Math.max(1, diasDoMes / 2)),
  rotina: (dias: number, diasDoMes: number) => Math.min(1, dias / Math.max(1, diasDoMes)),
  agua: (dias: number, diasDoMes: number) => Math.min(1, dias / Math.max(1, diasDoMes)),
  leitura: (livros: number) => Math.min(1, livros / 2),
  metas: (feitas: number, total: number) => Math.min(1, feitas / Math.max(1, total)),
};

/** Quantos mini-cards a abertura tem, no máximo. */
export const MAX_DESTAQUES = 3;

/**
 * Os mini-cards da abertura: os até 3 itens do resumo com mais força (empate:
 * o que vem antes na sequência), de volta na ORDEM DA SEQUÊNCIA (a abertura
 * antecipa os cards na ordem em que eles vêm).
 */
export function escolherDestaques(resumo: ItemDoResumo[], forca: Map<ModuloDaRetro, number>): ItemDoResumo[] {
  const fortes = resumo
    .map((item, i) => ({ item, i, f: forca.get(item.modulo) ?? 0 }))
    .sort((a, b) => b.f - a.f || a.i - b.i)
    .slice(0, MAX_DESTAQUES);
  return fortes.sort((a, b) => a.i - b.i).map((x) => x.item);
}

/** Liga/desliga o R$ e os textos das metas num card (os interruptores da tela). */
export function comEscolhas(d: DadosCard, escolhas: { valores: boolean; textosDasMetas: boolean }): DadosCard {
  if (d.tipo === "azul") return { ...d, valoresLigados: escolhas.valores };
  if (d.tipo === "metas") return { ...d, mostrarTextos: escolhas.textosDasMetas };
  return d;
}
