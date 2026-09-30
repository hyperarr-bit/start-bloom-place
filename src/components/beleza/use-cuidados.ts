import { localDayKey } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";
import { avisarApagado } from "@/lib/desfazer";
import { CHAVE_COMPROMISSOS } from "@/lib/compromissos";
import { lancarGasto, type GastoLancado } from "@/lib/finance-lancar";
import {
  CHAVE_CUIDADOS, cuidadosValidos, marcarFeito, marcarHorario, novoCuidado, ordenarCuidados, semCompromisso,
  type Cuidado, type TipoCuidado,
} from "@/lib/beleza-cuidados";
import { armarAvisos } from "@/lib/armar-avisos";
import { useChaveDaBeleza } from "./estado-compartilhado";

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/**
 * CUIDADOS COM DATA, lidos e gravados DIRETO no store (sem cópia). Grava também em
 * `rotina-compromissos` (MARQUEI HORÁRIO) e em `finance-expenses` (Lançar em
 * Finanças) — sempre pelo caminho de quem é dono da chave (lib/compromissos,
 * lib/finance-lancar), e rearma os avisos com o valor novo.
 */
export function useCuidados() {
  const hoje = localDayKey();
  const { get, set } = useUserData();
  const [bruto, setCuidados] = useChaveDaBeleza<Cuidado[]>(CHAVE_CUIDADOS, []);
  const [, setCompromissosDaBeleza] = useChaveDaBeleza<unknown[]>(CHAVE_COMPROMISSOS, []);
  /* `rotina-compromissos` é da ROTINA (e o app antigo lê a mesma nuvem): toda escrita daqui parte
     da lista CRUA de agora — nada de filtrar por `compromissosValidos` antes de gravar, senão um
     compromisso que a tela não entende some da conta. Valor que não é lista (lixo) não é tocado. */
  const compromissosCrus = (): unknown[] | null => {
    const v = get<unknown>(CHAVE_COMPROMISSOS, []);
    return Array.isArray(v) ? v : v == null ? [] : null;
  };
  const setCompromissos = (lista: unknown[]) => { if (compromissosCrus() !== null) setCompromissosDaBeleza(lista); };
  const cuidados = cuidadosValidos(bruto);
  const ordenados = ordenarCuidados(cuidados, hoje);

  const rearmar = (sobrepor: Record<string, unknown>, pedir: boolean) =>
    void armarAvisos(get, sobrepor, pedir, { nome: "cuidado_permissao", total: 1 });

  const gravar = (nova: Cuidado[], pedir = false) => {
    setCuidados(nova);
    rearmar({ [CHAVE_CUIDADOS]: nova }, pedir);
  };

  const adicionar = (tipo: TipoCuidado, nome?: string, intervaloDias?: number): Cuidado => {
    const c = novoCuidado(tipo, novoId(), nome, intervaloDias);
    gravar([...cuidados, c]);
    return c;
  };

  const mudar = (id: string, patch: Partial<Cuidado>, pedir = false) =>
    gravar(cuidados.map((c) => (c.id === id ? { ...c, ...patch } : c)), pedir);

  /** FEITO: recalcula a próxima (última + intervalo). Devolve o cuidado atualizado. */
  const feito = (id: string, dia: string, dados: { preco?: number; local?: string } = {}): Cuidado | null => {
    const c = cuidados.find((x) => x.id === id);
    if (!c) return null;
    const novo = marcarFeito(c, dia, dados);
    gravar(cuidados.map((x) => (x.id === id ? novo : x)));
    return novo;
  };

  /** MARQUEI HORÁRIO: vira compromisso da Rotina (origem "beleza"), com aviso. */
  const marcar = (id: string, data: string, hora: string, aviso: number) => {
    const c = cuidados.find((x) => x.id === id);
    if (!c) return;
    const crus = compromissosCrus();
    if (crus === null) return;
    const r = marcarHorario(c, crus, data, hora, aviso, novoId());
    const lista = cuidados.map((x) => (x.id === id ? r.cuidado : x));
    setCuidados(lista);
    setCompromissos(r.compromissos);
    rearmar({ [CHAVE_CUIDADOS]: lista, [CHAVE_COMPROMISSOS]: r.compromissos }, aviso >= 0);
  };

  /** Desmarcar o horário: sai o compromisso da Rotina, a próxima volta a ser a do intervalo. */
  const desmarcar = (id: string) => {
    const c = cuidados.find((x) => x.id === id);
    if (!c?.horario) return;
    const compromissos = semCompromisso(compromissosCrus() ?? [], c.horario.compromissoId);
    const { horario: _h, ...resto } = c;
    const lista = cuidados.map((x) => (x.id === id ? (resto as Cuidado) : x));
    setCuidados(lista);
    setCompromissos(compromissos);
    rearmar({ [CHAVE_CUIDADOS]: lista, [CHAVE_COMPROMISSOS]: compromissos }, false);
  };

  const remover = (id: string) => {
    const idx = cuidados.findIndex((x) => x.id === id);
    const alvo = cuidados[idx];
    if (!alvo) return;
    const compromissosAntes = compromissosCrus() ?? [];
    const futuro = alvo.horario && alvo.horario.data >= hoje ? alvo.horario.compromissoId : null;
    const lista = cuidados.filter((x) => x.id !== id);
    setCuidados(lista);
    if (futuro) setCompromissos(semCompromisso(compromissosAntes, futuro));
    rearmar({ [CHAVE_CUIDADOS]: lista, ...(futuro ? { [CHAVE_COMPROMISSOS]: semCompromisso(compromissosAntes, futuro) } : {}) }, false);
    avisarApagado(`"${alvo.nome}" saiu dos cuidados`, () => {
      setCuidados((prev) => {
        const atual = cuidadosValidos(prev);
        return atual.some((x) => x.id === id) ? atual : [...atual.slice(0, idx), alvo, ...atual.slice(idx)];
      });
      if (futuro) setCompromissos(compromissosAntes);
    });
  };

  /** "Lançar em Finanças · Beleza": o gasto do cuidado no mês corrente (1 toque, nunca sozinho). */
  const lancar = (c: Cuidado, dia: string, valor: number): GastoLancado =>
    lancarGasto(get, set, { descricao: c.nome, valor, categoria: "beleza", data: dia });

  return { hoje, cuidados, ordenados, adicionar, mudar, feito, marcar, desmarcar, remover, lancar };
}

export type Cuidados = ReturnType<typeof useCuidados>;
