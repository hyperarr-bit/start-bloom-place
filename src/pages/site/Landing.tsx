import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Monitor, ArrowRight, Check, type LucideIcon } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { MODULOS } from "@/lib/modulos";
import { OFERTA_ANDROID, OFERTA_IOS } from "@/lib/ofertas-lojas";
import { aparelhoDaWeb } from "@/components/LojasCard";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import { RodapeSite } from "@/components/site/RodapeSite";

/**
 * A LANDING DA RAIZ — coreaplicativo.com.br (01/10/2026).
 *
 * Decisão do dono: "desisti da web [de vender], foco agora é no iPhone e
 * Android. Tira esse funil e deixa só o domínio do CORE original; nesse
 * domínio faz uma landing bonita — vê a identidade visual do app — pra
 * converter." Objetivo único da página: BAIXAR O APP. Com uma ressalva dele:
 * o site logado continua, porque o pessoal gosta de usar no navegador — então
 * "Entrar" fica visível e a página diz que a mesma conta vale no computador.
 *
 * Referências: enxovaly.com (hero com os dois selos, seção #baixar "hoje a sua
 * única tarefa é baixar o app" com QR pro computador, FAQ, rodapé) e os
 * princípios de LP da casa (memória lp-ricardo-principles: teste dos 5 s,
 * CTA repetido, nada de ponto de fuga, prova social só real).
 *
 * Identidade = a do APP, não uma casca nova (memória core-visual-identity e
 * feedback-identidade-planner): Inter, grafite + magenta, tiles pastel dos
 * 16 módulos, cabeçalhos em CAIXA ALTA com faixa colorida, quadradinhos de
 * marcar, papel quadriculado. Toda imagem é PRINT REAL do app
 * (public/landing/*.webp, tirados de /preview/<módulo> e da Home com dados
 * de exemplo — scratchpad/landing/capturar.mjs), nada desenhado à mão.
 *
 * Preços/teste grátis vêm de src/lib/ofertas-lojas.ts — um lugar só.
 *
 * Só na WEB: o app da loja nunca chega aqui (RootGate desvia pra ENTRADA_APP
 * antes). Sem framer-motion de propósito: a página tem que abrir rápido no
 * navegador do Instagram.
 */

/* ---------------------------------------------------------------- dados */

/** Os 4 módulos mais usados (memória uso_abas_set2026: finanças 85% dos
 *  pagantes, rotina 76%, treino 66%, dieta 59%). Cores = as dos tiles da Home. */
const MAIS_USADOS: Array<{ id: string; emoji: string; nome: string; faixa: string; legenda: string; alt: string }> = [
  { id: "financas", emoji: "💰", nome: "Finanças", faixa: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
    legenda: "Gastos, contas do mês e quanto ainda dá pra gastar hoje.", alt: "Tela de Finanças do CORE: resumo do mês com receitas, despesas e contas a vencer" },
  { id: "rotina", emoji: "📅", nome: "Rotina", faixa: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
    legenda: "Hábitos da semana numa tabela de marcar, como num planner de papel.", alt: "Tela de Rotina do CORE: tabela de hábitos diários da semana" },
  { id: "treino", emoji: "💪", nome: "Treino", faixa: "bg-blue-100 text-blue-900 dark:bg-blue-400/15 dark:text-blue-200",
    legenda: "Seu plano por dia da semana, com séries e cargas.", alt: "Tela de Treino do CORE: plano da semana com exercícios por dia" },
  { id: "dieta", emoji: "🥗", nome: "Dieta", faixa: "bg-green-100 text-green-900 dark:bg-green-400/15 dark:text-green-200",
    legenda: "Diário de refeições, cardápio e lista de compras.", alt: "Tela de Dieta do CORE: diário de refeições do dia" },
];

/* Avaliações REAIS da Google Play, palavra por palavra, nome como a loja
 * mostra (as mesmas 5 do paywall do app, PaywallAssinatura — curadoria de
 * 03/09). Sem nota, sem quantidade, sem foto: ninguém posou e o dono vetou
 * número que a gente não mede. */
