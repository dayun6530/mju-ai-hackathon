import { Outlet } from 'react-router'
import SiteHeader from '@/components/SiteHeader.jsx'

export default function RootLayout() {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Outlet />
      </main>
    </div>
  )
}
