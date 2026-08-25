import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { EMPRESA } from "@/lib/empresa";
import { RodapeSite } from "@/components/site/RodapeSite";

/**
 * PÁGINA DE SUPORTE (24/08) — coreaplicativo.com.br/suporte
 *
 * Pedida com todas as letras pelo Suporte ao Desenvolvedor da Apple na recusa
 * da inscrição 8Y42K57CWD:
 *
 *   "Você precisará de um URL de suporte funcional e público [...] com suas
 *    informações de contato, para que os clientes possam entrar em contato
 *    com você em caso de dúvidas ou para solicitar assistência."
 *
 * Três coisas não podem sair daqui: e-mail de contato que funciona de verdade,
 * prazo de resposta declarado e a identificação da pessoa jurídica. O resto é
 * conteúdo útil pra quem chegou com problema.
 *
 * Rota PÚBLICA, sem login — o revisor abre sem conta (mesma regra das páginas
 * legais, ver src/pages/Legal.tsx).
 */

const AJUDA = [
  {
    q: "Comprei e não recebi o acesso",
    a: "O Pix costuma liberar em segundos, mas pode levar alguns minutos. Se passou disso, escreva pra gente com o e-mail que você usou na compra — a gente confere o pagamento e libera na mão.",
  },
  {
    q: "Esqueci minha senha",
    a: "Na tela de entrar, toque em “Esqueci minha senha”. Chega um link no seu e-mail para criar uma nova. Se o e-mail não aparecer, confira a caixa de spam antes de escrever pra gente.",
  },
  {
    q: "Troquei de celular — meus dados vêm junto?",
    a: "Vêm. Entre com a mesma conta no aparelho novo e tudo aparece. Seus dados ficam vinculados à conta, não ao aparelho.",
  },
  {
    q: "Já pago no site e quero usar o aplicativo Android",
    a: "É a mesma conta. Baixe o CORE na Google Play e entre com o mesmo e-mail — o acesso que você comprou aqui vale lá também, sem pagar de novo.",
  },
  {
    q: "Quero cancelar uma assinatura feita na Google Play",
    a: "Assinaturas compradas dentro do aplicativo são gerenciadas pela Google: Play Store → foto do perfil → Pagamentos e assinaturas → Assinaturas. A compra feita aqui no site é pagamento único e não tem o que cancelar.",
  },
  {
    q: "Quero apagar minha conta e meus dados",
    a: "Dá pra fazer sozinho, sem falar com ninguém: pelo menu da conta dentro do app, ou pela página de exclusão de conta aqui do site.",
  },
  {
    q: "Encontrei um erro no app",
    a: "Escreva contando o que você estava fazendo quando aconteceu e qual aparelho usa. Se puder mandar um print, ajuda muito a achar o problema rápido.",
  },
];

export default function Suporte() {
  useEffect(() => { trackEvent("suporte_view", {}); }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" aria-label="Voltar para a página inicial">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-lg font-extrabold tracking-tight">CORE</span>
          <span className="text-lg text-muted-foreground">· Suporte</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-12">
        <section>
          <h1 className="text-[30px] md:text-[38px] font-extrabold leading-tight tracking-tight text-balance">
            Precisa de ajuda? Fala com a gente.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground max-w-[56ch]">
            Somos uma equipe pequena e respondemos todos os e-mails, um por um.
            Escreva contando o que aconteceu — quanto mais detalhe, mais rápido a gente resolve.
          </p>

          <div className="mt-8 rounded-2xl border-2 border-accent bg-card p-6 md:p-7">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 mt-1 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground">
                  E-mail de suporte
                </p>
                <a
                  href={`mailto:${EMPRESA.email}`}
                  onClick={() => trackEvent("suporte_email_click", {})}
                  className="mt-1 block text-[15.5px] sm:text-[19px] md:text-[22px] font-extrabold tracking-tight text-accent break-all hover:underline"
                >
                  {EMPRESA.email}
                </a>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2.5 border-t border-border pt-5 text-[14px] text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              Respondemos em {EMPRESA.prazoResposta}.
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-extrabold tracking-tight">Antes de escrever, veja se é isso</h2>
          <div className="mt-5 space-y-5">
            {AJUDA.map((i) => (
              <div key={i.q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-[15px] font-bold">{i.q}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{i.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-extrabold tracking-tight">Páginas úteis</h2>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {[
              { to: "/termos", t: "Termos de uso" },
              { to: "/privacidade", t: "Política de privacidade" },
              { to: "/excluir-conta", t: "Excluir minha conta" },
            ].map((l) => (
              <Link
                key={l.to} to={l.to}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-[14.5px] font-semibold transition-colors hover:border-accent hover:text-accent"
              >
                {l.t} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* Bloco da pessoa jurídica — é o que liga este domínio à empresa. */}
        <section>
          <h2 className="text-[22px] font-extrabold tracking-tight">Quem responde por este serviço</h2>
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-6 text-[14.5px] leading-relaxed">
            <p className="font-bold text-foreground">{EMPRESA.razaoSocial}</p>
            {EMPRESA.cnpj && <p className="mt-1 text-muted-foreground">CNPJ {EMPRESA.cnpj}</p>}
            {EMPRESA.endereco && <p className="text-muted-foreground">{EMPRESA.endereco}</p>}
            <p className="mt-3 text-muted-foreground">
              Contato:{" "}
              <a href={`mailto:${EMPRESA.email}`} className="font-semibold text-accent hover:underline">
                {EMPRESA.email}
              </a>
            </p>
            <p className="mt-3 text-muted-foreground">
              O CORE é um aplicativo de organização pessoal desenvolvido e operado por esta empresa.
            </p>
          </div>
        </section>
      </main>

      <RodapeSite />
    </div>
  );
}
