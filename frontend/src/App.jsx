import { Route, Routes } from 'react-router'
import RootLayout from '@/layouts/RootLayout.jsx'
import HomePage from '@/pages/HomePage.jsx'
import NotFoundPage from '@/pages/NotFoundPage.jsx'
import PlacesPage from '@/pages/PlacesPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route element={<RootLayout />}>
        <Route path="places" element={<PlacesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
