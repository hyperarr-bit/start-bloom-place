/**
 * O e-mail "a Apple não conseguiu cobrar — dá pra ficar pelo Pix" (01/10):
 * o que ele PROMETE tem que bater com o que o servidor cobra e com o aviso
 * honesto de não pagar duas vezes.
 */
import { describe, it, expect } from "vitest";
import { assuntoEmailPix, htmlEmailPix, textoEmailPix, PRECO_PIX } from "../../supabase/functions/_shared/email-cobranca-pix";

const dados = { nome: "Ana", comAcesso: true, email: "ana@x.com", link: "https://www.coreaplicativo.com.br/auth/callback?next=%2Fplanos%3Foferta%3Dw97&e=ana%40x.com" };

describe("e-mail do Pix pra cartão recusado", () => {
  it("assunto com o nome, sem urgência falsa", () => {
    expect(assuntoEmailPix("Ana")).toBe("Ana, a Apple não conseguiu cobrar o seu CORE");
    expect(assuntoEmailPix("")).toBe("A Apple não conseguiu cobrar o seu CORE");
    expect(assuntoEmailPix("Ana")).not.toMatch(/últim|urgente|agora ou|expira/i);
  });

  it("diz o essencial: 97,90 uma vez e pra sempre, no lugar de 97,90 por ano; botão Pagar no Pix com o link", () => {
    const h = htmlEmailPix(dados);
    expect(PRECO_PIX).toBe("97,90");
    expect(h).toMatch(/R\$ 97,90 <span[^>]*>uma vez<\/span>/);
    expect(h).toMatch(/pra sempre/);
    expect(h).toMatch(/no lugar de R\$ 97,90 todo ano na Apple/);
    expect(h).toContain(`href="${dados.link.replace(/&/g, "&amp;")}"`);
    expect(h).toMatch(/>Pagar no Pix</);
    expect(h).toMatch(/Oi, Ana!/);
    expect(h).toMatch(/continua guardado/);
    expect(h).toMatch(/João, do CORE/);
  });

  it("aviso honesto: cancelar a renovação na Apple depois do Pix, com o caminho e o link; e 'se cobrar, responda'", () => {
    const h = htmlEmailPix(dados);
    expect(h).toMatch(/Ajustes → toque no seu nome → Assinaturas → CORE → Cancelar assinatura/);
    expect(h).toContain("https://apps.apple.com/account/subscriptions");
    expect(h).toMatch(/Se a Apple cobrar mesmo assim, responda este e-mail/);
  });

  it("mantém a opção de só atualizar o cartão na Apple, em segundo plano", () => {
    const h = htmlEmailPix(dados);
    expect(h).toContain("https://apps.apple.com/account/billing");
    expect(h.indexOf("Pagar no Pix")).toBeLessThan(h.indexOf("atualizar a forma de pagamento"));
  });

  it("com e sem acesso muda só a frase do estado; nome e e-mail são escapados", () => {
    expect(htmlEmailPix({ ...dados, comAcesso: false })).toMatch(/do jeitinho que você deixou/);
    expect(htmlEmailPix({ ...dados, comAcesso: false })).not.toMatch(/acesso segue aberto/);
    expect(htmlEmailPix({ ...dados, nome: "<b>x</b>" })).toContain("Oi, &lt;b&gt;x&lt;/b&gt;!");
  });

  it("versão texto cobre o mesmo: preço, link, cancelar na Apple, assinatura", () => {
    const t = textoEmailPix(dados);
    expect(t).toMatch(/R\$ 97,90 uma vez e é seu pra sempre/);
    expect(t).toContain(`Pagar no Pix: ${dados.link}`);
    expect(t).toMatch(/Assinaturas → CORE → Cancelar assinatura/);
    expect(t).toMatch(/João, do CORE$/);
  });
});
