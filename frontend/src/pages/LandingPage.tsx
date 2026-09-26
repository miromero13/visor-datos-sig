import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Header } from "@/components/Header";
import { MapIllustration } from "@/components/MapIllustration";
import { Button } from "@/components/ui/button";

const technologies = [
	["Frontend", "React + TypeScript"],
	["Visor cartográfico", "Leaflet"],
	["Servicios previstos", "ASP.NET Core 10 Web API"],
	["Base de datos prevista", "SQL Server 2022"],
	["Acceso a datos previsto", "Entity Framework Core"],
	["Procesamiento geográfico", "NetTopologySuite"],
	["Intercambio", "GeoJSON"],
	["Control de versiones", "Git"],
	["Entorno backend", "Visual Studio 2026"],
];
const academicDetails = [
	["Universidad", "Universidad Autónoma Gabriel René Moreno"],
	["Facultad", "FICCT"],
	["Asignatura", "Sistemas de Información Geográfica"],
	["Docente", "Ing. Perez Ferreira Ubaldo"],
	["Carrera", "Ingeniería en Sistemas"],
];
const width =
	"mx-auto w-[min(1180px,calc(100%-32px))] md:w-[min(1180px,calc(100%-64px))]";
const heading =
	"max-w-[570px] text-[clamp(30px,3.7vw,43px)] leading-[1.15] font-semibold tracking-[-.05em] text-[#08142e]";
const body = "max-w-[590px] text-[15px] leading-[1.8] text-[#58698a]";

