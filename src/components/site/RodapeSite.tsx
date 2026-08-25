import { Link } from "react-router-dom";
import { EMPRESA, assinaturaEmpresa } from "@/lib/empresa";

/**
 * Rodapé institucional — vive em TODA página pública da web (home, suporte,
 * termos, privacidade, excluir conta).
 *
 * É o pedaço que liga o domínio à pessoa jurídica da inscrição da Apple. Sem
 * ele o revisor abre coreaplicativo.com.br e não tem como saber de quem é o
 * site — foi exatamente essa a recusa de 24/08. Ver src/lib/empresa.ts.
 */
export const RodapeSite = () => (
  <footer className="border-t border-border bg-muted/30">
    <div className="max-w-5xl mx-auto px-5 py-10 space-y-7">
      <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link to="/suporte" className="text-foreground/80 hover:text-accent transition-colors">
          Suporte
        </Link>
        <Link to="/termos" className="text-foreground/80 hover:text-accent transition-colors">
          Termos de uso
        </Link>
        <Link to="/privacidade" className="text-foreground/80 hover:text-accent transition-colors">
          Política de privacidade
        </Link>
        <Link to="/excluir-conta" className="text-foreground/80 hover:text-accent transition-colors">
          Excluir conta
        </Link>
        <a
          href={`mailto:${EMPRESA.email}`}
          className="text-foreground/80 hover:text-accent transition-colors"
        >
          {EMPRESA.email}
        </a>
      </nav>

      <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <p>{assinaturaEmpresa()}</p>
        {EMPRESA.endereco && <p>{EMPRESA.endereco}</p>}
        <p>© {new Date().getFullYear()} — todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);
