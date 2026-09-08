import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bug, HelpCircle, ImagePlus, Lightbulb, Loader2, Mail, Send, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadFromInput } from "@/lib/image-upload";
import { montarDiagnostico } from "@/lib/diagnostico-suporte";
import { trackEvent } from "@/lib/analytics";
import { EMPRESA } from "@/lib/empresa";

/**
 * AJUDA E SUPORTE DENTRO DO APP (07/09).
 *
 * Nasceu de um pedido literal de uma cliente pagante, por DM:
 *
 *   "se vcs puderem seguir a sugestão de ter uma aba de contato suporte
 *    direto no app pra gente anexar prints com os bugs e etc, acho q
 *    facilitaria muuuito pra vcs e para nós usuários. Sabe? Faz em algum
 *    local suporte e coloca um formulário pra gente por o bug e anexar o
 *    print. Seria ooootimo!"
 *
 * Ela tem razão nos dois lados. Do lado dela: dentro do app o único contato
 * era um `mailto:` perdido na página de termos, e a /suporte do site é
 * bloqueada no shell (SoNaWeb) — ou seja, quem estava com o bug na mão não
 * tinha por onde falar. Do nosso: chamado por e-mail chega sem versão, sem
 * aparelho e sem tela, e a primeira resposta vira sempre a mesma ladainha de
 * perguntas. Aqui o print vem junto e a ficha técnica vai sozinha.
 *
 * Três decisões:
 *  1. O tipo nasce em "Erro" — o pedido veio de bug, e é o caso em que a
 *     pessoa está com menos paciência pra escolher coisa antes de desabafar.
 *  2. Sem conta (convidado do teste grátis) a tela NÃO some: o servidor exige
 *     login pra gravar, então mostramos o caminho do e-mail. Esconder ajuda
 *     de quem precisa de ajuda seria o pior desfecho possível.
 *  3. A confirmação não promete o que o dono não escolheu: repete o prazo já
 *     publicado no site (EMPRESA.prazoResposta) e diz por onde a resposta
 *     chega — o e-mail da conta, que aparece na tela pra pessoa conferir.
 */

/** Mesmo bucket privado do quadro dos sonhos (já existe, política por pasta
 *  do usuário). Subpasta própria só pra separar print de suporte de imagem
 *  de módulo — criar bucket novo exigiria o painel. */
const BUCKET = "dream-board";
const SUBPASTA = "suporte";
const MAX_ANEXOS = 3;
const MAX_TEXTO = 4000;

type Tipo = "erro" | "duvida" | "sugestao";

const TIPOS: Array<{ id: Tipo; label: string; Icon: typeof Bug; dica: string }> = [
  {
    id: "erro",
    label: "Erro",
    Icon: Bug,
    dica: "Conte o que você estava fazendo quando aconteceu e o que apareceu na tela. Se der, anexe o print.",
  },
  {
    id: "duvida",
    label: "Dúvida",
    Icon: HelpCircle,
    dica: "Pergunte do jeito que você falaria com uma pessoa. Não tem pergunta boba aqui.",
  },
  {
    id: "sugestao",
    label: "Sugestão",
    Icon: Lightbulb,
    dica: "O que faria o CORE servir melhor pra sua rotina? A gente lê todas — várias já viraram recurso.",
  },
];

