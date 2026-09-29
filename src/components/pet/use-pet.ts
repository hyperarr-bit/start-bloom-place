/**
 * Os dados do Pet pra todas as telas (29/09). Lê pelo `get` do useUserData —
 * que é o store vivo: o widget da Home, a aba HOJE e a SAÚDE enxergam a mesma
 * escrita na hora (usePersistedState é retrato por instância e já custou caro).
 *
 * TODA escrita parte do valor BRUTO gravado (não do "limpo"): campo que o app
 * antigo ou uma versão futura puser num item continua lá depois que o app novo
 * mexe nele. E nada é gravado só por abrir a tela.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import {
  CHAVE_CUIDADOS, CHAVE_DICAS, CHAVE_LEMBRETE, CHAVE_PESOS, CHAVE_PETS, CHAVE_REGISTROS, chaveRotinaDoDia, chaveTarefasDoPet, comMarca, comPeso,
  novoId, pesoTexto, petsValidos, type Pet, type TarefaDaRotina,
} from "@/lib/pet";
import { comCuidado, registrarAplicacao, type Cuidado, type LinhaDaCarteirinha, type Registro } from "@/lib/pet-cuidados";
import { lerPrefsLembretePet, type PrefsLembretePet } from "@/lib/pet-avisos";

/** "Hoje" que acompanha a virada do dia com a tela aberta (celular mantém a aba viva). */
export function useHoje(): string {
  const [hoje, setHoje] = useState(localDayKey());
  useEffect(() => {
    const sync = () => setHoje((h) => (h === localDayKey() ? h : localDayKey()));
    const visivel = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", visivel);
    window.addEventListener("focus", sync);
    const id = window.setInterval(sync, 60_000);
    return () => { document.removeEventListener("visibilitychange", visivel); window.removeEventListener("focus", sync); window.clearInterval(id); };
  }, []);
  return hoje;
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface DicasPet { home?: "nao"; avisos?: "nao" }

export function usePet() {
  const { get, set, loaded } = useUserData();
  const hoje = useHoje();
  const brutoPets = get<unknown>(CHAVE_PETS, []);
  const pets = useMemo(() => petsValidos(brutoPets), [brutoPets]);
  const cuidadosBrutos = get<unknown>(CHAVE_CUIDADOS, []);
  const registrosBrutos = get<unknown>(CHAVE_REGISTROS, []);
  const pesosBrutos = get<unknown>(CHAVE_PESOS, {});
  const rotinaHoje = get<unknown>(chaveRotinaDoDia(hoje), {});
  const prefsLembrete = lerPrefsLembretePet(get<unknown>(CHAVE_LEMBRETE, undefined));
  const dicasBrutas = get<unknown>(CHAVE_DICAS, {});
  const dicas = (dicasBrutas && typeof dicasBrutas === "object" && !Array.isArray(dicasBrutas) ? dicasBrutas : {}) as DicasPet;

  /* ── pets ── */
  const salvarPet = useCallback((pet: Pet) => {
    const atuais = lista(get<unknown>(CHAVE_PETS, []));
    const i = atuais.findIndex((p) => (p as Pet)?.id === pet.id);
    if (i < 0) { set(CHAVE_PETS, [...atuais, pet]); return; }
    const nova = [...atuais];
    nova[i] = { ...(atuais[i] as object), ...pet };
    set(CHAVE_PETS, nova);
  }, [get, set]);

  const apagarPet = useCallback((id: string) => {
    const atuais = lista(get<unknown>(CHAVE_PETS, []));
    set(CHAVE_PETS, atuais.filter((p) => (p as Pet)?.id !== id));
  }, [get, set]);

  /* ── rotina do dia ── */
  const marcar = useCallback((petId: string, itemId: string, valor: boolean) => {
    const chave = chaveRotinaDoDia(localDayKey());
    set(chave, comMarca(get<unknown>(chave, {}), petId, itemId, valor));
  }, [get, set]);

  const salvarTarefas = useCallback((petId: string, tarefas: TarefaDaRotina[]) => {
    set(chaveTarefasDoPet(petId), tarefas);
  }, [set]);

  /* ── carteirinha ── */
  const salvarCuidado = useCallback((c: Cuidado) => {
    set(CHAVE_CUIDADOS, comCuidado(get<unknown>(CHAVE_CUIDADOS, []), c));
  }, [get, set]);

  const salvarCuidados = useCallback((novos: Cuidado[]) => {
    set(CHAVE_CUIDADOS, [...lista(get<unknown>(CHAVE_CUIDADOS, [])), ...novos]);
  }, [get, set]);

  const apagarCuidado = useCallback((id: string) => {
    set(CHAVE_CUIDADOS, lista(get<unknown>(CHAVE_CUIDADOS, [])).filter((c) => (c as Cuidado)?.id !== id));
  }, [get, set]);

  /** "Feito" — grava em `pet-health` (a chave de sempre) e devolve como desfazer. */
  const aplicar = useCallback((linha: LinhaDaCarteirinha, dia: string, obs?: string) => {
    const { registro, cuidado } = registrarAplicacao(linha, dia, { obs });
    const antesRegs = get<unknown>(CHAVE_REGISTROS, []);
    const antesCuidados = get<unknown>(CHAVE_CUIDADOS, []);
    set(CHAVE_REGISTROS, [...lista(antesRegs), registro]);
    if (cuidado) set(CHAVE_CUIDADOS, comCuidado(antesCuidados, cuidado));
    return {
      registro,
      desfazer: () => {
        set(CHAVE_REGISTROS, lista(get<unknown>(CHAVE_REGISTROS, [])).filter((r) => (r as Registro)?.id !== registro.id));
        if (cuidado && linha.cuidado) set(CHAVE_CUIDADOS, comCuidado(get<unknown>(CHAVE_CUIDADOS, []), linha.cuidado));
      },
    };
  }, [get, set]);

  const apagarRegistro = useCallback((id: string) => {
    const antes = lista(get<unknown>(CHAVE_REGISTROS, []));
    const alvo = antes.find((r) => (r as Registro)?.id === id);
    set(CHAVE_REGISTROS, antes.filter((r) => (r as Registro)?.id !== id));
    return () => { if (alvo) set(CHAVE_REGISTROS, [...lista(get<unknown>(CHAVE_REGISTROS, [])), alvo]); };
  }, [get, set]);

  /* ── peso ── */
  const registrarPeso = useCallback((pet: Pet, kg: number, dia: string = localDayKey()) => {
    set(CHAVE_PESOS, comPeso(get<unknown>(CHAVE_PESOS, {}), pet.id, dia, kg));
    // o app antigo mostra `${weight} kg`: o campo de sempre acompanha o peso mais novo
    salvarPet({ ...pet, weight: pesoTexto(kg) });
  }, [get, set, salvarPet]);

  /* ── ajustes ── */
  const salvarPrefsLembrete = useCallback((p: PrefsLembretePet) => set(CHAVE_LEMBRETE, p), [set]);
  const salvarDicas = useCallback((d: DicasPet) => set(CHAVE_DICAS, { ...dicas, ...d }), [set, dicas]);

  return {
    loaded, hoje, pets, get, set,
    cuidadosBrutos, registrosBrutos, pesosBrutos, rotinaHoje, prefsLembrete, dicas,
    salvarPet, apagarPet, marcar, salvarTarefas, salvarCuidado, salvarCuidados, apagarCuidado, aplicar, apagarRegistro,
    registrarPeso, salvarPrefsLembrete, salvarDicas,
  };
}

export type UsePet = ReturnType<typeof usePet>;

export const novoPetId = () => novoId("p");
