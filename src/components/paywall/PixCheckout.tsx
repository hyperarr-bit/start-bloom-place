import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Fingerprint, ShieldCheck, User, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { markPixPurchasePending, firePixPurchaseOnce } from "@/lib/purchase-tracking";
import { isNativeShell } from "@/lib/native-shell";
import { garantirSessao, anonimoLigado, emailDaSessao, definirEmailDaCompra, entrarNaContaExistente, marcarBatismoSeSemEmail } from "@/lib/sessao-anonima";
import { useAuth } from "@/hooks/use-auth";
import { AppPurchaseSheet } from "@/components/app/AppPurchaseSheet";

/**
 * Checkout Pix DENTRO do app (13/07). Substitui o redirect pro checkout
 * hospedado da Cakto — dias 12-13 tiveram ~25 cliques no anual e 0 vendas
 * lá dentro, sem visibilidade nenhuma. Aqui cada passo vira evento:
 * pix_checkout_open → pix_generated → pix_copied → pix_confirmed/expired.
 *
 * Fluxo: [nome + CPF (telefone vai coringa — ver DUMMY_PHONE)] → QR + copia-e-cola
 * → polling do check-subscription a cada 3s → celebração vitalícia.
 */

/* 31/08 — funil W na WEB. A oferta "w97" existe porque a meta virou ROI 2 e a
 * conta só fecha saindo da folha do Google: ela paga 13-27% (medido 27-31/08)
 * contra ~45% do Pix, cobra 15% e segura o dinheiro 60 dias. Mesmo funil,
 * mesmo preço do app (97,90), cano de pagamento diferente. */
export type PixOffer = "lifetime" | "downsell" | "w97" | "w25";

/* 03/09 (ordem do dono, "97,90 em tudo"): a WEB passa a ter UM preço só.
 * A oferta `lifetime` — que a demo, o portão do /home, o /comecar e o
 * funil do dia 14 abrem — sobe de 27,90 pra 97,90 e encosta na `w97`.
 * Motivo medido (31/08→03/09): 12 das 28 vendas da web saíam a 27,90 num
 * funil que já vendia 97,90 do outro lado, e a taxa de pagamento do Pix é
 * IGUAL nos dois preços (36% × 32%) — o desconto não comprava conversão,
 * só dava desconto. Quem paga é o gateway: `PRECOS_CENTAVOS` das functions
 * (asaas-pix/asaas-webhook/pix-reconcile) foi pra 9790 na mesma passada.
 * Trocar um sem o outro faz a tela prometer um preço e o QR cobrar outro. */
export const PIX_PRICES: Record<PixOffer, string> = {
  lifetime: "97,90",
  downsell: "19,90",
  w97: "97,90",
  /* 03/09 — a 2ª coluna da web: 1 MÊS por 24,90. PRÉ-PAGO: o Pix não tem
   * débito automático, então são 30 dias e acabou. A tela tem que dizer isso
   * ("não renova sozinho") — prometer assinatura aqui vira reembolso. */
  w25: "24,90",
};
/** Quais ofertas são acesso VITALÍCIO — o recibo e a copy mudam por isso. */
export const OFERTA_VITALICIA: Record<PixOffer, boolean> = {
  lifetime: true, downsell: true, w97: true, w25: false,
};

interface Props {
  offer: PixOffer;
  /** Só é chamado quando a pessoa SAI SEM PAGAR — o X não existe no passo
   *  "confirmed". Recebe o passo em que ela desistiu, que é o que o funil usa
   *  pra decidir se abre o downsell (05/08). */
  onClose: (step?: Step) => void;
  context: "funnel" | "app";
  /** Skin do funil v2 (16/07). SEM essa prop o checkout fica byte-idêntico ao
   *  do funil atual (ordem do dono: o original não muda). Com ela: mascote
   *  espiando o recibo, campo nome oculto (v2 já coletou no cadastro), CTA
   *  sempre vivo (valida no toque), garantia em frase e eco da missão no QR.
   *  GATEWAY (16/07 tarde): com a prop v2, o Pix roda na ABACATEPAY (API da
   *  Cakto caiu — docs da conta em análise); onConfirmado deixa o funil levar
   *  o pagante pro T17 em vez de jogar direto pro app. */
  v2?: { mascote?: React.ReactNode; missao?: string | null; onConfirmado?: () => void };
}

// Gateway do Pix de TODO o app (16/07 noite, ordem do dono: Cakto não volta
// hoje — funil original também migra). As TELAS não mudam: o original segue
// com o form nome+CPF; só o cano por baixo troca. Quando a Cakto reativar:
// troca pra "cakto" (1 linha) e pusha — NÃO é rollback na Vercel (desfaria
// downsell/atribuição/AbacatePay juntos).
/* GATEWAY do Pix (21/07, ordem do dono): ASAAS em 100%, substitui a Pagar.me.
 * O código dos outros gateways fica intacto atrás desta constante — trocar é
 * 1 linha + push, sem rollback de deploy.
 *
 * POR QUE O ASAAS RESOLVE A DOR DA PAGAR.ME: testado ao vivo na API deles, o
 * Pix via QR CODE ESTÁTICO NÃO pede CPF (o dinâmico pediria, como a Pagar.me).
 * Então volta o checkout SEM FORMULÁRIO — igual à AbacatePay — e a fricção do
 * CPF que custava ~47% (19/07) some de novo. Bônus: expira em 30min exatos.
 *
 * TESTE A/B DE GATEWAY (22/07, ordem do dono): Asaas × Pagar.me, 50/50 por
 * hash do user.id — braço estável entre sessões/dispositivos e recomputável
 * na análise (todo QR já sai carimbado em pix_order_created.event_data.gateway).
 * A leitura honesta é POR DINHEIRO fim-a-fim (aberto→pago): o braço Pagar.me
 * reabre o form de CPF (custou ~47% dos opens em 19/07) mas usa QR dinâmico.
 * ENCERRAR o teste = FORCE_GATEWAY: "asaas" (ou o vencedor) e push.
 * QA: localStorage "pix-ab-force" = braço (chave fora do prefixo core-*,
 * sobrevive às vassouras de cache). */
