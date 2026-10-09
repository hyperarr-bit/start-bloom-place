import { useSearchParams } from "react-router-dom";
import { Filter, Megaphone, UserCircle, CreditCard, LayoutGrid, LifeBuoy, Handshake } from "lucide-react";
import { PainelAfiliadaVista } from "@/pages/Afiliado";
import { AdminAfiliadosVista, type AcoesAdminAfiliados } from "@/pages/admin/AdminAfiliados";
import { PAINEL_EXEMPLO, type DadosAdminAfiliados } from "@/lib/afiliados";

/**
 * /dev/afiliados — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota
 * dentro de `import.meta.env.DEV`; some do build). As telas do programa de
 * afiliados com dados de exemplo, pra fotografar antes de subir:
 *   ?tela=painel (padrão) | admin | admin-criar | admin-detalhe
 * Nada aqui fala com o banco: é a Vista pura + dados inventados.
 */

const DADOS: DadosAdminAfiliados = {
  proxima_segunda: "2026-10-12",
  afiliados: [
    { id: "a1", nome: "Beatriz Souza", codigo: "BIA", email: "bia@exemplo.com", pix_chave: "***4421", pix_tipo: "CPF", token_painel: "x".repeat(43), limite_semanal_cents: 50000, pausado: false, criado_em: "2026-09-20T12:00:00Z", link_painel: "/afiliado/" + "x".repeat(43), link_resgate: "https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=BIA" },
    { id: "a2", nome: "Carla Mendes", codigo: "CARLA", email: null, pix_chave: "***7788", pix_tipo: "PHONE", token_painel: "y".repeat(43), limite_semanal_cents: 30000, pausado: false, criado_em: "2026-10-01T12:00:00Z", link_painel: "/afiliado/" + "y".repeat(43), link_resgate: "https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=CARLA" },
    { id: "a3", nome: "Duda Lima", codigo: "DUDA", email: "duda@exemplo.com", pix_chave: "***a9f2", pix_tipo: "EVP", token_painel: "z".repeat(43), limite_semanal_cents: 50000, pausado: true, criado_em: "2026-10-05T12:00:00Z", link_painel: "/afiliado/" + "z".repeat(43), link_resgate: "https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=DUDA" },
  ],
  vendas: [
    { id: "v1", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: null, valor_liquido_cents: null, comissao_cents: 0, status: "em_teste", motivo: null, cobrado_em: null, pagamento_id: null, criado_em: "2026-10-08T15:10:00Z" },
    { id: "v2", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago", motivo: null, cobrado_em: "2026-10-07T11:00:00Z", pagamento_id: null, criado_em: "2026-09-30T11:00:00Z" },
    { id: "v3", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago", motivo: null, cobrado_em: "2026-10-05T09:30:00Z", pagamento_id: null, criado_em: "2026-09-28T09:30:00Z" },
    { id: "v4", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: null, valor_liquido_cents: null, comissao_cents: 0, status: "recusado", motivo: "cartao_recusado", cobrado_em: null, pagamento_id: null, criado_em: "2026-09-27T18:00:00Z" },
    { id: "v5", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "reembolsado", motivo: "reembolso", cobrado_em: "2026-09-29T10:00:00Z", pagamento_id: null, criado_em: "2026-09-22T10:00:00Z" },
    { id: "v6", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago", motivo: null, cobrado_em: "2026-09-28T10:00:00Z", pagamento_id: "p1", criado_em: "2026-09-21T10:00:00Z" },
    { id: "v7", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago", motivo: null, cobrado_em: "2026-09-27T10:00:00Z", pagamento_id: "p1", criado_em: "2026-09-20T10:00:00Z" },
    { id: "v8", afiliado_id: "a2", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago", motivo: null, cobrado_em: "2026-09-30T10:00:00Z", pagamento_id: "p2", criado_em: "2026-09-23T10:00:00Z" },
    ...Array.from({ length: 9 }, (_, i) => ({ id: `v9${i}`, afiliado_id: "a2", plataforma: "ios" as const, produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago" as const, motivo: null, cobrado_em: `2026-09-${String(24 + (i % 5)).padStart(2, "0")}T10:00:00Z`, pagamento_id: "p2", criado_em: `2026-09-${String(17 + (i % 5)).padStart(2, "0")}T10:00:00Z` })),
    { id: "v10", afiliado_id: "a3", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: null, valor_liquido_cents: null, comissao_cents: 0, status: "em_teste", motivo: null, cobrado_em: null, pagamento_id: null, criado_em: "2026-10-08T09:00:00Z" },
  ],
  pagamentos: [
    { id: "p1", afiliado_id: "a1", valor_cents: 8030, asaas_transfer_id: "tra_000000000001", asaas_status: "DONE", status: "enviado", motivo: null, erro: null, vendas_ids: ["v6", "v7"], semana: "2026-10-06", criado_em: "2026-10-06T12:00:00Z" },
    { id: "p2", afiliado_id: "a2", valor_cents: 40150, asaas_transfer_id: null, asaas_status: null, status: "segurado", motivo: "acima_do_limite_30000", erro: null, vendas_ids: ["v8", "v90", "v91", "v92", "v93", "v94", "v95", "v96", "v97", "v98"], semana: "2026-10-06", criado_em: "2026-10-06T12:00:00Z" },
  ],
};

const nada: AcoesAdminAfiliados = {
  recarregar: async () => {},
  criar: async () => null,
  pausar: async () => null,
  liberar: async () => null,
  novoToken: async () => null,
  previaSemana: async () => [{ codigo: "BIA", valor_cents: 4015, vendas: 1, decisao: "pagar" }, { codigo: "CARLA", valor_cents: 40150, vendas: 10, decisao: "segurar" }],
};

const NAV = [
  { label: "Funil", Icon: Filter }, { label: "Campanhas", Icon: Megaphone }, { label: "Usuários", Icon: UserCircle },
  { label: "Pagantes", Icon: CreditCard }, { label: "Uso do app", Icon: LayoutGrid }, { label: "Suporte", Icon: LifeBuoy }, { label: "Afiliados", Icon: Handshake, ativo: true },
];

/** Casca do /admin (mesmas classes do AdminLayout) sem o login — só pra foto. */
function CascaAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 md:min-h-screen md:border-r border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground grid place-items-center text-[13px] font-extrabold tracking-tight">C</div>
          <div className="leading-none"><div className="text-[13px] font-bold tracking-tight">CORE</div><div className="text-[10px] text-muted-foreground">Admin</div></div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1">
          {NAV.map(({ label, Icon, ativo }) => (
            <span key={label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap ${ativo ? "bg-accent/10 text-accent" : "text-muted-foreground"}`}><Icon className="w-4 h-4" />{label}</span>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export default function DevAfiliados() {
  const [sp] = useSearchParams();
  const tela = sp.get("tela") ?? "painel";
  if (tela === "painel") return <PainelAfiliadaVista p={PAINEL_EXEMPLO} />;
  if (tela === "painel-vazio") return <PainelAfiliadaVista p={{ ...PAINEL_EXEMPLO, nome: "Duda", codigo: "DUDA", usaram: 0, em_teste: 0, pagaram: 0, reembolsadas: 0, nao_pagaram: 0, a_receber_cents: 0, ja_recebido_cents: 0, proximo_pagamento: { dia: "2026-10-12", valor_cents: 0 }, linhas: [] }} />;
  return (
    <CascaAdmin>
      <AdminAfiliadosVista
        dados={DADOS}
        loading={false}
        erro={null}
        acoes={nada}
        abrirFormInicial={tela === "admin-criar"}
        selecionadoInicial={tela === "admin-detalhe" ? "a1" : tela === "admin-segurado" ? "a2" : null}
      />
    </CascaAdmin>
  );
}
