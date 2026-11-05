import { Route, Routes } from 'react-router'
import RootLayout from '@/layouts/RootLayout.jsx'
import HomePage from '@/pages/HomePage.jsx'
import EntryPlaceholder from '@/pages/EntryPlaceholder.jsx'
import NotFoundPage from '@/pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route element={<RootLayout />}>
        <Route path="scene" element={<EntryPlaceholder entry="scene" />} />
        <Route path="food" element={<EntryPlaceholder entry="food" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
