import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { EMPRESA } from "@/lib/empresa";
import { ehApple } from "@/lib/loja";
import { RodapeSite } from "@/components/site/RodapeSite";

/**
 * PÁGINAS LEGAIS (24/07) — nasceram por exigência de loja, não por enfeite:
 *  - /privacidade: o Play Console pede a URL da política e ela precisa estar
 *    no ar ANTES da revisão (é o campo que mais reprova ficha de app novo).
 *  - /excluir-conta: app com login precisa de URL pública explicando como
 *    apagar conta e dados (a exclusão in-app vive no menu da conta).
 *  - /termos: assinatura com renovação automática precisa de termo dizendo
 *    preço, renovação e cancelamento — e o disclaimer de que finanças/saúde
 *    aqui são organização pessoal, não consultoria nem diagnóstico.
 *
 * Rotas PÚBLICAS de propósito: o revisor do Google abre sem conta.
 */

const ATUALIZADO = "24 de julho de 2026";
const CONTATO = EMPRESA.email;

function LegalShell({ titulo, children }: { titulo: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{titulo}</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-8 pb-16">
        <p className="text-xs text-muted-foreground mb-4">Atualizado em {ATUALIZADO}</p>
        {/* Identificação da operadora (24/08): a Apple recusou a inscrição da
            empresa por não conseguir ligar o domínio à pessoa jurídica. Os
            textos legais são justamente onde isso tem que estar explícito. */}
        <div className="mb-7 rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            O CORE é operado por <span className="font-semibold text-foreground">{EMPRESA.razaoSocial}</span>
            {EMPRESA.cnpj && <>, inscrita no CNPJ sob o nº {EMPRESA.cnpj}</>}
            {EMPRESA.endereco && <>, com sede em {EMPRESA.endereco}</>}.
          </p>
          <p className="mt-1">
            Contato:{" "}
            <a href={`mailto:${CONTATO}`} className="font-semibold text-accent hover:underline">{CONTATO}</a>
          </p>
        </div>
        <div className="space-y-6 text-[15px] leading-relaxed text-foreground/90">{children}</div>
      </main>
      <RodapeSite />
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

const Lista = ({ itens }: { itens: string[] }) => (
  <ul className="space-y-1.5 pl-4 list-disc marker:text-muted-foreground">
    {itens.map((i) => <li key={i}>{i}</li>)}
  </ul>
);

export function Privacidade() {
  useEffect(() => { trackEvent("legal_view", { pagina: "privacidade" }); }, []);
  return (
    <LegalShell titulo="Política de Privacidade">
      <p>
        O CORE é um aplicativo de organização pessoal. Esta política explica quais dados
        coletamos, por que coletamos e o que você pode fazer com eles. Escrevemos em
        português claro de propósito.
      </p>

      <Secao titulo="1. Dados que coletamos">
        <Lista itens={[
          "Dados de conta: e-mail e nome que você informa ao se cadastrar.",
          "Conteúdo que você registra: lançamentos financeiros, hábitos, rotina, treinos, refeições, metas, anotações e demais informações dos módulos que você usa. Alguns desses dados são sensíveis (por exemplo, saúde) e por isso ficam vinculados só à sua conta.",
          "Dados de uso: telas abertas, ações no app, data e hora, tipo de aparelho, versão do app e identificadores técnicos — usados para entender o que funciona e corrigir erros.",
          "Dados de compra: status da sua assinatura ou pagamento. Nunca recebemos nem armazenamos número de cartão.",
        ]} />
      </Secao>

      <Secao titulo="2. Por que usamos esses dados">
        <Lista itens={[
          "Fazer o app funcionar: guardar o que você registra e sincronizar entre aparelhos.",
          "Manter sua conta e liberar o acesso que você contratou.",
          "Melhorar o produto: entender quais partes ajudam e quais atrapalham.",
          "Falar com você sobre a sua conta, sua assinatura e novidades do app.",
          "Cumprir obrigações legais e prevenir fraude e abuso.",
        ]} />
        <p className="text-sm text-muted-foreground">
          Bases legais (LGPD): execução do contrato, consentimento (dados sensíveis e
          comunicações de marketing), legítimo interesse (segurança e melhoria) e
          cumprimento de obrigação legal.
        </p>
      </Secao>

      <Secao titulo="3. Com quem compartilhamos">
        <p>Não vendemos seus dados. Compartilhamos apenas com quem é necessário para o app existir:</p>
        <Lista itens={[
          "Supabase — hospedagem do banco de dados e autenticação.",
          ehApple()
            ? "App Store e RevenueCat — processamento e validação de assinaturas no aplicativo iOS."
            : "Google Play e RevenueCat — processamento e validação de assinaturas no aplicativo Android.",
          "Provedores de pagamento — apenas quando a compra é feita fora da loja de aplicativos.",
          "Ferramentas de medição e publicidade (Meta, TikTok, Google) — recebem eventos de uso e identificadores para medir campanhas. Não enviamos a elas o conteúdo que você registra nos módulos.",
          "Autoridades, quando houver obrigação legal.",
        ]} />
      </Secao>

      <Secao titulo="4. Por quanto tempo guardamos">
        <p>
          Mantemos seus dados enquanto sua conta existir. Se você excluir a conta, apagamos
          seu conteúdo e seus dados pessoais dos nossos sistemas, salvo registros que a lei
          exija guardar (por exemplo, dados fiscais de uma compra).
        </p>
      </Secao>

      <Secao titulo="5. Excluir sua conta e seus dados">
        <p>
          Você pode apagar tudo sozinho, a qualquer momento: no app, abra o menu →{" "}
          <b>Minha conta</b> → <b>Excluir minha conta</b>. O passo a passo completo está em{" "}
          <a href="/excluir-conta" className="text-primary underline underline-offset-2">
            coreaplicativo.com.br/excluir-conta
          </a>.
        </p>
      </Secao>

      <Secao titulo="6. Seus direitos">
        <p>
          Pela LGPD você pode confirmar se tratamos seus dados, acessá-los, corrigi-los,
          pedir a exclusão, revogar consentimento e pedir portabilidade. Escreva para{" "}
          <a href={`mailto:${CONTATO}`} className="text-primary underline underline-offset-2">{CONTATO}</a>{" "}
          e respondemos em até 15 dias.
        </p>
      </Secao>

      <Secao titulo="7. Segurança">
        <p>
          Os dados trafegam criptografados (HTTPS) e ficam em bancos com controle de acesso
          por usuário — cada conta só enxerga o que é dela. Nenhum sistema é 100% imune, mas
          tratamos incidente de segurança com seriedade e comunicamos quando a lei exigir.
        </p>
      </Secao>

      <Secao titulo="8. Crianças">
        <p>
          O CORE é feito para maiores de 18 anos e não é direcionado a crianças. Se
          descobrirmos uma conta de menor de idade sem autorização dos responsáveis, ela
          será removida.
        </p>
      </Secao>

      <Secao titulo="9. Mudanças nesta política">
        <p>
          Se algo mudar de forma relevante, avisamos no app ou por e-mail antes de valer.
          Dúvidas: <a href={`mailto:${CONTATO}`} className="text-primary underline underline-offset-2">{CONTATO}</a>.
        </p>
      </Secao>
    </LegalShell>
  );
}

export function Termos() {
  useEffect(() => { trackEvent("legal_view", { pagina: "termos" }); }, []);
  return (
    <LegalShell titulo="Termos de Uso">
      <p>
        Ao criar uma conta no CORE você concorda com estes termos. Eles valem para o site e
        para o aplicativo.
      </p>

      <Secao titulo="1. O que o CORE é (e o que não é)">
        <p>
          O CORE é uma ferramenta de <b>organização pessoal</b>: você registra sua vida
          financeira, sua rotina, seus treinos e suas metas, e o app te ajuda a acompanhar.
          Ele <b>não</b> é consultoria financeira, recomendação de investimento, tratamento
          médico ou orientação nutricional. As decisões continuam sendo suas — para
          escolhas de dinheiro ou saúde, procure um profissional habilitado.
        </p>
      </Secao>

      <Secao titulo="2. Sua conta">
        <p>
          Você precisa ter 18 anos ou mais, informar dados verdadeiros e cuidar da sua
          senha. O que acontece na sua conta é responsabilidade sua.
        </p>
      </Secao>

      <Secao titulo="3. Assinatura no aplicativo">
        <Lista itens={[
          ehApple()
            ? "As assinaturas contratadas dentro do app iOS são processadas pela App Store."
            : "As assinaturas contratadas dentro do app Android são processadas pelo Google Play.",
          "O preço total e o período aparecem na tela de compra antes de você confirmar.",
          "Quando há período grátis, a cobrança só acontece se você não cancelar antes do fim dele.",
          "A assinatura renova automaticamente até você cancelar.",
          ehApple()
            ? "O cancelamento é feito em Ajustes → sua conta Apple → Assinaturas, a qualquer momento, e vale ao fim do período já pago."
            : "O cancelamento é feito na Play Store (Assinaturas), a qualquer momento, e vale ao fim do período já pago.",
        ]} />
      </Secao>

      {/* Sem "site"/"Pix" de propósito: o termo é lido DENTRO do app, e citar
          o caminho de compra externo é exatamente o que o Play proíbe. A
          cláusula segue verdadeira pra quem comprou por fora. */}
      <Secao titulo="4. Compras contratadas fora da loja de aplicativos">
        <p>
          Compras feitas fora da loja seguem as condições apresentadas no momento da
          contratação e liberam o acesso na mesma conta. Nesses casos você tem 7 dias de
          garantia: se não servir, escreva para{" "}
          <a href={`mailto:${CONTATO}`} className="text-primary underline underline-offset-2">{CONTATO}</a>{" "}
          e devolvemos o valor.
        </p>
      </Secao>

      <Secao titulo="5. Uso aceitável">
        <p>
          Não é permitido tentar invadir, copiar ou revender o CORE, usar o app para
          atividade ilegal, nem sobrecarregar nossos sistemas de propósito. Contas que
          fizerem isso podem ser encerradas.
        </p>
      </Secao>

      <Secao titulo="6. Disponibilidade e limites">
        <p>
          Trabalhamos para manter o CORE no ar e seus dados seguros, mas o serviço é
          fornecido "como está". Não respondemos por prejuízos indiretos decorrentes de
          decisões que você tomar usando o app. Nada aqui afasta os direitos que o Código de
          Defesa do Consumidor te garante.
        </p>
      </Secao>

      <Secao titulo="7. Encerramento">
        <p>
          Você pode encerrar sua conta quando quiser em{" "}
          <a href="/excluir-conta" className="text-primary underline underline-offset-2">/excluir-conta</a>.
          Podemos encerrar contas que violem estes termos.
        </p>
      </Secao>

      <Secao titulo="8. Lei aplicável">
        <p>
          Estes termos são regidos pela lei brasileira, no foro do domicílio do consumidor.
          Dúvidas: <a href={`mailto:${CONTATO}`} className="text-primary underline underline-offset-2">{CONTATO}</a>.
        </p>
      </Secao>
    </LegalShell>
  );
}

export function ExcluirConta() {
  useEffect(() => { trackEvent("legal_view", { pagina: "excluir-conta" }); }, []);
  return (
    <LegalShell titulo="Excluir sua conta">
      <p>
        Você pode apagar sua conta do CORE e todos os dados dela quando quiser. São dois
        caminhos, e os dois apagam a mesma coisa.
      </p>

      <Secao titulo="Pelo app (mais rápido)">
        <Lista itens={[
          "Abra o CORE e entre na sua conta.",
          "Toque no seu avatar, no canto superior, para abrir o menu.",
          "Toque em \"Minha conta\".",
          "Role até o fim e toque em \"Excluir minha conta\".",
          "Digite EXCLUIR para confirmar. Pronto — a exclusão é imediata.",
        ]} />
      </Secao>

      <Secao titulo="Por e-mail">
        <p>
          Escreva para{" "}
          <a href={`mailto:${CONTATO}`} className="text-primary underline underline-offset-2">{CONTATO}</a>{" "}
          do endereço cadastrado, pedindo a exclusão. Confirmamos sua identidade e apagamos
          em até 7 dias.
        </p>
      </Secao>

      <Secao titulo="O que é apagado">
        <p>
          Tudo que é seu: cadastro (e-mail e nome), lançamentos financeiros, rotina,
          hábitos, treinos, refeições, metas, anotações, conquistas e histórico de uso.
          A exclusão é <b>definitiva</b> — não há como recuperar depois.
        </p>
      </Secao>

      <Secao titulo="O que pode ficar">
        <p>
          Registros de compra que a lei obriga a guardar (nota fiscal e dados fiscais) ficam
          pelo prazo legal, desvinculados do seu uso do app.
        </p>
      </Secao>

      <Secao titulo="Atenção: assinatura">
        {ehApple() ? (
          <p>
            Se você assina pela App Store, <b>cancele também na Apple</b> (Ajustes → sua
            conta Apple → Assinaturas). Excluir a conta aqui não interrompe a
            cobrança da loja.
          </p>
        ) : (
          <p>
            Se você assina pelo Google Play, <b>cancele também na Play Store</b> (Menu →
            Pagamentos e assinaturas → Assinaturas). Excluir a conta aqui não interrompe a
            cobrança da loja.
          </p>
        )}
      </Secao>
    </LegalShell>
  );
}
