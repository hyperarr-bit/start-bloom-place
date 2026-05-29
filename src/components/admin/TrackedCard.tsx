import { useEffect, useRef, ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  cardKey: string;
  tab?: string;
  children: ReactNode;
}

const VIEW_DEDUP_KEY = "core_card_views_seen";
const INTERACT_THROTTLE_MS = 2000;

const seenThisSession = (key: string): boolean => {
  try {
    const raw = sessionStorage.getItem(VIEW_DEDUP_KEY) || "[]";
    const arr: string[] = JSON.parse(raw);
    if (arr.includes(key)) return true;
    arr.push(key);
    sessionStorage.setItem(VIEW_DEDUP_KEY, JSON.stringify(arr));
    return false;
  } catch {
    return false;
  }
};

/**
 * Wrapper invisível que rastreia "view" (1x por sessão) e "interact" (com throttle)
 * de um card. Não muda layout/CSS — usa display:contents.
 */
export const TrackedCard = ({ cardKey, tab, children }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastInteractRef = useRef(0);
  const viewKey = `${tab || ""}::${cardKey}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || seenThisSession(viewKey)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            trackEvent("finance_card_view", { card: cardKey, tab: tab || "" });
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cardKey, tab, viewKey]);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastInteractRef.current < INTERACT_THROTTLE_MS) return;
    lastInteractRef.current = now;
    trackEvent("finance_card_interact", { card: cardKey, tab: tab || "" });
  };

  return (
    <div ref={ref} onClickCapture={handleClick} style={{ display: "contents" }}>
      {children}
    </div>
  );
};
