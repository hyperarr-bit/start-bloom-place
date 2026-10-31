import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, ChevronLeft, Copy, LoaderCircle, Printer, Share } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { plataformaApp } from "@/lib/native-shell";
import { A4_PX, folhasDoPlanner, lerExtrasDoPlanner, resumoDoPlanner, type DadosDoPlanner, type EstiloPlanner } from "@/lib/planner-2027";
import { ehIos, garantirCssDoPlanner, imprimirPlannerNoSite, modoDeEntrega, prepararFolhas, type FolhasProntas, type ModoDeEntrega } from "@/lib/planner-2027-baixar";
import { LINK_DO_PLANNER, portaDoLink } from "@/lib/planner-2027-chave";
import type { Cofrinho2027, Plano2027 } from "@/lib/pacote-2027";

/** crítica r1 (compradora BAIXA 3): 0,25 empurrava o botão pra baixo da dobra na conta vazia em 390×690 */
const ESCALA = 0.2;
/** crítica r2 (compradora MEDIA 5): em tela baixa (< 720 px) a prévia encolhe mais, e o botão fica na 1ª tela */
const ESCALA_TELA_BAIXA = 0.17;
const escalaDaTela = () => { try { return typeof window !== "undefined" && window.innerHeight > 0 && window.innerHeight < 720 ? ESCALA_TELA_BAIXA : ESCALA; } catch { return ESCALA; } };
/** quanto esperar depois de abrir antes de começar a preparar as folhas (a prévia pinta primeiro) */
const ESPERA_PRA_PREPARAR_MS = 500;

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

export { LINK_DO_PLANNER };

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
 * botão que funciona ONDE ela está (planner-2027-baixar.ts → modoDeEntrega): app = folha nativa; Safari do iPhone =
 * prepara as folhas e compartilha (Salvar imagens / Imprimir); navegador do Instagram sem isso = as folhas viram imagens
 * pra "toque e segure" + o link pela porta /entrar; PC e Chrome do Android = imprimir/PDF.
 * crítica r2: as folhas começam a ser preparadas quando a tela abre (técnico MEDIA 4: 5–11 s no celular) — no app e no
 * Safari, quando ela toca, o normal é já estar pronto. Quem planejou pouco vê um convite de 1 linha (não bloqueia).
 */
