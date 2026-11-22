/**
 * COMO ENTRAR NO APP — o passo a passo de quem comprou no site.
 *
 * 24/09: nasceu porque 57 de 153 compradores da web nunca entravam no app (tocavam em "Começar" e caíam na venda).
 * 22/11 (dono: tutorial bonito e detalhado, fiel ao app de HOJE): o MESMO passo a passo do pós-compra da /oferta
 * (src/landing/pos-compra-app.ts — mesmas frases e mesmas telas reais do app 1.0.29 em public/como-entrar/v2):
 *   1ª tela → "Já tenho conta? Entrar" (Android vindo do nosso link: "Entrar na minha conta") → e-mail + "Receber código"
 *   → código de 8 números do e-mail → "Entrar". Mais o aviso "você já pagou, não compre de novo" e a saída da tela de planos.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { CSS_POS, aparelhoPelaUa, htmlPassos, type Aparelho } from "@/landing/pos-compra-app";

const ABAS: Array<[Aparelho, string]> = [["ios", "iPhone"], ["android", "Android"], ["computador", "Computador"]];

export default function ComoEntrar() {
  const { user } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const inicial: Aparelho = (() => { try { return aparelhoPelaUa(navigator.userAgent || "", navigator.maxTouchPoints || 0); } catch { return "computador"; } })();
  const [aba, setAba] = useState<Aparelho>(inicial);
  const email = user?.email ?? null;

  useEffect(() => { trackEvent("como_entrar_view", { aparelho: inicial, logado: !!user }); }, [inicial, user]);

  const copiar = async () => {
    if (!email) return;
    try { await navigator.clipboard.writeText(email); setCopiado(true); trackEvent("como_entrar_copiou_email", {}); } catch { /* sem clipboard: o e-mail está na tela */ }
    window.setTimeout(() => setCopiado(false), 2500);
  };
  /* os links das lojas e do navegador vêm no HTML do passo a passo: mede pelo clique delegado */
  const medirClique = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest?.("a");
    if (!a) return;
    if (a.dataset.loja) trackEvent("como_entrar_loja", { loja: a.dataset.loja });
    if (a.hasAttribute("data-navegador")) trackEvent("como_entrar_navegador", {});
  };

  return (
    <div className="pc-raiz min-h-screen" style={{ background: "var(--pc-bg)", color: "var(--pc-tx)" }}>
      <style>{CSS_POS}</style>
      <main className="pc mx-auto w-full max-w-[440px] px-4 pt-8 pb-14" data-testid="como-entrar">
        <div className="pc-topo">
          <h1 className="text-[28px] font-black leading-[1.1] tracking-tight text-balance">Como entrar no app</h1>
          <p>Leva 2 minutos. É o mesmo CORE do site, com a sua compra, sem pagar de novo.</p>
        </div>

        {email ? (
          <div className="pc-email" data-testid="como-entrar-email">
            <small>Seu e-mail de acesso</small>
            <div className="pc-email-linha">
              <b>{email}</b>
              <button type="button" className="pc-copiar" onClick={copiar} {...(copiado ? { "data-ok": "" } : {})}>
                {copiado ? <><Check className="inline w-4 h-4" /> Copiado</> : <><Copy className="inline w-4 h-4" /> Copiar</>}
              </button>
            </div>
            <p>É com ele que você entra. Não precisa de senha.</p>
          </div>
        ) : (
          <div className="pc-email" data-testid="como-entrar-email">
            <small>Seu e-mail de acesso</small>
            <p>Entre com <b>o mesmo e-mail que você usou na compra</b>. Não precisa de senha.</p>
          </div>
        )}

        <div className="pc-aviso" role="note" data-testid="como-entrar-nao-compre">
          <i aria-hidden="true">⚠️</i>
          <div><b>Você já pagou. Não compre de novo no app.</b><span>No app, toque em <b>Entrar</b> e use o seu e-mail. Viu uma tela de preço? Não pague: no fim desta página mostramos como sair dela.</span></div>
        </div>

        <p className="pc-abas-t" id="ce-abas-t">Como entrar, passo a passo:</p>
        <div className="pc-abas" role="tablist" aria-labelledby="ce-abas-t">
          {ABAS.map(([k, r]) => (
            <button key={k} type="button" role="tab" className="pc-aba" aria-selected={aba === k} data-testid={`como-entrar-aba-${k}`}
              onClick={() => { if (aba !== k) { setAba(k); trackEvent("como_entrar_aba", { aba: k }); } }}>{r}</button>
          ))}
        </div>
        {/* o mesmo HTML do pós-compra (texto fixo nosso; o e-mail é escapado lá dentro) */}
        <div role="tabpanel" onClick={medirClique} dangerouslySetInnerHTML={{ __html: htmlPassos(aba, email, "como_entrar") }} />

        <a href="/guia/core-comece-aqui.pdf" target="_blank" rel="noopener" data-testid="como-entrar-guia" className="pc-btn">📖 Guia com fotos (PDF)</a>

        <section className="pc-ajuda" data-testid="como-entrar-ajuda">
          <b>O app pediu pagamento depois de entrar?</b>
          Você entrou em outra conta, sem a sua compra. No fim da tela de pagamento, toque em <b>“Entrar com outra conta”</b> e use {email ? <b>{email}</b> : "o e-mail da compra"}.
          <br /><br />
          Não deu certo? <Link to="/suporte" style={{ color: "var(--pc-mag)", fontWeight: 800 }} onClick={() => trackEvent("como_entrar_suporte", {})}>Fale com a gente</Link> ou escreva pra <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a>. A gente libera pra você.
        </section>
      </main>
    </div>
  );
}
