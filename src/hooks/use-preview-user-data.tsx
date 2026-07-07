import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { getSeedsForModule } from "@/lib/preview-seeds";

/**
 * Provider de modo preview: substitui o contexto de useUserData por uma
 * versão in-memory pré-populada com seeds do módulo. Nada é persistido.
 */
export const PreviewUserDataProvider = ({
  moduleKey,
  children,
}: {
  moduleKey: string;
  children: ReactNode;
}) => {
  // Espelho global do store: componentes que leem localStorage direto
  // (storage-keys.ts) caem aqui quando não há usuário — sem isso os gráficos
  // de histórico e a comparação de meses ficam vazios na demo. Precisa ser
  // SÍNCRONO (no initializer, antes do primeiro render dos filhos): os
  // useMemo do Dashboard leem na montagem e não recalculam depois.
  const [store, setStore] = useState<Record<string, any>>(() => {
    const seeds = getSeedsForModule(moduleKey);
    if (typeof window !== "undefined") (window as any).__PREVIEW_SEEDS__ = { ...seeds };
    return seeds;
  });

  useEffect(() => {
    (window as any).__PREVIEW_SEEDS__ = { ...store };
  }, [store]);

  useEffect(() => {
    return () => { delete (window as any).__PREVIEW_SEEDS__; };
  }, []);

  const get = useCallback(<T,>(key: string, fallback: T): T => {
    return (key in store ? store[key] : fallback) as T;
  }, [store]);

  // Sem toast aqui: o banner do topo já sinaliza que é demo — deixa a pessoa
  // mexer à vontade sem interrupção.
  const set = useCallback((key: string, value: any) => {
    setStore((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fetchKey = useCallback(async <T,>(key: string): Promise<T | null> => {
    return (key in store ? store[key] : null) as T | null;
  }, [store]);

  const value = useMemo<UserDataContextType>(() => ({
    get,
    set,
    loaded: true,
    isGuest: true,
    fetchKey,
  }), [get, set, fetchKey]);

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
};
