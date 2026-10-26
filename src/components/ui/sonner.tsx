import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useHomeNova } from "@/hooks/use-home-nova";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Os avisos (sonner). Com a HOME NOVA ligada pra esta conta (chave `home_nova`, 26/10, pedido do dono: "os toasts
 * estão feios"), o aviso vira uma PÍLULA discreta — escura no claro, clara no escuro (as cores do tema invertidas),
 * sem borda, canto cheio, ícone na frente, botão de ação em pílula — e entra por CIMA (abaixo do relógio), onde não
 * briga com a barra de vidro de baixo. Com a chave desligada, o aviso de sempre, byte a byte.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { user } = useAuth();
  const nova = useHomeNova(user);

  if (nova.ligada) {
    return (
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group toaster-e"
        position="top-center"
        // no celular o sonner usa o mobileOffset (não o offset): abaixo do relógio/ilha (--app-safe-top, lib/status-bar).
        // Varredura 26/10: o contêiner do sonner (≤600 px) é `left:16px; width:100%` — passava 16 px da tela, e o
        // `w-auto mx-auto` da pílula centrava ela nesse contêiner deslocado (32 px à esquerda, colada/cortada à direita).
        // Agora o contêiner é `width:auto` (index.css, .toaster-e) — left/right de 16 px definem a largura — e a pílula
        // ocupa 100% dele: centrada, 16 px dos dois lados, pontas redondas inteiras.
        offset="calc(var(--app-safe-top, 0px) + 10px)"
        mobileOffset={{ top: "calc(var(--app-safe-top, 0px) + 10px)", left: "16px", right: "16px", bottom: "16px" }}
        gap={8}
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:rounded-full group-[.toaster]:border-0 group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:shadow-[0_10px_30px_rgb(0_0_0/0.22)] group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:items-center group-[.toaster]:gap-3 group-[.toaster]:w-full group-[.toaster]:font-semibold group-[.toaster]:text-[14px]",
            title: "group-[.toast]:font-semibold group-[.toast]:text-[14px] group-[.toast]:leading-snug",
            description: "group-[.toast]:text-background/70 group-[.toast]:text-[12.5px]",
            icon: "group-[.toast]:text-background",
            actionButton: "group-[.toast]:rounded-full group-[.toast]:bg-background/15 group-[.toast]:text-background group-[.toast]:font-semibold group-[.toast]:text-[12.5px] group-[.toast]:h-8 group-[.toast]:px-3",
            cancelButton: "group-[.toast]:rounded-full group-[.toast]:bg-transparent group-[.toast]:text-background/70 group-[.toast]:font-semibold group-[.toast]:text-[12.5px] group-[.toast]:h-8 group-[.toast]:px-2",
            closeButton: "group-[.toast]:bg-background/15 group-[.toast]:text-background group-[.toast]:border-0",
          },
        }}
        {...props}
      />
    );
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
