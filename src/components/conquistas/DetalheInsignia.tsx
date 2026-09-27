import { useNavigate } from "react-router-dom";
import { ChevronRight, Clapperboard, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { parseLocalDay } from "@/lib/utils";
import { Insignia } from "./Insignia";
import { NOME_FAIXA, fmtAlvo, linhaDe, periodoTexto, type Insignia as DadosInsignia } from "./insignias";
import "./conquistas.css";

/**
 * O detalhe de uma insígnia (folha de baixo): o objeto grande, área ·
 * período, o nome, o chip da faixa, a linha que fala o número e quanto
 * falta pra próxima faixa, as 3 faixas, a barra, o aviso das sensíveis, e
 * "Postar esta conquista em vídeo" (com faixa e orgulho ≥ 4) ou "Ir pra
 * <módulo>".
 */
interface Props {
  ins: DadosInsignia | null;
  mesIdx: number;
  onClose: () => void;
  onPostar: (i: DadosInsignia) => void;
}

export const DetalheInsignia = ({ ins, mesIdx, onClose, onPostar }: Props) => {
  const navigate = useNavigate();
  if (!ins) return null;
  const trancada = !ins.faixa;
  const prox = ins.proxima;
  const fracao = prox ? Math.min(1, ins.valor / prox.alvo) : 1;
  const podePostar = !!ins.faixa && ins.orgulho >= 4 && !ins.nuncaHeroi;
  const faltaTxt = prox ? `Faltam ${fmtAlvo(Math.max(0, Math.round((prox.alvo - ins.valor) * 10) / 10), ins.fmt)} pra ${NOME_FAIXA[prox.faixa].toLowerCase()}.` : "Faixa máxima: ouro.";
  const desde = ins.desde ? parseLocalDay(ins.desde).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

  return (
    <Sheet open={!!ins} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="detalhe-insignia" data-insignia={ins.id}>
        <div className="max-w-sm mx-auto pt-2">
          <div className="flex items-center gap-4">
            <span className="shrink-0"><Insignia ins={ins} tamanho={116} trancada={trancada} estatico /></span>
            <div className="min-w-0">
              <div className="pin-rot text-muted-foreground" style={{ fontSize: 9.5 }}>{ins.areaNome} · {periodoTexto(ins, mesIdx)}</div>
              <SheetTitle className="text-[20px] font-black tracking-tight leading-[1.1] mt-1">{ins.nome}</SheetTitle>
              <div className="mt-1.5">
                {ins.faixa ? (
                  <span className="chip-faixa" data-faixa={ins.faixa} style={{ height: 18, fontSize: 9 }}>insígnia de {NOME_FAIXA[ins.faixa].toLowerCase()}</span>
                ) : (
                  <span className="chip-faixa" data-faixa="nada" style={{ height: 18, fontSize: 9 }}>a conquistar</span>
                )}
              </div>
            </div>
          </div>

          <SheetDescription className="text-[13px] text-muted-foreground mt-3.5 leading-[1.4]" data-testid="detalhe-insignia-texto">
            {trancada
              ? ins.valor > 0
                ? <>Você está em <b className="text-foreground">{linhaDe(ins, mesIdx)}</b>. O bronze vem com {fmtAlvo(ins.faixas[0], ins.fmt)}.</>
                : <>Ainda sem dado. O bronze vem com {fmtAlvo(ins.faixas[0], ins.fmt)} — cada registro conta.</>
              : <><b className="text-foreground">{linhaDe(ins, mesIdx)}</b>. {faltaTxt}</>}
          </SheetDescription>
          <p className="text-[11px] text-muted-foreground mt-1">
            Faixas: bronze {fmtAlvo(ins.faixas[0], ins.fmt)} · prata {fmtAlvo(ins.faixas[1], ins.fmt)} · ouro {fmtAlvo(ins.faixas[2], ins.fmt)}
          </p>
          {prox && (
            <>
              <div className="det-barra"><i style={{ width: `${Math.round(fracao * 100)}%` }} /></div>
              <div className="text-[11px] font-extrabold text-muted-foreground mt-1 text-right tabular-nums">{ins.texto} / {fmtAlvo(prox.alvo, ins.fmt)}</div>
            </>
          )}
          {ins.sensivel && (
            <p className="text-[11.5px] text-muted-foreground mt-3 inline-flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-[1px]" aria-hidden />
              <span>Esta insígnia mostra um valor sensível. Só aparece nas artes com <b className="text-foreground">mostrar valores</b> ligado.</span>
            </p>
          )}
          {desde && <p className="text-[11px] text-muted-foreground mt-2">O registro por dia começou em {desde} — a conta vale daí pra frente.</p>}

          <div className="flex flex-col gap-1 mt-4">
            {podePostar ? (
              <button type="button" onClick={() => onPostar(ins)} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2" data-testid="detalhe-postar">
                <Clapperboard className="w-[18px] h-[18px]" aria-hidden /> Postar esta conquista em vídeo
              </button>
            ) : (
              <button type="button" onClick={() => { onClose(); navigate(ins.rota); }} className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2" data-testid="detalhe-ir">
                Ir pra {ins.areaNome} <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={onClose} className="h-10 rounded-xl text-[13px] font-bold text-muted-foreground" data-testid="detalhe-insignia-fechar">Fechar</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
