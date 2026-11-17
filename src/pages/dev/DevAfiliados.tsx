import { useSearchParams } from "react-router-dom";
import { Filter, Megaphone, UserCircle, CreditCard, LayoutGrid, LifeBuoy, Handshake } from "lucide-react";
import { PainelAfiliadaVista } from "@/pages/Afiliado";
import { AdminAfiliadosVista, type AcoesAdminAfiliados } from "@/pages/admin/AdminAfiliados";
import { PAINEL_EXEMPLO, PAINEL_INDIQUE_EXEMPLO, type DadosAdminAfiliados } from "@/lib/afiliados";
import { PainelIndiqueVista } from "@/pages/IndiquePainel";
import { IndiqueRecuperarVista } from "@/pages/IndiqueRecuperar";
import { EntradaIndique } from "@/components/indique/EntradaIndique";
import { htmlVenda } from "../../../supabase/functions/_shared/email-venda";
import { blocoIndiqueEmail } from "../../../supabase/functions/_shared/indique";
import { useEffect } from "react";
import { Bell, Palette, Trophy as TrofeuIco, HelpCircle } from "lucide-react";
import { VoceE } from "@/components/home-nova/e/VoceE";
import { BarraVidro } from "@/components/home-nova/e/BarraVidro";
import { BalaoNaAbaVoce, BalaoNovoIndique, PontoNovoIndique } from "@/components/indique/AvisoNovoIndique";
import "@/components/home-nova/home-nova.css";
import "@/components/home-nova/e/home-e.css";

/**
 * 17/11 (subida) — as telas do "onde fica no app" com os componentes DE VERDADE (só os dados são de exemplo):
 *   subida-voce-e      a aba Você da Home nova (VoceE) com a linha "Indique e ganhe" + selo "Novo"
 *   subida-menu        o menu da sua inicial (Home clássica) com a linha + selo "Novo"
 *   subida-barra       a Home nova com o balão "Novo: Indique e ganhe" em cima da aba Você + o pontinho
 *   subida-avatar      a Home clássica com o balão preso à inicial + o pontinho
 */
function TelasSubida({ tela }: { tela: string }) {
  const nada = () => {};
  const secoes = [
    { id: "progresso", titulo: "Seu progresso", itens: [{ id: "conq", Icone: TrofeuIco, rotulo: "Conquistas", onClick: nada }] },
    { id: "app", titulo: "App", itens: [{ id: "lemb", Icone: Bell, rotulo: "Lembretes", onClick: nada }, { id: "apar", Icone: Palette, rotulo: "Aparência", onClick: nada }] },
    { id: "ajuda", titulo: "Ajuda", itens: [{ id: "ajuda", Icone: HelpCircle, rotulo: "Central de ajuda", onClick: nada }] },
  ];
  const presente = <div className="hn-card mt-3 overflow-hidden"><div className="min-h-[52px] flex items-center gap-3 px-4 text-sm font-medium"><span aria-hidden>🎁</span>Dar o CORE de presente</div></div>;
  if (tela === "subida-voce-e") return (
    <VoceE nome="Ana Souza" email="ana@exemplo.com" iniciais="AS" secoes={secoes} onConta={nada} onSair={nada} versao="1.0.28"
      aviso={presente} indique={<EntradaIndique estilo="e" ligadaTeste novoTeste />} />
  );
  if (tela === "subida-menu") return (
    <div className="min-h-screen bg-background p-4 space-y-4 max-w-[440px] mx-auto">
      <div className="mx-auto w-10 h-1.5 rounded-full bg-muted" aria-hidden />
      <ul className="bg-card rounded-2xl border border-border/70 divide-y divide-border/60 overflow-hidden">
        <li className="flex items-center gap-3.5 px-4 py-3.5"><span className="w-12 h-12 rounded-full grid place-items-center text-[15px] font-bold" style={{ background: "hsl(var(--fixo-tinta) / 0.08)" }}>AS</span><span><span className="block text-[17px] font-bold">Ana Souza</span><span className="block text-[13px] text-muted-foreground">ana@exemplo.com</span></span></li>
        <li className="px-4 py-3.5 text-sm">Minha assinatura · <span className="text-muted-foreground">Vitalício</span></li>
        <li className="px-4 py-3.5 text-sm">Conquistas</li>
      </ul>
      <EntradaIndique estilo="menu" ligadaTeste novoTeste />
      <ul className="bg-card rounded-2xl border border-border/70 divide-y divide-border/60 overflow-hidden text-sm">
        <li className="px-4 py-3.5">Aparência</li><li className="px-4 py-3.5">Lembretes</li><li className="px-4 py-3.5">Usar no computador</li>
      </ul>
    </div>
  );
  if (tela === "subida-barra") return (
    <div className="hn he min-h-dvh px-4 pt-4" data-suave="mais">
      <h1 className="text-[22px] font-bold">Boa tarde, Ana 👋</h1>
      <div className="hn-card mt-4 h-[210px] grid place-items-center text-muted-foreground text-sm">(o carrossel do dia)</div>
      <div className="hn-card mt-3 h-[150px] grid place-items-center text-muted-foreground text-sm">(pendências)</div>
      <div className="hn-card mt-3 h-[150px] grid place-items-center text-muted-foreground text-sm">(módulos)</div>
      <div className="hn he he-so-vars">
        <BarraVidro ativa="inicio" iniciais="AS" onIr={nada} onMais={nada} seloVoce={<PontoNovoIndique className="-top-0.5 -right-1" />} balaoVoce={<BalaoNaAbaVoce onToque={nada} />} />
      </div>
    </div>
  );
  if (tela === "subida-avatar") return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">☀️ Boa tarde, Ana 👋</h1>
        <span className="relative">
          <span className="relative block rounded-full p-[2px]" style={{ background: "linear-gradient(to bottom right, hsl(var(--fixo-tinta) / 0.7), hsl(var(--fixo-tinta) / 0.2))" }}>
            <span className="h-8 w-8 rounded-full border-2 border-background grid place-items-center text-[10px] font-bold" style={{ background: "hsl(var(--fixo-tinta) / 0.1)" }}>AS</span>
            <PontoNovoIndique className="top-0 right-0" />
          </span>
          <BalaoNovoIndique ponta="cima-direita" className="right-0 top-full mt-2.5" onToque={nada} />
        </span>
      </div>
      <div className="mt-5 rounded-2xl border border-border/60 bg-card h-[180px] grid place-items-center text-muted-foreground text-sm">(score do dia)</div>
      <div className="mt-3 rounded-2xl border border-border/60 bg-card h-[160px] grid place-items-center text-muted-foreground text-sm">(pendências)</div>
    </div>
  );
  return null;
}

