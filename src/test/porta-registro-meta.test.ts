/**
 * O CompleteRegistration da Porta sai uma vez por event_id: pixel e CAPI
 * juntos, e um segundo chamado (remontagem, efeito do OAuth) não repete.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));

import { fireMetaEvent } from "@/lib/meta-pixel";
import { _zerarRegistroMeta, codigoTesteDaPagina, dispararCompleteRegistration } from "@/pages/porta/registro-meta";

const ID = "porta_cr_abc12345";

beforeEach(() => {
  _zerarRegistroMeta();
  invoke.mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  window.history.replaceState({}, "", "/comece");
});

describe("dispararCompleteRegistration", () => {
  it("chama fbq via fireMetaEvent e a CAPI com o mesmo event_id, uma vez", () => {
    dispararCompleteRegistration({
      eventId: ID,
      fbp: "fb.1.1700000000000.123456",
      fbc: "fb.1.1700000000000.IwAR_abc",
      sourceUrl: "https://coreaplicativo.com.br/comece?utm_campaign=porta",
    });
    dispararCompleteRegistration({ eventId: ID });
    expect(fireMetaEvent).toHaveBeenCalledTimes(1);
    expect(fireMetaEvent).toHaveBeenCalledWith(
      "CompleteRegistration",
      { content_name: "porta_iphone", status: true },
      ID,
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("porta-capi", {
      body: {
        event_id: ID,
        fbp: "fb.1.1700000000000.123456",
        fbc: "fb.1.1700000000000.IwAR_abc",
        source_url: "https://coreaplicativo.com.br/comece?utm_campaign=porta",
      },
    });
  });

  it("sessionStorage segura o segundo disparo depois que a memória zera", () => {
    dispararCompleteRegistration({ eventId: ID });
    _zerarRegistroMeta();
    sessionStorage.setItem("porta-cr-disparado", ID);
    dispararCompleteRegistration({ eventId: ID });
    expect(fireMetaEvent).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("outro event_id (outra conta) dispara de novo", () => {
    dispararCompleteRegistration({ eventId: ID });
    dispararCompleteRegistration({ eventId: "porta_cr_outra-conta" });
    expect(fireMetaEvent).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("?meta_teste=TEST… vai no corpo da CAPI e não vaza um código inválido", () => {
    expect(codigoTesteDaPagina("?meta_teste=TEST98765")).toBe("TEST98765");
    expect(codigoTesteDaPagina("?meta_teste=nao")).toBeNull();
    window.history.replaceState({}, "", "/comece?meta_teste=TEST98765");
    dispararCompleteRegistration({ eventId: ID });
    expect(invoke).toHaveBeenCalledWith("porta-capi", expect.objectContaining({
      body: expect.objectContaining({ event_id: ID, test_event_code: "TEST98765" }),
    }));
  });
});
