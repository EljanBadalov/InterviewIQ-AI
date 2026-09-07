import {
  Routes,
  Route,
} from "react-router-dom";

import LandingPage from "./pages/landingPage/LandingPage";

import LoginPage from "./pages/register/LoginPage";
import RegisterPage from "./pages/register/RegisterPage";
import VerifyEmailPage from "./pages/register/VerifyEmailPage";

import DashboardLayout from "./layouts/DashboardLayout";

import DashboardHomePage from "./pages/dashboard/dashboardHome/dashboardHomePage";
import MockInterviewPage from "./pages/dashboard/mockInterview/mockInterviewPage";
import InterviewSessionPage from "./pages/dashboard/interviewSessionPage/InterviewSessionPage";
import ResumeAnalysisPage from "./pages/dashboard/resumeAnalysisPage/resumeAnalysisPage";
import JobsPage from "./pages/dashboard/jobsPage/jobsPage";
import JobDetailsPage from "./pages/dashboard/jobDetailsPage/jobDetailsPage";
import HistoryPage from "./pages/dashboard/historyPage/historyPage";
import BookmarksPage from "./pages/dashboard/bookmarksPage/bookmarksPage";
import SettingsPage from "./pages/dashboard/settingsPage/SettingsPage";
import CVOptimizerPage from "./pages/dashboard/cvOptimizerPage/cvOptimizerPage";
import CareerAssistantPage from "./pages/dashboard/careerAssistantPage/careerAssistantPage";
import CareerAutomationPage from "./pages/dashboard/careerAutomationPage/careerAutomationPage";

import ProtectedRoute from "./components/protectedRoute";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      <Route
        path="/verify-email"
        element={<VerifyEmailPage />}
      />

      <Route
        element={<ProtectedRoute />}
      >
        <Route
          path="/dashboard"
          element={<DashboardLayout />}
        >
          <Route
            index
            element={<DashboardHomePage />}
          />

          <Route
            path="mock-interview"
            element={<MockInterviewPage />}
          />

          <Route
            path="mock-interview/:interviewId"
            element={<InterviewSessionPage />}
          />

          <Route
            path="resume-analysis"
            element={<ResumeAnalysisPage />}
          />

          <Route
            path="jobs"
            element={<JobsPage />}
          />

          <Route
            path="jobs/:jobId"
            element={<JobDetailsPage />}
          />

          <Route
            path="jobs/:jobId/improve-cv"
            element={<CVOptimizerPage />}
          />

          <Route
            path="history"
            element={<HistoryPage />}
          />

          <Route
            path="bookmarks"
            element={<BookmarksPage />}
          />

          <Route
            path="career-assistant"
            element={<CareerAssistantPage />}
          />

          <Route
            path="career-automation"
            element={<CareerAutomationPage />}
          />

          <Route
            path="settings"
            element={<SettingsPage />}
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
