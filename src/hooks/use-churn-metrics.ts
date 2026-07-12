import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrialCurvePoint {
  day: number;
  cohort_size: number;
  active_on_day: number;
  retention_pct: number;
}

export interface ReasonRow {
  reason: string;
  total: number;
  churned: number;
  saved_discount: number;
  saved_pause: number;
  saved_total: number;
  save_rate_pct: number;
}

export interface OfferEffectiveness {
  offer_type: string;
  accepted: number;
  still_active: number;
  retention_pct: number;
}

export interface CohortRow {
  month: string;
  signups: number;
  converted: number;
  canceled: number;
  retained_30d: number;
  conversion_pct: number;
  retention_30d_pct: number;
}

export interface ChurnDeepMetrics {
  trial_curve: TrialCurvePoint[];
  reasons: ReasonRow[];
  offer_effectiveness: OfferEffectiveness[];
  cohorts: CohortRow[];
  voluntary_30d: number;
  involuntary_30d: number;
  avg_days_to_cancel: number | null;
  most_common_churn_day: number | null;
  mrr_lost_30d: number;
}

const PRICE_PER_SUB = 14.9;
const DAY_MS = 86400_000;

function dayDiff(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / DAY_MS;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function useChurnDeepMetrics() {
  const [data, setData] = useState<ChurnDeepMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = supabase as any;
        const since60 = new Date(Date.now() - 60 * DAY_MS).toISOString();
        const since90 = new Date(Date.now() - 90 * DAY_MS).toISOString();
        const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
        const since6mo = new Date();
        since6mo.setUTCMonth(since6mo.getUTCMonth() - 5);
        since6mo.setUTCDate(1);
        since6mo.setUTCHours(0, 0, 0, 0);

        const [usersRes, attemptsRes, offersRes, subsRes, modulesRes] = await Promise.all([
          sb.rpc("admin_list_users"),
          sb.from("cancel_attempts").select("user_id, reason, outcome, created_at").gte("created_at", since90),
          sb.from("retention_offers_used").select("user_id, offer_type, status, used_at"),
          sb.from("subscriptions").select("user_id, status, created_at, current_period_end"),
          sb.from("module_analytics").select("user_id, entered_at").gte("entered_at", since60).limit(10000),
        ]);

        if (cancelled) return;
        for (const r of [usersRes, attemptsRes, offersRes, subsRes, modulesRes]) {
          if (r.error) throw r.error;
        }

        const users: Array<{ user_id: string; email: string; created_at: string }> = usersRes.data || [];
        const attempts: Array<{ user_id: string; reason: string | null; outcome: string; created_at: string }> = attemptsRes.data || [];
        const offers: Array<{ user_id: string; offer_type: string; status: string; used_at: string }> = offersRes.data || [];
        const subs: Array<{ user_id: string; status: string; created_at: string; current_period_end: string | null }> = subsRes.data || [];
        const modules: Array<{ user_id: string; entered_at: string }> = modulesRes.data || [];

        // ----- Trial retention curve D1..D7 -----
        const userById = new Map(users.map((u) => [u.user_id, new Date(u.created_at)]));
        const since60Date = new Date(since60);
        const recentSignups = users.filter((u) => new Date(u.created_at) > since60Date);

        // bucket modules per user
        const modulesByUser = new Map<string, Date[]>();
        for (const m of modules) {
          const arr = modulesByUser.get(m.user_id) ?? [];
          arr.push(new Date(m.entered_at));
          modulesByUser.set(m.user_id, arr);
        }

        const trial_curve: TrialCurvePoint[] = [];
        for (let day = 1; day <= 7; day++) {
          const eligible = recentSignups.filter(
            (u) => dayDiff(new Date(), new Date(u.created_at)) >= day,
          );
          const active = eligible.filter((u) => {
            const start = new Date(u.created_at);
            const winStart = start.getTime() + (day - 1) * DAY_MS;
            const winEnd = start.getTime() + day * DAY_MS;
            const ms = modulesByUser.get(u.user_id) || [];
            return ms.some((d) => d.getTime() >= winStart && d.getTime() < winEnd);
          });
          trial_curve.push({
            day,
            cohort_size: eligible.length,
            active_on_day: active.length,
            retention_pct: eligible.length > 0 ? Math.round((active.length / eligible.length) * 1000) / 10 : 0,
          });
        }

        // ----- Reasons with recovery -----
        const reasonMap = new Map<string, ReasonRow>();
        for (const a of attempts) {
          if (!a.reason) continue;
          const r = reasonMap.get(a.reason) ?? {
            reason: a.reason, total: 0, churned: 0, saved_discount: 0, saved_pause: 0, saved_total: 0, save_rate_pct: 0,
          };
          r.total += 1;
          if (a.outcome === "churned") r.churned += 1;
          if (a.outcome === "saved_discount") { r.saved_discount += 1; r.saved_total += 1; }
          if (a.outcome === "saved_pause") { r.saved_pause += 1; r.saved_total += 1; }
          if (a.outcome === "saved_feedback") r.saved_total += 1;
          reasonMap.set(a.reason, r);
        }
        const reasons = Array.from(reasonMap.values())
          .map((r) => ({ ...r, save_rate_pct: r.total > 0 ? Math.round((r.saved_total / r.total) * 1000) / 10 : 0 }))
          .sort((a, b) => b.total - a.total);

        // ----- Offer effectiveness -----
        const activeUserIds = new Set(
          subs.filter((s) => s.status === "active" && (!s.current_period_end || new Date(s.current_period_end) > new Date()))
              .map((s) => s.user_id),
        );
        const offerMap = new Map<string, { accepted: number; still_active: number }>();
        for (const o of offers) {
          const e = offerMap.get(o.offer_type) ?? { accepted: 0, still_active: 0 };
          e.accepted += 1;
          if (activeUserIds.has(o.user_id)) e.still_active += 1;
          offerMap.set(o.offer_type, e);
        }
        const offer_effectiveness: OfferEffectiveness[] = Array.from(offerMap.entries()).map(([offer_type, v]) => ({
          offer_type,
          accepted: v.accepted,
          still_active: v.still_active,
          retention_pct: v.accepted > 0 ? Math.round((v.still_active / v.accepted) * 1000) / 10 : 0,
        }));

        // ----- Cohorts last 6 months -----
        const months: { key: string; start: Date; end: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setUTCMonth(d.getUTCMonth() - i, 1);
          d.setUTCHours(0, 0, 0, 0);
          const next = new Date(d);
          next.setUTCMonth(next.getUTCMonth() + 1);
          months.push({ key: monthKey(d), start: d, end: next });
        }
        const cohorts: CohortRow[] = months.map((m) => {
          const cohortUsers = users.filter((u) => {
            const c = new Date(u.created_at);
            return c >= m.start && c < m.end;
          });
          const cohortIds = new Set(cohortUsers.map((u) => u.user_id));
          const converted = subs.filter((s) => cohortIds.has(s.user_id) && (s.status === "active" || s.status === "canceled")).length;
          const canceled = subs.filter((s) => cohortIds.has(s.user_id) && s.status === "canceled").length;
          // retention_30d: cohort users active in module_analytics between D23-D37 after signup
          const retained = cohortUsers.filter((u) => {
            const start = new Date(u.created_at);
            const winStart = start.getTime() + 23 * DAY_MS;
            const winEnd = start.getTime() + 37 * DAY_MS;
            const ms = modulesByUser.get(u.user_id) || [];
            return ms.some((d) => d.getTime() >= winStart && d.getTime() < winEnd);
          }).length;
          return {
            month: m.key,
            signups: cohortUsers.length,
            converted,
            canceled,
            retained_30d: retained,
            conversion_pct: cohortUsers.length > 0 ? Math.round((converted / cohortUsers.length) * 1000) / 10 : 0,
            retention_30d_pct: cohortUsers.length > 0 ? Math.round((retained / cohortUsers.length) * 1000) / 10 : 0,
          };
        });

        // ----- Voluntary vs involuntary (30d) -----
        const since30Date = new Date(since30);
        const voluntary_30d = attempts.filter((a) => a.outcome === "churned" && new Date(a.created_at) >= since30Date).length;

        // involuntary = canceled/past_due in last 30d without a matching cancel_attempt
        const churnedUserSet = new Set(
          attempts.filter((a) => a.outcome === "churned").map((a) => a.user_id),
        );
        const involuntary_30d = subs.filter((s) =>
          (s.status === "canceled" || s.status === "past_due") &&
          new Date(s.created_at) >= since30Date &&
          !churnedUserSet.has(s.user_id),
        ).length;

        // ----- Avg days to cancel & most common churn day -----
        const canceledSubs = subs.filter((s) => s.status === "canceled" && new Date(s.created_at) >= new Date(since90));
        const dayDiffs: number[] = [];
        const trialDays: number[] = [];
        for (const s of canceledSubs) {
          const u = userById.get(s.user_id);
          if (!u) continue;
          const diff = dayDiff(new Date(s.created_at), u);
          if (diff >= 0) {
            dayDiffs.push(diff);
            trialDays.push(Math.min(8, Math.max(1, Math.ceil(diff))));
          }
        }
        const avg_days_to_cancel = dayDiffs.length > 0
          ? Math.round((dayDiffs.reduce((a, b) => a + b, 0) / dayDiffs.length) * 10) / 10
          : null;
        let most_common_churn_day: number | null = null;
        if (trialDays.length > 0) {
          const freq = new Map<number, number>();
          trialDays.forEach((d) => freq.set(d, (freq.get(d) ?? 0) + 1));
          most_common_churn_day = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0][0];
        }

        const mrr_lost_30d = (voluntary_30d + involuntary_30d) * PRICE_PER_SUB;

        setData({
          trial_curve, reasons, offer_effectiveness, cohorts,
          voluntary_30d, involuntary_30d,
          avg_days_to_cancel, most_common_churn_day, mrr_lost_30d,
        });
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message ?? "Erro ao carregar métricas");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
