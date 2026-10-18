/**
 * MOMENTO RUIM PRA PEDIR NOTA (10/10, versão 1.0.14) — módulo-folha, sem imports.
 *
 * A avaliação só vale em momento de valor. Quem acabou de ver "seu pagamento
 * não passou", abriu o cancelamento, recebeu o presente de 69,90 (= estava
 * saindo) ou teve um erro na sessão não pode ser pedido — a nota vem baixa e a
 * Apple/Google só dão 3 chances por ano/aparelho.
 *
 * Em vez de cada tela avisar a avaliação (Presente69, SaveOffer e PaywallIOS
 * são de outros agentes e não podem ser editados), o PRÓPRIO trackEvent anota
 * aqui pelo NOME do evento que já existe: `aviso_cobranca_view`,
 * `cancel_loja_view`, `save_offer_view`, `presente69_view` → momento ruim por
 * 24 h (localStorage, sobrevive ao fechar o app); `js_error`/`funnel_error` →
 * erro nesta sessão (memória + sessionStorage).
 *
 * Este arquivo não importa nada de propósito: o analytics.ts e o avaliacao.ts
 * importam ele, e um ciclo entre os dois é o que se quer evitar.
 */
const CHAVE_MOMENTO = "core-avaliacao-momento-ruim";
const CHAVE_ERRO_SESSAO = "core_avaliacao_erro_sessao";
export const JANELA_MOMENTO_RUIM_MS = 24 * 3600_000;

/** Eventos que marcam "agora não é hora de pedir nota" por 24 h. */
export const EVENTOS_DE_MOMENTO_RUIM = new Set(["aviso_cobranca_view", "cancel_loja_view", "save_offer_view", "presente69_view"]);
/** Eventos que marcam "houve erro nesta sessão". */
export const EVENTOS_DE_ERRO = new Set(["js_error", "funnel_error"]);

let erroNaSessaoMemoria = false;

export function registrarMomentoRuim(tipo: string, agora: number = Date.now()): void {
  try { localStorage.setItem(CHAVE_MOMENTO, JSON.stringify({ tipo, em: agora })); } catch { /* modo privado */ }
}

export function registrarErroDaSessao(): void {
  erroNaSessaoMemoria = true;
  try { sessionStorage.setItem(CHAVE_ERRO_SESSAO, "1"); } catch { /* noop */ }
}

/** Chamado pelo trackEvent com o nome de cada evento. Barato: dois Set.has. */
export function anotarPeloEvento(nome: string): void {
  if (EVENTOS_DE_MOMENTO_RUIM.has(nome)) registrarMomentoRuim(nome);
  else if (EVENTOS_DE_ERRO.has(nome)) registrarErroDaSessao();
}

/** Houve aviso de cobrança / cancelamento / presente nas últimas 24 h? */
export function momentoRuimRecente(agora: number = Date.now()): boolean {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_MOMENTO) ?? "null") as { em?: number } | null;
    return !!v && typeof v.em === "number" && agora - v.em >= 0 && agora - v.em < JANELA_MOMENTO_RUIM_MS;
  } catch { return false; }
}

export function erroNaSessao(): boolean {
  if (erroNaSessaoMemoria) return true;
  try { return sessionStorage.getItem(CHAVE_ERRO_SESSAO) === "1"; } catch { return false; }
}

/** Pra teste. */
export function limparMomentoRuim(): void {
  erroNaSessaoMemoria = false;
  try { localStorage.removeItem(CHAVE_MOMENTO); sessionStorage.removeItem(CHAVE_ERRO_SESSAO); } catch { /* noop */ }
}
