import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * O BOTÃO DO FUNIL (10/10, dono: "o botão principal tem que ficar NO MESMO LUGAR em
 * TODAS as telas") — o rodapé fixo das telas do funil enxuto (FUNIL_CALAI on).
 *
 *   · pílula preta, largura total menos 24 px (12 de cada lado), 56 px de altura, mesma
 *     fonte, colada embaixo respeitando a safe-area (env(safe-area-inset-bottom));
 *   · a ação secundária ("Agora não", "Já tem conta? Entrar") é SEMPRE um link de texto
 *     logo ACIMA do botão, na mesma posição em todas as telas; nunca dois botões lado a lado;
 *   · o rodapé é fixo (portal no body) e deixa um ESPAÇADOR do mesmo tamanho no lugar onde
 *     foi montado — o conteúdo da tela rola por cima dele quando não cabe.
 *
 * Com a chave desligada nenhuma tela de hoje usa isto (os botões de hoje continuam onde estão).
 */
export const ALTURA_BOTAO = 56;
export const MARGEM_LATERAL = 12;
export const MARGEM_BAIXO = 12;
export const ALTURA_SECUNDARIO = 40;
/** o degradê branco em cima do rodapé (faz parte do espaçador) */
export const RESPIRO_TOPO = 14;

export function BotaoDoFunil({ texto, onClick, disabled, testid, seta = true, secundario, extra, fixo = true }: {
  texto: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testid?: string;
  /** a setinha → no fim do texto (padrão sim) */
  seta?: boolean;
  /** o link de texto logo acima do botão */
  secundario?: { texto: ReactNode; onClick: () => void; disabled?: boolean; testid?: string };
  /** linhas miúdas (termos, restaurar) que ficam ACIMA do link secundário — só a welcome usa */
  extra?: ReactNode;
  /** `false` = rende no fluxo (sem portal nem espaçador): a welcome, que já é uma camada fixa */
  fixo?: boolean;
}) {
  const altura = RESPIRO_TOPO + MARGEM_BAIXO + ALTURA_BOTAO + (secundario ? ALTURA_SECUNDARIO : 0);
  const rodape = (
    <div
      className="bdf-rodape"
      data-testid="botao-do-funil-rodape"
      style={fixo ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40 } : undefined}
    >
      <style>{CSS_BDF}</style>
      <div className="bdf-col">
        {extra}
        {secundario && (
          <button type="button" className="bdf-link" onClick={secundario.onClick} disabled={secundario.disabled} data-testid={secundario.testid ?? "botao-do-funil-secundario"}>
            {secundario.texto}
          </button>
        )}
        <button type="button" className="bdf-botao btn-shine" onClick={onClick} disabled={disabled} data-testid={testid ?? "botao-do-funil"}>
          {texto}{seta && <ArrowRight className="w-4 h-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
  if (!fixo) return rodape;
  return (
    <>
      {/* o espaçador: o lugar do rodapé no fluxo da tela (a tela rola por cima do rodapé fixo) */}
      <div aria-hidden style={{ height: `calc(${altura}px + env(safe-area-inset-bottom))`, flex: "none" }} data-testid="botao-do-funil-espaco" />
      {typeof document !== "undefined" ? createPortal(rodape, document.body) : rodape}
    </>
  );
}

const CSS_BDF = `
.bdf-rodape { background: linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 28%); padding: ${RESPIRO_TOPO}px 0 calc(${MARGEM_BAIXO}px + env(safe-area-inset-bottom)); -webkit-font-smoothing: antialiased; }
.bdf-col { width: 100%; max-width: 430px; margin: 0 auto; padding: 0 ${MARGEM_LATERAL}px; display: flex; flex-direction: column; align-items: center; }
.bdf-link { display: block; box-sizing: border-box; width: 100%; height: ${ALTURA_SECUNDARIO}px; margin: 0; border: 0; background: none; padding: 0 16px; font-family: inherit; font-size: 14px; line-height: 1.2; color: #4f5a64; cursor: pointer; }
.bdf-link b { color: #16121c; }
.bdf-link:disabled { opacity: .6; }
.bdf-botao { display: inline-flex; box-sizing: border-box; align-items: center; justify-content: center; gap: 8px; width: 100%; height: ${ALTURA_BOTAO}px; margin: 0; padding: 0 16px; border: 0; border-radius: 999px; background: #16121c; color: #fff; font-family: inherit; font-size: 16px; line-height: 1.2; font-weight: 800; cursor: pointer; box-shadow: 0 18px 38px -12px rgba(22,18,28,.5); }
/* o portal cai no body, fora do app: regras globais de "botão com ícone" (button:has(svg)) davam padding 8px
   e content-box — aqui a caixa é fixa, custe o que custar */
.bdf-rodape .bdf-botao, .bdf-rodape .bdf-botao:has(svg) { box-sizing: border-box !important; padding: 0 16px !important; margin: 0 !important; height: ${ALTURA_BOTAO}px !important; min-height: 0 !important; }
.bdf-botao:active { transform: scale(.985); }
.bdf-botao:disabled { opacity: .6; }
.bdf-extra { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; margin-bottom: 2px; }
.bdf-extra-linha { border: 0; background: none; padding: 6px 12px; font-family: inherit; font-size: 12.5px; color: #4f5a64; cursor: pointer; }
.bdf-extra-linha b, .bdf-extra-linha u { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.bdf-extra-termos { font-size: 10.5px; color: #9aa6b1; text-align: center; line-height: 1.4; padding: 2px 0 4px; }
`;
