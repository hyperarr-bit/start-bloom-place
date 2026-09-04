/**
 * O contrato do módulo da loja (30/08).
 *
 * A metade que importa deste teste não é o iOS — é o ANDROID. Este arquivo
 * nasceu junto de uma troca de ~15 strings dentro do paywall que está
 * vendendo hoje, e a única garantia aceitável era: no Android, sai exatamente
 * o que saía antes, caractere por caractere. As strings esperadas abaixo
 * foram copiadas do código que estava no ar, não reescritas de memória.
 *
 * A outra metade cobre o motivo de reprovação na revisão da Apple: nenhuma
 * tela pode citar Pix, Google ou Play dentro do iPhone (regra 3.1.1).
 */
import { describe, it, expect, afterEach } from "vitest";
import * as loja from "@/lib/loja";

/** O runtime do Capacitor injeta window.Capacitor; aqui a gente finge. */
const fingirPlataforma = (p: "ios" | "android" | "web") => {
  if (p === "web") {
    delete (window as { Capacitor?: unknown }).Capacitor;
    return;
  }
  (window as { Capacitor?: unknown }).Capacitor = {
    getPlatform: () => p,
    isNativePlatform: () => true,
  };
};

afterEach(() => fingirPlataforma("web"));

describe("Android continua byte-idêntico", () => {
  it("mantém as strings que já estavam no ar", () => {
    fingirPlataforma("android");
    expect(loja.pelaLoja()).toBe("pelo Google Play");
    expect(loja.nomeLoja()).toBe("Google Play");
    expect(loja.lojaParaCancelar()).toBe("Play Store");
    expect(loja.formasDePagamento()).toBe("Pix ou cartão");
    expect(loja.sufixoPagamento()).toBe(" · Pix ou cartão");
    expect(loja.erroFolhaNaoConcluiu()).toBe(
      "O Google não concluiu o pagamento. Tenta de novo em instantes."
    );
    expect(loja.erroPagamentoNaoAchado()).toBe(
      "Ainda não achamos seu pagamento — o Pix pode levar ~1 minuto. Tenta de novo já já."
    );
    expect(loja.avisoAtualizarApp()).toBe(
      "Atualize o CORE na Play Store pra continuar — esta versão ficou sem o catálogo."
    );
    expect(loja.urlGerenciarAssinatura("br.com.coreaplicativo.app")).toBe(
      "https://play.google.com/store/account/subscriptions?package=br.com.coreaplicativo.app"
    );
  });

  it("monta o legal do CTA igual ao texto de hoje", () => {
    fingirPlataforma("android");
    expect(`Pagamento único ${loja.pelaLoja()}${loja.sufixoPagamento()}`)
      .toBe("Pagamento único pelo Google Play · Pix ou cartão");
    expect(`${"R$ 97,90"} · acesso vitalício · pagamento único ${loja.pelaLoja()}${loja.sufixoPagamento()}`)
      .toBe("R$ 97,90 · acesso vitalício · pagamento único pelo Google Play · Pix ou cartão");
  });

  it("mantém 'cancela quando quiser' — o mensal da vitrine é PRÉ-PAGO lá", () => {
    fingirPlataforma("android");
    expect(loja.avisoRenovacao()).toBe("cancela quando quiser");
  });

  it("mantém a escada de resgate do Pix ligada", () => {
    fingirPlataforma("android");
    expect(loja.temEscadaPix()).toBe(true);
    expect(loja.ehApple()).toBe(false);
  });

  it("na WEB se comporta como Android — o bundle do site não muda", () => {
    fingirPlataforma("web");
    expect(loja.ehApple()).toBe(false);
    expect(loja.pelaLoja()).toBe("pelo Google Play");
    expect(loja.temEscadaPix()).toBe(true);
  });
});

describe("iOS não dá motivo de reprovação", () => {
  it("não cita forma de pagamento externa em lugar nenhum (regra 3.1.1)", () => {
    fingirPlataforma("ios");
    const tudo = [
      loja.nomeLoja(), loja.pelaLoja(), loja.lojaParaCancelar(), loja.donoDaFolha(),
      loja.formasDePagamento(), loja.sufixoPagamento(),
      loja.legalCompraUnica(), loja.legalAssinatura("R$ 24,90"),
      loja.erroFolhaNaoConcluiu(), loja.erroSemFalarComALoja(),
      loja.erroSemAbrirALoja(), loja.avisoAtualizarApp(),
      loja.erroPagamentoNaoAchado(), loja.urlGerenciarAssinatura("br.com.coreaplicativo.app"),
    ].join(" | ");
    expect(tudo).not.toMatch(/pix/i);
    expect(tudo).not.toMatch(/google/i);
    expect(tudo).not.toMatch(/play/i);
  });

  it("desliga a escada de resgate do Pix", () => {
    fingirPlataforma("ios");
    expect(loja.temEscadaPix()).toBe(false);
  });

  it("avisa que a assinatura RENOVA — 'cancele quando quiser' não cumpre a 3.1.2", () => {
    fingirPlataforma("ios");
    expect(loja.avisoRenovacao()).toBe("renova automaticamente até você cancelar");
    expect(loja.avisoRenovacao()).toMatch(/renova/);
  });

  it("concorda o gênero da loja (a App Store, não o App Store)", () => {
    fingirPlataforma("ios");
    expect(loja.pelaLoja()).toBe("pela App Store");
    expect(loja.donoDaFolha()).toBe("a Apple");
  });

  it("não deixa separador órfão no fim do legal", () => {
    fingirPlataforma("ios");
    expect(loja.legalCompraUnica()).toBe("pagamento único · pela App Store · sem mensalidade");
    expect(loja.legalCompraUnica()).not.toMatch(/·\s*$/);
    expect(loja.legalAssinatura("R$ 24,90"))
      .toBe("assinatura de R$ 24,90/mês · pela App Store · cancela quando quiser");
  });

  it("manda gerenciar assinatura na Apple, não numa loja que o aparelho não tem", () => {
    fingirPlataforma("ios");
    expect(loja.urlGerenciarAssinatura("br.com.coreaplicativo.app"))
      .toBe("https://apps.apple.com/account/subscriptions");
  });
});

describe("mensagens de recusa da folha (04/09)", () => {
  it("Android: as duas frases são as que já estavam no paywall, caractere por caractere", () => {
    fingirPlataforma("android");
    expect(loja.erroJaAtivo()).toBe(
      "A Play diz que esta compra já é sua. Toca em «Restaurar compras» aqui embaixo pra liberar o acesso."
    );
    expect(loja.erroNaoPermitido()).toBe(
      "A Play Store recusou compras nesta conta Google. Abre a Play Store, confere se está logado e se a conta pode comprar (conta de menor precisa da aprovação dos pais) e volta aqui. Se já pagou, toca em «Restaurar compras»."
    );
  });
  it("iPhone: fala de App Store/Apple e nunca de Play ou Google", () => {
    fingirPlataforma("ios");
    for (const f of [loja.erroJaAtivo, loja.erroNaoPermitido, loja.erroFolhaNaoConcluiu]) {
      const t = f();
      expect(t).not.toMatch(/Play|Google/);
      expect(t).toMatch(/App Store|Apple/);
      expect(t).toMatch(/Restaurar compras|Tenta de novo/);
    }
  });
});
