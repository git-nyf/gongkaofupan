import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CardsPage } from './pages/CardsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntryPage } from './pages/EntryPage';
import { GraphsPage } from './pages/GraphsPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShenlunPage } from './pages/ShenlunPage';
import { StudyPage } from './pages/StudyPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/graphs" element={<GraphsPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/shenlun" element={<ShenlunPage />} />
          <Route path="/shenlun/:reviewId" element={<ShenlunPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
