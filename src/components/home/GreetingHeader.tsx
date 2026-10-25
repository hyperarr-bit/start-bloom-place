import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, CloudSun, Sunset, Pencil, ChevronDown } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { LifeHubData } from "@/hooks/use-life-hub-data";
import { NameEditDialog } from "./NameEditDialog";
import { AccountDrawer } from "./AccountDrawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navAbasLigada, lerTela } from "@/lib/nav-abas";
import { consumirAvisoMenuNovo, menuNovoLigado } from "@/lib/menu-novo";
import { useTheme } from "@/hooks/use-theme";

/** O aviso único do menu novo espera a Home assentar (e nenhuma camada por cima) e some sozinho. */
const AVISO_ESPERA_MS = 1200;
const AVISO_DURA_MS = 8000;

interface GreetingHeaderProps {
  data: LifeHubData;
  onNameChange?: (name: string) => void;
  onReplayTutorial?: () => void;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", Icon: Moon };
  if (h < 12) return { text: "Bom dia", Icon: Sun };
  if (h < 18) return { text: "Boa tarde", Icon: CloudSun };
  return { text: "Boa noite", Icon: Sunset };
};

/** 1.0.18: algo por cima do balão do menu novo? Camada guiada (tour, missão, festa…), folha (dialog) ou a tela/card de
 *  cobrança recusada (alertdialog). */
const algoPorCimaDoAviso = (): boolean => {
  try { return lerTela().camadaPorCima || !!document.querySelector('[role="dialog"], [role="alertdialog"]'); } catch { return true; }
};

