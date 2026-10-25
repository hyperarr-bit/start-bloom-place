/**
 * 1.0.19 (SKAN): event_id do StartTrial do iPhone no meta-backfill-app — chave META_STARTTRIAL_ID_DA_LOJA,
 * DESLIGADA por padrão. Ligada, o StartTrial de assinatura da App Store sai com o original_transaction_id
 * (store_subscription_identifier do RevenueCat) — o mesmo event_id que o SDK manda do aparelho.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chaveIdDaLojaLigada, eventIdDoStartTrial } from "../../supabase/functions/_shared/meta-starttrial-id";

const fonte = readFileSync(resolve(__dirname, "../../supabase/functions/meta-backfill-app/index.ts"), "utf8");
const SUB = "sub1a2b3c4d";
const ios = { id: SUB, store: "app_store", store_subscription_identifier: "2000000123456789" };

describe("eventIdDoStartTrial", () => {
  it("chave desligada (padrão): o tx de sempre", () => {
    expect(eventIdDoStartTrial(SUB, ios, false)).toBe(SUB);
    expect(chaveIdDaLojaLigada(undefined)).toBe(false);
    expect(chaveIdDaLojaLigada("")).toBe(false);
    expect(chaveIdDaLojaLigada("off")).toBe(false);
    expect(chaveIdDaLojaLigada(" ON ")).toBe(true);
  });
  it("ligada + App Store: o original_transaction_id da Apple", () => {
    expect(eventIdDoStartTrial(SUB, ios, true)).toBe("2000000123456789");
  });
  it("ligada mas Android, sem assinatura, outra assinatura ou id estranho: o tx de sempre", () => {
    expect(eventIdDoStartTrial(SUB, { ...ios, store: "play_store", store_subscription_identifier: "GPA.1234" }, true)).toBe(SUB);
    expect(eventIdDoStartTrial(SUB, null, true)).toBe(SUB);
    expect(eventIdDoStartTrial(SUB, { ...ios, id: "subOUTRA" }, true)).toBe(SUB);
    expect(eventIdDoStartTrial(SUB, { ...ios, store_subscription_identifier: "" }, true)).toBe(SUB);
    expect(eventIdDoStartTrial(SUB, { ...ios, store_subscription_identifier: "abc" }, true)).toBe(SUB);
  });
});

describe("meta-backfill-app usa a chave só no StartTrial", () => {
  it("só pergunta ao RevenueCat com tipo trial E a chave ligada; o event_id do payload é o eventId", () => {
    expect(fonte).toMatch(/if \(tipo === "trial" && chaveIdDaLojaLigada\(Deno\.env\.get\("META_STARTTRIAL_ID_DA_LOJA"\)\)\)/);
    expect(fonte).toContain("event_id: eventId,");
    expect(fonte).toContain("let eventId = txId;");
    // os eventos derivados do Purchase continuam pelo tx
    expect(fonte).toContain("event_id: `${txId}_av`");
  });
});