const AVALIACOES: Array<{ nome: string; ini: string; cor: string; texto: string }> = [
  { nome: "Elisa D.", ini: "E", cor: "bg-pink-100 text-pink-800", texto: "Que app incrível! Tudo que eu sempre quis num planner online. É maravilhoso pra se organizar e motivar. Vale cada centavo." },
  { nome: "Paulo P.", ini: "P", cor: "bg-green-100 text-green-800", texto: "aplicativo muito bom, vale o preço, depois que baixei, organizei minha rotina, e estou ganhando mais por causa disso, e passando mais tempo com a minha família" },
  { nome: "Natalia J.", ini: "N", cor: "bg-amber-100 text-amber-800", texto: "gostei muito do app, consegui organizar minhas finanças, vi meus gastos e pedi ajuda com a ia TMB" },
  { nome: "Sabrina F.", ini: "S", cor: "bg-emerald-100 text-emerald-800", texto: "Pontos fortes: Design ótimo, interfaces completas sem ser complexas. Agradável de usar. Assinatura de pagamento único." },
  { nome: "Naisa E.", ini: "N", cor: "bg-blue-100 text-blue-800", texto: "Esse app é incrível e o mais evolutivo que conheci até hoje!" },
];

const PERGUNTAS: Array<{ q: string; a: ReactNode }> = [
  {
    q: "Quanto custa?",
    a: <>No iPhone, {OFERTA_IOS.anual} por ano (dá {OFERTA_IOS.anualPorMes} por mês) ou {OFERTA_IOS.mensal} por mês, pela App Store. No Android, {OFERTA_ANDROID.vitalicio} uma vez só — seu pra sempre, sem mensalidade — ou {OFERTA_ANDROID.mensal} por mês, pela Google Play. Você paga pra própria loja; a gente não guarda cartão nenhum.</>,
  },
  {
    q: "Tem teste grátis?",
    a: <>No iPhone, sim: {OFERTA_IOS.diasGratis} dias grátis no plano anual. Cancela antes do fim do teste e não paga nada. No Android não tem período de teste — o plano principal é pagamento único, então não existe renovação pra se preocupar.</>,
  },
  {
    q: "Como cancelo?",
    a: <>No iPhone: Ajustes → seu nome → Assinaturas → CORE → Cancelar (ou pela App Store). No Android, o plano único não tem o que cancelar — é seu; o mensal se cancela na Google Play, em Pagamentos e assinaturas. Nos dois casos você continua com acesso até o fim do período pago.</>,
  },
  {
    q: "Funciona no computador?",
    a: <>Sim. Depois de assinar no app, entre aqui no site com o mesmo e-mail e use pelo navegador — tudo o que você fizer num aparece no outro na hora. Muita gente planeja no computador e marca pelo celular durante o dia.</>,
  },
  {
    q: "Comprei pelo site antes. E agora?",
    a: <>Sua compra continua valendo, pra sempre, no site e no app. É só baixar o app, tocar em “Já tenho conta? Entrar” e usar o mesmo e-mail da compra — nada a pagar de novo. Se precisar, tem o <Link to="/como-entrar" className="underline underline-offset-2 font-semibold">passo a passo com fotos</Link>.</>,
  },
  {
    q: "E os meus dados?",
    a: <>O CORE não pede login de banco e não lê seu extrato: você anota o que quiser anotar. Os dados ficam na sua conta, protegidos por senha, e você pode apagar tudo a qualquer momento — pelo menu do app ou pela <Link to="/excluir-conta" className="underline underline-offset-2 font-semibold">página de exclusão</Link>, sem falar com ninguém.</>,
  },
];

/* ------------------------------------------------------------- pedaços */

const Secao = ({ id, className = "", children }: { id?: string; className?: string; children: ReactNode }) => (
  <section id={id} className={`mx-auto w-full max-w-6xl px-5 md:px-8 ${className}`}>{children}</section>
);

