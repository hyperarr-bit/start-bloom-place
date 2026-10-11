import { BotaoPorta } from "./BotaoPorta";
import type { Plataforma } from "./SalvoPorta";

/**
 * O ÚLTIMO PASSO (10/10, dono: "muita gente não vai ler e ver o Entrar — põe uma tela antes mostrando a tela
 * inicial e falando pra clicar em Entrar"). UMA instrução, com o print grande da tela inicial do app e o
 * "Entrar" marcado. O botão já abre a loja (toque da pessoa = o jeito mais garantido no Instagram); quem volta
 * da loja cai na tela 7 ("Já instalou? Abra o CORE e toque em Entrar").
 * Computador não passa por aqui (lá é o QR da tela 7).
 * Quando a 1.0.14 for a versão da loja, trocar o print pela welcome nova ("Já tem conta? Entrar" abaixo do Começar).
 */
const MAGENTA = "#d22d80";

const Apple = () => (
  <svg viewBox="0 0 384 512" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export function InstrucaoPorta({ plataforma, metodo, email, hrefLoja, onBaixar, contagem = null }: {
  plataforma: Plataforma;
  metodo: string;
  email: string;
  hrefLoja: string;
  onBaixar: () => void;
  /** segundos até a loja abrir sozinha (null = sem contagem) */
  contagem?: number | null;
}) {
  const android = plataforma === "android";
  const so = android ? "android" : "ios";
  /* 10/10 (dono: "tem que ter a parte de continuar com a Apple também explicar"): os DOIS toques com print —
   * 1) Entrar na tela inicial; 2) o botão do jeito que a conta foi criada, na tela de entrar do app. */
  const m = metodo === "apple" || metodo === "google" ? metodo : "senha";
  const segundo = m === "apple"
    ? <>Toque em <b>“Continuar com a Apple”</b></>
    : m === "google"
      ? <>Toque em <b>“Continuar com Google”</b></>
      : <>Entre com <b className="break-all">{email}</b> e a sua senha</>;
  return (
    <div className="flex-1 flex flex-col" data-testid="porta-instrucao">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: MAGENTA }}>Último passo</p>
      <h1 className="mt-1 text-[30px] font-black tracking-[-0.03em] leading-[1.05]" data-testid="porta-instrucao-titulo">No app, toque em Entrar</h1>
      <p className="mt-2 text-[15.5px] text-[#5b6570] leading-snug">Sua conta já está pronta. <b className="text-[#16121c]">Não toque em Começar.</b></p>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 py-4 items-start">
        {[
          { n: 1, txt: <>Toque em <b>“Entrar”</b>, abaixo do Começar</>, src: `/como-entrar/1-tela-inicial-${so}.jpg`, alt: "Tela inicial do CORE com o Entrar marcado", id: "porta-instrucao-print" },
          { n: 2, txt: segundo, src: `/porta/entrar-${m}-${so}.jpg`, alt: "Tela de entrar do CORE com o botão marcado", id: "porta-instrucao-print-2" },
        ].map((p) => (
          <div key={p.n} className="flex flex-col items-center text-center">
            <div className="w-full max-w-[170px] aspect-[390/844] rounded-[22px] border-[5px] border-[#16121c] bg-[#16121c] overflow-hidden shadow-[0_18px_36px_-18px_rgba(22,18,28,.55)]">
              <img src={p.src} alt={p.alt} className="block w-full h-full object-cover rounded-[17px]" data-testid={p.id} />
            </div>
            <div className="mt-3 flex items-start gap-2 text-left">
              <span className="grid place-items-center w-6 h-6 rounded-full text-white text-[12px] font-black shrink-0" style={{ background: MAGENTA }} aria-hidden>{p.n}</span>
              <p className="text-[13.5px] leading-snug text-[#16121c]" data-testid={`porta-instrucao-passo-${p.n}`}>{p.txt}</p>
            </div>
          </div>
        ))}
      </div>

      {contagem != null && (
        <p className="text-center text-[13.5px] font-bold pb-2" style={{ color: MAGENTA }} data-testid="porta-instrucao-contagem" aria-live="polite">
          Abrindo a {android ? "Google Play" : "App Store"} em {contagem}…
        </p>
      )}
      <BotaoPorta
        texto="Entendi, baixar o CORE" seta={false} icone={android ? undefined : <Apple />}
        href={hrefLoja} onClick={() => onBaixar()} testid="porta-instrucao-baixar"
      />
    </div>
  );
}
