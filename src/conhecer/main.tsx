import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/hooks/use-theme';
import { Toaster } from 'sonner';
import '@/index.css';
import { legacyStripeReturn } from './legacy-return';

class Boundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="p-8 max-w-lg mx-auto"><h1 className="text-2xl font-bold">Vamos tentar novamente.</h1><p className="my-4">Não foi possível carregar esta tela. Se você já pagou, seu acesso continua vinculado ao e-mail da compra.</p><button className="underline mr-6" onClick={()=>location.reload()}>Recarregar</button><a className="underline" href="/entrar">Entrar no CORE</a></div>:this.props.children}
}
const previousPayment=legacyStripeReturn(location.href);
if(previousPayment){
  // Finish a payment started on the former Stripe page before loading this journey or its telemetry.
  location.replace(previousPayment);
}else{
  const root=createRoot(document.getElementById('root')!);
  import('./Journey').then(({default:Journey})=>root.render(<ThemeProvider><Boundary><Journey/></Boundary><Toaster/></ThemeProvider>)).catch(()=>root.render(<div className="p-8 max-w-lg mx-auto"><h1 className="text-2xl font-bold">Não conseguimos abrir esta página.</h1><p className="my-4">Tente recarregar. Se já comprou, você pode entrar na sua conta.</p><button className="underline mr-6" onClick={()=>location.reload()}>Recarregar</button><a className="underline" href="/entrar">Entrar no CORE</a></div>));
}
