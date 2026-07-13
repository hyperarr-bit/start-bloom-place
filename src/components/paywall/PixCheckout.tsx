import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, ShieldCheck, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { firePurchaseConversion } from "@/lib/google-ads";

/**
 * Checkout Pix DENTRO do app (13/07). Substitui o redirect pro checkout
 * hospedado da Cakto — dias 12-13 tiveram ~25 cliques no anual e 0 vendas
 * lá dentro, sem visibilidade nenhuma. Aqui cada passo vira evento:
 * pix_checkout_open → pix_generated → pix_copied → pix_confirmed/expired.
 *
 * Fluxo: [dados que faltam: WhatsApp obrigatório na API] → QR + copia-e-cola
 * → polling do check-subscription a cada 3s → celebração vitalícia.
 */

export type PixOffer = "lifetime" | "downsell";

export const PIX_PRICES: Record<PixOffer, string> = {
  lifetime: "27,90",
  downsell: "14,90",
};

interface Props {
  offer: PixOffer;
  onClose: () => void;
  context: "funnel" | "app";
}

type Step = "form" | "generating" | "qr" | "confirmed" | "expired" | "error";

const phoneLooksValid = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 || (d.startsWith("55") && (d.length === 12 || d.length === 13));
};

export function PixCheckout({ offer, onClose, context }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qrCode: string; qrCodeBase64: string | null; amount: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const doneRef = useRef(false);
  const price = PIX_PRICES[offer];

  // Prefill nome/telefone do profile — se já tem telefone, pula o form
  useEffect(() => {
    trackEvent("pix_checkout_open", { offer, context });
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("display_name, phone").eq("id", uid).maybeSingle();
      if (p?.display_name) setName(p.display_name);
      if (p?.phone && phoneLooksValid(p.phone)) {
        setPhone(p.phone);
        generate(p.display_name ?? "", p.phone, "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async (nm: string, ph: string, doc: string) => {
    setStep("generating");
    setErrMsg(null);
    try {
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

      const { data, error } = await supabase.functions.invoke("cakto-pix", {
        body: {
          offer,
          customer: { name: nm || undefined, phone: ph, docNumber: doc || undefined },
          fingerprint,
          antifraudRef,
          attribution: getAttributionParams(),
        },
      });
      if (error) throw error;
      if (data?.error === "phone_required") { setStep("form"); setErrMsg("Confere o WhatsApp — precisa do DDD."); return; }
      if (data?.error || !data?.qrCode) throw new Error(data?.error || "Sem QR na resposta");
      setPix({ qrCode: data.qrCode, qrCodeBase64: data.qrCodeBase64, amount: data.amount ?? price, expiresAt: data.expiresAt });
      setStep("qr");
      trackEvent("pix_generated", { offer, context, order_id: data.orderId });
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

  // Polling: pagou? (webhook grava a assinatura; a gente só pergunta)
  useEffect(() => {
    if (step !== "qr" || doneRef.current) return;
    let stopped = false;
    const poll = async () => {
      if (stopped || doneRef.current) return;
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.subscribed) {
          doneRef.current = true;
          trackEvent("pix_confirmed", { offer, context });
          firePurchaseConversion({ billingPeriod: "lifetime", transactionId: undefined });
          setStep("confirmed");
          return;
        }
      } catch { /* tenta de novo */ }
      if (!stopped) setTimeout(poll, 3000);
    };
    const t = setTimeout(poll, 3000);
    return () => { stopped = true; clearTimeout(t); };
  }, [step, offer, context]);

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
            onClick={() => { trackEvent("pix_checkout_close", { offer, context, step }); onClose(); }}
            aria-label="Fechar"
            className="fixed top-3 right-3 z-10 grid place-items-center w-9 h-9 rounded-full bg-black/[0.06] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="w-full max-w-sm">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold mb-3">
                  <Zap className="w-3.5 h-3.5" /> ACESSO VITALÍCIO · R$ {price}
                </div>
                <h2 className="text-[24px] font-bold tracking-tight leading-tight">Falta só o Pix.</h2>
                <p className="text-sm text-muted-foreground mt-1.5">Pagamento único — sem mensalidade, nunca.</p>
              </div>
              <div className="space-y-3">
                <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
                <div>
                  <Input
                    type="tel" inputMode="tel" placeholder="WhatsApp com DDD (ex: 11 91234-5678)"
                    value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className="h-12"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1 ml-1">
                    O banco usa pra emitir seu Pix — por isso é obrigatório.
                  </p>
                </div>
                <Input
                  inputMode="numeric" placeholder="CPF (opcional)"
                  value={cpf} onChange={(e) => setCpf(e.target.value)} className="h-12"
                />
                {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
                <Button
                  size="lg" className="w-full h-[52px] text-base font-bold rounded-full"
                  disabled={!phoneLooksValid(phone)}
                  onClick={() => generate(name, phone, cpf)}
                >
                  Gerar meu Pix de R$ {price}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center inline-flex items-center gap-1.5 w-full justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" /> Garantia de 7 dias · devolvemos 100%
                </p>
              </div>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Gerando seu Pix…</p>
            </motion.div>
          )}

          {step === "qr" && pix && (
            <motion.div key="qr" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm text-center">
              <h2 className="text-[22px] font-bold tracking-tight mb-1">Pague R$ {pix.amount} no Pix</h2>
              <p className="text-[13px] text-muted-foreground mb-4">
                Assim que o Pix cair, seu acesso libera <strong className="text-foreground">sozinho nesta tela</strong>.
              </p>

              <div className="bg-white rounded-2xl border border-border p-4 mx-auto w-fit mb-3 shadow-sm">
                {pix.qrCodeBase64 ? (
                  <img src={pix.qrCodeBase64} alt="QR Code Pix" className="w-[190px] h-[190px]" />
                ) : (
                  <QRCodeSVG value={pix.qrCode} size={190} />
                )}
              </div>

              {mm != null && (
                <div className="inline-flex items-center gap-1.5 text-[12px] font-bold tabular-nums text-accent bg-accent/10 rounded-full px-3 py-1 mb-3">
                  ⏳ Código expira em {mm}:{ss}
                </div>
              )}

              <Button size="lg" className="w-full h-[52px] text-base font-bold rounded-full mb-2" onClick={copyCode}>
                {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código Pix</>}
              </Button>

              <div className="text-left bg-muted/40 rounded-xl p-3 text-[12px] text-muted-foreground space-y-1 mb-3">
                <p><strong className="text-foreground">1.</strong> Abra o app do seu banco</p>
                <p><strong className="text-foreground">2.</strong> Escolha <strong className="text-foreground">Pix → Copia e Cola</strong> e cole o código</p>
                <p><strong className="text-foreground">3.</strong> Confirme e volte aqui — libera na hora ✨</p>
              </div>

              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Aguardando seu pagamento…
              </p>
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
              <Button size="lg" className="w-full h-[52px] text-base font-bold rounded-full" onClick={enterApp}>
                Entrar no meu app
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
              <Button size="lg" className="w-full h-12 rounded-full font-bold" onClick={() => generate(name, phone, cpf)}>
                Gerar novo código Pix
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
