-- CREATE OR REPLACE FUNCTION zera os SET da função (26/08).
-- A migração anterior reescreveu admin_acquisition_funnel pra uma passada só e
-- levou junto o statement_timeout de 30s que tinha sido posto minutos antes —
-- a função voltou a morrer no corte padrão de 8s do PostgREST. Este arquivo
-- existe só pra devolver o teto. Se alguém reescrever a função de novo, tem
-- que repetir isto.
ALTER FUNCTION public.admin_acquisition_funnel(timestamptz, timestamptz, text)
  SET statement_timeout = '30s';
