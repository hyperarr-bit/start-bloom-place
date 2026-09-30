/**
 * "JÁ PAGOU PELO SITE? ENTRE COM SEU E-MAIL" (P6, 30/09) — a linha logo abaixo
 * de cada "Restaurar compras" do APP das lojas.
 *
 * O dado: 1.092 toques em "Restaurar compras" em 305 sessões, e só 9 viraram
 * acesso. Quem pagou pelo SITE (Pix/cartão na web) procura a compra na LOJA,
 * que nunca vai achar nada: a compra da web mora na CONTA (o e-mail do
 * cadastro). O caminho certo é entrar com o e-mail — esta linha diz isso
 * exatamente onde a pessoa está procurando.
 *
 * Regras:
 *  · só no app das lojas (isNativeShell) — na web não existe "Restaurar compras";
 *  · só pra quem ainda NÃO entrou (`logado` = já está numa conta: no gate, a
 *    troca de conta é o "Entrar com outra conta" que já existe lá);
 *  · leva pro MESMO lugar do "Já tenho conta? Entrar" da welcome: `onEntrar`
 *    de quem monta, senão /entrar (código por e-mail + Apple/Google);
 *  · evento próprio: `ja_pagou_site_click { origem, loja, tela }`;
 *  · iPHONE: a regra 3.1.1 da Apple proíbe citar pagamento de fora da App
 *    Store dentro do app (ver src/lib/loja.ts e o PaywallIOS) — lá a linha diz
 *    "Já é cliente?", sem "pagou pelo site". Trocar é uma constante aqui.
 */
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell, plataformaApp } from "@/lib/native-shell";
import { ehApple } from "@/lib/loja";

/** Android: o texto pedido pelo dono. */
export const PERGUNTA_JA_PAGOU = "Já pagou pelo site?";
/** iPhone: sem citar pagamento de fora da App Store (3.1.1). Pra usar o texto do Android também lá, é trocar aqui. */
export const PERGUNTA_JA_PAGOU_IOS = "Já é cliente?";
export const ACAO_JA_PAGOU = "Entre com seu e-mail";

type Props = {
  /** De onde veio o toque (vai no evento): "welcome", "rodape_legal", "planos"… */
  origem: string;
  /** Quem monta pode ter o próprio caminho de login (a welcome do funil tem). */
  onEntrar?: () => void;
  /** Já está numa conta: a linha não aparece. */
  logado?: boolean;
  className?: string;
  classeAcao?: string;
};

/** Na web (e pra quem já entrou) não monta nada — nem o hook do roteador. */
export function JaPagouPeloSite(props: Props) {
  if (!isNativeShell() || props.logado) return null;
  return <LinhaJaPagou {...props} />;
}

function LinhaJaPagou({ origem, onEntrar, className, classeAcao = "underline underline-offset-2" }: Props) {
  const navigate = useNavigate();
  const pergunta = ehApple() ? PERGUNTA_JA_PAGOU_IOS : PERGUNTA_JA_PAGOU;
  return (
    <button
      type="button"
      data-testid="ja-pagou-site"
      className={className}
      onClick={() => {
        try {
          trackEvent("ja_pagou_site_click", { origem, loja: plataformaApp(), tela: window.location.pathname });
        } catch { /* medição nunca segura o login */ }
        if (onEntrar) onEntrar();
        else navigate("/entrar");
      }}
    >
      {pergunta} <span className={classeAcao}>{ACAO_JA_PAGOU}</span>
    </button>
  );
}
