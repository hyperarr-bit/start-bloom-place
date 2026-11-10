import { useState } from 'react';

/** Post-purchase links keep the Android "already bought on web" signal. Apple reports this campaign in aggregate. */
export function StoreLinks({onClick}:{onClick:(data:Record<string,unknown>)=>void}){
  const [id]=useState(()=>{try{return crypto.randomUUID()}catch{return `core-${Date.now()}-${Math.random().toString(36).slice(2)}`}});
  const ref=new URLSearchParams({utm_source:'web',utm_medium:'pos_compra',utm_campaign:'web_conhecer_pos_compra',core_link_id:id,core_path:'/vitalicio',core_etapa:'pos_compra',core_funil:'conhecer_v1'});
  const apple='https://apps.apple.com/br/app/id6806913181?pt=129384060&ct=core_vitalicio_pos&mt=8';
  const play=`https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=${encodeURIComponent(ref.toString())}`;
  return <div className="j-store-links">
    <a href={apple} onClick={()=>onClick({loja:'ios',link_click_id:id,etapa:'pos_compra',campanha_apple:'core_vitalicio_pos'})}><img src="/selos/app-store.svg" alt="Baixar na App Store" width="120" height="40"/></a>
    <a href={play} onClick={()=>onClick({loja:'android',link_click_id:id,etapa:'pos_compra'})}><img src="/selos/google-play.png" alt="Disponível no Google Play" width="138" height="53"/></a>
  </div>;
}
