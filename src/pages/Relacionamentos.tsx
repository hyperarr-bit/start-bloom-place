import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useVoltarDoModulo } from "@/lib/volta-da-demo";
import { ArrowLeft, Mail } from "lucide-react";
import { mesAtualExtenso } from "@/lib/utils";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import type { SugestaoDeInicio } from "@/lib/relacoes";
import { TemaRelacoes } from "@/components/relacoes/kit";
import { useRelacoes } from "@/components/relacoes/use-relacoes";
import { RelacoesContext, type AbaRelacoes, type Navegacao } from "@/components/relacoes/contexto";
import { AbaPessoas } from "@/components/relacoes/Pessoas";
import { AbaDatas } from "@/components/relacoes/Datas";
import { AbaPresentes } from "@/components/relacoes/Presentes";
import { AbaMomentos } from "@/components/relacoes/Momentos";
import { FichaPessoa } from "@/components/relacoes/FichaPessoa";
import { FolhaPessoa } from "@/components/relacoes/FormPessoa";
import { FolhaDeAvisos } from "@/components/relacoes/Avisos";
import { FolhaMensagem } from "@/components/relacoes/Mensagem";
import { useAvisosRelacoes } from "@/components/relacoes/use-avisos-relacoes";

/**
 * RELAÇÕES (refeito em 29/09, Onda 1). Quatro abas no lugar de cinco — a
 * AGENDA virou DATAS e engoliu os EVENTOS (as duas tinham 3–7 s por visita).
 * Os ids das abas continuam os de sempre ("agenda" inclusive), pra medição
 * comparar antes × depois. O visual é o do módulo (direção "Correio", ver
 * components/relacoes/relacoes.css): nada de rosa, que é a cor do menu.
 */

const ABAS: { id: AbaRelacoes; rotulo: string; emoji: string }[] = [
  { id: "pessoas", rotulo: "PESSOAS", emoji: "💌" },
  { id: "agenda", rotulo: "DATAS", emoji: "📅" },
  { id: "presentes", rotulo: "PRESENTES", emoji: "🎁" },
  { id: "momentos", rotulo: "MOMENTOS", emoji: "✨" },
];

/** ?aba= do link (notificação, Home). "eventos" e "datas" são apelidos da aba de datas. */
const abaDoLink = (v: string | null): AbaRelacoes | null => {
  if (!v) return null;
  if (v === "eventos" || v === "datas") return "agenda";
  return ABAS.some((a) => a.id === v) ? (v as AbaRelacoes) : null;
};

