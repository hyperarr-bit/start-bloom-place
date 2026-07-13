import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Check, Wallet, Receipt, CreditCard, TrendingUp,
  WifiOff, ShieldCheck, Smartphone, Zap, Activity, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";

/* =========================================================
   CORE — Landing (pivot "só finanças")
   Construída do zero sobre o design system do app:
   tokens (primary=grafite, accent=magenta, cores de finanças)
   + componentes shadcn. Tema claro, igual à home.
   ========================================================= */

const FINANCAS_VIDEO = "/videos/financas.mp4";
const FINANCAS_POSTER = "/videos/financas-poster.jpg";
// Segundo vídeo (seção "Como funciona") — diferente do hero pra não repetir.
const FINANCAS2_VIDEO = "/videos/financas-2.mp4";

const SIGNUP = "/auth?signup=1";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

/** Vídeo que toca sozinho quando entra na tela (mudo, em loop). */
function PreviewVideo({
  src, poster, label, autoPlay = false, preload = "metadata",
}: {
  src: string; poster?: string; label: string;
  autoPlay?: boolean; preload?: "none" | "metadata" | "auto";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // O React não seta a *property* `muted` de forma confiável; sem ela o
    // browser bloqueia o autoplay. Forçamos a property aqui.
    v.muted = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const tryPlay = () => { const p = v.play(); if (p) p.catch(() => {}); };
    if (autoPlay) tryPlay();
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) tryPlay(); else v.pause(); },
      { threshold: 0.1 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [autoPlay]);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay={autoPlay}
      preload={preload}
      aria-label={label}
      className="w-full h-auto block"
    />
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-3">
    {children}
  </div>
);

const Container = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`max-w-6xl mx-auto px-5 md:px-8 ${className}`}>{children}</div>
);

/* ---------- dados ---------- */

const FINANCE_CARDS = [
  { icon: Wallet, t: "Receitas", d: "Tudo que entra — salário, freelas e extras, somados na hora.", cls: "bg-card-receitas border-card-receitas-border text-card-receitas-text" },
  { icon: Receipt, t: "Despesas", d: "Gastos fixos e variáveis em tabelas claras, sem bagunça.", cls: "bg-card-despesas border-card-despesas-border text-card-despesas-text" },
  { icon: CreditCard, t: "Dívidas e parcelas", d: "Parcelas e contas a vencer organizadas — sem juro de susto.", cls: "bg-card-dividas border-card-dividas-border text-card-dividas-text" },
  { icon: TrendingUp, t: "Investimentos", d: "Acompanhe o que você guarda crescer, mês a mês.", cls: "bg-card-investimentos border-card-investimentos-border text-card-investimentos-text" },
];

const PAINS = [
  "“Não sei quanto posso gastar até o fim do mês.”",
  "“Esqueço uma conta e acabo pagando juros à toa.”",
  "“Nunca sobra nada pra começar a investir.”",
];

const PROOF = [
  { icon: WifiOff, t: "Funciona offline", d: "Sem internet? Continua usando. Sincroniza quando voltar." },
  { icon: ShieldCheck, t: "Dados criptografados", d: "Só você acessa o que é seu. Privacidade de banco." },
  { icon: Smartphone, t: "Celular, tablet e PC", d: "Abre em qualquer tela, sempre atualizado." },
  { icon: Zap, t: "Rápido de manter", d: "Lança em segundos. Não vira mais uma tarefa." },
];