export const GreetingHeader = ({ data, onNameChange, onReplayTutorial }: GreetingHeaderProps) => {
  const { user } = useAuth();
  const { get, set: setUserData } = useUserData();
  const { text: greeting, Icon: GreetingIcon } = getGreeting();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  // 1.0.18: a folha pode abrir direto na Aparência (o toque no aviso único)
  const [inicialDaFolha, setInicialDaFolha] = useState<"menu" | "aparencia">("menu");
  // 1.0.17: com a barra de abas, avatar (folha da conta), sol e paleta moram no Você — o topo fica só a saudação
  const comAbas = navAbasLigada() && !!user;
  // 1.0.18 (lib/menu-novo): o menu em 3 grupos; o sol e a paleta saem do topo e vão pra Aparência dentro dele.
  // `menu_novo: off` (RevenueCat) = o topo de hoje, com os dois.
  const menuNovo = menuNovoLigado();
  const { mode, palette } = useTheme();
  const [aviso, setAviso] = useState(false);

  /* O AVISO ÚNICO: quem estava no escuro ou numa cor ≠ Original quando o menu novo aparece pela 1ª vez vê um balão
   * no avatar, uma vez por aparelho (gravado na hora em que aparece — reabrir o app não repete). Espera a Home
   * assentar e nenhuma camada por cima (tour, missão, festa, folha aberta); quem está no Claro · Original é marcado
   * "não precisa" na 1ª Home e nunca vê. */
  useEffect(() => {
    if (!menuNovo || comAbas || !user) return;
    let tentativas = 0;
    let fim: ReturnType<typeof setTimeout> | undefined;
    const tentar = (): boolean => {
      // 1.0.18 (revisor 22/10): também a tela cheia de cobrança recusada e o card de recusa (role="alertdialog")
      if (algoPorCimaDoAviso()) return false;
      if (consumirAvisoMenuNovo(mode, palette)) {
        setAviso(true);
        trackEvent("menu_novo_aviso_visto", { modo: mode, paleta: palette });
        fim = setTimeout(() => setAviso(false), AVISO_DURA_MS);
      }
      return true;
    };
    let id: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      if (tentar()) return;
      id = setInterval(() => { if (tentar() || ++tentativas > 120) clearInterval(id); }, 1000);
    }, AVISO_ESPERA_MS);
    return () => { clearTimeout(t); if (id) clearInterval(id); if (fim) clearTimeout(fim); };
    // o tema de quando a Home abriu é o que decide (trocar de tema depois não reabre a pergunta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuNovo, comAbas, !!user]);

  /* se uma folha/camada entra por cima enquanto o balão está na tela (as duas decidiram no mesmo instante), o balão sai
     na hora — nunca fica escondido por baixo */
  useEffect(() => {
    if (!aviso) return;
    const id = setInterval(() => { if (algoPorCimaDoAviso()) setAviso(false); }, 300);
    return () => clearInterval(id);
  }, [aviso]);

  const abrirMenu = (via: "avatar" | "aviso") => {
    trackEvent("account_drawer_open", menuNovo ? { via, menu: "novo" } : { via });
    if (via === "aviso") trackEvent("menu_novo_aviso_toque", {});
    setAviso(false);
    setInicialDaFolha(via === "aviso" ? "aparencia" : "menu");
    setShowAccount(true);
  };

  const nomeCompleto = data.userName || user?.email?.split("@")[0] || "";
  /* Só o PRIMEIRO nome na saudação (29/07). "Boa tarde, João Victor 👋" não
     cabe em 360px e virava "Boa tarde, João Vic…" — nome cortado no meio é
     pior que nome curto. As iniciais do avatar continuam usando o nome
     inteiro, que é onde as duas letras fazem sentido. */
  const displayName = nomeCompleto.trim().split(/\s+/)[0] || "";
  const hasSetName = !!get<string>("core-user-name", "");

  const initials = nomeCompleto
    ? nomeCompleto.slice(0, 2).toUpperCase()
    : "?";

  const handleNameSave = (name: string) => {
    setUserData("core-user-name", name);
    onNameChange?.(name);
  };

  return (
    <>
      {/* 1.0.19 (dono): o topo é só "Bom dia, Nome 👋" — a frase de contexto embaixo saiu (Home mais limpa). Uma linha
          só: items-center deixa a saudação no meio da altura do avatar (com items-start ela subia e o avatar ficava
          mais baixo que o texto). */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <GreetingIcon className="w-4 h-4 text-warning" />
            {/* text-base em tela pequena (320px): a 18px "Boa tarde, João 👋"
                  ainda cortava. O nome é a parte que importa — encolhe a fonte
                  em vez de comer a palavra. */}
            <h1 className="text-base sm:text-lg font-bold truncate">
              {greeting}{displayName ? `, ${displayName}` : ""} 👋
            </h1>
            {!hasSetName && (
              <button
                onClick={() => setShowNameDialog(true)}
                className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Editar nome"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
        {!comAbas && <div className="flex items-center gap-1 flex-shrink-0">
          {/* Avatar-badge (22/07, escolha do dono após ▾ e ☰): o próprio
              avatar É o menu — anel degradê + mini-badge ⌄ no canto, padrão
              Google/Instagram. Um elemento só, nada solto do lado.
              account_drawer_open segue medindo a descoberta real. */}
          <span className="relative">
          <motion.button
            onClick={() => abrirMenu("avatar")}
            className="relative rounded-full"
            whileTap={{ scale: 0.9 }}
            aria-label="Minha conta"
          >
            <span className="block rounded-full p-[2px]" style={{ background: "linear-gradient(to bottom right, hsl(var(--fixo-tinta) / 0.7), hsl(var(--fixo-tinta) / 0.2))" }}>
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="text-[10px] font-bold" style={{ background: "hsl(var(--fixo-tinta) / 0.1)", color: "hsl(var(--fixo-tinta))" }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background border border-border shadow-sm flex items-center justify-center">
              <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" strokeWidth={3} />
            </span>
          </motion.button>
          {aviso && (
            <motion.button
              type="button"
              onClick={() => abrirMenu("aviso")}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2.5 z-50 w-[15.5rem] rounded-xl px-3.5 py-2.5 text-left text-[12.5px] leading-snug shadow-lg bg-foreground text-background"
              data-testid="aviso-menu-novo"
              data-aviso-menu-novo=""
              aria-live="polite"
            >
              {/* a setinha aponta pro avatar */}
              <span aria-hidden className="absolute -top-1.5 right-3.5 w-3 h-3 rotate-45 bg-foreground" />
              <span className="relative block">
                Modo escuro e cores agora ficam aqui no menu, em <b className="font-bold">Aparência</b> ›
              </span>
            </motion.button>
          )}
          </span>
          {!menuNovo && <ThemeToggle showPalette origem="home_topo" />}
        </div>}
      </motion.div>

      {!hasSetName && (
        <NameEditDialog
          open={showNameDialog}
          onOpenChange={setShowNameDialog}
          currentName={nomeCompleto}
          onSave={handleNameSave}
        />
      )}

      {/* nomeCompleto, não displayName (17/08): displayName é SÓ o primeiro
          nome (corte visual da saudação). Passar ele pro drawer/dialog fazia
          "alterar nome" abrir com "João" pra quem é "João Victor" — e salvar
          dali comia o sobrenome em silêncio. */}
      {!comAbas && <AccountDrawer
        open={showAccount}
        onOpenChange={setShowAccount}
        inicial={inicialDaFolha}
        displayName={nomeCompleto}
        onNameChange={onNameChange}
        onReplayTutorial={onReplayTutorial}
      />}
    </>
  );
};
