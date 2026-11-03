import { perfilEmFrase } from "@/components/wrapped/temas";
import type { Leitor } from "@/lib/retrospectiva";
import { montarRetroOutubro, type CardDaRetro, type RetroOutubro } from "./retro-outubro-dados";
import { diasMarcadosNoMes } from "./calendario";
import { nomeDoMes, numeroBR, palavra, UNIDADES } from "./textos";
import type { DadosCard, DadosRetroAbertura, DadosRetroExtra, DadosRetroPerfil, ItemDoResumo, ModuloDaRetro } from "./tipos";

/**
 * O QUE SÓ A RETROSPECTIVA EM TELA CHEIA TEM (02/11, pedido do dono depois da pesquisa do Spotify Wrapped).
 * Conta pura, testada em src/test/retro-tela-cheia-dados.test.ts. A tela clássica (chave "off") NÃO usa nada
 * daqui — ela continua byte a byte a de antes.
 *
 *  1. O PERFIL ("Seu outubro foi… Em movimento"): sai do módulo que a pessoa MAIS usou (a mesma régua de força
 *     dos destaques da abertura), com os nomes do perfil que o app já usa (lib/retrospectiva › perfilDoMes:
 *     "Cofre Forte", "Em Movimento", "Constância de Ferro"…, escritos com `perfilEmFrase`). A frase é o número de
 *     verdade dela. Entra antes do resumo. Pouco uso não ganha perfil (dois dias não sustentam um rótulo).
 *  2. OS EXTRAS DE QUEM USOU POUCO: o 1º registro do mês, os dias com algo anotado (`core-dias-anotados`) e as
 *     figurinhas ganhas no mês (`conquistas-desbloqueadas`). Só com dado; nunca "0".
 *  3. O "ADIVINHA": antes de UM card com número bom (treino, rotina, leitura ou água, nessa ordem), a pergunta
 *     com 3 opções (a certa + 2 perto dela). Só aparece se houver um número que valha a pergunta.
 */

/* ------------------------------------------------------------------------- *
 * 1. O PERFIL
 * ------------------------------------------------------------------------- */

interface Leitura { modulo: ModuloDaRetro; forca: number; nome: string; frase: string }

const diasAteHojeDe = (a: DadosRetroAbertura) => Math.max(1, Number(a.hoje.slice(8, 10)) || 1);

/** O que cada card de módulo diz sobre a pessoa (null = o card não sustenta um perfil). */
export function leituraDoCard(card: CardDaRetro, diasDoMes: number): Leitura | null {
  const d = card.dados;
  const mes = d.tipo !== "azul" && "mesIdx" in d ? nomeDoMes(d.mesIdx) : "outubro";
  switch (d.tipo) {
    case "azul": {
      const u = d.meses[d.meses.length - 1];
      const pct = u?.pct ?? null;
      const mesDoAzul = nomeDoMes(Number((u?.mes ?? "1970-10").slice(5, 7)) - 1);
      if (pct != null && pct >= 30) return { modulo: "financas", forca: 1, nome: "Cofre Forte", frase: `Guardou ${pct}% do que entrou em ${mesDoAzul}.` };
      return { modulo: "financas", forca: 0.9, nome: "Olho no Dinheiro", frase: pct != null ? `Fechou ${mesDoAzul} no azul: sobrou ${pct}% do que entrou.` : `Fechou ${mesDoAzul} no azul.` };
    }
    case "lancamentos": {
      const dias = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length;
      return { modulo: "financas", forca: Math.min(1, dias / diasDoMes), nome: "Olho no Dinheiro", frase: `${numeroBR(d.lancamentos)} ${d.lancamentos === 1 ? "lançamento anotado" : "lançamentos anotados"} em ${dias} ${palavra(dias, UNIDADES.dia)} de ${mes}.` };
    }
    case "treinos": {
      const n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length;
      return { modulo: "treino", forca: Math.min(1, n / Math.max(1, diasDoMes / 2)), nome: n >= 12 ? "Modo Atleta" : "Em Movimento", frase: `${n} ${palavra(n, UNIDADES.dia)} de treino em ${mes}.` };
    }
    case "habitos": {
      const n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length;
      const r = n / diasDoMes;
      return { modulo: "rotina", forca: Math.min(1, r), nome: r >= 0.8 ? "Constância de Ferro" : r >= 0.5 ? "Rotina Firme" : "Rotina em Construção", frase: `${capitalizarFrase(d.habito)} em ${n} dos ${diasDoMes} dias de ${mes}.` };
    }
    case "agua": {
      const n = d.porDia.filter((f) => f >= 1).length;
      return { modulo: "agua", forca: Math.min(1, n / diasDoMes), nome: n / diasDoMes >= 0.5 ? "Hidratação em Dia" : "De Olho na Água", frase: `${n} ${palavra(n, UNIDADES.dia)} na meta de água em ${mes}.` };
    }
    case "livros": {
      const n = d.livros.length;
      return { modulo: "leitura", forca: Math.min(1, n / 2), nome: n >= 3 ? "Devorando Livros" : "Página Virada", frase: n === 1 ? `Terminou “${d.livros[0].titulo}” em ${mes}.` : `Terminou ${n} livros em ${mes}.` };
    }
    case "metas": {
      const total = Math.max(d.total, d.feitas);
      return { modulo: "metas", forca: Math.min(1, d.feitas / Math.max(1, total)) * 0.8, nome: d.feitas >= total ? "Missão Cumprida" : "Foco nas Metas", frase: `Bateu ${d.feitas} de ${total} ${palavra(total, UNIDADES.meta)} de ${mes}.` };
    }
    default:
      return null;
  }
}

