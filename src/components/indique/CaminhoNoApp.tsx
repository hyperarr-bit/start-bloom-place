import { CAMINHO_NO_APP, ENDERECO_RECUPERAR } from "../../../supabase/functions/_shared/indique";

/**
 * ONDE ACHAR O LINK DEPOIS (críticas da subida 17/11): o caminho principal é um ENDEREÇO que funciona sem login, em qualquer aparelho —
 * "Perdeu o link? Entre em coreaplicativo.com.br/indique e digite seu e-mail". A trilha "Você → Indique e ganhe" vira a 2ª linha, só
 * pro computador (no app das lojas a entrada não existe; mandar procurar lá gerava chamado no suporte). O mesmo desenho da tela
 * "link pronto" da /oferta (src/landing/indique.ts, CAMINHO_HTML). Usado no painel (/indique/:token).
 */
export function CaminhoNoApp({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/80 border border-[#ece9ef] px-3 py-3 text-center ${className}`} data-testid="indique-caminho">
      <p className="text-[13px] font-semibold leading-snug text-[#4a4252]" data-testid="indique-recuperar-frase">
        Perdeu o link? Entre em <a href="/indique" className="font-bold text-[#C42A73] underline underline-offset-2">{ENDERECO_RECUPERAR}</a> e digite seu e-mail.
      </p>
      <p className="mt-2 text-[12px] font-semibold leading-snug text-[#6b6670]">ou, no computador:</p>
      <div className="mt-2 flex items-center justify-center gap-[7px] flex-wrap" aria-label={CAMINHO_NO_APP}>
        <span className="inline-flex items-center gap-1.5 h-[30px] pl-[5px] pr-[11px] rounded-full bg-white border border-[#17111c1f] text-[12.5px] font-bold text-[#17111C] whitespace-nowrap">
          <span className="grid place-items-center w-[21px] h-[21px] rounded-full bg-[#17111c1a]" aria-hidden>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z" /></svg>
          </span>
          Você
        </span>
        <span className="text-[14px] font-extrabold text-[#9a93a0]" aria-hidden>→</span>
        <span className="inline-flex items-center gap-1.5 h-[30px] pl-[5px] pr-[11px] rounded-full bg-white border border-[#E0337F] text-[12.5px] font-bold text-[#17111C] whitespace-nowrap" style={{ boxShadow: "0 0 0 3px rgba(224,51,127,.14)" }}>
          <span className="grid place-items-center w-[21px] h-[21px] rounded-full bg-[#fde6f1] text-[11px]" aria-hidden>💗</span>
          Indique e ganhe
        </span>
      </div>
    </div>
  );
}
