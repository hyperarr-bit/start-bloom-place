import { Suspense,lazy,useCallback,useEffect,useRef,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PreviewUserDataProvider } from '@/hooks/use-preview-user-data';
import { DemoDoFunilProvider } from '@/lib/demo-do-funil';
import { VoltaDaDemoProvider } from '@/lib/volta-da-demo';
import { NavegacaoDaDemo } from '@/pages/experimente/navegacao';
import { TabTrackContext } from '@/hooks/use-module-tracker';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

const Finance=lazy(()=>import('@/pages/Index'));
const Routine=lazy(()=>import('@/pages/Rotina'));
type Module='financas'|'rotina';
const inside=()=>{try{return window.parent!==window&&window.parent.location.origin===location.origin&&window.parent.location.pathname.replace(/\/$/,'')==='/vitalicio'}catch{return false}};
const send=(type:string, data:Record<string,unknown>={})=>{if(inside())window.parent.postMessage({type,...data},location.origin)};
function Ready({module}:{module:Module}){useEffect(()=>{send('conhecer:ready',{module})},[module]);return null;}

/** Original app components + preview provider. No user records, auth flow or payments inside the frame. */
export default function Demo(){
  const [params,setParams]=useSearchParams();
  const [module,setModule]=useState<Module>(params.get('m')==='rotina'?'rotina':'financas');
  const [revision,setRevision]=useState(0);
  const [note,setNote]=useState('');
  const cache=useRef<Record<string,Record<string,unknown>>>({});
  const tabs=useRef<Record<string,string>>({});
  const current=useRef(module);current.current=module;
  const allowed=inside();
  useEffect(()=>{if(!allowed)window.location.replace('/vitalicio'+window.location.search)},[allowed]);
  const switchModule=useCallback((m:Module,tab?:string)=>{
    const chosen=tab??tabs.current[m]??(m==='financas'?'dashboard':'semana');
    setParams(p=>{p.set('m',m);p.set('aba',chosen);return p},{replace:true});
    setModule(m);setRevision(n=>n+1);setNote('');window.scrollTo(0,0);
    send('conhecer:module',{module:m,tab:chosen});
  },[setParams]);
  useEffect(()=>{const listen=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==window.parent)return;const d=e.data;if(d?.type==='conhecer:module'&&['financas','rotina'].includes(d.module))switchModule(d.module,typeof d.tab==='string'?d.tab:undefined)};window.addEventListener('message',listen);return()=>window.removeEventListener('message',listen)},[switchModule]);
  const report=useCallback((tab:string)=>{tabs.current[current.current]=tab;send('conhecer:tab',{module:current.current,tab})},[]);
  const save=useCallback((key:string,value:unknown,_old:unknown,gesture:boolean)=>{
    (cache.current[current.current]??={})[key]=value;
    if(gesture)send('conhecer:edit',{module:current.current});
  },[]);
  if(!allowed)return <a href="/vitalicio">Abrir a demonstração do CORE</a>;
  const Mod=module==='financas'?Finance:Routine;
  const value=()=>send('conhecer:value');
  return <div data-testid="conhecer-demo" className="min-h-[100dvh] bg-background overflow-x-clip">
    {note&&<p role="status" className="m-4 rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">{note}</p>}
    <VoltaDaDemoProvider value={{destino:'/vitalicio',aoTocar:value,modulo:module}}>
      <DemoDoFunilProvider value={{abrirConta:value}}>
        <PreviewUserDataProvider key={module+revision} moduleKey={module} semente={s=>({...s,...cache.current[module]})} aoGravar={save}>
          <TabTrackContext.Provider value={report}>
            <NavegacaoDaDemo desviar={to=>{if(to.startsWith('/financas')||to.startsWith('/rotina')){const u=new URL(to,location.origin);switchModule(to.startsWith('/rotina')?'rotina':'financas',u.searchParams.get('aba')??undefined)}else setNote('Este recurso depende de conta e não está disponível nesta demonstração. Você pode continuar explorando.');return true}}>
              <RouteErrorBoundary routeName="conhecer-modulo"><Suspense fallback={<p role="status" className="p-8 text-center">Carregando o app…</p>}><Ready module={module}/><Mod/></Suspense></RouteErrorBoundary>
            </NavegacaoDaDemo>
          </TabTrackContext.Provider>
        </PreviewUserDataProvider>
      </DemoDoFunilProvider>
    </VoltaDaDemoProvider>
  </div>;
}
