import { QRCodeSVG } from "qrcode.react";
import { BotaoPorta } from "./BotaoPorta";
import { ONDE_FICA_ENTRAR, TEXTO_ENTRAR_NO_APP } from "./conteudo";

/**
 * TELA 7 DA PORTA — "Pronto, seu plano está salvo ✓".
 *
 * A ÚNICA tela que fala de "3 dias grátis" (e só onde é verdade: o teste de
 * 3 dias existe no iPhone; no Android não há teste, então lá a frase não diz).
 * Ensina o toque certo no app com os prints REAIS do /como-entrar: abrir o
 * CORE e tocar em "Entrar", logo abaixo do Começar (vale pra 1.0.12 e pra 1.0.14)
 * com o MESMO e-mail. O botão vai pro /baixar (302 pra loja do aparelho; o
 * /baixar já trata o navegador do Instagram).
 *
 * Quando a aba volta a ficar visível depois do clique na loja, o título vira
 * "Já instalou? Abra o CORE e toque em Entrar".
 *
 * 10/10 — COM o código do porta-handoff (`abrirApp` = core://porta?c=…, só iPhone): "Abrir o CORE" logo
 * abaixo do título (o app troca o código por sessão e abre JÁ LOGADO, no paywall); na volta da loja ele
 * vira o botão PRINCIPAL e a loja fica secundária. Os passos "toque em Entrar" continuam: são a rede pra
 * a versão do app que ainda não conhece o link (1.0.14) e pro código que falhar.
 */
export type Plataforma = "ios" | "android" | "web";
const MAGENTA = "#d22d80";

function Passo({ n, children, print, alt }: { n: number; children: React.ReactNode; print?: string; alt?: string }) {
  return (
    <li className="flex items-start gap-3" data-testid={`porta-passo-${n}`}>
      <span className="grid place-items-center w-7 h-7 rounded-full text-white text-[13px] font-black shrink-0 mt-0.5" style={{ background: MAGENTA }} aria-hidden>{n}</span>
      <div className="flex-1 min-w-0 text-[15px] leading-snug text-[#16121c] pt-[3px]">{children}</div>
      {print && (
        <div className="w-[96px] shrink-0 rounded-[16px] border-[4px] border-[#16121c] bg-[#16121c] overflow-hidden shadow-md">
          <img src={print} alt={alt ?? ""} width={390} height={844} loading="lazy" className="block w-full h-auto rounded-[12px]" />
        </div>
      )}
    </li>
  );
}

