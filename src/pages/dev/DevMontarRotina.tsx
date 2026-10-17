import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Rotina from "@/pages/Rotina";
import { MontarRotina } from "@/components/rotina/montar/MontarRotina";
import { CHAVE_MONTAR_ROTINA } from "@/lib/montar-rotina";

/**
 * /dev/montar-rotina — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de `import.meta.env.DEV`;
 * some do build). A ROTINA DE VERDADE numa conta VAZIA em memória (nada vai pro servidor, não precisa de conta)
 * com "Rotina pronta em 3 toques" por cima, como a missão abre (origem "missao") — pro dono aprovar e pros
 * prints (390×844, claro e escuro). Cada carga começa do zero (apaga o "já vi" deste navegador).
 *   ?tema=escuro   · tema escuro (a classe .dark no <html>, como o ThemeProvider faz)
 *   &espera=ms     · duração do "Montando…" (padrão 2200)
 *   &origem=modulo · a tela como se abrisse pelo módulo (padrão: missao)
 *   &guia=0        · sem o guia do 1º quadradinho (onPronto logo depois do "Montando")
 *   &manter=1      · não apaga o "já vi"/rascunho deste navegador (pra ver o "fechou no meio → volta")
 *   &so=rotina     · só a Rotina, sem a tela
 */
const Provedor = ({ children }: { children: ReactNode }) => {
  const [dados, setDados] = useState<Record<string, unknown>>({ "core-user-name": "Ana" });
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

export default function DevMontarRotina() {
  const [q] = useSearchParams();
  const escuro = q.get("tema") === "escuro";
  const espera = Number(q.get("espera") ?? 2200);
  const origem = q.get("origem") === "modulo" ? "modulo" : "missao";
  const guiar = q.get("guia") !== "0";
  const so = q.get("so") === "rotina";
  useMemo(() => {
    try {
      localStorage.setItem("core-theme-mode", escuro ? "dark" : "light");
      document.documentElement.classList.toggle("dark", escuro);
      if (q.get("manter") !== "1") localStorage.removeItem(CHAVE_MONTAR_ROTINA);
      localStorage.setItem("core-cartoes-vistos-rotina", new Date().toISOString());
    } catch { /* noop */ }
  }, [escuro, q]);
  const [aberta, setAberta] = useState(!so);
  return (
    <Provedor>
      <Rotina />
      {aberta && (
        <MontarRotina
          origem={origem}
          guiarPrimeiro={guiar}
          esperaMs={Number.isFinite(espera) ? espera : 2200}
          onPronto={() => setAberta(false)}
          onPular={() => setAberta(false)}
        />
      )}
    </Provedor>
  );
}
