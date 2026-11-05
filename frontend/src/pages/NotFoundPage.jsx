import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-3 text-slate-600">요청한 주소에 해당하는 화면이 없습니다.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
      >
        홈으로 이동
      </Link>
    </section>
  )
}
