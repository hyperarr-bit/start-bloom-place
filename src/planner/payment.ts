/**
 * /planner (26/11) — cópia do pagamento da /tudo (src/tudo/payment.ts) pra página que o dono pediu pro TikTok: o MESMO checkout
 * (Stripe compartilhado, layout "cakto", dentro da página) e a MESMA linha do servidor ("tudo", stripe-lp27-criar, 1990 fixo).
 * O que muda: os eventos saem com path "/planner" e jornada "planner_v1" (a venda se separa da /tudo pelo path e pela url do PI),
 * e o TikTok recebe os mesmos três eventos que a /oferta manda (ViewContent, InitiateCheckout e a compra como "CompletePayment",
 * com o mesmo event_id da Meta) nos dois pixels que o site já usa. A /tudo não muda.
 */
import {captureLandingMeta,trackEventBeacon} from '@/lib/analytics';
import {captureLeadSource} from '@/lib/lead-source';
import {idDoAparelho} from '@/landing/marcador';
import {fireMetaEvent} from '@/lib/meta-pixel';
import {readStripeReturn} from '@/completo/stripe-return';
import {compactCheckoutSource} from '@/conhecer/attribution';

export const PRECO_CENTAVOS=1990;
export const QA=new URLSearchParams(location.search).get('qa')==='1'||!['coreaplicativo.com.br','www.coreaplicativo.com.br'].includes(location.hostname);
export const STORAGE_PREFIX=QA?'tudo19-qa':'tudo19'; // a mesma linha "tudo" de 19,90: o pedido guardado na aba serve nas duas páginas
export const bankReturn=readStripeReturn(location.href);
// Remove Stripe return secrets before initializing any page analytics.
if(new URLSearchParams(location.search).has('payment_intent_client_secret')){const clean=new URL(location.href);clean.searchParams.delete('payment_intent_client_secret');history.replaceState(history.state,'',clean.href)}
const source=compactCheckoutSource(location.href);
const params=new URLSearchParams(location.search);
const atrib:Record<string,string>={};
for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','c_id','as_id','ad_id','pl']){const value=params.get(key);if(value)atrib[key]=value.slice(0,200)}
const session=(()=>{try{const key='planner-session-v1';let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id)}return id}catch{return `c${Date.now()}${Math.random().toString(36).slice(2)}`}})();
const device=idDoAparelho();
export function event(name:string,data:Record<string,unknown>={}){const payload={...data,...atrib,funil:'tudo',pagina:'tudo',jornada:'planner_v1',path:'/planner',landing_session_id:session,landing_device_id:device,preco_centavos:PRECO_CENTAVOS};const w=window as any;(w.__plannerEvents??=[]).push({name,...payload});if(!QA)trackEventBeacon(name,payload)}

/** Os dois pixels do TikTok que o site já carrega: o da /tudo e o da /oferta (o da campanha de conversão de 23/11). */
export const TIKTOK_PIXELS=['DA0V2RJC77U9J4MASJ4G','DC2B4FBC77UDGJAO06IG'];
const TT_EVENTO:Record<string,string>={ViewContent:'ViewContent',InitiateCheckout:'InitiateCheckout',Purchase:'CompletePayment'};
function tiktok(name:string,data:Record<string,unknown>={},id?:string){
 try{
  const w=window as any;if(QA||!w.ttq||!TT_EVENTO[name])return;
  const p={value:data.value??PRECO_CENTAVOS/100,currency:data.currency??'BRL',content_type:'product',content_id:'core_vitalicio',content_name:data.content_name??'CORE vitalício 19,90'};
  if(id)w.ttq.track(TT_EVENTO[name],p,{event_id:id});else w.ttq.track(TT_EVENTO[name],p);
 }catch{/* nunca derruba a página */}
}
export function initPixel(){
 if(QA)return;
 captureLandingMeta();captureLeadSource();
 const w=window as any;
 if(!w.fbq){const f:any=function(...args:unknown[]){f.callMethod?f.callMethod(...args):f.queue.push(args)};f.push=f;f.loaded=true;f.version='2.0';f.queue=[];w.fbq=f;w._fbq=f;f('init','998037194527241');f('init','1104688251942954');f('track','PageView');const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script)}
 if(!w.ttq){
  // o snippet oficial do TikTok com `load` (um por pixel); a fila guarda os eventos até o events.js chegar
  w.TiktokAnalyticsObject='ttq';const q:any=w.ttq=[];
  q.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
  q.setAndDefer=(target:any,method:string)=>{target[method]=(...args:unknown[])=>target.push([method,...args])};
  for(const method of q.methods)q.setAndDefer(q,method);
  const url='https://analytics.tiktok.com/i18n/pixel/events.js';
  q.load=(pixel:string)=>{q._i=q._i||{};q._i[pixel]=[];q._i[pixel]._u=url;q._t=q._t||{};q._t[pixel]=Date.now();q._o=q._o||{};q._o[pixel]={};const script=document.createElement('script');script.async=true;script.src=`${url}?sdkid=${pixel}&lib=ttq`;document.head.appendChild(script)};
  for(const pixel of TIKTOK_PIXELS)q.load(pixel);
  q.page();
 }
 const vc={content_name:'CORE vitalício 19,90',value:19.9,currency:'BRL'};
 fireMetaEvent('ViewContent',vc,`planner-vc-${session}`);tiktok('ViewContent',vc,`planner-vc-${session}`);
}
/** o checkout DENTRO de `alvo` (inline), com a estrutura da Cakto. Purchase = o do checkout compartilhado (eventID = id do PI, o mesmo da CAPI). */
export async function mountPayment(alvo:HTMLElement,voltaDoBanco?:{pi:string;status:string}){
 const {abrirCheckout}=await import('@/landing/stripe-checkout');
 await abrirCheckout({pk:'pk_live_51TJnAQQdjmrIbUhHDSWqG1trOT6mFfV87AC4Vv47kFJTAFOhYsNmvryGRnf3x824Ke3mXSsWiFCovKPIR6Kqx0IX00VcuAawhC',precoCentavos:PRECO_CENTAVOS,parcelasMax:1,producao:!QA,pedeCpf:false,somentePix:false,layout:'cakto',montarEm:alvo,storagePrefix:STORAGE_PREFIX,pagina:'tudo',trocaCartao:false,medirCarteira:false,posApp:true,pixCopiaPrimeiro:"sempre",voltaDoBanco,evento:event,pixel:(name,data,id)=>{if(!QA && (name==='Purchase'||name==='InitiateCheckout'||name==='ViewContent'||name==='CompleteRegistration')){fireMetaEvent(name,data,id);tiktok(name,data as Record<string,unknown>,id)}},atrib,sessao:session,aparelho:device,urlChegada:source.url,fbclid:params.get('fbclid')});
}
