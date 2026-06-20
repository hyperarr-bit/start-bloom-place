import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Lock, WifiOff, Smartphone, ShieldCheck, Check, ChevronDown,
  Wallet, Flame, Receipt, PiggyBank, CalendarCheck, Target, Dumbbell, Apple,
  Brain, BookOpen, Home as HomeIcon, Plane, Heart, GraduationCap, Users,
  PawPrint, Leaf, Sparkles, TrendingDown, TrendingUp,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

/* ============================================================
   CORE — Landing (rebuild 2026)
   Identidade "premium quente": Fraunces + Inter, base creme,
   acento verde-dinheiro #127A56, pop âmbar #E8943B.
   Construída do zero — nada reaproveitado da LP antiga.
   Wedge: dinheiro. Oferta: paga + garantia de 7 dias.
   ============================================================ */

const cta = (id: string) => () => trackEvent("landing_cta_click", { cta: id });

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

/* ---------- mocks de produto (visual-herói, sem foto de celular) ---------- */

const SaldoMock = () => (
  <div className="relative">
    <div className="rounded-3xl bg-white border border-[#E9E1D6] shadow-[0_30px_60px_-30px_rgba(27,23,20,0.35)] p-5 md:p-6 w-full max-w-[380px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B6259]">Saldo do mês</span>
        <span className="text-[11px] text-[#6B6259]">Junho</span>
      </div>
      <div className="font-display text-[40px] leading-none font-semibold text-[#0E5E42]">+ R$ 1.240</div>
      <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-[#0E5E42] bg-[#E4F0EA] rounded-full px-2.5 py-1 font-medium">
        <TrendingUp className="w-3.5 h-3.5" /> R$ 380 a mais que mês passado
      </div>

      <div className="mt-5 space-y-3">
        {[
          { label: "Alimentação", val: "R$ 820", pct: 64, color: "#127A56" },
          { label: "Transporte", val: "R$ 310", pct: 30, color: "#E8943B" },
          { label: "Lazer", val: "R$ 240", pct: 22, color: "#1B1714" },
        ].map((c) => (
          <div key={c.label}>
            <div className="flex items-center justify-between text-[12.5px] mb-1">
              <span className="text-[#3A352F] font-medium">{c.label}</span>
              <span className="text-[#6B6259]">{c.val}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F1EBE1] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* card flutuante: meta */}
    <div className="hidden sm:block absolute -bottom-7 -left-6 rounded-2xl bg-white border border-[#E9E1D6] shadow-[0_20px_40px_-20px_rgba(27,23,20,0.4)] p-3.5 w-[210px]">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-[#E4F0EA] text-[#127A56] flex items-center justify-center"><PiggyBank className="w-4 h-4" /></div>
        <span className="text-[12px] font-semibold">Reserva</span>
        <span className="ml-auto text-[11px] text-[#6B6259]">64%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#F1EBE1] overflow-hidden"><div className="h-full rounded-full bg-[#127A56]" style={{ width: "64%" }} /></div>
      <div className="text-[11px] text-[#6B6259] mt-1.5">R$ 3.200 de R$ 5.000</div>
    </div>

    {/* chip flutuante: streak */}
    <div className="hidden sm:flex absolute -top-5 -right-3 items-center gap-1.5 rounded-full bg-[#1B1714] text-white px-3 py-1.5 shadow-lg">
      <Flame className="w-3.5 h-3.5 text-[#E8943B]" /> <span className="text-[12px] font-semibold">12 dias</span>
    </div>
  </div>
);

const GastosMock = () => (
  <div className="rounded-3xl bg-white border border-[#E9E1D6] shadow-[0_30px_60px_-30px_rgba(27,23,20,0.35)] p-6 md:p-7 w-full max-w-[440px]">
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B6259]">Pra onde foi</div>
        <div className="font-display text-[22px] font-semibold">Gastos de junho</div>
      </div>
      <div className="w-11 h-11 rounded-xl bg-[#E4F0EA] text-[#127A56] flex items-center justify-center"><Receipt className="w-5 h-5" /></div>
    </div>
    {[
      { label: "Assinaturas que você esqueceu", val: "R$ 137", warn: true },
      { label: "Delivery", val: "R$ 412" },
      { label: "Mercado", val: "R$ 690" },
      { label: "Parcelado no cartão", val: "R$ 540" },
    ].map((r) => (
      <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-[#F1EBE1] last:border-0">
        <span className={`text-[13.5px] ${r.warn ? "text-[#0E5E42] font-semibold" : "text-[#3A352F]"}`}>{r.label}</span>
        <span className={`text-[13.5px] font-semibold ${r.warn ? "text-[#0E5E42]" : "text-[#1B1714]"}`}>{r.val}</span>
      </div>
    ))}
    <div className="mt-4 flex items-center gap-2 text-[12.5px] text-[#6B6259]">
      <TrendingDown className="w-4 h-4 text-[#127A56]" /> O CORE achou R$ 137/mês que dava pra cortar.
    </div>
  </div>
);

/* ---------- preços ---------- */
// Preço placeholder — confirmar valores reais e plugar.
const PRICING = {
  anual: { price: "R$ 3,90", per: "/mês", note: "cobrado R$ 46,80/ano", save: "Economize 74%" },
  mensal: { price: "R$ 14,90", per: "/mês", note: "cobrado mensalmente", save: "" },
};

const Pricing = () => {
  const [plan, setPlan] = useState<"anual" | "mensal">("anual");
  const p = PRICING[plan];
  return (
    <div className="rounded-3xl bg-white border border-[#E9E1D6] shadow-[0_30px_70px_-40px_rgba(27,23,20,0.4)] p-6 md:p-8 max-w-[460px] w-full">
      <div className="flex p-1 rounded-xl bg-[#F4EEE5] mb-6">
        {(["anual", "mensal"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setPlan(k)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold capitalize transition ${plan === k ? "bg-white text-[#1B1714] shadow-sm" : "text-[#6B6259]"}`}
          >
            {k}{k === "anual" && <span className="ml-1.5 text-[10px] font-bold text-[#127A56]">-74%</span>}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="font-display text-[48px] leading-none font-semibold">{p.price}</span>
        <span className="text-[#6B6259] text-[15px] mb-1.5">{p.per}</span>
      </div>
      <div className="text-[12.5px] text-[#6B6259] mt-1">{p.note}</div>

      <Link
        to="/auth?signup=1"
        onClick={cta(plan === "anual" ? "pricing_anual" : "pricing_mensal")}
        className="mt-5 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#127A56] hover:bg-[#0E5E42] text-white font-semibold text-[15px] transition"
      >
        Começar agora <ArrowRight className="w-[18px] h-[18px]" />
      </Link>

      <div className="mt-5 space-y-2.5">
        {[
          "Todos os 16 módulos inclusos — sem upsell",
          "Finanças, rotina, metas, saúde e mais",
          "Sincroniza em todos os aparelhos",
          "Cancele em 1 clique, sem fidelidade",
        ].map((t) => (
          <div key={t} className="flex items-start gap-2.5 text-[13.5px] text-[#3A352F]">
            <Check className="w-4 h-4 text-[#127A56] mt-0.5 shrink-0" strokeWidth={3} /> {t}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#E4F0EA] px-3.5 py-3 text-[12.5px] text-[#0E5E42] font-medium">
        <ShieldCheck className="w-[18px] h-[18px] shrink-0" /> Garantia de 7 dias — não amou, devolvemos cada centavo.
      </div>
    </div>
  );
};

/* ---------- FAQ ---------- */
const FAQ = [
  { q: "Preciso ser organizado pra usar?", a: "Não. O CORE foi feito pra quem é bagunçado — é por isso que ele é rápido de lançar e te lembra. Você marca um gasto em 3 segundos e pronto." },
  { q: "E se eu não usar / não gostar?", a: "Você tem 7 dias de garantia. Se não for pra você, devolvemos cada centavo, sem pergunta. E cancela em 1 clique, sem fidelidade." },
  { q: "Meus dados financeiros estão seguros?", a: "Sim. Tudo criptografado, em trânsito e em repouso, com isolamento por usuário. Seus dados são só seus — a gente não vende nada." },
  { q: "É difícil de começar?", a: "Em 2 minutos você já vê pra onde seu dinheiro vai. E dá pra abrir a demo agora, sem cadastro, pra sentir antes de assinar." },
  { q: "É só finanças?", a: "Não. São 16 módulos numa assinatura só: rotina, metas, saúde, treino, dieta, estudos e mais. Organiza o dinheiro e, de quebra, o resto da vida." },
];

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#E9E1D6] last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-4 py-4 text-left">
        <span className="font-semibold text-[15px]">{q}</span>
        <ChevronDown className={`w-5 h-5 text-[#6B6259] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-[14px] text-[#6B6259] leading-relaxed pb-4 -mt-1 max-w-[60ch]">{a}</p>}
    </div>
  );
};

/* ---------- módulos (amplificação) ---------- */
const MODULES = [
  { icon: Wallet, label: "Finanças" }, { icon: CalendarCheck, label: "Rotina" },
  { icon: Target, label: "Metas" }, { icon: Dumbbell, label: "Treino" },
  { icon: Apple, label: "Dieta" }, { icon: Heart, label: "Saúde" },
  { icon: Brain, label: "Mente" }, { icon: GraduationCap, label: "Estudos" },
  { icon: BookOpen, label: "Biblioteca" }, { icon: HomeIcon, label: "Casa" },
  { icon: Plane, label: "Viagens" }, { icon: Sparkles, label: "Desenvolvimento" },
  { icon: Users, label: "Relações" }, { icon: PawPrint, label: "Pet" },
  { icon: Leaf, label: "Detox" }, { icon: Flame, label: "Carreira" },
];

/* ---------- página ---------- */
const SECTION = "px-5 md:px-8";
const WRAP = "max-w-[1120px] mx-auto";

export default function Landing() {
  useEffect(() => {
    trackEvent("landing_view", { source: "lp", variant: "rebuild-2026" });
  }, []);

  return (
    <div className="lpx min-h-screen antialiased">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#FAF6F0]/85 backdrop-blur-md border-b border-[#E9E1D6]">
        <div className={`${WRAP} ${SECTION} h-16 flex items-center justify-between`}>
          <div className="font-display text-[24px] font-semibold tracking-tight">core<span className="text-[#127A56]">.</span></div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link to="/auth" onClick={cta("header_login")} className="text-[14px] font-medium text-[#3A352F] px-3 py-2 hover:text-[#1B1714]">Entrar</Link>
            <Link to="/auth?signup=1" onClick={cta("header_signup")} className="text-[14px] font-semibold text-white bg-[#1B1714] hover:bg-black px-4 py-2 rounded-lg transition">Começar</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className={`${SECTION} pt-12 md:pt-20 pb-14 md:pb-24`}>
        <div className={`${WRAP} grid md:grid-cols-2 gap-12 md:gap-10 items-center`}>
          <motion.div {...reveal}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E9E1D6] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#6B6259] mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#127A56]" /> 16 módulos · 1 assinatura
            </div>
            <h1 className="font-display text-[40px] sm:text-[48px] md:text-[56px] font-semibold leading-[1.04] tracking-[-0.02em]">
              Você trabalha o mês todo — e no fim, não sobra nada.
            </h1>
            <p className="mt-5 text-[16px] md:text-[18px] text-[#544D45] leading-[1.55] max-w-[46ch]">
              O problema quase nunca é <em className="not-italic font-semibold text-[#1B1714]">quanto</em> você ganha — é que seu dinheiro está espalhado e invisível. O CORE mostra pra onde vai cada real, sem planilha chata. E ainda organiza rotina, metas e mais 13 áreas da sua vida. Num app só.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link to="/auth?signup=1" onClick={cta("hero_signup")} className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#127A56] hover:bg-[#0E5E42] text-white font-semibold text-[15px] shadow-[0_16px_34px_-14px_rgba(18,122,86,0.7)] transition">
                Começar agora <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="/preview/financas" target="_blank" rel="noopener" onClick={cta("hero_demo")} className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white border border-[#DDD4C7] hover:border-[#C8BEAD] text-[#1B1714] font-semibold text-[15px] transition">
                Ver a demo
              </a>
            </div>
            <p className="mt-4 text-[13px] text-[#6B6259]">7 dias de garantia · cancele quando quiser · sem fidelidade</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[#6B6259]">
              <span className="inline-flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#127A56]" /> Dados criptografados</span>
              <span className="inline-flex items-center gap-1.5"><WifiOff className="w-4 h-4 text-[#127A56]" /> Funciona offline</span>
              <span className="inline-flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-[#127A56]" /> Celular e desktop</span>
            </div>
          </motion.div>

          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="flex justify-center md:justify-end">
            <SaldoMock />
          </motion.div>
        </div>
      </section>

      {/* 2 — CUSTO DE CONTINUAR */}
      <section className={`${SECTION} py-16 md:py-24`}>
        <motion.div {...reveal} className={`${WRAP} text-center`}>
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6B6259] mb-3">O custo de continuar</div>
          <h2 className="font-display text-[28px] md:text-[40px] font-semibold leading-tight tracking-[-0.01em] max-w-[18ch] mx-auto">
            Não é que você gasta muito. É que você não <span className="text-[#127A56]">vê</span>.
          </h2>
          <p className="mt-4 text-[15px] md:text-[17px] text-[#544D45] leading-relaxed max-w-[60ch] mx-auto">
            A assinatura que esqueceu de cancelar. O delivery de quarta. O parcelado que some no extrato. Sozinhos parecem nada — juntos são o motivo de você nunca conseguir guardar. O que não é medido, não é controlado.
          </p>
        </motion.div>
      </section>

      {/* 3 — POR QUE VOCÊ JÁ TENTOU */}
      <section className={`${SECTION} pb-4`}>
        <motion.div {...reveal} className={`${WRAP}`}>
          <div className="text-center mb-10">
            <h2 className="font-display text-[26px] md:text-[36px] font-semibold leading-tight tracking-[-0.01em] max-w-[22ch] mx-auto">
              Planilha você abandona. App de banco só mostra o passado.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { t: "A planilha", d: "Dá trabalho demais. Você preenche por 2 semanas, esquece, e ela morre numa aba aberta.", bad: true },
              { t: "O app do banco", d: "Mostra só o que já era, espalhado em várias contas. Nunca te diz onde cortar.", bad: true },
              { t: "O CORE", d: "Rápido de lançar e gostoso de manter. Você continua usando — então você vê, e finalmente controla.", bad: false },
            ].map((c) => (
              <div key={c.t} className={`rounded-2xl p-6 border ${c.bad ? "bg-white border-[#E9E1D6]" : "bg-[#1B1714] border-[#1B1714] text-white"}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${c.bad ? "text-[#B8AE9F]" : "text-[#E8943B]"}`}>{c.bad ? "Já tentou" : "A diferença"}</div>
                <div className={`font-display text-[20px] font-semibold mb-2 ${c.bad ? "" : "text-white"}`}>{c.t}</div>
                <p className={`text-[14px] leading-relaxed ${c.bad ? "text-[#6B6259]" : "text-white/70"}`}>{c.d}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 4 — CORE EM AÇÃO */}
      <section className={`${SECTION} py-16 md:py-24`}>
        <div className={`${WRAP} grid md:grid-cols-2 gap-12 md:gap-14 items-center`}>
          <motion.div {...reveal} className="order-2 md:order-1 flex justify-center md:justify-start">
            <GastosMock />
          </motion.div>
          <motion.div {...reveal} className="order-1 md:order-2">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6B6259] mb-3">CORE em ação</div>
            <h2 className="font-display text-[28px] md:text-[40px] font-semibold leading-tight tracking-[-0.01em]">
              Veja pra onde seu dinheiro vai.<br />Em 30 segundos.
            </h2>
            <p className="mt-4 text-[15px] md:text-[17px] text-[#544D45] leading-relaxed max-w-[46ch]">
              Lança um gasto em 3 toques, vê tudo organizado por categoria e descobre exatamente onde está vazando. Sem fórmula, sem manual.
            </p>
            <a href="/preview/financas" target="_blank" rel="noopener" onClick={cta("section_demo")} className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#127A56] hover:bg-[#0E5E42] text-white font-semibold text-[15px] transition">
              Abrir a demo de Finanças <ArrowRight className="w-[18px] h-[18px]" />
            </a>
            <p className="mt-2.5 text-[12.5px] text-[#6B6259]">Sem cadastro. Com dados de exemplo.</p>
          </motion.div>
        </div>
      </section>

      {/* 5 — E NÃO É SÓ DINHEIRO */}
      <section className={`${SECTION} py-16 md:py-24 bg-white border-y border-[#E9E1D6]`}>
        <motion.div {...reveal} className={`${WRAP}`}>
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6B6259] mb-3">16 módulos, 1 assinatura</div>
            <h2 className="font-display text-[28px] md:text-[40px] font-semibold leading-tight tracking-[-0.01em] max-w-[20ch] mx-auto">
              Organizou o dinheiro? Agora organize o resto da vida.
            </h2>
            <p className="mt-4 text-[15px] md:text-[17px] text-[#544D45] leading-relaxed max-w-[56ch] mx-auto">
              Rotina, hábitos, metas, treino, dieta, estudos… tudo conversando, num lugar só — em vez de 10 apps que você esquece.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MODULES.map((m) => (
              <div key={m.label} className="flex items-center gap-2.5 rounded-xl bg-[#FAF6F0] border border-[#E9E1D6] px-3.5 py-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#E9E1D6] text-[#127A56] flex items-center justify-center shrink-0">
                  <m.icon className="w-4 h-4" strokeWidth={2.2} />
                </div>
                <span className="text-[13px] font-medium">{m.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 6 — POR QUE CONFIAR */}
      <section className={`${SECTION} py-16 md:py-24`}>
        <motion.div {...reveal} className={`${WRAP}`}>
          <div className="text-center mb-10">
            <h2 className="font-display text-[26px] md:text-[36px] font-semibold leading-tight tracking-[-0.01em]">Feito pra você confiar — e ficar.</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {[
              { Icon: Lock, t: "Seus dados são só seus", d: "Criptografia em trânsito e em repouso, isolados por usuário." },
              { Icon: WifiOff, t: "Funciona offline", d: "Sem internet? Continua usando. Sincroniza quando voltar." },
              { Icon: Smartphone, t: "Em qualquer tela", d: "Celular, tablet e desktop — a mesma conta, sincronizada." },
              { Icon: Sparkles, t: "16 módulos inclusos", d: "Um preço, tudo liberado. Sem recurso bloqueado, sem upsell." },
              { Icon: Check, t: "Cancela em 1 clique", d: "Sem ligação, sem ginástica, sem fidelidade." },
              { Icon: ShieldCheck, t: "Garantia de 7 dias", d: "Não curtiu? Devolvemos cada centavo." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl bg-white border border-[#E9E1D6] p-5">
                <div className="w-10 h-10 rounded-xl bg-[#E4F0EA] text-[#127A56] flex items-center justify-center mb-3"><b.Icon className="w-5 h-5" /></div>
                <div className="font-semibold text-[14.5px] mb-1">{b.t}</div>
                <div className="text-[12.5px] text-[#6B6259] leading-snug">{b.d}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 7 — PREÇOS */}
      <section id="precos" className={`${SECTION} py-16 md:py-24 bg-white border-y border-[#E9E1D6]`}>
        <div className={`${WRAP} grid md:grid-cols-2 gap-10 md:gap-14 items-center`}>
          <motion.div {...reveal}>
            <h2 className="font-display text-[30px] md:text-[44px] font-semibold leading-[1.05] tracking-[-0.02em]">Um app no lugar de dez.<br />Por menos que um café.</h2>
            <p className="mt-4 text-[15px] md:text-[17px] text-[#544D45] leading-relaxed max-w-[42ch]">
              Pense no que a desorganização te custa todo mês em juros, multas e assinaturas esquecidas. O CORE se paga — e ainda organiza o resto da sua vida.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#E4F0EA] text-[#0E5E42] px-3.5 py-1.5 text-[12.5px] font-semibold">
              <ShieldCheck className="w-4 h-4" /> 7 dias de garantia, sem risco
            </div>
          </motion.div>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.08 }} className="flex justify-center md:justify-end">
            <Pricing />
          </motion.div>
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className={`${SECTION} py-16 md:py-24`}>
        <motion.div {...reveal} className="max-w-[760px] mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-[26px] md:text-[36px] font-semibold leading-tight">Ainda tem dúvida?</h2>
          </div>
          <div className="rounded-2xl bg-white border border-[#E9E1D6] px-5 md:px-7">
            {FAQ.map((f) => <FaqItem key={f.q} {...f} />)}
          </div>
        </motion.div>
      </section>

      {/* 9 — CTA FINAL */}
      <section className={`${SECTION} pb-16 md:pb-24`}>
        <motion.div {...reveal} className={`${WRAP}`}>
          <div className="rounded-3xl bg-[#1B1714] text-white p-8 md:p-12 text-center">
            <h2 className="font-display text-[28px] md:text-[42px] font-semibold leading-tight tracking-[-0.01em] max-w-[20ch] mx-auto">
              Comece hoje. Se não for pra você, devolvemos em 7 dias.
            </h2>
            <p className="mt-4 text-[14px] md:text-[16px] text-white/65">Sem fidelidade. Cancele quando quiser.</p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth?signup=1" onClick={cta("final_signup")} className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#E8943B] hover:brightness-105 text-[#1B1714] font-bold text-[15px] transition">
                Começar agora <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="/preview/financas" target="_blank" rel="noopener" onClick={cta("final_demo")} className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold text-[15px] transition">
                Ver a demo
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className={`${SECTION} pb-12`}>
        <div className={`${WRAP} flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-[#E9E1D6]`}>
          <div className="font-display text-[18px] font-semibold">core<span className="text-[#127A56]">.</span></div>
          <div className="text-[12px] text-[#6B6259]">© {new Date().getFullYear()} CORE — Organize sua vida, começando pelo dinheiro.</div>
        </div>
      </footer>
    </div>
  );
}
