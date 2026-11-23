/**
 * /dia (23/11) — pixel, eventos e atribuição IGUAIS aos da /pra-sempre (src/pra-sempre/payment.ts) e da /tudo, com funil "dia" e
 * path "/dia". O pagamento é o checkout Stripe compartilhado (src/landing/stripe-checkout.ts) no caminho PADRÃO (camada por cima,
 * layout "novo"), com o pós-compra direto pro app (posApp). Servidor: OFERTA_DIA "27" usa a linha "lp27" (a mesma da /pra-sempre
 * e da /tudo); a venda da /dia se separa pela url de chegada gravada no PI (…/dia) e pelos eventos (funil "dia").
 * Nenhum evento leva e-mail.
 */
import {captureLandingMeta,trackEventBeacon} from '@/lib/analytics';
import {captureLeadSource} from '@/lib/lead-source';
import {idDoAparelho} from '@/landing/marcador';
import {fireMetaEvent} from '@/lib/meta-pixel';
import {readStripeReturn} from '@/completo/stripe-return';
import {compactCheckoutSource} from '@/conhecer/attribution';
import {ofertaDe,topoDe,opcoesDaOferta} from './oferta';

export const QA=new URLSearchParams(location.search).get('qa')==='1'||!['coreaplicativo.com.br','www.coreaplicativo.com.br'].includes(location.hostname);
// as chaves OFERTA_DIA e TOPO_DIA chegam do <head> do dia.html (html[data-oferta], html[data-topo])
export const OFERTA=ofertaDe(document.documentElement.getAttribute('data-oferta'));
export const TOPO=topoDe(document.documentElement.getAttribute('data-topo'));
export const bankReturn=readStripeReturn(location.href);
// Remove Stripe return secrets before initializing any page analytics.
if(new URLSearchParams(location.search).has('payment_intent_client_secret')){const clean=new URL(location.href);clean.searchParams.delete('payment_intent_client_secret');history.replaceState(history.state,'',clean.href)}
const source=compactCheckoutSource(location.href);
const params=new URLSearchParams(location.search);
const atrib:Record<string,string>={};
for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','c_id','as_id','ad_id','pl']){const value=params.get(key);if(value)atrib[key]=value.slice(0,200)}
const session=(()=>{try{const key='dia-session-v1';let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id)}return id}catch{return `c${Date.now()}${Math.random().toString(36).slice(2)}`}})();
const device=idDoAparelho();
export function event(name:string,data:Record<string,unknown>={}){const payload={...data,...atrib,funil:'dia',pagina:'dia',jornada:'dia_v1',path:'/dia',oferta:OFERTA.chave,topo:TOPO,landing_session_id:session,landing_device_id:device,preco_centavos:OFERTA.precoCentavos};const w=window as any;(w.__diaEvents??=[]).push({name,...payload});if(!QA)trackEventBeacon(name,payload)}
export function initPixel(){
 if(QA)return;
 captureLandingMeta();captureLeadSource();
 const w=window as any;
 if(!w.fbq){const f:any=function(...args:unknown[]){f.callMethod?f.callMethod(...args):f.queue.push(args)};f.push=f;f.loaded=true;f.version='2.0';f.queue=[];w.fbq=f;w._fbq=f;f('init','998037194527241');f('init','1104688251942954');f('track','PageView');const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script)}
  if(!w.ttq){
    w.TiktokAnalyticsObject='ttq';const q:any=w.ttq=[];
    q.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
    q.setAndDefer=(target:any,method:string)=>{target[method]=(...args:unknown[])=>target.push([method,...args])};
    for(const method of q.methods)q.setAndDefer(q,method);
    const pixel='DA0V2RJC77U9J4MASJ4G',url='https://analytics.tiktok.com/i18n/pixel/events.js';
    q._i={[pixel]:[]};q._i[pixel]._u=url;q._t={[pixel]:Date.now()};q._o={[pixel]:{}};
    const script=document.createElement('script');script.async=true;script.src=`${url}?sdkid=${pixel}&lib=ttq`;document.head.appendChild(script);q.page();
  }
 fireMetaEvent('ViewContent',{content_name:'CORE vitalício (dia)',value:OFERTA.valor,currency:'BRL'},`dia-vc-${session}`);
}
/** o checkout de sempre, por cima da página. Purchase = o do checkout compartilhado (eventID = id do PI, o mesmo da CAPI). */
export async function openPayment(voltaDoBanco?:{pi:string;status:string}){
 const {abrirCheckout}=await import('@/landing/stripe-checkout');
 await abrirCheckout({pk:'pk_live_51TJnAQQdjmrIbUhHDSWqG1trOT6mFfV87AC4Vv47kFJTAFOhYsNmvryGRnf3x824Ke3mXSsWiFCovKPIR6Kqx0IX00VcuAawhC',...opcoesDaOferta(OFERTA,QA),voltaDoBanco,evento:event,pixel:(name,data,id)=>{if(!QA && (name==='Purchase'||name==='InitiateCheckout'||name==='ViewContent'||name==='CompleteRegistration'))fireMetaEvent(name,data,id)},atrib,sessao:session,aparelho:device,urlChegada:source.url,fbclid:params.get('fbclid')});
}
