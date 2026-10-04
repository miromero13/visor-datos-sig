import { useState, type FormEvent } from "react";
import { LockKeyhole, UserRound } from "lucide-react";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { Button } from "@/Presentation/Components/ui/button";
import { Card } from "@/Presentation/Components/ui/card";
import { Input } from "@/Presentation/Components/ui/input";
import { useAuth } from "@/Presentation/Components/AuthProvider";

export function ProfilePage() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== repeatPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setMessage("Tu contraseña se cambió correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar la contraseña.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthenticatedLayout activeItem="Inicio">
      <main className="min-w-0 flex-1 p-5 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-blue-600">MI CUENTA</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Perfil</h1>
          <Card className="mt-6 block rounded-xl border border-slate-200 bg-white p-6 shadow-none sm:p-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <UserRound size={20} className="text-blue-600" aria-hidden="true" />
              <div>
                <h2 className="m-0 text-base font-semibold">{user?.name}</h2>
                <p className="m-0 mt-1 text-sm text-slate-500">{user?.login}</p>
              </div>
            </div>
            <h2 className="mt-6 text-lg font-semibold">Cambiar contraseña</h2>
            <p className="mt-1 text-sm text-slate-500">Elegí una contraseña nueva de al menos 8 caracteres.</p>
            <form className="mt-5 grid gap-3" onSubmit={submit}>
              <label htmlFor="current-password" className="text-sm font-medium text-slate-700">Contraseña actual</label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 pl-9" />
              </div>
              <label htmlFor="new-password" className="mt-2 text-sm font-medium text-slate-700">Nueva contraseña</label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 pl-9" />
              </div>
              <label htmlFor="repeat-password" className="mt-2 text-sm font-medium text-slate-700">Repetir nueva contraseña</label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input id="repeat-password" name="repeatPassword" type="password" autoComplete="new-password" required value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} className="h-11 pl-9" />
              </div>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              {message && <p role="status" className="text-sm text-green-700">{message}</p>}
              <Button type="submit" disabled={pending} className="mt-2 min-h-11 bg-blue-600 font-semibold text-white hover:bg-blue-700">
                {pending ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
