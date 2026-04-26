import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, Pause, Heart, Wrench, MessageCircle, AlertTriangle } from "lucide-react";

type Step = "reason" | "segmented" | "offers" | "confirm" | "done";
type Reason = "too_expensive" | "not_using" | "missing_feature" | "technical_issue" | "other";

interface CancelFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCanceled?: () => void;
}

const REASONS: { value: Reason; label: string; emoji: string }[] = [
  { value: "too_expensive", label: "Tá caro pra mim agora", emoji: "💸" },
  { value: "not_using", label: "Não tô usando o suficiente", emoji: "😴" },
  { value: "missing_feature", label: "Faltou algum recurso", emoji: "🧩" },
  { value: "technical_issue", label: "Tive problema técnico", emoji: "🐞" },
  { value: "other", label: "Outro motivo", emoji: "💬" },
];

export function CancelFlowDialog({ open, onOpenChange, onCanceled }: CancelFlowDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("reason");
  const [loading, setLoading] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [canUseDiscount, setCanUseDiscount] = useState(true);
  const [canUsePause, setCanUsePause] = useState(true);
  const [accessUntil, setAccessUntil] = useState<string | null>(null);
  const [pauseMonths, setPauseMonths] = useState(1);

  const reset = () => {
    setStep("reason");
    setLoading(false);
    setAttemptId(null);
    setReason(null);
    setReasonDetail("");
    setAccessUntil(null);
    setPauseMonths(1);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("cancel-subscription-flow", { body });
    if (error) throw error;
    return data as any;
  };

  // Open attempt when dialog opens for the first time
  const ensureAttempt = async () => {
    if (attemptId) return attemptId;
    setLoading(true);
    try {
      const data = await invoke({ action: "open" });
      setAttemptId(data.attemptId);
      setCanUseDiscount(!!data.canUseDiscount);
      setCanUsePause(!!data.canUsePause);
      return data.attemptId as string;
    } finally {
      setLoading(false);
    }
  };

  const handleReasonNext = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      const id = await ensureAttempt();
      await invoke({
        action: "log_reason",
        attemptId: id,
        reason,
        reasonDetail: reasonDetail || undefined,
      });
      setStep("segmented");
    } catch (e) {
      toast({ title: "Erro", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      await invoke({ action: "apply_discount", attemptId });
      toast({
        title: "🎉 Desconto aplicado!",
        description: "50% off nas próximas 2 cobranças. Bem-vindo de volta!",
      });
      handleOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Não foi possível aplicar",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const data = await invoke({ action: "pause_subscription", attemptId, months: pauseMonths });
      const endDate = new Date(data.newEnd).toLocaleDateString("pt-BR");
      toast({
        title: "⏸ Assinatura pausada",
        description: `Sem cobranças até ${endDate}. Seus dados ficam salvos.`,
      });
      handleOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Não foi possível pausar",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      await invoke({ action: "save_feedback", attemptId });
      toast({
        title: "Recebido! 💛",
        description: "Vou te avisar assim que esse recurso estiver pronto.",
      });
      handleOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const data = await invoke({ action: "confirm_cancel", attemptId });
      setAccessUntil(data.accessUntil);
      setStep("done");
      onCanceled?.();
    } catch (e: any) {
      toast({
        title: "Erro ao cancelar",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open attempt as soon as the dialog mounts
  if (open && !attemptId && !loading) {
    void ensureAttempt();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {/* ============ STEP 1: REASON ============ */}
        {step === "reason" && (
          <>
            <DialogHeader>
              <DialogTitle>Antes de você ir...</DialogTitle>
              <DialogDescription>
                Pode me contar o motivo? Isso me ajuda a melhorar o app pra você.
              </DialogDescription>
            </DialogHeader>

            <RadioGroup value={reason ?? ""} onValueChange={(v) => setReason(v as Reason)} className="space-y-2">
              {REASONS.map((r) => (
                <Label
                  key={r.value}
                  htmlFor={r.value}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value={r.value} id={r.value} />
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-sm font-medium">{r.label}</span>
                </Label>
              ))}
            </RadioGroup>

            {(reason === "missing_feature" || reason === "other") && (
              <Textarea
                placeholder="Conta um pouco mais (opcional)..."
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value.slice(0, 2000))}
                maxLength={2000}
                rows={3}
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Voltar
              </Button>
              <Button onClick={handleReasonNext} disabled={!reason || loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continuar
              </Button>
            </div>
          </>
        )}

        {/* ============ STEP 2: SEGMENTED RESPONSE ============ */}
        {step === "segmented" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {reason === "not_using" && "💡 Que tal um empurrãozinho?"}
                {reason === "missing_feature" && "🧩 Anotado!"}
                {reason === "technical_issue" && "🐞 Vamos resolver isso"}
                {(reason === "too_expensive" || reason === "other") && "Entendi 💛"}
              </DialogTitle>
              <DialogDescription>
                {reason === "not_using" &&
                  "A maioria de quem usa por 7 dias seguidos vê resultado. Quer que eu te mostre por onde começar agora?"}
                {reason === "missing_feature" &&
                  "Se você cancelar, perde o histórico. Posso te avisar quando esse recurso chegar — quer ficar na minha lista?"}
                {reason === "technical_issue" &&
                  "Manda detalhes pro suporte que a gente resolve rápido — sem perder sua assinatura."}
                {(reason === "too_expensive" || reason === "other") &&
                  "Tenho duas opções pra te oferecer antes de cancelar."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {reason === "not_using" && (
                <Button
                  className="w-full justify-start gap-3 h-auto py-3"
                  variant="outline"
                  onClick={() => {
                    handleSaveFeedback();
                  }}
                >
                  <Heart className="h-5 w-5 text-primary" />
                  <span className="text-left">Quero tentar mais uma semana</span>
                </Button>
              )}
              {reason === "missing_feature" && (
                <Button
                  className="w-full justify-start gap-3 h-auto py-3"
                  variant="outline"
                  onClick={handleSaveFeedback}
                >
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <span className="text-left">Sim, quero ser avisado quando lançar</span>
                </Button>
              )}
              {reason === "technical_issue" && (
                <Button
                  className="w-full justify-start gap-3 h-auto py-3"
                  variant="outline"
                  asChild
                >
                  <a href="mailto:suporte@coreaplicativo.com" onClick={handleSaveFeedback}>
                    <Wrench className="h-5 w-5 text-primary" />
                    <span className="text-left">Falar com o suporte</span>
                  </a>
                </Button>
              )}
            </div>

            <div className="flex gap-2 justify-between pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setStep("reason")}>
                ← Voltar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStep("offers")}>
                Ver ofertas →
              </Button>
            </div>
          </>
        )}

        {/* ============ STEP 3: OFFERS ============ */}
        {step === "offers" && (
          <>
            <DialogHeader>
              <DialogTitle>Tenho duas ofertas pra você 🎁</DialogTitle>
              <DialogDescription>
                Escolha a que faz mais sentido — só pode usar uma por ano.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Discount card */}
              <div
                className={`rounded-xl border-2 p-4 space-y-3 ${
                  canUseDiscount ? "border-primary bg-primary/5" : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Gift className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-base">50% off por 2 meses</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Continue com tudo liberado pagando metade do preço nas próximas 2 cobranças.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={!canUseDiscount || loading}
                  onClick={handleApplyDiscount}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {canUseDiscount ? "Aceitar desconto" : "Já usado este ano"}
                </Button>
              </div>

              {/* Pause card */}
              <div
                className={`rounded-xl border-2 p-4 space-y-3 ${
                  canUsePause ? "border-border" : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Pause className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-base">Pausar a assinatura</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sem cobranças no período. Seus dados ficam salvos e tudo volta automaticamente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPauseMonths(m)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        pauseMonths === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                      disabled={!canUsePause}
                    >
                      {m} {m === 1 ? "mês" : "meses"}
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  variant="outline"
                  disabled={!canUsePause || loading}
                  onClick={handlePause}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {canUsePause ? `Pausar por ${pauseMonths} ${pauseMonths === 1 ? "mês" : "meses"}` : "Já usado este ano"}
                </Button>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setStep("segmented")}>
                ← Voltar
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setStep("confirm")}>
                Cancelar mesmo assim
              </Button>
            </div>
          </>
        )}

        {/* ============ STEP 4: CONFIRM ============ */}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Tem certeza?
              </DialogTitle>
              <DialogDescription>
                Você ainda terá acesso até o fim do período já pago. Depois disso, seus dados ficam guardados por 30 dias caso queira voltar.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p>• Sem mais cobranças após o cancelamento</p>
              <p>• Acesso liberado até o fim do ciclo atual</p>
              <p>• Você pode reativar a qualquer momento</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStep("offers")}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleConfirmCancel} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar cancelamento
              </Button>
            </div>
          </>
        )}

        {/* ============ DONE ============ */}
        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Cancelamento confirmado</DialogTitle>
              <DialogDescription>
                {accessUntil
                  ? `Sua assinatura fica ativa até ${new Date(accessUntil).toLocaleDateString("pt-BR")}.`
                  : "Sua assinatura foi cancelada."}{" "}
                Vamos sentir sua falta — volte quando quiser. 💛
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
