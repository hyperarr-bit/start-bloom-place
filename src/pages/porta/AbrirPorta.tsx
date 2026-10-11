import { useEffect, useRef } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { BotaoPorta } from "./BotaoPorta";
import { abrirAppComCodigo, codigoDaPortaOk } from "./handoff";

/**
 * coreaplicativo.com.br/abrir?h=<código> (10/10) — a reserva do link da Porta.
 *
 * O botão do e-mail "entre no CORE" é `core://entrar?h=<código>`; alguns apps de e-mail não abrem
 * link core://, então embaixo vai este endereço https: "Abrir o CORE" → core://entrar?h=<código> (o
 * app troca o código por sessão e abre já logado) + "Ainda não tem o app? Baixar". É também o
 * endereço que um universal link usaria no futuro (sem Associated Domains hoje).
 * Só na web (SoNaWeb no App.tsx), noindex. O código é de uso único e vence em 24 h; a página não
 * consulta nada no servidor (quem resgata é o app).
 */
export default function AbrirPortaRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <AbrirPorta />;
}

export function AbrirPorta() {
  const [busca] = useSearchParams();
  const codigo = String(busca.get("h") ?? "").trim().toUpperCase();
  const valido = codigoDaPortaOk(codigo);
  const viu = useRef(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-porta", "");
    document.head.appendChild(meta);
    const tituloAntes = document.title;
    document.title = "CORE · Abrir o app";
    return () => { meta.remove(); document.title = tituloAntes; };
  }, []);

  useEffect(() => {
    if (viu.current) return;
    viu.current = true;
    trackEvent("porta_link_view", { valido });
  }, [valido]);

  return (
    <div className="min-h-[100dvh] bg-white text-[#16121c] antialiased" data-testid="porta-abrir">
      <div className="mx-auto w-full max-w-[430px] min-h-[100dvh] flex flex-col px-5" style={{ paddingTop: "calc(48px + env(safe-area-inset-top))" }}>
        <img src="/icon-192.png" alt="CORE" width={72} height={72} className="w-[72px] h-[72px] rounded-[18px] shadow-md" />
        <h1 className="mt-6 text-[30px] font-black tracking-[-0.03em] leading-[1.05]" data-testid="porta-abrir-titulo">
          {valido ? "Abrir o CORE" : "Abra o CORE e toque em Entrar"}
        </h1>
        <p className="mt-3 text-[15.5px] text-[#5b6570] leading-snug">
          {valido
            ? <>Sua conta já está pronta. Com o app instalado, toque no botão e ele abre <b className="text-[#16121c]">já na sua conta</b>.</>
            : <>Esse link não vale mais. Abra o app, toque em <b className="text-[#16121c]">“Entrar”</b> e use o mesmo e-mail da sua conta.</>}
        </p>
        <div className="flex-1" />
        {valido ? (
          <BotaoPorta
            texto="Abrir o CORE" seta={false} href={abrirAppComCodigo(codigo)} testid="porta-abrir-app"
            onClick={() => trackEventBeacon("porta_abrir_app_click", { onde: "link" })}
            secundario={{ texto: <>Ainda não tem o app? <b>Baixar</b></>, href: "/baixar?origem=porta_link", testid: "porta-abrir-baixar" }}
          />
        ) : (
          <BotaoPorta texto="Baixar o CORE" seta={false} href="/baixar?origem=porta_link" testid="porta-abrir-baixar" />
        )}
      </div>
    </div>
  );
}
