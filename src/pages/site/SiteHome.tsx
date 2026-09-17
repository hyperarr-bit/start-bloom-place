import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign, CalendarCheck, Sparkles, Heart, Home, GraduationCap,
  BookOpen, Droplets, Plane, Briefcase, Dumbbell, Apple, Brain, Users,
  PawPrint, Leaf, ArrowRight, Check, ChevronDown,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { RodapeSite } from "@/components/site/RodapeSite";

/**
 * HOME INSTITUCIONAL (24/08) — coreaplicativo.com.br na raiz.
 *
 * Nasceu de uma recusa: a inscrição no Apple Developer Program foi negada
 * porque a URL enviada (/inicio) é o FUNIL — quiz, sem menu, sem rodapé, sem
 * contato. O revisor descreveu como "em fase de construção, com conteúdo
 * limitado e não relacionado à empresa da inscrição". Estava certo.
 *
 * O funil continua intacto em /inicio e segue recebendo o tráfego pago. Esta
 * página atende quem digita o domínio — visitante de marca, mais quente — e
 * o revisor de loja. Todo CTA daqui empurra pro mesmo funil, então ela não
 * tira venda: adiciona uma porta que antes não existia.
 *
 * Regra que não pode quebrar: isto é WEB. O app da Play nunca chega aqui —
 * o RootGate desvia o shell nativo ANTES (ver App.tsx, ENTRADA_APP).
 */

const MODULOS = [
  { Icon: DollarSign,     nome: "Finanças",     desc: "gastos, contas e o que sobra" },
  { Icon: CalendarCheck,  nome: "Rotina",       desc: "hábitos e agenda da semana" },
  { Icon: Dumbbell,       nome: "Treino",       desc: "séries, cargas e frequência" },
  { Icon: Apple,          nome: "Dieta",        desc: "refeições e lista de compras" },
  { Icon: Heart,          nome: "Saúde",        desc: "água, sono, consultas e exames" },
  { Icon: Home,           nome: "Casa",         desc: "limpeza, mercado e manutenção" },
  { Icon: GraduationCap,  nome: "Estudos",      desc: "matérias, provas e prazos" },
  { Icon: Sparkles,       nome: "Dev. pessoal", desc: "metas e o que você quer virar" },
  { Icon: BookOpen,       nome: "Biblioteca",   desc: "livros, filmes e séries" },
  { Icon: Droplets,       nome: "Beleza",       desc: "skincare, cabelo e cuidados" },
  { Icon: Plane,          nome: "Viagens",      desc: "roteiro, bagagem e orçamento" },
  { Icon: Briefcase,      nome: "Carreira",     desc: "currículo, metas e networking" },
  { Icon: Brain,          nome: "Mente",        desc: "foco, ideias e projetos" },
  { Icon: Users,          nome: "Relações",     desc: "aniversários e presentes" },
  { Icon: PawPrint,       nome: "Pet",          desc: "vacinas, banho e ração" },
  { Icon: Leaf,           nome: "Detox",        desc: "tempo de tela e pausas" },
];

const DEPOIMENTOS = [
  {
    texto: "Achei que seria só mais um app de finanças, mas acabei migrando praticamente minha rotina inteira pra ele. Hoje já olho quanto posso gastar antes de sair de casa.",
    foto: "/depoimentos/joaop.jpg",
    quem: "João P. — 24 anos · Campinas, SP",
  },
  {
    texto: "A tela inicial personalizada foi o que mais me conquistou. Não preciso abrir cinco aplicativos diferentes durante o dia.",
    foto: "/depoimentos/amanda.jpg",
    quem: "Amanda L. — 21 anos · Fortaleza, CE",
  },
  {
    texto: "Eu usava caderno pra rotina, planilha pra dinheiro e o bloco de notas pro resto. Agora é tudo num lugar só e eu realmente abro todo dia.",
    foto: "/depoimentos/mariana.jpg",
    quem: "Mariana S. — 29 anos · Belo Horizonte, MG",
  },
];

