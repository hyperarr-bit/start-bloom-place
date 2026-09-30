/**
 * A FICHA DE UM CUIDADO (28/09, Onda 1): FEITO (hoje ou outro dia), MARQUEI HORÁRIO,
 * o intervalo, onde/quem, preço, pacote de sessões, o aviso sem horário e o histórico.
 * Depois do FEITO, a oferta de 1 toque: "Lançar R$ 45,00 em Finanças · Beleza" —
 * nunca automático, e só pra data do mês corrente (o balde de Finanças é o mês).
 */
import { useEffect, useState } from "react";
import { Bell, CalendarPlus, Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { avisosNoApp } from "@/lib/avisos-no-app";
import { cn, parseLocalDay } from "@/lib/utils";
import { numeroBR } from "@/lib/data-normalizers";
import { trackEvent } from "@/lib/analytics";
import { AVISOS, AVISO_PADRAO, rotuloAviso } from "@/lib/compromissos";
import {
  EMOJI_DO_TIPO, faltaDoCuidado, gastoNoMes, noMesCorrente, proximaDoCuidado, textoDaFalta, textoDoPacote, type Cuidado,
} from "@/lib/beleza-cuidados";
import { BOTAO_CONTORNO, BOTAO_PILULA, Chip, ROTULO_BZ, Serif, TEMA_BELEZA } from "./kit";
import type { Cuidados } from "./use-cuidados";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaCurto = (dia: string) => parseLocalDay(dia).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
const nomeDoMes = (mes: string) => parseLocalDay(`${mes}-01`).toLocaleDateString("pt-BR", { month: "long" });
const CAMPO = "h-10 rounded-full px-4 text-[13px] bg-bz-cartao border-bz-linha-forte";

/** Número com rascunho: dá pra apagar e digitar de novo; grava só número válido, e no blur volta ao gravado. */
function CampoNumero({ valor, min, max, onValor, rotulo, className, testId }: { valor: number; min: number; max: number; onValor: (n: number) => void; rotulo: string; className?: string; testId?: string }) {
  const [txt, setTxt] = useState(String(valor));
  useEffect(() => { setTxt(String(valor)); }, [valor]);
  return (
    <Input
      inputMode="numeric"
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = Math.round(Number(e.target.value));
        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onValor(n);
      }}
      onBlur={() => setTxt(String(valor))}
      aria-label={rotulo}
      className={className}
      data-testid={testId}
    />
  );
}

/** A oferta depois do FEITO: lançar o gasto em Finanças, 1 toque. */
function OfertaFinancas({ c, dia, x, onFechar }: { c: Cuidado; dia: string; x: Cuidados; onFechar: () => void }) {
  const navigate = useNavigate();
  const [valor, setValor] = useState(c.preco ? String(c.preco).replace(".", ",") : "");
  const [lancado, setLancado] = useState(false);
  const n = numeroBR(valor);
  const ok = Number.isFinite(n) && n > 0;
  const noMes = noMesCorrente(dia, x.hoje);
  if (!noMes) {
    return <p className="text-[12px] text-bz-suave" data-testid="oferta-fora-do-mes">Foi em outro mês: o gasto vai direto em Finanças, no mês dele.</p>;
  }
  if (lancado) {
    return <Chip tom="ok" className="text-[12px] leading-[26px] px-3"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Lançado em Finanças · Beleza</Chip>;
  }
  const lancar = () => {
    if (!ok) return;
    x.lancar(c, dia, Math.round(n * 100) / 100);
    setLancado(true);
    trackEvent("cuidado_gasto_lancado", { tipo: c.tipo });
    toast.success(`💸 ${reais(n)} em Beleza`, { action: { label: "Ver Finanças", onClick: () => navigate("/financas") } });
  };
  return (
    <div className="rounded-2xl border border-dashed border-bz-dica-borda bg-bz-dica p-3 space-y-2" data-testid="oferta-financas">
      <p className="text-[13px] text-bz-dica-tinta">Lançar o gasto em <b>Finanças · Beleza</b>?</p>
      <div className="flex gap-2">
        {!c.preco && (
          <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="Quanto foi? (R$)" aria-label="Quanto foi" className={CAMPO} />
        )}
        <button type="button" disabled={!ok} onClick={lancar} className={cn(BOTAO_PILULA, c.preco ? "flex-1" : "")} data-testid="lancar-financas">
          {ok ? `Lançar ${reais(n)}` : "Lançar"}
        </button>
        <button type="button" onClick={onFechar} className="h-10 px-3 rounded-full bg-transparent text-[12.5px] font-semibold text-bz-dica-tinta/80">Agora não</button>
      </div>
    </div>
  );
}

