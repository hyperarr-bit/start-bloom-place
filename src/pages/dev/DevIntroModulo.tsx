import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_FORCA_INTRO, _apagarIntroVista } from "@/lib/intro-modulo";
import { CATEGORIAS_PADRAO_MERCADO } from "@/lib/mercado";
import Financas from "@/pages/Index";
import Rotina from "@/pages/Rotina";
import Saude from "@/pages/Saude";
import Casa from "@/pages/Casa";

/**
 * /dev/intro-modulo — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). O módulo DE VERDADE numa conta VAZIA, em memória
 * (nada vai pro servidor, não precisa de conta), com a intro ligada por força de QA — pra
 * fotografar e gravar o protótipo de 16/10 (intro guiada em Finanças/Rotina/Saúde + estado
 * vazio da Casa).
 *   ?tela=financas | rotina | saude | casa        (padrão: financas)
 *   &cheio=1   · a Casa com a lista do mercado já em uso (pra GRAVAR a captura real)
 *   &sem=1     · sem a intro (a chave fica como está) — a tela de hoje, pra comparar
 * Cada carga apaga o "já vi" deste módulo neste navegador (dev: a intro sempre aparece).
 */
const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

const listaCheia = () => CATEGORIAS_PADRAO_MERCADO.map((c) => {
  const itens: Record<string, Array<[string, boolean]>> = {
    "1": [["Banana", true], ["Tomate", false], ["Alface", false]],
    "3": [["Leite", true], ["Queijo mussarela", false], ["Iogurte", false]],
    "4": [["Café", false], ["Arroz 5 kg", true], ["Azeite", false]],
    "5": [["Pão francês", false]],
    "7": [["Detergente", false], ["Papel higiênico", true]],
  };
  return { ...c, items: (itens[c.id] ?? []).map(([text, done], i) => ({ id: `${c.id}-${i}`, text, done })) };
});

const DevIntroModulo = () => {
  const [params] = useSearchParams();
  const tela = params.get("tela") ?? "financas";
  const cheio = params.get("cheio") === "1";
  const sem = params.get("sem") === "1";
  useMemo(() => {
    try {
      localStorage.setItem(CHAVE_FORCA_INTRO, sem ? "off" : "on");
      _apagarIntroVista(tela);
    } catch { /* noop */ }
  }, [tela, sem]);
  const inicial = useMemo<Record<string, unknown>>(() => ({
    "core-user-name": "Ana",
    // a conta nova não tem nada; só o "Dicas para começar" antigo fica escondido (a intro ocupa o lugar dele)
    ...(sem && !cheio ? {} : Object.fromEntries(["financas", "rotina", "saude", "casa"].map((m) => [`core-tip-seen-${m}`, "true"]))),
    ...(cheio && tela === "casa" ? { "casa-grocery-categories": listaCheia() } : {}),
  }), [sem, cheio, tela]);
  const pagina = tela === "rotina" ? <Rotina /> : tela === "saude" ? <Saude /> : tela === "casa" ? <Casa /> : <Financas />;
  return <Provedor inicial={inicial}>{pagina}</Provedor>;
};

export default DevIntroModulo;
