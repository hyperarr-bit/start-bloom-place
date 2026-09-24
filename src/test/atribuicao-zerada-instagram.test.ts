/**
 * ATRIBUIÇÃO QUE SOBREVIVE À ZERADA DO NAVEGADOR DO INSTAGRAM (25/09).
 *
 * Caso real (23/09 16:38, venda 07ac030a): o clique do anúncio chegou no
 * /inicio com campanha + fbclid (sessão 387844a9, 1 evento só); 5 s depois,
 * no toque em "Começar", o navegador do Instagram zerou sessionStorage,
 * localStorage e cookies com a página VIVA — o quiz, a demo, o cadastro e o
 * Pix seguiram na sessão 359931ff sem campanha. 13 das 26 vendas web "sem
 * sinal" de 20–24/09 eram isso (o fbclid do cookie do Pix batia com a
 * chegada do anúncio). Estes casos travam a rede de memória.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const inseridos = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
    from: () => ({
      insert: (linha: Record<string, unknown>) => { inseridos.push(linha); return { then: (f?: () => void) => f?.() }; },
    }),
  },
}));

const CAMPANHA = "120250474048320041";
const URL_DO_ANUNCIO = `/inicio?utm_source=ig&utm_medium=paid&utm_campaign=${CAMPANHA}&utm_content=120250474048310041&fbclid=IwCLIQUE123`;
const DEMO = "/preview/financas?funnel=1&tour=vida&from=dia14";

const irPara = (caminho: string) => window.history.replaceState({}, "", caminho);
const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const apagarCookies = () => {
  for (const c of document.cookie.split(";")) {
    const nome = c.split("=")[0].trim();
    if (nome) document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};
/** o que o navegador do Instagram faz: tudo some, a página continua viva */
const zeradaDoInstagram = () => { localStorage.clear(); sessionStorage.clear(); apagarCookies(); };
const ultimo = () => inseridos[inseridos.length - 1] as { session_id: string; event_data: Record<string, string> };

beforeEach(() => {
  vi.resetModules(); // cada teste = uma página nova (memória limpa)
  inseridos.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  apagarCookies();
  irPara("/");
});

describe("atribuição com o storage zerado pelo navegador do Instagram", () => {
  it("página viva: campanha e sessão da chegada continuam depois da zerada", async () => {
    irPara(URL_DO_ANUNCIO);
    const { captureLandingMeta, trackEvent } = await import("@/lib/analytics");
    captureLandingMeta();
    trackEvent("funnel_view", { step: "start" });
    await esvaziar();
    const chegada = ultimo();
    expect(chegada.event_data.utm_campaign).toBe(CAMPANHA);

    zeradaDoInstagram();
    irPara("/inicio"); // e a URL não ajuda: a recuperação vem da memória
    trackEvent("funnel_click", { cta: "start" });
    await esvaziar();
    const toque = ultimo();
    expect(toque.event_data.utm_campaign).toBe(CAMPANHA);
    expect(toque.event_data.fbclid).toBe("IwCLIQUE123");
    expect(toque.session_id).toBe(chegada.session_id);
    // re-semeou: a próxima página (a demo é navegação cheia) nasce com a campanha
    expect(JSON.parse(localStorage.getItem("core_utm") || "{}").utm_campaign).toBe(CAMPANHA);
    expect(sessionStorage.getItem("core_session_id")).toBe(chegada.session_id);
  });

  it("checkout do Pix recebe a campanha mesmo depois da zerada", async () => {
    irPara(URL_DO_ANUNCIO);
    const { captureLandingMeta, getAttributionParams } = await import("@/lib/analytics");
    captureLandingMeta();
    zeradaDoInstagram();
    expect(getAttributionParams()).toMatchObject({ utm_campaign: CAMPANHA, fbclid: "IwCLIQUE123", utm_medium: "paid" });
  });

  it("página NOVA depois da zerada (demo): a origem da conta vem do core_utm re-semeado, não da demo", async () => {
    // 1ª página: chegada + zerada + um evento (que re-semeia)
    irPara(URL_DO_ANUNCIO);
    const a = await import("@/lib/analytics");
    const ls1 = await import("@/lib/lead-source");
    ls1.captureLeadSource();
    a.captureLandingMeta();
    zeradaDoInstagram();
    a.trackEvent("funnel_view", { step: "quiz_1" });
    await esvaziar();

    // 2ª página: a demo abre com navegação cheia (memória nova, URL sem campanha)
    vi.resetModules();
    irPara(DEMO);
    const ls2 = await import("@/lib/lead-source");
    ls2.captureLeadSource();
    const origem = ls2.getLeadSource();
    expect(origem?.utm_campaign).toBe(CAMPANHA);
    expect(origem?.utm_medium).toBe("paid");
    expect(origem?.landing_path).toBe("/inicio");
  });

  it("origem da conta na mesma página: memória devolve e re-semeia", async () => {
    irPara(URL_DO_ANUNCIO);
    const ls = await import("@/lib/lead-source");
    ls.captureLeadSource();
    zeradaDoInstagram();
    expect(ls.getLeadSource()?.utm_campaign).toBe(CAMPANHA);
    expect(JSON.parse(localStorage.getItem("lead-source-v1") || "{}").utm_campaign).toBe(CAMPANHA);
  });

  it("sem memória nem storage, o _fbc RECENTE liga a sessão ao clique (e marca de onde veio)", async () => {
    document.cookie = `_fbc=fb.1.${Date.now()}.IwRECENTE; path=/`;
    irPara("/inicio");
    const { trackEvent } = await import("@/lib/analytics");
    trackEvent("funnel_click", { cta: "start" });
    await esvaziar();
    expect(ultimo().event_data.fbclid).toBe("IwRECENTE");
    expect(ultimo().event_data.atribuicao).toBe("cookie_fbc");
  });

  it("_fbc velho (mais de 7 dias) não carimba a visita de hoje", async () => {
    document.cookie = `_fbc=fb.1.${Date.now() - 10 * 86_400_000}.IwVELHO; path=/`;
    irPara("/inicio");
    const { trackEvent } = await import("@/lib/analytics");
    trackEvent("funnel_view", { step: "start" });
    await esvaziar();
    expect(ultimo().event_data.fbclid).toBeUndefined();
  });

  it("visita sem anúncio continua sem campanha — a rede não inventa origem", async () => {
    irPara("/inicio");
    const { captureLandingMeta, trackEvent } = await import("@/lib/analytics");
    captureLandingMeta();
    zeradaDoInstagram();
    trackEvent("funnel_view", { step: "start" });
    await esvaziar();
    expect(ultimo().event_data.utm_campaign).toBeFalsy();
    expect(ultimo().event_data.fbclid).toBeFalsy();
  });

  it("campanha nova na URL vence a da memória (outro anúncio clicado depois)", async () => {
    irPara(URL_DO_ANUNCIO);
    const { captureLandingMeta, getAttributionParams } = await import("@/lib/analytics");
    captureLandingMeta();
    irPara("/inicio?utm_source=ig&utm_medium=paid&utm_campaign=120250539852290041&fbclid=IwOUTRO");
    captureLandingMeta();
    zeradaDoInstagram();
    expect(getAttributionParams().utm_campaign).toBe("120250539852290041");
  });
});