const PERGUNTAS = [
  {
    q: "O CORE é um app de finanças?",
    a: "Finanças é o módulo mais usado, mas o CORE tem 16 áreas — rotina, treino, dieta, saúde, casa, estudos e outras. Você liga só as que fazem sentido pra você e desliga o resto; a tela inicial mostra o que você escolheu.",
  },
  {
    q: "Preciso conectar meu banco?",
    a: "Não. O CORE não pede login de banco, não usa Open Finance e não lê seu extrato automaticamente. Você registra o que quiser registrar. É uma escolha de projeto: menos dado sensível guardado, menos risco pra você.",
  },
  {
    q: "Funciona no celular e no computador?",
    a: "Sim. O CORE roda no navegador de qualquer aparelho e tem aplicativo Android na Google Play. Os dados são os mesmos nos dois — você entra com a sua conta e continua de onde parou.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "Pelo site é Pix, pagamento único, acesso vitalício. Pelo aplicativo Android existem também planos mensal e anual pagos à vista dentro da Google Play. Em nenhum deles a gente guarda o número do seu cartão.",
  },
  {
    q: "Dá pra apagar minha conta e meus dados?",
    a: "Dá, a qualquer momento, sem falar com ninguém: pelo menu da conta dentro do app, ou pela página de exclusão aqui do site. A gente apaga os dados vinculados à conta.",
  },
  {
    q: "Como falo com vocês?",
    a: "Por e-mail, em suporte@coreaplicativo.com.br. Respondemos em até 48 horas úteis. A página de suporte tem as perguntas mais comuns e os dados da empresa.",
  },
];

const Secao = ({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={`max-w-5xl mx-auto px-5 ${className}`}>{children}</section>
);

const Pergunta = ({ q, a }: { q: string; a: string }) => {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-[15px] font-semibold">{q}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${aberta ? "rotate-180" : ""}`} />
      </button>
      {aberta && <p className="pb-5 -mt-1 text-[14.5px] leading-relaxed text-muted-foreground max-w-[60ch]">{a}</p>}
    </div>
  );
};