const FAQ = [
  { q: "Tem versão grátis?", a: "Tem 7 dias de teste completo, sem precisar cadastrar cartão de crédito. Se não for pra você, é só não continuar." },
  { q: "Preciso entender de finanças?", a: "Não. O CORE foi feito pra quem nunca conseguiu manter uma planilha. Você só lança o que entra e o que sai — ele te mostra o resto pronto: contas a vencer, quanto dá pra gastar e sua saúde financeira." },
  { q: "Meus dados ficam seguros?", a: "Sim. Cada usuário só acessa os próprios dados, com criptografia em trânsito e em repouso. Ninguém além de você vê seu dinheiro." },
  { q: "Funciona offline e em vários aparelhos?", a: "Sim. O CORE é um app (PWA) que funciona offline e sincroniza entre celular, tablet e computador." },
  { q: "Posso cancelar quando quiser?", a: "Sim, com 1 clique — sem fidelidade, sem ligação, sem burocracia." },
];

/* =========================================================
   PÁGINA
   ========================================================= */

export default function LpFinancas() {
  useEffect(() => {
    captureLandingMeta();
    trackEvent("landing_view", { source: "lp" });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <Container className="h-14 flex items-center justify-between">
          <Link to="/lp" className="font-bold text-lg tracking-tight">
            CORE<span className="text-accent">.</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#como" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#faq" className="hover:text-foreground transition-colors">Perguntas</a>
          </nav>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth" onClick={() => trackEvent("landing_cta_click", { cta: "header_entrar" })}>
              Entrar
            </Link>
          </Button>
        </Container>
      </header>

      {/* HERO */}
      <section className="overflow-hidden">
        <Container className="pt-10 md:pt-16 pb-12 md:pb-20">
          <div className="grid md:grid-cols-2 gap-y-8 gap-x-10 md:gap-x-12 items-center md:items-start">
            {/* Texto */}
            <motion.div {...fadeUp} className="order-1 md:col-start-1 md:row-start-1 text-center md:text-left flex flex-col items-center md:items-start md:pt-6">
              <h1 className="text-[clamp(30px,7vw,52px)] font-bold leading-[1.05] tracking-tight mb-5 max-w-[16ch]">
                Você trabalha o mês todo.{" "}
                <span className="text-accent">Pra onde foi o dinheiro?</span>
              </h1>
              <p className="text-[15px] md:text-[17px] text-muted-foreground leading-relaxed max-w-[42ch]">
                O CORE organiza seu dinheiro em minutos — receitas, contas, dívidas e metas
                num lugar só — e te mostra exatamente quanto dá pra gastar sem aperto.
                Sem planilha, sem culpa.
              </p>
              {/* CTA no desktop fica aqui, embaixo do texto */}
              <div className="hidden md:flex flex-col items-start mt-7">
                <Button asChild size="lg" className="text-[15px] h-12 px-7">
                  <Link to={SIGNUP} onClick={() => trackEvent("landing_cta_click", { cta: "hero_signup" })}>
                    Começar teste grátis por 7 dias <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  7 dias grátis · sem cartão · cancele quando quiser
                </p>
              </div>
            </motion.div>

            {/* Primeiro mockup */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="order-2 md:col-start-2 md:row-start-1 md:row-span-2 self-start mx-auto w-full max-w-[320px]">
              <PreviewVideo src={FINANCAS_VIDEO} poster={FINANCAS_POSTER} label="Prévia do app de finanças do CORE" autoPlay preload="auto" />
            </motion.div>

            {/* CTA no mobile aparece só depois do primeiro mockup */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="order-3 md:hidden flex flex-col items-center w-full">
              <Button asChild size="lg" className="w-full text-[15px] h-12 px-7">
                <Link to={SIGNUP} onClick={() => trackEvent("landing_cta_click", { cta: "hero_signup" })}>
                  Começar teste grátis por 7 dias <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                7 dias grátis · sem cartão · cancele quando quiser
              </p>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* TENSÃO */}
      <section className="bg-secondary/50 border-y border-border">
        <Container className="py-14 md:py-20">
          <motion.div {...fadeUp} className="max-w-2xl mx-auto text-center mb-10">
            <Eyebrow>O problema não é quanto você ganha</Eyebrow>
            <h2 className="text-[26px] md:text-4xl font-bold tracking-tight leading-tight mb-4">
              Não é que você gasta demais.<br className="hidden md:block" /> É que você não vê pra onde vai.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Boleto aqui, cartão ali, um pix que some, a assinatura esquecida. No fim do mês
              a conta não fecha e você não sabe explicar. A planilha você abandona em uma semana;
              o app do banco mostra o passado, não te ajuda a decidir.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-3 md:gap-4 max-w-4xl mx-auto">
            {PAINS.map((p, i) => (
              <motion.div key={p} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
                <Card className="h-full p-5 text-sm text-muted-foreground italic">{p}</Card>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* COMO FUNCIONA / FINANÇAS EM AÇÃO */}
      <section id="como">
        <Container className="py-14 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center md:items-start">
            <div className="order-2 md:order-1 md:pt-6">
              <motion.div {...fadeUp} className="mb-8">
                <Eyebrow>Como funciona</Eyebrow>
                <h2 className="text-[26px] md:text-4xl font-bold tracking-tight leading-tight mb-4">
                  Em 30 segundos, seu mês inteiro na tela.
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Lance o que entra e o que sai. O CORE faz o resto — e mostra tudo num painel limpo,
                  do jeito que uma planilha nunca conseguiu.
                </p>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {FINANCE_CARDS.map(({ icon: Icon, t, d, cls }, i) => (
                  <motion.div key={t} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
                    <div className={`h-full rounded-xl border p-4 md:p-5 ${cls}`}>
                      <div className="w-9 h-9 rounded-lg bg-background/50 flex items-center justify-center mb-3">
                        <Icon className="w-[18px] h-[18px]" />
                      </div>
                      <div className="font-bold text-[15px] mb-1">{t}</div>
                      <p className="text-[12.5px] leading-snug opacity-80">{d}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div {...fadeUp} className="order-1 md:order-2 mx-auto w-full max-w-[320px]">
              <PreviewVideo src={FINANCAS2_VIDEO} label="Painel de finanças do CORE em uso" preload="metadata" />
            </motion.div>
          </div>
        </Container>
      </section>

      {/* SAÚDE FINANCEIRA / SCORE */}
      <section className="bg-secondary/50 border-y border-border">
        <Container className="py-14 md:py-20">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-12 items-center">
            <motion.div {...fadeUp}>
              <Eyebrow>Seu placar do dinheiro</Eyebrow>
              <h2 className="text-[26px] md:text-4xl font-bold tracking-tight leading-tight mb-4">
                Um número que diz se você tá no caminho.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                O CORE calcula sua saúde financeira — quanto sobra, quanto você compromete,
                como está sua reserva — e te diz o que mexer primeiro. Você abre o app e,
                em 5 segundos, sabe se está tudo bem.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Quanto sobra", "Contas a vencer", "Reserva de emergência", "Quanto dá pra gastar"].map((b) => (
                  <Badge key={b} variant="secondary" className="rounded-full font-medium">
                    <Check className="w-3 h-3 mr-1 text-accent" /> {b}
                  </Badge>
                ))}
              </div>
            </motion.div>
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
              <Card className="p-7 text-center">
                <div className="inline-flex items-center gap-1.5 text-accent text-xs font-semibold uppercase tracking-wider mb-4">
                  <Activity className="w-4 h-4" /> Saúde financeira
                </div>
                <div className="relative w-36 h-36 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-8 border-muted" />
                  <div className="absolute inset-0 rounded-full border-8 border-accent border-r-transparent border-b-transparent rotate-45" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold tracking-tight">Boa</span>
                    <span className="text-[11px] text-muted-foreground">no caminho certo</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Calculado a partir dos seus próprios números.</p>
              </Card>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* PROVA DE PRODUTO */}
      <section>
        <Container className="py-14 md:py-20">
          <motion.div {...fadeUp} className="text-center max-w-xl mx-auto mb-10">
            <Eyebrow>Feito pra durar</Eyebrow>
            <h2 className="text-[26px] md:text-4xl font-bold tracking-tight leading-tight">
              Os detalhes que fazem você continuar usando.
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {PROOF.map(({ icon: Icon, t, d }, i) => (
              <motion.div key={t} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
                <Card className="h-full p-4 md:p-5">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-[14px] mb-1">{t}</div>
                  <p className="text-[12.5px] text-muted-foreground leading-snug">{d}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="bg-secondary/50 border-y border-border">
        <Container className="py-14 md:py-20">
          <motion.div {...fadeUp} className="text-center max-w-xl mx-auto mb-10">
            <Eyebrow>Preço</Eyebrow>
            <h2 className="text-[26px] md:text-4xl font-bold tracking-tight leading-tight mb-2">
              Pague uma vez. Use pra sempre.
            </h2>
            <p className="text-muted-foreground">Garantia de 7 dias · Pix na hora · sem mensalidade, nunca</p>
          </motion.div>

          <div className="max-w-md mx-auto">
            {/* Vitalício — pagamento único */}
            <motion.div {...fadeUp}>
              <Card className="relative h-full p-6 ring-2 ring-accent">
                <Badge className="absolute -top-2.5 left-6 bg-accent text-accent-foreground border-transparent">
                  acesso vitalício · pagamento único
                </Badge>
                <div className="text-sm font-semibold mb-1">CORE Vitalício</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold tracking-tight">R$ 27,90</span>
                  <span className="text-sm text-muted-foreground">uma vez</span>
                </div>
                <div className="text-xs text-muted-foreground mb-5">No Pix · todos os 16 módulos · sem assinatura</div>
                <Button asChild className="w-full" size="lg">
                  <Link to={SIGNUP} onClick={() => trackEvent("landing_cta_click", { cta: "pricing_lifetime" })}>
                    Começar agora
                  </Link>
                </Button>
              </Card>
            </motion.div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-5 inline-flex items-center gap-1.5 w-full justify-center">
            <Check className="w-3.5 h-3.5 text-accent" /> Acesso completo · sem custos escondidos
          </p>
        </Container>
      </section>

      {/* FAQ */}
      <section id="faq">
        <Container className="py-14 md:py-20 max-w-2xl">
          <motion.div {...fadeUp} className="text-center mb-8">
            <Eyebrow>Perguntas frequentes</Eyebrow>
            <h2 className="text-[26px] md:text-4xl font-bold tracking-tight leading-tight">Ainda tem dúvida?</h2>
          </motion.div>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-[15px] font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </section>

      {/* CTA FINAL */}
      <section className="pb-16">
        <Container>
          <motion.div {...fadeUp}>
            <Card className="bg-foreground text-background p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-6 border-transparent">
              <div className="flex items-start gap-3 flex-1">
                <Sparkles className="w-6 h-6 shrink-0 mt-1 text-accent" />
                <div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-2">
                    Pare de terminar o mês no escuro.
                  </div>
                  <p className="text-sm text-background/70">
                    7 dias grátis. Sem cartão. Comece agora e veja exatamente pra onde seu dinheiro vai.
                  </p>
                </div>
              </div>
              <Button asChild size="lg" variant="secondary" className="shrink-0 h-12 px-6">
                <Link to={SIGNUP} onClick={() => trackEvent("landing_cta_click", { cta: "final_signup" })}>
                  Quero organizar meu dinheiro <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </Card>
          </motion.div>
        </Container>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-secondary/40">
        <Container className="py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <Link to="/lp" className="font-bold text-base text-foreground">CORE<span className="text-accent">.</span></Link>
            <span className="ml-3">© {new Date().getFullYear()} — Seu dinheiro, sob controle.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#faq" className="hover:text-foreground transition-colors">Perguntas</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Entrar</Link>
          </div>
        </Container>
      </footer>
    </div>
  );
}