export default function Ajuda() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<Tipo>("erro");
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => { trackEvent("app_suporte_abriu", {}); }, []);

  /* O menu da conta só abre no hub, então a volta é sempre pra lá — e quem
     chegou por link direto não cai num histórico vazio. */
  const voltar = () => navigate("/home");

  const escolhido = TIPOS.find((t) => t.id === tipo)!;
  const cheio = anexos.length >= MAX_ANEXOS;

  const anexar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (cheio) return;
    setSubindo(true);
    setErro(null);
    try {
      const url = await uploadFromInput(e, BUCKET, SUBPASTA);
      if (url) setAnexos((a) => [...a, url].slice(0, MAX_ANEXOS));
      else setErro("Não consegui carregar essa imagem. Tenta de novo?");
    } catch {
      setErro("Não consegui carregar essa imagem. Tenta de novo?");
    } finally {
      setSubindo(false);
    }
  };

  const enviar = async () => {
    const mensagem = texto.trim();
    if (!mensagem) {
      setErro("Escreva o que aconteceu antes de enviar.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const diagnostico = await montarDiagnostico();
      const { data, error } = await supabase.functions.invoke("suporte-ticket", {
        body: { tipo, mensagem, anexos, diagnostico },
      });
      // A função devolve `{ error }` no corpo em erro de validação, e o
      // supabase-js devolve `error` em falha de rede/status — os dois casos
      // têm que virar a MESMA mensagem, senão um deles some em silêncio e a
      // pessoa acha que enviou.
      if (error || !data?.ok) throw new Error(String(data?.error ?? error?.message ?? "falhou"));
      setEnviado(true);
    } catch (e) {
      trackEvent("app_suporte_erro", { motivo: e instanceof Error ? e.message : "desconhecido" });
      setErro("Não consegui enviar agora. Confira sua conexão e tente de novo — seu texto continua aqui.");
    } finally {
      setEnviando(false);
    }
  };

  /* ------------------------------------------------------------ enviado */

  if (enviado) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Cabecalho onVoltar={voltar} />
        <div className="px-4 py-6 space-y-4 pb-[max(1.5rem,var(--app-safe-bottom))]">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-primary" strokeWidth={1.6} />
            <h2 className="mt-3 text-base font-bold">Chegou aqui 💛</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              Recebemos sua mensagem
              {anexos.length > 0 && ` e ${anexos.length === 1 ? "o print" : `os ${anexos.length} prints`}`}
              , junto com os dados do seu aparelho — você não precisa mandar mais nada.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2.5">
            <p className="text-[13.5px] leading-relaxed text-foreground">
              <span className="font-semibold">A resposta chega no e-mail da sua conta</span>
              {user?.email && <>: <span className="font-medium break-all">{user.email}</span></>}.
              {" "}Se não achar, dê uma olhada no spam.
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Somos uma equipe pequena e respondemos um por um, {EMPRESA.prazoResposta}.
            </p>
          </div>

          <button
            onClick={() => { setEnviado(false); setTexto(""); setAnexos([]); }}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Enviar outra mensagem
          </button>
          <button
            onClick={voltar}
            className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Voltar pro app
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------- formulário */

  return (
    <div className="min-h-[100dvh] bg-background">
      <Cabecalho onVoltar={voltar} />

      <div className="px-4 py-5 space-y-4 pb-[max(1.5rem,var(--app-safe-bottom))]">
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Achou um erro, tem uma dúvida ou uma ideia? Escreve aqui — a gente lê tudo.
          Os dados do seu aparelho e da versão do app vão junto automaticamente,
          então você não precisa procurar nada disso.
        </p>

        {/* tipo */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 pl-1">
            O que é
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTipo(id)}
                aria-pressed={tipo === id}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[13px] font-medium transition-colors ${
                  tipo === id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* texto */}
        <div>
          <label htmlFor="suporte-texto" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 pl-1 block">
            Conta pra gente
          </label>
          <textarea
            id="suporte-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
            rows={6}
            placeholder={escolhido.dica}
            className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-sm leading-relaxed
                       placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors resize-none"
          />
          <p className="mt-1 pl-1 text-[11px] text-muted-foreground/70">
            {texto.length}/{MAX_TEXTO}
          </p>
        </div>

        {/* anexos */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 pl-1">
            Prints (até {MAX_ANEXOS})
          </p>
          <div className="flex flex-wrap gap-2">
            {anexos.map((url, i) => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border bg-muted">
                <img src={url} alt={`Print ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => setAnexos((a) => a.filter((u) => u !== url))}
                  aria-label={`Remover print ${i + 1}`}
                  /* alvo de 28px num canto de 80px: o "Restaurar compras" de
                     17px da v94 já ensinou que ícone pequeno demais não é
                     clicável de verdade no celular. */
                  className="absolute top-1 right-1 w-7 h-7 grid place-items-center rounded-full bg-background/90 border border-border"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!cheio && (
              <button
                onClick={() => arquivoRef.current?.click()}
                disabled={subindo}
                className="w-20 h-20 rounded-xl border border-dashed border-border bg-card grid place-items-center
                           text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
                aria-label="Anexar print"
              >
                {subindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              </button>
            )}
          </div>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/*"
            onChange={anexar}
            className="hidden"
            aria-label="Escolher print"
          />
          {cheio && (
            <p className="mt-1.5 pl-1 text-[11px] text-muted-foreground/70">
              Chegou no limite de {MAX_ANEXOS} prints.
            </p>
          )}
        </div>

        {erro && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] text-destructive">
            {erro}
          </div>
        )}

        {/* Sem conta o servidor recusa (o chamado precisa saber de QUEM é).
            Em vez de esconder o botão sem explicação, mostra o caminho que
            funciona pra ela hoje. */}
        {!user && (
          <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            Você ainda está usando sem conta. Para enviar por aqui (e receber a resposta),
            crie sua conta — ou escreva direto pra{" "}
            <a href={`mailto:${EMPRESA.email}`} className="font-semibold text-primary hover:underline break-all">
              {EMPRESA.email}
            </a>.
          </div>
        )}

        <button
          onClick={enviar}
          disabled={enviando || subindo || !user}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground
                     px-4 py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {enviando ? "Enviando..." : "Enviar"}
        </button>

        <div className="flex items-start gap-2 pt-1 text-[12px] leading-relaxed text-muted-foreground">
          <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Prefere e-mail? Escreva pra{" "}
            <a href={`mailto:${EMPRESA.email}`} className="font-medium text-foreground hover:underline break-all">
              {EMPRESA.email}
            </a>
            . Respondemos {EMPRESA.prazoResposta}.
          </span>
        </div>
      </div>
    </div>
  );
}

/** Mesmo cabeçalho de Notificações — a tela irmã, alcançada pelo mesmo menu. */
function Cabecalho({ onVoltar }: { onVoltar: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-background/85 backdrop-blur border-b border-border
                       pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button onClick={onVoltar} aria-label="Voltar" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-base font-bold">Ajuda e suporte</h1>
    </header>
  );
}
