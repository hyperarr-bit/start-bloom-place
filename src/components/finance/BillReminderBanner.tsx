import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRing, AlertTriangle, ChevronDown, ChevronUp, Calendar, Clock, CalendarDays } from "lucide-react";
import { useBillReminders, UpcomingBill } from "@/hooks/use-bill-reminders";
import { Button } from "@/components/ui/button";

export const BillReminderBanner = () => {
  const { getAllMonthBills, requestNotificationPermission, notificationSupported, notificationPermission } = useBillReminders();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [permAsked, setPermAsked] = useState(false);

  const bills = useMemo(() => getAllMonthBills(), [getAllMonthBills]);

  if (dismissed || bills.length === 0) return null;

  const overdue = bills.filter((b) => b.isPastDue);
  const today = bills.filter((b) => b.daysUntil === 0);
  const soon = bills.filter((b) => b.daysUntil > 0 && b.daysUntil <= 3);
  const later = bills.filter((b) => b.daysUntil > 3);

  const hasOverdue = overdue.length > 0;
  const hasToday = today.length > 0;
  const hasSoon = soon.length > 0;

  // Determine urgency level for banner styling
  const urgency = hasOverdue ? "overdue" : hasToday ? "today" : hasSoon ? "soon" : "calm";

  const bannerStyles: Record<string, string> = {
    overdue: "border-destructive/30 bg-destructive/5",
    today: "border-amber-500/30 bg-amber-500/5",
    soon: "border-primary/30 bg-primary/5",
    calm: "border-border bg-card",
  };

  const iconStyles: Record<string, string> = {
    overdue: "bg-destructive/15 text-destructive",
    today: "bg-amber-500/15 text-amber-500",
    soon: "bg-primary/15 text-primary",
    calm: "bg-muted text-muted-foreground",
  };

  const getDaysLabel = (b: UpcomingBill) => {
    if (b.isPastDue) return `${Math.abs(b.daysUntil)} dia${Math.abs(b.daysUntil) > 1 ? "s" : ""} atrás`;
    if (b.daysUntil === 0) return "Hoje";
    if (b.daysUntil === 1) return "Amanhã";
    return `Em ${b.daysUntil} dias`;
  };

  const getSummaryText = () => {
    if (hasOverdue) return `${overdue.length} conta${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}`;
    if (hasToday) return `${today.length} conta${today.length > 1 ? "s" : ""} vence${today.length > 1 ? "m" : ""} hoje`;
    if (hasSoon) return `${soon.length} conta${soon.length > 1 ? "s" : ""} nos próximos dias`;
    return `${later.length} conta${later.length > 1 ? "s" : ""} pendente${later.length > 1 ? "s" : ""} este mês`;
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermAsked(true);
    if (granted) {
      try {
        new Notification("Notificações ativadas!", {
          body: "Você receberá lembretes quando contas estiverem próximas do vencimento.",
          icon: "/favicon.ico",
        });
      } catch {}
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${bannerStyles[urgency]} overflow-hidden`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3.5 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconStyles[urgency]}`}>
          {hasOverdue ? (
            <AlertTriangle className="w-4 h-4" />
          ) : hasToday || hasSoon ? (
            <BellRing className="w-4 h-4" />
          ) : (
            <CalendarDays className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{getSummaryText()}</p>
          <p className="text-xs text-muted-foreground truncate">
            {bills.slice(0, 2).map((b) => b.name).join(", ")}
            {bills.length > 2 ? ` +${bills.length - 2}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 space-y-2">
              {overdue.length > 0 && (
                <BillSection label="Vencidas" labelClass="text-destructive" bills={overdue} getDaysLabel={getDaysLabel} variant="overdue" />
              )}
              {today.length > 0 && (
                <BillSection label="Hoje" labelClass="text-amber-500" bills={today} getDaysLabel={getDaysLabel} variant="today" />
              )}
              {soon.length > 0 && (
                <BillSection label="Próximos dias" labelClass="text-primary" bills={soon} getDaysLabel={getDaysLabel} variant="soon" />
              )}
              {later.length > 0 && (
                <BillSection label="Este mês" labelClass="text-muted-foreground" bills={later} getDaysLabel={getDaysLabel} variant="later" />
              )}

              {notificationSupported && notificationPermission !== "granted" && !permAsked && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 rounded-lg gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnableNotifications();
                    }}
                  >
                    <Bell className="w-3 h-3" />
                    Ativar notificações do navegador
                  </Button>
                </div>
              )}

              {permAsked && notificationPermission === "granted" && (
                <p className="text-xs text-center text-emerald-500 font-medium">
                  Notificações ativadas
                </p>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissed(true);
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center pt-1"
              >
                Dispensar por hoje
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const BillSection = ({
  label,
  labelClass,
  bills,
  getDaysLabel,
  variant,
}: {
  label: string;
  labelClass: string;
  bills: UpcomingBill[];
  getDaysLabel: (b: UpcomingBill) => string;
  variant: "overdue" | "today" | "soon" | "later";
}) => (
  <div className="space-y-1">
    <span className={`text-xs font-bold uppercase tracking-wider ${labelClass}`}>{label}</span>
    {bills.map((b, i) => (
      <BillRow key={`${variant}-${i}`} bill={b} label={getDaysLabel(b)} variant={variant} />
    ))}
  </div>
);

const BillRow = ({ bill, label, variant }: { bill: UpcomingBill; label: string; variant: "overdue" | "today" | "soon" | "later" }) => {
  const dotColor = variant === "overdue" ? "bg-destructive" : variant === "today" ? "bg-amber-500" : variant === "soon" ? "bg-primary" : "bg-muted-foreground";
  const labelColor = variant === "overdue" ? "text-destructive" : variant === "today" ? "text-amber-500" : variant === "soon" ? "text-primary" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
      <span className="text-xs flex-1 truncate">{bill.name}</span>
      <span className="text-xs text-muted-foreground">dia {bill.day}</span>
      <span className={`text-xs font-bold ${labelColor}`}>{label}</span>
    </div>
  );
};
