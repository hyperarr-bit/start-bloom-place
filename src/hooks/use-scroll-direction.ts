import { useEffect } from "react";

/**
 * Globally tracks scroll direction and writes it to `document.body.dataset.scrollDir`
 * ("up" | "down"). Used by CSS to collapse/show the sticky header.
 *
 * - Ignores tiny scrolls (< 6px) to avoid jitter.
 * - Always "up" while near the top so header reappears fully.
 */
export function useScrollDirection() {
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const THRESHOLD = 6;
    const TOP_ZONE = 8;

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY;

      if (y <= TOP_ZONE) {
        document.body.dataset.scrollDir = "up";
        lastY = y;
        ticking = false;
        return;
      }

      if (Math.abs(delta) >= THRESHOLD) {
        document.body.dataset.scrollDir = delta > 0 ? "down" : "up";
        lastY = y;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    document.body.dataset.scrollDir = "up";
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete document.body.dataset.scrollDir;
    };
  }, []);
}
