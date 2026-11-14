/**
 * O PAYWALL DO APP NA WEB (14/11, /funil-app, chave FUNIL_APP_WEB) — a MESMA tela do paywall do Android 138 (PaywallW com as
 * duas colunas: mensal 34,90 × "Pra sempre" 97,90, vitalício marcado), cobrando na web: o botão abre a FolhaPagamentoWeb
 * POR CIMA desta tela (e-mail + Pix | Cartão, tudo pela Stripe). Depois de pago, PosCompraWeb (senha → lojas).
 *
 * Arquivo separado de propósito: o PaywallW do app (Android/iPhone) não é tocado — mexer aqui não alcança a loja.
 * Copy do estudo de 14/11 (seção 3): curta; garantia de 7 dias escrita; sem upsell, sem order bump, sem CPF.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { type AreaKey } from "@/lib/funnel";
import { ehPerfilSimples } from "@/pages/funis/w/retomada";
import { JORNADA_APP_WEB, PRECO_MENSAL_CENTAVOS, PRECO_VITALICIO_CENTAVOS, PARCELAS_MAX, reaisDe } from "@/lib/funil-app-web";
import { lerPedido, pedidoPendente, type Plano } from "@/lib/stripe-app-web";
import {
  TransformChart, ValueStack, ModulesIncludedCard, AnchorCard, AreaAnchorCard,
  MuralDepoimentos, CompareTable, CHART_LABEL,
} from "@/pages/funis/dia14/PaywallDia14";
import { FolhaPagamentoWeb } from "./FolhaPagamentoWeb";
import { PosCompraWeb } from "./PosCompraWeb";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay: Math.min(i * 0.05, 0.3) },
});
const F = { funil: JORNADA_APP_WEB };
/** 97,90 ÷ 34,90 = 2,8 → "3 meses de mensal = CORE pra sempre" (a mesma conta do Android 138) */
const MESES_DE_MENSAL = Math.ceil(PRECO_VITALICIO_CENTAVOS / PRECO_MENSAL_CENTAVOS);
const semRS = (c: number) => reaisDe(c).replace("R$ ", "");

