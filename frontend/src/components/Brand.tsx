import { Link } from 'react-router-dom'

export function Brand() {
  return <Link className="inline-flex items-center gap-2.5 whitespace-nowrap text-[15px] font-bold tracking-[-0.045em] text-[#08142e]" to="/" aria-label="VisorDatosSIG, inicio"><span className="grid size-[26px] rotate-[-7deg] place-items-center rounded-[7px] bg-[#08142e]" aria-hidden="true"><span className="size-3 rotate-[7deg] rounded-[3px] border-2 border-sky-300" /></span><span>VisorDatos<span className="text-[#237fc9]">SIG</span></span></Link>
}
