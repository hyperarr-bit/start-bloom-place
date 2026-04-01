import { useEffect, useCallback, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";

interface Bill {
  id: string;
  name: string;
  paid: boolean;
}

interface DueDay {
  day: number;
  bills: Bill[];
}

export interface UpcomingBill {
  name: string;
  day: number;
  daysUntil: number;
  isPastDue: boolean;
}

const REMINDER_DAYS_AHEAD = 3;
const NOTIFICATION_COOLDOWN_KEY = "bill-notification-cooldown";

export function useBillReminders() {
  const { get } = useUserData();
  const notifiedRef = useRef(false);

  const getUpcomingBills = useCallback((): UpcomingBill[] => {
    const dueDays = get<DueDay[]>("finance-dueDays", []);
    const today = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const results: UpcomingBill[] = [];

    dueDays.forEach((d) => {
      d.bills
        .filter((b) => !b.paid)
        .forEach((b) => {
          let daysUntil = d.day - today;
          if (daysUntil < -5) daysUntil += daysInMonth; // wrap to next month
          const isPastDue = daysUntil < 0;
          if (daysUntil <= REMINDER_DAYS_AHEAD) {
            results.push({ name: b.name, day: d.day, daysUntil, isPastDue });
          }
        });
    });

    return results.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [get]);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const sendBrowserNotification = useCallback((bills: UpcomingBill[]) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Cooldown: only notify once per 8 hours
    const lastNotified = localStorage.getItem(NOTIFICATION_COOLDOWN_KEY);
    const now = Date.now();
    if (lastNotified && now - parseInt(lastNotified) < 8 * 60 * 60 * 1000) return;

    const overdue = bills.filter((b) => b.isPastDue);
    const upcoming = bills.filter((b) => !b.isPastDue);

    let title = "";
    let body = "";

    if (overdue.length > 0) {
      title = `⚠️ ${overdue.length} conta${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}!`;
      body = overdue.map((b) => b.name).join(", ");
    } else if (upcoming.length > 0) {
      const todayBills = upcoming.filter((b) => b.daysUntil === 0);
      if (todayBills.length > 0) {
        title = `📅 ${todayBills.length} conta${todayBills.length > 1 ? "s" : ""} vence${todayBills.length > 1 ? "m" : ""} hoje!`;
        body = todayBills.map((b) => b.name).join(", ");
      } else {
        title = `🔔 ${upcoming.length} conta${upcoming.length > 1 ? "s" : ""} nos próximos dias`;
        body = upcoming.map((b) => `${b.name} (dia ${b.day})`).join(", ");
      }
    }

    if (title) {
      try {
        new Notification(title, { body, icon: "/favicon.ico", tag: "bill-reminder" });
        localStorage.setItem(NOTIFICATION_COOLDOWN_KEY, String(now));
      } catch {}
    }
  }, []);

  // Auto-check and notify on mount
  useEffect(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;

    const timer = setTimeout(() => {
      const bills = getUpcomingBills();
      if (bills.length > 0) {
        sendBrowserNotification(bills);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [getUpcomingBills, sendBrowserNotification]);

  return {
    getUpcomingBills,
    requestNotificationPermission,
    notificationSupported: typeof window !== "undefined" && "Notification" in window,
    notificationPermission: typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : ("denied" as NotificationPermission),
  };
}
