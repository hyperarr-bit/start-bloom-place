import { useEffect, useRef } from "react";
import { estiloDaFolhaComTeclado, useAreaVisivel } from "@/hooks/use-area-visivel";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Banknote, Check, Delete, Droplets, Dumbbell, Heart, Leaf, Lightbulb, ListTodo, Moon, Plus, Scale, Smile, Utensils, Wallet, X, type LucideIcon } from "lucide-react";
import { HomeE } from "@/components/home-nova/e/HomeE";
import { BarraVidro } from "@/components/home-nova/e/BarraVidro";
import { MolduraIphone } from "@/components/home-nova/MolduraIphone";
import { Anel } from "@/components/home-nova/e/Anel";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, tinta, type Tom } from "@/components/home-nova/e/paleta";
import "@/components/home-nova/home-nova.css";
import "@/components/home-nova/e/home-e.css";
import "./registro-rapido-mockup.css";

/**
 * /dev/registro-rapido — MOCKUP (26/10) do REGISTRO RÁPIDO ("+") com design NOVO de verdade, pra aprovação do dono
 * (regra da casa: mudança visual só depois de mockup aprovado). Nada aqui grava nem está no app de verdade; a Home
 * nova de fundo é a real (dados da conta logada). Rota de dev e de QA (VITE_PORTA_QA) pro vídeo no Simulador.
 *   ?dir=1|2            · D1 "teclado próprio" · D2 "cartões"
 *   ?tela=grade|gasto|agua|humor|treino|ideia
 *   ?teclado=1          · desenha o teclado do SISTEMA (só pro print) nas telas que usam ele
 *   ?teclado=real       · (Simulador) campo de verdade com o teclado do iOS: o DOCUMENTO fica travado (html.rr-trava) e a
 *                         folha se ancora na área visível — é o que prova que o fundo NÃO pula
 *   ?tema=claro|escuro  · ?status=1 (moldura do iPhone)
 *
 * D1 — "TECLADO PRÓPRIO": o "+" abre um PAINEL DE VIDRO compacto flutuando acima do botão (azulejos grandes em grade,
 *      estilo Cal AI). Escolher Gasto/Ganho/Peso/Sono/Água abre uma TELA INTEIRA com o número gigante no centro e um
 *      TECLADO NUMÉRICO DO APP — sem o teclado do iOS, logo sem pulos no fundo. Texto (Ideia, Tarefa, Gratidão): tela
 *      inteira limpa com o campo grande e o teclado do sistema ancorado embaixo.
 * D2 — "CARTÕES": uma folha BAIXA de altura fixa que nunca muda com o teclado (o conteúdo fica acima do teclado,
 *      ancorado no fundo), passos em cartões (grade → formulário) com transições suaves.
 */
type Tela = "grade" | "gasto" | "agua" | "humor" | "treino" | "ideia";
const ACOES: { id: string; Icone: LucideIcon; rotulo: string; tom: Tom; tela?: Tela }[] = [
  { id: "water", Icone: Droplets, rotulo: "Água", tom: TOM_DO_TIPO.agua, tela: "agua" },
  { id: "mood", Icone: Smile, rotulo: "Humor", tom: TOM_DO_TIPO.humor, tela: "humor" },
  { id: "expense", Icone: Wallet, rotulo: "Gasto", tom: TOM_DO_TIPO.gasto, tela: "gasto" },
  { id: "income", Icone: Banknote, rotulo: "Ganho", tom: TOM_DO_MODULO.rotina },
  { id: "task", Icone: ListTodo, rotulo: "Tarefa", tom: TOM_DO_MODULO.casa },
  { id: "workout", Icone: Dumbbell, rotulo: "Treino", tom: TOM_DO_TIPO.treino, tela: "treino" },
  { id: "sleep", Icone: Moon, rotulo: "Sono", tom: TOM_DO_TIPO.sono },
  { id: "meal", Icone: Utensils, rotulo: "Refeição", tom: TOM_DO_TIPO.refeicoes },
  { id: "weight", Icone: Scale, rotulo: "Peso", tom: TOM_DO_TIPO.peso },
  { id: "idea", Icone: Lightbulb, rotulo: "Ideia", tom: TOM_DO_TIPO.ideia, tela: "ideia" },
  { id: "gratitude", Icone: Heart, rotulo: "Gratidão", tom: TOM_DO_TIPO.gratidao },
  { id: "detox", Icone: Leaf, rotulo: "Detox", tom: TOM_DO_MODULO.detox },
];
const CATEGORIAS = ["Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Outros"];
const HUMORES = ["😄", "🙂", "😐", "😕", "😞"];

