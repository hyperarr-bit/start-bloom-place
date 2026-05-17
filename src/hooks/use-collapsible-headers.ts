import { useEffect } from "react";

/**
 * Mount once globally. Tracks vertical scroll direction and writes
 * `data-scroll-dir="up" | "down"` on <html>, plus `data-scrolled="true"`
 * once scrolled past a threshold. CSS uses these to collapse the title
 * row of every `header.sticky.top-0` while keeping the tab row pinned.
 */
export const useCollapsibleHeaders = () => {
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    let ticking = false;
    const THRESHOLD = 6; // ignore tiny jitter
    const TOP_GUARD = 24; // never collapse near the top

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY;

      if (y <= TOP_GUARD) {
        root.setAttribute("data-scroll-dir", "up");
        root.removeAttribute("data-scrolled");
      } else {
        root.setAttribute("data-scrolled", "true");
        if (delta > THRESHOLD) {
          root.setAttribute("data-scroll-dir", "down");
          lastY = y;
        } else if (delta < -THRESHOLD) {
          root.setAttribute("data-scroll-dir", "up");
          lastY = y;
        }
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    // initialize
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-scroll-dir");
      root.removeAttribute("data-scrolled");
    };
  }, []);
};

export const CollapsibleHeadersController = () => {
  useCollapsibleHeaders();
  return null;
};
