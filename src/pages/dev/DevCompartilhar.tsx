import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { CardDeCompartilhar, type Camada } from "@/components/compartilhar/cards";
import { PreviaDoCard } from "@/components/compartilhar/PreviaDoCard";
import { CHAVE_FORCA } from "@/components/compartilhar/chave";
import { TreinoConcluido } from "@/components/treino/TreinoConcluido";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { FORMATOS, type DadosCard, type Formato } from "@/components/compartilhar/tipos";
import { DIRECOES } from "./compartilhar-direcoes";
import { RetroOutubro } from "@/components/compartilhar/RetroOutubro";
import { AGORA_EXEMPLO, RETRO_EXEMPLO, RETRO_FIN_INCOMPLETA, RETRO_POUCA, SEMENTE_COMPLETA, SEMENTE_FIN_INCOMPLETA, SEMENTE_POUCA, leitorDe } from "./retro-outubro-exemplo";
import { AGUA, AZUL_1, AZUL_3, FIGURINHA_LENDARIA, HABITOS, INSIGNIA_OURO, LIVROS_MES, LIVROS_5, METAS, POUPANCA, SEQUENCIA, SONO, TREINOS_MES, TREINOS_TOTAL } from "./compartilhar-exemplos";

/**
 * /dev/compartilhar — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota
 * dentro de `import.meta.env.DEV`; some do build). Todos os cards de
 * compartilhar com dados de exemplo, pra olhar, fotografar e filmar:
 *
 *   /dev/compartilhar                          a galeria (tudo em miniatura)
 *   /dev/compartilhar?so=<chave>               um card só, no tamanho real (a foto)
 *   /dev/compartilhar?so=<chave>&camada=aceso  uma camada do vídeo
 *   …&valores=1                                "mostrar valores" ligado (R$)
 *   …&moeda=financas-ouro                      a moeda estática da frente das insígnias
 *                                              (servida em /__moeda/<nome>.png pelo script de captura)
 *   /dev/compartilhar?video=<chave>            gera o MP4 com o gerador DO APP (window.__video)
 *   /dev/compartilhar?quadros=<chave>&t=0,1,2  os quadros da animação nesses instantes
 *   /dev/compartilhar?previa=<id>&formato=feed a prévia do app (a folha de postar), com dados de exemplo
 *   /dev/compartilhar?treino=1                 o "Treino concluído" com o botão novo (liga a chave só aqui)
 */

type Entrada = { chave: string; grupo: string; nome: string; w: number; h: number; el: (o: Opcoes) => ReactElement };
interface Opcoes { camada: Camada; valores: boolean; moeda: string | null }

const EXEMPLOS: { id: string; nome: string; dados: DadosCard }[] = [
  { id: "treinos", nome: "Treinos no mês", dados: TREINOS_MES },
  { id: "treinos-total", nome: "Treinos desde o 1º (o card do dono)", dados: TREINOS_TOTAL },
  { id: "azul", nome: "Mês no azul (o card do dono)", dados: AZUL_1 },
  { id: "azul-3", nome: "3 meses no azul", dados: AZUL_3 },
  { id: "poupanca", nome: "Guardei X%", dados: POUPANCA },
  { id: "livros", nome: "Livros do mês", dados: LIVROS_MES },
  { id: "livros-5", nome: "Livros (5 capas, títulos longos)", dados: LIVROS_5 },
  { id: "sequencia", nome: "Sequência (marco)", dados: SEQUENCIA },
  { id: "agua", nome: "Água", dados: AGUA },
  { id: "sono", nome: "Sono", dados: SONO },
  { id: "habitos", nome: "Hábito campeão", dados: HABITOS },
  { id: "metas", nome: "Metas do mês", dados: METAS },
  { id: "insignia", nome: "Insígnia que evoluiu", dados: INSIGNIA_OURO },
  { id: "figurinha", nome: "Figurinha lendária", dados: FIGURINHA_LENDARIA },
  // 23/10: a RETROSPECTIVA DE OUTUBRO, saída da conta de verdade (montarRetroOutubro) com a conta de exemplo
  ...RETRO_EXEMPLO.cards.map((c) => ({ id: `retro-${c.id}`, nome: `Retro outubro · ${c.id}`, dados: c.dados })),
  ...(RETRO_FIN_INCOMPLETA?.cards.filter((c) => c.id === "financas").map((c) => ({ id: "retro-financas-neutro", nome: "Retro outubro · finanças incompletas (neutro)", dados: c.dados })) ?? []),
  ...(RETRO_POUCA?.cards.map((c) => ({ id: `retro-pouca-${c.id}`, nome: `Retro outubro (pouco dado) · ${c.id}`, dados: c.dados })) ?? []),
];

