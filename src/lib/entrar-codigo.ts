/**
 * TELA DE ENTRAR SÓ COM CÓDIGO (06/11, mockup na tela real esperando o ok do dono).
 *
 * Quem comprou o vitalício no site não consegue entrar no app: a tela pedia senha, e o código por e-mail só aparecia
 * depois de digitar o e-mail, como link pequeno. Ligada, o /entrar abre em e-mail + "Receber código" e a senha vira
 * link. Só muda o /entrar, o "Criar conta" do /auth com e-mail que já existe e o cadastro DEPOIS da compra no app.
 * Welcome, paywall e cadastro antes do paywall não leem esta chave.
 *
 * Duas chaves porque o site sobe por deploy e o app só na próxima build. Rollback = "off".
 */
import { isNativeShell } from "@/lib/native-shell";

type ModoEntrarCodigo = "on" | "off";
export const ENTRAR_CODIGO_APP = "off" as ModoEntrarCodigo;
export const ENTRAR_CODIGO_WEB = "off" as ModoEntrarCodigo;

/** O que o /auth manda pro /entrar pelo estado da rota. */
export type EstadoEntrarCodigo = { emailJaTemConta?: string };

/** VITE_ENTRAR_CODIGO=on só vale no vite de desenvolvimento (prints): em build o DEV é falso e isso some do bundle. */
export const entrarCodigoLigado = (): boolean =>
  (import.meta.env.DEV && import.meta.env.VITE_ENTRAR_CODIGO === "on") ||
  (isNativeShell() ? ENTRAR_CODIGO_APP : ENTRAR_CODIGO_WEB) === "on";
