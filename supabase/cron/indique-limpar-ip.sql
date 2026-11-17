-- INDIQUE E GANHE (críticas da subida 17/11, LGPD) — NÃO ATIVADO.
-- A política (/privacidade#indique) diz que o IP e o identificador do aparelho de quem indica são apagados em até 12 meses.
-- Este job faz isso todo dia 1 às 4h (horário do servidor, UTC). A chave Pix, o e-mail e os registros das comissões ficam
-- (5 anos, parte fiscal). A digital do cartão (cartao_fp) também sai em 12 meses: depois disso não serve mais pra trava.
--
-- Ativar (uma vez, pelo SQL Editor do Supabase), DEPOIS da migração 20261123120000:
select cron.schedule(
  'indique-limpar-ip',
  '0 4 1 * *',
  $$
    update public.afiliados
       set ip = null, aparelho = null, cartao_fp = null
     where origem = 'comprador'
       and criado_em < now() - interval '12 months'
       and (ip is not null or aparelho is not null or cartao_fp is not null);
  $$
);
-- Desfazer: select cron.unschedule('indique-limpar-ip');