const SEMENTES_RETRO: Record<string, Record<string, unknown>> = { "1": SEMENTE_COMPLETA, pouca: SEMENTE_POUCA, incompleta: SEMENTE_FIN_INCOMPLETA };

export const dadosDaChave = (chave: string): { dados: DadosCard; formato: Formato } | null => {
  const m = /^card-(.+)-(stories|feed|adesivo)$/.exec(chave);
  const ex = m && EXEMPLOS.find((e) => e.id === m[1]);
  return ex ? { dados: ex.dados, formato: m![2] as Formato } : null;
};

/** Gera o vídeo com o gerador do app e deixa o resultado em window.__video (o script de captura baixa). */
const GerarVideo = ({ chave, moeda }: { chave: string; moeda: string | null }) => {
  const [estado, setEstado] = useState("preparando…");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const alvo = dadosDaChave(chave);
    if (!alvo || alvo.formato === "adesivo") { setEstado("chave sem vídeo"); return; }
    let dados = alvo.dados;
    if (dados.tipo === "insignia" && moeda) dados = { ...dados, imagem: `/__moeda/${moeda}.png` };
    (async () => {
      const { gerarVideoDoCard } = await import("@/components/compartilhar/video-card");
      const t0 = performance.now();
      const v = await gerarVideoDoCard(dados, alvo.formato as "stories" | "feed", (f, etapa) => setEstado(`${etapa} ${Math.round(f * 100)}%`));
      const w = window as unknown as { __video?: unknown };
      if (!v) { w.__video = { ok: false }; setEstado("não saiu"); return; }
      const u = URL.createObjectURL(v.blob);
      w.__video = { ok: true, url: u, bytes: v.blob.size, formato: v.formato, largura: v.largura, altura: v.altura, duracao: v.duracao, ms: Math.round(performance.now() - t0) };
      setUrl(u);
      setEstado(`pronto: ${v.formato} ${v.largura}×${v.altura} · ${(v.blob.size / 1e6).toFixed(1)} MB · ${Math.round(performance.now() - t0)} ms`);
    })().catch((e) => { (window as unknown as { __video?: unknown }).__video = { ok: false, erro: String(e) }; setEstado(`erro: ${String(e)}`); });
  }, [chave, moeda]);
  return (
    <div style={{ padding: 16, fontFamily: "Inter, sans-serif" }}>
      <div data-estado-video="">{estado}</div>
      {url && <video src={url} controls autoPlay muted loop style={{ width: 360, marginTop: 12, borderRadius: 12 }} />}
    </div>
  );
};

/** Os quadros da animação nos instantes pedidos (pra conferir a coreografia). */
const Quadros = ({ chave, tempos, moeda }: { chave: string; tempos: number[]; moeda: string | null }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const alvo = dadosDaChave(chave);
    if (!alvo || alvo.formato === "adesivo") return;
    let dados = alvo.dados;
    if (dados.tipo === "insignia" && moeda) dados = { ...dados, imagem: `/__moeda/${moeda}.png` };
    (async () => {
      const { prepararRoteiroDoCard } = await import("@/components/compartilhar/video-card");
      const r = await prepararRoteiroDoCard(dados, alvo.formato as "stories" | "feed");
      if (!r || !ref.current) return;
      const { w, h } = FORMATOS[alvo.formato];
      ref.current.innerHTML = "";
      for (const t of tempos) {
        const c = document.createElement("canvas");
        c.width = w / 2; c.height = h / 2;
        c.setAttribute("data-t", String(t));
        c.style.cssText = `width:${w / 4}px;height:${h / 4}px;margin:4px;border-radius:8px`;
        const ctx = c.getContext("2d", { alpha: false })!;
        r.desenhar(ctx, Math.min(t, r.duracao - 1 / 30), 0.5);
        ref.current.appendChild(c);
      }
      (window as unknown as { __duracao?: number }).__duracao = r.duracao;
      setPronto(true);
    })();
  }, [chave, tempos, moeda]);
  return <div ref={ref} data-quadros={pronto ? "prontos" : "preparando"} style={{ display: "flex", flexWrap: "wrap", padding: 8, background: "#222" }} />;
};

