import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { MODULOS } from "@/lib/modulos";
import { aparelhoDaWeb } from "@/components/LojasCard";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import { RodapeSite } from "@/components/site/RodapeSite";

/**
 * A LANDING DA RAIZ — coreaplicativo.com.br (01/10/2026, v2 com os ajustes do dono).
 *
 * Decisão do dono: "desisti da web [de vender]… deixa só o domínio do CORE
 * original e faz uma landing bonita — vê a identidade visual do app — pra
 * converter." Objetivo único: BAIXAR O APP. O site logado continua (o pessoal
 * usa no navegador), então o "entrar" existe — mas só mais abaixo (faixa do
 * computador, seção de download, FAQ, rodapé), nunca no topo.
 *
 * Ajustes de 01/10 (v2): SEM PREÇO em lugar nenhum (nem "3 dias grátis·depois…");
 * sem "Entrar" no cabeçalho e no hero; benefícios (o que muda na vida dela)
 * antes de funcionalidades; avaliações reais das DUAS lojas perto do CTA;
 * prints do app com micro-ajustes de estado (ver scratchpad/landing/capturar-v2.mjs).
 *
 * O que veio de cada referência (estudadas por WebFetch em 01/10):
 *   · Cal AI — prova social colada no CTA do hero (uma frase real logo abaixo
 *     dos selos), seção "por que" com 3 benefícios curtos, grade de avaliações
 *     antes do fecho, selos repetidos 4× sem cansar.
 *   · Finch — 1 mensagem por seção, pouquíssimos elementos, selos logo sob o
 *     título; a página inteira respira.
 *   · Opal — blocos de benefício ALTERNANDO texto e imagem, cada um com nome
 *     curto + 1 linha; avaliações com nome e origem; fecho em faixa grande.
 *   · Structured — bloco "em todo aparelho" (celular pra marcar, computador
 *     pra planejar), avaliações misturando lojas, FAQ curta, CTA repetido.
 *
 * Identidade = a do APP (memórias core-visual-identity e feedback-identidade-
 * planner): Inter, grafite + magenta, tiles pastel dos 16 módulos, cabeçalhos
 * em CAIXA ALTA com faixa, quadradinhos de marcar, papel quadriculado. Toda
 * imagem é PRINT REAL do app com dados de exemplo (public/landing/*.webp) —
 * nada desenhado à mão; os ajustes são só de estado, recorte e conteúdo de
 * exemplo (regra da memória feedback-posts-print-real).
 *
 * Só na WEB: o app da loja nunca chega aqui (RootGate desvia antes). Sem
 * framer-motion de propósito: tem que abrir rápido no navegador do Instagram.
 */

/* ---------------------------------------------------------------- dados */

/** Avaliações REAIS, literais, nome como a loja mostra. Cortes só com "…".
 *  App Store: API do App Store Connect (customerReviews do app 6806913181,
 *  lidas em 01/10 — existem 3; as duas de 5★ estão aqui). Google Play: API
 *  do Play (play-reviews.mjs, 01/10: Nath M., Susam M., Anne K.; Rebeca G.
 *  conferida em 25/09) + Elisa M. e Paulo H. (texto do paywall, nomes
 *  conferidos na API em 07/09 — o paywall ainda tem "Elisa D./Paulo P.",
 *  que estão errados). Sem nota média, sem contagem. */
const AVALIACOES: Array<{ nome: string; loja: "App Store" | "Google Play"; ini: string; cor: string; texto: string }> = [
  { nome: "Sabryna1610", loja: "App Store", ini: "S", cor: "bg-pink-100 text-pink-800", texto: "Gente, que aplicativo incrível!!! Era tudo que eu precisava, eu amei demais. Vale muito a pena pagar" },
  { nome: "Nath M.", loja: "Google Play", ini: "N", cor: "bg-amber-100 text-amber-800", texto: "baixei hoje e até o momento, EU AMEIIIIII O APP. Super fácil de mexer, bem dinâmico, Muito visual, com personalização de cores." },
  { nome: "ywonvu", loja: "App Store", ini: "Y", cor: "bg-blue-100 text-blue-800", texto: "Uso desde a versão web e foi muito legal acompanhar a lapidação durante o tempo de uso. Sem dúvidas, o mais completo que já usei até hoje." },
  { nome: "Rebeca G.", loja: "Google Play", ini: "R", cor: "bg-emerald-100 text-emerald-800", texto: "Estou gostando bastante do Core! Acho muito legal reunir várias áreas da vida em um só lugar, como rotina, finanças, treino, alimentação, estudos, metas e até cuidados com os pets. A interface é bonita e fácil de usar…" },
  { nome: "Susam M.", loja: "Google Play", ini: "S", cor: "bg-violet-100 text-violet-800", texto: "Estou adorando o Core! Super prático, fácil de usar e está me ajudando muito a organizar melhor minha rotina. Recomendo!" },
  { nome: "Elisa M.", loja: "Google Play", ini: "E", cor: "bg-rose-100 text-rose-800", texto: "Que app incrível! Tudo que eu sempre quis num planner online. É maravilhoso pra se organizar e motivar. Vale cada centavo." },
];

