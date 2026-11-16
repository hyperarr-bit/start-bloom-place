/**
 * PAYWALL DO FUNIL W (29/08, desenho do dono): o LAYOUT do paywall da web que
 * dava ROI (PaywallDia14, braço B vencedor: reveal → âncora → transformação →
 * pilha de valor → preço → mural de depoimentos → laurels → confiança) com o
 * MOTOR do app que já provou dinheiro (RevenueCat: folha do Google, pendente
 * com "Já paguei", resgate Pix com reabertura automática).
 *
 * Diferenças deliberadas vs a web (cada uma com motivo):
 *  - R$ 97,90 VITALÍCIO via Google (core_vitalicio_97), não 27,90 Cakto;
 *  - SEM X e SEM roleta/downsell: no app a saída é a escada de resgate
 *    (1ª recusa → reabre a folha sozinha; a caixa oferece o mensal como
 *    saída dupla — o análogo provado do downsell da web);
 *  - SEM "garantia de 7 dias": era promessa própria da web (reembolso manual
 *    Cakto). No Google o reembolso é da Play — prometer garantia nossa aqui
 *    viraria dívida de suporte. No lugar: "pagamento único pelo Google Play";
 *  - SEM âncora de preço riscado (a web riscava o anchor do catálogo dela);
 *    a âncora honesta do app é "4 meses de mensal = seu pra sempre".
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { APP_PRECOS } from "@/lib/native-shell";
import { ehApple, pelaLoja, temEscadaPix, formasDePagamento, erroFolhaNaoConcluiu, avisoRenovacao, erroJaAtivo, erroNaoPermitido } from "@/lib/loja";
import { PresenteDireto, economiaDoAnual, ECONOMIA_RESERVA, ANUAL_MES_RESERVA } from "@/components/paywall/PaywallSemTeste";
import { ID_MENSAL_ANDROID, PRECOS_RESERVA_SEM_TESTE, PRODUTOS_SEM_TESTE, anotarOfertaDaFolha, type PlanoSemTeste } from "@/lib/paywall-teste";
import { usePaywallOferta } from "@/hooks/use-paywall-teste";
import type { DadosSemTeste } from "@/lib/revenuecat";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";
import { PixCheckout } from "@/components/paywall/PixCheckout";
import { EntradaDeCodigo } from "@/components/paywall/EntradaDeCodigo";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { CHAVES_FUNIL_W, guardarChave, lerChave, ehPerfilSimples } from "@/pages/funis/w/retomada";
import {
  TransformChart, ValueStack, ModulesIncludedCard, AnchorCard, AreaAnchorCard,
  MuralDepoimentos, TrustChips, CompareTable, CHART_LABEL,
} from "@/pages/funis/dia14/PaywallDia14";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay: Math.min(i * 0.05, 0.3) },
});

/* A/B DO PREÇO (31/08, teste do dono): braço A = vitrine de UM preço só
 * (o desenho da web que dava ROI); braço B = vitalício herói + mensal
 * VISÍVEL logo abaixo, ambos selecionáveis. Sorteio 50/50 estável por
 * aparelho (localStorage) — a pessoa vê SEMPRE o mesmo braço, mesmo
 * recarregando. Forçar no QA: localStorage core-w-braco = "a" | "b". */
export type BracoW = "a" | "b";
const BRACO_KEY = "core-w-braco";

/* A/B DESLIGADO — a vitrine do Android virou DECISÃO, não sorteio (31/08).
 * Ligar de volta = true (sorteio, eventos com `braco` e QA por localStorage
 * seguem prontos e testados). */
const AB_LIGADO = false;

/* VITRINE DO ANDROID (31/08, ordem do dono): os DOIS preços, com o MENSAL em
 * foco. É o oposto do que o dado de tíquete sozinho pediria — o vitalício
 * puro levou o tíquete de R$ 47 pra R$ 93 — e mesmo assim faz sentido no
 * conjunto, porque agora existem DUAS lojas com físicas diferentes:
 *
 *   · PLAY: cobra 15% e segura o caixa 60 dias. Aqui o pagamento único não
 *     compensa a espera — mensalidade que renova sozinha rende mais no mesmo
 *     dinheiro preso, e o preço baixo derruba a barreira de entrada.
 *   · WEB (/inicio): Pix cai em 1 dia com ~7%. Ali mora o vitalício de 97,90,
 *     que é caixa imediato.
 *
 * Ou seja: o produto barato e recorrente onde a taxa e a espera são
 * inevitáveis; o tíquete alto à vista onde o dinheiro entra na hora.
 *
 * O vitalício CONTINUA na tela, na coluna ao lado — quem quer pagar uma vez
 * paga. O que muda é qual nasce selecionado. */
const ANDROID_DUAS_COLUNAS = true;

/* PREÇO DA WEB — 01/09: sobe de 27,90 pra 97,90, por medição da 1ª noite.
 * O Pix fechou 33% dos QRs maduros contra 13% da folha do Google (2,5×), e
 * mesmo assim o ROI da web ficou em 0,55×: a R$ 27,90 esse funil não paga o
 * anúncio nem no melhor cenário. Entram R$ 2,60 por pessoa que vê o paywall;
 * a 97,90, mesmo se o fechamento cair pela METADE, entram R$ 4,45.
 * A oferta w97 tem que existir nos TRÊS lugares (asaas-pix, asaas-webhook e
 * PIX_PRICES) — o webhook rebaixa oferta desconhecida pra `lifetime` e grava
 * 27,90 numa venda de 97,90.
 * A VITRINE da web é de UM PREÇO SÓ — o desenho do app quando era só o
 * vitalício, que fechou 1,10× em 30/08. Duas colunas aqui seria misturar dois
 * testes numa tela só. */
/* 06/09 (ordem do dono): "bota 24,90 mensal e 47,90 vitalício na web". O
 * vitalício da web cai de 97,90 pra 47,90 — oferta nova `w47` nas functions
 * (asaas-pix, asaas-webhook, pix-reconcile) e no rastreio. O app continua
 * em 97,90 (APP_PRECOS). */
/* 07/09 10h40 (ordem do dono): de volta a 97,90 (w97) — o 47,90 (w47) rodou
 * de 06/09 18h35 a 07/09 10h20. As chaves w47/w27 continuam existindo nas
 * functions pra QR antigo. */
/* 16/09 22h (ordem do dono, depois da autópsia da fack de 08/08): DE VOLTA A
 * 27,90 (w27), UMA coluna. O que a conta mostrou: a 27,90 compravam 6,7% dos
 * visitantes (35 de 523 em 08/08); a 97,90/24,90, 2%. Receita por visitante
 * empatou (R$ 1,84 × R$ 1,70) — a diferença de ROI era o CPC. O dono
 * escolheu 3× mais clientes pelo mesmo dinheiro. O app segue em 97,90.
 * Rollback = PRECO_WEB "97,90" + OFERTA_WEB "w97" + WEB_DUAS_COLUNAS true. */
const PRECO_WEB = "27,90";
const OFERTA_WEB: "w27" = "w27";
/* 2ª COLUNA NA WEB — 1 mês por R$ 24,90 (03/09).
 *
 * Por que: o app rodou os dois arranjos com dinheiro em cima e a régua limpa
 * (receita por paywall VISTO, que não depende de gasto nem de campanha) deu
 *   só o vitalício ............... R$ 3,68  (4,7% de quem vê o paywall compra)
 *   duas colunas, MENSAL em foco . R$ 5,39
 *   duas colunas, VITALÍCIO foco . R$ 7,35  (12% compra)
 * O mensal não roubou do vitalício: dobrou o número de compradores. E o
 * número não está inflado por renovação — nenhum mensal do app renovou ainda
 * (o 1º vencimento é fim de setembro), então esses R$ 7,35 já contam o mensal
 * como pagamento único, que é exatamente o que ele é na web.
 *
 * A ORDEM não é gosto: com o mensal em foco a mesma tela cai pra R$ 5,39. O
 * vitalício nasce selecionado, sempre.
 *
 * REGRA DE CORTE combinada com o dono: depois de 200 paywalls vistos na web,
 * se a receita por paywall estiver abaixo dos R$ 6,53 de 03/09 (uma coluna),
 * volta pra false. É esta linha.
 *
 * Na web o Pix não tem débito automático, então isto é PRÉ-PAGO: 30 dias, sem
 * renovar sozinho. Toda copy desta tela e do checkout diz isso. */