/** Título de seção no estilo do app: faixa + CAIXA ALTA + o título por extenso. */
const Titulo = ({ etiqueta, children, sub, centro = false }: { etiqueta: string; children: ReactNode; sub?: ReactNode; centro?: boolean }) => (
  <div className={centro ? "text-center" : ""}>
    <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
      <span className="h-[3px] w-5 rounded-full bg-gradient-to-r from-violet-500 to-accent" aria-hidden="true" />{etiqueta}
    </p>
    <h2 className="mt-2 text-[26px] md:text-[36px] font-extrabold leading-[1.1] tracking-tight text-balance">{children}</h2>
    {sub && <p className={`mt-3 text-[15.5px] md:text-[17px] leading-relaxed text-muted-foreground ${centro ? "mx-auto" : ""} max-w-[58ch]`}>{sub}</p>}
  </div>
);

/** Moldura de celular (CSS puro) com um print real dentro. 390×844 → o aspecto é
 *  o do iPhone. A FAIXA DE STATUS (hora + ilha) fica ACIMA do print, de
 *  propósito: sem ela a ilha cai por cima do cabeçalho do app e come o texto
 *  (lição das capturas da App Store, memória ios-capturas-ficha). */
const Celular = ({ src, alt, prioridade = false, className = "" }: { src: string; alt: string; prioridade?: boolean; className?: string }) => (
  <div className={`relative rounded-[44px] bg-[#111214] p-[9px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/10 ${className}`}>
    <div className="overflow-hidden rounded-[36px] bg-white">
      <div className="relative flex h-10 items-center justify-between px-6 text-[12px] font-semibold text-[#1a1a1a]" aria-hidden="true">
        <span>9:41</span>
        <span className="absolute left-1/2 top-[9px] h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-[#111214]" />
        <span className="flex items-center gap-1"><span className="h-[9px] w-[14px] rounded-[2px] border border-[#1a1a1a]/70 p-[1px]"><span className="block h-full w-[80%] rounded-[1px] bg-[#1a1a1a]" /></span></span>
      </div>
      <img
        src={src} alt={alt} width={780} height={1688}
        loading={prioridade ? "eager" : "lazy"}
        // @ts-expect-error — atributo novo, o React repassa pro DOM
        fetchpriority={prioridade ? "high" : undefined}
        decoding="async"
        className="block w-full aspect-[390/844] object-cover object-top bg-muted"
      />
    </div>
  </div>
);

