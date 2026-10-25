import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Badge } from "@/components/gamification/types";
import { figurinhasDaCapa, lerCapaPessoal, proximasFigurinhas } from "@/components/conquistas/capa-pessoal";
import { PersonalizarCapa } from "@/components/conquistas/PersonalizarCapa";

const badge = (id:string, extra:Partial<Badge>={}):Badge => ({id,name:id,description:"Uma ação",category:"finance",color:"",icon:"",xp:50,unlocked:true,...extra});
const todas=[badge("first-income"),badge("first-expense"),badge("rotina-1",{category:"rotina"}),badge("treino-1",{category:"treino"}),badge("wishlist",{unlocked:false})];
afterEach(cleanup);

describe("capa pessoal",()=>{
  it("recupera dados inválidos e rejeita cores herdadas do protótipo",()=>{
    expect(lerCapaPessoal(null)).toEqual({cor:"azul",figurinhas:null});
    expect(lerCapaPessoal({cor:"constructor",figurinhas:[1,"a","a",null,"b","c","d"]})).toEqual({cor:"azul",figurinhas:["a","b","c"]});
  });
  it("automática usa apenas coladas, recentes e ativas; manual não muda ao conquistar outra",()=>{
    const datas={"first-income":"2026-10-01","first-expense":"2026-10-02","rotina-1":"2026-10-03","treino-1":"2026-10-04"};
    const auto={cor:"azul",figurinhas:null} as const;
    expect(figurinhasDaCapa(auto,todas,datas,["treino-1"]).map(b=>b.id)).toEqual(["rotina-1","first-expense","first-income"]);
    const manual=lerCapaPessoal({cor:"coral",figurinhas:["first-income","wishlist","desconhecida"]});
    expect(figurinhasDaCapa(manual,todas,datas).map(b=>b.id)).toEqual(["first-income"]);
    expect(figurinhasDaCapa(auto,[badge("antiga",{arquivada:true})])).toEqual([]);
    expect(figurinhasDaCapa({...auto,figurinhas:[]},todas)).toEqual([]);
  });
  it("não oferece arquivadas nem duplica módulos nas próximas ações",()=>{
    const candidatas=[badge("first-expense",{unlocked:false}),badge("wishlist",{unlocked:false}),badge("rotina-1",{unlocked:false,category:"rotina"}),badge("antiga",{unlocked:false,arquivada:true,progresso:{atual:9,alvo:10}}),badge("sequencia-7",{unlocked:false,category:"sequencia"})];
    expect(proximasFigurinhas(candidatas).map(b=>b.id)).toEqual(["first-expense","rotina-1"]);
    expect(proximasFigurinhas(todas.filter(b=>b.unlocked))).toEqual([]);
  });
  it("limita a três próprias, permite destacar e só salva ao confirmar",()=>{
    const salvar=vi.fn(), fechar=vi.fn();
    render(<PersonalizarCapa inicial={{cor:"azul",figurinhas:["first-income","first-expense","rotina-1"]}} adesivos={todas} datas={{}} pendentes={[]} nome="Ana" ano={2026} onSalvar={salvar} onFechar={fechar}/>);
    expect(screen.queryByRole("button",{name:"wishlist"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"treino-1"}));
    expect(screen.getByRole("status")).toHaveTextContent("Retire uma das três");
    expect(salvar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"first-expense, na capa"}));
    fireEvent.click(screen.getByRole("button",{name:"treino-1"}));
    fireEvent.click(screen.getByRole("button",{name:"Destacar treino-1"}));
    fireEvent.click(screen.getByRole("button",{name:"Petróleo"}));
    fireEvent.click(screen.getByRole("button",{name:"Salvar minha capa"}));
    expect(salvar).toHaveBeenCalledWith({cor:"petroleo",figurinhas:["treino-1","first-income","rotina-1"]});
  });
  it("cancelar descarta o rascunho e zero conquistas ainda permite escolher cor",()=>{
    const salvar=vi.fn(),fechar=vi.fn();
    render(<PersonalizarCapa inicial={{cor:"azul",figurinhas:null}} adesivos={[]} datas={{}} pendentes={[]} nome="Ana" ano={2026} onSalvar={salvar} onFechar={fechar}/>);
    expect(document.querySelector('[data-pessoal="0"]')).toHaveTextContent("A");
    fireEvent.click(screen.getByRole("button",{name:"Coral"}));
    fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
    expect(fechar).toHaveBeenCalledOnce(); expect(salvar).not.toHaveBeenCalled();
  });
});
