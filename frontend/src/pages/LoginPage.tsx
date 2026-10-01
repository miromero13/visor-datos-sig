import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/AuthProvider";

export function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const { error, user, loading, login: authenticate } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await authenticate(login, password, rememberMe);
      const returnTo = searchParams.get("returnTo");
      const destination = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && returnTo !== "/sources" && !returnTo.startsWith("/sources/") ? returnTo : "/dashboard";
      navigate(destination, { replace: true });
    } catch {
      /* Generic error is exposed by AuthProvider. */
    } finally {
      setPending(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="p-8 text-center text-sm text-[#58698a]">
        Verificando sesión…
      </p>
    );
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="min-h-[100dvh] bg-[#F8FAFC] lg:grid lg:grid-cols-[670px_minmax(0,1fr)]">
      <section className="flex min-h-[560px] flex-col justify-between bg-[#0F172A] px-8 py-10 text-white sm:px-12 lg:min-h-[100dvh] lg:px-16 lg:py-[70px]">
        <div>
          <Brand light />
          <p className="mt-8 text-[11px] font-semibold tracking-[.18em] text-sky-300">PLATAFORMA DE GESTIÓN GEOGRÁFICA</p>
          <h1 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-[40px]">El territorio, claro y conectado.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">Explorá capas oficiales, consultá información geográfica y gestioná los datos de tu municipio desde un solo lugar.</p>
          <div aria-hidden="true" className="relative mt-8 h-[300px] max-w-[542px] overflow-hidden rounded-xl border border-slate-700/70 bg-[#111f38]">
            <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(32deg, transparent 48%, #36516b 49%, #36516b 50%, transparent 51%), linear-gradient(148deg, transparent 48%, #36516b 49%, #36516b 50%, transparent 51%), linear-gradient(90deg, transparent 48%, #263e59 49%, #263e59 50%, transparent 51%)", backgroundSize: "100px 78px, 120px 95px, 110px 100%" }} />
            <div className="absolute left-[18%] top-[20%] h-[52%] w-[29%] rotate-[-14deg] border border-sky-400/70 bg-sky-400/10" />
            <div className="absolute left-[47%] top-[29%] h-[42%] w-[33%] rotate-[12deg] border border-emerald-300/60 bg-emerald-300/10" />
            <div className="absolute left-[42%] top-[55%] size-3 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_18px_5px_rgba(56,189,248,.55)]" />
          </div>
        </div>
        <p className="mt-7 text-[10px] font-medium tracking-[.16em] text-slate-400">INFORMACIÓN OFICIAL · ACCESO SEGURO</p>
      </section>
      <section className="flex min-h-[calc(100dvh-560px)] flex-col items-center justify-center px-5 py-10 sm:px-10 lg:min-h-[100dvh] lg:px-8">
        <Card className="block w-full max-w-[470px] rounded-[18px] border border-[#E2E8F0] bg-white p-7 shadow-none sm:p-10" data-testid="login-panel">
          <p className="mb-2 text-xs font-semibold tracking-wide text-[#2563EB]">Bienvenida</p>
          <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Ingresá a tu espacio</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Usá tus credenciales institucionales para continuar.</p>
          <form className="mt-7 grid gap-3" onSubmit={submit}>
            <label className="text-sm font-medium text-slate-700" htmlFor="login">
              Usuario
            </label>
            <div className="relative">
              <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ◉
              </span>
              <Input className="h-11 w-full rounded-md border-[#CBD5E1] bg-white pl-9 text-[#253b5b]" id="login" name="login" autoComplete="username" placeholder="Nombre de usuario" value={login} onChange={(event) => setLogin(event.target.value)} required aria-describedby={error ? "login-error" : undefined} />
            </div>
            <label className="mt-2 text-sm font-medium text-slate-700" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▣
              </span>
              <Input className="h-11 w-full rounded-md border-[#CBD5E1] bg-white pl-9 text-[#253b5b]" id="password" name="password" type="password" autoComplete="current-password" placeholder="Ingresá tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} required aria-describedby={error ? "login-error" : undefined} />
            </div>
            <label className="mt-1 flex min-h-10 items-center gap-2 text-sm text-slate-600">
              <input className="accent-blue-600" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              Mantener sesión iniciada
            </label>
            {error && (
              <p id="login-error" role="alert" className="text-sm text-red-700">
                No pudimos validar tus credenciales.
              </p>
            )}
            <Button className="mt-2 min-h-[46px] w-full bg-[#2563EB] text-sm font-semibold text-white hover:bg-blue-700" type="submit" disabled={pending}>
              {pending ? "Ingresando…" : "Ingresar al sistema →"}
            </Button>
          </form>
          <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">¿No podés ingresar? Contactá al administrador del sistema.</p>
        </Card>
        <p className="mt-7 text-center text-xs text-slate-400">© 2026 · Sistema de Información Geográfica</p>
      </section>
    </main>
  );
}
