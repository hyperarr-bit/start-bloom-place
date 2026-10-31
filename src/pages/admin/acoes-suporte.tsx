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

type ContaVista = {
  uid: string | null; email: string | null; temAcesso: boolean; chaves: number;
  assinaturas?: Array<{ status?: string; plan?: string | null; billing_period?: string | null; payment_method?: string | null; amount_cents?: number | null }>;
};
type Recom = { modo: string | null; quemFica: string | null; quemSai: string | null; motivo: string };

const MOTIVO: Record<string, string> = {
  a_conta_do_email_esta_vazia: "A conta do e-mail certo não tem acesso. O caminho seguro é pôr esse e-mail na conta que já pagou.",
  a_conta_do_email_ja_tem_dados: "A conta do e-mail certo já tem dados e não tem acesso. O caminho seguro é mover o acesso pra ela.",
  as_duas_tem_acesso: "As duas contas têm acesso. Não junto sozinho.",
  acesso_ja_no_email: "O acesso já está na conta do e-mail certo.",
};

function reaisCurto(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return "";
  const abs = Math.abs(Math.round(Number(cents)));
  return `R$ ${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

function CartaoConta({ c, papel }: { c: ContaVista; papel: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5 space-y-1">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{papel}</div>
      <div className="text-[13px] font-semibold break-all">{c.email ?? "sem e-mail"}</div>
      <div className="text-[11px] font-mono break-all text-muted-foreground">{c.uid}</div>
      <div className="text-[12px]">{c.temAcesso ? "tem acesso" : "sem acesso"} · {c.chaves} chave{c.chaves === 1 ? "" : "s"} de dados</div>
      {(c.assinaturas ?? []).map((s) => (
        <div key={`${s.plan}-${s.status}-${s.amount_cents}`} className="text-[12px] text-muted-foreground">
          {[s.status, s.plan, s.billing_period, s.payment_method, reaisCurto(s.amount_cents)].filter(Boolean).join(" · ")}
        </div>
      ))}
    </div>
  );
}

function ConflitoDeEmail({
  contas, recomendacao, email, chamar, onAviso,
}: {
  contas: ContaVista[]; recomendacao: Recom | null; email: string; chamar: ChamarAdmin;
  onAviso: (a: { ok: boolean; texto: string }) => void;
}) {
  const [modo, setModo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const origem = contas[0];
  const dona = contas[1];
  const agir = async (escolha: "liberar_email" | "mover_acesso") => {
    if (!origem?.uid || !dona?.uid) return;
    const quemFica = escolha === "liberar_email" ? origem.uid : dona.uid;
    const quemSai = escolha === "liberar_email" ? dona.uid : origem.uid;
    if (modo !== escolha) { setModo(escolha); return; }
    setEnviando(true);
    try {
      const r = await chamar({ action: "resolver_email", modo: escolha, quemFica, quemSai, email, confirmar: quemSai });
      onAviso(r.ok === true && !r.error
        ? { ok: true, texto: escolha === "liberar_email"
          ? `A conta vazia saiu do caminho e ${email} ficou na conta que tem o acesso. Nenhum e-mail foi enviado.`
          : `O acesso foi pra conta ${email}. A outra conta continua com o e-mail antigo, sem esse acesso. Nenhum e-mail foi enviado.` }
        : textoTrocarEmail(r, email));
      if (r.ok === true && !r.error) setModo(null);
    } catch {
      onAviso({ ok: false, texto: "Não resolvi: falha de rede. Tenta de novo." });
    } finally {
      setEnviando(false);
    }
  };
  if (!origem || !dona) return null;
  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5">
      <CartaoConta c={origem} papel="Conta que você informou" />
      <CartaoConta c={dona} papel="Conta que já tem o e-mail novo" />
      {recomendacao?.motivo && <p className="text-[12.5px] text-muted-foreground">{MOTIVO[recomendacao.motivo] ?? recomendacao.motivo}</p>}
      {!dona.temAcesso && (
        <button type="button" disabled={enviando} onClick={() => void agir("liberar_email")} className={botao}>
          {enviando && modo === "liberar_email" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {modo === "liberar_email" ? "Confirmar: liberar o e-mail" : "Liberar o e-mail pra conta que tem o acesso"}
        </button>
      )}
      {!dona.temAcesso && origem.temAcesso && (
        <button type="button" disabled={enviando} onClick={() => void agir("mover_acesso")} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60">
          {modo === "mover_acesso" ? "Confirmar: mover o acesso" : "Mover o acesso pra conta do e-mail certo"}
        </button>
      )}
    </div>
  );
}

export function FormTrocarEmail({ chamar = chamarAdminSuporte }: { chamar?: ChamarAdmin }) {
  const [de, setDe] = useState("");
  const [para, setPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [conflito, setConflito] = useState<{ contas: ContaVista[]; recomendacao: Recom | null; email: string } | null>(null);

  const enviar = async () => {
    const atual = de.trim();
    const novo = limparEmailAdmin(para);
    if (!atual) { setAviso({ ok: false, texto: ERRO_EMAIL_ORIGEM }); return; }
    if (!emailContaValido(novo)) { setAviso({ ok: false, texto: ERRO_EMAIL_FORMATO }); return; }
    setEnviando(true);
    setAviso(null);
    setConflito(null);
    try {
      const r = await chamar({ action: "trocar_email", de: atual, para: novo });
      const contas = Array.isArray(r.contas) ? r.contas as ContaVista[] : [];
      if (r.error === "destino_ja_existe" && contas.length === 2) {
        setConflito({ contas, recomendacao: (r.recomendacao ?? null) as Recom | null, email: novo });
      }
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
      {conflito && <ConflitoDeEmail contas={conflito.contas} recomendacao={conflito.recomendacao} email={conflito.email} chamar={chamar} onAviso={setAviso} />}
    </form>
  );
}

/** Os dois formulários avulsos, sempre visíveis no topo do /admin/suporte. */
export function AcoesSuporte({ chamar = chamarAdminSuporte }: { chamar?: ChamarAdmin }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Panel title="Liberar Pix" sub="O Pix já pago vai pra esse e-mail. Se a pessoa não tem conta, cria uma (sem mandar e-mail) com o acesso deste pagamento.">
        <FormLiberarPix chamar={chamar} />
      </Panel>
      <Panel title="Trocar email" sub="Troca o e-mail de login. Se o e-mail novo já é de outra conta, mostra as duas antes de mexer. Não manda e-mail.">
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
