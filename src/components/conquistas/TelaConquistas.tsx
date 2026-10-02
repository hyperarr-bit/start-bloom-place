import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Instagram, Lock, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { localDayKey, mesAtualExtenso } from "@/lib/utils";
import { BadgeDetailSheet } from "@/components/gamification/BadgeDetailSheet";
import { LEVELS, raridadeDe, type Badge } from "@/components/gamification/types";
import { AmostraDaCapa, CAPAS, CHAVE_CAPA, ORDEM_CAPAS, ehCapa, type CapaId } from "./CapaPlanner";
import { capaLiberada, fraseDaCapaTravada, requisitoEmTexto } from "@/lib/fogo-sequencia";
import { CardSequencia } from "./CardSequencia";
import { CardProximo, GradeAdesivos } from "./GradeAdesivos";
import { PlannerAberto, mesDaPagina } from "./PlannerAberto";
import type { DadosPagina } from "./PaginaInsignias";
import { montarAlbum, proximosDoAlbum } from "./album-paginas";
import { CardAlbum } from "./CardAlbum";
import { AlbumTela } from "./AlbumTela";
import { DetalheInsignia } from "./DetalheInsignia";
import { CHAVE_DICA_PLANNER, DicaDoPlanner, ToqueNaCapa, deveMostrarDica, lerDica } from "./DicaDoPlanner";
import { SeloNivel } from "./SeloNivel";
import { Previa, SeletorDeArte, type ArteDireta, type DadosArtes } from "./SeletorDeArte";
import { StoriesAdesivo } from "./Stories";
import { compartilharAdesivo } from "./compartilhar-conquistas";
import { TOTAL_INSIGNIAS, type Insignia } from "./insignias";
import { useInsignias } from "./use-insignias";
import { useConquistas, usePerfilConquistas, useSequencia } from "./use-conquistas";
import "./conquistas.css";

export { CHAVE_CAPA };
/** Quem escondeu o card "Desafio da semana" no Painel de Finanças (o adesivo Desafiante oferece religar). */
export const CHAVE_DESAFIOS_OCULTOS = "finance-challenges-hidden";
/** As figurinhas que a pessoa já viu no álbum (o pacotinho conta o que colou desde então). */
export const CHAVE_ALBUM_VISTO = "conquistas-album-visto";

/** "Set 2026" — o mês do cabeçalho quando a tela é estreita. */
const mesCurto = (d = new Date()) => {
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
};
const ORIGENS = ["home", "menu", "celebracao"];
/** A coreografia da entrada dura 860 ms; depois disso o atributo sai (e as animações param de existir). */
const DURACAO_ENTRADA = 950;

const lerVisto = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);

/**
 * CONQUISTAS (refeita 26/09; v2 em 27/09; INSÍGNIAS v3 na noite de 27/09,
 * aprovadas pelo dono): a capa do planner que ABRE nas INSÍGNIAS (53, em
 * pins de esmalte — o herói do mês e as páginas, na MESMA moldura da capa),
 * a dica das 3 primeiras visitas ensinando a tocar na capa, a sequência com
 * a semana, a folha "Meus adesivos" (igual), o próximo adesivo, e o ÁLBUM DE
 * FIGURINHAS embaixo (card + tela cheia). "Postar nos Stories" tem 3 artes em
 * vídeo (minha conquista, minhas 3 conquistas, meu álbum) — a Roseta só nos
 * marcos. A tela entra numa coreografia só (≤ 900 ms, pulável, fade com
 * movimento reduzido).
 */