const capitalizarFrase = (s: string) => { const t = s.trim(); return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t; };

/** O perfil do mês (null = sem nenhum card de módulo, ou pouco uso). */
export function perfilDoOutubro(r: RetroOutubro): DadosRetroPerfil | null {
  if (r.poucoDado) return null;
  const abertura = r.cards.find((c) => c.dados.tipo === "retro-abertura")?.dados as DadosRetroAbertura | undefined;
  const resumo = r.cards.find((c) => c.dados.tipo === "retro-resumo")?.dados;
  if (!abertura || !resumo || resumo.tipo !== "retro-resumo") return null;
  const diasDoMes = diasAteHojeDe(abertura);
  const leituras = r.cards.map((c, i) => ({ l: leituraDoCard(c, diasDoMes), i })).filter((x): x is { l: Leitura; i: number } => !!x.l);
  if (!leituras.length) return null;
  // o mais forte; empate: o que vem antes na sequência
  const ordem = [...leituras].sort((a, b) => b.l.forca - a.l.forca || a.i - b.i);
  const escolhido = ordem[0].l;
  const tambem: ItemDoResumo[] = ordem.slice(1)
    .map((x) => resumo.itens.find((it) => it.modulo === x.l.modulo))
    .filter((x): x is ItemDoResumo => !!x)
    .slice(0, 2);
  return { tipo: "retro-perfil", ano: r.ano, mesIdx: r.mesIdx, modulo: escolhido.modulo, nome: perfilEmFrase(escolhido.nome), frase: escolhido.frase, tambem };
}

/* ------------------------------------------------------------------------- *
 * 2. OS EXTRAS DE QUEM USOU POUCO
 * ------------------------------------------------------------------------- */

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Os dias ("AAAA-MM-DD") que cada card de módulo do pouco uso mostra. */
const diasDoCard = (d: DadosCard): string[] => (d.tipo === "retro-pouco" ? d.dias : []);

/** Máximo de cards no meio (entre a abertura e o fechamento) no pouco uso, contando os extras. */
export const MAX_MEIO_POUCO = 6;

