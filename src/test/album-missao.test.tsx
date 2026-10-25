import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Badge } from "@/components/gamification/types";
import { escolherAdesivoDaDose, PRIMEIRO_REGISTRO } from "@/components/missao-doses/adesivo-da-dose";
import { AlbumDaMissao } from "@/components/missao-doses/AlbumDaMissao";
import { aplicarCatalogoCaderno } from "@/components/gamification/catalogo-caderno";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { buildBadgesSequencia, mesclarDesbloqueios } from "@/lib/conquistas-registro";
// o catálogo ativo vem do próprio código (no rascunho do Codex era um JSON de design, fora do app)
const lerVazio = <T,>(_k: string, f: T): T => f;
const catalogo = mesclarDesbloqueios(aplicarCatalogoCaderno([...buildBadgesSequencia(0), ...buildBadgesFinancas(lerVazio), ...buildBadgesVida(lerVazio, "2026-10-19")], lerVazio, {}, "2026-10-19"), {}, "2026-10-19").adesivos;
const flag=vi.hoisted(()=>({ligada:true}));
vi.mock("@/lib/conquistas2",()=>({conquistas2Ligada:()=>flag.ligada}));
vi.mock("@/lib/analytics",()=>({trackEvent:vi.fn()}));
const b:Badge={id:"treino-plano",name:"Plano de ataque",description:"Monte seu plano",category:"treino",color:"",icon:"",xp:50,unlocked:true};
afterEach(()=>{cleanup();flag.ligada=true;});
const Local=()=>{const l=useLocation();return <output data-testid="destino">{JSON.stringify({pathname:l.pathname,state:l.state})}</output>;};

describe("álbum nas missões do trial",()=>{
  it("o mapa só usa figurinhas reais; montar plano mostra a conquista que abriu, sem inventar treino",()=>{
    const ids=new Set(catalogo.map(b=>b.id));
    for(const lista of Object.values(PRIMEIRO_REGISTRO)) for(const id of lista) expect(ids.has(id),id).toBe(true);
    const escolha=escolherAdesivoDaDose({n:1,modulo:"treino",adesivos:[b],vistos:[],sequencia:1});
    expect(escolha.principal).toMatchObject({tipo:"registro",id:"treino-plano"});
    expect(escolha.vistos).toEqual(["treino-plano"]);expect(escolha.telaCheia).toBe(false);
    expect(escolherAdesivoDaDose({n:1,modulo:"treino",adesivos:[{...b,unlocked:false}],vistos:[],sequencia:1}).principal).toMatchObject({tipo:"marca"});
  });
  it("cumprir três doses sem três dias não inventa uma sequência",()=>{
    const escolha=escolherAdesivoDaDose({n:3,modulo:"treino",adesivos:[b],vistos:[],sequencia:1});
    expect(escolha.principal).toEqual({tipo:"recomeca"});expect(escolha.marcos).toEqual([]);
  });
  it("finaliza a etapa antes de ir à colagem, sem conceder figurinha de novo",()=>{
    const sair=vi.fn();
    render(<MemoryRouter initialEntries={["/treino"]}><AlbumDaMissao badge={b} primeira onSair={sair}/><Local/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Colar minha primeira figurinha"}));
    expect(sair).toHaveBeenCalledOnce();
    expect(JSON.parse(screen.getByTestId("destino").textContent!)).toEqual({pathname:"/conquistas",state:{origem:"missao",album:"treino-plano",colar:true}});
  });
  it("não cria convite falso sem conquista e respeita o rollout",()=>{
    const {rerender}=render(<MemoryRouter><AlbumDaMissao badge={{...b,unlocked:false}} onSair={()=>{}}/></MemoryRouter>);
    expect(screen.queryByTestId("missao-convite-album")).toBeNull();
    flag.ligada=false;rerender(<MemoryRouter><AlbumDaMissao badge={b} onSair={()=>{}}/></MemoryRouter>);
    expect(screen.queryByTestId("missao-convite-album")).toBeNull();
  });
});
