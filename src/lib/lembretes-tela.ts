/**
 * A ORGANIZAÇÃO DA TELA DE LEMBRETES (29/10, dono aprovou a direção A6 do mockup —
 * novidades-guardadas/2026-10-29/lembretes/). Só a ARRUMAÇÃO: as chaves gravadas, os padrões e as funções de
 * ligar/desligar/reagendar são as de sempre (pages/Notificacoes.tsx).
 *
 *  · ESSENCIAIS no topo, pelo USO REAL (pessoas únicas que receberam/tocaram desde 28/09: Remédios 139/88,
 *    Contas 99/25, Fechamento do dia 73/35, Compromissos 50/13) — nessa ordem.
 *  · POR MÓDULO, o resto: módulo com 1 lembrete mostra o interruptor na própria linha; com mais de 1, abre em sanfona.
 *  · Os 3 de ANIVERSÁRIO (véspera = notif-prefs.aniversario; no dia e 1 semana antes = rel-lembrete-prefs) ficam
 *    juntos em Relações, num bloco "Aniversários".
 *
 * Toda linha nova da central entra AQUI (e o teste lembretes-tela confere que nenhuma sumiu).
 */

/** Os 24 lembretes da central — um id por interruptor (o mesmo `campo` do evento notif_pref, quando há um). */
export const IDS_LEMBRETES = [
  "contas", "retrospectiva", "primeiraSemana", "remedios", "consultas",
  "aniversario", "rel_noDia", "rel_semana", "rel_contato",
  "compromissos", "tarefas", "pet", "casa",
  "limite", "sequencia", "skincare", "cabelo", "cuidados", "validade",
  "rotina_manha", "rotina", "treino", "leitura", "dieta",
] as const;
export type IdLembrete = (typeof IDS_LEMBRETES)[number];

export const ESSENCIAIS: readonly IdLembrete[] = ["remedios", "contas", "rotina", "compromissos"];

export interface BlocoDoGrupo { titulo?: string; itens: readonly IdLembrete[] }
export interface GrupoLembretes {
  /** id do módulo (cor da paleta da Home nova); "core" = a cor da marca */
  id: string;
  nome: string;
  /** legenda curta da linha fechada (só nos grupos com mais de 1) */
  legenda?: string;
  blocos: readonly BlocoDoGrupo[];
}

export const GRUPOS: readonly GrupoLembretes[] = [
  { id: "financas", nome: "Finanças", blocos: [{ itens: ["limite"] }] },
  { id: "rotina", nome: "Rotina", legenda: "Tarefas e manhã", blocos: [{ itens: ["tarefas", "rotina_manha"] }] },
  { id: "saude", nome: "Saúde", blocos: [{ itens: ["consultas"] }] },
  {
    id: "relacionamentos", nome: "Relações", legenda: "Aniversários e contato",
    blocos: [{ titulo: "Aniversários", itens: ["rel_semana", "aniversario", "rel_noDia"] }, { titulo: "Contato", itens: ["rel_contato"] }],
  },
  { id: "treino", nome: "Treino", blocos: [{ itens: ["treino"] }] },
  { id: "biblioteca", nome: "Biblioteca", blocos: [{ itens: ["leitura"] }] },
  { id: "dieta", nome: "Dieta", blocos: [{ itens: ["dieta"] }] },
  { id: "casa", nome: "Casa", blocos: [{ itens: ["casa"] }] },
  { id: "beleza", nome: "Beleza", legenda: "Pele, cabelo, unha, validade", blocos: [{ itens: ["skincare", "cabelo", "cuidados", "validade"] }] },
  { id: "pet", nome: "Pet", blocos: [{ itens: ["pet"] }] },
  { id: "core", nome: "Do CORE", legenda: "1ª semana, mês, sequência", blocos: [{ itens: ["primeiraSemana", "retrospectiva", "sequencia"] }] },
];

export const itensDoGrupo = (g: GrupoLembretes): IdLembrete[] => g.blocos.flatMap((b) => b.itens);

/** Todos os ids na ordem em que aparecem na tela (essenciais + grupos). */
export const ordemNaTela = (): IdLembrete[] => [...ESSENCIAIS, ...GRUPOS.flatMap(itensDoGrupo)];
