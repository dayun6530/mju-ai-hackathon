import { ArrowRight, MapPin, Sparkles } from 'lucide-react'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1546874177-9e664107314e?auto=format&fit=crop&w=1600&q=80'

const BADGES = {
  FILMING_LOCATION: {
    label: 'Real Filming Location',
    className: 'bg-emerald-50 text-emerald-600',
    Icon: MapPin,
  },
  SIMILAR_EXPERIENCE: {
    label: 'Similar Experience',
    className: 'bg-violet-50 text-violet-600',
    Icon: Sparkles,
  },
}

function directionsUrl(place) {
  const name = encodeURIComponent(place.name)
  return `https://map.kakao.com/link/to/${name},${place.latitude},${place.longitude}`
}

export default function PlaceCard({ place, keywords = [] }) {
  const badge = BADGES[place.type]
  const imageUrl = place.imageUrl || FALLBACK_IMAGE

  return (
    <article className="rounded-[28px] bg-white p-3 shadow-[0_10px_30px_rgba(76,81,140,0.06)] sm:p-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
        <div className="relative h-64 overflow-hidden rounded-[22px] sm:h-80 lg:h-auto lg:min-h-full">
          <img
            src={imageUrl}
            alt={place.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col px-2 py-2 sm:px-4 sm:py-5">
          {badge ? (
            <p
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${badge.className}`}
            >
              <badge.Icon className="size-4" aria-hidden="true" />
              {badge.label}
            </p>
          ) : null}

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {place.name}
          </h2>

          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {place.source}
          </p>

          <p className="mt-4 text-[15px] leading-7 text-slate-600">{place.description}</p>

          {keywords.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <li
                  key={keyword}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500"
                >
                  #{keyword}
                </li>
              ))}
            </ul>
          ) : null}

          <a
            href={directionsUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#5b4dff] px-6 text-base font-medium text-white transition hover:bg-[#4d40f0]"
          >
            Get Directions
            <ArrowRight className="size-5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  )
}