export const TelaConquistas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduzir = useReducedMotion();
  const { get, set, loaded } = useUserData();
  const seq = useSequencia();
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const insig = useInsignias();
  const [selecionado, setSelecionado] = useState<Badge | null>(null);
  const [nivelAberto, setNivelAberto] = useState(false);
  const [plannerAberto, setPlannerAberto] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [arteDireta, setArteDireta] = useState<ArteDireta | null>(null);
  const [previaAdesivo, setPreviaAdesivo] = useState<Badge | null>(null);
  const [detalheIns, setDetalheIns] = useState<Insignia | null>(null);
  const [albumAberto, setAlbumAberto] = useState(false);
  const [novasNoAlbum, setNovasNoAlbum] = useState<string[]>([]);
  const [albumDe, setAlbumDe] = useState<{ pagina: number; via: "card" | "pacotinho" }>({ pagina: 0, via: "card" });
  const [valoresAberto, setValoresAberto] = useState(false);
  const [dica, setDica] = useState(false);
  const desafiosOcultos = get<unknown>(CHAVE_DESAFIOS_OCULTOS, false) === true;
  const capaGravada = get<unknown>(CHAVE_CAPA, "grafite");
  // uma capa gravada que (ainda) não está liberada cai na grafite — o recorde nunca desce, então é só lixo
  const capa: CapaId = ehCapa(capaGravada) && capaLiberada(capaGravada, seq.recorde) ? capaGravada : "grafite";
  const hoje = localDayKey();

  useEffect(() => {
    const origem = (location.state as { origem?: string } | null)?.origem;
    trackEvent("conquistas_open", { origem: origem && ORIGENS.includes(origem) ? origem : "outro" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ENTRADA (A): `data-entrada="1"` liga a coreografia em CSS (conquistas.css);
   * um toque pula (o atributo sai e tudo assenta no lugar); com movimento
   * reduzido é só um fade. */
  const [entrada, setEntrada] = useState<"1" | "reduzida" | "">(() => (reduzir ? "reduzida" : "1"));
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!loaded || !entrada) return;
    const t = setTimeout(() => setEntrada(""), entrada === "reduzida" ? 250 : DURACAO_ENTRADA);
    const pular = () => setEntrada("");
    document.addEventListener("pointerdown", pular, { once: true, capture: true });
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", pular, { capture: true } as EventListenerOptions); };
  }, [loaded, entrada]);

  /* A DICA DO PLANNER: nas 3 primeiras visitas, até a pessoa abrir o planner
   * (ou dizer "Entendi"). Conta a visita uma vez por montagem. */
  const dicaVerificada = useRef(false);
  useEffect(() => {
    if (!loaded || dicaVerificada.current) return;
    dicaVerificada.current = true;
    const gravada = get<unknown>(CHAVE_DICA_PLANNER, undefined);
    if (!deveMostrarDica(gravada)) return;
    const d = lerDica(gravada);
    setDica(true);
    set(CHAVE_DICA_PLANNER, { vistas: d.vistas + 1, fim: false }, { system: true });
    trackEvent("dica_planner", { motivo: "mostrou", visita: d.vistas + 1 });
  }, [loaded, get, set]);
  const encerrarDica = useCallback((motivo: string) => {
    setDica(false);
    const d = lerDica(get<unknown>(CHAVE_DICA_PLANNER, undefined));
    if (!d.fim) {
      set(CHAVE_DICA_PLANNER, { vistas: d.vistas, fim: true }, { system: true });
      trackEvent("dica_planner", { motivo });
    }
  }, [get, set]);
  const fecharDica = useCallback(() => setDica(false), []);

  const trocarCapa = (id: CapaId) => {
    if (id === capa) return;
    set(CHAVE_CAPA, id);
    trackEvent("capa_trocar", { capa: id });
  };
  /** Capa travada (02/10): tocar mostra o requisito ("libera com 14 dias seguidos — faltam 9"). */
  const avisarCapaTravada = (id: CapaId) => {
    trackEvent("capa_travada_toque", { capa: id, recorde: seq.recorde });
    toast(fraseDaCapaTravada(CAPAS[id].nome, id, seq.recorde), { id: "capa-travada", icon: "🔒" });
  };

  const faltaXp = conq.proximoNivel ? Math.max(0, conq.proximoNivel.minXP - conq.xp) : 0;
  const base = conq.nivel.minXP;
  const fracaoNivel = conq.proximoNivel ? Math.max(0, Math.min(1, (conq.xp - base) / (conq.proximoNivel.minXP - base))) : 1;

  // o álbum de figurinhas: os mais raros na 1ª página, depois a coleção por raridade (vagas fixas)
  const paginas = useMemo(() => montarAlbum(conq.adesivos, conq.desbloqueadas), [conq.adesivos, conq.desbloqueadas]);
  const proximoDoAlbum = useMemo(() => proximosDoAlbum(conq.adesivos, 1)[0] ?? null, [conq.adesivos]);
  const mes = mesDaPagina();

  // o pacotinho: coladas desde a última vez que o álbum foi aberto (a 1ª vez desta versão entra em silêncio)
  const vistoCru = get<unknown>(CHAVE_ALBUM_VISTO, undefined);
  const visto = lerVisto(vistoCru);
  const coladas = useMemo(() => conq.adesivos.filter((b) => b.unlocked).map((b) => b.id), [conq.adesivos]);
  const coladasTxt = coladas.join(",");
  useEffect(() => {
    if (!loaded || !conq.registroPronto || visto) return;
    set(CHAVE_ALBUM_VISTO, coladasTxt ? coladasTxt.split(",") : [], { system: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, conq.registroPronto, !!visto, coladasTxt]);
  const novas = useMemo(() => (visto ? coladas.filter((id) => !visto.includes(id)) : []), [visto, coladas]);

  const pagina: DadosPagina = useMemo(() => ({
    ordenada: insig.ordenada, nivel: conq.nivel.name, xp: conq.xp, faltaXp, proximoNivel: conq.proximoNivel?.name ?? null,
    mes, mesIdx: insig.mesIdx, total: TOTAL_INSIGNIAS, valoresLigados: insig.valoresLigados,
  }), [insig.ordenada, conq.nivel.name, conq.xp, faltaXp, conq.proximoNivel?.name, mes, insig.mesIdx, insig.valoresLigados]);

  const dadosArtes: DadosArtes = useMemo(() => ({
    nome: perfil.nome, membroDesde: perfil.membroDesde, dias: seq.dias, nivel: conq.nivel.name, xp: conq.xp,
    adesivos: conq.abertos, total: conq.adesivos.length,
    maisRaros: paginas[0].vagas, proximos: paginas[0].proximos, porRaridade: conq.porRaridade, figurinhas: conq.adesivos, mes, mesIdx: insig.mesIdx, ano: insig.ano,
    heroi: insig.heroi, tres: insig.tres, candidatas: insig.candidatas, valoresLigados: insig.valoresLigados, capa,
  }), [perfil.nome, perfil.membroDesde, seq.dias, conq.nivel.name, conq.xp, conq.abertos, conq.adesivos, conq.porRaridade, paginas, mes, insig.mesIdx, insig.ano, insig.heroi, insig.tres, insig.candidatas, insig.valoresLigados, capa]);

  const abrirPlanner = useCallback(() => {
    setPlannerAberto(true);
    trackEvent("insignias_abrir", { conquistadas: insig.ordenada.conquistadas, heroi: insig.heroi?.id ?? null });
    // já aprendeu: a dica não volta
    encerrarDica("abriu");
  }, [insig.ordenada.conquistadas, insig.heroi?.id, encerrarDica]);

  const postarConquista = () => {
    setArteDireta(insig.heroi ? { arte: "conquista" } : null);
    setSeletorAberto(true);
  };
  const postarEsta = (i: Insignia) => {
    setDetalheIns(null);
    setArteDireta({ arte: "conquista", insignia: i });
    setSeletorAberto(true);
  };
  const compartilharAlbum = () => { setArteDireta({ arte: "album" }); setSeletorAberto(true); };
  const consumirDireto = useCallback(() => setArteDireta(null), []);
  const abrirAlbum = () => {
    setNovasNoAlbum(novas);
    setAlbumDe({ pagina: 0, via: "card" });
    setAlbumAberto(true);
    if (visto) set(CHAVE_ALBUM_VISTO, coladas, { system: true });
  };
  /**
   * O PACOTINHO (02/10): abre o álbum direto na página da figurinha nova (a 1ª
   * das novas, na ordem do álbum), que cola com o pop — e marca tudo como
   * visto. Antes era o mesmo caminho de "Abrir o álbum" (capa + página 1) e
   * a figurinha nova ficava numa página lá na frente.
   */
  const abrirPacotinho = () => {
    const alvo = paginas.findIndex((p) => p.vagas.some((b) => novas.includes(b.id)));
    setNovasNoAlbum(novas);
    setAlbumDe({ pagina: alvo > 0 ? alvo : 0, via: "pacotinho" });
    setAlbumAberto(true);
    if (visto) set(CHAVE_ALBUM_VISTO, coladas, { system: true });
  };
  const ligarDesafios = () => {
    set(CHAVE_DESAFIOS_OCULTOS, false);
    setSelecionado(null);
    toast.success("Desafio da semana de volta no Painel de Finanças! 🎯");
  };
  const abrirDetalheIns = (i: Insignia) => {
    setDetalheIns(i);
    trackEvent("insignia_detalhe", { id: i.id, faixa: i.faixa });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-amber-500" aria-hidden />
          <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
          <div className="flex items-center gap-2 ml-auto">
            {/* 360 px: "Setembro de 2026" quebrava em duas linhas ao lado de CONQUISTAS */}
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              <span className="hidden min-[400px]:inline">{mesAtualExtenso()}</span>
              <span className="min-[400px]:hidden">{mesCurto()}</span>
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {loaded && (
        <main ref={main} className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-3.5" data-entrada={entrada || undefined} data-testid="tela-conquistas">
          <div>
            <PlannerAberto
              capa={capa}
              nome={perfil.nome}
              membroDesde={perfil.membroDesde}
              dias={seq.dias}
              nivel={conq.nivel.name}
              onSelo={() => setNivelAberto(true)}
              pagina={pagina}
              onSelecionar={abrirDetalheIns}
              onValores={() => setValoresAberto(true)}
              aberto={plannerAberto}
              onAbrir={abrirPlanner}
              onFechar={() => setPlannerAberto(false)}
              onPostar={postarConquista}
              dica={dica ? <ToqueNaCapa /> : null}
            />
            {/* a dica das 3 primeiras visitas (some sozinha quando ela abre o planner) */}
            <DicaDoPlanner aberta={dica && !plannerAberto} onAbrir={abrirPlanner} onEntendi={() => encerrarDica("entendi")} onFechar={fecharDica} />
          </div>

          {/* o seletor de CAPA (02/10): amostras do MATERIAL de cada capa; as que o tempo libera
              (Bordô · 14 dias, Noite · 30) ficam com cadeado e dizem o requisito ao toque — sem bloco novo.
              (02/10, print do dono: o rótulo "CAPA" ficava por baixo da 1ª amostra — com 8 capas a fileira
              centralizada estourava pros dois lados) — sem rótulo; a fileira centraliza quando cabe e rola de
              lado quando não cabe, nunca passando por cima de nada. */}
          <div className="grid gap-2.5 entra-sobe" style={{ "--d": "120ms", gridTemplateColumns: "1fr auto" } as React.CSSProperties}>
            <div role="radiogroup" aria-label="Capa do planner" className="h-11 min-w-0 rounded-xl border border-border flex items-center gap-1.5 px-2" data-testid="seletor-capa">
              <span className="flex-1 min-w-0 overflow-x-auto scrollbar-hide" data-testid="seletor-capa-trilho">
              <span className="flex items-center w-max mx-auto">
                {ORDEM_CAPAS.map((id) => {
                  const ativa = id === capa;
                  const travada = !capaLiberada(id, seq.recorde);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={ativa}
                      aria-label={travada ? `${CAPAS[id].nome} — ${requisitoEmTexto(id)}` : CAPAS[id].nome}
                      data-capa-opcao={id}
                      data-travada={travada ? "" : undefined}
                      onClick={() => (travada ? avisarCapaTravada(id) : trocarCapa(id))}
                      className="relative w-[22px] h-7 grid place-items-center shrink-0"
                    >
                      <AmostraDaCapa capa={id} tamanho={18} style={{ opacity: travada ? 0.42 : 1, outline: ativa ? "2px solid hsl(var(--foreground))" : undefined, outlineOffset: 1.5 }} />
                      {travada && (
                        <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full grid place-items-center bg-foreground text-background" aria-hidden>
                          <Lock className="w-2 h-2" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSeletorAberto(true)}
              className="h-11 px-3.5 rounded-xl bg-foreground text-background font-bold text-[13px] inline-flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform whitespace-nowrap"
              data-testid="postar-stories"
            >
              <Instagram className="w-[18px] h-[18px]" aria-hidden />
              {/* em tela estreita só "Stories", pra as 8 capas caberem na fileira ao lado */}
              <span><span className="hidden min-[421px]:inline">Postar nos </span>Stories</span>
            </button>
          </div>

          <div className="entra-sobe" style={{ "--d": "190ms" } as React.CSSProperties}>
            <CardSequencia seq={seq} onAcao={(rota) => navigate(rota)} />
          </div>

          <div className="entra-sobe" style={{ "--d": "370ms" } as React.CSSProperties}>
            <GradeAdesivos folha={conq.folha} abertos={conq.abertos} onSelecionar={setSelecionado} />
          </div>

          <div className="entra-sobe" style={{ "--d": "520ms" } as React.CSSProperties}>
            <CardProximo proximo={conq.proximo} colecoes={conq.colecoes} diasDeSequencia={seq.dias} onSelecionar={setSelecionado} />
          </div>

          <div className="entra-sobe" style={{ "--d": "600ms" } as React.CSSProperties}>
            <CardAlbum
              maisRaros={paginas[0].vagas}
              abertos={conq.abertos}
              total={conq.adesivos.length}
              porRaridade={conq.porRaridade}
              proximo={proximoDoAlbum}
              novas={novas.length}
              nome={perfil.nome}
              ano={insig.ano}
              capa={capa}
              nivel={conq.nivel.name}
              onAbrir={abrirAlbum}
              onAbrirPacotinho={abrirPacotinho}
              onCompartilhar={compartilharAlbum}
            />
          </div>
        </main>
      )}

      <BadgeDetailSheet
        badge={selecionado}
        onClose={() => setSelecionado(null)}
        desbloqueadoEm={selecionado ? conq.desbloqueadas[selecionado.id] : undefined}
        diasDeSequencia={seq.dias}
        perfil={{ nome: perfil.nome, membroDesde: perfil.membroDesde, nivel: conq.nivel.name }}
        porRaridade={conq.porRaridade}
        desafiosOcultos={desafiosOcultos}
        onLigarDesafios={ligarDesafios}
        onCompartilharAdesivo={(b) => { setSelecionado(null); setPreviaAdesivo(b); }}
      />

      <DetalheInsignia ins={detalheIns} mesIdx={insig.mesIdx} onClose={() => setDetalheIns(null)} onPostar={postarEsta} />

      <SeletorDeArte aberto={seletorAberto} onFechar={() => setSeletorAberto(false)} dados={dadosArtes} direto={arteDireta} onDiretoConsumido={consumirDireto} />

      <AnimatePresence>
        {albumAberto && (
          <AlbumTela
            key="album"
            aberto={albumAberto}
            paginas={paginas}
            adesivos={conq.adesivos}
            desbloqueadas={conq.desbloqueadas}
            novas={novasNoAlbum}
            maisRaros={paginas[0].vagas}
            abertos={conq.abertos}
            total={conq.adesivos.length}
            porRaridade={conq.porRaridade}
            nome={perfil.nome}
            nivel={conq.nivel.name}
            ano={insig.ano}
            capa={capa}
            diasDeSequencia={seq.dias}
            paginaInicial={albumDe.pagina}
            via={albumDe.via}
            onFechar={() => setAlbumAberto(false)}
            onCompartilhar={compartilharAlbum}
            onCompartilharFigurinha={(b) => setPreviaAdesivo(b)}
          />
        )}
      </AnimatePresence>

      {/* a prévia da figurinha (vinda do detalhe): fundo holográfico no épico, dourado no lendário */}
      <AnimatePresence>
        {previaAdesivo && (
          <Previa
            key={previaAdesivo.id}
            titulo={previaAdesivo.name}
            elemento={<StoriesAdesivo id={previaAdesivo.id} titulo={previaAdesivo.name} descricao={previaAdesivo.description} raridade={raridadeDe(previaAdesivo)} nome={perfil.nome} membroDesde={perfil.membroDesde} />}
            onPostar={() => compartilharAdesivo({ id: previaAdesivo.id, titulo: previaAdesivo.name, descricao: previaAdesivo.description, raridade: raridadeDe(previaAdesivo), nome: perfil.nome, membroDesde: perfil.membroDesde })}
            onFechar={() => setPreviaAdesivo(null)}
          />
        )}
      </AnimatePresence>

      {/* "mostrar valores": R$ e peso nas insígnias e nas artes (gravado por conta, padrão desligado) */}
      <Sheet open={valoresAberto} onOpenChange={setValoresAberto}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="folha-valores">
          <div className="max-w-sm mx-auto pt-2">
            <SheetTitle className="text-[18px] font-extrabold tracking-tight">Mostrar valores em R$ e peso?</SheetTitle>
            <SheetDescription className="text-[12.5px] text-muted-foreground mt-1 leading-[1.4]">
              Por padrão o dinheiro sai em % ("guardei 40% do que ganhei") e o peso fica de fora. Ligando, "Sobrou no mês", "Paguei de dívida" e "Peso a menos" entram nas páginas e nas artes dos Stories — só nesta conta.
            </SheetDescription>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 h-14 cursor-pointer">
              <span className="text-[13.5px] font-bold">Mostrar valores</span>
              <Switch checked={insig.valoresLigados} onCheckedChange={(v) => insig.ligarValores(v)} aria-label="Mostrar valores em R$ e peso" data-testid="switch-valores" />
            </label>
            <button type="button" onClick={() => setValoresAberto(false)} className="w-full h-10 mt-2 rounded-xl text-[13px] font-bold text-muted-foreground">Fechar</button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Toque no selo da capa: o caminho até o próximo nível */}
      <Sheet open={nivelAberto} onOpenChange={setNivelAberto}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="max-w-sm mx-auto text-center pt-2">
            <div className="flex justify-center"><SeloNivel nivel={conq.nivel.name} tamanho={84} /></div>
            <SheetTitle className="text-2xl font-bold tracking-tight mt-3">Nível {conq.nivel.name}</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground mt-1">
              {conq.proximoNivel
                ? `${conq.xp.toLocaleString("pt-BR")} XP · faltam ${faltaXp.toLocaleString("pt-BR")} XP pra ${conq.proximoNivel.name}`
                : `${conq.xp.toLocaleString("pt-BR")} XP · o nível mais alto do CORE`}
            </SheetDescription>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round(fracaoNivel * 100)}%` }} />
            </div>
            <div className="mt-4 flex justify-between">
              {LEVELS.map((l, i) => (
                <div key={l.name} className={`flex flex-col items-center gap-1 ${i <= LEVELS.findIndex((x) => x.name === conq.nivel.name) ? "" : "opacity-35 grayscale"}`}>
                  <SeloNivel nivel={l.name} tamanho={34} sombra={false} />
                  <span className="text-[10px] font-bold text-muted-foreground">{l.name}</span>
                  <span className="text-[9px] text-muted-foreground tabular-nums">{l.minXP.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
            {conq.pisoValendo ? (
              <p className="mt-4 text-xs text-muted-foreground" data-testid="aviso-piso">
                Você chegou ao {conq.nivel.name} na escada antiga — e nível nunca volta atrás. Na escada nova, {conq.proximoNivel ? `${conq.proximoNivel.name} começa em ${conq.proximoNivel.minXP.toLocaleString("pt-BR")} XP` : "você já está no topo"}.
              </p>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Cada figurinha vale XP pela raridade (50 · 100 · 200 · 400) — e o que você conquista fica: o nível nunca volta atrás.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
