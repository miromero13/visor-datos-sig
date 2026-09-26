import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/Brand";

export function LoginPage() {
	return (
		<main className="grid min-h-[100dvh] place-items-center bg-[#edf3ff] px-5 py-7">
			<Card
				className="block w-full max-w-[450px] rounded-xl border-[#d9e3f1] bg-[#fbfcff] p-[26px_21px] shadow-[0_18px_55px_rgb(20_48_91_/_9%)] sm:p-[35px]"
				data-testid="login-panel"
			>
				<div className="mb-[38px]">
					<Brand />
				</div>
				<Link
					className="mb-[30px] block text-xs font-medium text-[#386b9c]"
					to="/"
				>
					← Volver al proyecto
				</Link>
				<p className="mb-2 text-[11px] font-semibold tracking-[.09em] text-[#3179ae] uppercase">
					Acceso al visor
				</p>
				<h1 className="mb-2.5 text-[32px] font-semibold tracking-[-.05em] text-[#08142e]">
					Ingresar al visor
				</h1>
				<p className="mb-5 text-[13px] text-[#5e6f8b]">
					Esta es una interfaz visual de acceso
				</p>
				<form
					className="mt-6 grid gap-2"
					onSubmit={(event) => event.preventDefault()}
				>
					<label
						className="text-xs font-semibold text-[#243d62]"
						htmlFor="email"
					>
						Correo electrónico
					</label>
					<Input
						className="mb-1.5 h-[42px] w-full rounded-md border-[#c9d5e6] bg-[#f0f3f8] px-3 text-[#253b5b] disabled:cursor-not-allowed disabled:opacity-100"
						id="email"
						name="email"
						type="email"
						autoComplete="username"
						aria-describedby="login-status"
						disabled
					/>
					<label
						className="text-xs font-semibold text-[#243d62]"
						htmlFor="password"
					>
						Contraseña
					</label>
					<Input
						className="mb-1.5 h-[42px] w-full rounded-md border-[#c9d5e6] bg-[#f0f3f8] px-3 text-[#253b5b] disabled:cursor-not-allowed disabled:opacity-100"
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						aria-describedby="login-status"
						disabled
					/>
					<Button
						className="min-h-[46px] w-full bg-[#61738f] hover:bg-[#50617d] text-[13px] font-semibold text-[#d9e3f0]"
						type="button"
						disabled
					>
						Iniciar sesión
					</Button>
				</form>
			</Card>
		</main>
	);
}
