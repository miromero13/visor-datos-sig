import { Link } from 'react-router-dom'
import { Brand } from './Brand'
import { Button } from '@/components/ui/button'

export function Header() {
  return <header className="h-[72px] border-b border-[#dce4f3]/75 bg-[#f3f6ff]/95"><div className="mx-auto flex h-full w-[min(1320px,calc(100%-32px))] items-center justify-between md:w-[min(1320px,calc(100%-64px))]"><Brand /><nav className="flex items-center gap-4 text-[13px] font-medium text-[#435575] md:gap-[clamp(18px,3vw,42px)]" aria-label="Navegación principal"><a className="hidden hover:text-[#0866b5] md:block" href="#proyecto">Proyecto</a><a className="hidden hover:text-[#0866b5] md:block" href="#arquitectura">Arquitectura</a><a className="hidden hover:text-[#0866b5] md:block" href="#equipo">Equipo</a><Button asChild variant="outline" className="gap-3 border-[#c6d4e9] bg-white text-[#08142e]"><Link to="/login">Acceder <span aria-hidden="true">↗</span></Link></Button></nav></div></header>
}