/** Benefícios — o que muda na vida dela; a funcionalidade entra como apoio. */
const BENEFICIOS: Array<{ id: string; etiqueta: string; titulo: string; linha: string; apoio: string[]; imagens: Array<{ src: string; alt: string }> }> = [
  {
    id: "dinheiro", etiqueta: "Dinheiro",
    titulo: "Saber pra onde vai o dinheiro.",
    linha: "Anota o gasto em dois toques e vê o mês inteiro de uma vez — sem conectar banco nenhum.",
    apoio: ["Contas com lembrete antes de vencer", "Gastos por categoria", "Quanto ainda dá pra gastar hoje"],
    imagens: [{ src: "/landing/financas.webp", alt: "Finanças do CORE: resumo do mês com receitas, despesas, saldo e alertas de contas a vencer" }],
  },
  {
    id: "rotina", etiqueta: "Rotina",
    titulo: "Manter a rotina sem esforço.",
    linha: "Hábitos numa tabela de marcar, como num planner de papel — e uma sequência que cresce quando você aparece.",
    apoio: ["Hábitos da semana", "Sequência de dias seguidos", "Tarefas com horário e aviso"],
    imagens: [{ src: "/landing/rotina.webp", alt: "Rotina do CORE: tabela de hábitos diários da semana e mapa de consistência" }],
  },
  {
    id: "corpo", etiqueta: "Treino e dieta",
    titulo: "Ver a evolução, semana a semana.",
    linha: "O treino por dia, as cargas subindo, o cardápio e a lista de compras no mesmo lugar.",
    apoio: ["Séries, cargas e repetições", "Cardápio da semana", "Lista de compras pronta"],
    imagens: [
      { src: "/landing/treino.webp", alt: "Treino do CORE: treino do dia com séries, cargas e repetições" },
      { src: "/landing/dieta.webp", alt: "Dieta do CORE: cardápio da semana com as refeições do dia abertas" },
    ],
  },
];

const PERGUNTAS: Array<{ q: string; a: ReactNode }> = [
  {
    q: "Como funciona a assinatura?",
    a: <>Você assina pela própria loja do seu celular — App Store ou Google Play. O app mostra as opções antes de você decidir, e o pagamento é feito pra loja: a gente não guarda cartão.</>,
  },
  {
    q: "Dá pra testar antes?",
    a: <>No iPhone, dá: você testa antes de pagar e, se não for pra você, cancela dentro do período de teste sem custo. No Android o app mostra as opções antes de assinar.</>,
  },
  {
    q: "Como cancelo?",
    a: <>Pela própria loja: no iPhone em Ajustes → seu nome → Assinaturas; no Android em Google Play → Pagamentos e assinaturas. Você continua com acesso até o fim do período que já pagou.</>,
  },
  {
    q: "Funciona no computador?",
    a: <>Sim. Depois de assinar no app, entre aqui no site com o mesmo e-mail e use pelo navegador — o que você faz num aparece no outro na hora. Muita gente planeja no computador e marca pelo celular durante o dia.</>,
  },
  {
    q: "Comprei pelo site antes. E agora?",
    a: <>Sua compra continua valendo, no site e no app. É só baixar o app, tocar em “Já tenho conta? Entrar” e usar o mesmo e-mail — nada a pagar de novo. Se precisar, tem o <Link to="/como-entrar" className="underline underline-offset-2 font-semibold">passo a passo com fotos</Link>.</>,
  },
  {
    q: "E os meus dados?",
    a: <>O CORE não pede login de banco e não lê seu extrato: você anota o que quiser anotar. Os dados ficam na sua conta, protegidos por senha, e você pode apagar tudo a qualquer momento — pelo menu do app ou pela <Link to="/excluir-conta" className="underline underline-offset-2 font-semibold">página de exclusão</Link>.</>,
  },
];

/* ------------------------------------------------------------- pedaços */

