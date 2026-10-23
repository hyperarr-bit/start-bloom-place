import { createPortal } from "react-dom";
import { trackEvent } from "@/lib/analytics";
import { URL_ASSINATURAS_APPLE, type TipoDeAcessoAnterior } from "@/lib/conta-ja-tinha-acesso";

/**
 * "VOCÊ JÁ TEM O CORE" (1.0.17) — a folha calma de quem tem acesso fora da loja (vitalício da web…) e ainda assim
 * tem um teste/assinatura da loja que vai (ou tenta) cobrar. Nunca bloqueia: "Entendi" segue igual.
 * Usada no cadastro do iPhone (entrou numa conta antiga logo depois de começar o teste: `oQue="teste"`) e no aviso de
 * cartão recusado (a assinatura da loja não serve pra nada: `oQue="assinatura"`, via "cobranca").
 * `data-aviso-cobranca`: não conta como "guia na tela" pro aviso de cobrança (lib/cobranca-recusada).
 */
export function AvisoJaTinhaAcesso({ tipo, oQue, via, loja = "App Store", href = URL_ASSINATURAS_APPLE, onEntendi }: {
  tipo: TipoDeAcessoAnterior;
  oQue: "teste" | "assinatura";
  via: string;
  loja?: string;
  href?: string;
  onEntendi: () => void;
}) {
  const coisa = oQue === "teste" ? "o teste" : "a assinatura";
  const lugar = loja === "App Store" ? "na App Store" : `no ${loja}`;
  const folha = (
    <div className="fixed inset-0 z-[320] flex flex-col justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="ja-tinha-titulo" data-testid="conta-ja-tinha-acesso" data-aviso-cobranca="">
      <div className="bg-background rounded-t-3xl px-6 pt-6 text-center" style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 1.25rem)" }}>
        <h2 id="ja-tinha-titulo" className="text-[22px] font-bold tracking-tight leading-tight">
          {tipo === "vitalicio" ? "Você já tem o CORE vitalício." : "Você já tem acesso ao CORE nesta conta."}
        </h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed mt-2">
          {tipo === "vitalicio" ? `Pra não ser cobrado, cancele ${coisa} ${lugar}.` : `Pra não ser cobrado duas vezes, cancele ${coisa} ${lugar}.`}
        </p>
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          onClick={() => trackEvent("conta_ja_tinha_acesso_gerenciar", { tipo, via })}
          className="mt-5 h-12 rounded-2xl bg-foreground text-background text-[15px] font-semibold flex items-center justify-center"
        >
          Gerenciar assinatura
        </a>
        <button type="button" onClick={onEntendi} className="mt-1 h-12 w-full text-[14px] font-medium text-muted-foreground">
          Entendi
        </button>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(folha, document.body) : folha;
}
