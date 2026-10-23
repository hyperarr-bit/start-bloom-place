import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Play } from "lucide-react";
import { CelebracaoFigurinha } from "@/components/conquistas/nova/CelebracaoFigurinha";
import { AdesivoRaro } from "@/components/conquistas/adesivos-raridade";
import { useConquistasNova } from "@/components/conquistas/nova/use-conquistas-nova";
import { raridadeDe } from "@/components/gamification/types";
import "./previa-comemoracoes.css";

const CENAS = [
  { id:"primeira", badge:"first-expense", nome:"A primeira", detalhe:"O começo da coleção", cor:"#a97d52" },
  { id:"comum", badge:"first-income", nome:"Comum", detalhe:"Uma pequena comemoração", cor:"#708c80" },
  { id:"raro", badge:"treino-25", nome:"Rara", detalhe:"Um momento de destaque", cor:"#6387a9" },
  { id:"epico", badge:"leitura-10", nome:"Épica", detalhe:"Uma história pra guardar", cor:"#a58ac1" },
  { id:"lendario", badge:"master", nome:"Lendária", detalhe:"Uma conquista extraordinária", cor:"#b69956" },
] as const;

/** Mostruário só na rota de desenvolvimento. Repete cenas sem gravar festas na conta. */
export function PreviaComemoracoes() {
  const navigate = useNavigate();
  const e = useConquistasNova();
  const [ativa, setAtiva] = useState<string | null>(null);
  const cena = CENAS.find(c => c.id === ativa);
  const badge = e.adesivos.find(b => b.id === cena?.badge);
  return <main className="pc-previa">
    <header><button onClick={() => navigate('/dev/conquistas-nova?todas=1')}><ArrowLeft size={18} /> Álbum</button><span>CORE · CONQUISTAS</span></header>
    <div className="pc-intro"><p>Pequenas conquistas. Grandes momentos.</p><h1>Tem uma figurinha<br />esperando por você.</h1><span>Toque para sentir cada chegada.</span></div>
    <div className="pc-cenas">{CENAS.map(c => {
      const b = e.adesivos.find(b => b.id === c.badge);
      return b && <button key={c.id} onClick={() => setAtiva(c.id)} style={{borderTopColor:c.cor}}>
        <span className="pc-arte"><AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={112} /></span>
        <strong>{c.nome}</strong><small>{c.detalhe}</small><span className="pc-ver"><Play size={12} fill="currentColor" /> Ver comemoração</span>
      </button>;
    })}</div>
    <p className="pc-nota">Você pode rever quantas vezes quiser. Esta é uma prévia com dados de teste.</p>
    <AnimatePresence>{cena && badge && <CelebracaoFigurinha key={cena.id} badge={badge} primeira={cena.id === "primeira"} onFechar={() => setAtiva(null)} onColar={() => navigate(`/dev/conquistas-nova?todas=1&novas=1&camada=colar&figurinha=${badge.id}`)} />}</AnimatePresence>
  </main>;
}
