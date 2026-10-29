/**
 * SEGURANÇA (21/10): recovery-emails e pix-pendente-email são chamáveis com a anon key pública e tinham um `preview`
 * que mandava e-mail do domínio do CORE pra QUALQUER endereço. Agora só pras caixas da equipe.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESTINOS_DE_PREVIEW, destinoDePreview } from "../../../supabase/functions/_shared/preview-seguro";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", f), "utf8");

describe("destinoDePreview", () => {
  it("caixa da equipe passa (normalizada)", () => {
    expect(destinoDePreview("  HyperArr@Gmail.com ")).toBe("hyperarr@gmail.com");
    for (const e of DESTINOS_DE_PREVIEW) expect(destinoDePreview(e)).toBe(e);
  });
  it("qualquer outro endereço → null", () => {
    for (const v of ["vitima@exemplo.com", "hyperarr@gmail.com.evil.com", "a@b.c,hyperarr@gmail.com", "", null, undefined, 1, {}]) {
      expect(destinoDePreview(v)).toBeNull();
    }
  });
});

describe("as duas funções conferem o destino ANTES de mandar", () => {
  for (const f of ["recovery-emails/index.ts", "pix-pendente-email/index.ts"]) {
    it(f, () => {
      const s = fonte(f);
      const i = s.indexOf("if (body?.preview)");
      expect(i).toBeGreaterThan(0);
      const bloco = s.slice(i, i + 700);
      const confere = bloco.indexOf("destinoDePreview(body.preview)");
      const recusa = bloco.indexOf('"forbidden"');
      const manda = Math.max(bloco.indexOf("api.resend.com"), bloco.indexOf("await enviar("));
      expect(confere).toBeGreaterThan(0);
      expect(recusa).toBeGreaterThan(confere);
      expect(manda).toBeGreaterThan(recusa);
      expect(bloco).not.toMatch(/String\(body\.preview\)/);
    });
  }
});
