/**
 * O bipe do fim do descanso (Treino) — um AudioContext só, reaproveitado
 * (26/09: criava um novo a cada bipe).
 *
 * 21/10 (caça a bugs): 5 pessoas do iPhone (builds 34/38/40) apareciam no
 * js_error com "Failed to start the audio device" em /treino. No WebKit o
 * `AudioContext.resume()` REJEITA quando o sistema nega o áudio (fone saindo,
 * outra app com o áudio, modo silencioso em alguns iOS) — e a promessa ficava
 * solta (`void resume()`), virando rejeição não tratada → erro no painel, sem
 * nada pra pessoa ver. Sem áudio não é erro: o bipe simplesmente não toca.
 * O oscilador continua sendo disparado na hora (como antes): se o contexto
 * acordar, ele toca; se não, silêncio.
 */
let contexto: AudioContext | null = null;

/** Toca o bipe; devolve a espera do `resume()` já tratada — resolve SEMPRE. */
export const bipeDoDescanso = (criar: () => AudioContext = () => new AudioContext()): Promise<void> => {
  let espera: Promise<void> = Promise.resolve();
  try {
    contexto ??= criar();
    if (contexto.state === "suspended") {
      espera = Promise.resolve(contexto.resume()).then(() => undefined, () => { /* áudio negado pelo sistema: silêncio */ });
    }
    const osc = contexto.createOscillator();
    osc.connect(contexto.destination);
    osc.frequency.value = 800;
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch { /* já parou */ } }, 300);
  } catch { /* sem áudio no aparelho */ }
  return espera;
};

/** Só pros testes. */
export const esquecerContextoDoBipe = () => { contexto = null; };