export function extrasDoPoucoUso(r: RetroOutubro, ler: Leitor): { antes: CardDaRetro[]; depois: CardDaRetro[] } {
  const vazio = { antes: [], depois: [] };
  if (!r.poucoDado) return vazio;
  const abertura = r.cards.find((c) => c.dados.tipo === "retro-abertura")?.dados as DadosRetroAbertura | undefined;
  if (!abertura) return vazio;
  const { ano, mesIdx, hoje } = abertura;
  const prefixo = hoje.slice(0, 8); // "2026-10-"
  const doMes = (d: unknown): d is string => ehDia(d) && d.startsWith(prefixo) && d.slice(0, 10) <= hoje;
  const mes = nomeDoMes(mesIdx);
  const modulos = r.cards.filter((c) => c.id !== "abertura" && c.id !== "fechamento" && c.id !== "resumo");
  const antes: CardDaRetro[] = [];
  const depois: CardDaRetro[] = [];

  // os dias com algo anotado: o registro do app (core-dias-anotados) somado aos dias com registro da retrospectiva
  const anotados = Array.isArray(ler("core-dias-anotados")) ? (ler("core-dias-anotados") as unknown[]) : [];
  const dias = [...new Set([...anotados.filter(doMes).map((d) => d.slice(0, 10)), ...abertura.dias.filter(doMes)])].sort();

  // o 1º registro do mês (só quando o mês teve mais de um dia — com um dia só, o card do módulo já é ele)
  const primeiro = [...abertura.dias].filter(doMes).sort()[0];
  if (primeiro && dias.length >= 2) {
    const dele = modulos.find((c) => diasDoCard(c.dados).includes(primeiro));
    const modulo = dele && dele.id !== "abertura" ? (dele.id as ModuloDaRetro) : undefined;
    const nomes: Record<ModuloDaRetro, string> = { financas: "Finanças", treino: "Treino", rotina: "Rotina", agua: "Água", leitura: "Leitura", metas: "Metas" };
    const e: DadosRetroExtra = { tipo: "retro-extra", extra: "primeiro", ano, mesIdx, numero: "1º", rotulo: `registro de ${mes}`, sub: modulo ? `foi em ${nomes[modulo]}` : "no CORE", dias: [primeiro], ...(modulo ? { modulo } : {}) };
    antes.push({ id: "primeiro", dados: e });
  }

  if (dias.length >= 2) {
    const e: DadosRetroExtra = { tipo: "retro-extra", extra: "dias", ano, mesIdx, numero: String(dias.length), rotulo: "dias com registro", sub: `no CORE, em ${mes}`, dias };
    depois.push({ id: "dias", dados: e });
  }

  // as figurinhas ganhas no mês ({ id: "AAAA-MM-DD" })
  const ganhas = Object.values(objeto(ler("conquistas-desbloqueadas"))).filter(doMes).map((d) => d.slice(0, 10));
  if (ganhas.length >= 1) {
    const n = ganhas.length;
    const e: DadosRetroExtra = { tipo: "retro-extra", extra: "figurinhas", ano, mesIdx, numero: String(n), rotulo: n === 1 ? "figurinha nova no álbum" : "figurinhas novas no álbum", sub: `ganhas em ${mes}`, dias: [...new Set(ganhas)].sort() };
    depois.push({ id: "figurinhas", dados: e });
  }

  // no máximo MAX_MEIO_POUCO no meio (os módulos ficam; os extras saem do fim)
  let sobra = Math.max(0, MAX_MEIO_POUCO - modulos.length);
  const caber = (l: CardDaRetro[]) => l.filter(() => (sobra > 0 ? (sobra--, true) : false));
  return { antes: caber(antes), depois: caber(depois) };
}

/* ------------------------------------------------------------------------- *
 * A sequência da tela cheia
 * ------------------------------------------------------------------------- */

/** A retrospectiva de outubro com o que só a tela cheia tem (o perfil; os extras do pouco uso). */
export function comExtrasDaTelaCheia(r: RetroOutubro, ler: Leitor): RetroOutubro {
  if (!r.poucoDado) {
    const perfil = perfilDoOutubro(r);
    if (!perfil) return r;
    const k = r.cards.findIndex((c) => c.id === "resumo");
    if (k < 0) return r;
    return { ...r, cards: [...r.cards.slice(0, k), { id: "perfil", dados: perfil }, ...r.cards.slice(k)] };
  }
  const { antes, depois } = extrasDoPoucoUso(r, ler);
  if (!antes.length && !depois.length) return r;
  const fim = r.cards.findIndex((c) => c.id === "fechamento");
  const meio = r.cards.slice(1, fim < 0 ? r.cards.length : fim);
  // o fechamento diz o MESMO número de dias do card "Seus dias" (que soma os dias com algo anotado no app)
  const dias = depois.find((c) => c.id === "dias")?.dados;
  const finais = (fim < 0 ? [] : r.cards.slice(fim)).map((c): CardDaRetro =>
    c.dados.tipo === "retro-fechamento" && dias?.tipo === "retro-extra" ? { ...c, dados: { ...c.dados, diasComRegistro: Math.max(c.dados.diasComRegistro, Number(dias.numero)) } } : c);
  return { ...r, cards: [r.cards[0], ...antes, ...meio, ...depois, ...finais] };
}

