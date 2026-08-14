import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHomePage from './pages/dashboard/DashboardHomePage';
import MockInterviewPage from './pages/dashboard/MockInterviewPage';
import ResumeAnalysisPage from './pages/dashboard/ResumeAnalysisPage';
import HistoryPage from './pages/dashboard/HistoryPage';
import BookmarksPage from './pages/dashboard/BookmarksPage';
import SettingsPage from './pages/dashboard/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHomePage />} />
        <Route path="mock-interview" element={<MockInterviewPage />} />
        <Route path="resume-analysis" element={<ResumeAnalysisPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;