export function FichaDoCuidado({ x, id, onFechar }: { x: Cuidados; id: string | null; onFechar: () => void }) {
  const c = id ? x.cuidados.find((y) => y.id === id) ?? null : null;
  const [feitoEm, setFeitoEm] = useState<string | null>(null);
  const [outroDia, setOutroDia] = useState(false);
  const [diaFeito, setDiaFeito] = useState("");
  const [marcando, setMarcando] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("14:00");
  const [aviso, setAviso] = useState(AVISO_PADRAO);
  const [preco, setPreco] = useState("");
  useEffect(() => {
    setFeitoEm(null); setOutroDia(false); setMarcando(false);
    setDiaFeito(x.hoje);
    setData(c ? proximaDoCuidado(c) ?? x.hoje : x.hoje);
    setPreco(c?.preco ? String(c.preco).replace(".", ",") : "");
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const aberto = !!c;
  const proxima = c ? proximaDoCuidado(c) : undefined;
  const falta = c ? faltaDoCuidado(c, x.hoje) : undefined;
  const mes = x.hoje.slice(0, 7);
  const gastoMes = c ? gastoNoMes(c, mes) : { total: 0, vezes: 0 };

  const feito = (dia: string) => {
    if (!c || !dia || dia > x.hoje) return;
    const p = numeroBR(preco);
    x.feito(c.id, dia, { preco: Number.isFinite(p) && p > 0 ? p : undefined });
    setFeitoEm(dia);
    setOutroDia(false);
    trackEvent("cuidado_feito", { tipo: c.tipo, outro_dia: dia !== x.hoje });
  };

  const salvarHorario = () => {
    if (!c || !data || !/^\d{1,2}:\d{2}$/.test(hora)) return;
    x.marcar(c.id, data, hora, aviso);
    setMarcando(false);
    trackEvent("cuidado_horario", { tipo: c.tipo, aviso });
    toast.success(`${c.nome}: ${diaCurto(data)} às ${hora}`, { description: "Está na Rotina, com aviso." });
  };

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="bottom" semFechar className={cn(TEMA_BELEZA, "rounded-t-3xl bg-bz-cartao border-bz-linha p-0 max-h-[92dvh] overflow-y-auto")}>
        {c && (
          <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]" data-testid="ficha-cuidado">
            <div className="bg-bz-rose text-bz-rose-tinta px-3 pt-3 pb-3.5 rounded-t-3xl flex items-start gap-2">
              <span className="w-10 h-10 shrink-0 rounded-full bg-bz-cartao/80 grid place-items-center text-[19px]" aria-hidden="true">{EMOJI_DO_TIPO[c.tipo]}</span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-[11.5px] font-extrabold tracking-[.14em] uppercase text-current">Cuidado · a cada {c.intervaloDias} dias</SheetTitle>
                <SheetDescription asChild>
                  <p className="mt-0.5"><Serif className="text-[24px] leading-tight text-bz-rose-tinta">{c.nome}</Serif></p>
                </SheetDescription>
                <p className="text-[12px] font-semibold opacity-85" data-testid="ficha-proxima">
                  {proxima ? <>Próxima: {diaCurto(proxima)} · {textoDaFalta(falta)}</> : "Marque a primeira vez que fez"}
                  {c.horario ? ` · horário ${c.horario.hora}` : ""}
                  {c.pacote ? ` · ${textoDoPacote(c.pacote)}` : ""}
                </p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Fechar" className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-bz-cartao/60">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3 space-y-4">
              {feitoEm ? (
                <div className="space-y-2" data-testid="feito-ok">
                  <p className="text-[14px] text-bz-tinta"><b>Feito ✓</b> {feitoEm === x.hoje ? "hoje" : diaCurto(feitoEm)}. Próxima: <b>{proxima ? diaCurto(proxima) : "—"}</b>.</p>
                  <OfertaFinancas c={c} dia={feitoEm} x={x} onFechar={() => setFeitoEm(null)} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => feito(x.hoje)} className={cn(BOTAO_PILULA, "flex-1 h-11")} data-testid="cuidado-feito">
                      <Check className="w-4 h-4 inline mr-1" aria-hidden="true" /> FEITO hoje
                    </button>
                    <button type="button" onClick={() => setMarcando((m) => !m)} className={cn(BOTAO_CONTORNO, "flex-1 h-11")} data-testid="marquei-horario">
                      <CalendarPlus className="w-4 h-4 inline mr-1" aria-hidden="true" /> Marquei horário
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex-1 min-w-0">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-bz-suave pointer-events-none" aria-hidden="true">R$</span>
                      <Input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="quanto foi (opcional)" aria-label="Preço" className={cn(CAMPO, "pl-11")} />
                    </span>
                    {outroDia ? (
                      <>
                        <input type="date" value={diaFeito} max={x.hoje} onChange={(e) => setDiaFeito(e.target.value)} aria-label="Dia em que fez" className="h-10 px-3 rounded-full border border-bz-linha-forte bg-bz-cartao text-bz-tinta text-[13px] font-bold" data-testid="dia-feito" />
                        <button type="button" onClick={() => feito(diaFeito)} className={BOTAO_PILULA} data-testid="cuidado-feito-outro">OK</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setOutroDia(true)} className="shrink-0 h-10 px-3 rounded-full bg-transparent text-[12.5px] font-semibold text-bz-suave">Foi outro dia</button>
                    )}
                  </div>
                </div>
              )}

              {marcando && (
                <div className="rounded-2xl border border-bz-linha bg-bz-papel p-3 space-y-2.5" data-testid="form-horario">
                  <p className={ROTULO_BZ}>Marquei horário</p>
                  <div className="flex gap-2">
                    <input type="date" value={data} min={x.hoje} onChange={(e) => setData(e.target.value)} aria-label="Dia do horário" className="flex-1 h-10 px-3 rounded-full border border-bz-linha-forte bg-bz-cartao text-bz-tinta text-[13px] font-bold" data-testid="horario-dia" />
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" className="w-[116px] h-10 px-3 rounded-full border border-bz-linha-forte bg-bz-cartao text-bz-tinta text-[13px] font-bold text-center" data-testid="horario-hora" />
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aviso">
                    {AVISOS.filter((a) => [-1, 60, 120, 1440].includes(a.valor)).map((a) => (
                      <button key={a.valor} type="button" aria-pressed={aviso === a.valor} onClick={() => setAviso(a.valor)}
                        className={cn("h-9 px-3 rounded-full text-[12px] font-semibold border", aviso === a.valor ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave")}>
                        {a.rotulo}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={salvarHorario} className={cn(BOTAO_PILULA, "w-full")} data-testid="salvar-horario">Salvar na Rotina</button>
                  <p className="text-[11.5px] text-bz-suave">Vira um compromisso da Rotina ({rotuloAviso(aviso).toLowerCase()}), com o aviso do CORE.</p>
                </div>
              )}
              {c.horario && !marcando && (
                <div className="flex items-center gap-2 rounded-2xl bg-bz-blush px-3 py-2" data-testid="horario-marcado">
                  <CalendarPlus className="w-4 h-4 text-bz-acento shrink-0" aria-hidden="true" />
                  <p className="text-[12.5px] text-bz-tinta flex-1">Horário: <b>{diaCurto(c.horario.data)} às {c.horario.hora}</b> · na Rotina</p>
                  <button type="button" onClick={() => x.desmarcar(c.id)} className="h-9 px-3 rounded-full bg-transparent text-[12px] font-semibold text-bz-suave">Desmarcar</button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={ROTULO_BZ}>Nome</span>
                  <Input value={c.nome} onChange={(e) => x.mudar(c.id, { nome: e.target.value })} aria-label="Nome do cuidado" className={cn(CAMPO, "mt-1")} />
                </label>
                <label className="block">
                  <span className={ROTULO_BZ}>A cada (dias)</span>
                  <CampoNumero valor={c.intervaloDias} min={1} max={365} onValor={(v) => x.mudar(c.id, { intervaloDias: v })} rotulo="Intervalo em dias" className={cn(CAMPO, "mt-1")} testId="intervalo" />
                </label>
                <label className="block">
                  <span className={ROTULO_BZ}>Última vez</span>
                  <input type="date" value={c.ultima ?? ""} max={x.hoje} onChange={(e) => x.mudar(c.id, { ultima: e.target.value || undefined })} aria-label="Última vez" className="mt-1 w-full h-10 px-3 rounded-full border border-bz-linha-forte bg-bz-cartao text-bz-tinta text-[13px] font-bold" data-testid="ultima" />
                </label>
                <label className="block">
                  <span className={ROTULO_BZ}>Onde / com quem</span>
                  <Input value={c.local ?? ""} onChange={(e) => x.mudar(c.id, { local: e.target.value })} placeholder="Studio, manicure…" aria-label="Onde ou com quem" className={cn(CAMPO, "mt-1")} />
                </label>
              </div>

              {(c.pacote || c.tipo === "laser") && (
                <div>
                  <p className={ROTULO_BZ}>Pacote de sessões</p>
                  <div className="mt-1 flex items-center gap-2 text-[13px] text-bz-tinta">
                    <CampoNumero valor={c.pacote?.feitas ?? 0} min={0} max={99} onValor={(v) => x.mudar(c.id, { pacote: { total: c.pacote?.total ?? 10, feitas: v } })} rotulo="Sessões feitas" className={cn(CAMPO, "w-20 text-center")} />
                    <span>feitas de</span>
                    <CampoNumero valor={c.pacote?.total ?? 10} min={1} max={99} onValor={(v) => x.mudar(c.id, { pacote: { feitas: c.pacote?.feitas ?? 0, total: v } })} rotulo="Total de sessões" className={cn(CAMPO, "w-20 text-center")} />
                  </div>
                </div>
              )}

              {/* o aviso só no app (30/09): na web ele não toca — seria botão morto */}
              {avisosNoApp() && <div className="flex items-center gap-3 rounded-2xl border border-bz-linha px-3 py-2.5">
                <Bell className="w-4 h-4 text-bz-acento shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-bz-tinta">Avisar {c.avisoDiasAntes} {c.avisoDiasAntes === 1 ? "dia" : "dias"} antes</p>
                  <p className="text-[11.5px] text-bz-suave">às 09:00, quando não tem horário marcado</p>
                  <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Dias antes">
                    {[1, 2, 3, 7].map((n) => (
                      <button key={n} type="button" aria-pressed={c.avisoDiasAntes === n} onClick={() => x.mudar(c.id, { avisoDiasAntes: n })}
                        className={cn("w-10 h-9 rounded-full text-[12px] font-bold border", c.avisoDiasAntes === n ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave")}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <Switch checked={!!c.avisoLigado} onCheckedChange={(v) => x.mudar(c.id, { avisoLigado: v }, v)} aria-label={`Aviso antes de ${c.nome}`} data-testid="aviso-cuidado" />
              </div>}

              <div>
                <p className={ROTULO_BZ}>Histórico</p>
                {gastoMes.vezes > 0 && (
                  <p className="mt-1 text-[12.5px] text-bz-tinta" data-testid="gasto-do-mes">
                    Em {nomeDoMes(mes)}: <b>{gastoMes.vezes}×</b>{gastoMes.total > 0 ? <> · <b>{reais(gastoMes.total)}</b></> : null}
                  </p>
                )}
                {c.historico.length ? (
                  <ul className="mt-1 divide-y divide-bz-linha rounded-2xl border border-bz-linha overflow-hidden">
                    {[...c.historico].reverse().slice(0, 8).map((h, i) => (
                      <li key={`${h.data}-${i}`} className="px-3 py-2 flex items-center gap-2 text-[12.5px] text-bz-tinta">
                        <span className="font-semibold tabular-nums">{diaCurto(h.data)}</span>
                        {h.local && <span className="text-bz-suave truncate">· {h.local}</span>}
                        {h.preco ? <span className="ml-auto tabular-nums font-semibold">{reais(h.preco)}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12.5px] text-bz-suave italic">Nada ainda — o FEITO entra aqui, com data, onde e preço.</p>
                )}
              </div>

              <button type="button" onClick={() => { x.remover(c.id); onFechar(); }} className="w-full h-10 rounded-full border border-bz-linha-forte bg-transparent text-[13px] font-semibold text-bz-alerta-tinta inline-flex items-center justify-center gap-1.5">
                <Trash2 className="w-4 h-4" aria-hidden="true" /> Remover cuidado
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