/** a /indique já no "enviado" (pra foto): preenche e envia sozinha */
function IndiqueRecuperarAuto({ estilo }: { estilo: "bitepal" | "site" | "c" }) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const c = document.querySelector<HTMLInputElement>("[data-testid='recuperar-campo']");
      if (c) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; set?.call(c, "ana@exemplo.com"); c.dispatchEvent(new Event("input", { bubbles: true })); }
      window.setTimeout(() => document.querySelector<HTMLButtonElement>("[data-testid='recuperar-enviar']")?.click(), 50);
    }, 50);
    return () => window.clearTimeout(t);
  }, []);
  return <IndiqueRecuperarVista estilo={estilo} enviar={async () => "ok"} />;
}

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
  // 23/11: o painel do indique e ganhe da web (?tela=indique | indique-novo | indique-pix)
  const agoraFoto = new Date("2026-11-23T15:00:00Z");
  const semRede = async () => ({ ok: false as const, motivo: "rede" });
  const est = sp.get("estilo") === "site" ? "site" as const : sp.get("estilo") === "c" ? "c" as const : "bitepal" as const;
  // 17/11: onde a pessoa acha o convite depois — a página /indique, a linha do menu Você (site) e o bloco do e-mail de acesso
  // 17/11 (subida): onde fica no app e como ela aprende o caminho (prints subida-*.png)
  if (tela.startsWith("subida-")) return <TelasSubida tela={tela} />;
  if (tela === "indique-recuperar") return <IndiqueRecuperarVista estilo={est} enviar={async () => "ok"} />;
  if (tela === "indique-recuperar-enviado") return <IndiqueRecuperarAuto estilo={est} />;
  if (tela === "indique-entrada") return (
    <div className="min-h-screen bg-background p-4 space-y-3 max-w-[440px] mx-auto">
      <div className="text-[13px] font-bold text-muted-foreground px-1">Você</div>
      <section className="bg-card rounded-2xl border border-border/60 p-4"><div className="text-sm font-semibold">Ana Souza</div><div className="text-[12px] text-muted-foreground">CORE vitalício · ativo</div></section>
      <section className="bg-card rounded-2xl border border-border/60 overflow-hidden"><div className="min-h-[52px] flex items-center gap-3 px-4 text-sm font-medium"><span aria-hidden>🎁</span>Dar o CORE de presente</div></section>
      <EntradaIndique estilo="classico" ligadaTeste />
      <section className="bg-card rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">Seu progresso · Conquistas · Ajustes…</section>
    </div>
  );
  if (tela === "indique-email") return <div style={{ background: "#f4f2f5", minHeight: "100vh", padding: "16px 12px" }} dangerouslySetInnerHTML={{ __html: htmlVenda({ email: "ana@exemplo.com", nome: null, periodo: "lifetime", hoje: true, extra: blocoIndiqueEmail() }) }} />;
  if (tela === "indique") return <PainelIndiqueVista p={PAINEL_INDIQUE_EXEMPLO} salvarPix={semRede} agora={agoraFoto} estilo={est} />;
  // 1ª venda, ainda sem chave Pix (o caso mais comum logo depois de mandar o link)
  if (tela === "indique-sem-pix") return <PainelIndiqueVista p={{ ...PAINEL_INDIQUE_EXEMPLO, pix: { cadastrado: false, tipo: null, final: null }, usaram: 1, pagaram: 1, reembolsadas: 0, a_receber_cents: 3395, ja_recebido_cents: 0, proximo_pagamento: { dia: "2026-11-30", valor_cents: 0 }, linhas: [PAINEL_INDIQUE_EXEMPLO.linhas[0]] }} salvarPix={semRede} agora={agoraFoto} estilo={est} />;
  if (tela === "indique-novo") return <PainelIndiqueVista p={{ ...PAINEL_INDIQUE_EXEMPLO, pix: { cadastrado: false, tipo: null, final: null }, usaram: 0, pagaram: 0, reembolsadas: 0, a_receber_cents: 0, ja_recebido_cents: 0, proximo_pagamento: { dia: "2026-11-30", valor_cents: 0 }, linhas: [] }} salvarPix={semRede} agora={agoraFoto} estilo={est} />;
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
