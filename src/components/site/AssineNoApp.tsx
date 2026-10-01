import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Smartphone, Monitor, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { aparelhoDaWeb } from "@/components/LojasCard";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";

/**
 * "ASSINE NO APP E USE AQUI TAMBÉM" (01/10) — o que a pessoa logada na WEB sem
 * acesso vê no lugar do paywall com Pix. Decisão do dono: venda só pelas
 * lojas; o site continua pra quem já tem conta.
 *
 * Como o acesso chega até aqui: a compra na loja vira uma linha em
 * `subscriptions` com o `user_id` da conta logada no app (RevenueCat
 * appUserID = id do Supabase), e o `check-subscription` lê essa tabela sem
 * olhar o meio de pagamento. Então basta entrar no app com o MESMO e-mail
 * e assinar lá: o use-auth re-checa em todo retorno de foco e a cada 60 s —
 * e o botão "Já assinei" recarrega pra não depender de esperar.
 *
 * Duas formas: `gate` (tela cheia por cima do app, montada pelo TrialBanner)
 * e `pagina` (a /planos da web sem oferta — com seta de voltar).
 *
 * NUNCA no app da loja: quem monta já bifurcou por isNativeShell().
 */
export function AssineNoApp({ variante }: { variante: "gate" | "pagina" }) {
  const { user, signOut } = useAuth();
  const ap = aparelhoDaWeb();
  useEffect(() => { trackEvent("assine_no_app_view", { variante, aparelho: ap }); }, [variante, ap]);

  const email = user?.email ?? "";
  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="assine-no-app" data-variante={variante}>
      <div className="max-w-md mx-auto px-5 pt-5 pb-10">
        {variante === "pagina" ? (
          <Link to="/home" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="assine-voltar">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        ) : (
          <div className="h-4" />
        )}

        {/* cabeçalho em caixa alta com faixa colorida — a cara de planner do app */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="h-2 bg-gradient-to-r from-violet-500 to-accent" aria-hidden="true" />
          <div className="p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Sua conta está pronta</p>
            <h1 className="mt-1.5 text-[24px] font-extrabold leading-tight tracking-tight">
              Assine no app e use aqui também
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              O CORE agora é assinado pelo aplicativo do celular — App Store ou Google Play.
              É a mesma conta{email ? <> (<span className="font-semibold text-foreground">{email}</span>)</> : null}:
              o que você fizer no celular aparece aqui no computador, e vice-versa.
            </p>

            <SelosDasLojas onde="paywall" prefixo="web" altura={48} className="mt-5" />
            {/* 01/10: sem preço aqui (dono) — o app mostra as opções antes de assinar */}
            <p className="mt-2.5 text-[12.5px] text-muted-foreground" data-testid="assine-oferta">O app mostra as opções antes de você assinar{ap === "iphone" ? " — e no iPhone dá pra testar antes" : ""}.</p>
          </div>
        </div>

        {/* os 3 passos, como lista de planner */}
        <ol className="mt-5 rounded-2xl border border-border bg-card divide-y divide-border">
          {[
            { Icon: Smartphone, t: "Baixe o app no celular", d: "Toque no selo da sua loja aqui em cima." },
            { Icon: LogOut, t: "Entre com o mesmo e-mail", d: <>No app, toque em <b className="text-foreground">“Já tenho conta? Entrar”</b>{email ? <> e use <b className="text-foreground">{email}</b></> : null}.</> },
            { Icon: Monitor, t: "Assine lá e volte aqui", d: "O acesso libera nos dois em menos de um minuto." },
          ].map((p, i) => (
            <li key={p.t} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 border-foreground/70 grid place-items-center text-[11px] font-extrabold">{i + 1}</span>
              <div>
                <p className="text-[14px] font-bold leading-snug">{p.t}</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => { trackEvent("assine_no_app_ja_assinei", { variante }); window.location.reload(); }}
          className="mt-5 w-full h-12 rounded-xl bg-foreground text-background text-[15px] font-bold inline-flex items-center justify-center gap-2"
          data-testid="assine-ja-assinei"
        >
          <RefreshCw className="w-4 h-4" /> Já assinei no app — atualizar
        </button>

        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px]">
          <Link to="/como-entrar" className="font-semibold underline underline-offset-2">Como entrar no app</Link>
          <Link to="/suporte" className="font-semibold underline underline-offset-2">Falar com o suporte</Link>
          <button type="button" onClick={() => { void signOut(); }} className="text-muted-foreground underline underline-offset-2" data-testid="assine-sair">
            Sair desta conta
          </button>
        </div>
      </div>
    </div>
  );
}
