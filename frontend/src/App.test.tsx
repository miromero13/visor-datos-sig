import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
// @ts-expect-error Node built-ins are available in Vitest's Node environment.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}


describe('VisorDatosSIG routes', () => {
  it('presents project scope, planned stack, academic context, and contributors on the landing page', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: /información geográfica, vista con contexto/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /conocer el proyecto/i })).toHaveAttribute('data-slot', 'button')
    expect(screen.getByText(/VisorDatosSIG propone una plataforma web/i)).toBeInTheDocument()
    expect(screen.getAllByText(/SQL Server 2022/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Leaflet/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Universidad Autónoma Gabriel René Moreno/i)).toBeInTheDocument()
    expect(screen.getByText('FICCT', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Sistemas de Información Geográfica', { exact: true })).toBeInTheDocument()
    expect(screen.getByText(/Ing\. Perez Ferreira Ubaldo/i)).toBeInTheDocument()
    expect(screen.getByText('Ingeniería en Sistemas', { exact: true })).toBeInTheDocument()
    expect(screen.getByText(/Luis Gabriel Janco/i)).toBeInTheDocument()
    expect(screen.getByText(/María Ilse Romero/i)).toBeInTheDocument()
    expect(screen.getByText(/pendientes de implementación/i)).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: /acceder/i })).toHaveAttribute('href', '/login')
  })

  it('shows an enabled public login form and navigates back to the project', async () => {
    const user = userEvent.setup()
    renderAt('/login')

    expect(screen.getByRole('heading', { name: /ingresá a tu espacio/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/usuario/i)).toBeEnabled()
    expect(screen.getByLabelText(/usuario/i)).toHaveAttribute('data-slot', 'input')
    expect(screen.getByTestId('login-panel')).toHaveAttribute('data-slot', 'card')
    expect(screen.getByLabelText(/contraseña/i)).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: /mantener sesión iniciada/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /ingresar/i })).toHaveAttribute('data-slot', 'button')
    await user.click(screen.getByRole('link', { name: /volver al proyecto/i }))
    expect(screen.getByRole('heading', { name: /información geográfica, vista con contexto/i })).toBeInTheDocument()
  })

  it('keeps every TSX source to one React component declaration', () => {
    const files = import.meta.glob('./**/*.tsx', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    for (const [file, source] of Object.entries(files)) {
      const componentFunctions = [...source.matchAll(/\bfunction\s+[A-Z]\w*\s*\(/g)]
      expect(componentFunctions.length, file).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the global stylesheet to the Tailwind entry import only', () => {
    expect(readFileSync(`${process.cwd()}/src/styles.css`, 'utf8').trim()).toBe('@import "tailwindcss";')
  })
})