type Gateway = "asaas" | "pagarme" | "abacate" | "cakto";
// 24/07 (tarde): CAKTO em 100% — ordem do dono, Banking ativado e cobrança
// REAL testada (QR gerado, R$27,90). Confirmação volta a ser webhook +
// check-subscription; rede de segurança: pix-reconcile agora fala cakto
// (rota por UUID, status via GET /orders/?id=) e o cakto-pix grava
// pix_order_created no create. Rollback = "asaas" (1 linha) + push.
/* 31/08 22h — VOLTA PRO ASAAS, ao vivo, com a campanha rodando. A Cakto
 * parou de emitir Pix: a API dela responde HTTP 201 com `status:"refused"`
 * (log da cakto-pix, 22:44) e o QR nunca nasce. Não é bug nosso — a chamada
 * chega, autentica e a Cakto recusa a cobrança; o dono confirmou testando no
 * celular. Efeito: TODO mundo que chegou no checkout hoje viu "deu ruim" —
 * 0 pedidos criados com dinheiro de anúncio já gasto.
 * O Asaas foi testado agora, ao vivo, e devolveu QR de R$27,90 na hora.
 * Quando a Cakto voltar: 1 linha e push. */
const FORCE_GATEWAY: Gateway | null = "asaas";
const AB_BRACOS: Gateway[] = ["asaas", "pagarme"];

const bracoDoUsuario = (uid: string | null | undefined): Gateway => {
  /* TESTE DE GATEWAY POR LINK (02/09): `?gw=cakto` na URL grava a escolha na
   * sessão e vale ANTES do FORCE_GATEWAY — é como se testa outro gateway
   * sem tocar no funil de todo mundo. A Cakto recusou 2 de 8 pedidos de
   * teste hoje (intermitente, só na oferta antiga de 27,90); a w97 passou
   * sempre. Só quem abre o link com o parâmetro entra nesse braço. */
  try {
    const url = new URLSearchParams(window.location.search).get("gw");
    if (url === "asaas" || url === "pagarme" || url === "abacate" || url === "cakto") sessionStorage.setItem("pix-gw-teste", url);
    const t = sessionStorage.getItem("pix-gw-teste");
    if (t === "asaas" || t === "pagarme" || t === "abacate" || t === "cakto") return t;
  } catch { /* noop */ }
  if (FORCE_GATEWAY) return FORCE_GATEWAY;
  try {
    const f = localStorage.getItem("pix-ab-force");
    if (f === "asaas" || f === "pagarme" || f === "abacate" || f === "cakto") return f;
  } catch { /* noop */ }
  const seed = uid || "anon";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return AB_BRACOS[Math.abs(h) % AB_BRACOS.length];
};

// SEM FORMULÁRIO (19/07, decisão do dono): a AbacatePay dispensa CPF e o nome
// já veio do cadastro — o form matava ~47% de quem abria o checkout (127
// abriram → 67 geraram QR nas 72h anteriores). No lugar, uma PREPARAÇÃO de
// ~2,3s (recibo + checklist animando) que é a latência REAL do create — sem
// espera artificial. O form continua vivo atrás do gate: Cakto e Pagar.me
// EXIGEM CPF, então nesses braços ele reaparece sozinho.
/* 13/08: 2300ms → 900ms. Medido 10-12/08: 7 dos 26 abandonos do checkout
 * (27%) aconteceram DENTRO desta espera artificial — gente desistindo num
 * teatro que nós inventamos. 900ms ainda cobre o flash de resposta rápida
 * demais; acima disso é só atrito. As linhas do checklist aceleraram junto
 * (stagger 0.65s → 0.28s) pra animação caber na janela nova. */
const PREPARO_MIN_MS = 900;
const PREPARO_LINHAS = [
  "Criando seu acesso vitalício",
  "Gerando seu Pix seguro",
  "Reservando sua condição de hoje",
];

export type Step = "form" | "email" | "generating" | "qr" | "confirmed" | "expired" | "error";

// A API da Cakto exige phone, mas o dono mandou NÃO pedir (fricção — mesmo
// padrão do outro SaaS dele): vai um coringa fixo. O que importa pra nota é
// o CPF. Testado direto na API 13/07: aceita e gera o QR normalmente.
const DUMMY_PHONE = "5511999999999";

// A Cakto exige CPF ("docNumber é obrigatório para pagamentos no Brasil") mas
// não valida o dígito — validamos aqui pra pegar erro de digitação antes do Pix.
const cpfLooksValid = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
};

const maskCpf = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");

// A API devolve amount como "27.9" — sem isso a tela mostrava "R$ 27.9".
const fmtBRL = (v: string | number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : String(v);
};

/** Input com ícone à esquerda (form curto de checkout — reduz cara de cadastro) */
function IconInput({ Icon, inputRef, ...props }: { Icon: typeof User; inputRef?: React.Ref<HTMLInputElement> } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
      <Input {...props} ref={inputRef} className="h-12 pl-10 rounded-xl" />
    </div>
  );
}