const Secao = ({ id, className = "", children }: { id?: string; className?: string; children: ReactNode }) => (
  <section id={id} className={`mx-auto w-full max-w-6xl px-5 md:px-8 ${className}`}>{children}</section>
);

const Etiqueta = ({ children }: { children: ReactNode }) => (
  <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
    <span className="h-[3px] w-5 rounded-full bg-gradient-to-r from-violet-500 to-accent" aria-hidden="true" />{children}
  </p>
);

const Titulo = ({ etiqueta, children, sub, centro = false }: { etiqueta: string; children: ReactNode; sub?: ReactNode; centro?: boolean }) => (
  <div className={centro ? "text-center" : ""}>
    <Etiqueta>{etiqueta}</Etiqueta>
    <h2 className="mt-2 text-[28px] md:text-[40px] font-extrabold leading-[1.08] tracking-tight text-balance">{children}</h2>
    {sub && <p className={`mt-3 text-[16px] md:text-[18px] leading-relaxed text-muted-foreground ${centro ? "mx-auto" : ""} max-w-[56ch]`}>{sub}</p>}
  </div>
);

/** Moldura de celular (CSS puro) com um print real dentro. A FAIXA DE STATUS
 *  (hora + ilha) fica ACIMA do print, de propósito: sem ela a ilha cai por
 *  cima do cabeçalho do app (lição das capturas da App Store). */
