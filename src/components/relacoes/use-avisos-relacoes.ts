import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_PREFS, lerPrefs, PREFS_PADRAO } from "@/lib/prefs-notificacoes";
import { armarAvisos } from "@/lib/armar-avisos";
import type { Leitor } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";
import { CHAVE_LEMBRETE_RELACOES, lerLembreteRelacoes, type LembreteRelacoes } from "@/lib/relacoes-lembrete";

/**
 * Os três avisos de Relações vistos de dentro do módulo (29/09): a VÉSPERA é o
 * interruptor de sempre (`notif-prefs.aniversario`, o mesmo da central), o NO
 * DIA e o MANTER CONTATO moram na chave nova `rel-lembrete-prefs`. Gravar
 * rearma no sistema e pede a permissão no primeiro "ligar".
 */
type Bruto = Record<string, unknown>;

export function useAvisosRelacoes() {
  const { get, set } = useUserData();
  const brutoPrefs = get<unknown>(CHAVE_PREFS, undefined);
  const prefsApp = lerPrefs(brutoPrefs);
  const brutoRel = get<unknown>(CHAVE_LEMBRETE_RELACOES, undefined);
  const rel = lerLembreteRelacoes(brutoRel);
  const vespera = { ligado: prefsApp.aniversario, hora: prefsApp.horaAniversario };
  const algumLigado = vespera.ligado || rel.noDia.ligado || rel.semana.ligado || rel.contato.ligado;

  /** Grava e rearma no sistema (pede a permissão no primeiro "ligar", como as tarefas com horário). */
  const aplicar = (mudancaApp: Partial<{ aniversario: boolean; horaAniversario: number }>, mudancaRel: Partial<LembreteRelacoes>, ligou: boolean) => {
    const sobrepor: Record<string, unknown> = {};
    if (Object.keys(mudancaApp).length) {
      // o objeto CRU com a mudança: campo que esta tela não conhece continua lá
      const base = (brutoPrefs && typeof brutoPrefs === "object" && !Array.isArray(brutoPrefs) ? brutoPrefs : {}) as Bruto;
      const novo = { ...PREFS_PADRAO, ...base, ...mudancaApp };
      set(CHAVE_PREFS, novo);
      sobrepor[CHAVE_PREFS] = novo;
    }
    if (Object.keys(mudancaRel).length) {
      const novo = { ...rel, ...mudancaRel };
      set(CHAVE_LEMBRETE_RELACOES, novo);
      sobrepor[CHAVE_LEMBRETE_RELACOES] = novo;
    }
    const leitor: Leitor = (k, fb) => (k in sobrepor ? (sobrepor[k] as typeof fb) : get(k, fb));
    void armarAvisos(leitor, sobrepor, ligou, { nome: "relacoes_permissao", total: 1 });
  };

  return {
    vespera, rel, algumLigado,
    ligarVespera: (v: boolean) => { trackEvent("notif_pref", { campo: "aniversario", valor: v, origem: "relacoes" }); aplicar({ aniversario: v }, {}, v); },
    horaVespera: (h: number) => aplicar({ horaAniversario: h }, {}, false),
    ligarNoDia: (v: boolean) => { trackEvent("notif_pref", { campo: "rel_no_dia", valor: v, origem: "relacoes" }); aplicar({}, { noDia: { ...rel.noDia, ligado: v } }, v); },
    horaNoDia: (h: string) => aplicar({}, { noDia: { ...rel.noDia, hora: h } }, false),
    ligarSemana: (v: boolean) => { trackEvent("notif_pref", { campo: "rel_semana", valor: v, origem: "relacoes" }); aplicar({}, { semana: { ...rel.semana, ligado: v } }, v); },
    horaSemana: (h: string) => aplicar({}, { semana: { ...rel.semana, hora: h } }, false),
    ligarContato: (v: boolean) => { trackEvent("notif_pref", { campo: "rel_contato", valor: v, origem: "relacoes" }); aplicar({}, { contato: { ...rel.contato, ligado: v } }, v); },
    horaContato: (h: string) => aplicar({}, { contato: { ...rel.contato, hora: h } }, false),
  };
}

export type AvisosRelacoes = ReturnType<typeof useAvisosRelacoes>;

