import { useIsTikTokBrowser } from "@/hooks/use-in-app-browser";
import { AccessGateUI } from "./AccessGateUI";

export const TikTokBrowserGate = () => {
  const { isTikTok } = useIsTikTokBrowser();
  if (!isTikTok) return null;
  return <AccessGateUI />;
};
