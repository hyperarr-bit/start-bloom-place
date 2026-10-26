import forcaDeVontade from "@/assets/conquistas-caderno/variacoes/aplicadas/treino-50.webp";
import progressaoDeCarga from "@/assets/conquistas-caderno/revisao-equilibrio/treino-carga.webp";
import semanaCumprida from "@/assets/conquistas-caderno/variacoes/aplicadas/treino-carga.webp";
import contasRevisada from "@/assets/conquistas-caderno/revisao-outubro/finance-3.webp";
import volteiRevisada from "@/assets/conquistas-caderno/revisao-outubro/sequencia-2.webp";
import sonoSuave from "@/assets/conquistas-caderno/variacoes/estudo-cores/sono-suave.webp";
import tireiDaCabecaVermelho from "@/assets/conquistas-caderno/colecao/tarefa-1.webp";
import resolvidoVermelho from "@/assets/conquistas-caderno/colecao/tarefa-feita.webp";
import chefDeCasa from "@/assets/conquistas-caderno/chef-de-casa.webp";
import primeiroDia from "@/assets/conquistas-caderno/variacoes/uma-cor/primeiro-dia-salvia.webp";
import primeiraDespesa from "@/assets/conquistas-caderno/variacoes/uma-cor/primeira-despesa-azul.webp";
import primeiroTreino from "@/assets/conquistas-caderno/variacoes/uma-cor/primeiro-treino-petroleo.webp";
import listaDesejos from "@/assets/conquistas-caderno/variacoes/uma-cor/lista-desejos-violeta.webp";
import salario from "@/assets/conquistas-caderno/variacoes/uma-cor/salario-jade.webp";
import comoEuTo from "@/assets/conquistas-caderno/revisao-humor/humor-1.webp";
import horaMarcada from "@/assets/conquistas-caderno/revisao-rotina/compromisso-1.webp";
import pegandoRitmo from "@/assets/conquistas-caderno/revisao-rotina/rotina-21.webp";
import doMeuJeito from "@/assets/conquistas-caderno/variacoes/aplicadas/habito-criado.webp";
import entrelinhas from "@/assets/conquistas-caderno/revisao-leitura-financas/leitura-nota-v3.webp";
import mesFechado from "@/assets/conquistas-caderno/revisao-leitura-financas/mes-fechado.webp";
import meuMesPaginas from "@/assets/conquistas-caderno/variacoes/aplicadas/mes-20.webp";
// A FAMÍLIA DE PEDRA da sequência (26/10, dono): artes novas com a legenda impressa ("1 DIA" … "100 DIAS"); a cor de
// cada marco é a da chama (components/fogo/core-fire: âmbar · petróleo · violeta · magenta · ouro suave · ouro luminoso).
import sequencia1 from "@/assets/conquistas-caderno/sequencia-pedra/sequencia-1.webp";
import sequencia3 from "@/assets/conquistas-caderno/sequencia-pedra/sequencia-3.webp";
import sequencia7 from "@/assets/conquistas-caderno/sequencia-pedra/sequencia-7.webp";
import sequencia14 from "@/assets/conquistas-caderno/sequencia-pedra/sequencia-14.webp";
import sequencia30 from "@/assets/conquistas-caderno/sequencia-pedra/sequencia-30.webp";
import sequencia100 from "@/assets/conquistas-caderno/sequencia-pedra/sequencia-100.webp";

// Vite resolve URLs leves; os arquivos só são baixados quando uma imagem é exibida.
const novas = import.meta.glob<string>("/src/assets/conquistas-caderno/colecao/*.webp", { eager: true, query: "?url", import: "default" });
const colecao = Object.fromEntries(Object.entries(novas).map(([p, url]) => [p.split("/").pop()!.replace(".webp", ""), url]));
// Esta pasta contém apenas cores escolhidas para o álbum; testes ficam separados.
const coresAplicadas = import.meta.glob<string>("/src/assets/conquistas-caderno/variacoes/aplicadas/*.webp", { eager: true, query: "?url", import: "default" });
const paletaAplicada = Object.fromEntries(Object.entries(coresAplicadas).map(([p, url]) => [p.split("/").pop()!.replace(".webp", ""), url]));
// Revisão pontual: favoritos preservados; versões anteriores continuam nas pastas originais.
const revisadas = import.meta.glob<string>("/src/assets/conquistas-caderno/revisao-paleta/*.webp", { eager: true, query: "?url", import: "default" });
const revisaoPaleta = Object.fromEntries(Object.entries(revisadas).map(([p, url]) => [p.split("/").pop()!.replace(".webp", ""), url]));
const finalizadas = import.meta.glob<string>("/src/assets/conquistas-caderno/revisao-final/*.webp", { eager: true, query: "?url", import: "default" });
const revisaoFinal = Object.fromEntries(Object.entries(finalizadas).map(([p, url]) => [p.split("/").pop()!.replace(".webp", ""), url]));
// Escolhas de cor prevalecem sobre as reconstruções anteriores da coleção.
const artesComCor = {
  "first-income": salario, "first-expense": primeiraDespesa,
  "rotina-1": primeiroDia, "wishlist": listaDesejos, "treino-1": primeiroTreino,
  "sono-7": sonoSuave,
};
/** Os 6 marcos da sequência — a mesma arte no álbum, na coleção, na capa, na festa, no compartilhar e na folha. */
export const SEQUENCIA_PEDRA: Record<string, string> = {
  "sequencia-1": sequencia1, "sequencia-3": sequencia3, "sequencia-7": sequencia7,
  "sequencia-14": sequencia14, "sequencia-30": sequencia30, "sequencia-100": sequencia100,
};
/** Artes aprovadas preservadas; reconstruções em arquivos próprios.
 * Só os WebP finais (vencedores deste mapa) entram no app; as artes antigas que
 * eram sobrescritas por versões posteriores ficaram fora do repositório. */
export const ARTES_CADERNO: Record<string, string> = {
  "rotina-1": primeiroDia,
  "first-expense": primeiraDespesa,
  "treino-1": primeiroTreino,
  "wishlist": listaDesejos,
  "first-income": salario,
  ...colecao,
  ...Object.fromEntries(Object.entries(colecao).filter(([id]) => id.endsWith("-v2")).map(([id, url]) => [id.slice(0, -3), url])),
  ...Object.fromEntries(Object.entries(colecao).filter(([id]) => id.endsWith("-v3")).map(([id, url]) => [id.slice(0, -3), url])),
  ...artesComCor,
  ...paletaAplicada,
  // Preservar o vermelho preferido nestas duas cenas.
  "finance-3": contasRevisada,
  "sequencia-2": volteiRevisada,
  "receita-1": chefDeCasa,
  "tarefa-1": tireiDaCabecaVermelho,
  "tarefa-feita": resolvidoVermelho,
  ...revisaoPaleta,
  ...revisaoFinal,
  // Escolha após comparação: manter só a nova progressão de carga.
  // A menina subindo nos discos passa a representar Semana cumprida.
  "treino-carga": progressaoDeCarga,
  "treino-semana": semanaCumprida,
  // A Máquina anterior ganha uma conquista própria; o robô continua em treino-50.
  "treino-25": forcaDeVontade,
  "humor-1": comoEuTo,
  "compromisso-1": horaMarcada,
  "rotina-21": pegandoRitmo,
  "habito-criado": doMeuJeito,
  "leitura-nota": entrelinhas,
  "mes-fechado": mesFechado,
  "mes-20": meuMesPaginas,
  // A família de pedra da sequência por último: nenhuma pasta (coleção, revisões) sobrescreve os 6 marcos.
  ...SEQUENCIA_PEDRA,
};
