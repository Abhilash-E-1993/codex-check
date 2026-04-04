import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { currentUser, profile, profileLoading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header
      className="
      sticky top-0 z-50
      border-b border-[var(--border)]
      bg-[rgba(13,13,26,0.75)]
      backdrop-blur-xl
      "
    >
      <div className="container-ui flex items-center justify-between py-4">

        {/* BRAND */}

        <Link
          to="/"
          className="
          flex items-center gap-2
          text-lg font-semibold
          text-amber-light
          hover:text-amber
          transition
          "
        >
          🚗
          <span className="tracking-tight">
            Breakdown Assist
          </span>
        </Link>

        {/* RIGHT SIDE */}

        {currentUser && (
          <div className="flex items-center gap-4">

            {/* ROLE BADGE */}

            <span
              className="
              badge
              bg-[rgba(245,158,11,0.12)]
              text-[var(--amber-light)]
              "
            >
              {profileLoading ? "loading..." : (profile?.role || "setup")}
            </span>

            {/* LOGOUT */}

            <button
              onClick={handleLogout}
              className="
              px-4 py-2
              text-sm
              rounded-full
              border border-[var(--border-2)]
              text-[var(--text-2)]
              hover:text-[var(--amber-light)]
              hover:border-[var(--amber)]
              transition
              "
            >
              Logout
            </button>

          </div>
        )}

      </div>
    </header>
  );
};

export default Navbar;
