import { createContext, useContext } from "react";
import type { Relacoes } from "./use-relacoes";
import type { SugestaoDeInicio } from "@/lib/relacoes";

/** As abas de Relações (29/09): 4, com os ids de sempre pra medição continuar comparável. */
export type AbaRelacoes = "pessoas" | "agenda" | "presentes" | "momentos";

export type Navegacao = {
  rel: Relacoes;
  abrirFicha: (pessoaId: string) => void;
  abrirNovaPessoa: (sugestao?: SugestaoDeInicio) => void;
  abrirEdicao: (pessoaId: string) => void;
  abrirAvisos: () => void;
  /** as mensagens prontas (parabéns ou "oi") pra essa pessoa */
  abrirMensagem: (pessoaId: string, tipo: "parabens" | "oi") => void;
  irPraAba: (aba: AbaRelacoes) => void;
};

export const RelacoesContext = createContext<Navegacao | null>(null);

export function useNavegacaoRelacoes(): Navegacao {
  const c = useContext(RelacoesContext);
  if (!c) throw new Error("useNavegacaoRelacoes fora do RelacoesContext");
  return c;
}
