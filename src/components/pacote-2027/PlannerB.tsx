import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Copy, LoaderCircle, Printer, Share } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { plataformaApp } from "@/lib/native-shell";
import { A4_PX, folhasDoPlanner, lerExtrasDoPlanner, resumoDoPlanner, type DadosDoPlanner, type EstiloPlanner } from "@/lib/planner-2027";
import { ehIos, garantirCssDoPlanner, imprimirPlannerNoSite, modoDeEntrega, prepararFolhas, salvarPlannerNoAparelho, type ModoDeEntrega } from "@/lib/planner-2027-baixar";
import type { Cofrinho2027, Plano2027 } from "@/lib/pacote-2027";

/** crítica r1 (compradora BAIXA 3): 0,25 empurrava o botão pra baixo da dobra na conta vazia em 390×690 */
const ESCALA = 0.2;

/** Uma folha em miniatura: o MESMO HTML que vai pra impressão / PNG, só reduzido. */
export function FolhaMini({ html, estilo, escala = ESCALA, rotulo }: { html: string; estilo: EstiloPlanner; escala?: number; rotulo: string }) {
  return (
    <div role="img" aria-label={rotulo} className="shrink-0 overflow-hidden rounded-[10px] bg-white shadow-[0_6px_22px_-8px_rgba(0,0,0,.28)] ring-1 ring-black/5 snap-start"
      style={{ width: A4_PX.largura * escala, height: A4_PX.altura * escala }}>
      <div style={{ width: A4_PX.largura, height: A4_PX.altura, transform: `scale(${escala})`, transformOrigin: "0 0" }}
        className={`pl pl-${estilo} pointer-events-none select-none`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const ROTULOS = ["Capa", "Meu ano", "Calendário", "Metas", "Dinheiro", "Rotina", "Cofrinho", "Revisões", "16 áreas", "16 áreas", "16 áreas", "16 áreas"];

/** O link que abre direto o planner (o "Abra no Safari" copia este). */
export const LINK_DO_PLANNER = "/desenvolvimento?tab=2027&planner=1";

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* cai no jeito antigo */ }
  try {
    const t = document.createElement("textarea");
    t.value = texto; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}

/** O texto curto sob o botão, pra cada caminho. */
function dicaDe(modo: ModoDeEntrega, ios: boolean, pronto: boolean): string {
  if (modo === "nativo") return plataformaApp() === "ios" ? "Abre a folha do iPhone: Imprimir, Salvar imagens ou Arquivos." : "Abre a folha de compartilhar: imprimir, salvar ou enviar.";
  if (modo === "compartilhar") return pronto ? (ios ? "Escolha Salvar imagens ou Imprimir." : "Escolha onde salvar ou imprimir.") : "Leva uns segundos. Depois é só salvar ou imprimir.";
  return ios ? "Na impressão, toque em Compartilhar → Salvar em Arquivos." : "Na impressão, escolha “Salvar como PDF” pra guardar.";
}

/**
 * A FOLHA "SEU PLANNER 2027" (versão B, 31/10): a prévia das 12 folhas com os dados dela, o que entrou do CORE e o
 * botão que funciona ONDE ela está (planner-2027-baixar.ts → modoDeEntrega): app = folha nativa; site no celular =
 * prepara as folhas e compartilha (Salvar imagens / Imprimir); navegador do Instagram sem isso = "Abra no Safari";
 * PC = imprimir/PDF. Quem planejou pouco vê um convite curto pra planejar (não bloqueia).
 */
export function PlannerB({ dados, estilo, onVoltar, onPlanejar }: { dados: DadosDoPlanner; estilo: EstiloPlanner; onVoltar: () => void; onPlanejar: () => void }) {
  const [modo] = useState<ModoDeEntrega>(() => modoDeEntrega());
  const nativo = modo === "nativo";
  const ios = ehIos();
  const folhas = useMemo(() => folhasDoPlanner(dados, estilo), [dados, estilo]);
  const r = resumoDoPlanner(dados);
  const [feitas, setFeitas] = useState<number | null>(null);
  /** site no celular: as folhas prontas esperando o 2º toque */
  const [pronto, setPronto] = useState<null | (() => Promise<unknown>)>(null);
  const ocupado = useRef(false);

  useEffect(() => { garantirCssDoPlanner(estilo); }, [estilo]);
  useEffect(() => {
    trackEvent("plano2027_planner_view", { estilo, nativo, modo, metas: r.metas, datas: r.datas, habitos: r.habitos, contas: r.contas, pouco: r.pouco });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itens: { ok: boolean; texto: string }[] = [
    { ok: r.metas > 0, texto: r.metas ? `${r.metas === 1 ? "1 meta" : `${r.metas} metas`} de 2027` : "Metas: linhas pra escrever" },
    { ok: r.dinheiro, texto: r.dinheiro ? "Gastar e guardar por mês" : "Dinheiro: linhas pra escrever" },
    { ok: r.datas > 0, texto: r.datas ? `${r.datas === 1 ? "1 data marcada" : `${r.datas} datas marcadas`} no calendário` : "Calendário pra marcar" },
    { ok: r.habitos > 0, texto: r.habitos ? `${r.habitos === 1 ? "1 hábito" : `${r.habitos} hábitos`} da sua Rotina` : "Hábitos: linhas pra escrever" },
    { ok: r.contas > 0, texto: r.contas ? `${r.contas === 1 ? "1 conta fixa" : `${r.contas} contas fixas`} do Finanças` : "Contas fixas: linhas pra escrever" },
  ];

  const falhou = () => toast.error("Não deu pra preparar as folhas. Tenta de novo.");

  const baixar = async () => {
    if (ocupado.current) return;
    trackEvent("plano2027_pdf", { nativo, modo, versao: "b", estilo, pouco: r.pouco });
    if (modo === "imprimir") {
      if (!imprimirPlannerNoSite(dados, estilo)) toast.error("A janela de impressão não abriu. Toque de novo.");
      return;
    }
    ocupado.current = true;
    setFeitas(0);
    try {
      if (nativo) {
        const res = await salvarPlannerNoAparelho(dados, estilo, (n) => setFeitas(n));
        trackEvent("plano2027_pdf_resultado", { resultado: res, estilo, modo });
        if (res === "failed") falhou();
      } else {
        const compartilhar = await prepararFolhas(dados, estilo, (n) => setFeitas(n));
        if (!compartilhar) { trackEvent("plano2027_pdf_resultado", { resultado: "failed", estilo, modo }); falhou(); }
        else setPronto(() => compartilhar);
      }
    } catch {
      falhou();
    } finally {
      ocupado.current = false;
      setFeitas(null);
    }
  };

  /** site no celular, 2º toque: o navigator.share sai direto do gesto */
  const compartilharAgora = () => {
    if (!pronto) return;
    void pronto().then((res) => {
      trackEvent("plano2027_pdf_resultado", { resultado: res, estilo, modo });
      if (res === "failed") toast.error("Não deu pra compartilhar. Tenta de novo.");
    });
  };

  const copiarLink = async () => {
    const ok = await copiar(`${location.origin}${LINK_DO_PLANNER}`);
    trackEvent("plano2027_pdf_resultado", { resultado: ok ? "link_copiado" : "link_falhou", estilo, modo });
    if (ok) toast.success("Link copiado. Cole no Safari.");
    else toast.error("Não deu pra copiar. Abra o site no Safari.");
  };

  const botao = "w-full h-12 rounded-full bg-foreground text-background text-[14.5px] font-extrabold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-80";

  return (
    <div className="space-y-4 pb-6" data-testid="planner-b" data-estilo={estilo} data-modo={modo}>
      <button type="button" onClick={onVoltar} className="text-[12px] font-bold text-muted-foreground inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /><span>Seu 2027</span></button>
      <div>
        <h2 className="text-[24px] leading-tight font-black tracking-tight">Seu planner 2027</h2>
        <p className="text-[13.5px] text-muted-foreground mt-1">12 folhas A4, montadas com o que você tem no CORE.</p>
      </div>

      <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none]" data-testid="planner-b-previa">
        {folhas.map((h, i) => <FolhaMini key={i} html={h} estilo={estilo} rotulo={`Folha ${i + 1}: ${ROTULOS[i]}`} />)}
      </div>

      {r.pouco && (
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-4" data-testid="planner-b-planejar">
          <p className="text-[13.5px] font-bold leading-snug">Planeje o 2027 e ele sai com as suas metas.</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">5 minutos. Ou imprima assim e escreva à mão.</p>
          <button type="button" onClick={() => { trackEvent("plano2027_aberto", { via: "planner_b" }); onPlanejar(); }}
            className="mt-3 h-10 px-4 rounded-full bg-foreground text-background text-[13px] font-extrabold inline-flex items-center gap-1.5">
            <span>Planejar 2027</span><ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {modo === "safari" ? (
        <div className="rounded-xl border border-border bg-card p-4 text-center" data-testid="planner-b-safari">
          <p className="text-[14px] font-extrabold leading-snug">Pra salvar o planner, abra no {ios ? "Safari" : "navegador"}</p>
          <p className="text-[12.5px] text-muted-foreground mt-1">Toque em ••• no canto e “Abrir no navegador”. Ou copie o link e cole lá.</p>
          <button type="button" onClick={() => void copiarLink()} data-testid="planner-b-copiar-link" className={`${botao} mt-3`}>
            <Copy className="w-4 h-4" /><span>Copiar o link</span>
          </button>
        </div>
      ) : (
        <div>
          {pronto ? (
            <button type="button" onClick={compartilharAgora} data-testid="planner-b-compartilhar" className={botao}>
              <Share className="w-4 h-4" /><span>Salvar as 12 folhas</span>
            </button>
          ) : (
            <button type="button" onClick={() => void baixar()} disabled={feitas !== null} data-testid="planner-b-baixar" className={botao}>
              {feitas !== null
                ? <><LoaderCircle className="w-4 h-4 animate-spin" /><span>Preparando {feitas} de {folhas.length}…</span></>
                : nativo ? <><Share className="w-4 h-4" /><span>Salvar ou imprimir</span></>
                : modo === "compartilhar" ? <><Share className="w-4 h-4" /><span>Preparar as 12 folhas</span></>
                : <><Printer className="w-4 h-4" /><span>Imprimir ou salvar em PDF</span></>}
            </button>
          )}
          <p className="text-[11.5px] text-muted-foreground text-center mt-1.5">{dicaDe(modo, ios, !!pronto)}</p>
        </div>
      )}
      <ul className="bg-card rounded-xl border border-border p-3 space-y-2" data-testid="planner-b-itens">
        {itens.map((it) => (
          <li key={it.texto} className="flex items-center gap-2.5 text-[13px]">
            <span className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${it.ok ? "bg-emerald-500 text-white" : "border-2 border-border"}`}>{it.ok && <Check className="w-3 h-3" strokeWidth={3.2} />}</span>
            <span className={it.ok ? "font-semibold" : "text-muted-foreground"}>{it.texto}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}

/** O que o Pacote2027 monta (carregado sob demanda: com a chave off, nada do planner B entra no módulo). */
export default function PlannerDoPacote({ plano, cofrinho, get, estilo, onVoltar, onPlanejar }: {
  plano: Plano2027; cofrinho: Cofrinho2027; get: <T>(k: string, f: T) => T; estilo: EstiloPlanner; onVoltar: () => void; onPlanejar: () => void;
}) {
  const dados = useMemo<DadosDoPlanner>(() => ({ plano, cofrinho, ...lerExtrasDoPlanner(get) }), [plano, cofrinho, get]);
  return <PlannerB dados={dados} estilo={estilo} onVoltar={onVoltar} onPlanejar={onPlanejar} />;
}