export function LandingPage() {
	return (
		<>
			<Header />
			<main>
				<section
					className={`${width} grid min-h-[570px] grid-cols-1 items-center gap-[clamp(38px,7vw,94px)] py-14 pb-16 md:grid-cols-[1.08fr_.92fr] md:py-[62px] md:pb-[78px]`}
				>
					<div className="max-w-[590px]">
						<p className="mb-5 text-[11px] leading-[1.5] font-semibold tracking-[.09em] text-[#43739f] uppercase">
							Proyecto académico · Sistemas de Información Geográfica
						</p>
						<h1 className="mb-5 max-w-[590px] text-[clamp(39px,5.1vw,62px)] leading-[1.06] font-semibold tracking-[-.064em] text-[#08142e]">
							Información geográfica,{" "}
							<span className="text-[#287fbf]">vista con contexto.</span>
						</h1>
						<p className="mb-[26px] max-w-[480px] text-base leading-[1.7] text-[#58698a]">
							VisorDatosSIG propone una plataforma web para organizar, consultar
							y visualizar información geográfica.
						</p>
						<div className="flex flex-wrap items-center gap-3">
							<Button
								asChild
								className="min-h-[46px] whitespace-nowrap bg-[#08142e] px-[17px] text-[13px] font-semibold text-[#f8fbff] hover:bg-[#142955]"
							>
								<a href="#proyecto">
									Conocer el proyecto <span aria-hidden="true">↓</span>
								</a>
							</Button>
							<Button
								asChild
								variant="outline"
								className="min-h-[46px] whitespace-nowrap border-[#c6d4e9] bg-white px-[17px] text-[13px] font-semibold text-[#08142e]"
							>
								<Link to="/login">Acceder</Link>
							</Button>
						</div>
					</div>
					<MapIllustration />
				</section>
				<section className="bg-white py-16 md:py-[92px]" id="proyecto">
					<div
						className={`${width} grid gap-7 md:grid-cols-[.95fr_1.05fr] md:gap-[90px]`}
					>
						<h2 className={heading}>
							Un proyecto para explorar información territorial.
						</h2>
						<div className="md:pt-[33px]">
							<p className={body}>
								La propuesta conecta la preparación de archivos geográficos con
								una futura experiencia web de consulta. La arquitectura mantiene
								separadas la interfaz, los servicios y la base de datos.
							</p>
							<div className="mt-6 flex flex-wrap gap-2">
								<span className="rounded-lg border border-[#dce6f5] bg-[#f6f9ff] px-3 py-2 text-xs font-medium text-[#263e64]">
									Manzanas
								</span>
								<span className="rounded-lg border border-[#dce6f5] bg-[#f6f9ff] px-3 py-2 text-xs font-medium text-[#263e64]">
									Lotes
								</span>
								<span className="rounded-lg border border-[#dce6f5] bg-[#f6f9ff] px-3 py-2 text-xs font-medium text-[#263e64]">
									Códigos Fijos
								</span>
								<span className="rounded-lg border border-[#dce6f5] bg-[#f6f9ff] px-3 py-2 text-xs font-medium text-[#263e64]">
									Vías
								</span>
							</div>
							<p className="mt-3 text-[11px] leading-[1.6] text-[#647591]">
								Capas contempladas en los requisitos del proyecto. No
								representan datos cargados en este sitio.
							</p>
						</div>
					</div>
				</section>
				<section className="bg-[#eaf0fb] py-16 md:py-[92px]" id="arquitectura">
					<div
						className={`${width} grid items-start gap-8 md:grid-cols-[.9fr_1.1fr] md:gap-[92px]`}
					>
						<div>
							<h2 className={heading}>
								De archivos espaciales a una interfaz de consulta.
							</h2>
							<p className={`${body} mt-5`}>
								Este esquema resume la arquitectura planteada. Sus servicios y
								procesos están pendientes de implementación.
							</p>
						</div>
						<div
							className="grid justify-items-stretch"
							aria-label="Flujo de arquitectura previsto"
						>
							{[
								["01", "Archivos SHP", "Fuente geográfica"],
								["02", "Migrador", "Proceso planificado"],
								["03", "SQL Server 2022", "Almacenamiento espacial"],
								[
									"04",
									"API → GeoJSON → Leaflet",
									"Servicios y visor previstos",
								],
							].map(([number, title, caption], index) => (
								<div key={number}>
									<div
										className={`grid grid-cols-[34px_1fr] items-center gap-x-3 rounded-lg border px-4 py-3.5 ${index === 3 ? "border-[#9dbfe2] bg-[#e2f1ff]" : "border-[#d3deef] bg-[#f9fbff]"}`}
									>
										<span className="row-span-2 text-[11px] font-semibold text-[#397db6]">
											{number}
										</span>
										<strong className="text-[13px] font-semibold text-[#08142e]">
											{title}
										</strong>
										<small className="mt-1 text-[11px] text-[#627491]">
											{caption}
										</small>
									</div>
									{index < 3 && (
										<div
											className="py-1 text-center text-[15px] text-[#4384bc]"
											aria-hidden="true"
										>
											↓
										</div>
									)}
								</div>
							))}
						</div>
					</div>
					<div
						className={`${width} mt-12 border-t border-[#d2deef] pt-7 md:mt-[76px]`}
					>
						<div className="mb-5 flex flex-col gap-1.5 md:flex-row md:items-baseline md:justify-between">
							<h3 className="text-[17px] font-semibold tracking-[-.025em] text-[#08142e]">
								Tecnologías previstas
							</h3>
							<p className="text-xs text-[#5d6f8d]">
								Stack documentado para el desarrollo del sistema.
							</p>
						</div>
						<div className="grid grid-cols-2 border-t border-l border-[#d3deef] md:grid-cols-3">
							{technologies.map(([area, name]) => (
								<div
									className="flex min-h-[86px] flex-col justify-center gap-2 border-r border-b border-[#d3deef] bg-white/50 px-4 py-4"
									key={area}
								>
									<span className="text-[10px] text-[#657795]">{area}</span>
									<strong className="text-xs font-semibold text-[#19365f]">
										{name}
									</strong>
								</div>
							))}
						</div>
					</div>
				</section>
				<section className="bg-[#f8faff] py-16 md:py-[92px]" id="equipo">
					<div
						className={`${width} grid gap-7 md:grid-cols-[.8fr_1.2fr] md:gap-24`}
					>
						<div>
							<h2 className={heading}>Desarrollado en la FICCT.</h2>
							<p className={`${body} mt-[18px]`}>
								Trabajo académico de la carrera Ingeniería en Sistemas.
							</p>
						</div>
						<dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
							{academicDetails.map(([label, value]) => (
								<div className="border-t border-[#dce4f1] py-4" key={label}>
									<dt className="mb-2 text-[11px] text-[#657795]">{label}</dt>
									<dd className="m-0 text-[13px] leading-[1.5] font-semibold text-[#19365f]">
										{value}
									</dd>
								</div>
							))}
						</dl>
					</div>
					<div
						className={`${width} mt-10 grid gap-7 border-t border-[#dce4f1] pt-6 md:mt-[58px] md:grid-cols-[.8fr_1.2fr] md:gap-24`}
					>
						<h3 className="text-[17px] font-semibold tracking-[-.025em] text-[#08142e]">
							Integrantes
						</h3>
						<div className="flex flex-wrap gap-x-10 gap-y-3">
							<p className="m-0 text-sm font-semibold text-[#19365f]">
								Luis Gabriel Janco
							</p>
							<p className="m-0 text-sm font-semibold text-[#19365f]">
								María Ilse Romero
							</p>
						</div>
					</div>
				</section>
			</main>
			<footer className="border-t border-[#dce4f1] bg-white py-6">
				<div
					className={`${width} flex flex-col items-start justify-between gap-5 md:flex-row md:items-center`}
				>
					<Brand />
					<p className="m-0 text-[11px] text-[#687995]">
						Proyecto académico de Sistemas de Información Geográfica
					</p>
					<Button
						asChild
						variant="link"
						className="px-0 text-xs font-semibold text-[#294a75]"
					>
						<Link to="/login">
							Acceder al sistema <span aria-hidden="true">↗</span>
						</Link>
					</Button>
				</div>
			</footer>
		</>
	);
}
