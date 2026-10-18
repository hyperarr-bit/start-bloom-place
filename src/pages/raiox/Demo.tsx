import { useEffect, useRef, useState } from "react";
import { DEMO_CTA, EMOJI, ROTULO, ROTEIRO_DEMO, reais, type Chave } from "./conteudo";

const DURACAO = 12_000;
const VIDEO_MAX = 1_500_000;

/** HEAD 200 não basta: a Vercel reescreve caminho sem arquivo pro index.html. */
// eslint-disable-next-line react-refresh/only-export-components -- predicado puro, ao lado de quem usa
export function demoTemVideo(contentType: string | null, bytes: number): boolean {
  const tipo = (contentType || "").toLowerCase();
  if (!tipo.includes("video") && !tipo.includes("mp4") && !tipo.includes("octet-stream")) return false;
  return bytes === 0 || bytes <= VIDEO_MAX;
}

/**
 * Demo muda, 10–15 s, uma vez. "Pular" desde o 1º segundo.
 * Se existir /raiox/demo-{chave}.mp4 (até 1,5 MB), o vídeo entra no lugar da animação.
 * prefers-reduced-motion: frames parados e "Próximo".
 */
export default function Demo({ chave, semanal, onPular, onFim, onCta }: {
  chave: Chave;
  semanal: number;
  onPular: (segundo: number) => void;
  onFim: () => void;
  onCta: () => void;
}) {
  const reduzido = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [ms, setMs] = useState(0);
  const [frame, setFrame] = useState(0);
  const [video, setVideo] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const acabou = useRef(false);
  const roteiro = ROTEIRO_DEMO[chave];

  useEffect(() => {
    let vivo = true;
    const url = `/raiox/demo-${chave}.mp4`;
    fetch(url, { method: "HEAD" }).then((r) => {
      if (!vivo || !r.ok) return;
      // Sem o arquivo, a Vercel (e o Vite) devolvem o index.html com 200.
      // Só entra vídeo de verdade — senão a animação some atrás de um player vazio.
      const len = Number(r.headers.get("content-length") || 0);
      if (demoTemVideo(r.headers.get("content-type"), len)) setVideo(url);
    }).catch(() => { /* sem vídeo: fica a animação */ });
    return () => { vivo = false; };
  }, [chave]);

  useEffect(() => {
    if (reduzido || video) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const passou = performance.now() - t0;
      setMs(passou);
      if (passou >= DURACAO && !acabou.current) {
        acabou.current = true;
        setFim(true);
        onFim();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [reduzido, video, onFim]);

  const segundo = Math.floor(ms / 1000);
  const beat = fim ? 2 : ms < 4000 ? 0 : ms < 8000 ? 1 : 2;
  const mostrarPular = reduzido || segundo >= 1 || fim;
  const valor = Math.round((Math.min(ms, DURACAO) / DURACAO) * semanal);

  const pular = () => onPular(Math.max(1, segundo));

  return (
    <div data-testid="raiox-demo" data-chave={chave} data-frame={reduzido ? frame : beat} data-fim={fim ? "1" : "0"}>
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#737373]">Por dentro do CORE</p>
      <h1 className="mt-2 text-[26px] font-extrabold leading-[30px]">{roteiro.titulo}</h1>
      <div className="mx-auto mt-5 w-full max-w-[280px] overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_16px_40px_-24px_rgba(0,0,0,.35)]">
        {video && !reduzido ? (
          <video
            data-testid="raiox-demo-video" src={video} autoPlay muted playsInline
            className="block aspect-[9/16] w-full bg-[#F7F5F3] object-cover"
            onEnded={() => { if (!acabou.current) { acabou.current = true; setFim(true); onFim(); } }}
          />
        ) : (
          <div className="aspect-[9/16] bg-[#F7F5F3] px-4 py-5" data-testid="raiox-demo-palco">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[#737373]">CORE</p>
            <p className="mt-6 text-[20px] leading-tight" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}>
              {EMOJI[chave]} {roteiro.beats[reduzido ? frame : beat]}
            </p>
            <p className="mt-2 text-[13px] text-[#737373]">{ROTULO[chave]}</p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#D22D80]" style={{ width: `${reduzido ? ((frame + 1) / 3) * 100 : Math.min(100, (ms / DURACAO) * 100)}%` }} />
            </div>
            {!reduzido && semanal > 0 && (
              <p data-testid="raiox-demo-valor" className="mt-4 text-[28px] text-[#30A65B]" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}>
                R$ {reais(valor)}
              </p>
            )}
            {!reduzido && <p className="text-[11px] text-[#737373]">estimativa desta semana, se fechar</p>}
            {(fim || (reduzido && frame === 2)) && (
              <p className="mt-4 inline-block rounded-full bg-[#FAF0D1] px-3 py-1 text-[12px] font-bold">Selo da semana</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        {mostrarPular && (
          <button type="button" data-testid="raiox-demo-pular" onClick={pular} className="text-[15px] font-semibold text-[#737373]">
            Pular →
          </button>
        )}
        {reduzido && frame < 2 && (
          <button type="button" data-testid="raiox-demo-proximo" onClick={() => setFrame((f) => Math.min(2, f + 1))} className="ml-auto h-12 rounded-full bg-[#333] px-5 text-[15px] font-semibold text-white">
            Próximo
          </button>
        )}
        {(fim || (reduzido && frame === 2)) && (
          <button type="button" data-testid="raiox-demo-cta" onClick={onCta} className="ml-auto h-14 rounded-full bg-[#333] px-6 text-[17px] font-semibold text-white">
            {DEMO_CTA}
          </button>
        )}
      </div>
    </div>
  );
}
