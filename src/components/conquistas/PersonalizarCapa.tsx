import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import type { Badge } from "../gamification/types";
import { CapaAlbum } from "./CapaAlbum";
import { Adesivo } from "./adesivos-arte";
import { CORES_CAPA, figurinhasDaCapa, type CapaPessoal, type CorCapa } from "./capa-pessoal";

export function PersonalizarCapa({ inicial, adesivos, datas, pendentes, nome, ano, onSalvar, onFechar }: {
  inicial: CapaPessoal; adesivos: Badge[]; datas: Record<string,string>; pendentes: string[];
  nome: string; ano: number; onSalvar: (c: CapaPessoal) => void; onFechar: () => void;
}) {
  const [capa, setCapa] = useState(inicial);
  const [aviso, setAviso] = useState("");
  const selecionadas = figurinhasDaCapa(capa, adesivos, datas, pendentes);
  const ganhas = adesivos.filter(b => b.unlocked && !b.arquivada).sort((a,b) => (datas[b.id] ?? "").localeCompare(datas[a.id] ?? "") || a.name.localeCompare(b.name));
  const escolher = (id: string) => {
    const ids = selecionadas.map(b => b.id);
    if (!ids.includes(id) && ids.length === 3) { setAviso("Retire uma das três para escolher outra."); return; }
    setCapa(c => ({ ...c, figurinhas: ids.includes(id) ? ids.filter(x => x !== id) : [...ids,id] }));
    setAviso("");
  };
  return <Dialog.Root open onOpenChange={aberta => { if (!aberta) onFechar(); }}><Dialog.Portal>
    <Dialog.Overlay className="capa-editor-overlay"/>
    <Dialog.Content className="capa-editor" data-testid="personalizar-capa">
      <header><Dialog.Title>Sua capa, do seu jeito</Dialog.Title><Dialog.Close aria-label="Fechar personalização"><X size={21}/></Dialog.Close></header>
      <div className="capa-editor-corpo">
        <Dialog.Description>Uma cor e até três figurinhas da sua coleção.</Dialog.Description>
        <div className="capa-editor-preview"><CapaAlbum referencia largura={150} maisRaros={[]} figurinhasCapa={selecionadas} corCapa={capa.cor} abertos={ganhas.length} total={adesivos.length} nome={nome} ano={ano}/></div>
        <fieldset><legend>Cor · {CORES_CAPA[capa.cor].nome}</legend><div className="capa-cores">{Object.entries(CORES_CAPA).map(([id,c]) => <button type="button" key={id} aria-label={c.nome} aria-pressed={capa.cor === id} onClick={() => setCapa(v => ({...v,cor: id as CorCapa}))}><i style={{background:c.cor}}>{capa.cor===id && <Check size={19}/>}</i></button>)}</div></fieldset>
        <fieldset><legend>Figurinhas · {selecionadas.length}/3</legend>
          <p>{ganhas.length ? "A primeira fica em destaque. Toque numa escolhida para retirar." : "Sua capa já tem a sua cor. As figurinhas chegam com suas conquistas."}</p>
          <div className="capa-editor-selecao"><button type="button" onClick={() => { setCapa(c => ({...c,figurinhas:null}));setAviso(""); }}>Composição automática</button>
            {selecionadas.slice(1).map(b => <button type="button" key={b.id} onClick={() => setCapa(c => ({...c,figurinhas:[b.id,...selecionadas.filter(x=>x.id!==b.id).map(x=>x.id)]}))}>Destacar {b.name}</button>)}
          </div>
          <p role="status" aria-live="polite">{aviso}</p>
          <div className="capa-editor-grade">{ganhas.map(b => { const i=selecionadas.findIndex(x=>x.id===b.id); return <button type="button" key={b.id} aria-pressed={i>=0} onClick={()=>escolher(b.id)} aria-label={`${b.name}${i===0 ? ", principal" : i>0 ? ", na capa" : ""}`}><Adesivo id={b.id} tamanho={74}/><span>{b.name}</span>{i>=0 && <b aria-hidden>{i+1}</b>}</button>; })}</div>
        </fieldset>
      </div>
      <footer><button type="button" onClick={onFechar}>Cancelar</button><button type="button" onClick={()=>onSalvar(capa)}>Salvar minha capa</button></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
