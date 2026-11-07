import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Share2, X, Loader2 } from "lucide-react";
import { raridadeDe, type Badge } from "../gamification/types";
import { StoriesAdesivo } from "./StoryFigurinha";
import { gerarPng } from "./gerar-imagem";
import { compartilharFigurinhaPronta } from "./compartilhar-conquistas";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import "./compartilhar-figurinha.css";

export function CompartilharFigurinha({ badge, onFechar }: {badge:Badge;onFechar:()=>void}) {
  const [recorte,setRecorte]=useState(false);
  const [arquivo,setArquivo]=useState<{blob:Blob;recorte:boolean}|null>(null);
  const [erro,setErro]=useState(false);
  const [imagem,setImagem]=useState<{blob:Blob;url:string}|null>(null);
  const [enviando,setEnviando]=useState(false);
  const [tentativa,setTentativa]=useState(0);
  const [escala,setEscala]=useState(.2);
  const [palco,setPalco]=useState<HTMLDivElement|null>(null);
  const raridade=raridadeDe(badge);
  const altura=recorte?1080:1920;
  const pronto=arquivo?.recorte===recorte ? arquivo.blob : null;
  useEffect(()=>{
    let vivo=true;
    setArquivo(null);setErro(false);
    gerarPng(<StoriesAdesivo id={badge.id} titulo={badge.name} raridade={raridade} transparente={recorte}/>,{largura:1080,altura}).then(blob=>{
      if(!vivo)return;
      if(blob)setArquivo({blob,recorte});else setErro(true);
    }).catch(()=>{if(vivo)setErro(true);});
    return()=>{vivo=false;};
  },[badge.id,badge.name,raridade,recorte,altura,tentativa]);
  useEffect(()=>{
    if(!pronto){setImagem(null);return;}
    const url=URL.createObjectURL(pronto);setImagem({blob:pronto,url});
    return()=>URL.revokeObjectURL(url);
  },[pronto]);
  const urlPronta=imagem?.blob===pronto?imagem.url:null;
  useEffect(()=>{
    const no=palco;if(!no)return;
    const medir=()=>setEscala(Math.max(.05,Math.min((no.clientWidth-32)/1080,(no.clientHeight-20)/altura)));
    medir();const obs=new ResizeObserver(medir);obs.observe(no);return()=>obs.disconnect();
  },[altura,palco]);
  const compartilhar=async()=>{
    if(!pronto||enviando)return;setEnviando(true);
    try{await compartilharFigurinhaPronta(pronto,badge.id,badge.name,recorte);}finally{setEnviando(false);}
  };
  return <Dialog.Root open onOpenChange={v=>{if(!v)onFechar();}}><Dialog.Portal>
    <Dialog.Overlay className="share-fig-overlay"/>
    <Dialog.Content className="share-fig" data-testid="previa-arte">
      <header><Dialog.Title>Um pedaço da sua história</Dialog.Title><Dialog.Close aria-label="Fechar a prévia"><X size={22}/></Dialog.Close></header>
      <Dialog.Description className="sr-only">Prévia de {badge.name}. Escolha story ou figurinha sem fundo para compartilhar.</Dialog.Description>
      <div className="share-fig-formatos" aria-label="Formato"><button type="button" aria-pressed={!recorte} disabled={enviando} onClick={()=>setRecorte(false)}>Story</button><button type="button" aria-pressed={recorte} disabled={enviando} onClick={()=>setRecorte(true)}>Só a figurinha</button></div>
      <div className="share-fig-palco" ref={setPalco} data-recorte={recorte?"":undefined}>
        <div style={{width:1080*escala,height:altura*escala,position:"relative"}}><div style={{transform:`scale(${escala})`,transformOrigin:"top left",width:1080,height:altura}}>{urlPronta ? <img src={urlPronta} alt={`Prévia de ${badge.name}`} width={1080} height={altura} style={{width:1080,height:altura,maxWidth:"none"}}/> : <StoriesAdesivo id={badge.id} titulo={badge.name} raridade={raridade} transparente={recorte}/>}</div></div>
      </div>
      <footer>
        <p role="status">{erro ? "A imagem não ficou pronta. Tente novamente." : pronto ? recorte ? "PNG sem fundo, para usar na sua foto." : "Pronta para compartilhar · 1080 × 1920" : "Preparando sua imagem…"}</p>
        {erro ? <button type="button" className="share-fig-principal" onClick={()=>setTentativa(t=>t+1)}>Tentar novamente</button> : <button type="button" className="share-fig-principal" data-testid="postar-imagem" disabled={!pronto||enviando} onClick={compartilhar}>{enviando||!pronto?<Loader2 size={18} className="animate-spin"/>:<Share2 size={18}/>}Compartilhar {recorte?"figurinha":"story"}</button>}
        {!isNativeShell() && urlPronta && !enviando && <a className="share-fig-salvar" href={urlPronta} download={`core-${badge.id}-${recorte?"recorte":"story"}.png`} onClick={event=>{
          // O rastreador de UTMs pode alterar links locais; blob não aceita esses parâmetros.
          event.currentTarget.href=urlPronta;
          trackEvent("figurinha_salvar_imagem",{id:badge.id,formato:recorte?"recorte":"story"});
        }}><Download size={16}/>Salvar PNG</a>}
      </footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
