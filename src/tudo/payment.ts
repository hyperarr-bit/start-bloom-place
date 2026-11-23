/**
 * /tudo (23/11) — pixel, eventos e atribuição IGUAIS aos da /pra-sempre (src/pra-sempre/payment.ts), com funil "tudo" e path "/tudo".
 * O pagamento é o checkout Stripe compartilhado (src/landing/stripe-checkout.ts) DENTRO da página (montarEm) e com a estrutura da
 * Cakto (layout "cakto"). Servidor: a mesma oferta "lp27" (stripe-lp27-criar, 2790 fixo); a venda da /tudo se separa da /pra-sempre
 * pela metadata do PI (url = .../tudo) e pelos eventos (funil "tudo", pagina "tudo").
 */
import {captureLandingMeta,trackEventBeacon} from '@/lib/analytics';
import {captureLeadSource} from '@/lib/lead-source';
import {idDoAparelho} from '@/landing/marcador';
import {fireMetaEvent} from '@/lib/meta-pixel';
import {readStripeReturn} from '@/completo/stripe-return';
import {compactCheckoutSource} from '@/conhecer/attribution';

export const PRECO_CENTAVOS=2790;
export const QA=new URLSearchParams(location.search).get('qa')==='1'||!['coreaplicativo.com.br','www.coreaplicativo.com.br'].includes(location.hostname);
export const STORAGE_PREFIX=QA?'tudo-qa':'tudo';
export const bankReturn=readStripeReturn(location.href);
// Remove Stripe return secrets before initializing any page analytics.
if(new URLSearchParams(location.search).has('payment_intent_client_secret')){const clean=new URL(location.href);clean.searchParams.delete('payment_intent_client_secret');history.replaceState(history.state,'',clean.href)}
const source=compactCheckoutSource(location.href);
const params=new URLSearchParams(location.search);
const atrib:Record<string,string>={};
for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','c_id','as_id','ad_id','pl']){const value=params.get(key);if(value)atrib[key]=value.slice(0,200)}
const session=(()=>{try{const key='tudo-session-v1';let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id)}return id}catch{return `c${Date.now()}${Math.random().toString(36).slice(2)}`}})();
const device=idDoAparelho();
export function event(name:string,data:Record<string,unknown>={}){const payload={...data,...atrib,funil:'tudo',pagina:'tudo',jornada:'tudo_v1',path:'/tudo',landing_session_id:session,landing_device_id:device,preco_centavos:PRECO_CENTAVOS};const w=window as any;(w.__tudoEvents??=[]).push({name,...payload});if(!QA)trackEventBeacon(name,payload)}
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
 fireMetaEvent('ViewContent',{content_name:'CORE vitalício 27,90',value:27.9,currency:'BRL'},`tudo-vc-${session}`);
}
/** o checkout DENTRO de `alvo` (inline), com a estrutura da Cakto. Purchase = o do checkout compartilhado (eventID = id do PI, o mesmo da CAPI). */
export async function mountPayment(alvo:HTMLElement,voltaDoBanco?:{pi:string;status:string}){
 const {abrirCheckout}=await import('@/landing/stripe-checkout');
 await abrirCheckout({pk:'pk_live_51TJnAQQdjmrIbUhHDSWqG1trOT6mFfV87AC4Vv47kFJTAFOhYsNmvryGRnf3x824Ke3mXSsWiFCovKPIR6Kqx0IX00VcuAawhC',precoCentavos:PRECO_CENTAVOS,parcelasMax:1,producao:!QA,pedeCpf:false,somentePix:false,layout:'cakto',montarEm:alvo,storagePrefix:STORAGE_PREFIX,pagina:'lp27',trocaCartao:false,medirCarteira:false,posApp:true,pixCopiaPrimeiro:true,voltaDoBanco,evento:event,pixel:(name,data,id)=>{if(!QA && (name==='Purchase'||name==='InitiateCheckout'||name==='ViewContent'||name==='CompleteRegistration'))fireMetaEvent(name,data,id)},atrib,sessao:session,aparelho:device,urlChegada:source.url,fbclid:params.get('fbclid')});
}
