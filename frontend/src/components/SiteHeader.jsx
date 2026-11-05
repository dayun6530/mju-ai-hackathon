import { NavLink } from 'react-router'

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
        <NavLink to="/" className="font-semibold text-slate-900">
          MJU AI Hackathon
        </NavLink>
      </div>
    </header>
  )
}
