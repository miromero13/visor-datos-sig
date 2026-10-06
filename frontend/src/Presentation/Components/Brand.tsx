import { Link } from 'react-router-dom'

export function Brand({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  const isLg = size === "lg";
  return (
    <Link
      className={`inline-flex items-center gap-2.5 whitespace-nowrap font-bold tracking-[-0.045em] ${
        isLg ? "text-[18px]" : "text-[15px]"
      } ${light ? "text-white" : "text-[#08142e]"}`}
      to="/"
      aria-label="VisorDatosSIG, inicio"
    >
      <span
        className={`grid rotate-[-7deg] place-items-center ${
          isLg ? "size-[30px] rounded-[8px]" : "size-[26px] rounded-[7px]"
        } ${light ? "bg-white" : "bg-[#08142e]"}`}
        aria-hidden="true"
      >
        <span
          className={`rotate-[7deg] rounded-[3px] border-2 ${
            isLg ? "size-3.5" : "size-3"
          } ${light ? "border-[#0F172A]" : "border-sky-300"}`}
        />
      </span>
      <span>
        VisorDatos<span className="text-[#237fc9]">SIG</span>
      </span>
    </Link>
  );
}
