import { Link } from "react-router-dom";

import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import { isOnboardingPending } from "../utils/onboardingSession";

import CustomerDashboard from "./CustomerDashboard";
import MechanicDashboard from "./MechanicDashboard";

const HomePage = () => {
  const { currentUser, profile, loading, profileLoading } = useAuth();

  const isLoading = loading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader label="Loading dashboard..." />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex justify-center pt-20">
        <div className="card max-w-xl w-full text-center animate-fade-up">
          <div className="mb-6">
            <span className="section-tag">
              Roadside Assistance
            </span>
          </div>

          <h1 className="text-4xl font-semibold text-shimmer">
            Breakdown Assist
          </h1>

          <p className="mt-4 text-muted text-sm leading-relaxed">
            Instantly connect with nearby mechanics when your vehicle breaks down.
            Fast response, trusted professionals, and real-time service requests.
          </p>

          <div className="mt-10 flex justify-center gap-4 flex-wrap">
            <Link
              to="/login"
              className="btn-primary"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="btn-secondary"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (profile === undefined) {
    return (
      <div className="flex justify-center pt-20">
        <Loader label="Loading profile..." />
      </div>
    );
  }

  if (!profile?.role) {
    if (!isOnboardingPending(currentUser?.uid)) {
      return (
        <div className="flex justify-center pt-20">
          <div className="card text-center max-w-md">
            <h2 className="text-xl font-semibold">
              Preparing Your Dashboard
            </h2>

            <p className="text-muted text-sm mt-2">
              Your account is signed in. We are syncing your role details in the background.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-6"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center pt-20">
        <div className="card text-center max-w-md">
          <h2 className="text-xl font-semibold">
            Complete Your Profile
          </h2>

          <p className="text-muted text-sm mt-2">
            Please select your role to continue.
          </p>

          <Link
            to="/role-selection"
            className="btn-primary mt-6"
          >
            Continue Setup
          </Link>
        </div>
      </div>
    );
  }

  if (profile.role === "customer") {
    return <CustomerDashboard />;
  }

  if (profile.role === "mechanic") {
    return <MechanicDashboard />;
  }

  return null;
};

export default HomePage;
