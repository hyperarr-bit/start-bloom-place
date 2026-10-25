import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Share2 } from "lucide-react";
import type { Badge } from "@/components/gamification/types";
import { CompartilharFigurinha } from "@/components/conquistas/CompartilharFigurinha";
import { conquistas2Ligada } from "@/lib/conquistas2";
import { trackEvent } from "@/lib/analytics";

/** Sai pela conclusão da missão existente; não concede nem comemora uma segunda vez. */
export function AlbumDaMissao({ badge, onSair, primeira=false, compartilhar=false }: { badge?: Badge; onSair:()=>void; primeira?:boolean; compartilhar?:boolean }) {
  const navigate=useNavigate();
  const [previa,setPrevia]=useState(false);
  if (!badge?.unlocked || !conquistas2Ligada()) return null;
  return <div className="mt-3" data-testid="missao-convite-album">
    <button type="button" className="w-full min-h-11 rounded-xl border border-border flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-bold" onClick={()=>{
      trackEvent("missao_abrir_album",{id:badge.id,primeira});
      onSair();
      navigate("/conquistas",{state:{origem:"missao",album:badge.id,colar:true}});
    }}><BookOpen size={17}/>{primeira?"Colar minha primeira figurinha":"Ver meu álbum"}</button>
    {compartilhar && <button type="button" className="w-full min-h-11 flex items-center justify-center gap-2 text-[12px] font-semibold" onClick={()=>setPrevia(true)}><Share2 size={15}/>Compartilhar uma conquista</button>}
    {previa && <CompartilharFigurinha badge={badge} onFechar={()=>setPrevia(false)}/>}
  </div>;
}
