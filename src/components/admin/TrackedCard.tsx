import {
  Children,
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  Ref,
  useCallback,
  useEffect,
  useRef,
} from "react";
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

// Combine forwarded ref (function or object) with our internal ref.
const setRefs = <T,>(node: T, ...refs: (Ref<T> | undefined)[]) => {
  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === "function") ref(node);
    else (ref as React.MutableRefObject<T | null>).current = node;
  }
};

/**
 * Wrapper que rastreia "view" (1x por sessão) e "interact" (com throttle)
 * de um card SEM adicionar nenhum elemento ao DOM — anexa ref/listener
 * direto no único filho via cloneElement. Layout/CSS do filho fica idêntico.
 */
export const TrackedCard = ({ cardKey, tab, children }: Props) => {
  const elRef = useRef<HTMLElement | null>(null);
  const lastInteractRef = useRef(0);
  const viewKey = `${tab || ""}::${cardKey}`;

  useEffect(() => {
    const el = elRef.current;
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

  const handleClick = useCallback(
    (originalHandler?: (e: React.MouseEvent) => void) =>
      (e: React.MouseEvent) => {
        const now = Date.now();
        if (now - lastInteractRef.current >= INTERACT_THROTTLE_MS) {
          lastInteractRef.current = now;
          trackEvent("finance_card_interact", { card: cardKey, tab: tab || "" });
        }
        originalHandler?.(e);
      },
    [cardKey, tab],
  );

  const child = Children.only(children);
  if (!isValidElement(child)) return <>{children}</>;

  const childElement = child as ReactElement<any>;
  const existingRef = (childElement as any).ref as Ref<HTMLElement> | undefined;
  const existingOnClickCapture = childElement.props.onClickCapture as
    | ((e: React.MouseEvent) => void)
    | undefined;

  return cloneElement(childElement, {
    ref: (node: HTMLElement | null) => {
      elRef.current = node;
      setRefs(node, existingRef);
    },
    onClickCapture: handleClick(existingOnClickCapture),
  });
};
