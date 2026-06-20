import { createContext, useContext, useCallback, ReactNode } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import { MODULE_KEY_SET } from "@/lib/module-keys";

/**
 * Demo mode = the open, navigable app shell behind /demo (hero "abrir demo").
 * Real modules render inside /demo/:moduleKey under PreviewUserDataProvider, so
 * nothing persists and account actions are disabled. The context flag lets the
 * shared module/home components remap their navigation (and gate profile UI)
 * without affecting the real app, where the provider is absent (isDemo=false).
 */
const DemoModeContext = createContext<boolean>(false);

export const DemoModeProvider = ({ children }: { children: ReactNode }) => (
  <DemoModeContext.Provider value={true}>{children}</DemoModeContext.Provider>
);

export const useDemoMode = (): boolean => useContext(DemoModeContext);

/**
 * Rewrites an absolute in-app path to its /demo equivalent so the existing
 * navigation in module pages and home launchers keeps the visitor inside the
 * demo. "/" and "/home" → "/demo"; "/financas" → "/demo/financas"; anything
 * else (e.g. "/planos", "/auth") passes through unchanged so CTAs that should
 * leave the demo still work.
 */
export function remapDemoPath(to: string): string {
  if (to === "/" || to === "/home") return "/demo";
  const seg = to.replace(/^\//, "").split(/[/?#]/)[0];
  if (MODULE_KEY_SET.has(seg)) return "/demo/" + to.replace(/^\//, "");
  return to;
}

/**
 * Drop-in replacement for useNavigate that is demo-aware. Outside the demo
 * (no provider) it behaves exactly like useNavigate.
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  const isDemo = useContext(DemoModeContext);
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "string") {
        if (isDemo) {
          return navigate(remapDemoPath(to), options);
        }
        // Demo de módulo único (/preview/:modulo): o "voltar" (que no app vai
        // pra /home ou /) deve sair pra LP, não pro app real.
        if (
          (to === "/" || to === "/home") &&
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/preview")
        ) {
          return navigate("/lp", options);
        }
      }
      // Pass-through (number for navigate(-1), or To object).
      return navigate(to as To, options);
    },
    [navigate, isDemo],
  );
}