export function montarRetroTelaCheia(ler: Leitor, opts: Parameters<typeof montarRetroOutubro>[1] = {}): RetroOutubro | null {
  const r = montarRetroOutubro(ler, opts);
  return r ? comExtrasDaTelaCheia(r, ler) : null;
}

/* ------------------------------------------------------------------------- *
 * 3. O ADIVINHA
 * ------------------------------------------------------------------------- */

export interface Adivinha {
  /** O card que vem logo depois (a resposta). */
  antesDe: CardDaRetro["id"];
  modulo: ModuloDaRetro;
  pergunta: string;
  certo: number;
  /** As 3 opções, em ordem de tela. */
  opcoes: number[];
  /** "dias de treino" — o que aparece embaixo do número revelado. */
  unidade: string;
}

/** O mínimo pra valer a pergunta (um número pequeno demais não tem graça de adivinhar). */
export const MINIMO_ADIVINHA = { treino: 4, rotina: 5, leitura: 2, agua: 5 } as const;

/**
 * As 3 opções, em ordem crescente: a certa + 2 perto dela (passo de ~25%, no mínimo 1 pra livros e 2 pra dias),
 * entre 1 e o teto. A POSIÇÃO da certa muda com o número (resto por 3: 1ª, 2ª ou 3ª) — sem sorteio, o mesmo mês dá
 * a mesma tela; se o lado pedido passa do limite, vale o arranjo que cabe.
 */
export function opcoesDoAdivinha(certo: number, teto: number, passoMinimo = 2): number[] {
  const p = Math.max(passoMinimo, Math.round(certo * 0.25));
  const arranjos = [[certo, certo + p, certo + 2 * p], [certo - p, certo, certo + p], [certo - 2 * p, certo - p, certo]];
  const ok = (a: number[]) => a.every((v) => v >= 1 && v <= teto);
  const preferido = arranjos[certo % 3];
  if (ok(preferido)) return preferido;
  return arranjos.find(ok) ?? [];
}

export function adivinhaDaRetro(cards: CardDaRetro[]): Adivinha | null {
  const abertura = cards.find((c) => c.dados.tipo === "retro-abertura")?.dados as DadosRetroAbertura | undefined;
  const teto = abertura ? diasAteHojeDe(abertura) : 31;
  const mes = abertura ? nomeDoMes(abertura.mesIdx) : "outubro";
  const ordem: ModuloDaRetro[] = ["treino", "rotina", "leitura", "agua"];
  for (const modulo of ordem) {
    const card = cards.find((c) => c.id === modulo);
    if (!card) continue;
    const d = card.dados;
    let n = 0, pergunta = "", unidade = "", tetoDele = teto, passo = 2;
    if (d.tipo === "treinos") { n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length; pergunta = `Quantos dias você acha que treinou em ${mes}?`; unidade = palavra(n, ["dia de treino", "dias de treino"]); }
    else if (d.tipo === "habitos") { n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length; pergunta = `Em quantos dias de ${mes} você acha que fez “${d.habito.trim().toLowerCase()}”?`; unidade = `${palavra(n, UNIDADES.dia)} de ${d.habito.trim().toLowerCase()}`; }
    else if (d.tipo === "livros") { n = d.livros.length; pergunta = `Quantos livros você acha que terminou em ${mes}?`; unidade = n === 1 ? "livro lido" : "livros lidos"; tetoDele = Math.max(6, n + 4); passo = 1; }
    else if (d.tipo === "agua") { n = d.porDia.filter((f) => f >= 1).length; pergunta = `Em quantos dias de ${mes} você acha que bateu a meta de água?`; unidade = `${palavra(n, UNIDADES.dia)} na meta de água`; }
    else continue;
    if (n < MINIMO_ADIVINHA[modulo]) continue;
    const opcoes = opcoesDoAdivinha(n, tetoDele, passo);
    if (opcoes.length < 3) continue;
    return { antesDe: card.id, modulo, pergunta, certo: n, opcoes, unidade };
  }
  return null;
}