export function PixCheckout({ offer, onClose, context, v2 }: Props) {
  // APP DA LOJA (22/07): dentro do shell Capacitor, Pix in-app viola o Play
  // Billing (obrigatório no BR p/ conteúdo digital). ESTE é o único ponto de
  // bifurcação — todo caminho que abre PixCheckout vira Play Billing no app.
  // 06/08: o destino é o sheet do VITALÍCIO (produto único 47,90) — o
  // SubscriptionPaywall de anual/mensal aposentou junto com a assinatura.
  if (isNativeShell()) return <AppPurchaseSheet onClose={onClose} />;
  const { user: abUser } = useAuth();
  // braço congelado no mount: a pessoa nunca vê o checkout trocar de cara
  const [braco] = useState<Gateway>(() => bracoDoUsuario(abUser?.id));
  // FORM REMOVIDO (25/07, ordem do dono): o form nome+CPF do dia 14 saiu — a
  // fricção não compensava (dado: pagantes/abertura ~40-47% com ou sem form).
  // Só a Pagar.me ainda mostra o form, porque o QR dinâmico dela EXIGE CPF
  // válido. Cakto exige CPF na API mas NÃO valida o dígito → a cakto-pix usa o
  // tax_id do perfil quando existe e "00000000000" (consumidor não
  // identificado) pros anônimos. Asaas/Abacate nem precisam de CPF.
  const SEM_FORM = braco !== "pagarme";
  const [step, setStep] = useState<Step>(SEM_FORM ? "generating" : "form");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [semSessao, setSemSessao] = useState(false);
  /* Comprando SEM CONTA (funil web). O e-mail é pedido antes do QR e vira a
   * identidade que sobrevive à aba fechada; nome e senha ficam pro pós-compra. */
  const [anonima, setAnonima] = useState(false);
  const [emailCompra, setEmailCompra] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailIndo, setEmailIndo] = useState(false);
  /* Colisão: o e-mail já tem conta. Como NADA foi pago ainda, entrar na conta
   * existente é seguro (depois do pagamento, trocar de sessão órfanaria a
   * compra). Mostra o campo de senha, com "usar outro e-mail" ao lado. */
  const [contaExiste, setContaExiste] = useState(false);
  const [senhaExistente, setSenhaExistente] = useState("");
  // QR PRIMEIRO (02/09): o e-mail é pedido na tela do QR, sem barrar o código.
  const [pedirEmailNoQr, setPedirEmailNoQr] = useState(false);
  const [emailSalvo, setEmailSalvo] = useState(false);
  const [pix, setPix] = useState<{ orderId: string | null; qrCode: string; qrCodeBase64: string | null; amount: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  /* RELIGADO 13/08 (rodou 30-31/07, os 2 dias recorde; caiu no revert de
   * 01/08 junto com o pacote de prova social). Dado de 21-28/07, 383 QRs:
   * quem copia o código paga 75,4%; quem não copia, 4,6%. Então:
   * - "copiadoJa" é PERMANENTE: quem foi pro banco e voltou vê o passo-a-passo,
   *   não a tela de antes;
   * - o QR fica RECOLHIDO atrás de "Prefiro escanear" (serve ~5%) — o botão de
   *   copiar é o dinheiro;
   * - SEM auto-copy: morreu 4h depois de subir em 30/07 (2070fee) — dos 5 QRs
   *   em que só o auto disparou, ZERO pagou (clipboard mobile exige gesto).
   *   Cópia é sempre por toque humano. */
  const [copiadoJa, setCopiadoJa] = useState(false);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const doneRef = useRef(false);
  const cpfRef = useRef<HTMLInputElement>(null);
  const price = PIX_PRICES[offer];

  // AbacatePay: sem form pra NINGUÉM — gera direto (nome vem do profile no
  // servidor; CPF é opcional no gateway). Cakto: prefill do profile — com CPF
  // já salvo, pula o form direto pro QR.
  useEffect(() => {
    trackEvent("pix_checkout_open", { offer, context, gateway: braco });
    // Cakto: aquece instância+token OAuth enquanto a pessoa digita o CPF —
    // o create dela leva 5-7s frio; isso tira 1-2s da espera real.
    if (braco === "cakto") {
      supabase.functions.invoke("cakto-pix", { body: { warm: true } }).catch(() => { /* noop */ });
    }
    if (SEM_FORM) {
      /* Quem chega aqui sem e-mail está comprando SEM CONTA (funil web, sessão
       * anônima). Pede o endereço ANTES do QR — medido: 26,1% dos pagantes do
       * Pix (202 de 774) fecham a aba sem voltar, e 59% dos checkouts rodam em
       * webview do Instagram, onde o armazenamento é volátil. Sem e-mail, essa
       * fatia paga e fica sem nenhuma forma de recuperar o acesso. */
      void (async () => {
        const jaTem = await emailDaSessao();
        if (jaTem) { generate("", ""); return; }
        const podeAnonimo = await anonimoLigado();
        if (!podeAnonimo) { generate("", ""); return; } // caminho antigo: já tem conta
        /* CAKTO exige e-mail na conta (cakto-pix devolve 401 pra sessão
         * anônima: customer.email é o vínculo do webhook dela). Nesse braço o
         * e-mail continua vindo ANTES do QR — só a Asaas faz QR-primeiro. */
        if (braco === "cakto") {
          trackEvent("funnel_view", { step: "pix_email", offer, context, gateway: braco });
          setStep("email");
          return;
        }
        /* QR PRIMEIRO (02/09). Medido 01–02/09 na oferta w97: 93 viram a tela
         * de e-mail, 30 terminaram de digitar (mediana 6,9s, p75 14,6s) — 57%
         * de quem tocou em pagar nunca viu o QR. O servidor leva 0,9s. Então o
         * QR sai já, e o e-mail é pedido NA TELA DO QR, enquanto a pessoa paga
         * (`salvarEmailNoQr`). E-mail de conta existente: entra e ganha um QR
         * novo na conta; o anônimo fica sem uso. */
        trackEvent("funnel_view", { step: "pix_qr_primeiro", offer, context });
        setPedirEmailNoQr(true);
        generate("", "");
      })();
      return;
    }
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("display_name, tax_id").eq("id", uid).maybeSingle();
      if (p?.display_name) setName(p.display_name);
      if (p?.tax_id && cpfLooksValid(p.tax_id)) {
        setCpf(maskCpf(p.tax_id));
        generate(p.display_name ?? "", p.tax_id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Do campo de e-mail pro QR. Grava o endereço na conta que vai pagar (abrindo
   * a sessão anônima se preciso) e só então gera o Pix — assim `asaas-pix` já
   * enxerga `user.email`, o welcome do webhook tem destinatário, e quem fechar a
   * aba depois de pagar ainda consegue recuperar o acesso. */
  const seguirDoEmail = async () => {
    setEmailIndo(true);
    setEmailErr(null);
    try {
      if (contaExiste) {
        const { erro } = await entrarNaContaExistente(emailCompra, senhaExistente);
        if (erro) {
          setEmailErr("Senha incorreta. Tenta de novo ou usa outro e-mail.");
          trackEvent("funnel_error", { where: "pix_email_login", offer });
          return;
        }
        trackEvent("funnel_click", { cta: "pix_email_login_ok", offer });
        await generate("", "");
        return;
      }
      const r = await definirEmailDaCompra(emailCompra);
      if (r.erro === "invalido") { setEmailErr("Esse e-mail não parece certo. Confere?"); return; }
      if (r.erro === "email_em_uso") {
        // Antes do dinheiro: dá pra simplesmente entrar. Nada fica órfão.
        setContaExiste(true);
        setEmailErr("Esse e-mail já tem conta no CORE. Põe sua senha que eu sigo daqui.");
        trackEvent("funnel_view", { step: "pix_email_ja_tem_conta", offer });
        return;
      }
      if (r.erro) {
        setEmailErr("Não consegui seguir agora. Tenta de novo?");
        trackEvent("funnel_error", { where: "pix_email", offer, message: (r.mensagem || "").slice(0, 120) });
        return;
      }
      setAnonima(true);
      trackEvent("funnel_click", { cta: "pix_email_ok", offer, context });
      await generate("", "");
    } finally {
      setEmailIndo(false);
    }
  };

  /* E-MAIL NA TELA DO QR (02/09) — o código já está na tela; isto só amarra o
   * endereço à conta que vai pagar (recuperação de acesso + welcome do
   * webhook). Conta existente: entra e gera um QR novo NELA — antes do
   * dinheiro é seguro, o pedido anônimo fica sem uso. */
  const salvarEmailNoQr = async () => {
    setEmailIndo(true);
    setEmailErr(null);
    try {
      if (contaExiste) {
        const { erro } = await entrarNaContaExistente(emailCompra, senhaExistente);
        if (erro) {
          setEmailErr("Senha incorreta. Tenta de novo ou usa outro e-mail.");
          trackEvent("funnel_error", { where: "pix_email_login", offer, no_qr: true });
          return;
        }
        trackEvent("funnel_click", { cta: "pix_email_login_ok", offer, no_qr: true });
        setEmailSalvo(true);
        await generate("", ""); // QR novo, agora na conta dela
        return;
      }
      const r = await definirEmailDaCompra(emailCompra);
      if (r.erro === "invalido") { setEmailErr("Esse e-mail não parece certo. Confere?"); return; }
      if (r.erro === "email_em_uso") {
        setContaExiste(true);
        setEmailErr("Esse e-mail já tem conta no CORE. Põe sua senha que eu passo o Pix pra ela.");
        trackEvent("funnel_view", { step: "pix_email_ja_tem_conta", offer, no_qr: true });
        return;
      }
      if (r.erro) {
        setEmailErr("Não consegui salvar agora. Tenta de novo?");
        trackEvent("funnel_error", { where: "pix_email", offer, no_qr: true, message: (r.mensagem || "").slice(0, 120) });
        return;
      }
      setAnonima(true);
      setEmailSalvo(true);
      trackEvent("funnel_click", { cta: "pix_email_ok", offer, context, no_qr: true });
    } finally {
      setEmailIndo(false);
    }
  };

  const generate = async (nm: string, doc: string) => {
    setStep("generating");
    setErrMsg(null);
    /* Sem sessão as edge functions respondem 401 e o retry vira loop eterno
     * (caso real 22/07: estado do funil restaurou o paywall pós-logout).
     *
     * 01/09 — em vez de mandar cadastrar, ABRE UMA SESSÃO ANÔNIMA. É o que
     * permite vender antes de pedir conta na web: `asaas-pix` continua vendo um
     * usuário autenticado de verdade e nenhuma função de dinheiro muda. Só
     * quando nem isso dá certo (chave de anônimo desligada no painel, rede
     * fora) é que cai no caminho antigo de "entra de novo" — por isso a
     * mudança é segura de subir antes de a chave ser ligada. */
    const estadoSessao = await garantirSessao();
    if (estadoSessao === "indisponivel") {
      trackEvent("pix_error", { offer, context, message: "sem_sessao" });
      setSemSessao(true);
      setErrMsg("Sua sessão expirou. Entra de novo rapidinho e o Pix sai na hora.");
      setStep("error");
      return;
    }
    if (estadoSessao === "anonima") { setAnonima(true); trackEvent("pix_sessao_anonima", { offer, context }); }
    // Pix numa sessão sem e-mail → depois de pagar, cadastro antes de liberar (QR primeiro, 02/09)
    void marcarBatismoSeSemEmail();
    const t0 = Date.now();
    try {
      let data: any, error: any;
      if (braco === "asaas") {
        // Asaas (QR estático): sem CPF, contrato de resposta idêntico.
        // fbp/fbc/sourceUrl vão NO CREATE (22/07): metade dos pagantes paga no
        // app do banco e nunca volta — o webhook fazia o CAPI só com e-mail.
        // Capturando os cookies AGORA (navegador ainda aberto) e guardando no
        // pix_order_created, o webhook manda o Purchase com sinal completo.
        const cookie = (n: string) =>
          document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1) ?? null;
        ({ data, error } = await supabase.functions.invoke("asaas-pix", {
          body: {
            action: "create", offer,
            fbp: cookie("_fbp"), fbc: cookie("_fbc"),
            sourceUrl: window.location.href,
          },
        }));
      } else if (braco === "pagarme") {
        // Pagar.me: MESMO contrato; exige CPF — devolve {error:"cpf_required"}
        // e o handler abaixo reabre o form.
        ({ data, error } = await supabase.functions.invoke("pagarme-pix", {
          body: {
            action: "create",
            offer,
            customer: { name: nm || undefined, docNumber: doc || undefined },
          },
        }));
      } else if (braco === "abacate") {
        // AbacatePay: contrato de resposta idêntico (orderId/qrCode/…)
        ({ data, error } = await supabase.functions.invoke("abacate-pix", {
          body: {
            action: "create",
            offer,
            customer: { name: nm || undefined, docNumber: doc || undefined },
          },
        }));
      } else {
        // SDK antifraude da Cakto (best-effort — doc diz que é fluxo de cartão)
        let fingerprint: string | undefined;
        let antifraudRef: string | undefined;
        try {
          const w = window as any;
          if (w.Cakto?.CaktoSDK && w.__caktoSdk) {
            await w.__caktoSdk.completeAntifraudProfile?.();
            antifraudRef = w.__caktoSdk.getAntifraudReference?.();
          }
        } catch { /* segue sem — a edge function manda UUID */ }

        /* fbp/fbc/sourceUrl NO CREATE (10/08) — o braço Asaas já mandava, o
         * Cakto não, e é o Cakto que vende. Sem esses cookies a CAPI do
         * webhook manda Purchase só com e-mail hasheado, e a Meta casa menos:
         * a cobertura medida caiu de 100% (05/08) pra 78% (10/08). Como ela
         * otimiza e aplica a trava de ROAS em cima do que ENXERGA, subcontar
         * vira entrega estrangulada — a campanha via ROAS 1,49 num piso de
         * 1,30 enquanto o real era 1,92.
         *
         * Capturados AQUI e não no confirm porque metade dos pagantes sai pro
         * app do banco e nunca volta pra tela — no create o navegador ainda
         * está aberto e os cookies existem. */
        const cookie = (n: string) =>
          document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1) ?? null;

        ({ data, error } = await supabase.functions.invoke("cakto-pix", {
          body: {
            offer,
            customer: { name: nm || undefined, phone: DUMMY_PHONE, docNumber: doc || undefined },
            fingerprint,
            antifraudRef,
            attribution: getAttributionParams(),
            fbp: cookie("_fbp"),
            fbc: cookie("_fbc"),
            // TikTok (16/08): mesmo raciocínio do fbp/fbc acima. `_ttp` é o
            // cookie de navegador do TikTok; o ttclid vem na URL e já viaja
            // dentro de attribution (getAttributionParams).
            ttp: cookie("_ttp"),
            sourceUrl: window.location.href,
          },
        }));
        /* Recusa intermitente (medido 02/09: 2 de 8 pedidos nascem "refused"
         * e a repetição idêntica passa): uma 2ª tentativa antes de mostrar
         * erro. Chave de idempotência é nova a cada chamada (função). */
        if (error || !data?.qrCode) {
          trackEvent("pix_retry", { offer, context, gateway: braco });
          await new Promise((r) => setTimeout(r, 1200));
          ({ data, error } = await supabase.functions.invoke("cakto-pix", {
          body: {
            offer,
            customer: { name: nm || undefined, phone: DUMMY_PHONE, docNumber: doc || undefined },
            fingerprint,
            antifraudRef,
            attribution: getAttributionParams(),
            fbp: cookie("_fbp"),
            fbc: cookie("_fbc"),
            // TikTok (16/08): mesmo raciocínio do fbp/fbc acima. `_ttp` é o
            // cookie de navegador do TikTok; o ttclid vem na URL e já viaja
            // dentro de attribution (getAttributionParams).
            ttp: cookie("_ttp"),
            sourceUrl: window.location.href,
          },
        }));
        }
      }
      if (error) throw error;
      if (data?.error === "cpf_required") { setStep("form"); setErrMsg("Confere o CPF — o banco exige pra emitir o Pix."); return; }
      if (data?.error || !data?.qrCode) throw new Error(data?.error || "Sem QR na resposta");
      // segura o QR até o checklist de preparação terminar (~2,3s) — resposta
      // mais rápida que isso deixaria a "preparação" com cara de mentira
      if (SEM_FORM) {
        const falta = PREPARO_MIN_MS - (Date.now() - t0);
        if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      }
      // Código NOVO reseta o estado (07d5175, 30/07): sem isso, quem deixa o
      // 1º QR expirar cai numa tela que já diz "copiado" pra um código que
      // nunca copiou.
      setCopiadoJa(false);
      setMostrarQR(false);
      setPix({ orderId: data.orderId ?? null, qrCode: data.qrCode, qrCodeBase64: data.qrCodeBase64, amount: data.amount ?? price, expiresAt: data.expiresAt });
      setStep("qr");
      trackEvent("pix_generated", { offer, context, order_id: data.orderId, gateway: braco });
      // dia-14: o CPF digitado vira tax_id no perfil → próximo open pula o
      // form. Pagar.me/Cakto salvam no servidor; Asaas/Abacate ignoram o doc,
      // então salva daqui. Não-bloqueante: falha não afeta a venda.
      if (cpfLooksValid(doc)) {
        supabase.auth.getUser().then(({ data: auth }) => {
          const uid = auth?.user?.id;
          if (!uid) return;
          const patch: { tax_id: string; display_name?: string } = { tax_id: doc.replace(/\D/g, "") };
          if (nm.trim()) patch.display_name = nm.trim();
          // builder do supabase é lazy: sem .then() a query nunca dispara
          supabase.from("profiles").update(patch).eq("id", uid).then(() => { /* noop */ });
        }).catch(() => { /* noop */ });
      }
      // Intenção pendente: se a pessoa pagar e voltar já liberada (sem ver a
      // tela de confirmação), o rescue no app dispara o Purchase mesmo assim.
      markPixPurchasePending({ offer, orderId: data.orderId ?? null });
    } catch (e: any) {
      trackEvent("pix_error", { offer, context, message: String(e?.message || e).slice(0, 200) });
      setErrMsg("Não consegui gerar o Pix. Tenta de novo em alguns segundos.");
      setStep("error");
    }
  };

  // Countdown de expiração
  useEffect(() => {
    if (step !== "qr" || !pix?.expiresAt) return;
    const tick = () => {
      const s = Math.floor((new Date(pix.expiresAt!).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, s));
      if (s <= 0) {
        setStep("expired");
        trackEvent("pix_expired", { offer, context });
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [step, pix?.expiresAt, offer, context]);

  // Polling: pagou? Cakto: o webhook grava a assinatura e a gente pergunta ao
  // check-subscription. AbacatePay (v2): perguntamos direto à abacate-pix, que
  // confirma E libera o acesso no mesmo passo (sem depender de webhook).
  /* CHECA NA VOLTA, não só de 3 em 3 segundos (03/08).
   *
   * O caso real: 10 dos 42 pagantes do dia nunca viram "Pagamento confirmado"
   * — todos com acesso ATIVO no banco. Motivo: pra pagar, a pessoa sai pro app
   * do banco; o celular CONGELA a aba e a corrente de setTimeout para. Se o
   * navegador mata a aba (comum em celular fraco e no navegador de dentro do
   * Instagram, que é 78% do nosso tráfego), a corrente não recomeça sozinha e
   * a tela fica em "Aguardando seu pagamento…" pra sempre. A pessoa conclui
   * que deu errado e abre chamado — já pagando e já com acesso.
   *
   * Agora todo retorno de foco (visibilitychange/focus/pageshow-bfcache) força
   * uma checagem imediata. Cobre também quem foi creditado pela rede de
   * segurança enquanto estava fora: ao voltar, a tela confirma na hora.
   */
  useEffect(() => {
    if (step !== "qr" || doneRef.current) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Trava de concorrência que EXPIRA. Uma requisição iniciada pouco antes do
    // congelamento pode nunca resolver (a rede morre junto com a aba) — com
    // uma trava booleana simples ela ficaria travada pra sempre e a checagem
    // da volta nunca rodaria. Pego no teste do ciclo, não em produção.
    let rodandoDesde = 0;
    const TRAVA_MS = 10000;
    let ultima = 0;           // trava anti-rajada de troca de aba
    // asaas, abacate e pagarme confirmam E liberam no mesmo passo (check da
    // própria função); só a Cakto depende de webhook + check-subscription.
    const proprio = braco === "asaas" || braco === "abacate" || braco === "pagarme";
    const fnNome = braco === "asaas" ? "asaas-pix" : braco === "pagarme" ? "pagarme-pix" : "abacate-pix";
    const orderId = pix?.orderId;
    const poll = async () => {
      const agora = Date.now();
      if (stopped || doneRef.current) return;
      if (rodandoDesde && agora - rodandoDesde < TRAVA_MS) return;
      rodandoDesde = agora;
      ultima = agora;
      try {
        // offer: fallback de contabilidade pra cobranças antigas (o check da
        // AbacatePay não devolve valor); fbp/fbc: match da CAPI server-side.
        const cookie = (n: string) =>
          document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1) ?? null;
        const { data } = proprio
          ? await supabase.functions.invoke(fnNome, {
              body: {
                action: "check", id: orderId, offer,
                fbp: cookie("_fbp"), fbc: cookie("_fbc"),
                sourceUrl: window.location.href,
              },
            })
          : await supabase.functions.invoke("check-subscription");
        if (proprio ? data?.paid : data?.subscribed) {
          doneRef.current = true;
          trackEvent("pix_confirmed", { offer, context, gateway: braco });
          // Purchase (Meta+Google) via marca-única: dispara aqui OU no rescue
          // do app se a pessoa já tiver voltado paga. eventID = orderId dedup.
          firePixPurchaseOnce("checkout");
          setStep("confirmed");
          return;
        }
      } catch { /* tenta de novo */ }
      finally { rodandoDesde = 0; }
      if (!stopped && !doneRef.current) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(poll, 3000);
      }
    };

    // Voltou pra tela: checa AGORA. A corrente de timeout pode estar morta.
    const aoVoltar = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - ultima < 1500) return;   // não vira rajada
      void poll();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("pageshow", aoVoltar);   // volta do cache do navegador

    timer = setTimeout(poll, 3000);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.removeEventListener("pageshow", aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, offer, context, pix?.orderId, braco]);

  const copyCode = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
    } catch {
      // fallback webview: seleção manual
      const ta = document.createElement("textarea");
      ta.value = pix.qrCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setCopiadoJa(true);
    trackEvent("pix_copied", { offer, context });
    setTimeout(() => setCopied(false), 2500);
  };

  const enterApp = () => { window.location.href = "/"; };

  const mm = secondsLeft != null ? String(Math.floor(secondsLeft / 60)).padStart(2, "0") : null;
  const ss = secondsLeft != null ? String(secondsLeft % 60).padStart(2, "0") : null;

  return (
    <div className="fixed inset-0 z-[400] bg-background overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-8">
        {step !== "confirmed" && (
          <button
            onClick={() => { trackEvent("pix_checkout_close", { offer, context, step }); onClose(step); }}
            aria-label="Fechar"
            className="fixed top-3 right-3 z-10 grid place-items-center w-9 h-9 rounded-full bg-black/[0.06] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.div key="email" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="w-full max-w-sm">
              <div className="text-center mb-5">
                <h2 className="text-[24px] font-bold tracking-tight leading-tight">Pra onde mandamos<br />seu acesso?</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Só o e-mail. Sem senha, sem cadastro — isso fica pra depois de pagar.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent text-accent-foreground shrink-0">
                      <Zap className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-bold leading-tight">CORE completo</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">16 módulos · {OFERTA_VITALICIA[offer] ? "acesso vitalício" : "30 dias de acesso"}</div>
                    </div>
                  </div>
                  <div className="text-xl font-extrabold text-accent leading-none shrink-0">R$ {price}</div>
                </div>
              </div>

              <input
                type="email" inputMode="email" autoComplete="email" autoFocus
                value={emailCompra}
                onChange={(e) => { setEmailCompra(e.target.value); setEmailErr(null); if (contaExiste) setContaExiste(false); }}
                placeholder="seu@email.com"
                className="w-full h-12 rounded-xl border-2 border-border bg-background px-4 text-[16px] outline-none focus:border-accent transition-colors"
              />

              {/* Já tem conta: entra agora, ANTES de pagar — é seguro justamente
                  porque nenhum dinheiro se moveu ainda. */}
              {contaExiste && (
                <input
                  type="password" autoComplete="current-password"
                  value={senhaExistente}
                  onChange={(e) => { setSenhaExistente(e.target.value); setEmailErr(null); }}
                  placeholder="sua senha"
                  className="w-full h-12 rounded-xl border-2 border-border bg-background px-4 text-[16px] outline-none focus:border-accent transition-colors mt-2.5"
                />
              )}

              {emailErr && <p className="text-[12.5px] text-destructive mt-2 leading-snug">{emailErr}</p>}

              <Button
                size="lg" className="w-full h-12 text-base mt-3.5"
                disabled={emailIndo || !emailCompra.trim() || (contaExiste && senhaExistente.length < 6)}
                onClick={() => void seguirDoEmail()}
              >
                {emailIndo ? "Só um instante…" : contaExiste ? "Entrar e gerar o Pix" : "Gerar meu Pix"}
              </Button>

              {contaExiste && (
                <button
                  className="w-full text-center text-[12.5px] font-semibold text-muted-foreground underline underline-offset-2 mt-2.5"
                  onClick={() => { setContaExiste(false); setSenhaExistente(""); setEmailCompra(""); setEmailErr(null); }}
                >
                  Usar outro e-mail
                </button>
              )}

              <p className="text-[11px] text-muted-foreground text-center mt-3 leading-snug px-2">
                É pra onde vai seu acesso e seu recibo. Confere se tá certo.
              </p>
            </motion.div>
          )}

          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="w-full max-w-sm">
              <div className="text-center mb-5">
                <h2 className="text-[24px] font-bold tracking-tight leading-tight">Falta só o Pix.</h2>
                <p className="text-sm text-muted-foreground mt-1.5">Pagamento único — sem mensalidade, nunca.</p>
              </div>

              {/* Resumo do pedido estilo recibo — a pessoa vê O QUE está pagando.
                  No v2 o mascote espia por cima do recibo (a identidade do funil
                  não solta a mão na hora do dinheiro). */}
              <div className="relative" style={v2?.mascote ? { marginTop: 74 } : undefined}>
                {v2?.mascote && (
                  <div aria-hidden style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", zIndex: 1, pointerEvents: "none", lineHeight: 0 }}>
                    {v2.mascote}
                  </div>
                )}
              <div className="rounded-2xl border border-border bg-card p-4 mb-5 shadow-sm relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent text-accent-foreground shrink-0">
                      <Zap className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-bold leading-tight">CORE completo</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">16 módulos · {OFERTA_VITALICIA[offer] ? "acesso vitalício" : "30 dias de acesso"}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-extrabold text-accent leading-none">R$ {price}</div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2.5 border-t border-dashed border-border mt-3.5 pt-3 text-[11px] font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-accent" /> Pix na hora</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-accent" /> Garantia de 7 dias</span>
                </div>
              </div>
              </div>

              <div className="space-y-3">
                {/* UM CAMPO SÓ (21/07): com a Pagar.me o CPF virou obrigatório e
                    esta tela é a última porta antes do dinheiro — cada campo a
                    mais custa venda. O nome sai do cadastro (e o servidor tem
                    fallback), então some daqui. Autofocus abre o teclado
                    numérico sozinho: a pessoa já chega digitando. */}
                {!v2 && braco !== "pagarme" && (
                  <IconInput Icon={User} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                )}
                <IconInput
                  Icon={Fingerprint} inputMode="numeric" placeholder="CPF" autoFocus
                  value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))}
                  inputRef={cpfRef}
                />
                <p className="text-[11px] text-muted-foreground text-center leading-snug px-2">
                  🔒 O banco exige o CPF pra emitir o Pix — não usamos pra mais nada.
                </p>
                {errMsg && <p className="text-sm text-destructive text-center">{errMsg}</p>}
                <Button
                  size="lg" className="w-full h-[52px] text-base font-bold rounded-full"
                  disabled={v2 ? false : !cpfLooksValid(cpf)}
                  onClick={() => {
                    // v2: CTA sempre vivo — sem CPF válido, aponta o que falta
                    if (!cpfLooksValid(cpf)) {
                      setErrMsg("Só falta um CPF válido pra emitir o Pix 👆");
                      cpfRef.current?.focus();
                      return;
                    }
                    generate(name, cpf);
                  }}
                >
                  Gerar meu Pix de R$ {price}
                </Button>
                {v2 && (
                  <p className="text-[11.5px] text-muted-foreground text-center leading-snug px-2">
                    Não era pra você? Uma mensagem em até 7 dias e a gente devolve seus R$ {price}.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* 24/07: o create da Cakto leva 5-7s (medido; Asaas era ~2,3s) e o
              caminho com form mostrava um spinner cru esse tempo todo — o dono
              sentiu na pele. A preparação (recibo+checklist) vira a tela de
              espera de TODOS os caminhos: a latência real ganha narrativa. */}
          {step === "generating" && (
            <motion.div key="preparo" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="w-full max-w-sm">
              <div className="text-center mb-5">
                <h2 className="text-[24px] font-bold tracking-tight leading-tight">Preparando seu acesso…</h2>
                <p className="text-sm text-muted-foreground mt-1.5">Pagamento único — sem mensalidade, nunca.</p>
              </div>

              {/* Recibo: a pessoa VÊ o que está pagando enquanto o Pix real é
                  criado — a preparação é a latência do gateway, não enfeite. */}
              <div className="relative" style={v2?.mascote ? { marginTop: 74 } : undefined}>
                {v2?.mascote && (
                  <div aria-hidden style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", zIndex: 1, pointerEvents: "none", lineHeight: 0 }}>
                    {v2.mascote}
                  </div>
                )}
                <div className="rounded-2xl border border-border bg-card p-4 mb-5 shadow-sm relative">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-left">
                      <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent text-accent-foreground shrink-0">
                        <Zap className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="text-[13.5px] font-bold leading-tight">CORE completo</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">16 módulos · {OFERTA_VITALICIA[offer] ? "acesso vitalício" : "30 dias de acesso"}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-extrabold text-accent leading-none">R$ {price}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 border-t border-dashed border-border mt-3.5 pt-3 text-[11px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-accent" /> Pix na hora</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-accent" /> Garantia de 7 dias</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-1">
                {PREPARO_LINHAS.map((txt, i) => (
                  <motion.div
                    key={txt}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.28 }}
                    className="flex items-center gap-2.5"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.35 + i * 0.28, type: "spring", stiffness: 300, damping: 18 }}
                      className="grid place-items-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0"
                    >
                      <Check className="w-3 h-3" strokeWidth={3.5} />
                    </motion.span>
                    <span className="text-[13.5px] font-medium">{txt}…</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "qr" && pix && (
            <motion.div key="qr" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm text-center">
              {copiadoJa ? (
                <>
                  {/* ESTADO COPIADO — permanente. Quem foi pro banco e voltou
                      precisa ver que a ação valeu, não a tela de antes. */}
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 grid place-items-center mx-auto mb-3"
                  >
                    <Check className="w-6 h-6" strokeWidth={3} />
                  </motion.div>
                  <h2 className="text-[22px] font-bold tracking-tight mb-1">Código copiado!</h2>
                  <p className="text-[13px] text-muted-foreground mb-4">Agora é só colar no app do seu banco:</p>
                  <div className="text-left bg-muted/40 rounded-xl p-4 text-[14px] space-y-2.5 mb-4">
                    <p><strong className="text-foreground">1.</strong> Abra o app do seu <strong className="text-foreground">banco</strong></p>
                    <p><strong className="text-foreground">2.</strong> Vá em <strong className="text-foreground">Pix → Copia e Cola</strong> e cole o código</p>
                    <p><strong className="text-foreground">3.</strong> Confirme <strong className="text-foreground">R$ {fmtBRL(pix.amount)}</strong> e volte aqui — libera na hora ✨</p>
                  </div>
                  {/* REDE DE SEGURANÇA (5453698, 30/07): esconder o QR criou um
                      buraco — se o clipboard falhar em silêncio a pessoa fica
                      SEM nada pra colar, e 78% do tráfego chega pelo navegador
                      do Instagram, onde a API de clipboard é a mais furada.
                      Código em texto selecionável é o plano B que sempre
                      funciona. */}
                  <div className="text-left mb-4">
                    <p className="text-[11.5px] text-muted-foreground mb-1.5">Não colou? Segura no código e copia na mão:</p>
                    <p
                      className="select-all break-all font-mono text-[10.5px] leading-snug bg-muted/60 border border-border rounded-lg p-2.5 text-foreground/80"
                      onCopy={() => trackEvent("pix_copied", { offer, context, via: "selecao" })}
                    >
                      {pix.qrCode}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* HIERARQUIA INVERTIDA — o botão é o dinheiro (75% de
                      conversão em quem copia); o QR serve ~5% e vira opção. */}
                  <h2 className="text-[22px] font-bold tracking-tight mb-1">Pague R$ {fmtBRL(pix.amount)} no Pix</h2>
                  <p className="text-[13px] text-muted-foreground mb-4">
                    Copia o código, cola no app do banco e o acesso libera <strong className="text-foreground">sozinho nesta tela</strong>.
                  </p>
                </>
              )}

              <Button
                size="lg"
                variant={copiadoJa ? "outline" : "default"}
                className={`w-full ${copiadoJa ? "h-11 text-sm" : "h-[52px] text-base"} font-bold rounded-full mb-2`}
                onClick={copyCode}
              >
                {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> {copiadoJa ? "Copiar de novo" : "Copiar código Pix"}</>}
              </Button>

              {/* QR primeiro (02/09): o e-mail entra AQUI, depois do código, sem barrar nada. */}
              {pedirEmailNoQr && !emailSalvo && (
                <div className="text-left rounded-xl border border-border bg-card p-3 mb-3">
                  <p className="text-[12.5px] font-bold leading-tight">Pra onde mandamos seu acesso?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Só o e-mail. Se fechar a aba depois de pagar, é por ele que você entra.</p>
                  <input
                    type="email" inputMode="email" autoComplete="email"
                    value={emailCompra}
                    onChange={(e) => { setEmailCompra(e.target.value); setEmailErr(null); if (contaExiste) setContaExiste(false); }}
                    placeholder="seu@email.com"
                    className="w-full h-11 rounded-xl border-2 border-border bg-background px-3 text-[15px] outline-none focus:border-accent transition-colors"
                  />
                  {contaExiste && (
                    <input
                      type="password" autoComplete="current-password"
                      value={senhaExistente}
                      onChange={(e) => { setSenhaExistente(e.target.value); setEmailErr(null); }}
                      placeholder="sua senha"
                      className="w-full h-11 rounded-xl border-2 border-border bg-background px-3 text-[15px] outline-none focus:border-accent transition-colors mt-2"
                    />
                  )}
                  {emailErr && <p className="text-[12px] text-destructive mt-1.5 leading-snug">{emailErr}</p>}
                  <Button
                    size="sm" variant="outline" className="w-full h-10 mt-2 font-semibold"
                    disabled={emailIndo || !emailCompra.trim() || (contaExiste && senhaExistente.length < 6)}
                    onClick={() => void salvarEmailNoQr()}
                  >
                    {emailIndo ? "Salvando…" : contaExiste ? "Entrar e passar o Pix pra minha conta" : "Salvar e-mail"}
                  </Button>
                </div>
              )}
              {pedirEmailNoQr && emailSalvo && (
                <p className="text-[12px] text-muted-foreground mb-3">
                  Acesso vai pra <strong className="text-foreground">{emailCompra.trim().toLowerCase()}</strong>.
                </p>
              )}

              {!copiadoJa && (
                <div className="text-left bg-muted/40 rounded-xl p-3 text-[12px] text-muted-foreground space-y-1 mb-3">
                  <p><strong className="text-foreground">1.</strong> Abra o app do seu banco</p>
                  <p><strong className="text-foreground">2.</strong> Escolha <strong className="text-foreground">Pix → Copia e Cola</strong> e cole o código</p>
                  <p><strong className="text-foreground">3.</strong> Confirme e volte aqui — libera na hora ✨</p>
                </div>
              )}

              {mostrarQR ? (
                <div className="bg-white rounded-2xl border border-border p-4 mx-auto w-fit mb-3 shadow-sm">
                  {pix.qrCodeBase64 ? (
                    <img src={pix.qrCodeBase64} alt="QR Code Pix" className="w-[170px] h-[170px]" />
                  ) : (
                    <QRCodeSVG value={pix.qrCode} size={170} />
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setMostrarQR(true); trackEvent("pix_qr_reveal", { offer, context }); }}
                  className="block mx-auto text-[12.5px] font-semibold text-muted-foreground underline underline-offset-2 mb-3"
                >
                  {copiadoJa ? "Pagar de outro celular? Mostrar QR code" : "Prefiro escanear o QR code"}
                </button>
              )}

              {mm != null && (
                <div className="block mx-auto w-fit text-[12px] font-bold tabular-nums text-accent bg-accent/10 rounded-full px-3 py-1 mb-3">
                  ⏳ Código expira em {mm}:{ss}
                </div>
              )}

              <p className="text-[12px] font-semibold text-muted-foreground inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Aguardando seu pagamento…
              </p>
              {/* Mata o medo do pós-pagamento ("e se eu fechar essa tela?").
                  Promessa VERDADEIRA: o webhook manda o welcome email com link
                  de acesso em toda venda.

                  MAS SÓ QUANDO EXISTE E-MAIL. Numa sessão ANÔNIMA (a pessoa
                  ainda não criou conta — 01/09, compra antes do cadastro) não
                  há endereço nenhum: `asaas-pix` só dispara o welcome se
                  `user.email` existe. Prometer e-mail ali seria mentira, e
                  "pode fechar sem medo" seria pior que mentira — o acesso mora
                  no token DESTE navegador até a conta ser batizada. Então o
                  texto vira o contrário: fica aqui, que é rapidinho. */}
              {anonima ? (
                <p className="text-[11.5px] text-muted-foreground mt-2 leading-snug px-3">
                  📩 Pagou? Seu acesso vai pra <strong className="text-foreground">{emailCompra}</strong> —
                  pode fechar esta tela sem medo.
                </p>
              ) : (
                <p className="text-[11.5px] text-muted-foreground mt-2 leading-snug px-3">
                  📩 Pagou? Além de liberar aqui na hora, seu acesso e o passo a passo
                  também chegam <strong className="text-foreground">no seu e-mail</strong> —
                  pode fechar esta tela sem medo.
                </p>
              )}
              {v2?.missao && (
                <p className="text-[12px] text-muted-foreground mt-2">
                  🎯 Te esperando lá dentro: <strong className="text-foreground">{v2.missao.toLowerCase()}</strong>
                </p>
              )}
              {SEM_FORM && (
                <p className="text-[11.5px] text-muted-foreground mt-2 leading-snug">
                  🔒 Garantia de 7 dias — não era pra você? A gente devolve seus R$ {fmtBRL(pix.amount)}.
                </p>
              )}
            </motion.div>
          )}

          {step === "confirmed" && (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 13, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 grid place-items-center mx-auto mb-6"
              >
                <Check className="w-10 h-10" strokeWidth={3} />
              </motion.div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Pagamento confirmado 🎉</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
                O CORE agora é <strong className="text-foreground">seu pra sempre</strong> — todos os módulos,
                sem mensalidade, nunca.
              </p>
              <Button
                size="lg" className="w-full h-[52px] text-base font-bold rounded-full"
                onClick={v2?.onConfirmado ?? enterApp}
              >
                {v2?.onConfirmado ? "Ativar minha central →" : "Entrar no meu app"}
              </Button>
            </motion.div>
          )}

          {(step === "expired" || step === "error") && (
            <motion.div key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm text-center">
              <h2 className="text-xl font-bold tracking-tight mb-2">
                {step === "expired" ? "O código expirou" : "Deu ruim ao gerar o Pix"}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {step === "expired"
                  ? "Sem problema — gera outro em 1 toque, o preço é o mesmo."
                  : errMsg ?? "Tenta de novo em alguns segundos."}
              </p>
              {semSessao ? (
                <Button size="lg" className="w-full h-12 rounded-full font-bold" onClick={() => { window.location.href = "/entrar"; }}>
                  Entrar de novo
                </Button>
              ) : (
                <Button size="lg" className="w-full h-12 rounded-full font-bold" onClick={() => generate(name, cpf)}>
                  Gerar novo código Pix
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
