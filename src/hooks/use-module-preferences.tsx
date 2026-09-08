import { useState, useEffect, useCallback } from "react";
import { useUserData } from "@/hooks/use-user-data";

export interface ModulePrefs {
  favorites: string[];
  hidden: string[];
  /** Ordem escolhida pela pessoa (ids do ModuleDrawer). Vazia = ordem de fábrica
   *  com favoritos na frente. Ids que não estão aqui entram no fim, na ordem
   *  do catálogo — módulo novo aparece sozinho sem migração. */
  order: string[];
}

const KEY = "core-module-prefs";
const VAZIO: ModulePrefs = { favorites: [], hidden: [], order: [] };

// Dado salvo antes do `order` existir (ou corrompido) vira um ModulePrefs válido.
const sanear = (v: unknown): ModulePrefs => {
  const p = (v && typeof v === "object" ? v : {}) as Partial<ModulePrefs>;
  const lista = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : []);
  return { favorites: lista(p.favorites), hidden: lista(p.hidden), order: lista(p.order) };
};

export function useModulePreferences() {
  const { get, set: setData, loaded } = useUserData();
  const [prefs, setPrefs] = useState<ModulePrefs>(() => sanear(get(KEY, VAZIO)));

  // A GRAVAÇÃO SÓ DESTRAVA DEPOIS DA HIDRATAÇÃO (07/09). Este hook tinha o
  // MESMO bug que apagou os widgets da Home em 20/08 (ver use-home-widgets):
  // o efeito de gravação rodava no mount com o fallback vazio e escrevia
  // { favorites: [], hidden: [] } por cima do que estava no servidor — num
  // boot frio, os favoritos e os módulos ocultos da pessoa sumiam. Agora
  // que a ORDEM também mora aqui (avaliação: "poder mover a ordem das
  // coisas... deixar a tela inicial do seu jeito"), perder isso doeria
  // mais. `pronto` é estado, não ref, pelo mesmo motivo de lá: vira true num
  // render separado, e a primeira gravação já enxerga o estado hidratado.
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!loaded || pronto) return;
    setPrefs(sanear(get(KEY, VAZIO)));
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pronto]);

  useEffect(() => {
    if (!pronto) return;
    setData(KEY, prefs);
  }, [prefs, setData, pronto]);

  const toggleFavorite = (id: string) => {
    setPrefs(p => ({
      ...p,
      favorites: p.favorites.includes(id) ? p.favorites.filter(f => f !== id) : [...p.favorites, id],
    }));
  };

  const toggleHidden = (id: string) => {
    setPrefs(p => ({
      ...p,
      hidden: p.hidden.includes(id) ? p.hidden.filter(h => h !== id) : [...p.hidden, id],
    }));
  };

  const isFavorite = (id: string) => prefs.favorites.includes(id);
  const isHidden = (id: string) => prefs.hidden.includes(id);

  /** Ordena uma lista de módulos: ordem da pessoa se existir, senão favoritos
   *  na frente (o comportamento de sempre). */
  const ordenar = useCallback(<T extends { id: string }>(modulos: T[]): T[] => {
    if (prefs.order.length === 0) {
      return [...modulos].sort((a, b) => {
        const af = prefs.favorites.includes(a.id) ? 0 : 1;
        const bf = prefs.favorites.includes(b.id) ? 0 : 1;
        return af - bf;
      });
    }
    const pos = new Map(prefs.order.map((id, i) => [id, i]));
    const conhecidos = modulos.filter(m => pos.has(m.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    const novos = modulos.filter(m => !pos.has(m.id));
    return [...conhecidos, ...novos];
  }, [prefs.order, prefs.favorites]);

  /** Move um módulo uma casa pra cima (-1) ou pra baixo (+1) dentro da lista
   *  dada — a lista COMPLETA (com os ocultos) já passada por `ordenar`, na
   *  ordem que a tela mostra. A ordem inteira é gravada a partir dela, pra
   *  que "mover 1" não embaralhe o resto nem pule por cima de um oculto. */
  const moveModule = (id: string, direcao: -1 | 1, listaAtual: string[]) => {
    const base = [...listaAtual];
    const i = base.indexOf(id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= base.length) return;
    [base[i], base[j]] = [base[j], base[i]];
    setPrefs(p => ({ ...p, order: base }));
  };

  const setOrder = (order: string[]) => setPrefs(p => ({ ...p, order: [...order] }));

  return { prefs, toggleFavorite, toggleHidden, isFavorite, isHidden, ordenar, moveModule, setOrder, pronto };
}
