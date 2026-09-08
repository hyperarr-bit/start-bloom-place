/**
 * ABAS OCULTÁVEIS POR MÓDULO (07/09).
 *
 * Duas avaliações da Play pediram a mesma coisa com palavras diferentes:
 *   "Opção de ocultar certas abas (ex. jejum intermitente)"
 *   "poder mover a ordem das coisas em todas as abas e poder deixar a tela
 *    inicial do seu jeito, mover, editar, ocultar"
 *
 * A pessoa não quer que a aba deixe de existir — quer que ela saia da frente.
 * Por isso o hook guarda só a lista de IDs OCULTOS (`abas-ocultas:{modulo}`),
 * nunca a lista de visíveis: uma aba nova que a gente lançar amanhã aparece
 * sozinha pra todo mundo, sem migração, e a que ela escondeu segue escondida.
 *
 * Regra dura: NUNCA deixa ocultar a última aba visível. Um módulo sem aba é
 * uma tela em branco sem botão de volta — e a pessoa culparia o app.
 *
 * COMO ADOTAR EM OUTRA PÁGINA (Dieta, Estudos, Saúde, Finanças...):
 *
 *   const TABS = [{ id: "semana", label: "SEMANA", icon: "📅" }, ...];
 *   const abas = useAbasOcultas("dieta", TABS);
 *   ...
 *   <AbasOcultaveis abas={abas} ativa={activeTab} onTrocar={setActiveTab} />
 *
 * O componente (src/components/ui/abas-ocultaveis.tsx) já cuida do menu "⋯",
 * do segurar-pra-ocultar, de "Mostrar abas ocultas" e de trocar a aba ativa
 * quando ela some. A página só precisa parar de mapear `tabs` na mão. Se a
 * página tem `data-spotlight="tab-xyz"` nos botões, o componente mantém —
 * o tutorial continua achando o alvo.
 *
 * O `moduloId` deve ser o mesmo id do módulo no ModuleDrawer ("rotina",
 * "desenvolvimento", "dieta"...) — assim a chave fica previsível pra quem
 * for depurar o user_data de alguém.
 */
import { useCallback, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";

export interface AbaOcultavel {
  id: string;
  label: string;
  icon?: string;
}

export interface AbasOcultas<T extends AbaOcultavel> {
  /** Abas que a pessoa ainda vê, na ordem original. */
  visiveis: T[];
  /** Abas escondidas, na ordem original — pra listar em "Mostrar abas ocultas". */
  ocultas: T[];
  /** Todas, na ordem original (a fonte). */
  todas: T[];
  /** Esconde uma aba. Devolve false (e não faz nada) se seria a última visível. */
  ocultar: (id: string) => boolean;
  mostrar: (id: string) => void;
  mostrarTodas: () => void;
  /** false quando só resta uma aba — o menu usa pra desabilitar "Ocultar". */
  podeOcultar: boolean;
}

export const chaveAbasOcultas = (moduloId: string) => `abas-ocultas:${moduloId}`;

export function useAbasOcultas<T extends AbaOcultavel>(moduloId: string, abas: T[]): AbasOcultas<T> {
  const [ocultasIds, setOcultasIds] = usePersistedState<string[]>(chaveAbasOcultas(moduloId), []);
  // Dado velho ou corrompido (string, objeto) não pode derrubar a barra de abas.
  const lista = useMemo(() => (Array.isArray(ocultasIds) ? ocultasIds.filter(x => typeof x === "string") : []), [ocultasIds]);

  const visiveis = useMemo(() => abas.filter(a => !lista.includes(a.id)), [abas, lista]);
  const ocultas = useMemo(() => abas.filter(a => lista.includes(a.id)), [abas, lista]);

  const ocultar = useCallback((id: string) => {
    const aindaVisiveis = abas.filter(a => !lista.includes(a.id));
    if (!aindaVisiveis.some(a => a.id === id)) return false; // já oculta ou não existe
    if (aindaVisiveis.length <= 1) return false;              // a última fica
    setOcultasIds([...lista, id]);
    return true;
  }, [abas, lista, setOcultasIds]);

  const mostrar = useCallback((id: string) => {
    setOcultasIds(lista.filter(x => x !== id));
  }, [lista, setOcultasIds]);

  const mostrarTodas = useCallback(() => setOcultasIds([]), [setOcultasIds]);

  return { visiveis, ocultas, todas: abas, ocultar, mostrar, mostrarTodas, podeOcultar: visiveis.length > 1 };
}
