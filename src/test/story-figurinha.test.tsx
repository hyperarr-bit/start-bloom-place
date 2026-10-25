import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Badge } from "@/components/gamification/types";
import { TEXTOS_FIGURINHAS, textoConquistado, textoDoStory } from "@/components/conquistas/textos-figurinhas";
import { aplicarCatalogoCaderno } from "@/components/gamification/catalogo-caderno";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { buildBadgesSequencia, mesclarDesbloqueios } from "@/lib/conquistas-registro";
// o catálogo ativo vem do próprio código (no rascunho do Codex era um JSON de design, fora do app)
const lerVazio = <T,>(_k: string, f: T): T => f;
const catalogo = mesclarDesbloqueios(aplicarCatalogoCaderno([...buildBadgesSequencia(0), ...buildBadgesFinancas(lerVazio), ...buildBadgesVida(lerVazio, "2026-10-19")], lerVazio, {}, "2026-10-19"), {}, "2026-10-19").adesivos;
import { StoriesAdesivo } from "@/components/conquistas/StoryFigurinha";
import { CompartilharFigurinha } from "@/components/conquistas/CompartilharFigurinha";
import { CelebracaoFigurinha } from "@/components/conquistas/nova/CelebracaoFigurinha";

const mocks=vi.hoisted(()=>({gerar:vi.fn(),compartilhar:vi.fn()}));
vi.mock("@/components/conquistas/gerar-imagem",()=>({gerarPng:mocks.gerar}));
vi.mock("@/components/conquistas/compartilhar-conquistas",()=>({compartilharFigurinhaPronta:mocks.compartilhar}));
vi.mock("@/lib/analytics",()=>({trackEvent:vi.fn()}));
vi.mock("@/lib/native-shell",()=>({isNativeShell:()=>false}));
const badge:Badge={id:"first-income",name:"Primeiro Salário",description:"Registre sua primeira receita",category:"finance",icon:"",color:"",xp:50,unlocked:true};
beforeEach(()=>{URL.createObjectURL=vi.fn(()=>"blob:qa");URL.revokeObjectURL=vi.fn();mocks.gerar.mockReset();mocks.compartilhar.mockReset();vi.stubGlobal("ResizeObserver",class{observe(){} disconnect(){}});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe("texto e imagem para compartilhar",()=>{
  it("as 99 artes têm frases específicas; compartilhar não copia o requisito nem expõe perfil/XP",()=>{
    expect(Object.keys(TEXTOS_FIGURINHAS)).toHaveLength(99);
    for(const {id} of catalogo) expect(TEXTOS_FIGURINHAS[id],id).toBeDefined();
    expect(textoConquistado(badge)).not.toBe(badge.description);
    const {container}=render(<StoriesAdesivo id={badge.id} titulo={badge.name} descricao={badge.description} nome="Nome privado" membroDesde="2020"/>);
    expect(container).toHaveTextContent(textoDoStory(badge.id));
    expect(container).not.toHaveTextContent("Registre");expect(container).not.toHaveTextContent("Nome privado");expect(container).not.toHaveTextContent("XP");
    expect(container.firstElementChild).toHaveStyle({width:"1080px",height:"1920px"});
  });
  it("o recorte tem canvas quadrado transparente e só a arte",()=>{
    const {container}=render(<StoriesAdesivo id={badge.id} titulo={badge.name} transparente/>);
    expect(container.firstElementChild).toHaveStyle({width:"1080px",height:"1080px",background:"transparent"});
    expect(container.textContent).toBe("");expect(container.querySelector("svg image")).toBeTruthy();
  });
  it("uma renderização antiga não libera o compartilhar do novo formato",async()=>{
    let resolverStory!:(v:Blob)=>void,resolverRecorte!:(v:Blob)=>void;
    mocks.gerar.mockImplementationOnce(()=>new Promise<Blob>(r=>{resolverStory=r;})).mockImplementationOnce(()=>new Promise<Blob>(r=>{resolverRecorte=r;}));
    render(<CompartilharFigurinha badge={badge} onFechar={()=>{}}/>);
    expect(screen.getByTestId("postar-imagem")).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Só a figurinha"}));
    await act(async()=>{resolverStory(new Blob(["story"]));});
    expect(screen.getByTestId("postar-imagem")).toBeDisabled();
    const png=new Blob(["recorte"],{type:"image/png"});
    await act(async()=>{resolverRecorte(png);});
    await waitFor(()=>expect(screen.getByTestId("postar-imagem")).toBeEnabled());
    fireEvent.click(screen.getByTestId("postar-imagem"));
    expect(mocks.compartilhar).toHaveBeenCalledWith(png,"first-income","Primeiro Salário",true);
    expect(mocks.gerar.mock.calls[1][1]).toEqual({largura:1080,altura:1080});
  });
  it("Escape da prévia não fecha a comemoração que ainda está saindo por baixo",async()=>{
    mocks.gerar.mockResolvedValue(new Blob(["png"]));
    const fecharFesta=vi.fn(),fecharPrevia=vi.fn();
    render(<><CelebracaoFigurinha badge={badge} primeira onFechar={fecharFesta}/><CompartilharFigurinha badge={badge} onFechar={fecharPrevia}/></>);
    await screen.findByRole("link",{name:"Salvar PNG"});
    fireEvent.keyDown(screen.getByRole("button",{name:"Fechar a prévia"}),{key:"Escape"});
    expect(fecharPrevia).toHaveBeenCalledOnce();expect(fecharFesta).not.toHaveBeenCalled();
  });
  it("restaura o URL do PNG se um rastreador acrescentar parâmetros ao link",async()=>{
    mocks.gerar.mockResolvedValue(new Blob(["png"]));
    render(<CompartilharFigurinha badge={badge} onFechar={()=>{}}/>);
    const link=await screen.findByRole("link",{name:"Salvar PNG"});
    link.setAttribute("href","blob:qa?utm_source=organic");
    link.addEventListener("click",e=>e.preventDefault());
    fireEvent.click(link);
    expect(link).toHaveAttribute("href","blob:qa");
  });
  it("falha de renderização permite tentar de novo",async()=>{
    mocks.gerar.mockResolvedValueOnce(null).mockResolvedValueOnce(new Blob(["png"]));
    render(<CompartilharFigurinha badge={badge} onFechar={()=>{}}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Tentar novamente"}));
    await waitFor(()=>expect(screen.getByTestId("postar-imagem")).toBeEnabled());
  });
});
