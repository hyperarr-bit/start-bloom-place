/**
 * CHUNK QUE SUMIU DEPOIS DO DEPLOY (08/10) — um dono só pra recarga.
 *
 * Todo deploy troca o hash dos arquivos em /assets e apaga os antigos. Quem
 * estava com o site aberto de antes pede um pedaço que não existe mais e o
 * navegador devolve "Failed to fetch dynamically imported module" (Chrome),
 * "Importing a module script failed" (Safari) ou o index.html no lugar do JS
 * ("is not a valid JavaScript MIME type"). O painel do admin mostrou 12
 * desses depois dos deploys da semana.
 *
 * Antes havia TRÊS lugares decidindo recarregar, cada um com a sua régua
 * (main.tsx: vite:preloadError a cada 30 s; RouteErrorBoundary: a cada 60 s;
 * e o `import()` de pré-carregamento do menu da conta nem passava por
 * nenhum deles — virava `unhandledrejection` e um js_error no painel sem
 * ninguém recarregar). Aqui fica a regra única:
 *  - recarrega UMA vez por sessão da aba (sessionStorage): sem loop, mesmo
 *    que o build novo também falhe — aí o boundary mostra "Nova versão do app
 *    disponível" com o botão, que é o F5 da pessoa;
 *  - nunca recarrega sem rede (a mesma mensagem sai quando a conexão caiu;
 *    recarregar aí dá a página de "sem internet" do navegador);
 *  - recarrega com cache-buster na URL: reload() puro no Safari pode devolver
 *    o MESMO index.html velho do cache (demo branca de 21/07).
 */

const CHAVE = "core-chunk-reload-at";

/** Cara de erro de chunk em qualquer navegador (a mesma lista do RouteErrorBoundary). */
export const ehErroDeChunk = (texto: unknown): boolean =>
  /dynamically imported module|module script failed|ChunkLoadError|Loading chunk .* failed|Loading CSS chunk|Unable to preload CSS|is not a valid JavaScript MIME type|reading 'default'|of undefined \(reading "default"\)/i.test(
    String(texto ?? ""),
  );

/** Já recarregou nesta sessão da aba? (quando — ms — ou 0) */
export const ultimaRecargaPorChunk = (): number => {
  try { return Number(sessionStorage.getItem(CHAVE) || 0); } catch { return 0; }
};

const semRede = () => {
  try { return typeof navigator !== "undefined" && navigator.onLine === false; } catch { return false; }
};

/**
 * Recarrega a página pra pegar o build novo — ou NÃO, e diz o porquê.
 * Retorna "recarregando" | "ja-recarregou" | "sem-rede".
 */
export function recarregarPorChunkNovo(): "recarregando" | "ja-recarregou" | "sem-rede" {
  if (semRede()) return "sem-rede";
  if (ultimaRecargaPorChunk() > 0) return "ja-recarregou";
  try { sessionStorage.setItem(CHAVE, String(Date.now())); } catch { /* segue e recarrega mesmo assim */ }
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("core-cb", String(Date.now() % 1e7));
    window.location.replace(u.toString());
  } catch {
    window.location.reload();
  }
  return "recarregando";
}

/** Só pros testes: esquece a recarga desta sessão. */
export const esquecerRecargaPorChunk = () => { try { sessionStorage.removeItem(CHAVE); } catch { /* noop */ } };