const Quadradinho = ({ marcado = true }: { marcado?: boolean }) => (
  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 ${marcado ? "border-foreground bg-foreground text-background" : "border-foreground/40"}`} aria-hidden="true">
    {marcado && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
  </span>
);

/* ------------------------------------------------------------- a página */

export default function Landing() {
  const ap = aparelhoDaWeb();
  const heroRef = useRef<HTMLDivElement>(null);
  const [barra, setBarra] = useState(false);

  useEffect(() => { trackEvent("landing_view", { aparelho: ap }); }, [ap]);

  // Barra fixa de download no celular: só depois que o hero (que já tem os
  // selos) sai da tela. IntersectionObserver é barato e não roda no scroll.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || ap === "outro" || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBarra(!e.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ap]);

  const linhaDaOferta =
    ap === "iphone" ? <><b className="text-foreground">{OFERTA_IOS.diasGratis} dias grátis</b> pra testar · depois {OFERTA_IOS.anual}/ano</>
      : ap === "android" ? <><b className="text-foreground">{OFERTA_ANDROID.vitalicio} uma vez só</b> · seu pra sempre, sem mensalidade</>
        : <>No iPhone: {OFERTA_IOS.diasGratis} dias grátis · No Android: pagamento único</>;

  const entrar = (onde: string) => trackEvent("landing_entrar_click", { onde, aparelho: ap });

  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="landing" data-aparelho={ap}>
      {/* a barrinha roxo→magenta do cabeçalho do app */}
      <div className="h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-accent" aria-hidden="true" />

      {/* ---------------------------------------------------------- topo */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 md:h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 md:px-8">
          <a href="#topo" className="text-[19px] font-black tracking-tight">CORE</a>
          <nav className="hidden md:flex items-center gap-7 text-[14px] font-medium text-foreground/75" aria-label="Seções">
            <a href="#modulos" className="hover:text-foreground">Módulos</a>
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#preco" className="hover:text-foreground">Preço</a>
            <a href="#perguntas" className="hover:text-foreground">Perguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/entrar" onClick={() => entrar("topo")} data-testid="landing-entrar-topo"
              className="inline-flex h-9 items-center rounded-full border border-border px-3.5 text-[13px] font-bold hover:bg-muted"
            >
              Entrar
            </Link>
            <a href="#baixar" className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[13px] font-bold text-background hover:opacity-90">
              Baixar o app
            </a>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- hero */}
      <div id="topo" ref={heroRef} className="relative overflow-hidden">
        {/* papel quadriculado de planner, bem leve */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.55)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden="true" />
        <Secao className="relative grid items-center gap-10 pt-10 pb-14 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:pt-16 md:pb-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-foreground/80 shadow-sm">
              <span aria-hidden="true">✨</span> Planner de vida · celular e computador
            </p>
            <h1 className="mt-5 text-[36px] md:text-[58px] font-black leading-[1.02] tracking-[-0.02em] text-balance">
              Sua vida inteira, organizada num app só.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] md:text-[19px] leading-relaxed text-muted-foreground">
              Dinheiro, rotina, treino, dieta, saúde, casa… As 16 áreas da sua vida num
              planner que cabe no bolso — bonito de abrir, rápido de marcar.
            </p>

            <div className="mt-8">
              <SelosDasLojas onde="hero" altura={ap === "outro" ? 54 : 56} />
              <p className="mt-3 text-[13.5px] text-muted-foreground" data-testid="hero-oferta">{linhaDaOferta}</p>
            </div>

            {ap === "outro" ? (
              <div className="mt-7 flex items-center gap-4 rounded-2xl border border-border bg-card p-3.5 shadow-sm w-fit" data-testid="hero-qr">
                <img src="/selos/qr-baixar.svg" alt="QR code para baixar o CORE" width={96} height={96} className="h-24 w-24 rounded-lg bg-white p-1" />
                <div className="text-[13.5px] leading-snug">
                  <p className="font-bold">Aponte a câmera do celular</p>
                  <p className="text-muted-foreground">O QR abre a loja certa — App Store ou Google Play.</p>
                  <Link to="/entrar" onClick={() => entrar("hero")} className="mt-1.5 inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                    Já tenho conta, entrar aqui <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-[13.5px] text-muted-foreground">
                Já tem conta?{" "}
                <Link to="/entrar" onClick={() => entrar("hero")} className="font-semibold text-foreground underline underline-offset-2">Entrar</Link>
                {" "}— também funciona aqui pelo navegador.
              </p>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-[300px] md:max-w-[340px]">
            {/* adesivos de planner por trás, como as cores dos tiles */}
            <div className="absolute -left-10 top-12 h-40 w-40 rounded-full bg-amber-300/30 blur-2xl" aria-hidden="true" />
            <div className="absolute -right-12 bottom-16 h-44 w-44 rounded-full bg-accent/20 blur-2xl" aria-hidden="true" />
            <Celular src="/landing/home.webp" alt="Tela inicial do CORE: saudação, pontuação do dia, tarefas e a grade dos 16 módulos" prioridade className="relative" />
          </div>
        </Secao>
      </div>

      {/* ------------------------------------------- também no computador */}
      <Secao className="pb-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6" data-testid="faixa-computador">
          <div className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-400/20 text-violet-700 dark:text-violet-300"><Monitor className="h-5 w-5" /></span>
            <div>
              <p className="text-[16px] font-extrabold leading-snug">Também no computador, com a mesma conta.</p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                Planeja na tela grande, marca pelo celular durante o dia. Tudo o que você faz num aparece no outro na hora.
              </p>
            </div>
          </div>
          <Link
            to="/entrar" onClick={() => entrar("faixa_computador")} data-testid="landing-entrar-faixa"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-foreground px-5 text-[14px] font-bold hover:bg-foreground hover:text-background"
          >
            Entrar pelo navegador <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Secao>

      {/* ------------------------------------------------- mais usados */}
      <Secao id="modulos" className="pt-16 md:pt-24">
        <Titulo etiqueta="O que mais usam" sub="Cada área é uma página do planner: cabeçalho colorido, tabela de marcar, botão de adicionar. Você reconhece na hora.">
          Começa pelo que mais aperta. Hoje, geralmente, é o dinheiro.
        </Titulo>
        <div className="mt-9 grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-5">
          {MAIS_USADOS.map((m) => (
            <figure key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <figcaption className={`flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-extrabold uppercase tracking-[0.12em] ${m.faixa}`}>
                <span aria-hidden="true">{m.emoji}</span> {m.nome}
              </figcaption>
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img src={`/landing/${m.id}.webp`} alt={m.alt} width={780} height={1688} loading="lazy" decoding="async"
                     className="absolute inset-0 h-full w-full object-cover object-top" />
              </div>
              <p className="px-3 py-3 text-[12.5px] md:text-[13.5px] leading-snug text-muted-foreground">{m.legenda}</p>
            </figure>
          ))}
        </div>

        {/* e os outros 12 — os mesmos tiles pastel da Home */}
        <div className="mt-10 rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-[15px] font-extrabold">E mais 12 áreas, prontas pra quando fizerem sentido.</p>
            <p className="text-[13px] text-muted-foreground">Você liga só as suas — a tela inicial mostra o que você escolheu.</p>
          </div>
          <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12 md:gap-2.5" data-testid="tiles-modulos">
            {MODULOS.filter((m) => !MAIS_USADOS.some((u) => u.id === m.id)).map(({ id, Icon, label, color }) => (
              <Tile key={id} Icon={Icon} label={label} color={color} />
            ))}
          </ul>
        </div>
      </Secao>

      {/* --------------------------------------------------- como funciona */}
      <Secao id="como-funciona" className="pt-16 md:pt-24">
        <div className="grid items-start gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
          <Titulo etiqueta="Como funciona" sub="Feito pra caber num intervalo — não pra virar mais uma tarefa.">
            Dois minutos por dia. Só isso.
          </Titulo>
          <ol className="rounded-2xl border border-border bg-card shadow-sm">
            {[
              { t: "Baixe o app e crie sua conta", d: "Leva um minuto. Pode entrar com e-mail ou com o Google." },
              { t: "Escolha por onde começar", d: "A maioria começa pelo dinheiro; dá pra ligar o resto depois, sem recomeçar nada." },
              { t: "Marque o dia em dois minutos", d: "Dar baixa numa conta, riscar o hábito, anotar o almoço. Marcar é o jeito de ver a vida andando." },
            ].map((p, i) => (
              <li key={p.t} className={`flex gap-3.5 p-4 md:p-5 ${i > 0 ? "border-t border-dashed border-border" : ""}`}>
                <Quadradinho marcado={i < 2} />
                <div>
                  <p className="text-[15.5px] font-extrabold leading-snug"><span className="text-muted-foreground font-bold mr-1.5">{i + 1}.</span>{p.t}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Secao>

      {/* ------------------------------------------------------ avaliações */}
      <Secao className="pt-16 md:pt-24">
        <Titulo etiqueta="Quem usa, diz" sub="Avaliações publicadas na Google Play, como estão lá." centro>
          Um planner que a gente abre todo dia.
        </Titulo>
        <ul className="mt-9 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="avaliacoes">
          {AVALIACOES.map((a) => (
            <li key={a.nome} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="flex-1 text-[14.5px] leading-relaxed">“{a.texto}”</p>
              <div className="mt-4 flex items-center gap-2.5">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold ${a.cor}`}>{a.ini}</span>
                <div className="text-[12.5px] leading-tight">
                  <p className="font-bold">{a.nome}</p>
                  <p className="text-muted-foreground">Google Play</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Secao>

      {/* ----------------------------------------------------------- preço */}
      <Secao id="preco" className="pt-16 md:pt-24">
        <Titulo etiqueta="Quanto custa" sub="Você paga pra própria loja do seu celular — a gente não guarda cartão.">
          Menos que um lanche por mês.
        </Titulo>
        <div className={`mt-9 grid gap-4 md:grid-cols-2 md:gap-5 ${ap === "android" ? "[&>*:first-child]:order-2" : ""}`}>
          <PlanoCard
            etiqueta="No iPhone · App Store" faixa="bg-foreground text-background"
            destaque={`${OFERTA_IOS.diasGratis} dias grátis`}
            sub={<>depois {OFERTA_IOS.anual} por ano — dá <b className="text-foreground">{OFERTA_IOS.anualPorMes}/mês</b>. Ou {OFERTA_IOS.mensal} por mês.</>}
            itens={["Os 16 módulos, sem limite", "Cancela nos Ajustes antes do fim do teste e não paga nada", "Mesma conta no computador"]}
            loja="ios" onde="preco_iphone" ativo={ap !== "android"}
          />
          <PlanoCard
            etiqueta="No Android · Google Play" faixa="bg-emerald-600 text-white"
            destaque={`${OFERTA_ANDROID.vitalicio} uma vez só`}
            sub={<>seu <b className="text-foreground">pra sempre</b>, sem mensalidade. Ou {OFERTA_ANDROID.mensal} por mês, se preferir.</>}
            itens={["Os 16 módulos, sem limite", "Pix ou cartão, na própria Google Play", "Mesma conta no computador"]}
            loja="android" onde="preco_android" ativo={ap !== "iphone"}
          />
        </div>
      </Secao>

      {/* ---------------------------------------------------------- baixar */}
      <Secao id="baixar" className="pt-16 md:pt-24">
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-card px-5 py-10 text-center shadow-sm md:px-10 md:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.5)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" aria-hidden="true" />
          <div className="relative">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
              <span className="h-[3px] w-5 rounded-full bg-gradient-to-r from-violet-500 to-accent" aria-hidden="true" /> Tarefa de hoje
            </p>
            <h2 className="mx-auto mt-3 flex max-w-[22ch] items-start justify-center gap-3 text-[28px] md:text-[40px] font-black leading-[1.05] tracking-tight text-balance">
              <Quadradinho marcado={false} />
              <span>Baixar o CORE e organizar a semana.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-[15px] md:text-[16.5px] text-muted-foreground">
              {ap === "iphone" ? `${OFERTA_IOS.diasGratis} dias grátis pra testar — se não for pra você, cancela e não paga nada.`
                : ap === "android" ? "Pagamento único na Google Play. Sem mensalidade, sem surpresa."
                  : "Escaneie com o celular ou toque no selo da sua loja."}
            </p>
            <div className={`mt-7 flex flex-col items-center gap-6 ${ap === "outro" ? "md:flex-row md:justify-center md:gap-10" : ""}`}>
              <SelosDasLojas onde="baixar" altura={58} className="justify-center" />
              {ap === "outro" && (
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-background p-3.5 text-left" data-testid="baixar-qr">
                  <img src="/selos/qr-baixar.svg" alt="QR code para baixar o CORE" width={120} height={120} className="h-[120px] w-[120px] rounded-lg bg-white p-1" />
                  <div className="text-[13.5px] leading-snug">
                    <p className="font-bold">Aponte a câmera do celular</p>
                    <p className="text-muted-foreground max-w-[22ch]">Abre a loja certa pro seu aparelho.</p>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-7 text-[13.5px] text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/entrar" onClick={() => entrar("baixar")} data-testid="landing-entrar-baixar" className="font-semibold text-foreground underline underline-offset-2">Entrar pelo navegador</Link>
            </p>
          </div>
        </div>
      </Secao>

      {/* ------------------------------------------------------- perguntas */}
      <Secao id="perguntas" className="pt-16 pb-20 md:pt-24 md:pb-28">
        <Titulo etiqueta="Perguntas" centro>Dúvidas rápidas</Titulo>
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card px-5 shadow-sm">
          {PERGUNTAS.map((p) => (
            <details key={p.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[15.5px] font-bold [&::-webkit-details-marker]:hidden">
                {p.q}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border text-[15px] leading-none text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pb-4 text-[14.5px] leading-relaxed text-muted-foreground">{p.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-[14px] text-muted-foreground">
          Ficou outra dúvida? <Link to="/suporte" className="font-semibold text-foreground underline underline-offset-2">Fale com a gente</Link>.
        </p>
      </Secao>

      <RodapeSite />

      {/* barra fixa de download — só no celular, só depois do hero */}
      {ap !== "outro" && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur transition-transform duration-300 md:hidden ${barra ? "translate-y-0" : "translate-y-full"}`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-hidden={!barra}
          data-testid="barra-fixa"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0 leading-tight">
              <p className="text-[14px] font-extrabold">CORE</p>
              <p className="text-[12px] leading-snug text-muted-foreground">
                {ap === "iphone" ? `${OFERTA_IOS.diasGratis} dias grátis pra testar` : `${OFERTA_ANDROID.vitalicio} uma vez só, pra sempre`}
              </p>
            </div>
            <div className={ap === "iphone" ? "[&_[data-loja=android]]:hidden" : "[&_[data-loja=ios]]:hidden"}>
              <SelosDasLojas onde="barra" altura={44} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- componentes */

const Tile = ({ Icon, label, color }: { Icon: LucideIcon; label: string; color: string }) => (
  <li className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-background p-2.5 text-center">
    <span className={`grid h-9 w-9 place-items-center rounded-lg ${color}`}><Icon className="h-[18px] w-[18px]" /></span>
    <span className="text-[11px] font-semibold leading-tight text-foreground/85">{label}</span>
  </li>
);

const PlanoCard = ({ etiqueta, faixa, destaque, sub, itens, loja, onde, ativo }: {
  etiqueta: string; faixa: string; destaque: string; sub: ReactNode; itens: string[];
  loja: "ios" | "android"; onde: string; ativo: boolean;
}) => (
  <div className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${ativo ? "border-foreground/80" : "border-border"}`} data-testid={`plano-${loja}`}>
    <p className={`px-5 py-2 text-[11.5px] font-extrabold uppercase tracking-[0.14em] ${faixa}`}>{etiqueta}</p>
    <div className="p-5 md:p-6">
      <p className="text-[30px] md:text-[34px] font-black leading-none tracking-tight">{destaque}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{sub}</p>
      <ul className="mt-5 space-y-2">
        {itens.map((i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px]">
            <Quadradinho /> <span className="leading-snug">{i}</span>
          </li>
        ))}
      </ul>
      <SeloUnico loja={loja} onde={onde} />
    </div>
  </div>
);

/** Um selo só (o da loja daquele plano), passando pelo /baixar como os outros:
 *  renderiza os dois e esconde o da outra loja via CSS (o componente é um só). */
const SeloUnico = ({ loja, onde }: { loja: "ios" | "android"; onde: string }) => (
  <div className={`mt-6 ${loja === "ios" ? "[&_[data-loja=android]]:hidden" : "[&_[data-loja=ios]]:hidden"}`}>
    <SelosDasLojas onde={onde} altura={48} />
  </div>
);