const Celular = ({ src, alt, prioridade = false, compacto = false, className = "" }: { src: string; alt: string; prioridade?: boolean; compacto?: boolean; className?: string }) => (
  <div className={`relative ${compacto ? "rounded-[34px] p-[7px]" : "rounded-[44px] p-[9px]"} bg-[#111214] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/10 ${className}`}>
    <div className={`overflow-hidden ${compacto ? "rounded-[28px]" : "rounded-[36px]"} bg-white`}>
      {/* compacto (celular pequeno, lado a lado): só a ilha, sem hora/bateria — não cabem */}
      <div className={`relative flex ${compacto ? "h-7" : "h-10"} items-center justify-between px-6 text-[12px] font-semibold text-[#1a1a1a]`} aria-hidden="true">
        {!compacto && <span>9:41</span>}
        <span className={`absolute left-1/2 ${compacto ? "top-[7px] h-[14px] w-[56px]" : "top-[9px] h-[22px] w-[90px]"} -translate-x-1/2 rounded-full bg-[#111214]`} />
        {!compacto && <span className="h-[9px] w-[14px] rounded-[2px] border border-[#1a1a1a]/70 p-[1px]"><span className="block h-full w-[80%] rounded-[1px] bg-[#1a1a1a]" /></span>}
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

const Tile = ({ Icon, label, color }: { Icon: LucideIcon; label: string; color: string }) => (
  <li className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-background p-2.5 text-center">
    <span className={`grid h-9 w-9 place-items-center rounded-lg ${color}`}><Icon className="h-[18px] w-[18px]" /></span>
    <span className="text-[11px] font-semibold leading-tight text-foreground/85">{label}</span>
  </li>
);

const Papel = ({ className = "" }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.55)_1px,transparent_1px)] bg-[size:28px_28px] ${className}`} aria-hidden="true" />
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

  const entrar = (onde: string) => trackEvent("landing_entrar_click", { onde, aparelho: ap });
  const soDoAparelho = ap === "iphone" ? "[&_[data-loja=android]]:hidden" : ap === "android" ? "[&_[data-loja=ios]]:hidden" : "";

  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="landing" data-aparelho={ap}>
      {/* a barrinha roxo→magenta do cabeçalho do app */}
      <div className="h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-accent" aria-hidden="true" />

      {/* ---------------------------------------------------------- topo */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70" data-testid="landing-topo">
        <div className="mx-auto flex h-14 md:h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 md:px-8">
          <a href="#topo" className="text-[19px] font-black tracking-tight">CORE</a>
          <nav className="hidden md:flex items-center gap-7 text-[14px] font-medium text-foreground/75" aria-label="Seções">
            <a href="#beneficios" className="hover:text-foreground">O que muda</a>
            <a href="#modulos" className="hover:text-foreground">Áreas</a>
            <a href="#avaliacoes" className="hover:text-foreground">Avaliações</a>
            <a href="#perguntas" className="hover:text-foreground">Perguntas</a>
          </nav>
          <a href="#baixar" className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[13px] font-bold text-background hover:opacity-90">
            Baixar o app
          </a>
        </div>
      </header>

      {/* ---------------------------------------------------------- hero */}
      <div id="topo" ref={heroRef} className="relative overflow-hidden">
        <Papel className="[mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <Secao className="relative grid items-center gap-10 pt-10 pb-14 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:pt-16 md:pb-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-foreground/80 shadow-sm">
              <span aria-hidden="true">✨</span> Planner de vida
            </p>
            <h1 className="mt-5 text-[38px] md:text-[60px] font-black leading-[1.02] tracking-[-0.02em] text-balance">
              Sua vida inteira, organizada num app só.
            </h1>
            <p className="mt-5 max-w-[44ch] text-[17px] md:text-[19px] leading-relaxed text-muted-foreground">
              Dinheiro, rotina, treino, dieta, saúde, casa… As 16 áreas da sua vida num
              planner que cabe no bolso — bonito de abrir, rápido de marcar.
            </p>

            <div className="mt-8">
              <SelosDasLojas onde="hero" altura={ap === "outro" ? 54 : 56} />
              <p className="mt-3 text-[13.5px] text-muted-foreground" data-testid="hero-linha">
                iPhone e Android · e no computador, com a mesma conta
              </p>
            </div>

            {/* prova social colada no CTA (Cal AI): uma frase real, da loja */}
            <figure className="mt-7 flex items-start gap-3 max-w-[46ch]" data-testid="hero-prova">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-[13px] font-extrabold text-blue-800">Y</span>
              <div>
                <blockquote className="text-[14.5px] leading-snug font-medium">“…Sem dúvidas, o mais completo que já usei até hoje.”</blockquote>
                <figcaption className="mt-1 text-[12.5px] text-muted-foreground">ywonvu · avaliação na App Store</figcaption>
              </div>
            </figure>

            {ap === "outro" && (
              <div className="mt-7 flex items-center gap-4 rounded-2xl border border-border bg-card p-3.5 shadow-sm w-fit" data-testid="hero-qr">
                <img src="/selos/qr-baixar.svg" alt="QR code para baixar o CORE" width={96} height={96} className="h-24 w-24 rounded-lg bg-white p-1" />
                <div className="text-[13.5px] leading-snug">
                  <p className="font-bold">Aponte a câmera do celular</p>
                  <p className="text-muted-foreground">O QR abre a loja certa — App Store ou Google Play.</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-[300px] md:max-w-[340px]">
            <div className="absolute -left-10 top-12 h-40 w-40 rounded-full bg-amber-300/30 blur-2xl" aria-hidden="true" />
            <div className="absolute -right-12 bottom-16 h-44 w-44 rounded-full bg-accent/20 blur-2xl" aria-hidden="true" />
            <Celular src="/landing/home.webp" alt="Tela inicial do CORE: saudação, pontuação do dia, sequência, tarefas de hoje e a grade dos módulos" prioridade className="relative" />
          </div>
        </Secao>
      </div>

      {/* ------------------------------------------------- benefícios */}
      <Secao id="beneficios" className="pt-10 md:pt-16">
        <Titulo etiqueta="O que muda" centro sub="Três coisas que a gente ouve de quem usa. Cada uma é uma página do planner.">
          Menos coisa na cabeça. Mais vida andando.
        </Titulo>
      </Secao>
      {BENEFICIOS.map((b, i) => (
        <Secao key={b.id} className={`grid items-center gap-8 pt-14 md:pt-24 md:grid-cols-2 md:gap-14 ${i === BENEFICIOS.length - 1 ? "pb-4" : ""}`}>
          <div className={i % 2 === 1 ? "md:order-2" : ""}>
            <Etiqueta>{b.etiqueta}</Etiqueta>
            <h3 className="mt-2 text-[28px] md:text-[38px] font-extrabold leading-[1.08] tracking-tight text-balance">{b.titulo}</h3>
            <p className="mt-3 max-w-[46ch] text-[16px] md:text-[17.5px] leading-relaxed text-muted-foreground">{b.linha}</p>
            <ul className="mt-5 space-y-2.5">
              {b.apoio.map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-[14.5px] md:text-[15px]"><Quadradinho /><span className="leading-snug">{a}</span></li>
              ))}
            </ul>
          </div>
          <div className={`relative mx-auto w-full ${b.imagens.length === 2 ? "max-w-[460px]" : "max-w-[300px] md:max-w-[320px]"} ${i % 2 === 1 ? "md:order-1" : ""}`}>
            {b.imagens.length === 2 ? (
              <div className="grid grid-cols-2 gap-4 md:gap-6 items-start">
                <Celular src={b.imagens[0].src} alt={b.imagens[0].alt} compacto />
                <Celular src={b.imagens[1].src} alt={b.imagens[1].alt} compacto className="mt-8" />
              </div>
            ) : (
              <Celular src={b.imagens[0].src} alt={b.imagens[0].alt} />
            )}
          </div>
        </Secao>
      ))}

      {/* ----------------------------------------- celular e computador */}
      <Secao className="pt-16 md:pt-24">
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
          <Papel className="[mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_75%)]" />
          <div className="relative grid items-center gap-8 p-6 md:grid-cols-[0.9fr_1.1fr] md:gap-10 md:p-10" data-testid="faixa-computador">
            <div>
              <Etiqueta>Em todo aparelho</Etiqueta>
              <h3 className="mt-2 text-[26px] md:text-[34px] font-extrabold leading-[1.1] tracking-tight text-balance">No celular pra marcar. No computador pra planejar.</h3>
              <p className="mt-3 max-w-[44ch] text-[15.5px] md:text-[16.5px] leading-relaxed text-muted-foreground">
                Mesma conta nos dois: o que você faz num aparece no outro na hora.
              </p>
              <Link
                to="/entrar" onClick={() => entrar("faixa_computador")} data-testid="landing-entrar-faixa"
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-foreground px-5 text-[14px] font-bold hover:bg-foreground hover:text-background"
              >
                Já tenho conta — entrar pelo navegador <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative">
              {/* notebook: moldura CSS + print real da Home no navegador */}
              <div className="rounded-t-[14px] border border-b-0 border-black/10 bg-[#1b1c1f] p-[6px] pb-0 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.5)]">
                <img src="/landing/computador.webp" alt="CORE aberto no navegador do computador: tela inicial com o trilho dos módulos" width={1800} height={1125} loading="lazy" decoding="async" className="block w-full rounded-t-[9px] aspect-[1800/1125] object-cover object-top bg-muted" />
              </div>
              <div className="h-3 rounded-b-[10px] bg-gradient-to-b from-[#2a2b30] to-[#15161a]" aria-hidden="true" />
              <div className="mx-auto h-1.5 w-[22%] rounded-b-md bg-[#0f1013]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Secao>

      {/* ------------------------------------------------- as 16 áreas */}
      <Secao id="modulos" className="pt-16 md:pt-24">
        <Titulo etiqueta="16 áreas" centro sub="Você liga só as que fizerem sentido agora. As outras ficam guardadas, prontas pra quando quiser.">
          E o resto da vida, no mesmo lugar.
        </Titulo>
        <ul className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-8 md:gap-3" data-testid="tiles-modulos">
          {MODULOS.map(({ id, Icon, label, color }) => <Tile key={id} Icon={Icon} label={label} color={color} />)}
        </ul>
      </Secao>

      {/* --------------------------------------------------- como funciona */}
      <Secao id="como-funciona" className="pt-16 md:pt-24">
        <div className="grid items-start gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
          <div>
            <Titulo etiqueta="Como funciona" sub="Feito pra caber num intervalo — não pra virar mais uma tarefa.">
              Dois minutos por dia. Só isso.
            </Titulo>
            <SelosDasLojas onde="como_funciona" altura={48} className="mt-7" />
          </div>
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
      <Secao id="avaliacoes" className="pt-16 md:pt-24">
        <Titulo etiqueta="Quem usa, diz" centro sub="Avaliações publicadas na App Store e na Google Play, como estão lá.">
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
                  <p className="text-muted-foreground" data-loja-avaliacao={a.loja}>{a.loja}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Secao>

      {/* ---------------------------------------------------------- baixar */}
      <Secao id="baixar" className="pt-12 md:pt-16">
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-card px-5 py-10 text-center shadow-sm md:px-10 md:py-14">
          <Papel className="[mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" />
          <div className="relative">
            <Etiqueta>Tarefa de hoje</Etiqueta>
            <h2 className="mx-auto mt-3 flex max-w-[22ch] items-start justify-center gap-3 text-[28px] md:text-[40px] font-black leading-[1.05] tracking-tight text-balance">
              <Quadradinho marcado={false} />
              <span>Baixar o CORE e organizar a semana.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-[15px] md:text-[16.5px] text-muted-foreground">
              {ap === "outro" ? "Escaneie com o celular ou toque no selo da sua loja." : "Toque no selo da sua loja. Leva um minuto."}
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

      {/* barra fixa de download — só no celular, só depois do hero, só a loja do aparelho */}
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
              <p className="text-[12px] leading-snug text-muted-foreground">Planner de vida, no seu celular</p>
            </div>
            <div className={soDoAparelho}><SelosDasLojas onde="barra" altura={44} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
