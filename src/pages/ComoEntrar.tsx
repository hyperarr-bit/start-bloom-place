/**
 * COMO ENTRAR NO APP (24/09, pedido do dono: "tutorial detalhado pra quem
 * quiser acessar o app — tem escrito 'já tem conta? entrar' e mesmo assim o
 * pessoal não clica").
 *
 * O que os dados mostraram (17–24/09): de 153 compradores da web, 57 nunca
 * entraram no app com a conta que pagou. Na tela inicial do app o botão
 * grande é "Começar" (cria conta nova → pede pagamento) e o "Entrar" é uma
 * linha de texto embaixo; das 374 sessões que tocaram em "Entrar", 80
 * acabaram em "Crie agora" (conta nova, sem compra) e 80 nunca logaram.
 *
 * Por isso a página ensina o toque certo com o PRINT REAL da tela (anel no
 * "Já tenho conta? Entrar") e fala o nome dos botões que NÃO são pra tocar.
 * O texto do passo 3 serve pras duas telas de login que existem nas lojas
 * até a versão nova sair: a antiga (só e-mail/senha + "Esqueci minha senha")
 * e a nova (com "Entrar sem senha — receber código por e-mail").
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { BotoesDasLojas, aparelhoDaWeb } from "@/components/LojasCard";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

const MAGENTA = "hsl(330 65% 50%)";

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid={`passo-${n}`}>
      <div className="flex items-center gap-3">
        <span
          className="grid place-items-center w-8 h-8 rounded-full text-white text-sm font-black shrink-0"
          style={{ background: MAGENTA }}
          aria-hidden
        >
          {n}
        </span>
        <h2 className="text-[17px] font-bold leading-tight text-foreground text-balance">{titulo}</h2>
      </div>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrintDoApp({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-[220px] rounded-[28px] border-[6px] border-foreground/90 bg-foreground/90 shadow-lg overflow-hidden">
      <img src={src} alt={alt} width={390} height={844} loading="lazy" className="block w-full h-auto rounded-[22px]" />
    </div>
  );
}

function Nao({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2.5 text-[13px] leading-snug text-amber-900 dark:text-amber-200">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-[1px]" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export default function ComoEntrar() {
  const { user } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const ap = aparelhoDaWeb();
  const plat = ap === "android" ? "android" : "ios";
  const email = user?.email ?? null;

  useEffect(() => { trackEvent("como_entrar_view", { aparelho: ap, logado: !!user }); }, [ap, user]);

  const copiar = async () => {
    if (!email) return;
    try { await navigator.clipboard.writeText(email); setCopiado(true); trackEvent("como_entrar_copiou_email", {}); } catch { /* sem clipboard: o e-mail está na tela */ }
    window.setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-[440px] px-4 pt-8 pb-14 space-y-4">
        <header className="text-center space-y-3 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-semibold">
            <Check className="w-3.5 h-3.5" /> Sua compra já está na sua conta
          </span>
          <h1 className="text-[28px] font-black leading-[1.1] tracking-tight text-balance">Como entrar no app</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground max-w-[34ch] mx-auto">
            Leva 1 minuto. É o mesmo CORE do site, com tudo que você já fez — sem pagar de novo.
          </p>
        </header>

        {email && (
          <div className="rounded-2xl border-2 bg-card p-4 text-center" style={{ borderColor: MAGENTA }} data-testid="como-entrar-email">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Use este e-mail no app</p>
            <p className="mt-1 text-[17px] font-bold break-all text-foreground">{email}</p>
            <button type="button" onClick={copiar} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: MAGENTA }}>
              {copiado ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar e-mail</>}
            </button>
          </div>
        )}

        <Passo n={1} titulo="Baixe o CORE na loja">
          <p>Procure por <b className="text-foreground">CORE</b> ou toque no botão do seu celular:</p>
          <BotoesDasLojas origem="como_entrar" />
        </Passo>

        <Passo n={2} titulo={'Abra o app e toque em "Já tenho conta? Entrar"'}>
          <p>É a linha logo <b className="text-foreground">embaixo</b> do botão preto:</p>
          <PrintDoApp src={`/como-entrar/1-tela-inicial-${plat}.jpg`} alt='Tela inicial do app com "Já tenho conta? Entrar" destacado' />
          <Nao>
            Não toque em <b>“Começar”</b>. Ele é pra quem ainda não tem conta: cria uma conta nova, sem a sua compra, e aí o app pede pagamento.
          </Nao>
        </Passo>

        <Passo n={3} titulo="Entre com o mesmo e-mail da compra">
          <p>
            Digite {email ? <b className="text-foreground">{email}</b> : <b className="text-foreground">o e-mail que você usou no site</b>} e a senha que você criou, e toque em <b className="text-foreground">Entrar</b>.
          </p>
          <PrintDoApp src={`/como-entrar/2-entrar-${plat}.jpg`} alt='Tela de entrar do app com "Entrar sem senha — receber código por e-mail" destacado' />
          <p>
            <b className="text-foreground">Não lembra a senha, ou criou a conta com o Google?</b> Toque em <b className="text-foreground">“Entrar sem senha — receber código por e-mail”</b>: chega um código no seu e-mail em 1 minuto. Se o seu app mostrar só e-mail e senha, toque em <b className="text-foreground">“Esqueci minha senha”</b>.
          </p>
          <Nao>
            Não toque em <b>“Crie agora”</b> nem em <b>“Criar conta”</b> — sua conta já existe.
          </Nao>
        </Passo>

        <section className="rounded-2xl bg-muted/60 p-5 space-y-2" data-testid="como-entrar-ajuda">
          <h2 className="text-[15px] font-bold text-foreground">O app pediu pagamento?</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Você entrou em outra conta, sem a sua compra. No fim da tela de pagamento, toque em <b className="text-foreground">“Entrar com outra conta”</b> e use {email ? <b className="text-foreground">{email}</b> : "o e-mail da compra"}.
          </p>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Não achou esse botão? Apague o app, instale de novo e entre por <b className="text-foreground">“Já tenho conta? Entrar”</b>.
          </p>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Não deu certo? <Link to="/suporte" className="font-semibold underline underline-offset-2" style={{ color: MAGENTA }} onClick={() => trackEvent("como_entrar_suporte", {})}>Fale com a gente</Link> — a gente libera pra você.
          </p>
        </section>
      </main>
    </div>
  );
}
