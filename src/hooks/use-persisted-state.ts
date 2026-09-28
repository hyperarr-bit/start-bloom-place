import { useState, useEffect, useCallback, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { normalizeForKey } from "@/lib/data-normalizers";

/**
 * Persisted state hook backed by useUserData (Supabase + localStorage).
 *
 * Design:
 * - On first mount, reads the latest value from the store (or `initial`).
 * - Writes update local state immediately and queue a debounced upsert.
 * - External changes to the same key (e.g. another component writing to it)
 *   are picked up via the `loaded` flag and a per-key broadcast, NOT by
 *   re-running on every store mutation (which previously caused unrelated
 *   key updates to revert local state with stale closures).
 *
 * MESMA CHAVE, DUAS TELAS (28/09): o comentário acima prometia a sincronia, mas
 * só a hidratação existia — a tarefa criada pela ação rápida da Home não
 * aparecia no widget "Tarefas de hoje" da mesma Home até recarregar. Agora cada
 * escrita avisa as outras instâncias DA MESMA CHAVE (evento na window, fora do
 * render); quem escreveu ignora o próprio aviso e nada é regravado no store.
 */
const EVENTO_MESMA_CHAVE = "core:persisted-state";
type AvisoDeEscrita = { key: string; json: string; value: unknown; origem: symbol };
export const usePersistedState = <T,>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const { get, set: setData, loaded, isGuest, fetchKey } = useUserData();

  const [state, setState] = useState<T>(() => normalizeForKey(key, get(key, initial)));
  const lastWrittenJson = useRef<string>(JSON.stringify(state));
  const hydratedRef = useRef(false);
  // Último valor, síncrono: o setter calcula o próximo a partir daqui e grava
  // no store FORA do updater do setState. Gravar dentro do updater atualizava
  // o provider no meio do render do componente ("Cannot update a component
  // while rendering a different component", varredura 26/09).
  const latestRef = useRef<T>(state);
  const origem = useRef<symbol>(Symbol(key));

  // Outra instância gravou a mesma chave: adota o valor (sem regravar no store).
  useEffect(() => {
    const aoOuvir = (e: Event) => {
      const d = (e as CustomEvent<AvisoDeEscrita>).detail;
      if (!d || d.key !== key || d.origem === origem.current || d.json === lastWrittenJson.current) return;
      const valor = normalizeForKey(key, d.value as T);
      lastWrittenJson.current = d.json;
      latestRef.current = valor;
      setState(valor);
    };
    window.addEventListener(EVENTO_MESMA_CHAVE, aoOuvir);
    return () => window.removeEventListener(EVENTO_MESMA_CHAVE, aoOuvir);
  }, [key]);

  // Hydrate once after Supabase finishes its initial load.
  useEffect(() => {
    if (!loaded || hydratedRef.current) return;
    hydratedRef.current = true;
    const latest = normalizeForKey(key, get(key, initial));
    const latestJson = JSON.stringify(latest);
    if (latestJson !== lastWrittenJson.current) {
      lastWrittenJson.current = latestJson;
      latestRef.current = latest;
      setState(latest);
    }

    // CHAVE PESADA (bug 16/07, relatos reais: diário/refeições/wishlist "em
    // branco" ao reabrir): a carga inicial PULA chaves ≥50KB (por design, pra
    // não pesar o boot) esperando busca sob demanda — que ninguém fazia. Num
    // aparelho/sessão sem cache local a aba abria vazia e a PRÓXIMA escrita
    // sobrescrevia o histórico inteiro. Aqui: se o store não tem a chave,
    // busca no servidor; só aplica se o usuário não escreveu nesse meio-tempo.
    if (!isGuest && get(key, undefined as unknown as T) === undefined) {
      const baseline = lastWrittenJson.current;
      fetchKey<T>(key).then((remote) => {
        if (remote == null) return;
        if (lastWrittenJson.current !== baseline) return; // usuário já escreveu — não atropela
        const norm = normalizeForKey(key, remote);
        lastWrittenJson.current = JSON.stringify(norm);
        latestRef.current = norm;
        setState(norm);
      }).catch(() => { /* sem rede: fica no estado atual */ });
    }
    // We only want this to fire once when `loaded` becomes true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const setPersistedState = useCallback((v: T | ((prev: T) => T)) => {
    const next = typeof v === "function" ? (v as (prev: T) => T)(latestRef.current) : v;
    const json = JSON.stringify(next);
    latestRef.current = next;
    lastWrittenJson.current = json;
    setState(next);
    setData(key, next);
    // fora da pilha atual: quem escreve pode estar no meio de um updater/render
    const aviso: AvisoDeEscrita = { key, json, value: next, origem: origem.current };
    queueMicrotask(() => window.dispatchEvent(new CustomEvent(EVENTO_MESMA_CHAVE, { detail: aviso })));
  }, [key, setData]);

  return [state, setPersistedState];
};
