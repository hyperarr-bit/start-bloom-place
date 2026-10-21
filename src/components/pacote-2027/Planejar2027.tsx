import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import {
  HORAS_REVISAO, IDEIAS_DE_META, guardarNoAno, metasPreenchidas,
  type Data2027, type Plano2027, type TipoData2027,
} from "@/lib/pacote-2027";

/**
 * "PLANEJAR 2027" (21/10) — 4 folhas de planner em tela cheia (mockups d1–d4): 3 metas → gastar/guardar por mês →
 * as datas que importam → a hora da revisão do mês + resumo → "Salvar no meu CORE". O rascunho fica no componente; só
 * o "Salvar" grava (nos módulos e no pacote). Fechar no X não grava nada.
 */
const TIPOS: { id: TipoData2027; emoji: string; rotulo: string; vai: string }[] = [
  { id: "aniversario", emoji: "🎂", rotulo: "Aniversário", vai: "vai pra Relações" },
  { id: "checkup", emoji: "🩺", rotulo: "Check-up", vai: "vai pra Saúde · o CORE avisa na véspera" },
  { id: "data", emoji: "📌", rotulo: "Outra data", vai: "vai pra Relações → Datas" },
];
const reaisDigitados = (s: string) => Number(s.replace(/[^\d]/g, "").slice(0, 8)) || 0;
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
const novoIdData = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Planejar2027({ inicial, onSalvar, onFechar }: { inicial: Plano2027; onSalvar: (p: Plano2027) => void; onFechar: () => void }) {
  const [passo, setPasso] = useState(1);
  const [p, setP] = useState<Plano2027>(inicial);
  const [tipo, setTipo] = useState<TipoData2027>("aniversario");
  const [nome, setNome] = useState("");
  const [dia, setDia] = useState("");

  useEffect(() => { trackEvent("plano2027_passo", { passo }); }, [passo]);

  const addData = () => {
    if (!nome.trim() || !/^2027-\d{2}-\d{2}$/.test(dia)) return;
    const d: Data2027 = { id: novoIdData(), tipo, titulo: nome.trim().slice(0, 60), dia };
    setP((x) => ({ ...x, datas: [...x.datas, d].sort((a, b) => a.dia.localeCompare(b.dia)) }));
    setNome(""); setDia("");
  };
  const ir = (n: number) => { setPasso(n); try { window.scrollTo?.(0, 0); } catch { /* jsdom */ } };

  const titulo = (a: string, b: string) => (
    <h1 className="text-[26px] leading-[1.08] font-black tracking-tight mt-1 mb-1.5">{a} <span className="text-accent">{b}</span></h1>
  );

  return (
    <div className="fixed inset-0 z-[300] bg-background flex flex-col" data-testid="planejar-2027" data-passo={passo}>
      <div className="flex items-center justify-between px-[18px] pt-3.5 pb-1.5">
        <span className="text-[11px] font-extrabold tracking-[.1em] text-muted-foreground">PLANEJAR 2027 · {passo} DE 4</span>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="w-8 h-8 rounded-full bg-muted grid place-items-center" data-testid="planejar-2027-fechar"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-1.5 px-[18px]">{[1, 2, 3, 4].map((i) => <i key={i} className={`flex-1 h-[5px] rounded-full ${i <= passo ? "bg-accent" : "bg-muted"}`} />)}</div>

      <div className="flex-1 overflow-y-auto px-[18px] pt-4 pb-4">
        {passo === 1 && (
          <div data-testid="planejar-2027-metas">
            {titulo("Suas 3 metas de", "2027")}
            <p className="text-[13.5px] text-muted-foreground mb-3.5">Uma frase cada. Elas vão pro módulo Metas, divididas por trimestre.</p>
            {p.metas.map((m, i) => (
              <label key={i} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2.5 mb-2">
                <b className="w-6 h-6 rounded-lg bg-accent/10 text-accent grid place-items-center text-[12px] font-black shrink-0">{i + 1}</b>
                <input value={m} maxLength={80} placeholder="Toque pra escrever…" aria-label={`Meta ${i + 1}`} data-testid={`planejar-2027-meta-${i + 1}`}
                  onChange={(e) => setP((x) => ({ ...x, metas: x.metas.map((v, k) => (k === i ? e.target.value : v)) }))}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-bold placeholder:text-muted-foreground/60 placeholder:font-semibold" />
              </label>
            ))}
            <p className="text-[10.5px] font-extrabold tracking-[.08em] text-muted-foreground mt-3">IDEIAS</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {IDEIAS_DE_META.map((ideia) => (
                <button key={ideia} type="button" className="text-[12px] font-bold px-2.5 py-1.5 rounded-full bg-card border border-border"
                  onClick={() => setP((x) => { const i = x.metas.findIndex((v) => !v.trim()); if (i < 0) return x; const texto = ideia.replace(/^\S+\s/, ""); return { ...x, metas: x.metas.map((v, k) => (k === i ? texto : v)) }; })}>
                  <span>{ideia}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {passo === 2 && (
          <div data-testid="planejar-2027-dinheiro">
            {titulo("Seu dinheiro em", "2027")}
            <p className="text-[13.5px] text-muted-foreground mb-3.5">Mais ou menos. Dá pra mudar mês a mês na revisão.</p>
            {([["gastarMes", "Quero gastar no máximo, por mês"], ["guardarMes", "Quero guardar, por mês"]] as const).map(([k, rot]) => (
              <label key={k} className="block bg-card border border-border rounded-2xl px-3.5 py-3 mb-2.5">
                <span className="block text-[11px] font-extrabold tracking-[.06em] uppercase text-muted-foreground">{rot}</span>
                <span className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[18px] font-black">R$</span>
                  <input inputMode="numeric" value={p[k] ? p[k].toLocaleString("pt-BR") : ""} placeholder="0" data-testid={`planejar-2027-${k}`}
                    onChange={(e) => { const n = reaisDigitados(e.target.value); setP((x) => ({ ...x, [k]: n })); }}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[28px] font-black tracking-tight" />
                </span>
              </label>
            ))}
            <div className="text-[12px] bg-accent/10 rounded-xl px-3 py-2.5 leading-snug">
              {p.guardarMes > 0 ? <>No fim de 2027: <b>{brl(guardarNoAno(p))} guardados</b> (+ R$ 1.378 se fizer o cofrinho das 52 semanas).<br /></> : null}
              Os limites por categoria você põe em Finanças → Limites, na revisão de cada mês.
            </div>
          </div>
        )}

        {passo === 3 && (
          <div data-testid="planejar-2027-datas">
            {titulo("As datas que", "importam")}
            <p className="text-[13.5px] text-muted-foreground mb-3">Aniversários, check-ups e o que não pode esquecer.</p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {TIPOS.map((t) => (
                <button key={t.id} type="button" aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)} data-testid={`planejar-2027-tipo-${t.id}`}
                  className={`text-[12px] font-bold px-2.5 py-1.5 rounded-full border ${tipo === t.id ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
                  <span>{t.emoji} {t.rotulo}</span>
                </button>
              ))}
            </div>
            {p.datas.map((d) => {
              const t = TIPOS.find((x) => x.id === d.tipo)!;
              return (
                <div key={d.id} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2 mb-1.5" data-testid="planejar-2027-data">
                  <i className="not-italic text-[18px] w-8 h-8 rounded-lg bg-muted grid place-items-center">{t.emoji}</i>
                  <span className="flex-1 min-w-0"><b className="block text-[13.5px] truncate">{d.titulo}</b><small className="text-[11px] text-muted-foreground">{t.vai}</small></span>
                  <em className="not-italic text-[12px] font-extrabold">{d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}</em>
                  <button type="button" aria-label={`Tirar ${d.titulo}`} className="w-7 h-7 grid place-items-center text-muted-foreground"
                    onClick={() => setP((x) => ({ ...x, datas: x.datas.filter((y) => y.id !== d.id) }))}><X className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-2.5 py-2 mt-1">
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} data-testid="planejar-2027-data-nome"
                placeholder={tipo === "aniversario" ? "Nome" : tipo === "checkup" ? "Ex.: Check-up anual" : "Ex.: IPVA"}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-semibold" />
              <input type="date" min="2027-01-01" max="2027-12-31" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia em 2027" data-testid="planejar-2027-data-dia"
                className="w-[128px] bg-transparent outline-none text-[13px] font-semibold" />
              <button type="button" onClick={addData} aria-label="Adicionar data" data-testid="planejar-2027-data-add"
                className="w-8 h-8 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {passo === 4 && (
          <div data-testid="planejar-2027-revisao">
            {titulo("Sua revisão do", "mês")}
            <p className="text-[13.5px] text-muted-foreground mb-3">Todo dia 1, 5 minutos: olhar o mês que passou e arrumar o próximo.</p>
            <p className="text-[10.5px] font-extrabold tracking-[.08em] text-muted-foreground">QUE HORAS?</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {HORAS_REVISAO.map((h) => (
                <button key={h} type="button" aria-pressed={p.horaRevisao === h} onClick={() => setP((x) => ({ ...x, horaRevisao: h }))} data-testid={`planejar-2027-hora-${h}`}
                  className={`text-[12px] font-bold px-3 py-1.5 rounded-full border ${p.horaRevisao === h ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}><span>{h}</span></button>
              ))}
              <button type="button" aria-pressed={p.horaRevisao === null} onClick={() => setP((x) => ({ ...x, horaRevisao: null }))}
                className={`text-[12px] font-bold px-3 py-1.5 rounded-full border ${p.horaRevisao === null ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}><span>Sem lembrete</span></button>
            </div>
            <div className="text-[12px] bg-accent/10 rounded-xl px-3 py-2.5 leading-snug mt-3">
              {p.horaRevisao
                ? <>Vai pra sua <b>Rotina</b> (12 compromissos, um por mês) e o celular avisa na hora — no app das lojas.</>
                : <>Sem compromisso na Rotina. As revisões continuam aqui, no Seu 2027.</>}
            </div>
            <div className="bg-card border border-border rounded-xl p-3.5 mt-3" data-testid="planejar-2027-resumo">
              <p className="text-[10.5px] font-extrabold tracking-[.08em] text-muted-foreground mb-1">SEU 2027</p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                🎯 {metasPreenchidas(p).length} {metasPreenchidas(p).length === 1 ? "meta" : "metas"}
                {p.gastarMes > 0 || p.guardarMes > 0 ? <> · 💰 gastar {brl(p.gastarMes)} e guardar {brl(p.guardarMes)} por mês</> : null}
                {" "}· 📅 {p.datas.length} {p.datas.length === 1 ? "data" : "datas"}
                {p.horaRevisao ? <> · 🗓️ revisão dia 1 às {p.horaRevisao}</> : null}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-[18px] pt-3 pb-[calc(18px+env(safe-area-inset-bottom))] flex flex-col gap-1.5">
        <button type="button" data-testid="planejar-2027-proximo"
          className="h-[52px] rounded-full bg-foreground text-background text-[15px] font-extrabold active:scale-[0.98]"
          onClick={() => (passo < 4 ? ir(passo + 1) : onSalvar(p))}>
          <span>{passo < 4 ? "Próximo" : "Salvar no meu CORE"}</span>
        </button>
        <button type="button" className="text-[13.5px] font-bold text-muted-foreground py-2" data-testid="planejar-2027-voltar"
          onClick={() => (passo > 1 ? ir(passo - 1) : ir(2))}>
          {passo > 1 ? "Voltar" : "Pular por agora"}
        </button>
      </div>
    </div>
  );
}
