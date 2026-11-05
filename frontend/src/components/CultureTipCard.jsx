import { Lightbulb } from 'lucide-react'

function SeoulSkyline() {
  return (
    <svg
      viewBox="0 0 240 130"
      className="pointer-events-none absolute right-0 bottom-0 h-20 w-32 text-[#c5d7f6] sm:h-32 sm:w-64"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M0 108c28-18 46-18 70 0 18 14 34 10 52-8 16-16 30-18 48-4 20 16 34 12 70-6v40H0V108z"
      />
      <path
        fill="#b7cbee"
        d="M118 78c8 10 8 22 0 34h28c-6-12-6-24 2-34-8-2-16-6-22-12-4 4-6 8-8 12z"
      />
      <rect x="126" y="46" width="6" height="34" rx="1" fill="#b7cbee" />
      <rect x="120" y="58" width="18" height="4" rx="1" fill="#b7cbee" />
      <circle cx="129" cy="40" r="3" fill="#b7cbee" />
      <path d="M129 28v8" stroke="#b7cbee" strokeWidth="2" />
      <rect x="168" y="62" width="5" height="28" rx="1" fill="#d5e3f8" />
      <rect x="163" y="72" width="15" height="3" rx="1" fill="#d5e3f8" />
      <circle cx="170.5" cy="57" r="2.5" fill="#d5e3f8" />
    </svg>
  )
}

export default function CultureTipCard({ tip }) {
  return (
    <aside className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#e7e9ff] to-[#e7f3ff] px-6 py-5 sm:px-7 sm:py-6">
      <div className="relative z-10 flex max-w-[calc(100%-8.5rem)] items-start gap-3 sm:max-w-xl">
        <Lightbulb className="mt-0.5 size-6 shrink-0 text-amber-400" aria-hidden="true" />
        <div>
          <p className="font-bold text-slate-900">K-Culture Tips!</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-[15px]">{tip}</p>
        </div>
      </div>
      <SeoulSkyline />
    </aside>
  )
}
