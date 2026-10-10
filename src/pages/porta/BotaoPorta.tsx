import { createPortal } from "react-dom";
import type { MouseEvent, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * O BOTÃO DA PORTA (/comece) — cópia própria do BotaoDoFunil do app 1.0.14
 * (ramo v14, pages/funis/w/BotaoDoFunil), pra não criar conflito quando o v14
 * entrar no main.
 *
 *   · pílula preta, largura total menos 24 px, 56 px de altura, colada embaixo
 *     respeitando a safe-area: o CTA principal mora SEMPRE no mesmo lugar;
 *   · o link secundário fica sempre ABAIXO do botão (decisão do dono pra Porta), numa vaga
 *     que existe mesmo sem link: a pílula fica na MESMA altura em todas as telas;
 *   · fixo (portal no body) + um espaçador do mesmo tamanho no fluxo, pra a
 *     tela rolar por cima quando não cabe. `fixo={false}` rende no fluxo (a
 *     welcome, que já é uma camada fixa);
 *   · `href` vira um <a> (o "Baixar na App Store" precisa ser link de verdade:
 *     no navegador do Instagram, navegação por JS pra loja falha mais).
 */
export const ALTURA_BOTAO = 56;
export const MARGEM_LATERAL = 12;
export const MARGEM_BAIXO = 12;
export const ALTURA_SECUNDARIO = 40;
export const RESPIRO_TOPO = 14;

type Secundario = { texto: ReactNode; onClick?: () => void; href?: string; disabled?: boolean; testid?: string };

export function BotaoPorta({ texto, onClick, href, disabled, testid, seta = true, icone, secundario, fixo = true }: {
  texto: ReactNode;
  onClick?: (e: MouseEvent) => void;
  href?: string;
  disabled?: boolean;
  testid?: string;
  seta?: boolean;
  icone?: ReactNode;
  secundario?: Secundario;
  fixo?: boolean;
}) {
  // a vaga do link secundário existe SEMPRE (vazia quando não há link): assim a pílula fica
  // exatamente na mesma altura em todas as telas, com ou sem "Já tem conta? Entrar" embaixo
  const altura = RESPIRO_TOPO + MARGEM_BAIXO + ALTURA_BOTAO + ALTURA_SECUNDARIO + 2;
  const conteudo = <>{icone}{texto}{seta && <ArrowRight className="w-4 h-4" aria-hidden />}</>;
  const rodape = (
    <div
      className="bpt-rodape"
      data-testid="porta-rodape"
      style={fixo ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40 } : undefined}
    >
      <style>{CSS_BPT}</style>
      <div className="bpt-col">
        {href && !disabled ? (
          <a className="bpt-botao" href={href} onClick={onClick} data-testid={testid ?? "porta-cta"}>{conteudo}</a>
        ) : (
          <button type="button" className="bpt-botao" onClick={onClick} disabled={disabled} data-testid={testid ?? "porta-cta"}>{conteudo}</button>
        )}
        {!secundario && <div className="bpt-vaga" aria-hidden />}
        {secundario && (secundario.href ? (
          <a className="bpt-link" href={secundario.href} onClick={secundario.onClick} data-testid={secundario.testid ?? "porta-secundario"}><span>{secundario.texto}</span></a>
        ) : (
          <button type="button" className="bpt-link" onClick={secundario.onClick} disabled={secundario.disabled} data-testid={secundario.testid ?? "porta-secundario"}>
            <span>{secundario.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
  if (!fixo) return rodape;
  return (
    <>
      <div aria-hidden style={{ height: `calc(${altura}px + env(safe-area-inset-bottom))`, flex: "none" }} data-testid="porta-rodape-espaco" />
      {typeof document !== "undefined" ? createPortal(rodape, document.body) : rodape}
    </>
  );
}

const CSS_BPT = `
.bpt-rodape { background: linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 28%); padding: ${RESPIRO_TOPO}px 0 calc(${MARGEM_BAIXO}px + env(safe-area-inset-bottom)); -webkit-font-smoothing: antialiased; font-family: Inter, -apple-system, system-ui, sans-serif; }
.bpt-col { width: 100%; max-width: 430px; margin: 0 auto; padding: 0 ${MARGEM_LATERAL}px; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; }
.bpt-link { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 100%; height: ${ALTURA_SECUNDARIO}px; margin: 2px 0 0; border: 0; background: none; padding: 0 16px; font-family: inherit; font-size: 14px; line-height: 1.2; color: #4f5a64; cursor: pointer; text-decoration: none; }
.bpt-link b { color: #16121c; }
.bpt-vaga { height: ${ALTURA_SECUNDARIO}px; margin-top: 2px; width: 100%; }
.bpt-link:disabled { opacity: .6; }
.bpt-botao { display: inline-flex; box-sizing: border-box; align-items: center; justify-content: center; gap: 8px; width: 100%; height: ${ALTURA_BOTAO}px; margin: 0; padding: 0 16px; border: 0; border-radius: 999px; background: #16121c; color: #fff; font-family: inherit; font-size: 16px; line-height: 1.2; font-weight: 800; cursor: pointer; text-decoration: none; box-shadow: 0 18px 38px -12px rgba(22,18,28,.5); -webkit-tap-highlight-color: transparent; }
/* o portal cai no body, fora do app: regras globais de "botão com ícone" (button:has(svg)) davam padding e content-box */
.bpt-rodape .bpt-botao, .bpt-rodape .bpt-botao:has(svg) { box-sizing: border-box !important; padding: 0 16px !important; margin: 0 !important; height: ${ALTURA_BOTAO}px !important; min-height: 0 !important; }
.bpt-botao:active { transform: scale(.985); }
.bpt-botao:disabled { opacity: .45; box-shadow: none; }
`;
