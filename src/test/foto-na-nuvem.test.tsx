/**
 * FOTO DO PET VAI PRO STORAGE (30/09). A chave (`pet-list`, `pet-diary`) guarda só a
 * URL — nunca a foto em base64 (uma foto passa sozinha do limite de 50 KB de chave
 * pesada). Sem conta, avisa em vez de gravar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

const uploadMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/image-upload", () => ({ uploadImage: uploadMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { FotoNaNuvem } from "@/components/ui/foto-na-nuvem";

const URL_ASSINADA = "https://itoylenzvahbscgjgtqf.supabase.co/storage/v1/object/sign/dream-board/u/pet/1.webp?token=t";

const montar = (isGuest: boolean, onChange: (u: string) => void) => {
  const valor: UserDataContextType = { get: (_k, f) => f, set: () => {}, loaded: true, isGuest, fetchKey: async () => null };
  const Prov = ({ children }: { children: ReactNode }) => <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  return render(<Prov><FotoNaNuvem pasta="pet" value={undefined} onChange={onChange} onClear={() => {}} label="Pôr uma foto" /></Prov>);
};

const escolherArquivo = () => {
  const arquivo = new File([new Uint8Array([1, 2, 3])], "thor.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByTestId("foto-pet"), { target: { files: [arquivo] } });
  return arquivo;
};

beforeEach(() => { uploadMock.mockReset(); toastMock.error.mockClear(); });

describe("FotoNaNuvem (Pet)", () => {
  it("com conta: sobe pro bucket privado na pasta da pessoa e devolve só a URL (nada de base64 na chave)", async () => {
    uploadMock.mockResolvedValue(URL_ASSINADA);
    const onChange = vi.fn();
    montar(false, onChange);
    const arquivo = escolherArquivo();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(URL_ASSINADA));
    expect(uploadMock).toHaveBeenCalledWith("dream-board", arquivo, "pet");
    expect(String(onChange.mock.calls[0][0]).startsWith("data:")).toBe(false);
  });

  it("falhou o envio (sem internet): avisa e não grava nada", async () => {
    uploadMock.mockResolvedValue(null);
    const onChange = vi.fn();
    montar(false, onChange);
    escolherArquivo();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sem conta (convidado): avisa pra entrar, não sobe e não grava base64", async () => {
    const onChange = vi.fn();
    montar(true, onChange);
    escolherArquivo();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Pra guardar foto, entre na sua conta."));
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