/** o documento travado enquanto o mockup está na tela: é o que impede o WKWebView de rolar a Home de fundo pra "mostrar" o campo */
const useTravaDoDocumento = (ativa: boolean) => {
  useEffect(() => {
    if (!ativa) return;
    document.documentElement.classList.add("rr-trava");
    return () => document.documentElement.classList.remove("rr-trava");
  }, [ativa]);
};
/** foca o campo depois da folha assentar, sem deixar o navegador rolar nada */
const useFocoCalmo = (ativo: boolean) => {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!ativo) return;
    const t = window.setTimeout(() => { try { ref.current?.focus({ preventScroll: true }); } catch { ref.current?.focus(); } }, 420);
    return () => window.clearTimeout(t);
  }, [ativo]);
  return ref;
};

const Disco = ({ a, tamanho = 38 }: { a: (typeof ACOES)[number]; tamanho?: number }) => (
  <span className="rr-disco" style={{ background: tinta(a.tom), color: cor(a.tom), width: tamanho, height: tamanho }}><a.Icone className="w-5 h-5" strokeWidth={TRACO} aria-hidden /></span>
);

/** o teclado do iOS desenhado (só o print; no aparelho é o de verdade) */
const TecladoIos = ({ numerico }: { numerico?: boolean }) => (
  <div className="rr-teclado-ios" data-numerico={numerico ? "" : undefined} aria-hidden>
    {numerico ? (
      <>
        {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [",", "0", "⌫"]].map((f, i) => <div key={i} className="rr-fila">{f.map((k) => <span key={k} className="rr-k">{k}</span>)}</div>)}
      </>
    ) : (
      <>
        {["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((f) => <div key={f} className="rr-fila">{f.split("").map((k) => <span key={k} className="rr-k">{k}</span>)}</div>)}
        <div className="rr-fila"><span className="rr-k" data-larga>123</span><span className="rr-k" data-larga style={{ flex: 8 }}>espaço</span><span className="rr-k" data-larga>ok</span></div>
      </>
    )}
  </div>
);

const Teclado = () => (
  <div className="rr-teclado" aria-label="Teclado numérico do app">
    {[["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"]].map(([n, l]) => (
      <button key={n} type="button" className="rr-tecla"><span className="flex flex-col items-center leading-none gap-0.5">{n}{l && <small>{l}</small>}</span></button>
    ))}
    <button type="button" className="rr-tecla">,</button>
    <button type="button" className="rr-tecla">0</button>
    <button type="button" className="rr-tecla" data-apaga aria-label="Apagar"><Delete className="w-6 h-6" strokeWidth={TRACO} /></button>
  </div>
);

/* ---------------------------------------------------------------- D1 */
const D1Grade = () => (
  <>
    <div className="rr-painel" data-testid="rr-painel">
      <div className="rr-painel-grade">
        {ACOES.map((a) => <button key={a.id} type="button" className="rr-azulejo"><Disco a={a} /><span>{a.rotulo}</span></button>)}
      </div>
    </div>
    <button type="button" className="rr-mais" aria-label="Fechar"><X className="w-6 h-6" strokeWidth={2.2} /></button>
  </>
);

const TopoD1 = ({ titulo, chip }: { titulo: string; chip?: string }) => (
  <div className="rr-topo">
    <button type="button" className="rr-x" aria-label="Voltar"><ArrowLeft className="w-[18px] h-[18px]" strokeWidth={TRACO} /></button>
    <h2>{titulo}</h2>
    {chip && <span className="rr-chip">{chip}</span>}
    <button type="button" className="rr-x" aria-label="Fechar"><X className="w-4 h-4" strokeWidth={2.2} /></button>
  </div>
);

const D1Tela = ({ tela, teclado, real }: { tela: Tela; teclado: boolean; real: boolean }) => {
  const c = (t: Tom) => cor(t);
  const area = useAreaVisivel(real);
  const refTexto = useFocoCalmo(real && tela === "ideia");
  if (tela === "gasto") return (
    <div className="rr-tela" data-testid="rr-d1-gasto">
      <TopoD1 titulo="Gasto" chip="Hoje" />
      <div className="rr-centro">
        <span className="rr-eyebrow">Valor do gasto</span>
        <span className="rr-numero"><small>R$</small><b>12,50</b><i className="rr-cursor" /></span>
        <div className="rr-pilulas">{CATEGORIAS.map((x, i) => <span key={x} className="rr-pilula" data-on={i === 1 ? "" : undefined}>{x}</span>)}</div>
      </div>
      <Teclado />
      <button type="button" className="rr-principal">Registrar gasto</button>
    </div>
  );
  if (tela === "agua") return (
    <div className="rr-tela" data-testid="rr-d1-agua">
      <TopoD1 titulo="Água" chip="Meta 8 copos" />
      <div className="rr-centro">
        <Anel tamanho={200} espessura={16} valor={3} max={8} cor={c(TOM_DO_TIPO.agua)}>
          <span className="flex flex-col items-center"><b className="text-[56px] leading-none font-bold tabular-nums tracking-[-0.03em]">3</b><span className="text-[13px] font-semibold text-muted-foreground mt-1">de 8 copos</span></span>
        </Anel>
        <div className="rr-pilulas" style={{ justifyContent: "center" }}>{["200 ml", "350 ml", "500 ml"].map((x, i) => <span key={x} className="rr-pilula" data-on={i === 1 ? "" : undefined}>{x}</span>)}</div>
        <div className="rr-copo mt-2">
          <button type="button" className="rr-copo-menos" aria-label="Tirar um copo">−</button>
          <button type="button" className="rr-copo-mais"><Plus className="w-5 h-5 inline mr-1" strokeWidth={2.4} />1 copo</button>
          <span />
        </div>
      </div>
      <button type="button" className="rr-principal">Pronto</button>
    </div>
  );
  if (tela === "humor") return (
    <div className="rr-tela" data-testid="rr-d1-humor">
      <TopoD1 titulo="Humor" chip="Agora" />
      <div className="rr-centro">
        <span className="rr-eyebrow">Como você está?</span>
        <div className="rr-humores">{HUMORES.map((h, i) => <button key={h} type="button" className="rr-humor" data-on={i === 1 ? "" : undefined}>{h}</button>)}</div>
        <p className="text-[22px] font-bold tracking-tight mt-2">Bem</p>
        <div className="rr-texto mt-2" data-vazio style={{ minHeight: 88, fontSize: 17 }}>Quer anotar o motivo? (opcional)</div>
      </div>
      <button type="button" className="rr-principal">Registrar humor</button>
    </div>
  );
  if (tela === "treino") return (
    <div className="rr-tela" data-testid="rr-d1-treino">
      <TopoD1 titulo="Treino" chip="Quarta" />
      <div className="rr-centro">
        <Anel tamanho={180} espessura={14} valor={0} max={1} cor={c(TOM_DO_TIPO.treino)}><Dumbbell className="w-14 h-14" strokeWidth={TRACO} style={{ color: c(TOM_DO_TIPO.treino) }} /></Anel>
        <p className="text-[26px] font-bold tracking-tight">Peito e tríceps</p>
        <p className="text-[14px] text-muted-foreground -mt-1">o treino de hoje do seu plano</p>
        <div className="rr-pilulas" style={{ justifyContent: "center" }}>{["Feito agora", "Hoje foi descanso"].map((x, i) => <span key={x} className="rr-pilula" data-on={i === 0 ? "" : undefined}>{x}</span>)}</div>
      </div>
      <button type="button" className="rr-principal"><Check className="w-5 h-5 inline mr-1.5" strokeWidth={2.6} />Marcar como feito</button>
    </div>
  );
  return (
    <div className="rr-tela" data-testid="rr-d1-ideia" style={teclado ? { paddingBottom: 336 + 12 } : real && area.teclado ? { paddingBottom: area.coberto + 12 } : undefined}>
      <TopoD1 titulo="Ideia" chip="Guardar" />
      <div className="rr-pilulas mt-3">{["Ideia", "Gratidão", "Nota"].map((x, i) => <span key={x} className="rr-pilula" data-on={i === 0 ? "" : undefined}>{x}</span>)}</div>
      {real ? <textarea ref={refTexto} className="rr-texto mt-3 flex-1" placeholder="Anota aqui o que passou pela cabeça…" /> : <div className="rr-texto mt-3 flex-1" data-vazio>Anota aqui o que passou pela cabeça…</div>}
      <button type="button" className="rr-principal">Guardar</button>
      {teclado && <TecladoIos />}
    </div>
  );
};

/* ---------------------------------------------------------------- D2 */
const D2 = ({ tela, teclado, real }: { tela: Tela; teclado: boolean; real: boolean }) => {
  const a = ACOES.find((x) => x.tela === tela) ?? ACOES[2];
  const comTeclado = teclado && (tela === "gasto" || tela === "ideia");
  const area = useAreaVisivel(real);
  const refNumero = useFocoCalmo(real && tela === "gasto");
  const refTexto = useFocoCalmo(real && tela === "ideia");
  // com o teclado DE VERDADE: a folha se ancora logo acima dele (bottom = o que o teclado cobre); a altura não muda
  const ancora = real && area.teclado ? { bottom: area.coberto, height: `calc(46% - 0px)`, ...estiloDaFolhaComTeclado(area, 8) } : undefined;
  return (
    <>
      <div className="rr-folha" data-testid={`rr-d2-${tela}`} data-com-teclado={comTeclado ? "" : undefined} style={ancora}>
        <span className="rr-alca" />
        {tela === "grade" ? (
          <>
            <div className="flex items-center justify-between mb-3"><h2 className="text-[18px] font-bold tracking-tight">O que você quer registrar?</h2><button type="button" className="rr-x" aria-label="Fechar"><X className="w-4 h-4" strokeWidth={2.2} /></button></div>
            <div className="rr-cartoes">{ACOES.map((x) => <button key={x.id} type="button" className="rr-cartao"><Disco a={x} tamanho={40} /><span>{x.rotulo}</span></button>)}</div>
          </>
        ) : (
          <div className="rr-passo">
            <div className="flex items-center gap-2.5">
              <button type="button" className="rr-x" aria-label="Voltar"><ArrowLeft className="w-[18px] h-[18px]" strokeWidth={TRACO} /></button>
              <Disco a={a} tamanho={34} />
              <h2 className="flex-1 text-[18px] font-bold tracking-tight">{a.rotulo}</h2>
              <div className="rr-passos"><i /><i data-on /></div>
              <button type="button" className="rr-x" aria-label="Fechar"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>
            {tela === "gasto" && (
              <>
                <div className="rr-campo"><span className="rr-eyebrow">Valor do gasto</span>{real ? <b className="flex items-baseline gap-1">R$ <input ref={refNumero} inputMode="decimal" placeholder="0,00" className="rr-input-numero" /></b> : <b>R$ 12,50<i className="rr-cursor" style={{ height: 34 }} /></b>}</div>
                <div className="rr-pilulas">{CATEGORIAS.map((x, i) => <span key={x} className="rr-pilula" data-on={i === 1 ? "" : undefined}>{x}</span>)}</div>
              </>
            )}
            {tela === "agua" && (
              <div className="rr-campo flex items-center gap-4">
                <Anel tamanho={84} espessura={9} valor={3} max={8} cor={cor(TOM_DO_TIPO.agua)}><b className="text-[26px] font-bold tabular-nums">3</b></Anel>
                <span className="flex-1"><span className="rr-eyebrow">Água de hoje</span><span className="block text-[20px] font-bold">3 de 8 copos</span><span className="block text-[12.5px] text-muted-foreground">+350 ml por copo</span></span>
                <button type="button" className="rr-copo-mais" style={{ height: 48, padding: "0 16px", fontSize: 15 }}>+1</button>
              </div>
            )}
            {tela === "humor" && (
              <div className="rr-campo"><span className="rr-eyebrow">Como você está?</span><div className="rr-humores mt-2">{HUMORES.map((h, i) => <button key={h} type="button" className="rr-humor" data-on={i === 1 ? "" : undefined} style={{ width: 52, height: 52, fontSize: 26 }}>{h}</button>)}</div></div>
            )}
            {tela === "treino" && (
              <div className="rr-campo flex items-center gap-4">
                <Anel tamanho={72} espessura={8} valor={0} max={1} cor={cor(TOM_DO_TIPO.treino)}><Dumbbell className="w-7 h-7" strokeWidth={TRACO} style={{ color: cor(TOM_DO_TIPO.treino) }} /></Anel>
                <span className="flex-1"><span className="rr-eyebrow">Hoje</span><span className="block text-[20px] font-bold">Peito e tríceps</span><span className="block text-[12.5px] text-muted-foreground">do seu plano da semana</span></span>
              </div>
            )}
            {tela === "ideia" && (real ? <textarea ref={refTexto} className="rr-texto" style={{ minHeight: 96, fontSize: 18 }} placeholder="Anota aqui o que passou pela cabeça…" /> : <div className="rr-texto" data-vazio style={{ minHeight: 96, fontSize: 18 }}>Anota aqui o que passou pela cabeça…</div>)}
            <button type="button" className="rr-principal mt-auto">{tela === "gasto" ? "Registrar gasto" : tela === "agua" ? "Pronto" : tela === "humor" ? "Registrar humor" : tela === "treino" ? "Marcar como feito" : "Guardar"}</button>
          </div>
        )}
      </div>
      {comTeclado && <TecladoIos numerico={tela === "gasto"} />}
    </>
  );
};

export default function DevRegistroRapido() {
  const [sp] = useSearchParams();
  const dir = sp.get("dir") === "2" ? 2 : 1;
  const tela = (sp.get("tela") ?? "grade") as Tela;
  const teclado = sp.get("teclado") === "1";
  const real = sp.get("teclado") === "real";
  const tema = sp.get("tema");
  const status = sp.get("status") === "1";
  useEffect(() => { if (tema) document.documentElement.classList.toggle("dark", tema === "escuro"); }, [tema]);
  useTravaDoDocumento(true);
  return (
    <>
      <HomeE />
      <div className="hn he he-so-vars" data-suave={SUAVIDADE_HOME_NOVA}>
        {dir === 2 || tela === "grade" ? <BarraVidro ativa="inicio" iniciais="JV" onIr={() => {}} onMais={() => {}} /> : null}
        <div className="rr" data-testid="rr-mockup" data-dir={dir} data-tela={tela}>
          <div className="rr-escurece" />
          {dir === 1 ? (tela === "grade" ? <D1Grade /> : <D1Tela tela={tela} teclado={teclado} real={real} />) : <D2 tela={tela} teclado={teclado} real={real} />}
        </div>
      </div>
      {status && <MolduraIphone fundo={null} />}
    </>
  );
}
