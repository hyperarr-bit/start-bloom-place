-- RESPOSTA AO CHAMADO (22/09). Até aqui o "Responder" do /admin abria o
-- e-mail do dono (mailto) e a resposta não ficava registrada em lugar nenhum:
-- o painel não sabia o que já tinha sido respondido, nem o quê. Agora a
-- resposta sai pelo servidor (admin-suporte → Resend) e fica no chamado.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resposta text,
  ADD COLUMN IF NOT EXISTS respondido_em timestamptz;
