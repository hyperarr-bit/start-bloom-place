import {event,initPixel,openPayment,bankReturn,QA} from './payment';
import '../completo/checkout.css';
import './demo.js';
import './style.css';

if(QA){const strip=document.createElement('div');strip.className='lp27-qa';strip.textContent='PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA';document.body.prepend(strip)}
initPixel();event('landing_view');
const error=document.createElement('p');error.className='lp27-payment-error';error.setAttribute('role','alert');error.hidden=true;document.querySelector('.hero-actions')!.append(error);
let opening=false;
async function checkout(button?:HTMLElement,returning=false){
 if(opening)return;opening=true;error.hidden=true;button?.setAttribute('aria-busy','true');
 try{await openPayment(returning?bankReturn:undefined)}catch{error.hidden=false;error.textContent='Não conseguimos abrir o pagamento agora. Tente novamente.';error.scrollIntoView({block:'center'});event('landing_erro',{onde:'lp27_checkout_load'})}finally{opening=false;button?.removeAttribute('aria-busy')}
}
for(const button of document.querySelectorAll<HTMLElement>('[data-checkout]'))button.addEventListener('click',e=>{e.preventDefault();event('landing_checkout_click',{placement:button.closest('.hero-actions')?'hero':button.closest('.sticky-buy')?'sticky':'offer'});void checkout(button)});
document.addEventListener('lp27:demo',(e:Event)=>{const {action,module}=(e as CustomEvent).detail;event(action==='ready'?'landing_demo_ready':'landing_demo_module',{module})});
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){event('landing_section_view',{section:entry.target.id||'hero'});observer.unobserve(entry.target)}},{threshold:.25});
for(const section of document.querySelectorAll('.hero,#demo,#oferta'))observer.observe(section);
if(bankReturn)void checkout(undefined,true);
