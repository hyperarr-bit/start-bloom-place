/**
 * O NOME DA PESSOA NA SAUDAÇÃO (1.0.17, 19/10).
 *
 * A Home lê `core-user-name`. O cadastro do iPhone (CadastroIOS) e os funis antigos gravavam só
 * `user-name` — toda conta criada por e-mail no iPhone via "Boa noite, <começo do e-mail>"
 * (GreetingHeader cai no e-mail quando a chave da Home está vazia). Visto no vídeo do dono (19/10).
 *
 * Conserto: o cadastro grava as duas chaves; e, pra quem já se cadastrou, a Home copia UMA vez o
 * nome antigo (`user-name`) pra `core-user-name` — a
 * partir daí o nome é editável no lugar de sempre (GreetingHeader / Minha conta).
 */
export const CHAVE_NOME_DA_HOME = "core-user-name";
export const CHAVE_NOME_DO_CADASTRO = "user-name";

type Get = <T>(k: string, f: T) => T;

const limpo = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** O nome que a Home mostra: o dela, senão o do cadastro. */
export function nomeDaHome(get: Get): string {
  return limpo(get<string>(CHAVE_NOME_DA_HOME, "")) || limpo(get<string>(CHAVE_NOME_DO_CADASTRO, ""));
}

/**
 * O nome a copiar pra `core-user-name` (a migração de uma vez), ou null se não há nada a fazer:
 * a chave da Home já tem nome, ou não existe nome nenhum guardado.
 */
export function nomeParaMigrar(get: Get, metadados?: Record<string, unknown> | null): string | null {
  if (limpo(get<string>(CHAVE_NOME_DA_HOME, ""))) return null;
  const n = limpo(get<string>(CHAVE_NOME_DO_CADASTRO, "")) || limpo(metadados?.full_name) || limpo(metadados?.name);
  return n ? n.slice(0, 60) : null;
}
