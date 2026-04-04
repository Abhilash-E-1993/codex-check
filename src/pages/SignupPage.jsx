import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { createOrUpdateUserProfile } from "../services/firestoreService";
import { markOnboardingPending } from "../utils/onboardingSession";

const SignupPage = () => {

  const { signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {

    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));

  };

  const handleSubmit = async (event) => {

    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {

      const credentials = await signUpWithEmail(
        formData.email,
        formData.password
      );

      const uid = credentials.user.uid;

      // create profile
      await createOrUpdateUserProfile(uid, {

        name: formData.name.trim(),
        email: formData.email.trim(),

        role: null,
        city: null,
        serviceArea: null,

        garageName: null,
        phoneNumber: null,
        experienceYears: null,
        services: [],
        availabilityStatus: null,

      });

      markOnboardingPending(uid);

      navigate("/role-selection");

    } catch (err) {

      if (err.code === "auth/email-already-in-use") {
        setError("Email already registered. Please login.");
      }

      else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      }

      else {
        setError("Unable to create account. Please try again.");
      }

    } finally {

      setLoading(false);

    }

  };

  return (

    <div className="flex justify-center pt-20">

      <div className="card max-w-md w-full animate-fade-up">

        {/* HEADER */}

        <div className="text-center mb-8">

          <h1 className="text-3xl font-semibold text-shimmer">
            Create Account
          </h1>

          <p className="text-muted text-sm mt-2">
            Join Breakdown Assist and get help on the road instantly
          </p>

        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          autoComplete="off"
          data-form-type="other"
        >

          <div>

            <label className="input-label">
              Full Name
            </label>

            <input
              name="name"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              className="input"
              required
            />

          </div>

          <div>

            <label className="input-label">
              Email
            </label>

            <input
              name="email"
              type="email"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              spellCheck="false"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              className="input"
              required
            />

          </div>

          <div>

            <label className="input-label">
              Password
            </label>

            <input
              name="password"
              type="password"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              className="input"
              required
            />

          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-4"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

        </form>

        {/* ERROR */}

        {error && (
          <div className="badge badge-danger mt-5">
            {error}
          </div>
        )}

        {/* LOGIN LINK */}

        <p className="text-sm text-muted mt-8 text-center">

          Already have an account?{" "}

          <Link
            to="/login"
            className="text-amber hover:text-amber-light font-medium"
          >
            Login
          </Link>

        </p>

      </div>

    </div>

  );

};

export default SignupPage;