export function PlannerB({ dados, estilo, via, onVoltar, onPlanejar }: { dados: DadosDoPlanner; estilo: EstiloPlanner; via?: string; onVoltar: () => void; onPlanejar: () => void }) {
  /* 31/10 teste A/B dos desenhos: todo evento do planner leva o braço (o mesmo nome dos eventos da oferta) */
  const doBraco = { braco_planner: estilo, ...(via ? { braco_planner_via: via } : {}) };
  const [modo, setModo] = useState<ModoDeEntrega>(() => modoDeEntrega());
  const [escala] = useState(escalaDaTela);
  const nativo = modo === "nativo";
  const ios = ehIos();
  const folhas = useMemo(() => folhasDoPlanner(dados, estilo), [dados, estilo]);
  const r = resumoDoPlanner(dados);
  const [feitas, setFeitas] = useState<number | null>(null);
  /** as folhas prontas (PNG + o compartilhar) */
  const [prontas, setProntas] = useState<FolhasProntas | null>(null);
  const [falhouPreparar, setFalhouPreparar] = useState(false);
  /** navegador do Instagram: as folhas como imagem (toque e segure → salvar) */
  const [imagens, setImagens] = useState<string[] | null>(null);
  const preparo = useRef<Promise<FolhasProntas | null> | null>(null);
  const enviando = useRef(false);
  const vivo = useRef(true);

  useEffect(() => { garantirCssDoPlanner(estilo); }, [estilo]);
  useEffect(() => {
    trackEvent("plano2027_planner_view", { estilo, nativo, modo, metas: r.metas, datas: r.datas, habitos: r.habitos, contas: r.contas, pouco: r.pouco, ...doBraco });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** prepara as 12 folhas 1 vez (a 2ª chamada devolve a mesma promessa) */
  const preparar = () => {
    if (preparo.current) return preparo.current;
    setFeitas(0);
    setFalhouPreparar(false);
    const inicio = Date.now();
    preparo.current = prepararFolhas(dados, estilo, (n) => { if (vivo.current) setFeitas(n); })
      .catch(() => null)
      .then((p) => {
        trackEvent("plano2027_planner_preparado", { ok: !!p, ms: Date.now() - inicio, estilo, modo, ...doBraco });
        if (!vivo.current) return p;
        setFeitas(null);
        if (p) setProntas(p);
        else { preparo.current = null; setFalhouPreparar(true); }
        return p;
      });
    return preparo.current;
  };

  // crítica r2 (técnico MEDIA 4): começa a preparar quando a tela abre — menos o PC/Android, que imprimem o HTML
  useEffect(() => {
    vivo.current = true;
    if (modo === "imprimir") return () => { vivo.current = false; };
    const t = window.setTimeout(() => { void preparar(); }, ESPERA_PRA_PREPARAR_MS);
    return () => { window.clearTimeout(t); vivo.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // navegador do Instagram: as folhas prontas viram imagens na prévia (toque e segure)
  useEffect(() => {
    if (modo !== "safari" || !prontas || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const urls = prontas.blobs.map((b) => URL.createObjectURL(b));
    setImagens(urls);
    return () => { urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* noop */ } }); };
  }, [modo, prontas]);

  const itens: { ok: boolean; texto: string }[] = [
    { ok: r.metas > 0, texto: r.metas ? `${r.metas === 1 ? "1 meta" : `${r.metas} metas`} de 2027` : "Metas: linhas pra escrever" },
    { ok: r.dinheiro, texto: r.dinheiro ? "Gastar e guardar por mês" : "Dinheiro: linhas pra escrever" },
    { ok: r.datas > 0, texto: r.datas ? `${r.datas === 1 ? "1 data marcada" : `${r.datas} datas marcadas`} no calendário` : "Calendário pra marcar" },
    { ok: r.habitos > 0, texto: r.habitos ? `${r.habitos === 1 ? "1 hábito" : `${r.habitos} hábitos`} da sua Rotina` : "Hábitos: linhas pra escrever" },
    { ok: r.contas > 0, texto: r.contas ? `${r.contas === 1 ? "1 conta fixa" : `${r.contas} contas fixas`} do Finanças` : "Contas fixas: linhas pra escrever" },
  ];

  const falhou = () => toast.error("Não deu pra preparar as folhas. Tenta de novo.");

  /** crítica r2 (técnico ALTA 1): o share recusou (Chromium > 10 arquivos, gesto vencido) → a impressão, nunca um beco */
  const irPraImpressao = () => {
    setModo("imprimir");
    toast.error("Não deu pra salvar as imagens. Toque em Imprimir e escolha Salvar como PDF.");
  };

  const baixar = async () => {
    trackEvent("plano2027_pdf", { nativo, modo, versao: "b", estilo, pouco: r.pouco, ...doBraco });
    if (modo === "imprimir") {
      if (!imprimirPlannerNoSite(dados, estilo)) toast.error("A janela de impressão não abriu. Toque de novo.");
      return;
    }
    if (enviando.current) return;
    enviando.current = true;
    try {
      const p = await preparar();
      if (!p) { trackEvent("plano2027_pdf_resultado", { resultado: "failed", estilo, modo, ...doBraco }); falhou(); return; }
      // app: o share do Capacitor não pede gesto recente — manda já. Site: o 2º toque (botão "Salvar as 12 folhas").
      if (nativo) {
        const res = await p.compartilhar();
        trackEvent("plano2027_pdf_resultado", { resultado: res, estilo, modo, ...doBraco });
        if (res === "failed") falhou();
      }
    } finally {
      enviando.current = false;
    }
  };

  /** Safari do iPhone, com as folhas prontas: o navigator.share sai direto do gesto */
  const compartilharAgora = () => {
    if (!prontas) return;
    void prontas.compartilhar().then((res) => {
      trackEvent("plano2027_pdf_resultado", { resultado: res, estilo, modo, ...doBraco });
      if (res === "failed") irPraImpressao();
    });
  };

  const copiarLink = async () => {
    const ok = await copiar(`${location.origin}${portaDoLink(LINK_DO_PLANNER)}`);
    trackEvent("plano2027_pdf_resultado", { resultado: ok ? "link_copiado" : "link_falhou", estilo, modo, ...doBraco });
    if (ok) toast.success(`Link copiado. Cole no ${ios ? "Safari" : "navegador"}.`);
    else toast.error(`Não deu pra copiar. Abra o site no ${ios ? "Safari" : "navegador"}.`);
  };

  const botao = "w-full h-12 rounded-full bg-foreground text-background text-[14.5px] font-extrabold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-80";
  const preparando = feitas !== null;
  const largura = A4_PX.largura * escala, altura = A4_PX.altura * escala;

  return (
    <div className="space-y-4 pb-6" data-testid="planner-b" data-estilo={estilo} data-modo={modo}>
      <button type="button" onClick={onVoltar} className="text-[12px] font-bold text-muted-foreground inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /><span>Seu 2027</span></button>
      <div>
        <h2 className="text-[24px] leading-tight font-black tracking-tight">Seu planner 2027</h2>
        <p className="text-[13.5px] text-muted-foreground mt-1">12 folhas A4, montadas com o que você tem no CORE.</p>
      </div>

      <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none]" data-testid="planner-b-previa">
        {imagens
          ? imagens.map((u, i) => (
            <img key={i} src={u} alt={`Folha ${i + 1}: ${ROTULOS[i]}`} width={largura} height={altura} data-testid="planner-b-imagem"
              className="shrink-0 rounded-[10px] bg-white shadow-[0_6px_22px_-8px_rgba(0,0,0,.28)] ring-1 ring-black/5 snap-start"
              style={{ width: largura, height: altura, WebkitTouchCallout: "default", WebkitUserSelect: "auto", userSelect: "auto" } as CSSProperties} />
          ))
          : folhas.map((h, i) => <FolhaMini key={i} html={h} estilo={estilo} escala={escala} rotulo={`Folha ${i + 1}: ${ROTULOS[i]}`} />)}
      </div>

      {modo === "safari" ? (
        <div className="rounded-xl border border-border bg-card p-4 text-center" data-testid="planner-b-safari">
          {imagens ? (
            <>
              <p className="text-[14px] font-extrabold leading-snug" data-testid="planner-b-segure">Toque e segure uma folha pra salvar</p>
              <p className="text-[12.5px] text-muted-foreground mt-1">São 12: deslize pro lado. Ou abra no {ios ? "Safari" : "navegador"} e salve todas juntas.</p>
            </>
          ) : preparando ? (
            <p className="text-[13.5px] font-bold inline-flex items-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin" /><span>Preparando {feitas} de {folhas.length}…</span></p>
          ) : (
            <>
              <p className="text-[14px] font-extrabold leading-snug">Pra salvar o planner, abra no {ios ? "Safari" : "navegador"}</p>
              <p className="text-[12.5px] text-muted-foreground mt-1">Toque em ••• no canto e “Abrir no navegador”. Ou copie o link e cole lá.</p>
            </>
          )}
          <button type="button" onClick={() => void copiarLink()} data-testid="planner-b-copiar-link"
            className={imagens || preparando ? "mt-3 h-11 px-4 rounded-full border border-border text-[13px] font-bold inline-flex items-center justify-center gap-2" : `${botao} mt-3`}>
            <Copy className="w-4 h-4" /><span>Copiar o link</span>
          </button>
        </div>
      ) : (
        <div>
          {prontas && modo === "compartilhar" ? (
            <button type="button" onClick={compartilharAgora} data-testid="planner-b-compartilhar" className={botao}>
              <Share className="w-4 h-4" /><span>Salvar as 12 folhas</span>
            </button>
          ) : (
            <button type="button" onClick={() => void baixar()} disabled={modo === "compartilhar" && preparando} data-testid="planner-b-baixar" className={botao}>
              {preparando && modo !== "imprimir"
                ? <><LoaderCircle className="w-4 h-4 animate-spin" /><span>Preparando {feitas} de {folhas.length}…</span></>
                : nativo ? <><Share className="w-4 h-4" /><span>Salvar ou imprimir</span></>
                : modo === "compartilhar" ? <><Share className="w-4 h-4" /><span>{falhouPreparar ? "Tentar de novo" : "Preparar as 12 folhas"}</span></>
                : <><Printer className="w-4 h-4" /><span>Imprimir ou salvar em PDF</span></>}
            </button>
          )}
          <p className="text-[11.5px] text-muted-foreground text-center mt-1.5">{dicaDe(modo, ios, !!prontas)}</p>
        </div>
      )}

      {r.pouco && (
        // crítica r2 (compradora MEDIA 5): 1 linha, DEPOIS do botão (o card de 2 linhas + botão empurrava o salvar pra baixo da dobra)
        <button type="button" data-testid="planner-b-planejar" onClick={() => { trackEvent("plano2027_aberto", { via: "planner_b" }); onPlanejar(); }}
          className="w-full rounded-xl border-2 border-accent/40 bg-accent/5 px-4 py-3 text-left text-[13px] font-bold leading-snug inline-flex items-center justify-between gap-2">
          <span>Planeje em 5 min e ele sai com as suas metas</span><ArrowRight className="w-4 h-4 shrink-0" />
        </button>
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
export default function PlannerDoPacote({ plano, cofrinho, get, estilo, via, onVoltar, onPlanejar }: {
  plano: Plano2027; cofrinho: Cofrinho2027; get: <T>(k: string, f: T) => T; estilo: EstiloPlanner; via?: string; onVoltar: () => void; onPlanejar: () => void;
}) {
  const dados = useMemo<DadosDoPlanner>(() => ({ plano, cofrinho, ...lerExtrasDoPlanner(get) }), [plano, cofrinho, get]);
  return <PlannerB dados={dados} estilo={estilo} via={via} onVoltar={onVoltar} onPlanejar={onPlanejar} />;
}
