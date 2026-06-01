import { useEffect, useState } from "react";

export function useIsTikTokBrowser() {
  const [isTikTok, setIsTikTok] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const re = /musical_ly|bytedance|tiktok|bytedancewebview/i;
    setIsTikTok(re.test(ua));
  }, []);

  return { isTikTok };
}