export default function SiteHome() {
  useEffect(() => { trackEvent("site_home_view", {}); }, []);

  const Comecar = ({ onde, children, className = "" }: { onde: string; children: React.ReactNode; className?: string }) => (
    <Link
      to="/inicio"
      onClick={() => trackEvent("site_home_cta", { onde })}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[15px] font-bold text-accent-foreground transition-opacity hover:opacity-90 ${className}`}
    >
      {children}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ---------- topo ---------- */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="text-lg font-extrabold tracking-tight">CORE</Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-foreground/75">
            <a href="#modulos" className="hover:text-accent transition-colors">Módulos</a>
            <a href="#preco" className="hover:text-accent transition-colors">Preço</a>
            <a href="#perguntas" className="hover:text-accent transition-colors">Perguntas</a>
            <Link to="/suporte" className="hover:text-accent transition-colors">Suporte</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/entrar" className="text-sm font-semibold text-foreground/75 hover:text-accent transition-colors">
              Entrar
            </Link>
            <Comecar onde="topo" className="!px-4 !py-2 !text-[13.5px]">Começar</Comecar>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <Secao className="pt-14 pb-16 md:pt-20 md:pb-20">
        <div className="grid md:grid-cols-[1.05fr_1fr] gap-10 md:gap-8 items-center">
          <div>
            <h1 className="text-[34px] md:text-[46px] font-extrabold leading-[1.06] tracking-tight text-balance">
              Sua vida inteira organizada num aplicativo só.
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground max-w-[46ch]">
              Dinheiro, rotina, treino, saúde, casa, estudos. O CORE junta as 16 áreas
              que hoje estão espalhadas em cadernos, planilhas e cinco apps diferentes —
              e mostra só as que você escolher.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Comecar onde="hero">Montar meu CORE <ArrowRight className="w-4 h-4" /></Comecar>
              <span className="text-[13px] text-muted-foreground">
                Pagamento único no Pix · sem mensalidade
              </span>
            </div>
            <div className="mt-7 flex items-center gap-3">
              <div className="flex -space-x-2">
                {DEPOIMENTOS.map((d) => (
                  <img key={d.foto} src={d.foto} alt="" loading="lazy"
                       className="w-7 h-7 rounded-full object-cover ring-2 ring-background" />
                ))}
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                <span className="text-[#f0a500]">★★★★★</span> quem já organizou a vida no CORE
              </p>
            </div>
          </div>

          <div className="relative">
            <img
              src="/hero-phones.webp"
              alt="Telas do aplicativo CORE mostrando os módulos de finanças e rotina"
              loading="eager"
              className="w-full max-w-[420px] mx-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/hero-phones.png"; }}
            />
          </div>
        </div>
      </Secao>

      {/* ---------- módulos ---------- */}
      <div className="border-y border-border bg-muted/25">
        <Secao id="modulos" className="py-16">
          <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-balance">
            16 áreas. Você liga as suas.
          </h2>
          <p className="mt-3 text-[15.5px] text-muted-foreground max-w-[56ch]">
            Ninguém precisa de tudo ao mesmo tempo. Na primeira abertura você escolhe por
            onde começar, e a tela inicial passa a mostrar só isso. As outras ficam
            guardadas, prontas pra quando fizerem sentido.
          </p>
          <div className="mt-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODULOS.map(({ Icon, nome, desc }) => (
              <div key={nome} className="rounded-xl border border-border bg-card p-4">
                <Icon className="w-5 h-5 text-accent" />
                <p className="mt-2.5 text-[14.5px] font-bold">{nome}</p>
                <p className="text-[12.5px] leading-snug text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Secao>
      </div>

      {/* ---------- como funciona ---------- */}
      <Secao className="py-16">
        <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Como funciona</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-7">
          {[
            { n: "1", t: "Escolha a área que mais te aperta", d: "A maioria começa por dinheiro. Em um minuto você monta seu primeiro painel — renda, gastos fixos, o que sobra." },
            { n: "2", t: "Use por dois minutos ao dia", d: "Marcar a água, dar baixa numa conta, riscar o hábito. O CORE foi feito pra caber num intervalo, não pra virar tarefa." },
            { n: "3", t: "Ligue o resto quando quiser", d: "Treino, dieta, casa, estudos. Cada área nova entra com o painel já montado, sem recomeçar do zero." },
          ].map((p) => (
            <div key={p.n}>
              <div className="w-8 h-8 rounded-full bg-accent/10 text-accent grid place-items-center text-[13px] font-extrabold">
                {p.n}
              </div>
              <h3 className="mt-3.5 text-[16px] font-bold">{p.t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* ---------- depoimentos ---------- */}
      <div className="border-y border-border bg-muted/25">
        <Secao className="py-16">
          <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Quem usa</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {DEPOIMENTOS.map((d) => (
              <figure key={d.foto} className="rounded-xl border border-border bg-card p-5">
                <p className="text-[14.5px] leading-relaxed text-foreground/90">“{d.texto}”</p>
                <figcaption className="mt-4 flex items-center gap-2.5">
                  <img src={d.foto} alt="" loading="lazy" className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    {d.quem} <span className="text-[#f0a500]">★★★★★</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Secao>
      </div>

      {/* ---------- preço ---------- */}
      <Secao id="preco" className="py-16">
        <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Preço</h2>
        <p className="mt-3 text-[15.5px] text-muted-foreground max-w-[56ch]">
          Um pagamento, acesso pra sempre. Sem mensalidade escondida e sem cobrança
          automática no cartão.
        </p>

        <div className="mt-8 grid md:grid-cols-[1.1fr_1fr] gap-5">
          <div className="rounded-2xl border-2 border-accent bg-card p-7">
            <p className="text-[12px] font-bold uppercase tracking-widest text-accent">Aqui no site</p>
            <p className="mt-3 text-[40px] font-extrabold leading-none tracking-tight">R$&nbsp;27,90</p>
            <p className="mt-2 text-[14px] text-muted-foreground">pagamento único no Pix · acesso vitalício</p>
            <ul className="mt-6 space-y-2.5">
              {["Os 16 módulos liberados", "Acesso no celular e no computador", "Sem renovação automática", "Cancelar não existe — você já é dono"].map((i) => (
                <li key={i} className="flex items-start gap-2.5 text-[14.5px]">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-accent" />{i}
                </li>
              ))}
            </ul>
            <Comecar onde="preco" className="mt-7 w-full">Começar agora <ArrowRight className="w-4 h-4" /></Comecar>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7">
            <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">No aplicativo Android</p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              O CORE também está na Google Play, com planos mensal e anual pagos à vista
              dentro da loja — Pix ou cartão, sem renovação automática.
            </p>
            <a
              href="https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app"
              target="_blank" rel="noopener noreferrer"
              onClick={() => trackEvent("site_home_cta", { onde: "play" })}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-[14.5px] font-bold transition-colors hover:border-accent hover:text-accent"
            >
              Ver na Google Play <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </Secao>

      {/* ---------- perguntas ---------- */}
      <div className="border-t border-border bg-muted/25">
        <Secao id="perguntas" className="py-16">
          <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-7 max-w-[68ch]">
            {PERGUNTAS.map((p) => <Pergunta key={p.q} {...p} />)}
          </div>
          <p className="mt-8 text-[14.5px] text-muted-foreground">
            Ficou outra dúvida?{" "}
            <Link to="/suporte" className="font-semibold text-accent hover:underline">Fale com o suporte</Link>.
          </p>
        </Secao>
      </div>

      {/* ---------- fecho ---------- */}
      <Secao className="py-16 text-center">
        <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-balance max-w-[20ch] mx-auto">
          Comece pela área que mais te aperta hoje.
        </h2>
        <Comecar onde="rodape" className="mt-7">Montar meu CORE <ArrowRight className="w-4 h-4" /></Comecar>
      </Secao>

      <RodapeSite />
    </div>
  );
}
