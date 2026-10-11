-- PORTA → APP JÁ LOGADO (10/10/2026).
--
-- A pessoa cria a conta no site (/comece) e baixa o app. Pra o app abrir JÁ
-- LOGADO (sem a welcome, sem digitar e-mail), a função `porta-handoff`:
--   · "criar"    (com o JWT da conta, chamado pelo site logo depois da conta):
--                gera um código de 10 caracteres, guarda SÓ o SHA-256 aqui,
--                vale 24 h e 1 uso; os anteriores não usados da mesma conta
--                são invalidados;
--   · "resgatar" (sem login, chamado pelo app): confere o hash, marca usado e
--                devolve o token_hash de um magic link (auth.admin.generateLink)
--                que o app troca por sessão com verifyOtp.
--
-- RLS ligada e SEM políticas: nada é legível nem gravável por anon/authenticated.
-- Só a service role (a função) mexe nestas tabelas.

CREATE TABLE IF NOT EXISTS public.porta_handoff (
  codigo_hash text PRIMARY KEY CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  -- quem gastou: 'app:<via>' no resgate, 'substituido' quando um código novo da
  -- mesma conta invalidou este
  usado_por text
);

CREATE INDEX IF NOT EXISTS porta_handoff_user_id_idx ON public.porta_handoff (user_id);

ALTER TABLE public.porta_handoff ENABLE ROW LEVEL SECURITY;

-- LIMITE CONTRA FORÇA BRUTA NO RESGATE: uma linha por resgate que FALHOU, por
-- IP (em hash — o IP cru não fica guardado). A função conta as da última hora
-- (teto 20) e apaga as com mais de 1 dia. Em tabela, e não em memória, porque a
-- edge function roda em várias instâncias que nascem e morrem a cada poucos
-- minutos: um contador em memória zera no cold start e não é visto pelas
-- outras instâncias.
CREATE TABLE IF NOT EXISTS public.porta_handoff_erros (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS porta_handoff_erros_ip_idx ON public.porta_handoff_erros (ip_hash, criado_em);

ALTER TABLE public.porta_handoff_erros ENABLE ROW LEVEL SECURITY;
