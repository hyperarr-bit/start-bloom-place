import type { Raridade } from "../gamification/types";
import { Adesivo } from "./adesivos-arte";
import { ARTES_CADERNO } from "./artes-caderno";
import { textoDoStory } from "./textos-figurinhas";

export const RECORTE_FIGURINHA = { w:1080, h:1080 };
const tom = (id:string) => {
  if (/^(treino|meta-semanal)/.test(id)) return { fundo:"#e4edef", tinta:"#376c77" };
  if (/^(leitura|meta-ano)/.test(id)) return { fundo:"#eee8f3", tinta:"#7c5b91" };
  if (/^(sono|humor|diario|saude)/.test(id)) return { fundo:"#e5ece7", tinta:"#557463" };
  if (/^(rotina|tarefa|habito|compromisso|urgencia|contador)/.test(id)) return { fundo:"#f4e7df", tinta:"#b35949" };
  if (/^(sequencia|ano-|protetor)/.test(id)) return { fundo:"#e5eaf2", tinta:"#3b537a" };
  return { fundo:"#f1e9d9", tinta:"#92713b" };
};
const raridades:Record<Raridade,string>={comum:"",raro:"Rara",epico:"Épica",lendario:"Lendária"};

export const StoriesAdesivo = ({id,titulo,raridade="comum",transparente=false}: {
  id:string; titulo:string; descricao?:string; raridade?:Raridade; nome?:string; membroDesde?:string; transparente?:boolean;
}) => {
  if(transparente) return <div data-stories="recorte-figurinha" style={{width:1080,height:1080,position:"relative",background:"transparent"}}><div data-foto-arte={ARTES_CADERNO[id]} style={{position:"absolute",left:80,top:80,width:920,height:920}}><Adesivo id={id} tamanho={920}/></div></div>;
  const cor=tom(id);
  return <div data-stories="adesivo" data-raridade={raridade} style={{position:"relative",width:1080,height:1920,overflow:"hidden",background:cor.fundo,color:"#23334b",fontFamily:"Inter,Arial,sans-serif"}}>
    <div style={{position:"absolute",left:62,right:62,top:198,bottom:198,borderRadius:40,background:"#fcf8ee",border:"2px solid #d9d0be"}}/>
    <div style={{position:"absolute",left:114,right:114,top:274,fontSize:24,fontWeight:650,letterSpacing:".16em",color:cor.tinta}}>DA MINHA COLEÇÃO</div>
    <div style={{position:"absolute",left:114,right:114,top:344,fontFamily:"'Instrument Serif',Georgia,serif",fontSize:90,lineHeight:1.08,letterSpacing:"-.025em"}}>{textoDoStory(id)}</div>
    <div data-foto-arte={ARTES_CADERNO[id]} data-foto-giro="-5" style={{position:"absolute",left:190,top:686,width:700,height:700,transform:"rotate(-5deg)"}}><Adesivo id={id} tamanho={700}/></div>
    <div style={{position:"absolute",left:114,right:114,top:1430,textAlign:"center"}}>
      <div style={{fontSize:46,lineHeight:1.15,fontWeight:750,letterSpacing:"-.025em"}}>{titulo}</div>
      <div style={{marginTop:18,color:cor.tinta,fontSize:22,letterSpacing:".03em"}}>{raridades[raridade] ? `Figurinha ${raridades[raridade].toLowerCase()} · ` : ""}Um pedaço da minha história.</div>
    </div>
    <div style={{position:"absolute",left:114,right:114,top:1644,display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #dcd4c6",paddingTop:24,color:cor.tinta}}><b style={{fontSize:30,letterSpacing:".14em"}}>CORE</b><span style={{fontSize:22}}>Figurinhas da minha vida.</span></div>
  </div>;
};
