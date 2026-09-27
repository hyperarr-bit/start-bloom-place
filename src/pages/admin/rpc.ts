import { supabase } from "@/integrations/supabase/client";

/**
 * RPCs DO /admin (27/09).
 *
 * Os tipos gerados do Supabase (src/integrations/supabase/types.ts) são de
 * abril: não conhecem nenhuma das funções admin_* recriadas desde julho, e o
 * `supabase.rpc` tipado recusava o nome (6 erros de tsc só no admin, um deles
 * escondido com @ts-expect-error). Em vez de regenerar os tipos do banco
 * inteiro, as funções do admin passam por aqui: o nome é conferido contra
 * esta lista e quem chama diz o formato do retorno.
 *
 * O erro volta já traduzido (ErroAdmin): a tela mostra "a consulta demorou
 * demais — tente um período menor" em vez de "canceling statement due to
 * statement timeout".
 */
export type NomeRpcAdmin =
  | "admin_acquisition_funnel"
  | "admin_campaign_metrics"
  | "admin_set_campaign_alias"
  | "admin_funnel_users"
  | "admin_paying_users_detail"
  | "admin_web_roi"
  | "admin_uso";

export type TipoErroAdmin = "tempo" | "sem_funcao" | "permissao" | "rede" | "dado" | "outro";

export interface ErroAdmin {
  tipo: TipoErroAdmin;
  /** frase pra tela, em português */
  mensagem: string;
  /** texto cru do banco/rede, pra quem for investigar */
  detalhe: string;
}

interface ErroBruto { message?: string; code?: string; details?: string | null; hint?: string | null }

type ClienteRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: ErroBruto | null }>;
};

const MENSAGENS: Record<TipoErroAdmin, string> = {
  tempo: "A consulta demorou demais — tente um período menor.",
  sem_funcao: "Esta consulta ainda não está no banco — falta aplicar a migração do admin.",
  permissao: "Sua sessão não tem permissão de admin — saia e entre de novo.",
  rede: "Sem conexão com o servidor — confira a internet e tente de novo.",
  dado: "O banco devolveu um dado incompleto e a consulta parou — a migração de 27/09 corrige.",
  outro: "Não deu pra carregar agora.",
};

/** Traduz o erro do PostgREST/da rede pra algo que o dono entende. */
export function classificarErro(e: unknown): ErroAdmin {
  const bruto: ErroBruto = typeof e === "object" && e !== null ? (e as ErroBruto) : { message: String(e) };
  const msg = bruto.message ?? String(e);
  const codigo = bruto.code ?? "";
  const tudo = `${codigo} ${msg} ${bruto.details ?? ""} ${bruto.hint ?? ""}`;
  let tipo: TipoErroAdmin = "outro";
  if (codigo === "57014" || /statement timeout|canceling statement|timed? ?out|tempo esgotado/i.test(tudo)) tipo = "tempo";
  else if (codigo === "PGRST202" || codigo === "42883" || /could not find the function|function .* does not exist/i.test(tudo)) tipo = "sem_funcao";
  else if (codigo === "42501" || /not authorized|forbidden|permission denied|jwt/i.test(tudo)) tipo = "permissao";
  else if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(tudo)) tipo = "rede";
  else if (/must not be null|null value|invalid input/i.test(tudo)) tipo = "dado";
  return { tipo, mensagem: MENSAGENS[tipo], detalhe: [codigo, msg].filter(Boolean).join(" · ") };
}

/** Chama uma função do admin no banco. Nunca lança: erro volta em `error`. */
export async function rpcAdmin<T>(
  nome: NomeRpcAdmin,
  args: Record<string, unknown> = {},
): Promise<{ data: T | null; error: ErroAdmin | null }> {
  try {
    const { data, error } = await (supabase as unknown as ClienteRpc).rpc(nome, args);
    if (error) return { data: null, error: classificarErro(error) };
    return { data: data as T, error: null };
  } catch (e) {
    return { data: null, error: classificarErro(e) };
  }
}
