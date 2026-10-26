import { montarAlbumEditorial, paginaDaFigurinha } from "@/components/conquistas/album-paginas";
import { describe, expect, it } from "vitest";
import { aplicarCatalogoCaderno, medirCaderno, NOVAS_CONQUISTAS, IDS_ARQUIVADOS } from "@/components/gamification/catalogo-caderno";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { buildBadgesSequencia, mesclarDesbloqueios } from "@/lib/conquistas-registro";
import { acoesDaEscrita, registrarAcao, CHAVE_ACOES_CONQUISTAS } from "@/lib/conquistas-acoes";
import { ARTES_CADERNO } from "@/components/conquistas/artes-caderno";
const hoje = "2026-10-19";
const ler = (dados: Record<string, unknown> = {}) => <T,>(k: string, fallback: T): T => (dados[k] ?? fallback) as T;
const catalogo = (dados: Record<string, unknown> = {}, gravadas = {}) => {
 const get = ler(dados);
 return aplicarCatalogoCaderno([...buildBadgesSequencia(0), ...buildBadgesFinancas(get), ...buildBadgesVida(get, hoje)], get, gravadas, hoje);
};
const estado = (id: string, dados: Record<string, unknown>) => catalogo(dados).find(b => b.id === id)!;
describe("Catálogo aprovado: união, critérios e migração", () => {
 it("o álbum por módulos tem todas as figurinhas uma vez no miolo e no máximo cinco por folha", () => {
  const base = mesclarDesbloqueios(catalogo(), {}, hoje).adesivos;
  const paginas = montarAlbumEditorial(base);
  const ids = paginas.slice(1).flatMap(p => p.vagas.map(b => b.id));
  expect(ids).toHaveLength(base.length);
  expect(new Set(ids)).toEqual(new Set(base.map(b => b.id)));
  expect(paginas.slice(1).every(p => p.vagas.length <= 5 && p.modulo && !p.raridade)).toBe(true);
  expect(paginas.filter(p => p.modulo === "rotina").map(p => p.vagas.length)).toEqual([5, 4, 4, 4]);
  expect(paginas.filter(p => p.modulo === "sequencia").map(p => p.vagas.length)).toEqual([4, 4, 3]);
  const conjunta = paginas.find(p => p.id === "carreira-core")!;
  expect(conjunta.modulos).toEqual(["carreira", "geral"]);
  expect(paginas[paginaDaFigurinha(paginas, "master")]).toBe(conjunta);
  const conquistado = montarAlbumEditorial(base.map(b => ({...b, unlocked:true})));
  expect(conquistado.slice(1).map(p=>p.vagas.map(b=>b.id))).toEqual(paginas.slice(1).map(p=>p.vagas.map(b=>b.id)));
 });
 it("mantém os dois planos, ids únicos e todas as categorias novas", () => {
  const base = catalogo();
  expect(new Set(base.map(b=>b.id)).size).toBe(base.length);
  expect(base).toHaveLength(98); // o Mestre é somado pelo registro, total 99
  expect(NOVAS_CONQUISTAS).toHaveLength(45);
  for(const id of ["saver-60", "retorno", "leitura-nota", "treino-plano", "carreira-projeto", "acao-rapida"]) expect(base.some(b=>b.id===id)).toBe(true);
  expect(base.some(b=>IDS_ARQUIVADOS.has(b.id))).toBe(false);
  expect(base.filter(b=>b.unlocked)).toEqual([]);
 });
 it("toda figurinha ativa tem arte no novo estilo, inclusive a conquista opcional do tour", () => {
  const ids = [...catalogo().map(b=>b.id), "master", "casa-arrumada"];
  expect(ids.filter(id=>!ARTES_CADERNO[id])).toEqual([]);
  const revisadas = ["diario-7", "diario-1", "leitura-3", "meta-semanal-4"];
  const finalizadas = ["leitura-10", "dieta-jejum", "rotina-semana", "treino-50", "dieta-refeicao", "saude-log"];
  // Reconstruções aprovadas também vivem em pastas próprias, não só em variacoes.
  for (const id of ids) expect(ARTES_CADERNO[id]).toMatch(/^\/src\/assets\/conquistas-caderno\/.+\.(?:webp|png)$/);
  // a família de pedra da sequência (26/10): os 6 marcos vêm da pasta nova, em WebP, e nada os sobrescreve
  for (const d of [1, 3, 7, 14, 30, 100]) expect(ARTES_CADERNO[`sequencia-${d}`]).toContain(`/sequencia-pedra/sequencia-${d}.webp`);
  for (const id of revisadas) expect(ARTES_CADERNO[id]).toContain(`/revisao-paleta/${id}.webp`);
  for (const id of finalizadas) expect(ARTES_CADERNO[id]).toContain(`/revisao-final/${id}.webp`);
  for (const id of ["tarefa-1", "tarefa-feita"]) expect(ARTES_CADERNO[id]).toContain(`/colecao/${id}.webp`);
  expect(ARTES_CADERNO["receita-1"]).toContain("chef-de-casa.webp");
  for (const id of ["sequencia-2", "finance-3"]) expect(ARTES_CADERNO[id]).toContain(`/revisao-outubro/${id}.webp`);
  expect(ARTES_CADERNO["sono-7"]).toContain("sono-suave.webp");
 });
 it("arquiva só conquistas já ganhas, preserva data e XP", () => {
  const gravadas = {"investor-100k":"2026-01-10", "saver-60":"2026-02-01", "rotina-1":"2026-02-02"};
  const r=mesclarDesbloqueios(catalogo({},gravadas),gravadas,hoje);
  expect(r.adesivos.find(b=>b.id==="investor-100k")).toMatchObject({arquivada:true,unlocked:true,xp:400});
  expect(r.desbloqueadas["saver-60"]).toBe("2026-02-01");
  expect(r.adesivos.find(b=>b.id==="saver-60")?.unlocked).toBe(true);
  expect(r.xp).toBe(650);
 });
 it("primeiro hábito não é qualquer atividade no heatmap", () => {
  expect(estado("rotina-1", {"heatmap-log":{[hoje]:1}}).unlocked).toBe(false);
  expect(estado("rotina-1", {"rotina-habit-log":{[hoje]:["Caminhar"]}}).unlocked).toBe(true);
 });
 it("um hábito criado precisa ser o hábito marcado", () => {
  const acoes=registrarAcao({},"habito:Ler",hoje);
  expect(estado("habito-criado",{[CHAVE_ACOES_CONQUISTAS]:acoes,"rotina-habit-log":{[hoje]:["Caminhar"]}}).unlocked).toBe(false);
  expect(estado("habito-criado",{[CHAVE_ACOES_CONQUISTAS]:acoes,"rotina-habit-log":{[hoje]:["Ler"]}}).unlocked).toBe(true);
 });
 it("Formiguinha conta dias, não cliques nem valor alto", () => {
  let acoes={}; for(let i=0;i<7;i++) acoes=registrarAcao(acoes,"poupar","2026-10-01");
  expect(estado("saver-60",{[CHAVE_ACOES_CONQUISTAS]:acoes}).unlocked).toBe(false);
  for(let i=2;i<=7;i++) acoes=registrarAcao(acoes,"poupar",`2026-10-0${i}`);
  expect(estado("saver-60",{[CHAVE_ACOES_CONQUISTAS]:acoes}).unlocked).toBe(true);
  expect(estado("saver-20",{"finance-wishlist":[{name:"Livro",savedAmount:0.5}]}).unlocked).toBe(true);
 });
 it("movimentações atravessam a virada do mês sem contar o mesmo dia duas vezes", () => {
  const dados = {"finance-expenses":[{date:hoje}], "finance-2026-setembro-expenses":[{date:"2026-09-29"}], "finance-2026-setembro-incomes":[{date:"2026-09-29"},{date:"2026-09-30"}]};
  expect(estado("finance-3", dados).unlocked).toBe(true);
  expect(medirCaderno(ler(dados),hoje).diasFinancas).toBe(3);
 });
 it("não inspeciona nem serializa dados de módulos que não geram evidência", () => {
  const circular: any = {}; circular.self = circular;
  expect(acoesDaEscrita("diary-entries", circular, circular)).toEqual([]);
 });
 it("limites vazios ou zero não valem; limite PJ também vale", () => {
  expect(estado("finance-limite",{"finance-category-budgets":{Comida:0}}).unlocked).toBe(false);
  expect(estado("finance-limite",{"finance-category-budgets-perfis":{empresa:{Comida:100}}}).unlocked).toBe(true);
 });
 it("a semana de dieta aceita registros honestos, e não apenas dias perfeitos", () => {
  const diary=Object.fromEntries(Array.from({length:7},(_,i)=>[`2026-10-${12+i}`,{meals:{almoco:{followed:false,note:""}}}]));
  expect(estado("dieta-semana",{"dieta-diary-v2":diary}).unlocked).toBe(true);
  expect(estado("dieta-semana",{"dieta-diary-v2":{...diary,"2026-10-12":{meals:{}}}}).unlocked).toBe(false);
 });
 it("sete treinos distintos respeitam dias de descanso e não contam duplicatas", () => {
  const log=["2026-10-01","2026-10-03","2026-10-05","2026-10-07","2026-10-09","2026-10-11","2026-10-13"];
  expect(estado("treino-7",{"saude-workout-log":log}).unlocked).toBe(true);
  expect(estado("treino-7",{"saude-workout-log":Array(7).fill(hoje)}).unlocked).toBe(false);
 });
 it("Força de vontade reaproveita Máquina e exige 25 dias válidos distintos, sem sequência obrigatória", () => {
  const dias = Array.from({length: 25}, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  const incompleto = [...dias.slice(0, 24), dias[0], "2099-01-01", "2026-02-30"];
  expect(estado("treino-25", {"saude-workout-log": incompleto})).toMatchObject({unlocked:false, progresso:{atual:24, alvo:25}});
  // O 25º treino pode vir semanas depois; descanso não zera a conquista.
  const completo = [...dias.slice(0, 24), hoje];
  expect(estado("treino-25", {"saude-workout-log": completo})).toMatchObject({name:"Força de vontade", unlocked:true, raridade:"raro", progresso:{atual:25, alvo:25}});
  expect(ARTES_CADERNO["treino-25"]).toContain("/variacoes/aplicadas/treino-50.webp");
  expect(ARTES_CADERNO["treino-50"]).toContain("/revisao-final/treino-50.webp");
 });
 it("progressão exige histórico do mesmo exercício em datas distintas", () => {
  const h=(date:string,exercise:string,carga:number)=>({date,exercise,series:[{carga,reps:10}]});
  expect(estado("treino-carga",{"treino-exercise-history":[h("2026-10-01","Supino",10),h("2026-10-02","Agachamento",20)]}).unlocked).toBe(false);
  expect(estado("treino-carga",{"treino-exercise-history":[h("2026-10-01","Supino",10),h("2026-10-01","supino",20)]}).unlocked).toBe(false);
  const dados={"treino-exercise-history":[h("2026-10-01","Supino",10),h("2026-10-02"," supino ",12)]};
  expect(estado("treino-carga",dados).unlocked).toBe(true);
  expect(estado("treino-pr",dados).unlocked).toBe(true);
 });
 it("notas de sessão e treino completo têm evidências separadas", () => {
  expect(estado("treino-completo",{"saude-workout-log":[hoje]}).unlocked).toBe(false);
  expect(estado("treino-nota",{"treino-notas-sessoes":{[hoje]:"   "}}).unlocked).toBe(false);
  expect(estado("treino-nota",{"treino-notas-sessoes":{[hoje]:"Respirar melhor"}}).unlocked).toBe(true);
 });
 it("tarefas, urgências e revisão exigem conteúdo e conclusão correta", () => {
  expect(estado("tarefa-feita",{"rotina-day-tasks":[{texto:"Comprar pão",feito:false}]}).unlocked).toBe(false);
  expect(estado("tarefa-feita",{"rotina-day-tasks":[{texto:"Comprar pão",feito:true}]}).unlocked).toBe(true);
  expect(estado("urgencia-feita",{"rotina-urgencies":[{text:"Resolver",done:false}]}).unlocked).toBe(false);
  expect(estado("rotina-revisao",{"weekly-reviews":{"semana":{rating:5,wins:" "}}}).unlocked).toBe(false);
  expect(estado("rotina-revisao",{"weekly-reviews":{"semana":{wins:"Aprendi algo"}}}).unlocked).toBe(true);
 });
 it("carreira recompensa candidatura, projeto e prática, não formulário vazio", () => {
  expect(estado("carreira-candidatura",{"career-jobs":[{company:"",role:""}]}).unlocked).toBe(false);
  expect(estado("carreira-candidatura",{"career-jobs":[{company:"Empresa",role:"Designer"}]}).unlocked).toBe(true);
  expect(estado("carreira-ensaio",{"career-interview-prep":[{answer:"",practiced:true}]}).unlocked).toBe(false);
  expect(estado("carreira-ensaio",{"career-interview-prep":[{answer:"Meu projeto",practiced:true}]}).unlocked).toBe(true);
 });
 it("saúde detecta medicamentos e registros médicos", () => {
  expect(estado("saude-remedio",{"core-saude-supplements":[{name:"Medicamento"}]}).unlocked).toBe(true);
  expect(estado("saude-log",{"core-saude-exams-v2":[{name:"Exame"}]}).unlocked).toBe(true);
 });
 it("etapas vazias padrão de uma meta não contam", () => {
  expect(estado("meta-passo",{"goals-board-v2":[{actionGroups:[{label:"Base",tasks:[]}]}]}).unlocked).toBe(false);
  expect(estado("meta-passo",{"goals-board-v2":[{actionGroups:[{tasks:[{text:"Enviar proposta"}]}]}]}).unlocked).toBe(true);
 });
 it("descarta dias futuros, inválidos e dados malformados", () => {
  const m=medirCaderno(ler({"core-dias-anotados":["2026-02-30","2099-01-01",hoje],"rotina-habit-log":null,"career-jobs":{},"saude-workout-log":["amanhã"]}),hoje);
  expect(m.diasMes).toBe(1); expect(m.treinos).toBe(0);
 });
});
describe("Evidências de ações",()=>{
 it("não premia check no plano nem gravação idêntica",()=>{
  const plano={SEGUNDA:{exercises:[{name:"Supino",sets:"3",reps:"10",done:false}]}};
  expect(acoesDaEscrita("saude-workouts-v2",plano,plano)).toEqual([]);
  expect(acoesDaEscrita("saude-workouts-v2",plano,{SEGUNDA:{exercises:[{...plano.SEGUNDA.exercises[0],done:true}]}})).toEqual([]);
  expect(acoesDaEscrita("saude-workouts-v2",{},plano)).toEqual(["plano-treino"]);
 });
 it("não premia diminuir dinheiro guardado nem editar o nome",()=>{
  const a=[{id:"1",name:"Livro",savedAmount:10}];
  expect(acoesDaEscrita("finance-wishlist",a,[{...a[0],name:"Outro"}])).toEqual([]);
  expect(acoesDaEscrita("finance-wishlist",a,[{...a[0],savedAmount:5}])).toEqual([]);
  expect(acoesDaEscrita("finance-wishlist",a,[{...a[0],savedAmount:11}])).toEqual(["poupar"]);
 });
 it("registro é idempotente e não aceita datas impossíveis",()=>{
  const a=registrarAcao({},"jejum",hoje);
  expect(registrarAcao(a,"jejum",hoje)).toEqual(a);
  expect(registrarAcao(a,"jejum","2026-02-30")).toEqual(a);
 });
});
