import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel } from "./components";
import {
  chamarAdminSuporte, emailContaValido, limparEmailAdmin, textoLiberarPix, textoTrocarEmail,
  ERRO_EMAIL_FORMATO, ERRO_EMAIL_ORIGEM, ERRO_PIX_EMAIL, type ChamarAdmin,
} from "./acoes-suporte-api";

/**
 * LIBERAR PIX e TROCAR EMAIL no /admin/suporte (30/10).
 * Liberar Pix chama `transferir_pix`. Trocar email chama `trocar_email`.
 * Nenhuma das duas manda e-mail pra cliente.
 */

const campo = "w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-primary/30";
const botao = "flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60";

function Aviso({ aviso }: { aviso: { ok: boolean; texto: string } | null }) {
  if (!aviso) return null;
  return (
    <p role={aviso.ok ? "status" : "alert"} className={`text-[13px] leading-relaxed rounded-lg px-3 py-2 ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
      {aviso.texto}
    </p>
  );
}

export function FormLiberarPix({
  chamar = chamarAdminSuporte,
  deUid,
  pedidoInicial = null,
  mostrarPedido = true,
}: {
  chamar?: ChamarAdmin;
  /** conta anônima do chamado; o formulário avulso não tem */
  deUid?: string;
  pedidoInicial?: string | null;
  mostrarPedido?: boolean;
}) {
  const [pedido, setPedido] = useState(pedidoInicial ?? "");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const enviar = async () => {
    const id = pedido.trim();
    const destino = limparEmailAdmin(email);
    if (mostrarPedido && !deUid && !id) { setAviso({ ok: false, texto: "Cola o id do pedido ou do pagamento." }); return; }
    if (!emailContaValido(destino)) { setAviso({ ok: false, texto: ERRO_PIX_EMAIL }); return; }
    setEnviando(true);
    setAviso(null);
    try {
      const r = await chamar({
        action: "transferir_pix",
        ...(deUid ? { deUid } : {}),
        ...(id ? { pedido: id } : {}),
        email: destino,
      });
      setAviso(textoLiberarPix(r, destino));
    } catch {
      setAviso({ ok: false, texto: "Não liberou: falha de rede. Tenta de novo." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form noValidate className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      {mostrarPedido && (
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pedido ou id do pagamento</span>
          <input value={pedido} onChange={(e) => setPedido(e.target.value)} autoComplete="off" spellCheck={false} className={campo} placeholder="o “Pedido:” do chamado" />
        </label>
      )}
      {!mostrarPedido && pedidoInicial && (
        <p className="text-[12px] text-muted-foreground font-mono break-all">Pedido: {pedidoInicial}</p>
      )}
      <label className="block space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">E-mail da conta</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} className={campo} placeholder="ela@email.com" />
      </label>
      <button type="submit" disabled={enviando} className={botao}>
        {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Liberar Pix
      </button>
      <Aviso aviso={aviso} />
    </form>
  );
}

export function FormTrocarEmail({ chamar = chamarAdminSuporte }: { chamar?: ChamarAdmin }) {
  const [de, setDe] = useState("");
  const [para, setPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const enviar = async () => {
    const atual = de.trim();
    const novo = limparEmailAdmin(para);
    if (!atual) { setAviso({ ok: false, texto: ERRO_EMAIL_ORIGEM }); return; }
    if (!emailContaValido(novo)) { setAviso({ ok: false, texto: ERRO_EMAIL_FORMATO }); return; }
    setEnviando(true);
    setAviso(null);
    try {
      const r = await chamar({ action: "trocar_email", de: atual, para: novo });
      setAviso(textoTrocarEmail(r, novo));
    } catch {
      setAviso({ ok: false, texto: "Não trocou: falha de rede. Tenta de novo." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form noValidate className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">E-mail atual ou id da conta</span>
        <input value={de} onChange={(e) => setDe(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className={campo} placeholder="antigo@email.com ou o id" />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">E-mail novo</span>
        <input value={para} onChange={(e) => setPara(e.target.value)} type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} className={campo} placeholder="novo@email.com" />
      </label>
      <button type="submit" disabled={enviando} className={botao}>
        {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Trocar email
      </button>
      <Aviso aviso={aviso} />
    </form>
  );
}

/** Os dois formulários avulsos, sempre visíveis no topo do /admin/suporte. */
export function AcoesSuporte({ chamar = chamarAdminSuporte }: { chamar?: ChamarAdmin }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Panel title="Liberar Pix" sub="Move o Pix já pago (conta sem e-mail) pra conta que a pessoa já tem. Não cria acesso e não manda e-mail.">
        <FormLiberarPix chamar={chamar} />
      </Panel>
      <Panel title="Trocar email" sub="Troca o e-mail de login. A pessoa entra com o novo e continua com o acesso. Não manda e-mail.">
        <FormTrocarEmail chamar={chamar} />
      </Panel>
    </div>
  );
}

/** No chamado "Pix pago sem e-mail": o uid já é a conta anônima. */
export function LiberarPixChamado({
  deUid, pedido, chamar = chamarAdminSuporte,
}: { deUid: string; pedido: string | null; chamar?: ChamarAdmin }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-medium hover:bg-muted transition-colors">
        Liberar Pix
      </button>
      {aberto && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <FormLiberarPix chamar={chamar} deUid={deUid} pedidoInicial={pedido} mostrarPedido={!pedido} />
        </div>
      )}
    </div>
  );
}