const Apple = () => (
  <svg viewBox="0 0 384 512" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export function SalvoPorta({ email, metodo, plataforma, voltou, contagem = null, hrefLoja, qrUrl, onLoja, abrirApp = null, onAbrirApp }: {
  email: string;
  metodo: string;
  plataforma: Plataforma;
  voltou: boolean;
  /** segundos até a loja abrir sozinha (null = sem contagem) */
  contagem?: number | null;
  hrefLoja: (loja: "ios" | "android" | null) => string;
  qrUrl: string;
  onLoja: (loja: "ios" | "android") => void;
  /** core://porta?c=<código> — null sem código (ou fora do iPhone) */
  abrirApp?: string | null;
  onAbrirApp?: (onde: "topo" | "principal") => void;
}) {
  const android = plataforma === "android";
  const web = plataforma === "web";
  const prints = android ? "android" : "ios";
  const google = metodo === "google";
  const loja = android ? "Google Play" : "App Store";

  return (
    <div className="flex-1 flex flex-col" data-testid="porta-salvo" data-plataforma={plataforma} data-voltou={voltou ? "" : undefined}>
      <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] text-balance" data-testid="porta-salvo-titulo">
        {voltou ? (abrirApp ? "Já instalou? Toque em Abrir o CORE" : "Já instalou? Abra o CORE e toque em Entrar") : "Pronto, seu plano está salvo ✓"}
      </h1>

      {abrirApp && !voltou && (
        <a
          href={abrirApp} onClick={() => onAbrirApp?.("topo")} data-testid="porta-abrir-app-topo"
          className="mt-4 flex items-center justify-center gap-2 h-12 rounded-full border-2 text-[15.5px] font-extrabold no-underline active:scale-[.985]"
          style={{ borderColor: MAGENTA, color: MAGENTA }}
        >
          Já instalei: abrir o CORE
        </a>
      )}

      <div className="mt-4 rounded-2xl border-2 bg-white px-4 py-3" style={{ borderColor: MAGENTA }} data-testid="porta-salvo-email">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7d8691]">{google ? "Sua conta Google" : metodo === "apple" ? "Sua conta Apple" : "Sua conta"}</p>
        {/* e-mail comprido (o "esconder meu e-mail" da Apple tem ~35 letras) desce a fonte em vez de quebrar no meio */}
        <p className={`${email.length > 26 ? "text-[14.5px]" : "text-[18px]"} font-extrabold text-[#16121c] mt-0.5 break-all`}>{email}</p>
      </div>

      {contagem != null && (
        <p className="mt-3 text-[13.5px] font-bold" style={{ color: MAGENTA }} data-testid="porta-salvo-contagem" aria-live="polite">
          Abrindo a {loja} em {contagem}…
        </p>
      )}

      <p className="text-[15px] text-[#5b6570] leading-snug mt-4" data-testid="porta-salvo-texto">
        {android
          ? <>Baixe o CORE, toque em <b className="text-[#16121c]">“{TEXTO_ENTRAR_NO_APP}”</b> com este e-mail e comece.</>
          : web
            ? <>Baixe o CORE no celular, toque em <b className="text-[#16121c]">“{TEXTO_ENTRAR_NO_APP}”</b> com este e-mail e comece seus 3 dias grátis no iPhone.</>
            : <>Baixe o CORE, toque em <b className="text-[#16121c]">“{TEXTO_ENTRAR_NO_APP}”</b> com este e-mail e comece seus 3 dias grátis.</>}
      </p>

      <ol className="mt-5 space-y-4" data-testid="porta-salvo-passos">
        <Passo n={1}>
          <p>{web ? <>Aponte a câmera do celular pro código e baixe o <b>CORE</b>.</> : <>Baixe o <b>CORE</b> na {loja}.</>}</p>
          {web && (
            <div className="mt-3 block w-fit rounded-2xl border border-[#ebe7ef] bg-white p-2.5" data-testid="porta-qr">
              <QRCodeSVG value={qrUrl} size={132} level="M" />
            </div>
          )}
        </Passo>
        <Passo n={2} print={`/como-entrar/1-tela-inicial-${prints}.jpg`} alt={`Tela inicial do app com “${TEXTO_ENTRAR_NO_APP}” destacado`}>
          Abra o app e toque em <b>“{TEXTO_ENTRAR_NO_APP}”</b>, {ONDE_FICA_ENTRAR}. Não toque em “Começar”.
        </Passo>
        {/* o passo 3 é o jeito que ELA criou a conta (prints do /entrar do app com o anel no botão certo: public/porta/) */}
        {metodo === "google" ? (
          <Passo n={3} print={`/porta/entrar-google-${prints}.jpg`} alt="Tela de entrar do app com “Continuar com Google” destacado">
            Toque em <b>“Continuar com Google”</b> e escolha esta conta.
          </Passo>
        ) : metodo === "apple" ? (
          <Passo n={3} print="/porta/entrar-apple-ios.jpg" alt="Tela de entrar do app com “Continuar com a Apple” destacado">
            Toque em <b>“Continuar com a Apple”</b>.
          </Passo>
        ) : metodo === "senha" ? (
          <Passo n={3} print={`/porta/entrar-senha-${prints}.jpg`} alt="Tela de entrar do app com o e-mail e a senha destacados">
            Digite este e-mail e a sua senha e toque em <b>“Entrar no meu CORE”</b>.
          </Passo>
        ) : (
          <Passo n={3}>Entre com este e-mail, do jeito que você já entra na sua conta.</Passo>
        )}
      </ol>

      {web && (
        <p className="mt-5 text-[14px] text-[#5b6570] leading-snug" data-testid="porta-salvo-computador">
          No computador você também usa: entre em <a href="/entrar" className="font-bold text-[#16121c] underline underline-offset-2">coreaplicativo.com.br</a>
        </p>
      )}

      {android ? (
        <BotaoPorta texto="Baixar no Google Play" seta={false} href={hrefLoja(null)} onClick={() => onLoja("android")} testid="porta-loja" />
      ) : web ? (
        <BotaoPorta
          texto="Baixar na App Store" seta={false} icone={<Apple />} href={hrefLoja("ios")} onClick={() => onLoja("ios")} testid="porta-loja"
          secundario={{ texto: <>Tenho <b>Android</b></>, href: hrefLoja("android"), onClick: () => onLoja("android"), testid: "porta-loja-android" }}
        />
      ) : abrirApp && voltou ? (
        <BotaoPorta
          texto="Abrir o CORE" seta={false} href={abrirApp} onClick={() => onAbrirApp?.("principal")} testid="porta-abrir-app"
          secundario={{ texto: <>Ainda não baixou? <b>App Store</b></>, href: hrefLoja(null), onClick: () => onLoja("ios"), testid: "porta-loja" }}
        />
      ) : (
        <BotaoPorta texto={voltou ? "Abrir a App Store de novo" : "Baixar na App Store"} seta={false} icone={<Apple />} href={hrefLoja(null)} onClick={() => onLoja("ios")} testid="porta-loja" />
      )}
    </div>
  );
}