const WEB_DUAS_COLUNAS = false; // 16/09: com vitalício a 27,90, mensal de 24,90 não faz sentido
const OFERTA_WEB_MES: "w25" = "w25";
/* QUEM NASCE SELECIONADO NO ANDROID — vira "vitalicio" em 01/09.
 *
 * Este é o 3º e último arranjo da vitrine. Os dois anteriores já rodaram com
 * dinheiro em cima:
 *   1. só o vitalício (até 31/08 21h)     — mensal só como resgate pós-recusa
 *   2. duas colunas, MENSAL em foco       — 31/08 21h até agora
 *   3. duas colunas, VITALÍCIO em foco    — este
 *
 * O que o arranjo 2 mediu em 01/09, até ~09:45 (janela BRT):
 *   campanha do app gastou R$ 397,22 (R$ 452,83 com o imposto de 14% da Meta)
 *   8 vendas: SETE de 24,90 + UMA de 97,90 = R$ 272,20 bruto, R$ 231,37 líquido
 *   ROI 0,51×
 * Os MESMOS 8 compradores no vitalício dariam R$ 783,20 bruto / R$ 665,72
 * líquido = ROI 1,47×. Sem convencer uma pessoa a mais. O tíquete, e não a
 * conversão, é o que está faltando.
 *
 * E o mensal REALMENTE converte melhor: a folha do Google fechou 30% (6 de 20)
 * contra os ~13% históricos do vitalício. Só que 30% não é o bastante — pra
 * empatar com um tíquete 3,9× maior, ele precisaria fechar ~4× melhor, não 2×.
 *
 * O vitalício continua ao lado e quem quiser mensalidade escolhe em um toque:
 * a hipótese que sobrevive dos dois arranjos anteriores é que a coluna barata
 * ancora o preço e resgata quem recusa, mas não deve ser o padrão de todo mundo.
 *
 * CUIDADO AO MEXER: `vitrine-android.test.tsx` trava esta escolha de propósito.
 * Se você trocou esta linha, o teste quebra — e é pra quebrar. */
const ANDROID_PLANO_INICIAL: "vitalicio" | "mensal" = "vitalicio";

/**
 * iOS: SEM A/B, e os DOIS preços sempre (spec do dono, 30/08).
 *
 * Motivo de não testar: o iPhone nasce sem campanha (não há SDK da Meta nem
 * ATT), então o volume de lançamento não sustenta um A/B — dividir ao meio um
 * fluxo pequeno só produz dois resultados sem significância e congela um
 * palpite por meses. Com as duas colunas, cada tipo de comprador acha a dele
 * sem precisar de teste.
 *
 * Por que os dois preços, se no Android o vitalício sozinho ganhou: aquele
 * dado veio de público Pix-first e sensível a preço. Na App Store não existe
 * Pix, então some o atrito que empurrava pro pagamento único — assinar lá é
 * um Face ID. A física da decisão é outra.
 *
 * QUAL NASCE SELECIONADO fica nesta constante de uma linha de propósito: o
 * A/B do Android responde isso nesta semana, e a troca tem que ser de uma
 * linha, não de tela.
 */
const IOS_PLANO_INICIAL: "vitalicio" | "mensal" = "vitalicio";
const sortearBraco = (): BracoW => {
  if (!AB_LIGADO) return "a";
  try {
    const j = localStorage.getItem(BRACO_KEY);
    if (j === "a" || j === "b") return j;
    const b: BracoW = Math.random() < 0.5 ? "a" : "b";
    localStorage.setItem(BRACO_KEY, b);
    return b;
  } catch { return "a"; }
};

/** Preço vitalício do app no formato que o LifetimeCard da web tinha.
 *  Só no braço A — o braço B usa as duas colunas de peso igual. */
