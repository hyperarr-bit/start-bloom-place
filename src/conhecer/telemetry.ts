import { captureLandingMeta, trackEventBeacon } from '@/lib/analytics';
import { captureLeadSource } from '@/lib/lead-source';
import { idDoAparelho } from '@/landing/marcador';
import { CHECKOUT_SOURCE } from './attribution';
import { CHECKOUT_PRICE } from './checkout-state';
import { fireMetaEvent } from '@/lib/meta-pixel';

export const SOURCE_URL = CHECKOUT_SOURCE.url;
export const QA = new URLSearchParams(location.search).get('qa') === '1' || !/(^|\.)coreaplicativo\.com\.br$/.test(location.hostname);
const id = () => { try { return crypto.randomUUID(); } catch { return `j${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`; } };
export const journeySession = (() => { try { const old=sessionStorage.getItem('conhecer-session-v1'); if(old)return old; const next=id(); sessionStorage.setItem('conhecer-session-v1',next); return next; } catch { return id(); } })();
export const attribution: Record<string, unknown> = { jornada: 'conhecer_v1', jornada_session_id: journeySession, landing_device_id: idDoAparelho(), path: '/vitalicio', medicao_forcada: QA, checkout_source_omitted: CHECKOUT_SOURCE.omitted };
for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','c_id','as_id','ad_id']) {
  const value=new URLSearchParams(location.search).get(key); if(value)attribution[key]=value.slice(0,200);
}
if(!QA){captureLandingMeta();captureLeadSource();}
export function event(name:string, data:Record<string,unknown>={}) {
  // Never pass typed fields, email, tokens, or demo records to analytics.
  const payload={...data,...attribution,funil:'conhecer',preco_centavos:Math.round(CHECKOUT_PRICE*100)};
  const w=window as unknown as {__conhecerEvents?:unknown[]};
  (w.__conhecerEvents??=[]).push({name,...payload});
  if(!QA)trackEventBeacon(name,payload);
}

export function initPixel(){
  if(QA)return;
  const w=window as any;
  if(!w.fbq){const f:any=function(...args:unknown[]){f.callMethod?f.callMethod(...args):f.queue.push(args)};f.push=f;f.loaded=true;f.version='2.0';f.queue=[];w.fbq=f;w._fbq=f;
    f('init','998037194527241');f('init','1104688251942954');f('track','PageView');
    const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script);
  }
  // The same TikTok pixel as index.html. Purchase remains exclusively in purchase-tracking.
  if(!w.ttq){
    w.TiktokAnalyticsObject='ttq';const q:any=w.ttq=[];
    q.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
    q.setAndDefer=(target:any,method:string)=>{target[method]=(...args:unknown[])=>target.push([method,...args])};
    for(const method of q.methods)q.setAndDefer(q,method);
    const pixel='DA0V2RJC77U9J4MASJ4G',url='https://analytics.tiktok.com/i18n/pixel/events.js';
    q._i={[pixel]:[]};q._i[pixel]._u=url;q._t={[pixel]:Date.now()};q._o={[pixel]:{}};
    const script=document.createElement('script');script.async=true;script.src=`${url}?sdkid=${pixel}&lib=ttq`;document.head.appendChild(script);q.page();
  }
  fireMetaEvent('ViewContent',{content_name:'CORE vitalício',value:CHECKOUT_PRICE,currency:'BRL'},`conhecer_vc_${journeySession}`);
}
