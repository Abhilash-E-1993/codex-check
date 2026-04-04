import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import Loader from "./components/Loader";
import PushNotificationManager from "./components/PushNotificationManager";

import { useAuth } from "./context/AuthContext";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import RoleSelectionPage from "./pages/RoleSelectionPage";

/* ---------------- PROTECTED ROUTE ---------------- */

const ProtectedRoute = ({ children }) => {

  const { currentUser, loading } = useAuth();

  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader label="Loading session..." />
      </div>
    );

  }

  if (!currentUser) {

    return <Navigate to="/login" replace />;

  }

  return children;

};

/* ---------------- ONBOARDING ROUTE ---------------- */

const OnboardingRoute = ({ children }) => {

  const { currentUser, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader label="Loading profile..." />
      </div>
    );

  }

  if (!currentUser) {

    return <Navigate to="/login" replace />;

  }

  // If user already has role, go to dashboard
  if (profile?.role) {

    return <Navigate to="/" replace />;

  }

  return children;

};

/* ---------------- APP LAYOUT ---------------- */

const AppLayout = () => {

  const location = useLocation();

  return (

    <div className="page-wrapper">

      <PushNotificationManager />

      {/* NAVBAR */}

      <Navbar />

      {/* MAIN CONTENT */}

      <main className="flex-1">

        <div className="container-ui">

          <div
            key={location.pathname}
            className="animate-fade-up"
          >

            <Routes>

              <Route path="/" element={<HomePage />} />

              <Route path="/login" element={<LoginPage />} />

              <Route path="/signup" element={<SignupPage />} />

              <Route
                path="/role-selection"
                element={
                  <OnboardingRoute>
                    <RoleSelectionPage />
                  </OnboardingRoute>
                }
              />

            </Routes>

          </div>

        </div>

      </main>

    </div>

  );

};

export default AppLayout;