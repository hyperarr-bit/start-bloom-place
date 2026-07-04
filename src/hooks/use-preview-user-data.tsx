import { ReactNode, useCallback, useMemo, useState } from "react";
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
  const [store, setStore] = useState<Record<string, any>>(() => getSeedsForModule(moduleKey));

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
