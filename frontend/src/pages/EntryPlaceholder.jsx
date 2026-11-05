import { useLocation } from 'react-router';

const titles = {
  scene: '장소 찾기',
  food: '음식 알아보기',
};

export default function EntryPlaceholder({ entry }) {
  const location = useLocation();
  const query = location.state?.query ?? '';
  const photo = location.state?.photo ?? null;

  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{titles[entry]}</h1>
      <p className="mt-3 text-slate-600">이 페이지는 나중에 연결됩니다.</p>
      {query ? <p className="mt-4 text-slate-900">{query}</p> : null}
      {photo ? <p className="mt-2 text-sm text-slate-600">{photo.name}</p> : null}
    </section>
  );
}