function LifetimeCardW({ naWeb = false }: { naWeb?: boolean }) {
  const preco = naWeb ? PRECO_WEB : APP_PRECOS.vitalicio97.preco;
  return (
    <div className="relative w-full rounded-3xl p-[2px] bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_44px_-14px_hsl(var(--accent)/0.55)]">
      <div className="relative rounded-[calc(1.5rem-2px)] bg-white px-4 pt-5 pb-4 overflow-hidden text-center text-[#16121c]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 w-60 h-28 rounded-full"
          style={{ background: "hsl(var(--accent) / 0.14)", filter: "blur(28px)" }}
        />
        <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-widest mb-3">
          ACESSO VITALÍCIO
        </span>
        <div className="relative font-bold text-[15px] leading-tight mb-2">Pague 1x. Seu pra sempre.</div>
        <div className="relative text-[42px] leading-none font-extrabold tracking-tight text-accent">
          {preco}
        </div>
        <div className="relative text-[12px] font-semibold text-black/50 mt-1.5">
          {ehApple() ? "pela App Store" /* 20/09: no iPhone o plano longo é assinatura; este cartão é do Android */
            : naWeb ? "pagamento único · Pix, acesso na hora"
            : "pagamento único · Pix ou cartão na tela do Google"}
        </div>
        <div className="relative text-[11px] font-semibold text-black/40 mt-1">
          {naWeb ? "= R$ 8,16/mês no 1º ano, R$ 0 depois" : `${ehApple() ? 4 : MESES_MENSAL_34} meses de mensal = CORE pra sempre`}
        </div>
        <div className="relative grid grid-cols-3 gap-1.5 mt-3.5">
          {["16 módulos", "Sem mensalidade", "Acesso na hora"].map((c) => (
            <span key={c} className="rounded-full bg-secondary px-1 py-1.5 text-[10px] font-bold leading-tight">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Braço B (30/08, decisão do dono: "os dois no mesmo foco"): duas colunas
 *  de PESO IGUAL — mesma largura, mesma altura, preço no mesmo corpo. Quem
 *  faz o trabalho de venda não é a hierarquia visual, é a CONTA: 12 meses de
 *  mensal custam R$ 298,80 contra R$ 97,90 uma vez (= R$ 8,16/mês no 1º ano,
 *  zero depois). É a lição do sábado — quando as colunas antigas só diziam
 *  "24,90" × "97,90" sem a matemática, o barato levava 92% do mix. */
/** 12/11 noite (iPhone, paywall sem teste): as MESMAS colunas com o anual no lugar do vitalício. */
/** 12/11 (dono, A/B `paywall_oferta`): `grande` = o plano da coluna grande — "anual" (1 ano, 97,90/ano) ou "vitalicio"
 *  (o MESMO cartão do Android: "Pra sempre", 97,90, vitalício · uma única vez, "N meses de mensal = CORE pra sempre"). */
type SemTesteColunas = { anual: string; anualMes: string; mensal: string; economia: number; grande: "anual" | "vitalicio"; vitalicio: string; mesesDeMensal: number };
/** 12/11 (dono): o mensal com renovação do Android é o core_mensal_34 (R$ 34,90). 97,90 ÷ 34,90 = 2,8 → "3 meses de mensal". */
const MESES_MENSAL_34 = Math.ceil(97.9 / PRECOS_RESERVA_SEM_TESTE.mensal.valor);
function PrecosLadoALadoW({ plano, onSelect, naWeb = false, semTeste = null, mensalApp = null }: { plano: "vitalicio" | "mensal"; onSelect: (p: "vitalicio" | "mensal") => void; naWeb?: boolean; semTeste?: SemTesteColunas | null; /** Android: o preço do mensal de 34,90 (da loja) */ mensalApp?: string | null }) {
  const moldura = (ativo: boolean) =>
    `rounded-3xl p-[2px] transition-all ${ativo
      ? "bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_40px_-16px_hsl(var(--accent)/0.5)]"
      : "bg-black/10"}`;
  const anualSemTeste = semTeste?.grande === "anual" ? semTeste : null;
  return (
    <div className="grid grid-cols-2 gap-2.5 items-stretch">
      <div onClick={() => onSelect("mensal")} role="button" className={moldura(plano === "mensal")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-2.5 pb-3.5 text-center text-[#16121c] flex flex-col">
          <span className="h-[19px]" aria-hidden />
          <span className="text-[30px] font-black leading-none mt-1.5">1</span>
          <span className="text-[12.5px] font-bold text-black/45">mês</span>
          <span className="text-[17px] font-extrabold mt-2">{semTeste ? semTeste.mensal : mensalApp ?? APP_PRECOS.mensal.preco}</span>
          <span className="text-[10px] font-semibold text-black/40">{naWeb ? "30 dias" : "por mês"}</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            {/* 03/09 (ordem do dono): o card da web fica com a MESMA cara do
                app — sem a frase defensiva "não renova sozinho", que pesava na
                coluna barata. A duração continua na tela em dois lugares (o
                "30 dias" acima e o legal do CTA), porque na web o Pix não tem
                débito automático: prometer "cancele quando quiser" aqui seria
                vender assinatura que não existe, e a conta volta como
                reembolso 30 dias depois. */}
            {naWeb ? "acesso na hora" : "cancele quando quiser"}
          </span>
        </div>
      </div>

      <div onClick={() => onSelect("vitalicio")} role="button" className={moldura(plano === "vitalicio")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-0 pb-3.5 text-center text-[#16121c] flex flex-col overflow-hidden">
          <span className={`-mx-3 text-[10px] font-extrabold tracking-[0.08em] py-[5px] ${plano === "vitalicio" ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
            MELHOR ESCOLHA
          </span>
          <span className="text-[21px] font-black leading-[1.05] mt-1.5 px-1 tracking-tight">{anualSemTeste ? "1 ano" : "Pra sempre"}</span>
          {/* 06/09: a web vende o vitalício a PRECO_WEB (47,90); o app segue no
              preço da loja. A âncora "N meses de mensal" acompanha: 47,90 ÷ 24,90 ≈ 2. */}
          <span className="text-[17px] font-extrabold mt-1.5">{anualSemTeste ? semTeste.anual : semTeste ? semTeste.vitalicio : naWeb ? `R$ ${PRECO_WEB}` : APP_PRECOS.vitalicio97.preco}</span>
          <span className="text-[10px] font-semibold text-black/40">{anualSemTeste ? `por ano · ${semTeste.anualMes}/mês` : "vitalício · uma única vez"}</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            {anualSemTeste
              ? <>Economize {semTeste.economia}%<br /><b className="text-black/60">contra o mensal</b></>
              : <>{semTeste ? semTeste.mesesDeMensal : mensalApp ? MESES_MENSAL_34 : 4} meses de mensal =<br /><b className="text-black/60">CORE pra sempre</b></>}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PaywallW({
  area, answers, onPagoSemConta, naWeb = false, semTeste = false, onVoltar, modo = "funil",
}: { area: AreaKey; answers: Record<string, string>; onPagoSemConta: () => void;
  /* 12/11 (dono): no iPhone sem teste, o gate (conta logada sem acesso) e o "Ver planos" (/planos) também usam este
   * desenho. Sem funil antes: título neutro (o do gate do Android), sem a avaliação/ValueStack do funil; o gate não
   * tem Voltar (bloqueia o app) e ganha "Entrar com outra conta · Excluir conta"; o /planos fecha no Voltar. */
  modo?: "funil" | "gate" | "planos";
  /* 12/11 noite (dono, SÓ iPhone, braço "android" do A/B `paywall_visual`): o MESMO desenho vendendo o paywall sem
   * teste — anual 97,90 (core_anual_97_direto) no lugar do vitalício, mensal 34,90, nada de "pra sempre"/"único", e
   * na saída (Voltar redondo ou folha cancelada) o presente 69,90/ano sem teste no lugar da escada de resgate. */
  semTeste?: boolean;
  /** semTeste: o recuo do funil quando o Voltar redondo não abriu o presente */
  onVoltar?: () => void;
  /* 31/08 — o MESMO paywall com outro cano de pagamento. Na web o dinheiro
   * sai por Pix (oferta w97 da Cakto): a folha do Google paga 13-27% (medido
   * 27-31/08), cobra 15% e segura o caixa 60 dias; o Pix histórico paga ~45%,
   * cobra ~7% e cai em 1 dia. Tela idêntica de propósito — a comparação entre
   * app e web só vale se a única variável for a forma de pagar. */
  naWeb?: boolean }) {
  const [comprando, setComprando] = useState(false);
  /** Overlay do Pix (só na web) — cobre o paywall inteiro, como no /inicio. */
  const [pixAberto, setPixAberto] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resgatePix, setResgatePix] = useState(false);
  const [reabrindoEm, setReabrindoEm] = useState<number | null>(null);
  const [pixVencendo, setPixVencendo] = useState(false);
  /* SAÍDA DO PAYWALL (16/09, item 3 do funil da web): 72% de quem vê o
   * paywall não toca em pagar e eu não sabia se saía no topo ou lá embaixo.
   * Na saída (aba escondida, fechada, ou tela trocada) sai UM evento com
   * quanto tempo ficou, até onde rolou (% da página) e se tocou numa coluna
   * de preço. Só na web; no app o comportamento de folha é outro. */
  const paywallEntrou = useRef(Date.now());
  const rolouMax = useRef(0);
  const tocouPlano = useRef(false);
  const saidaEnviada = useRef(false);
  useEffect(() => {
    if (!naWeb) return;
    const medirRolagem = () => {
      const alt = document.documentElement.scrollHeight - window.innerHeight;
      const pct = alt > 0 ? Math.min(100, Math.round((window.scrollY / alt) * 100)) : 100;
      if (pct > rolouMax.current) rolouMax.current = pct;
    };
    const registrarSaida = (motivo: string) => {
      if (saidaEnviada.current) return;
      saidaEnviada.current = true;
      trackEvent("funnel_view", { step: "w_paywall_saida", funil: "w", motivo, segundos: Math.round((Date.now() - paywallEntrou.current) / 1000), rolou_pct: rolouMax.current, tocou_plano: tocouPlano.current });
    };
    const aoEsconder = () => { if (document.visibilityState === "hidden") registrarSaida("escondeu"); };
    window.addEventListener("scroll", medirRolagem, { passive: true });
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", () => registrarSaida("fechou"));
    medirRolagem();
    return () => {
      window.removeEventListener("scroll", medirRolagem);
      document.removeEventListener("visibilitychange", aoEsconder);
      registrarSaida("trocou_tela");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pixVencendoJaFoi = useRef(false);
  const cancelamentos = useRef(0);
  const contagemRef = useRef<number | null>(null);
  const vivoRef = useRef(true);
  // Disponibilidade real: otimista até resposta NEGATIVA da loja (regra v81).
  const [vitalicioNaLoja, setVitalicioNaLoja] = useState<boolean | null>(null);
  /* semTeste: os preços da loja (o texto fixo é só reserva) e o presente de saída (1x por paywall aberto) */
  const [lojaSemTeste, setLojaSemTeste] = useState<{ anual: DadosSemTeste | null; mensal: DadosSemTeste | null; vitalicio?: DadosSemTeste | null }>({ anual: null, mensal: null, vitalicio: null });
  /* 12/11 (dono): o A/B da OFERTA, só iPhone (lib/paywall-teste `paywall_oferta`): o plano grande é o anual 97,90 ou o
   * vitalício 97,90. O braço é do aparelho (o mesmo no funil, no gate e no /planos); a chave remota vence o sorteio. */
  const oferta = usePaywallOferta(semTeste);
  const grande: PlanoSemTeste = semTeste && oferta === "vitalicio" ? "vitalicio" : "anual";
  const [presente, setPresente] = useState<DadosSemTeste | null>(null);
  const presenteTentadoRef = useRef(false);
  const presenteAbertoRef = useRef(false);
  presenteAbertoRef.current = !!presente;
  const comprandoRef = useRef(false);
  const compraFeitaRef = useRef(false);
  const anualTxt = lojaSemTeste.anual?.preco ?? PRECOS_RESERVA_SEM_TESTE.anual.preco;
  const mensalTxt = lojaSemTeste.mensal?.preco ?? PRECOS_RESERVA_SEM_TESTE.mensal.preco;
  const vitalicioTxt = lojaSemTeste.vitalicio?.preco ?? PRECOS_RESERVA_SEM_TESTE.vitalicio.preco;
  /** o preço do plano grande da vez (anual ou vitalício), sempre o priceString da loja quando ela respondeu */
  const grandeTxt = grande === "vitalicio" ? vitalicioTxt : anualTxt;
  const colunasSemTeste: SemTesteColunas | null = semTeste ? {
    anual: anualTxt,
    anualMes: lojaSemTeste.anual?.precoMes ?? ANUAL_MES_RESERVA,
    mensal: mensalTxt,
    economia: economiaDoAnual(lojaSemTeste.anual?.valor ?? PRECOS_RESERVA_SEM_TESTE.anual.valor, lojaSemTeste.mensal?.valor ?? PRECOS_RESERVA_SEM_TESTE.mensal.valor) ?? ECONOMIA_RESERVA,
    grande: grande === "vitalicio" ? "vitalicio" : "anual",
    vitalicio: vitalicioTxt,
    // "3 meses de mensal = CORE pra sempre" (97,90 ÷ 34,90 = 2,8), a mesma conta do Android
    mesesDeMensal: Math.ceil((lojaSemTeste.vitalicio?.valor ?? PRECOS_RESERVA_SEM_TESTE.vitalicio.valor) / (lojaSemTeste.mensal?.valor ?? PRECOS_RESERVA_SEM_TESTE.mensal.valor)),
  } : null;
  /** os campos de todo evento do semTeste (os braços dos A/B vão em todos) */
  const camposSemTeste = { funil: modo === "gate" ? "gate_ios" : modo === "planos" ? "planos" : "ios", loja: "ios", area, paywall_teste: "off", paywall_visual: "android", paywall_oferta: oferta, ...(modo !== "funil" ? { modo } : {}) };
  /* os efeitos que montam 1x (saída, Voltar) leem SEMPRE os campos e o plano grande de agora — a chave remota pode
     trocar o braço com a tela aberta */
  const camposRef = useRef(camposSemTeste);
  camposRef.current = camposSemTeste;
  const grandeRef = useRef(grande);
  grandeRef.current = grande;
  useEffect(() => {
    if (!semTeste) return;
    anotarOfertaDaFolha(oferta);
    return () => anotarOfertaDaFolha(null);
  }, [semTeste, oferta]);
  /* 12/11 (dono): no app do Android o mensal com renovação é o core_mensal_34 — preço da loja, reserva "R$ 34,90".
   * O iPhone (fluxo com teste) e o site seguem no de sempre. */
  const mensal34 = !naWeb && !ehApple();
  const mensalAppTxt = mensal34 ? mensalTxt : APP_PRECOS.mensal.preco;
  // A/B do preço: A = só vitalício · B = vitalício + mensal visível.
  // No iPhone não há sorteio: é sempre o layout de duas colunas (ver
  // IOS_PLANO_INICIAL). `sortearBraco()` nem chega a ser chamado lá, senão
  // gravaria um braço no localStorage de quem não está em teste nenhum.
  const [braco] = useState<BracoW>(() => (ehApple() ? "b" : sortearBraco()));
  /* DUAS COLUNAS OU UMA — quem decide não é mais o sorteio. iPhone: sempre
   * duas (spec do dono). Android: a constante acima. O braço do A/B só volta
   * a mandar se AB_LIGADO virar true. */
  const duasColunas = naWeb ? WEB_DUAS_COLUNAS : ehApple() ? true : (ANDROID_DUAS_COLUNAS || braco === "b");
  /* Qual nasce SELECIONADO. A âncora do topo e o CTA acompanham a escolha —
   * é o que resolve o medo de "a pessoa se assusta com 97,90 antes de ver que
   * existe mensal". */
  const [plano, setPlano] = useState<"vitalicio" | "mensal">(() => {
    // 04/09: quem volta (retomada, notificação) pousa com a coluna que já
    // tinha escolhido — a 2ª exposição é onde 30% das vendas acontecem.
    if (!naWeb) { const salvo = lerChave<"vitalicio" | "mensal">(CHAVES_FUNIL_W.plano); if (salvo === "vitalicio" || salvo === "mensal") return salvo; }
    return naWeb ? "vitalicio"
      : ehApple() ? IOS_PLANO_INICIAL
      : ANDROID_DUAS_COLUNAS ? ANDROID_PLANO_INICIAL
      : sortearBraco() === "b" ? "mensal" : "vitalicio";
  });
  const simples = ehPerfilSimples(answers);

  /* ROTULO DO BRAÇO NA TELEMETRIA — não é detalhe de relatório.
   * O A/B do Android (`core-w-braco`, 50/50) decide NESTA SEMANA se a vitrine
   * fica com um preço ou dois. Se o iPhone emitisse `braco: "b"`, o iOS
   * entraria somando no braço B e a decisão sairia de uma amostra misturada —
   * dois públicos, duas lojas, duas mecânicas de pagamento, num número só.
   * "ios" mantém o teste do Android limpo e ainda deixa o iPhone separável. */
  const bracoEvento = ehApple() ? "ios" : (ANDROID_DUAS_COLUNAS ? "b-mensal" : braco);

  useEffect(() => {
    vivoRef.current = true;
    if (semTeste) {
      trackEvent("funnel_view", { step: "offer", ...camposSemTeste, ...(modo === "funil" ? { perfil: simples ? "simples" : "topo" } : {}) });
      let retrySem: number | null = null;
      void (async () => {
        try {
          const rc = await import("@/lib/revenuecat");
          await rc.initRevenueCat();
          await rc.prefetchSemTeste();
          const ler = () => {
            if (!vivoRef.current) return;
            const a = rc.dadosSemTeste("anual"), m = rc.dadosSemTeste("mensal"), v = rc.dadosSemTeste("vitalicio");
            setLojaSemTeste({ anual: a, mensal: m, vitalicio: v });
            const g = grandeRef.current === "vitalicio" ? v : a;
            trackEvent("paywall_oferta_vista", { ...camposRef.current, produto: PRODUTOS_SEM_TESTE[grandeRef.current], preco: g?.preco ?? null, preco_mensal: m?.preco ?? null, offering: g?.offering ?? null, trial: false });
          };
          if (!rc.dadosSemTeste(grandeRef.current)) retrySem = window.setTimeout(async () => { await rc.prefetchSemTeste(); ler(); }, 2500);
          else ler();
        } catch { /* a reserva de texto segura a tela */ }
      })();
      return () => { vivoRef.current = false; if (retrySem) window.clearTimeout(retrySem); };
    }
    trackEvent("funnel_view", { step: "offer", funil: "w", area, braco: bracoEvento, perfil: simples ? "simples" : "topo" });
    /* Varredura 31/08 (5 sessões de emulador insistindo no produto_ausente
     * expuseram a diferença): o W montava SEM initRevenueCat() — no funil de
     * porta o comprador é anônimo e nada no boot inicializa o RC, então o
     * prefetch fazia early-return silencioso e o PRIMEIRO toque pagava
     * init+catálogo inteiro (segundos de folha travada em aparelho popular).
     * Espelho do mount do PaywallAssinatura, que sempre aqueceu: init antes
     * do prefetch + uma re-tentativa curta. Só aquecimento de cache — o
     * caminho do toque não muda. */
    let retry: number | null = null;
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      await rc.prefetchVitalicio();
      if (!vivoRef.current) return;
      if (rc.estadoRevenueCat() === "pronto") setVitalicioNaLoja(rc.temVitalicio97());
      if (mensal34) void rc.prefetchSemTeste().then(() => { if (vivoRef.current) setLojaSemTeste((l) => ({ ...l, mensal: rc.dadosMensalAndroid() })); });
      if (!rc.temVitalicio97()) {
        retry = window.setTimeout(async () => {
          // init de novo: se o primeiro falhou por rede, o prefetch sozinho
          // faria early-return de novo (mesma lição do v81 no paywall velho).
          await rc.initRevenueCat();
          await rc.prefetchVitalicio();
          if (vivoRef.current && rc.estadoRevenueCat() === "pronto") setVitalicioNaLoja(rc.temVitalicio97());
        }, 2500);
      }
    })();
    return () => {
      vivoRef.current = false;
      if (retry) window.clearTimeout(retry);
      if (contagemRef.current) window.clearInterval(contagemRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 04/09: quem TOCOU e não pagou compra 10× mais na volta do que quem só
   * viu (1,6% × 0,17%). A régua ganha a copy de "reservado" e o plano. */
  const rearmarResgateTocou = () => {
    if (naWeb) return;
    void import("@/lib/notificacoes").then((m) => m.agendarResgateDoPlano(AREAS[area].nome, { area, tocou: true, plano: duasColunas ? plano : "vitalicio" })).catch(() => { /* noop */ });
  };
  const desarmar = () => {
    setReabrindoEm(null);
    if (contagemRef.current) { window.clearInterval(contagemRef.current); contagemRef.current = null; }
  };

  /* Revisão 02/09: a contagem de 4s do resgate reabria a folha do Google em
   * cima de quem apertou Voltar ou minimizou o app. Voltar físico (evento
   * core:voltar, do ComecarW) e app escondido desarmam a reabertura. */
  useEffect(() => {
    const aoVoltar = () => { desarmar(); if (semTeste) void abrirPresente("x_paywall"); };
    const aoEsconder = () => { if (document.hidden) desarmar(); };
    window.addEventListener("core:voltar", aoVoltar);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => { window.removeEventListener("core:voltar", aoVoltar); document.removeEventListener("visibilitychange", aoEsconder); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmarPagamento = async () => {
    setConferindo(true);
    try {
      const rc = await import("@/lib/revenuecat");
      const ok = (await rc.restaurar()) || (await rc.compraVitaliciaLocal()) || (await rc.compraAssinaturaLocal());
      if (ok) { trackEvent("funnel_click", { cta: "w_ja_paguei_ok", funil: "w" }); onPagoSemConta(); return; }
      setErro(ehApple()
        ? "Ainda não achei a compra. Espera uns segundos e toca de novo."
        : "Ainda não achei o pagamento. Se você acabou de pagar o Pix, espera uns segundos e toca de novo.");
    } catch { /* conferência nunca derruba o paywall */ }
    setConferindo(false);
  };

  /* semTeste: saída sem compra, 1 evento por paywall aberto (o mesmo `paywall_saiu` do braço enxovaly) */
  const abertoEmRef = useRef(Date.now());
  const saiuSemTesteRef = useRef(false);
  useEffect(() => {
    if (!semTeste) return;
    const sair = (beacon: boolean) => {
      if (saiuSemTesteRef.current || compraFeitaRef.current) return;
      saiuSemTesteRef.current = true;
      (beacon ? trackEventBeacon : trackEvent)("paywall_saiu", { ...camposRef.current, segundos_na_tela: Math.round((Date.now() - abertoEmRef.current) / 1000), viu_oferta: presenteTentadoRef.current });
    };
    const aoEsconder = () => { if (document.visibilityState === "hidden" && !comprandoRef.current) sair(true); };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => { document.removeEventListener("visibilitychange", aoEsconder); sair(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** semTeste: o presente de 69,90 sem teste — 1x por paywall aberto, só se a loja tem o produto. true = abriu. */
  const abrirPresente = async (lugar: "x_paywall" | "folha_cancelada"): Promise<boolean> => {
    if (!semTeste || presenteTentadoRef.current || comprandoRef.current || compraFeitaRef.current) return false;
    presenteTentadoRef.current = true;
    try {
      const rc = await import("@/lib/revenuecat");
      if (!rc.dadosSemTeste("presente")) await rc.prefetchSemTeste();
      const d = rc.dadosSemTeste("presente");
      if (!d || !vivoRef.current) return false;
      // downsell é MAIS BARATO que a vitrine (regra do dono, 16/10) — a vitrine é o plano grande da vez (anual ou vitalício)
      const g = grandeRef.current;
      const vitrine = rc.dadosSemTeste(g)?.valor ?? PRECOS_RESERVA_SEM_TESTE[g].valor;
      if (d.valor && d.valor >= vitrine) return false;
      trackEvent("presente69_view", { ...camposRef.current, lugar, preco: d.preco, de: rc.dadosSemTeste(g)?.preco ?? PRECOS_RESERVA_SEM_TESTE[g].preco, trial: false, direto: true });
      setPresente(d);
      return true;
    } catch { return false; }
  };

  const concluirSemTeste = (produto: string, ofertaRC: string, preco: string | null) => {
    compraFeitaRef.current = true;
    // gate e /planos recarregam logo depois: o sucesso vai por beacon (o insert normal morria na recarga)
    (modo === "funil" ? trackEvent : trackEventBeacon)("app_sheet_success", { ...camposRef.current, produto, oferta: ofertaRC, preco, trial: false });
    void import("@/lib/notificacoes").then((n) => { void n.cancelarResgateDoPlano(); }).catch(() => { /* noop */ });
    onPagoSemConta();
  };

  /** semTeste: a compra pela loja, sem escada de resgate — cancelou a folha = o presente. */
  const comprarSemTeste = async (escolha: "vitalicio" | "mensal") => {
    if (comprandoRef.current) return;
    comprandoRef.current = true;
    setComprando(true);
    setErro(null);
    const p: PlanoSemTeste = escolha === "mensal" ? "mensal" : grande;
    try {
      const rc = await import("@/lib/revenuecat");
      await identificarContaLogada(rc);
      rc.marcarToqueDeCompra?.();
      const ok = await rc.comprarSemTeste(p, camposSemTeste.funil);
      comprandoRef.current = false;
      if (!vivoRef.current) return;
      setComprando(false);
      if (ok) { concluirSemTeste(PRODUTOS_SEM_TESTE[p], `sem_teste_${p}`, p === "mensal" ? mensalTxt : grandeTxt); return; }
      const motivo = rc.motivoUltimaCompra();
      if (motivo === "pendente") setPendente(true);
      else if (motivo === "ja_ativo") setErro(erroJaAtivo());
      else if (motivo === "nao_permitido") setErro(erroNaoPermitido());
      else if (motivo === "produto_ausente" || motivo === "catalogo") setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
      else if (motivo === "cancelou" || motivo === null) void abrirPresente("folha_cancelada");
      else setErro(erroFolhaNaoConcluiu());
    } catch {
      comprandoRef.current = false;
      if (vivoRef.current) { setComprando(false); setErro(erroFolhaNaoConcluiu()); }
    }
  };

  /** gate e /planos: a compra é da CONTA logada (o RevenueCat precisa estar nela antes da folha). No funil a compra é
   *  anônima e o cadastro vem depois — nada a fazer. */
  const identificarContaLogada = async (rc: typeof import("@/lib/revenuecat")) => {
    if (modo === "funil") return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const uid = (await supabase.auth.getSession()).data.session?.user?.id;
      if (uid) await rc.identificarRevenueCat(uid);
    } catch { /* o init já usa a sessão */ }
  };

  /** gate: sair desta conta e entrar com outra (o gate bloqueia o app — sem isso a pessoa fica presa) */
  const trocarConta = async () => {
    trackEvent("gate_trocar_conta", { funil: camposSemTeste.funil });
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
    } catch { /* sem rede: o /entrar resolve */ }
    window.location.href = "/entrar";
  };

  /** semTeste: o Voltar redondo — o presente abre por cima? então fica; senão recua um passo (funil) / fecha (/planos). */
  const voltarSemTeste = () => {
    trackEvent("funnel_click", { cta: "paywall_voltar", ...camposSemTeste });
    window.dispatchEvent(new CustomEvent("core:voltar"));
    if (onVoltar) window.setTimeout(() => { if (vivoRef.current && !presenteAbertoRef.current && !comprandoRef.current) onVoltar(); }, 450);
  };

  const comprar = async (produto: "vitalicio" | "mensal") => {
    if (semTeste) { await comprarSemTeste(produto); return; }
    if (comprando) return;
    setErro(null);
    desarmar();
    /* WEB: nada de loja. Abre o Pix por cima e sai — o overlay conduz até o
     * QR e a confirmação; quem libera o acesso é o webhook da Cakto, igual
     * ao funil que já roda em /inicio. */
    if (naWeb) {
      trackEvent("funnel_click", { cta: "w_web_pix", funil: "w", area, produto });
      setPixAberto(true);
      return;
    }
    setComprando(true);
    const abriuEm = Date.now();
    try {
      const rc = await import("@/lib/revenuecat");
      rc.marcarToqueDeCompra?.(abriuEm);
      const idProduto = produto === "mensal" ? (mensal34 ? ID_MENSAL_ANDROID : "core_mensal") : vitalicioNaLoja !== false ? "core_vitalicio_97" : "core_anual:coreanual97";
      const ok = produto === "mensal"
        ? (mensal34 ? await rc.comprarMensalAndroid("funil_w") : await rc.comprar("core_mensal", { semTrial: true }))
        : vitalicioNaLoja !== false
          ? await rc.comprarVitalicio("core_vitalicio_97")
          : await rc.comprarAnual97();
      // v88: o front do W não emitia sucesso — o funil marcava "pagou 0" com
      // dinheiro no caixa (o webhook cobria a verdade, o relatório não).
      if (ok) trackEvent("app_sheet_success", { produto: idProduto, funil: "w", braco: bracoEvento });
      if (ok) { onPagoSemConta(); return; }
      // Recusa: a MESMA escada provada do PaywallAssinatura.
      const dentroDaFolha = (Date.now() - abriuEm) / 1000;
      const motivo = rc.motivoUltimaCompra();
      if (motivo === "pendente") {
        setPendente(true);
        // Pix gerado na folha: a pessoa vai pagar no banco. O resgate de 2h
        // ("seu plano ficou salvo… R$ 97,90") viraria cobrança pra quem já
        // pagou (revisão 02/09) — o webhook libera; o aviso morre aqui.
        if (!naWeb) void import("@/lib/notificacoes").then((m) => m.cancelarResgateDoPlano()).catch(() => { /* noop */ });
      } else if (motivo === "produto_ausente") {
        setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
      } else if (motivo === "ja_ativo") {
        /* 02/09: a Play diz que a compra JÁ É desta pessoa (pagou, o app morreu
         * na folha, voltou e tocou de novo). O motor já tentou restaurar; aqui
         * vai o caminho do "Já paguei", que também confere a compra local. */
        setErro("A Play diz que esta compra já é sua. Conferindo…");
        if (!naWeb) void import("@/lib/notificacoes").then((m) => m.cancelarResgateDoPlano()).catch(() => { /* noop */ });
        void confirmarPagamento();
      } else if (motivo === "nao_permitido") {
        /* 02/09: conta Google que NÃO PODE comprar (5–13/dia). "Tenta de novo"
         * era mentira — nada muda sem mexer na conta. Sem escada: reabrir a
         * folha falharia igual. */
        setErro("A Play Store recusou compras nesta conta Google. Abre a Play Store, confere se está logado e se a conta pode comprar (conta de menor precisa da aprovação dos pais) e volta aqui. Se você já pagou, toca em «Já paguei».");
      } else if (!temEscadaPix()) {
        /* iOS: a folha da Apple é instantânea e cancelar é cancelar — não há
         * Pix pendente pra resgatar nem lentidão de renderização pra cobrir.
         * Só conta a recusa; a pessoa continua no paywall com o botão vivo. */
        cancelamentos.current += 1;
        rearmarResgateTocou();
      } else if (dentroDaFolha >= 30 && !pixVencendoJaFoi.current) {
        pixVencendoJaFoi.current = true;
        setPixVencendo(true);
        rearmarResgateTocou();
        trackEvent("funnel_view", { step: "w_pix_vencendo", funil: "w" });
      } else if (dentroDaFolha < 20 && cancelamentos.current === 0) {
        cancelamentos.current += 1;
        rearmarResgateTocou();
        setResgatePix(true);
        setReabrindoEm(4);
        trackEvent("funnel_view", { step: "w_resgate_pix", funil: "w" });
        contagemRef.current = window.setInterval(() => {
          setReabrindoEm((v) => {
            if (v === null) return null;
            if (v <= 1) {
              desarmar();
              void comprar(duasColunas ? plano : "vitalicio");
              return null;
            }
            return v - 1;
          });
        }, 1000);
      } else {
        cancelamentos.current += 1;
        rearmarResgateTocou();
      }
    } catch { setErro(erroFolhaNaoConcluiu()); }
    setComprando(false);
  };

  const chartLabel = CHART_LABEL[area] ?? CHART_LABEL.dinheiro;
  const vitoria: Record<AreaKey, string> = {
    dinheiro: "ver pra onde seu dinheiro vai",
    rotina: "organizar sua rotina",
    corpo: "cuidar do seu corpo com constância",
    saude: "cuidar da sua saúde todo dia",
    metas: "tirar suas metas do papel",
  };

  /* O overlay do Pix cobre o paywall inteiro (mesmo padrão do /inicio): quem
   * fecha SEM pagar volta pro paywall com o botão vivo; quem paga é levado
   * adiante pelo onPagoSemConta, que na web já tem conta criada. */
  if (naWeb && pixAberto) {
    return (
      <PixCheckout
        offer={duasColunas && plano === "mensal" ? OFERTA_WEB_MES : OFERTA_WEB}
        context="funnel"
        onClose={(passo) => {
          setPixAberto(false);
          trackEvent("funnel_view", { step: "w_web_pix_saiu", funil: "w", passo: passo ?? "" });
        }}
        v2={{ onConfirmado: () => onPagoSemConta() }}
      />
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto text-center pb-40 pt-8" {...(semTeste ? { "data-testid": "paywall-w-sem-teste", "data-plano": plano === "mensal" ? "mensal" : grande, "data-oferta": oferta, "data-modo": modo } : {})}>
      {/* semTeste (iPhone): o iPhone não tem Voltar físico — o mesmo botão redondo do paywall sem teste (rola junto, não cobre o texto).
          O gate não tem Voltar: ele bloqueia o app (a saída é "Entrar com outra conta", no rodapé). */}
      {semTeste && onVoltar && modo !== "gate" && (
        <button
          type="button" aria-label="Voltar" data-testid="paywall-w-voltar" onClick={voltarSemTeste}
          className="absolute left-0 z-[76] w-11 h-11 rounded-full bg-white/90 backdrop-blur text-[#16121c] grid place-items-center shadow-[0_6px_18px_-8px_rgba(0,0,0,.35)] active:scale-95 transition-transform"
          style={{ top: 4 }}
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}
      {modo === "funil" ? (
        <>
          {/* Reveal (web) */}
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
        </>
      ) : (
        <>
          {/* gate e /planos (12/11): sem funil antes — o título neutro do gate do Android (PaywallAssinatura) */}
          <div className="mt-1 mb-2.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider" data-testid="paywall-w-selo">
              {modo === "planos" ? "Seu acesso" : "Último passo"}
            </span>
          </div>
          <h1 className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2" data-testid="paywall-w-titulo">Sua vida inteira organizada</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-3">Dinheiro, rotina, corpo e metas num app só.</p>
        </>
      )}
      {/* PROVA NA DOBRA (04/09): 84% das saídas e 75% dos toques acontecem em
          <30s e 4 em 5 nunca chegam ao mural lá embaixo. Uma avaliação real,
          curta, junto do preço. No iPhone a loja não é citada (3.1.1). */}
      <p className="text-[12.5px] text-muted-foreground leading-snug mb-5 flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</span>
        <span>“Tudo que eu sempre quis num planner. Vale cada centavo.”</span>
        <span className="font-semibold text-foreground/70">Elisa D. · {ehApple() ? "avaliação de usuário" : "Google Play"}</span>
      </p>

      <div className="space-y-4">
        <motion.div {...stagger(0)}>
          {(() => {
            // A comparação do topo mostra o plano ESCOLHIDO — no braço B ela
            // abre no mensal (24,90/mês) e troca pro vitalício se a pessoa
            // mudar de coluna. No braço A é sempre o vitalício.
            const mostraMensal = duasColunas && plano === "mensal";
            if (semTeste) {
              // 12/11 noite: a âncora do anual sem teste — preço da loja (já com a moeda), "por ano", nada de "pra sempre".
              // Braço vitalício: a âncora do Android (97,90 "1x, pra sempre", título padrão do cartão).
              const vit = grande === "vitalicio";
              const preco = mostraMensal ? mensalTxt : grandeTxt;
              const precoSub = mostraMensal ? "por mês" : vit ? "1x, pra sempre" : "por ano";
              const precoTitulo = mostraMensal ? <>CORE mensal,<br />pra começar hoje</> : vit ? undefined : <>CORE anual,<br />pra enxergar tudo</>;
              return area === "dinheiro"
                ? <AnchorCard gasto={answers?.gasto ?? ""} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} prefixo="" />
                : <AreaAnchorCard area={area as Exclude<AreaKey, "dinheiro">} preco={preco} precoSub={precoSub} precoTitulo={mostraMensal ? precoTitulo : undefined} prefixo="" />;
            }
            // na web o preço é outro (27,90 no Pix) — a âncora tem que bater
            // com o card e com o CTA, senão a tela promete três números
            const preco = mostraMensal ? (mensal34 ? mensalTxt.replace(/^R\$\s*/, "") : "24,90") : naWeb ? PRECO_WEB : "97,90";
            const precoSub = mostraMensal ? (naWeb ? "30 dias" : "por mês") : "1x, pra sempre";
            const precoTitulo = mostraMensal
              ? <>{naWeb ? <>CORE por 30 dias,<br />pra começar hoje</> : <>CORE mensal,<br />pra começar hoje</>}</>
              : undefined;
            return area === "dinheiro"
              ? <AnchorCard gasto={answers?.gasto ?? ""} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} />
              : <AreaAnchorCard area={area as Exclude<AreaKey, "dinheiro">} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} />;
          })()}
        </motion.div>
        {/* PREÇO LOGO ABAIXO DA ÂNCORA (02/09, medido em 3 dias): só 5% das
            sessões chegavam a tocar nas colunas de preço — elas moravam abaixo
            do gráfico, da pilha de valor e da tabela — e quem tocava comprava
            58–78%. Metade de quem sai do paywall sai em menos de 10s, antes do
            5º bloco. A decisão de preço sobe pra dobra; o resto vira apoio. */}
        <motion.div {...stagger(1)}>
          {duasColunas ? (
            <PrecosLadoALadoW
              naWeb={naWeb}
              plano={plano}
              semTeste={colunasSemTeste}
              mensalApp={mensal34 ? mensalTxt : null}
              onSelect={(p) => { setPlano(p); tocouPlano.current = true; if (!naWeb) guardarChave(CHAVES_FUNIL_W.plano, p); trackEvent("funnel_click", semTeste ? { cta: "paywall_plano", plano: p === "mensal" ? "mensal" : grande, ...camposSemTeste } : { cta: "w_plano", plano: p, braco: bracoEvento, funil: "w" }); }}
            />
          ) : (
            <LifetimeCardW naWeb={naWeb} />
          )}
        </motion.div>
        <motion.div {...stagger(2)}><TransformChart label={chartLabel} /></motion.div>
        {/* quem pediu "bem simples" some em <10s diante da pilha de 16 módulos:
            pra esse perfil ela sai (04/09); o resto da tela é o mesmo */}
        {!simples && <ValueStack area={area} />}
        <motion.div {...stagger(3)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>

        {/* braço vitalício: os depoimentos de sempre do Android (inclui "pagamento único") */}
        <MuralDepoimentos area={area} soAssinatura={semTeste && grande !== "vitalicio"} />
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
        {/* 14/11 (1.0.27): braço vitalício com o vitalício marcado = compra única → sem "Cancele quando quiser" */}
        <motion.div {...stagger(4)}><TrustChips unico={semTeste && grande === "vitalicio" && plano !== "mensal"} /></motion.div>

        {/* "Segue e ganha 7 dias" (14/09): quem veio do Instagram com código
            entra por aqui. Só confere e guarda — a conta ainda não existe;
            o resgate de verdade acontece no "Liberando", depois do cadastro.
            Some no iPhone (a Apple proíbe destravar por código próprio). */}
        <div className="text-center pt-3">
          <EntradaDeCodigo
            modo="validar"
            className="mx-auto max-w-xs"
            onOk={(dias) => {
              trackEvent("funnel_click", { cta: "w_codigo_ok", funil: "w", dias });
              onPagoSemConta();
            }}
          />
        </div>

        {/*
          RODAPÉ LEGAL — SÓ no iPhone, e não é enfeite: sem ele a Apple
          reprova este paywall em dois pontos de uma vez.
            · 3.1.1 exige "Restaurar compras" alcançável. Este é o paywall de
              ENTRADA: quem reinstala o app cai aqui, e sem o botão não tem
              como recuperar o que já pagou (o revisor testa exatamente isso).
            · 3.1.2 exige link funcional pra Termos e Privacidade na PRÓPRIA
              tela de compra, não escondido em outro menu.
          Por que só no iOS: no Android esta tela é o funil que está vendendo
          hoje, e a entrada do iPhone não é motivo pra mexer nele. Lá o
          restaurar continua onde sempre esteve (/planos e o gate).
        */}
        {ehApple() && <AppLegalFooter />}
        {/* gate (12/11): o mesmo par do gate de antes — sem isso, quem entrou na conta errada fica preso no bloqueio */}
        {semTeste && modo === "gate" && (
          <p className="text-center text-[11px] text-muted-foreground -mt-1">
            <button type="button" className="underline underline-offset-2" data-testid="paywall-w-trocar-conta" onClick={() => void trocarConta()}>Entrar com outra conta</button>
          </p>
        )}
      </div>

      {/* CTA sticky — motor RC + escada de resgate */}
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent pt-8"
        style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          {pendente && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              {ehApple() ? (
                /* "Pendente" na Apple é raro (Ask to Buy de conta de menor,
                 * ou revisão de fraude) e não tem nada pra pessoa fazer no
                 * banco — só esperar. Prometer Pix aqui seria inventar. */
                <><b>Compra em processamento.</b> A App Store ainda está confirmando —
                o acesso libera sozinho aqui.</>
              ) : (
                <><b>Pagamento em processamento no Google.</b> Se você gerou um Pix, paga no app do seu banco —
                o acesso libera sozinho aqui.</>
              )}
              <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
                {conferindo ? "Conferindo…" : "Já paguei — atualizar"}
              </button>
            </div>
          )}
          {pixVencendo && !pendente && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              <b>Gerou o código Pix?</b> Ele vence em 5 minutos — paga agora no app do teu banco que o acesso libera sozinho.
              <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
                {conferindo ? "Conferindo…" : "Já paguei — atualizar"}
              </button>
            </div>
          )}
          {resgatePix && !pendente && !pixVencendo && (
            <div className="rounded-xl bg-[#e5f6f3] border border-[#b9e6df] text-[#0b6d62] text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              <b>Prefere pagar no Pix?</b> A tela do Google aceita Pix — abre de novo na hora, escolhe Pix na lista e copia o código.
              Se ela pediu seus dados, é só na primeira compra na Play.
              {reabrindoEm !== null ? (
                <span className="flex items-center justify-between mt-1.5">
                  <b>Reabrindo em {reabrindoEm}s…</b>
                  <button className="font-bold underline underline-offset-2" onClick={() => { desarmar(); trackEvent("funnel_click", { cta: "w_resgate_cancelou", funil: "w" }); }}>
                    Agora não
                  </button>
                </span>
              ) : (
                <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={comprando} onClick={() => void comprar("vitalicio")}>
                  Abrir de novo e pagar no Pix
                </button>
              )}
              {reabrindoEm === null && (
                <button className="block w-full text-center text-[11.5px] font-semibold mt-1 opacity-80 underline underline-offset-2 disabled:opacity-50" disabled={comprando} onClick={() => void comprar("mensal")}>
                  ou assina o mensal — {mensalAppTxt}/mês · cancela quando quiser
                </button>
              )}
            </div>
          )}
          {erro && <p className="text-[12.5px] text-destructive text-center mb-2">{erro}</p>}

          <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Button
              size="lg"
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
              disabled={comprando}
              onClick={() => {
                const escolha = duasColunas ? plano : "vitalicio";
                if (!naWeb) guardarChave(CHAVES_FUNIL_W.plano, escolha);
                if (semTeste) {
                  const p: PlanoSemTeste = escolha === "mensal" ? "mensal" : grande;
                  trackEvent("funnel_click", { cta: "app_paywall_cta", ...camposSemTeste, plano: p, produto: PRODUTOS_SEM_TESTE[p], preco: p === "mensal" ? mensalTxt : grandeTxt });
                } else
                trackEvent("funnel_click", { cta: "app_paywall_cta", produto: naWeb ? (escolha === "mensal" ? OFERTA_WEB_MES : OFERTA_WEB) : escolha === "mensal" ? (mensal34 ? ID_MENSAL_ANDROID : "core_mensal") : "core_vitalicio_97", funil: "w", braco: bracoEvento });
                void comprar(escolha);
              }}
            >
              {comprando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : semTeste
                  ? (plano === "mensal"
                    ? <>Começar por {mensalTxt}/mês <ArrowRight className="w-4 h-4" /></>
                    : grande === "vitalicio"
                      ? <>Quero pra sempre — {vitalicioTxt} <ArrowRight className="w-4 h-4" /></>
                      : <>Quero o anual — {anualTxt}/ano <ArrowRight className="w-4 h-4" /></>)
                : duasColunas && plano === "mensal"
                  ? <>Começar por {mensalAppTxt}{naWeb ? "" : "/mês"} <ArrowRight className="w-4 h-4" /></>
                  : <>Quero pra sempre — {naWeb ? PRECO_WEB : APP_PRECOS.vitalicio97.preco} <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </motion.div>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              {/* O legal cita a loja da vez e, no iPhone, NENHUMA forma de
                * pagamento: "Pix ou cartão" aqui é reprovação na 3.1.1. */}
              {/* Na WEB não existe loja: quem cobra é o Pix. Dizer "pelo Google
                * Play" aqui seria mentira na tela que pede o dinheiro — e o
                * comprador que lê "Google Play" e vê um QR de Pix desiste. */}
              {semTeste && grande === "vitalicio" && plano !== "mensal"
                ? <>Pagamento <strong className="text-foreground font-semibold">único</strong> de {vitalicioTxt} {pelaLoja()} · sem mensalidade</>
                : semTeste
                ? <>Assinatura de {plano === "mensal" ? `${mensalTxt}/mês` : `${anualTxt}/ano`} {pelaLoja()} · {avisoRenovacao()}</>
                : naWeb && duasColunas && plano === "mensal"
                ? <>Pagamento <strong className="text-foreground font-semibold">único</strong> no Pix · <strong className="text-foreground font-semibold">30 dias</strong> de acesso · garantia de 7 dias, devolve em 1 mensagem</>
                : naWeb
                ? <>Pagamento <strong className="text-foreground font-semibold">único</strong> no Pix · acesso na hora · garantia de 7 dias, devolve em 1 mensagem</>
                : duasColunas && plano === "mensal"
                ? <>Assinatura de {mensalAppTxt}/mês {pelaLoja()}{formasDePagamento() && ` · ${formasDePagamento()}`} · {avisoRenovacao()}</>
                : <>Pagamento <strong className="text-foreground font-semibold">único</strong> {pelaLoja()}{formasDePagamento() && ` · ${formasDePagamento()}`} · sem mensalidade</>}
            </span>
          </p>
          {/* 02/09: 66% dos cancelamentos da folha vêm em <5s, iguais em todo
              aparelho e produto — a pessoa vê a 1ª tela do Google (dados +
              forma de pagamento) e sai. Avisar antes tira o susto. Só Android. */}
          {!naWeb && !ehApple() && (
            <p className="text-[10.5px] text-muted-foreground/80 text-center mt-1 leading-snug">
              Primeira compra na Play? O Google pede seus dados uma vez e pronto.
            </p>
          )}
        </div>
      </div>

      {semTeste && presente && (
        <PresenteDireto
          oferta={presente}
          /* braço vitalício: sem "de R$ 97,90" riscado — o 97,90 de lá é o vitalício, não um ano */
          precoDe={grande === "vitalicio" ? null : anualTxt}
          onFechar={() => { trackEvent("presente69_fechou", { ...camposSemTeste, direto: true }); setPresente(null); }}
          onComprar={async () => {
            const rc = await import("@/lib/revenuecat");
            await identificarContaLogada(rc);
            trackEvent("presente69_toque", { ...camposSemTeste, direto: true });
            rc.marcarToqueDeCompra?.();
            const ok = await rc.comprarSemTeste("presente", camposSemTeste.funil);
            if (ok) {
              trackEvent("presente69_sucesso", { ...camposSemTeste, preco: presente.preco, direto: true });
              concluirSemTeste(PRODUTOS_SEM_TESTE.presente, "presente69_direto", presente.preco);
              return null;
            }
            const motivo = rc.motivoUltimaCompra();
            trackEvent("presente69_falhou", { ...camposSemTeste, motivo, direto: true });
            if (motivo === "cancelou" || motivo === null) return null;
            if (motivo === "ja_ativo") return erroJaAtivo();
            if (motivo === "nao_permitido") return erroNaoPermitido();
            return erroFolhaNaoConcluiu();
          }}
        />
      )}

      {/* Overlay anti-abandono na abertura da folha (motor do app) */}
      {comprando && (
        <div className="fixed inset-0 z-[80] grid place-items-end pointer-events-none pb-28">
          <div className="mx-auto max-w-[92%] rounded-2xl bg-[#16121c] text-white text-[12.5px] font-bold px-4 py-2.5 shadow-lg flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Abrindo o pagamento — leva uns segundos, não fecha o app
          </div>
        </div>
      )}
    </div>
  );
}
