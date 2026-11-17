import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@/Presentation/Components/AuthProvider", () => ({
  useAuth: () => ({ error: null, user: null, loading: false, login: authenticate }),
}));

function renderLogin() {
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

beforeEach(() => {
  authenticate.mockReset().mockResolvedValue(undefined);
});

describe("LoginPage", () => {
  it("toggles password visibility without changing the value or submitting", () => {
    renderLogin();
    const password = screen.getByLabelText("Contraseña");
    fireEvent.change(password, { target: { value: "example-password" } });
    expect(password).toHaveAttribute("type", "password");
    const show = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(show).toHaveAttribute("type", "button");
    fireEvent.click(show);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("example-password");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("example-password");
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("hides the decorative panel below the desktop breakpoint and gives the form full viewport height", () => {
    renderLogin();
    const artworkPanel = screen.getByRole("heading", { name: "El territorio, claro y conectado." }).closest("section");
    expect(artworkPanel).toHaveClass("hidden", "lg:flex");
    const formPanel = screen.getByRole("heading", { name: "Ingresá a tu espacio" }).closest("section");
    expect(formPanel).toHaveClass("min-h-[100dvh]");
  });

  it("submits the same credentials and remember preference when password is visible", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "pedro" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "example-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mantener sesión iniciada" }));
    fireEvent.click(screen.getByRole("button", { name: "Ingresar al sistema →" }));
    await waitFor(() => expect(authenticate).toHaveBeenCalledWith("pedro", "example-password", true));
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
});