/** O "Treino concluído" de verdade, com a chave ligada SÓ nesta página e os treinos de exemplo no contexto. */
const TreinoConcluidoExemplo = () => {
  const [pronto] = useState(() => { try { localStorage.setItem(CHAVE_FORCA, "on"); } catch { /* sem storage */ } return true; });
  const semente: Record<string, unknown> = { "saude-workout-log": TREINOS_MES.dias };
  const ctx = { get: (k: string, fb: unknown) => (k in semente ? semente[k] : fb), set: () => {}, loaded: true, fetchKey: async () => undefined, isGuest: false, apagarTudo: async () => {} } as unknown as UserDataContextType;
  if (!pronto) return null;
  return (
    <UserDataContext.Provider value={ctx}>
      <TreinoConcluido
        aberto
        onFechar={() => {}}
        resumo={{
          diaNome: "TERÇA", dataTexto: "29 DE SETEMBRO", titulo: "Treino B · Costas e bíceps", minutos: 52,
          linhas: [
            { nome: "Puxada frente", series: 4, melhor: { carga: 45, reps: 10 }, recorde: true },
            { nome: "Remada baixa", series: 4, melhor: { carga: 40, reps: 12 }, recorde: false },
            { nome: "Rosca direta", series: 3, melhor: { carga: 12, reps: 12 }, recorde: false },
          ],
          volume: 5420, vsUltima: 6, sequencia: 4, nota: "", recorde: true,
        }}
      />
    </UserDataContext.Provider>
  );
};

const comValores = (d: DadosCard, v: boolean): DadosCard => ("valoresLigados" in d ? { ...d, valoresLigados: v } as DadosCard : d);

export const entradasDaGaleria = (): Entrada[] => {
  const out: Entrada[] = [];
  for (const ex of EXEMPLOS) {
    for (const formato of ["stories", "feed", "adesivo"] as Formato[]) {
      const { w, h } = FORMATOS[formato];
      out.push({
        chave: `card-${ex.id}-${formato}`,
        grupo: formato === "stories" ? "Stories / Status 9:16" : formato === "feed" ? "Feed 4:5" : "Adesivo (fundo transparente)",
        nome: ex.nome,
        w, h,
        el: (o) => {
          let dados = comValores(ex.dados, o.valores);
          if (dados.tipo === "insignia" && o.moeda) dados = { ...dados, imagem: `/__moeda/${o.moeda}.png` };
          return <CardDeCompartilhar dados={dados} formato={formato} camada={o.camada} />;
        },
      });
    }
  }
  for (const d of DIRECOES) {
    out.push({ chave: `dir-${d.id}-treinos`, grupo: "As 3 direções (comparação)", nome: `${d.nome} · treinos`, w: 1080, h: 1920, el: () => <d.Treino d={TREINOS_MES} /> });
    out.push({ chave: `dir-${d.id}-azul`, grupo: "As 3 direções (comparação)", nome: `${d.nome} · mês no azul`, w: 1080, h: 1920, el: () => <d.Azul d={AZUL_1} /> });
  }
  return out;
};

