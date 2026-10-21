/**
 * 21/10 (caça a bugs) — o bipe do descanso do Treino e o áudio negado pelo iOS.
 */
import { describe, it, expect, afterEach } from "vitest";
import { bipeDoDescanso, esquecerContextoDoBipe } from "@/lib/bipe-descanso";

/**
 * 3) js_error "Failed to start the audio device" em /treino (5 pessoas do
 *    iPhone, 14 dias): o `resume()` do AudioContext rejeita quando o iOS nega o
 *    áudio e a promessa ficava solta. Sem áudio = silêncio, nunca erro.
 */
describe("3) bipe do descanso: áudio negado pelo sistema não vira erro solto", () => {
  afterEach(() => esquecerContextoDoBipe());
  const contextoFalso = (resume: () => Promise<void>) => ({
    state: "suspended",
    resume,
    destination: {},
    createOscillator: () => ({ connect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0 } }),
  }) as unknown as AudioContext;

  it("resume() rejeitado: a espera resolve e nenhuma rejeição fica solta", async () => {
    const soltas: unknown[] = [];
    const ouvir = (r: unknown) => { soltas.push(r); };
    process.on("unhandledRejection", ouvir);
    try {
      await expect(bipeDoDescanso(() => contextoFalso(() => Promise.reject(new Error("Failed to start the audio device"))))).resolves.toBeUndefined();
      await new Promise((r) => setTimeout(r, 0));
      expect(soltas).toEqual([]);
    } finally {
      process.off("unhandledRejection", ouvir);
    }
  });

  it("resume() ok: toca (oscilador criado) e resolve", async () => {
    let criados = 0;
    const ctx = contextoFalso(() => Promise.resolve());
    (ctx as any).createOscillator = () => { criados++; return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0 } }; };
    await bipeDoDescanso(() => ctx);
    expect(criados).toBe(1);
  });
});
