import { plataformaApp, type PlataformaApp } from "@/lib/native-shell";

/**
 * A versão que o "Meu acesso" mostra (QA 1.0.18). Android e web: a do build.gradle (__APP_VERSION__), como sempre.
 * iPhone: a do project.pbxproj (__APP_VERSION_IOS__) — antes aparecia "1.0.133 (134)", a do Android.
 */
export function versaoVisivel(plataforma: PlataformaApp = plataformaApp()): string {
  const android = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
  if (plataforma !== "ios") return android;
  return typeof __APP_VERSION_IOS__ === "string" ? __APP_VERSION_IOS__ : "dev";
}
