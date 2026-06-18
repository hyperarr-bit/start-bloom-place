// Shared map of module key → page component, used by both the single-module
// demo (/preview/:moduleKey) and the full navigable demo (/demo/:moduleKey).
import Index from "@/pages/Index";
import Rotina from "@/pages/Rotina";
import DesenvolvimentoPessoal from "@/pages/DesenvolvimentoPessoal";
import Saude from "@/pages/Saude";
import Casa from "@/pages/Casa";
import Estudos from "@/pages/Estudos";
import Biblioteca from "@/pages/Biblioteca";
import Beleza from "@/pages/Beleza";
import Viagens from "@/pages/Viagens";
import Carreira from "@/pages/Carreira";
import Treino from "@/pages/Treino";
import Dieta from "@/pages/Dieta";
import Hiperfoco from "@/pages/Hiperfoco";
import Relacionamentos from "@/pages/Relacionamentos";
import PetPage from "@/pages/Pet";
import Detox from "@/pages/Detox";

export const MODULE_COMPONENTS: Record<string, React.ComponentType> = {
  financas: Index,
  rotina: Rotina,
  desenvolvimento: DesenvolvimentoPessoal,
  saude: Saude,
  casa: Casa,
  estudos: Estudos,
  biblioteca: Biblioteca,
  beleza: Beleza,
  viagens: Viagens,
  carreira: Carreira,
  treino: Treino,
  dieta: Dieta,
  hiperfoco: Hiperfoco,
  mente: Hiperfoco,
  relacionamentos: Relacionamentos,
  pet: PetPage,
  detox: Detox,
};
