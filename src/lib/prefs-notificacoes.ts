/**
 * Preferências de notificação (27/07).
 *
 * Por que uma central existe, e por que ela importa mais no Android do que
 * parece: quando o app não dá controle FINO, a única alavanca que sobra pra
 * quem se incomodou é desligar TUDO nas configurações do sistema — e isso é
 * irreversível do lado do app, o Android não deixa pedir de novo. Uma pessoa
 * que só queria parar o aviso de conta acaba perdendo também a retrospectiva,
 * pra sempre.
 *
 * Então a central não é enfeite: é o para-raios que impede o desligamento
 * total. Cada tipo tem chave própria; desligar um não encosta nos outros.
 *
 * QUEM NASCE LIGADO (e por quê): só conta a vencer e retrospectiva. As duas
 * são raras e têm consequência real — perder o vencimento custa juros, e a
 * retrospectiva é uma vez por mês. Os lembretes de rotina, treino, leitura e
 * dieta são DIÁRIOS: ligar isso sozinho no app de alguém é a diferença entre
 * um app útil e um app que a pessoa desinstala na primeira semana. Ficam
 * disponíveis, desligados, esperando ser escolhidos.
 */

export interface PrefsNotificacoes {
  /** aviso na véspera das contas a vencer */
  contas: boolean;
  horaContas: number;
  /** retrospectiva do mês, todo dia 1º */
  retrospectiva: boolean;
  /** fechamento do dia: hábitos da rotina */
  rotina: boolean;
  horaRotina: number;
  /** só nos dias marcados como dia de treino */
  treino: boolean;
  horaTreino: number;
  /** 3× por semana, só se existe livro em andamento */
  leitura: boolean;
  horaLeitura: number;
  /** fechar o diário da dieta */
  dieta: boolean;
  horaDieta: number;
}

/**
 * Os horários padrão são ESCALONADOS de propósito.
 *
 * Com tudo ligado, dois lembretes no mesmo minuto chegam empilhados e o app
 * parece quebrado (apareceu no aparelho: rotina e leitura caíam juntos às
 * 21h). Cada um pega um horário que também faz sentido sozinho: treino antes
 * da academia encher, dieta no fim do jantar, rotina no fecho do dia, leitura
 * na hora de deitar.
 */
export const PREFS_PADRAO: PrefsNotificacoes = {
  contas: true,
  horaContas: 9, // cedo o bastante pra dar tempo de pagar
  retrospectiva: true,
  rotina: false,
  horaRotina: 21, // fecho do dia: ainda dá pra marcar o que fez
  treino: false,
  horaTreino: 18, // antes do horário em que a academia esvazia
  leitura: false,
  horaLeitura: 22, // hora de deitar — o momento em que ler é realista
  dieta: false,
  horaDieta: 20,
};

export const CHAVE_PREFS = "notif-prefs";

const horaValida = (v: unknown, padrao: number) => {
  const h = Number(v);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : padrao;
};

/** Normaliza o que veio do storage — dado antigo/torto não pode virar crash. */
export const lerPrefs = (bruto: unknown): PrefsNotificacoes => {
  const p = (bruto ?? {}) as Partial<PrefsNotificacoes>;
  return {
    // os que nascem ligados só desligam se alguém disse explicitamente `false`
    contas: p.contas !== false,
    horaContas: horaValida(p.horaContas, PREFS_PADRAO.horaContas),
    retrospectiva: p.retrospectiva !== false,
    // os diários só ligam se alguém disse explicitamente `true`
    rotina: p.rotina === true,
    horaRotina: horaValida(p.horaRotina, PREFS_PADRAO.horaRotina),
    treino: p.treino === true,
    horaTreino: horaValida(p.horaTreino, PREFS_PADRAO.horaTreino),
    leitura: p.leitura === true,
    horaLeitura: horaValida(p.horaLeitura, PREFS_PADRAO.horaLeitura),
    dieta: p.dieta === true,
    horaDieta: horaValida(p.horaDieta, PREFS_PADRAO.horaDieta),
  };
};

export const rotuloHora = (h: number) => `${String(h).padStart(2, "0")}:00`;
