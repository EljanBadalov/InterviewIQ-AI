import { lazy, Suspense, type ReactNode } from "react";
import ProtectedRoute from "./components/protectedRoute";
import RouteLoading from "./components/RouteLoading";
import {
  Routes,
  Route,
} from "react-router-dom";

const LandingPage = lazy(() => import("./pages/landingPage/LandingPage"));

const LoginPage = lazy(() => import("./pages/register/LoginPage"));
const RegisterPage = lazy(() => import("./pages/register/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/register/VerifyEmailPage"));

const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));

const DashboardHomePage = lazy(() => import("./pages/dashboard/dashboardHome/dashboardHomePage"));
const MockInterviewPage = lazy(() => import("./pages/dashboard/mockInterview/mockInterviewPage"));
const InterviewSessionPage = lazy(() => import("./pages/dashboard/interviewSessionPage/InterviewSessionPage"));
const ResumeAnalysisPage = lazy(() => import("./pages/dashboard/resumeAnalysisPage/resumeAnalysisPage"));
const JobsPage = lazy(() => import("./pages/dashboard/jobsPage/jobsPage"));
const JobDetailsPage = lazy(() => import("./pages/dashboard/jobDetailsPage/jobDetailsPage"));
const PerformanceProgressPage = lazy(() => import("./pages/dashboard/performanceProgressPage/performanceProgressPage"));
const BookmarksPage = lazy(() => import("./pages/dashboard/bookmarksPage/bookmarksPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/settingsPage/SettingsPage"));
const CVOptimizerPage = lazy(() => import("./pages/dashboard/cvOptimizerPage/cvOptimizerPage"));
const CareerAssistantPage = lazy(() => import("./pages/dashboard/careerAssistantPage/careerAssistantPage"));
const CareerAutomationPage = lazy(() => import("./pages/dashboard/careerAutomationPage/careerAutomationPage"));


function routePage(page: ReactNode, route: string) {
  return <Suspense key={route} fallback={<RouteLoading />}>{page}</Suspense>;
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={routePage(<LandingPage />, "LandingPage")}
      />

      <Route
        path="/login"
        element={routePage(<LoginPage />, "LoginPage")}
      />

      <Route
        path="/register"
        element={routePage(<RegisterPage />, "RegisterPage")}
      />

      <Route
        path="/verify-email"
        element={routePage(<VerifyEmailPage />, "VerifyEmailPage")}
      />

      <Route
        element={<ProtectedRoute />}
      >
        <Route
          path="/dashboard"
          element={routePage(<DashboardLayout />, "DashboardLayout")}
        >
          <Route
            index
            element={routePage(<DashboardHomePage />, "DashboardHomePage")}
          />

          <Route
            path="mock-interview"
            element={routePage(<MockInterviewPage />, "MockInterviewPage")}
          />

          <Route
            path="mock-interview/:interviewId"
            element={routePage(<InterviewSessionPage />, "InterviewSessionPage")}
          />

          <Route
            path="resume-analysis"
            element={routePage(<ResumeAnalysisPage />, "ResumeAnalysisPage")}
          />

          <Route
            path="jobs"
            element={routePage(<JobsPage />, "JobsPage")}
          />

          <Route
            path="jobs/:jobId"
            element={routePage(<JobDetailsPage />, "JobDetailsPage")}
          />

          <Route
            path="jobs/:jobId/improve-cv"
            element={routePage(<CVOptimizerPage />, "CVOptimizerPage")}
          />

          <Route
            path="performance-progress"
            element={routePage(<PerformanceProgressPage />, "PerformanceProgressPage")}
          />

          <Route
            path="bookmarks"
            element={routePage(<BookmarksPage />, "BookmarksPage")}
          />

          <Route
            path="career-assistant"
            element={routePage(<CareerAssistantPage />, "CareerAssistantPage")}
          />

          <Route
            path="career-automation"
            element={routePage(<CareerAutomationPage />, "CareerAutomationPage")}
          />

          <Route
            path="settings"
            element={routePage(<SettingsPage />, "SettingsPage")}
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
