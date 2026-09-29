/**
 * PET (refeito em 29/09) — RG do pet, o dia dele e a carteirinha.
 *
 * Antes: 5 abas (PETS, SAÚDE, ROTINA, GASTOS, DIÁRIO) e um módulo que abria
 * vazio. 24% das pessoas abriam; 62% ficavam menos de 10 s no mês inteiro;
 * desde 13/09 só 4 abriram a Rotina com um pet dentro (module_analytics +
 * cards, 30–60 dias até 28/09 — relatório do módulo). Agora são 4 abas:
 *   ☀️ HOJE    — o RG (foto em destaque), o dia do pet (rotina + remédio) e
 *                os próximos cuidados da carteirinha
 *   💉 SAÚDE   — a carteirinha inteira, peso e avisos
 *   💸 GASTOS  — como era
 *   📸 DIÁRIO  — como era (id `diario` mantido pra medição seguir comparável)
 * Sem pet nenhum, o HOJE e a SAÚDE mostram o começo pronto (3 perguntas).
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { mesAtualExtenso } from "@/lib/utils";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useSetTrackedTab } from "@/hooks/use-module-tracker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { PetExpenses } from "@/components/pet/PetExpenses";
import { PetDiary } from "@/components/pet/PetDiary";
import { Pata, FolhaPet } from "@/components/pet/kit";
import { usePet } from "@/components/pet/use-pet";
import { RgCurto, RgDoPet, SeletorDePets } from "@/components/pet/rg-do-pet";
import { PetDeHoje } from "@/components/pet/pet-de-hoje";
import { Carteirinha, NovoCuidado, ProximosCuidados } from "@/components/pet/carteirinha";
import { ComecoPronto } from "@/components/pet/comeco-pronto";
import { FichaDoPet } from "@/components/pet/ficha-do-pet";
import { PesoDoPet } from "@/components/pet/peso-do-pet";
import { AvisosDoPet, DicaDoPet } from "@/components/pet/avisos-do-pet";
import { MandarCarteirinha } from "@/components/pet/mandar-carteirinha";
import type { TipoCuidado } from "@/lib/pet-cuidados";

const ABAS = [
  { id: "hoje", label: "HOJE", icon: "☀️" },
  { id: "saude", label: "SAÚDE", icon: "💉" },
  { id: "gastos", label: "GASTOS", icon: "💸" },
  { id: "diario", label: "DIÁRIO", icon: "📸" },
] as const;
type Aba = (typeof ABAS)[number]["id"];
// abas antigas que ainda chegam por link/notificação velha
const ABA_ANTIGA: Record<string, Aba> = { pets: "hoje", rotina: "hoje" };

const Pet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith("/preview");
  const dados = usePet();
  const { pets, loaded, hoje, pesosBrutos } = dados;

  const [aba, setAba] = useState<Aba>(() => {
    try {
      const pedida = new URLSearchParams(window.location.search).get("aba") ?? "";
      return (ABAS.some((a) => a.id === pedida) ? pedida : ABA_ANTIGA[pedida] ?? "hoje") as Aba;
    } catch { return "hoje"; }
  });
  useScrollActiveTabIntoView(aba);
  useSetTrackedTab(aba);

  const [selecionado, setSelecionado] = useState<string | undefined>(undefined);
  const pet = useMemo(() => pets.find((p) => p.id === selecionado) ?? pets[0], [pets, selecionado]);
  const numero = pet ? pets.findIndex((p) => p.id === pet.id) + 1 : 0;
  const [criando, setCriando] = useState(false);
  const [fichaAberta, setFichaAberta] = useState(false);
  const [novoCuidado, setNovoCuidado] = useState<TipoCuidado | null>(null);

  // o pet selecionado sumiu (apagado em outro aparelho): volta pro primeiro
  useEffect(() => { if (selecionado && !pets.some((p) => p.id === selecionado)) setSelecionado(undefined); }, [pets, selecionado]);

  // volta pro topo ao trocar de aba (pelo elemento de rolagem: no navegador é a janela; no jsdom dos testes não existe e não faz nada)
  const pertoDoTopo = () => { try { document.scrollingElement?.scrollTo?.({ top: 0 }); } catch { /* noop */ } };
  const trocarAba = (id: Aba) => { setAba(id); pertoDoTopo(); };
  const criado = (id: string, nome: string) => {
    setSelecionado(id);
    setCriando(false);
    setAba("hoje");
    pertoDoTopo();
    toast(`RG de ${nome} criado 🐾`, { description: "A rotina do dia e a carteirinha já estão prontas." });
  };

  const semPet = loaded && pets.length === 0;

  return (
    <div className="tema-pet min-h-screen bg-background text-foreground">
      <SpotlightOverlay
        moduleKey="pet"
        steps={[
          { selector: '[data-spotlight="pet-especie"]', label: "Comece por aqui: diga quem é o seu pet. Em 3 toques ele ganha RG, rotina e carteirinha.", advanceOnClick: true },
        ]}
      />
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <button type="button" onClick={() => navigate(isPreview ? "/lp" : "/home")} aria-label="Voltar" className="w-11 h-11 -ml-3 shrink-0 grid place-items-center rounded-md hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[hsl(var(--pet-mel))] shrink-0"><Pata className="w-5 h-5" /></span>
          <h1 className="text-[18px] font-extrabold tracking-tight">PET</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden min-[380px]:inline text-muted-foreground text-xs whitespace-nowrap">{mesAtualExtenso()}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 pb-2">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pt-2 -mt-2" role="tablist">
            {ABAS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={aba === t.id}
                data-spotlight={`tab-${t.id}`}
                data-active={aba === t.id}
                data-testid={`aba-${t.id}`}
                onClick={() => trocarAba(t.id)}
                className={`notion-tab shrink-0 whitespace-nowrap text-[11px] flex items-center gap-1 select-none ${aba === t.id ? "notion-tab-active" : "hover:bg-muted"}`}
              >
                <span aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-3">
        {!loaded && (aba === "hoje" || aba === "saude") && (
          <div className="space-y-3" aria-busy="true" aria-label="Carregando">
            <div className="h-[230px] rounded-2xl bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-[200px] rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        )}

        {semPet && (aba === "hoje" || aba === "saude") && (
          <ComecoPronto dados={dados} onCriado={criado} primeiro noPrimeiroPasso={<OQueVemPronto />} />
        )}

        {loaded && pet && (aba === "hoje" || aba === "saude") && (
          <SeletorDePets pets={pets} selecionado={pet.id} onEscolher={setSelecionado} onNovo={() => setCriando(true)} />
        )}

        {loaded && pet && aba === "hoje" && (
          <>
            <RgDoPet pet={pet} numero={numero} pesos={pesosBrutos} hoje={hoje} onAbrir={() => setFichaAberta(true)} />
            <PetDeHoje pet={pet} dados={dados} onRemedio={() => setNovoCuidado("remedio")} />
            <ProximosCuidados pet={pet} dados={dados} onVerTudo={() => trocarAba("saude")} />
            <DicaDoPet dados={dados} onAvisos={() => trocarAba("saude")} />
          </>
        )}

        {loaded && pet && aba === "saude" && (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-3.5 py-3 flex items-center gap-3">
                <RgCurto pet={pet} hoje={hoje} />
                <button type="button" onClick={() => setFichaAberta(true)} className="ml-auto min-h-[44px] px-2 -mr-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Ver RG</button>
              </div>
              <MandarCarteirinha pet={pet} dados={dados} />
            </div>
            <Carteirinha pet={pet} dados={dados} />
            <PesoDoPet pet={pet} dados={dados} />
            <AvisosDoPet dados={dados} />
          </>
        )}

        {aba === "gastos" && <PetExpenses />}
        {aba === "diario" && <PetDiary />}
      </main>

      {pet && <FichaDoPet pet={pet} dados={dados} aberta={fichaAberta} onFechar={() => setFichaAberta(false)} />}
      {pet && <NovoCuidado tipoInicial={novoCuidado} pet={pet} dados={dados} onFechar={() => setNovoCuidado(null)} />}
      <FolhaPet aberta={criando} onFechar={() => setCriando(false)} titulo="Novo pet" testId="folha-novo-pet">
        {criando && <ComecoPronto dados={dados} onCriado={criado} onCancelar={() => setCriando(false)} />}
      </FolhaPet>
    </div>
  );
};

/** Embaixo do começo pronto (primeira vez): o que o módulo faz, no lugar da tela em branco. */
const OQueVemPronto = () => (
  <section className="rounded-xl border border-border bg-card overflow-hidden" data-card="O QUE VEM PRONTO">
    <div className="flex items-center gap-2 px-3.5 min-h-[40px] border-b border-border">
      <span aria-hidden="true" className="w-2 h-2 rounded-[2px] bg-[hsl(var(--pet-mel))]" />
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">O que vem pronto</h3>
    </div>
    <ul>
      {[
        ["🪪", "RG do pet", "Foto, idade, peso, microchip e o contato do veterinário — o que perguntam na clínica."],
        ["☑️", "O dia do pet", "Comida, passeio, água e remédio com quadradinho. Dá pra marcar da tela inicial."],
        ["💉", "Carteirinha", "Vacinas, vermífugo e antipulgas da idade, com a próxima data calculada sozinha."],
        ["🔔", "Aviso no dia", "Da vacina, do vermífugo e do remédio. Nasce desligado — você liga se quiser."],
      ].map(([emoji, titulo, texto], i) => (
        <li key={titulo} className={`flex gap-3 px-3.5 py-3 ${i ? "border-t border-border" : ""}`}>
          <span className="text-[18px] leading-none mt-0.5" aria-hidden="true">{emoji}</span>
          <span>
            <span className="block text-[14px] font-semibold">{titulo}</span>
            <span className="block text-[12.5px] text-muted-foreground leading-snug mt-0.5">{texto}</span>
          </span>
        </li>
      ))}
    </ul>
  </section>
);

export default Pet;