const Miniatura = ({ e, largura, o }: { e: Entrada; largura: number; o: Opcoes }) => {
  const s = largura / e.w;
  return (
    <figure style={{ margin: 0 }}>
      <a href={`?so=${e.chave}${o.valores ? "&valores=1" : ""}`} style={{ display: "block", width: largura, height: Math.round(e.h * s), overflow: "hidden", borderRadius: 12, boxShadow: "0 8px 24px -12px rgba(0,0,0,.4)", background: e.w === e.h ? "repeating-conic-gradient(#d9d4cb 0 25%, #eeeae3 0 50%) 0 0/24px 24px" : undefined }}>
        <div style={{ width: e.w, height: e.h, transform: `scale(${s})`, transformOrigin: "top left" }}>{e.el(o)}</div>
      </a>
      <figcaption style={{ fontSize: 12, fontWeight: 700, marginTop: 6, maxWidth: largura }}>{e.nome}</figcaption>
    </figure>
  );
};

const DevCompartilhar = () => {
  const [params] = useSearchParams();
  const so = params.get("so");
  const o: Opcoes = { camada: (params.get("camada") as Camada) || "tudo", valores: params.get("valores") === "1", moeda: params.get("moeda") };
  const entradas = useMemo(entradasDaGaleria, []);
  const tempos = useMemo(() => (params.get("t") ?? "0,1,2,3,4,5").split(",").map(Number).filter(Number.isFinite), [params]);
  useEffect(() => { (window as unknown as { __chavesCompartilhar?: string[] }).__chavesCompartilhar = entradas.map((e) => e.chave); }, [entradas]);
  if (params.get("video")) return <GerarVideo chave={params.get("video")!} moeda={o.moeda} />;
  if (params.get("quadros")) return <Quadros chave={params.get("quadros")!} tempos={tempos} moeda={o.moeda} />;
  if (params.get("treino")) return <TreinoConcluidoExemplo />;
  // 23/10: /dev/compartilhar?retro=1|pouca|incompleta — a tela da retrospectiva de outubro com a conta de exemplo (01/11)
  if (params.get("retro")) {
    const semente = SEMENTES_RETRO[params.get("retro")!] ?? SEMENTE_COMPLETA;
    return <RetroOutubro ler={leitorDe(semente)} agora={AGORA_EXEMPLO} onClose={() => {}} semDados={<div style={{ padding: 24 }}>Sem dados.</div>} />;
  }
  if (params.get("previa")) {
    const ex = EXEMPLOS.find((e) => e.id === params.get("previa"));
    if (!ex) return <div style={{ padding: 24 }}>Não achei a prévia.</div>;
    const f = (params.get("formato") as Formato) || "stories";
    const dados = ex.dados.tipo === "insignia" && o.moeda ? { ...ex.dados, imagem: `/__moeda/${o.moeda}.png` } : ex.dados;
    return <PreviaDoCard key={f} dados={dados} origem="dev" titulo={ex.nome.replace(/\s*\(.*\)$/, "")} onFechar={() => {}} formatoInicial={f} />;
  }
  if (so) {
    const e = entradas.find((x) => x.chave === so);
    if (!e) return <div style={{ padding: 24 }}>Não achei "{so}".</div>;
    return (
      <div data-so={so} style={{ width: e.w, height: e.h, background: "transparent" }}>
        <div data-card-alvo="" style={{ width: e.w, height: e.h }}>{e.el(o)}</div>
      </div>
    );
  }
  const grupos = [...new Set(entradas.map((e) => e.grupo))];
  return (
    <div style={{ padding: 20, background: "#f3f1ec", minHeight: "100vh", fontFamily: "Inter, sans-serif", color: "#1f1f24" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900 }}>Compartilhar · os cards (dev)</h1>
      <p style={{ fontSize: 13, color: "#5f574d" }}>Toque num card pra ver no tamanho real. <a href={o.valores ? "?" : "?valores=1"}>{o.valores ? "Esconder valores (padrão)" : "Mostrar valores (R$)"}</a></p>
      {grupos.map((g) => (
        <section key={g} style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#8a8175" }}>{g}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
            {entradas.filter((e) => e.grupo === g).map((e) => <Miniatura key={e.chave} e={e} largura={e.w === e.h ? 220 : e.h === 1350 ? 200 : 170} o={o} />)}
          </div>
        </section>
      ))}
    </div>
  );
};

export default DevCompartilhar;
