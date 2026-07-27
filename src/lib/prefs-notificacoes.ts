/**
 * Preferências de notificação (27/07).
 *
 * Por que uma central existe, e por que ela importa mais no Android do que
 * parece: quando o app não dá controle FINO, a única alavanca que sobra pra
 * quem se incomodou é desligar TUDO nas configurações do sistema — e isso é
 * irreversível do lado do app, o Android não deixa pedir de novo. Uma pessoa
 * que só queria parar de receber o aviso de conta acaba perdendo também a
 * retrospectiva, pra sempre.
 *
 * Então a central não é enfeite: é o para-raios que impede o desligamento
 * total. Cada tipo tem chave própria; desligar um não encosta nos outros.
 *
 * Guardado numa chave só (`notif-prefs`) porque o conjunto é lido inteiro a
 * cada reagendamento e nunca em pedaços.
 */

export interface PrefsNotificacoes {
  /** aviso na véspera das contas a vencer */
  contas: boolean;
  /** hora do aviso de contas (0–23) */
  horaContas: number;
  /** retrospectiva do mês, todo dia 1º */
  retrospectiva: boolean;
}

export const PREFS_PADRAO: PrefsNotificacoes = {
  contas: true,
  horaContas: 9, // cedo o bastante pra dar tempo de pagar
  retrospectiva: true,
};

export const CHAVE_PREFS = "notif-prefs";

/** Normaliza o que veio do storage — dado antigo/torto não pode virar crash. */
export const lerPrefs = (bruto: unknown): PrefsNotificacoes => {
  const p = (bruto ?? {}) as Partial<PrefsNotificacoes>;
  const hora = Number(p.horaContas);
  return {
    contas: p.contas !== false,
    horaContas: Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : PREFS_PADRAO.horaContas,
    retrospectiva: p.retrospectiva !== false,
  };
};

export const rotuloHora = (h: number) => `${String(h).padStart(2, "0")}:00`;
