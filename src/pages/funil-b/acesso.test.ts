import { describe, expect, it } from "vitest";
import { funilBPermitidoNoHost } from "./acesso";

describe("acesso ao funil B por domínio", () => {
  it("bloqueia os dois domínios de produção", () => {
    expect(funilBPermitidoNoHost("coreaplicativo.com.br")).toBe(false);
    expect(funilBPermitidoNoHost("WWW.COREAPLICATIVO.COM.BR")).toBe(false);
  });

  it("permite localhost e previews da Vercel", () => {
    expect(funilBPermitidoNoHost("localhost")).toBe(true);
    expect(funilBPermitidoNoHost("core-git-funil-b.vercel.app")).toBe(true);
  });
});

