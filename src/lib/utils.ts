import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Production domain used for all auth email redirects (signup confirmation,
 * password reset, etc.). When the user opens the app from preview, localhost
 * or the .lovable.app staging URL, we still want the email link to send them
 * to the real custom domain — otherwise Safari tries to open localhost.
 */
const PRODUCTION_AUTH_URL = "https://www.coreaplicativo.com.br";

export function getAuthRedirectUrl(path: string = "/"): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return `${PRODUCTION_AUTH_URL}${safePath === "/" ? "" : safePath}`;
  }
  const host = window.location.hostname;
  const isNonProd =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.endsWith(".lovable.app");
  const base = isNonProd ? PRODUCTION_AUTH_URL : window.location.origin;
  return `${base}${safePath === "/" ? "" : safePath}`;
}
