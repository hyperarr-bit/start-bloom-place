import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRing, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { useBillReminders, UpcomingBill } from "@/hooks/use-bill-reminders";
import { Button } from "@/components/ui/button";

export const BillReminderBanner = () => {
  const { getUpcomingBills, requestNotificationPermission, notificationSupported, notificationPermission } = useBillReminders();
  const [bills, setBills] = useState<UpcomingBill[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [permAsked, setPermAsked] = useState(false);

  useEffect(() => {
    setBills(getUpcomingBills());
  }, [getUpcomingBills]);

  if (dismissed || bills.length === 0) return null;

  const overdue = bills.filter((b) => b.isPastDue);
  const today = bills.filter((b) => b.daysUntil === 0);
  const upcoming = bills.filter((b) => b.daysUntil > 0);

  const hasOverdue = overdue.length > 0;
  const hasToday = today.length > 0;

  const bannerColor = hasOverdue
    ? "from-red-500/15 to-red-500/5 border-red-500/30"
    : hasToday
    ? "from-amber-500/15 to-amber-500/5 border-amber-500/30"
    : "from-blue-500/10 to-blue-500/5 border-blue-500/25";

  const iconColor = hasOverdue ? "text-red-500" : hasToday ? "text-amber-500" : "text-blue-500";

  const getDaysLabel = (b: UpcomingBill) => {
    if (b.isPastDue) return `${Math.abs(b.daysUntil)} dia${Math.abs(b.daysUntil) > 1 ? "s" : ""} atrás`;
    if (b.daysUntil === 0) return "Hoje";
    if (b.daysUntil === 1) return "Amanhã";
    return `Em ${b.daysUntil} dias`;
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermAsked(true);
    if (granted) {
      try {
        new Notification("🔔 Notificações ativadas!", {
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
      className={`rounded-xl border bg-gradient-to-r ${bannerColor} overflow-hidden`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3.5 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          hasOverdue ? "bg-red-500/20" : hasToday ? "bg-amber-500/20" : "bg-blue-500/15"
        }`}>
          {hasOverdue ? (
            <AlertTriangle className={`w-4.5 h-4.5 ${iconColor}`} />
          ) : (
            <BellRing className={`w-4.5 h-4.5 ${iconColor}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">
            {hasOverdue
              ? `⚠️ ${overdue.length} conta${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}!`
              : hasToday
              ? `📅 ${today.length} conta${today.length > 1 ? "s" : ""} vence${today.length > 1 ? "m" : ""} hoje`
              : `🔔 ${upcoming.length} conta${upcoming.length > 1 ? "s" : ""} nos próximos dias`
            }
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
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
              {/* Overdue */}
              {overdue.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">Vencidas</span>
                  {overdue.map((b, i) => (
                    <BillRow key={`o-${i}`} bill={b} label={getDaysLabel(b)} variant="overdue" />
                  ))}
                </div>
              )}

              {/* Today */}
              {today.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">Hoje</span>
                  {today.map((b, i) => (
                    <BillRow key={`t-${i}`} bill={b} label={getDaysLabel(b)} variant="today" />
                  ))}
                </div>
              )}

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Próximas</span>
                  {upcoming.map((b, i) => (
                    <BillRow key={`u-${i}`} bill={b} label={getDaysLabel(b)} variant="upcoming" />
                  ))}
                </div>
              )}

              {/* Notification CTA */}
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
                <p className="text-[10px] text-center text-emerald-500 font-medium">
                  ✅ Notificações ativadas
                </p>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissed(true);
                }}
                className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center pt-1"
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

const BillRow = ({ bill, label, variant }: { bill: UpcomingBill; label: string; variant: "overdue" | "today" | "upcoming" }) => {
  const dotColor = variant === "overdue" ? "bg-red-500" : variant === "today" ? "bg-amber-500" : "bg-blue-400";
  const labelColor = variant === "overdue" ? "text-red-500" : variant === "today" ? "text-amber-600 dark:text-amber-400" : "text-blue-500";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background/50">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
      <span className="text-xs flex-1 truncate">{bill.name}</span>
      <span className="text-[10px] text-muted-foreground">dia {bill.day}</span>
      <span className={`text-[10px] font-bold ${labelColor}`}>{label}</span>
    </div>
  );
};