/** as duas colunas do Android 138, com os preços da web */
export function ColunasDePreco({ plano, onSelect }: { plano: Plano; onSelect: (p: Plano) => void }) {
  const moldura = (ativo: boolean) =>
    `rounded-3xl p-[2px] transition-all ${ativo
      ? "bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_40px_-16px_hsl(var(--accent)/0.5)]"
      : "bg-black/10"}`;
  return (
    <div className="grid grid-cols-2 gap-2.5 items-stretch" role="radiogroup" aria-label="Plano">
      <div onClick={() => onSelect("mensal")} role="radio" aria-checked={plano === "mensal"} data-testid="appweb-coluna-mensal" className={moldura(plano === "mensal")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-2.5 pb-3.5 text-center text-[#16121c] flex flex-col">
          <span className="h-[19px]" aria-hidden />
          <span className="text-[30px] font-black leading-none mt-1.5">1</span>
          <span className="text-[12.5px] font-bold text-black/45">mês</span>
          <span className="text-[17px] font-extrabold mt-2">{reaisDe(PRECO_MENSAL_CENTAVOS)}</span>
          <span className="text-[10px] font-semibold text-black/40">por mês</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">cancele quando quiser</span>
        </div>
      </div>
      <div onClick={() => onSelect("vitalicio")} role="radio" aria-checked={plano === "vitalicio"} data-testid="appweb-coluna-vitalicio" className={moldura(plano === "vitalicio")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-0 pb-3.5 text-center text-[#16121c] flex flex-col overflow-hidden">
          <span className={`-mx-3 text-[10px] font-extrabold tracking-[0.08em] py-[5px] ${plano === "vitalicio" ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
            MELHOR ESCOLHA
          </span>
          <span className="text-[21px] font-black leading-[1.05] mt-1.5 px-1 tracking-tight">Pra sempre</span>
          <span className="text-[17px] font-extrabold mt-1.5">{reaisDe(PRECO_VITALICIO_CENTAVOS)}</span>
          <span className="text-[10px] font-semibold text-black/40">vitalício · uma única vez</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            {MESES_DE_MENSAL} meses de mensal =<br /><b className="text-black/60">CORE pra sempre</b>
          </span>
        </div>
      </div>
    </div>
  );
}

const CHIPS = [
  { emoji: "📱", label: "iPhone, Android e computador" },
  { emoji: "💳", label: "Pix ou cartão" },
  { emoji: "🛡️", label: "Garantia de 7 dias" },
];

/** a volta do banco (3DS com redirecionamento) traz ?payment_intent=…&redirect_status=… */
function voltaDoBanco(): { pi: string; status: string } | null {
  try {
    const p = new URLSearchParams(window.location.search);
    const pi = p.get("payment_intent"), st = p.get("redirect_status");
    if (!pi || !/^pi_/.test(pi)) return null;
    const limpa = new URL(window.location.href);
    for (const k of ["payment_intent", "payment_intent_client_secret", "redirect_status"]) limpa.searchParams.delete(k);
    window.history.replaceState(window.history.state, "", limpa.toString());
    return { pi, status: st ?? "" };
  } catch { return null; }
}

export function PaywallWebStripe({ area, answers }: { area: AreaKey; answers: Record<string, string> }) {
  const pendenteNoMount = useRef(lerPedido());
  const [plano, setPlano] = useState<Plano>(() => pendenteNoMount.current && pedidoPendente(pendenteNoMount.current) ? pendenteNoMount.current.plano : "vitalicio");
  const [banco] = useState(voltaDoBanco);
  /* reabriu com Pix vivo / volta do banco → a folha já abre; pago sem senha → o pós-compra */
  const [folha, setFolha] = useState<boolean>(() => !!banco || pendenteNoMount.current?.fase === "pix");
  const [pago, setPago] = useState<boolean>(() => pendenteNoMount.current?.fase === "pago" && !pendenteNoMount.current.senhaCriada);
  const simples = ehPerfilSimples(answers);
  const tocouPlano = useRef(false);

  useEffect(() => {
    // o funnel_view "offer" de sempre (a régua abre→paywall do W continua comparável) + o da jornada
    trackEvent("funnel_view", { step: "offer", funil: "w", area, perfil: simples ? "simples" : "topo", cobranca: "stripe" });
    trackEvent("appweb_paywall_visto", { ...F, area, plano: plano, retomada: !!pendenteNoMount.current && pedidoPendente(pendenteNoMount.current) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pago) return <PosCompraWeb />;

  const vitoria: Record<AreaKey, string> = {
    dinheiro: "ver pra onde seu dinheiro vai",
    rotina: "organizar sua rotina",
    corpo: "cuidar do seu corpo com constância",
    saude: "cuidar da sua saúde todo dia",
    metas: "tirar suas metas do papel",
  };
  const mensal = plano === "mensal";

  return (
    <div className="relative w-full max-w-sm mx-auto text-center pb-44 pt-8" data-testid="appweb-paywall">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-4 shadow-[0_8px_28px_-6px_hsl(var(--accent)/0.55)]"
      >
        <Check className="w-7 h-7" strokeWidth={3} />
      </motion.div>
      <h1 className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        Seu plano pra<br /><span className="text-accent">{vitoria[area]}</span><br />está pronto
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-3">
        {simples
          ? "Do jeito simples: 5 minutos por dia, e o CORE cuida do resto."
          : "Você já viu como funciona. Agora é com os seus números de verdade."}
      </p>
      <p className="text-[12.5px] text-muted-foreground leading-snug mb-5 flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</span>
        <span>“Tudo que eu sempre quis num planner. Vale cada centavo.”</span>
        <span className="font-semibold text-foreground/70">Elisa D. · Google Play</span>
      </p>

      <div className="space-y-4">
        <motion.div {...stagger(0)}>
          {(() => {
            const preco = mensal ? semRS(PRECO_MENSAL_CENTAVOS) : semRS(PRECO_VITALICIO_CENTAVOS);
            const precoSub = mensal ? "por mês" : "1x, pra sempre";
            const precoTitulo = mensal ? <>CORE mensal,<br />pra começar hoje</> : undefined;
            return area === "dinheiro"
              ? <AnchorCard gasto={answers?.gasto ?? ""} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} />
              : <AreaAnchorCard area={area as Exclude<AreaKey, "dinheiro">} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} />;
          })()}
        </motion.div>
        <motion.div {...stagger(1)}>
          <ColunasDePreco
            plano={plano}
            onSelect={(p) => { setPlano(p); tocouPlano.current = true; trackEvent("appweb_plano", { ...F, plano: p }); }}
          />
        </motion.div>
        <motion.div {...stagger(2)}><TransformChart label={CHART_LABEL[area] ?? CHART_LABEL.dinheiro} /></motion.div>
        {!simples && <ValueStack area={area} />}
        <motion.div {...stagger(3)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>
        <MuralDepoimentos area={area} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px] text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">+1000</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">aprovaram o CORE</div>
          </div>
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px]" aria-hidden>⚡</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">Na hora</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">acesso liberado</div>
          </div>
        </div>
        <motion.div {...stagger(4)}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {CHIPS.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11.5px] font-semibold">
                <span>{c.emoji}</span> {c.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* CTA fixo (o mesmo lugar do app) */}
      <div className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent pt-8" style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-sm mx-auto px-5">
          <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Button
              size="lg"
              data-testid="appweb-cta"
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
              onClick={() => {
                trackEvent("funnel_click", { cta: "app_paywall_cta", produto: mensal ? "appweb_mensal" : "appweb_vitalicio", funil: "w", cobranca: "stripe" });
                setFolha(true);
              }}
            >
              Liberar meu CORE
            </Button>
          </motion.div>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span data-testid="appweb-legal">
              {mensal
                ? <>{reaisDe(PRECO_MENSAL_CENTAVOS)} por mês no cartão · cancele quando quiser · garantia de 7 dias</>
                : <>Pagamento <strong className="text-foreground font-semibold">único</strong> · Pix ou cartão em até {PARCELAS_MAX}x · garantia de 7 dias</>}
            </span>
          </p>
          <p className="text-[10.5px] text-muted-foreground/80 text-center mt-0.5">No iPhone, no Android e no computador.</p>
        </div>
      </div>

      {folha && (
        <FolhaPagamentoWeb
          plano={plano}
          onPlano={(p) => { setPlano(p); trackEvent("appweb_plano", { ...F, plano: p, onde: "folha" }); }}
          voltaDoBanco={banco}
          onFechar={() => setFolha(false)}
          onPago={() => { setFolha(false); setPago(true); window.scrollTo(0, 0); }}
        />
      )}
    </div>
  );
}
