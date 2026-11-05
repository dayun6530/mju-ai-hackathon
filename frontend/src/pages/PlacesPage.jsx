import CultureTipCard from '@/components/CultureTipCard.jsx'
import PlaceCard from '@/components/PlaceCard.jsx'
import groups from '@/data/mockData.json'

function cultureTip(place, keywords) {
  const keyword = keywords[0]
  if (!keyword) return `${place.name} 주변을 조금 더 걸어보면 좋아요.`
  return `${place.name} 근처에서 ${keyword} 분위기를 조금 더 둘러보면 좋아요.`
}

export default function PlacesPage() {
  return (
    <div className="space-y-8">
      {groups.flatMap((group) =>
        group.places.map((place) => (
          <section key={place.id} className="space-y-4">
            <PlaceCard place={place} keywords={group.keywords} />
            <CultureTipCard tip={cultureTip(place, group.keywords)} />
          </section>
        )),
      )}
    </div>
  )
}
