import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, Pause, MessageCircle, Wrench, Clock } from "lucide-react";

type Step = "reason" | "offer" | "support" | "done";
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

const OFFER_HEADERS: Record<Reason, { title: string; description: string }> = {
  not_using: {
    title: "💡 Que tal um empurrãozinho?",
    description:
      "A maioria de quem usa por 7 dias seguidos vê resultado. Antes de ir, dá uma olhada no que reservei pra você:",
  },
  missing_feature: {
    title: "🧩 Anotado! Mas antes de ir...",
    description:
      "Se cancelar, perde o histórico. Tenho uma oferta pra você continuar enquanto esse recurso não chega:",
  },
  technical_issue: {
    title: "🐞 Vamos resolver isso",
    description:
      "Me conta o que aconteceu que eu olho pessoalmente. E pra compensar o trampo, olha essa oferta:",
  },
  too_expensive: {
    title: "Entendi 💛 Tenho uma oferta pra você",
    description: "Sei que aperta. Olha o que consigo fazer pra você continuar:",
  },
  other: {
    title: "Entendi 💛 Antes de cancelar...",
    description: "Tenho uma oferta especial pra você considerar:",
  },
};

export function CancelFlowDialog({ open, onOpenChange, onCanceled }: CancelFlowDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("reason");
  const [loading, setLoading] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [canUseDiscount, setCanUseDiscount] = useState(true);
  const [canUsePause, setCanUsePause] = useState(true);
  const [canUseExtension, setCanUseExtension] = useState(true);
  const [accessUntil, setAccessUntil] = useState<string | null>(null);
  const [pauseMonths, setPauseMonths] = useState(1);
  const [supportMessage, setSupportMessage] = useState("");

  const reset = () => {
    setStep("reason");
    setLoading(false);
    setAttemptId(null);
    setReason(null);
    setReasonDetail("");
    setAccessUntil(null);
    setPauseMonths(1);
    setSupportMessage("");
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

  const ensureAttempt = async () => {
    if (attemptId) return attemptId;
    setLoading(true);
    try {
      const data = await invoke({ action: "open" });
      setAttemptId(data.attemptId);
      setCanUseDiscount(!!data.canUseDiscount);
      setCanUsePause(!!data.canUsePause);
      setCanUseExtension(!!data.canUseExtension);
      return data.attemptId as string;
    } finally {
      setLoading(false);
    }
  };

  const handleReasonNext = async () => {
    setLoading(true);
    try {
      const id = await ensureAttempt();
      // Motivo é OPCIONAL: forçar a escolha só suja o dado (a pessoa marca
      // qualquer coisa pra sair). Sem motivo, segue direto pra oferta.
      if (reason) {
        await invoke({
          action: "log_reason",
          attemptId: id,
          reason,
          reasonDetail: reasonDetail || undefined,
        });
      }
      setStep("offer");
    } catch (e) {
      toast({ title: "Erro", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Log which offers were shown the moment the offer screen appears
  useEffect(() => {
    if (step !== "offer" || !attemptId || !reason) return;
    const offers: string[] = [];
    if (canUseDiscount) offers.push("discount");
    if (canUsePause) offers.push("pause");
    if (reason === "not_using" && canUseExtension) offers.push("extend_7d");
    if (reason === "missing_feature") offers.push("feature_waitlist");
    if (reason === "technical_issue") offers.push("support_ticket");
    invoke({ action: "log_offers_shown", attemptId, offers }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, attemptId, reason]);

  const handleApplyDiscount = async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      await invoke({ action: "apply_discount", attemptId });
      toast({
        title: "🎉 Desconto aplicado!",
        description: "50% off nas próximas 3 cobranças. Bem-vindo de volta!",
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

  const handleExtend = async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const data = await invoke({ action: "extend_trial", attemptId });
      const endDate = new Date(data.newEnd).toLocaleDateString("pt-BR");
      toast({
        title: "🎁 +7 dias liberados!",
        description: `Seu acesso vai até ${endDate}. Aproveita pra testar de verdade!`,
      });
      handleOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Não foi possível liberar",
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
        title: "Anotado! 💛",
        description: "Esse recurso já tá na nossa lista de prioridades — vou correr pra entregar e te aviso assim que sair.",
      });
      handleOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSupport = async () => {
    if (!attemptId || supportMessage.trim().length < 3) return;
    setLoading(true);
    try {
      await invoke({
        action: "submit_support_ticket",
        attemptId,
        message: supportMessage.trim(),
      });
      toast({
        title: "Recebi! 💛",
        description: "Já tô olhando seu caso pessoalmente. Te respondo em até 24h.",
      });
      handleOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Não foi possível enviar",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
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

  if (open && !attemptId && !loading) {
    void ensureAttempt();
  }

  const offerHeader = reason ? OFFER_HEADERS[reason] : OFFER_HEADERS.other;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {/* ============ STEP 1: REASON ============ */}
        {step === "reason" && (
          <>
            <DialogHeader>
              <DialogTitle>Antes de você ir...</DialogTitle>
              <DialogDescription>
                Se quiser, me conta o motivo — ajuda a melhorar o app. Mas é opcional.
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
              <Button onClick={handleReasonNext} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continuar
              </Button>
            </div>
          </>
        )}

        {/* ============ STEP 2: OFFER ============ */}
        {step === "offer" && (
          <>
            <DialogHeader>
              <DialogTitle>{offerHeader.title}</DialogTitle>
              <DialogDescription>{offerHeader.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Contextual side action for missing_feature */}
              {reason === "missing_feature" && (
                <Button
                  className="w-full justify-start gap-3 h-auto py-2.5"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveFeedback}
                  disabled={loading}
                >
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="text-left text-xs">Quero ser avisado quando lançar</span>
                </Button>
              )}
              {reason === "technical_issue" && (
                <Button
                  className="w-full justify-start gap-3 h-auto py-2.5"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("support")}
                >
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-left text-xs">Falar com o suporte</span>
                </Button>
              )}

              {/* +7 dias grátis — só pra "não tô usando" */}
              {reason === "not_using" && (
                <div
                  className={`rounded-xl border-2 p-4 space-y-3 ${
                    canUseExtension ? "border-primary bg-primary/5" : "border-border bg-muted/30 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Clock className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-base">+7 dias grátis pra testar de verdade</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Estendo seu acesso por 7 dias sem cobrar. Aproveita pra criar o hábito.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!canUseExtension || loading}
                    onClick={handleExtend}
                  >
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {canUseExtension ? "Quero meus 7 dias" : "Já usado este ano"}
                  </Button>
                </div>
              )}

              {/* Discount card — primary */}
              <div
                className={`rounded-xl border-2 p-4 space-y-3 ${
                  canUseDiscount ? "border-primary bg-primary/5" : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Gift className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-base">50% off por 3 meses</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Continue com tudo liberado pagando metade do preço nas próximas 3 cobranças.
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

              {/* Pause card — secondary */}
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
              <Button variant="ghost" size="sm" onClick={() => setStep("reason")}>
                ← Voltar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleConfirmCancel}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cancelar mesmo assim
              </Button>
            </div>
          </>
        )}

        {/* ============ STEP: SUPPORT TICKET ============ */}
        {step === "support" && (
          <>
            <DialogHeader>
              <DialogTitle>Me conta o que aconteceu</DialogTitle>
              <DialogDescription>
                Descreve o problema com o máximo de detalhes que conseguir. Eu vejo pessoalmente e te respondo em até 24h.
              </DialogDescription>
            </DialogHeader>

            <Textarea
              placeholder="Ex: tentei salvar uma despesa e o app travou..."
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value.slice(0, 4000))}
              maxLength={4000}
              rows={6}
              autoFocus
            />

            <div className="flex justify-between pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setStep("offer")}>
                ← Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitSupport}
                disabled={loading || supportMessage.trim().length < 3}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar pro suporte
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
