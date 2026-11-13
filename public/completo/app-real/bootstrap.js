/* Isolated browser services: memory storage, no network, no account state. */
(()=>{
 const make=()=>{const data=new Map();return {get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear()}};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{configurable:false,value:make()});
 localStorage.setItem('forcar-home-nova','on');
 localStorage.setItem('core-theme-mode','light');
 window.fetch=async()=>{throw new Error('Conexões desativadas nesta prévia local.')};
 navigator.sendBeacon=()=>false;
 window.open=()=>null;
 document.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(a&&/^(https?:|mailto:|tel:)/i.test(a.getAttribute('href'))){event.preventDefault();parent.postMessage({type:'core-real-offer'},'*')}},true);
 document.documentElement.classList.remove('dark');
})();

/* iOS lab bridge: do not navigate the iframe to a second app, checkout, or website. */
document.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(!a)return;const href=a.getAttribute('href');if(!href||href.startsWith('#'))return;event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'core-real-offer'},location.origin)},true);
