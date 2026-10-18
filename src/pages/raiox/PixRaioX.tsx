import { useState } from "react";
import { Loader2 } from "lucide-react";
import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";
import { EMAIL_OK } from "@/pages/venda/conta";
import { PixVenda, type PixGerado, type PixPago } from "@/pages/venda/PixVenda";
import { OFERTA, PIX_EMAIL_SUB, PIX_EMAIL_TITULO, PIX_ESCANEAR, PIX_NAO_MUDOU, PRECO, PRECO_TEXTO } from "./conteudo";
import { Logo } from "./telas";

/**
 * Pix do Raio-X. O QR, o copia-e-cola e a checagem a cada 3 s são o PixVenda (Asaas, oferta a97).
 * A área de transferência só no toque em "Copiar código Pix" — o PixVenda não copia sozinho.
 */
export function PixRaioX({ fase, email, erro, celular, pix, onPix, onPago, ids, onEnviar, onSenha, onCodigo, onOutroEmail }: {
  fase: "form" | "existe" | "abrindo" | "pix";
  email: string;
  erro: string | null;
  celular: boolean;
  pix: PixGerado | null;
  onPix: (p: PixGerado | null) => void;
  onPago: (p?: PixPago) => void;
  ids: () => Record<string, string>;
  onEnviar: (email: string) => void;
  onSenha: (senha: string) => void;
  onCodigo: () => void;
  onOutroEmail: () => void;
}) {
  const [valor, setValor] = useState(email);
  const [senha, setSenha] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  const escanear = () => {
    const el = document.querySelector('[data-testid="venda-pix-ver-qr"]') as HTMLDetailsElement | null;
    if (el) el.open = true;
  };

  return (
    <div data-testid="raiox-pix" data-fase={fase}>
      <div className="flex items-center gap-2"><Logo /></div>
      {fase === "form" || fase === "existe" ? (
        <form
          className="mt-6"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (fase === "existe") { onSenha(senha); return; }
            if (!EMAIL_OK.test(valor.trim())) { setLocal("Esse e-mail parece errado. Confere e tenta de novo."); return; }
            setLocal(null);
            onEnviar(valor.trim());
          }}
        >
          <h1 className="text-[26px] font-extrabold leading-[30px]" data-testid="raiox-pix-titulo">
            {fase === "existe" ? "Esse e-mail já tem conta no CORE" : PIX_EMAIL_TITULO}
          </h1>
          <p className="mt-2 text-[15px] text-[#737373]">
            {fase === "existe" ? <>Entre na conta de <b className="text-[#262626]">{email}</b> pra pagar nela. Não criamos outra.</> : PIX_EMAIL_SUB}
          </p>
          {fase === "form" && (
            <input
              data-testid="raiox-pix-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              value={valor} onChange={(ev) => setValor(ev.target.value)} placeholder="Seu e-mail" aria-label="Seu e-mail"
              className="mt-4 h-14 w-full rounded-2xl border border-[#E5E5E5] px-4 text-[16px]"
            />
          )}
          {fase === "existe" && (
            <input
              data-testid="raiox-pix-senha" type="password" autoComplete="current-password" value={senha} onChange={(ev) => setSenha(ev.target.value)}
              placeholder="Sua senha do CORE" aria-label="Sua senha do CORE"
              className="mt-4 h-14 w-full rounded-2xl border border-[#E5E5E5] px-4 text-[16px]"
            />
          )}
          {(local || erro) && <p role="alert" data-testid="raiox-pix-erro" className="mt-2 text-[13px] font-semibold text-[#262626]">{local || erro}</p>}
          <button type="submit" data-testid="raiox-pix-seguir" className="raiox-opcao mt-4 h-14 w-full rounded-full bg-[#333] text-[17px] font-semibold text-white">
            {fase === "existe" ? "Entrar e pagar no Pix" : `Seguir pro Pix · R$ ${PRECO_TEXTO}`}
          </button>
          {fase === "existe" && (
            <>
              <EntrarComCodigo email={email} funil="raiox" rotulo="Entrar com um código no e-mail" className="mt-3" onSession={onCodigo} />
              <button type="button" data-testid="raiox-pix-outro" onClick={onOutroEmail} className="mt-2 w-full text-[14px] text-[#737373]">
                Usar outro e-mail
              </button>
            </>
          )}
        </form>
      ) : fase === "abrindo" ? (
        <div className="mt-16 text-center" data-testid="raiox-pix-abrindo">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" aria-hidden />
          <p className="mt-3 text-[15px] text-[#737373]">Preparando sua conta…</p>
        </div>
      ) : (
        <>
          <PixVenda
            pix={pix} onPix={onPix} onPago={onPago} ids={ids} celular={celular}
            oferta={OFERTA} plano="anual" rotulo="Anual" preco={PRECO_TEXTO} valor={PRECO} acesso="1 ano de acesso"
            aviso="Sem renovação automática."
          />
          {celular && (
            <button type="button" data-testid="raiox-pix-escanear" onClick={escanear} className="mt-3 w-full text-center text-[14px] font-semibold text-[#262626]">
              {PIX_ESCANEAR}
            </button>
          )}
          <p data-testid="raiox-pix-aviso" className="mt-4 text-center text-[13px] leading-snug text-[#737373]">{PIX_NAO_MUDOU}</p>
        </>
      )}
    </div>
  );
}
