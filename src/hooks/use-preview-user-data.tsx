import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { isNativeShell } from "@/lib/native-shell";

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

  /* ENDOWMENT DO FUNIL (varredura v83.4): a demo é in-memory de propósito,
   * mas o que o USUÁRIO cria precisa alcançar o recap do paywall ("O que
   * você construiu" — a chave core-demo-conta perdeu o escritor quando a
   * demo de chips morreu na v83.1 e o bloco subiu 100% inerte). O espelho é
   * SÓ a chave dedicada, nunca dados de módulo: copiar finance-dueDays pro
   * guest storage injetaria conta de EXEMPLO no app pós-compra.
   *
   * v83.5 (bug pego pelo dono): a exclusão precisa cobrir TODO nome que as
   * seeds possam materializar — o sync custo-fixo→conta criou "Plano de
   * saúde" (finance-fixed-expenses) no mount e o recap mostrou construção
   * FANTASMA pra quem não fez nada. Varre name+description do objeto de
   * seeds inteiro; só nome que NÃO existe em seed alguma é do usuário. */
  const nomesDaSeed = useMemo(() => {
    const nomes = new Set<string>();
    const varrer = (v: unknown) => {
      if (Array.isArray(v)) { v.forEach(varrer); return; }
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
          if ((k === "name" || k === "description") && typeof x === "string") nomes.add(x.trim().toLowerCase());
          else varrer(x);
        }
      }
    };
    // SEMPRE as seeds de finanças (além do módulo atual): o fantasma só nasce
    // do finance-dueDays, e a CURA precisa reconhecê-lo mesmo quando a demo
    // remonta em outro módulo (rotina não conhece "Plano de saúde").
    try { varrer(getSeedsForModule("financas")); } catch { /* noop */ }
    try { if (moduleKey !== "financas") varrer(getSeedsForModule(moduleKey)); } catch { /* noop */ }
    return nomes;
  }, [moduleKey]);

  // Cura do fantasma: aparelho que rodou a versão com o diff furado pode ter
  // nome de seed gravado como "construção" — apaga no primeiro mount.
  useEffect(() => {
    try {
      const cru = localStorage.getItem("guest:core-demo-conta");
      if (cru && nomesDaSeed.has(String(JSON.parse(cru)).trim().toLowerCase())) {
        localStorage.removeItem("guest:core-demo-conta");
      }
    } catch { /* noop */ }
  }, [nomesDaSeed]);

  // Sem toast aqui: o banner do topo já sinaliza que é demo — deixa a pessoa
  // mexer à vontade sem interrupção.
  const set = useCallback((key: string, value: any) => {
    try {
      if (key === "finance-dueDays" && isNativeShell()) {
        const nova = ((Array.isArray(value) ? value : []) as Array<{ bills?: Array<{ name?: string }> }>)
          .flatMap((d) => (Array.isArray(d?.bills) ? d.bills.map((b) => String(b?.name ?? "")) : []))
          .find((n) => n.trim() && !nomesDaSeed.has(n.trim().toLowerCase()));
        // mesmo formato do useUserData guest (guest:<chave> + JSON) — é de lá
        // que o useRecap lê no paywall.
        if (nova) localStorage.setItem("guest:core-demo-conta", JSON.stringify(nova));
      }
    } catch { /* endowment nunca derruba a demo */ }
    setStore((prev) => ({ ...prev, [key]: value }));
  }, [nomesDaSeed]);

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