const Relacionamentos = () => {
  // P5 (30/09): na demo a seta vai pro destino do botão de baixo (o funil); no app, pra /home
  const voltarDoModulo = useVoltarDoModulo();
  const [params, setParams] = useSearchParams();
  const rel = useRelacoes();
  const avisos = useAvisosRelacoes();
  const [aba, setAba] = useState<AbaRelacoes>(() => abaDoLink(params.get("aba")) ?? "pessoas");
  // ?ficha=<id>: abre a ficha direto (link de aviso, e o /dev pros prints)
  const [fichaId, setFichaId] = useState<string | null>(() => params.get("ficha"));
  const [form, setForm] = useState<{ pessoaId?: string; sugestao?: SugestaoDeInicio } | null>(null);
  const [avisosAberto, setAvisosAberto] = useState(params.get("avisos") === "1");
  const [mensagem, setMensagem] = useState<{ pessoaId: string; tipo: "parabens" | "oi" } | null>(null);
  useScrollActiveTabIntoView(aba);
  const reportTab = useTabReporter();
  const mes = mesAtualExtenso();

  // link com ?aba= chegando com o módulo já aberto (toque na notificação)
  useEffect(() => {
    const a = abaDoLink(params.get("aba"));
    if (a) setAba(a);
    if (params.get("avisos") === "1") setAvisosAberto(true);
  }, [params]);

  const trocarAba = (id: AbaRelacoes) => {
    setAba(id);
    reportTab?.(id);
    if (params.get("aba")) { params.delete("aba"); setParams(params, { replace: true }); }
  };

  const nav: Navegacao = useMemo(() => ({
    rel,
    abrirFicha: (id) => setFichaId(id),
    abrirNovaPessoa: (sugestao) => setForm({ sugestao }),
    abrirEdicao: (id) => setForm({ pessoaId: id }),
    abrirAvisos: () => setAvisosAberto(true),
    abrirMensagem: (pessoaId, tipo) => setMensagem({ pessoaId, tipo }),
    irPraAba: (id) => trocarAba(id),
  }), [rel]); // eslint-disable-line react-hooks/exhaustive-deps

  const editando = form?.pessoaId ? rel.pessoas.find((p) => p.id === form.pessoaId) : undefined;
  const pessoaDaMensagem = mensagem ? rel.pessoas.find((p) => p.id === mensagem.pessoaId) : undefined;

  return (
    <RelacoesContext.Provider value={nav}>
      <TemaRelacoes className="min-h-screen bg-background text-foreground">
        <SpotlightOverlay
          moduleKey="relacionamentos"
          steps={[
            { selector: '[data-spotlight="tab-agenda"]', label: "O ano em datas: aniversários e datas especiais, mês a mês.", advanceOnClick: true },
            { selector: '[data-spotlight="tab-presentes"]', label: "Guarde ideias de presente pra cada pessoa.", advanceOnClick: true },
          ]}
        />
        <header className="border-b border-border bg-card sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={voltarDoModulo} aria-label="Voltar" className="hover:bg-muted rounded-md p-1 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Mail className="w-5 h-5 text-[hsl(var(--rl-lacre))]" aria-hidden="true" />
            <h1 className="text-base font-bold tracking-tight">RELAÇÕES</h1>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-muted-foreground text-xs">{mes}</span>
              <ThemeToggle />
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto" role="tablist" aria-label="Abas de Relações">
            {ABAS.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={aba === a.id}
                data-spotlight={`tab-${a.id}`}
                onClick={() => trocarAba(a.id)}
                className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${aba === a.id ? "notion-tab-active" : "hover:bg-muted"}`}
              >
                <span aria-hidden="true">{a.emoji}</span>
                {a.rotulo}
              </button>
            ))}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-5 pb-24 space-y-4">
          <ModuleTip
            moduleId="relacionamentos"
            tips={[
              "Guarde suas pessoas com o dia do aniversário — o ano é opcional",
              "Na ficha de cada pessoa: o que lembrar, ideias de presente e momentos",
              "Peça pra lembrar de falar com alguém de tempos em tempos",
              "No app do celular, ligue os avisos: na véspera, no dia e o “faz tempo que…”",
            ]}
          />
          {aba === "pessoas" && <AbaPessoas avisos={avisos} />}
          {aba === "agenda" && <AbaDatas />}
          {aba === "presentes" && <AbaPresentes />}
          {aba === "momentos" && <AbaMomentos />}
        </main>

        <FichaPessoa pessoaId={fichaId} onFechar={() => setFichaId(null)} />
        <FolhaPessoa
          aberta={!!form}
          pessoa={editando}
          sugestao={form?.sugestao}
          onFechar={() => setForm(null)}
          onSalvar={(c) => {
            if (editando) rel.editarPessoa(editando.id, c);
            else { const id = rel.adicionarPessoa(c, form?.sugestao ? "comeco" : "form"); setFichaId(null); void id; }
          }}
          onApagar={editando ? () => { rel.apagarPessoa(editando.id); setFichaId(null); } : undefined}
        />
        <FolhaMensagem
          alvo={mensagem && pessoaDaMensagem ? { pessoa: pessoaDaMensagem, tipo: mensagem.tipo } : null}
          onFechar={() => setMensagem(null)}
        />
        {/* lembrete só no app (30/09): na web a folha nem abre, nem pelo ?avisos=1 */}
        <FolhaDeAvisos aberta={avisosAberto && avisos.disponiveis} onFechar={() => {
          setAvisosAberto(false);
          if (params.get("avisos")) { params.delete("avisos"); setParams(params, { replace: true }); }
        }} avisos={avisos} />
      </TemaRelacoes>
    </RelacoesContext.Provider>
  );
};

export default Relacionamentos;
