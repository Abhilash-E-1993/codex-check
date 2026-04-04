import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import {
  AREAS,
  CITY_OPTIONS,
  DEFAULT_CITY,
  SERVICE_TYPES,
  getAreasForCity,
  normalizeAreaName,
} from "../constants/appConstants";

import { createOrUpdateUserProfile } from "../services/firestoreService";

const RoleSelectionPage = () => {

  const { currentUser, profile, loading, profileLoading, refreshProfile } = useAuth();

  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [role, setRole] = useState("customer");

  const [city, setCity] = useState(DEFAULT_CITY);
  const [serviceArea, setServiceArea] = useState(AREAS[0]);

  const [garageName, setGarageName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [experienceYears, setExperienceYears] = useState(1);

  const [services, setServices] = useState([]);

  const areaOptions = getAreasForCity(city);

  const isLoading = loading || profileLoading;

  useEffect(() => {

    if (isLoading) return;

    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (profile?.role) {
      navigate("/", { replace: true });
    }

  }, [currentUser, profile, isLoading, navigate]);

  /* ---------------- SERVICE TOGGLE ---------------- */

  const toggleService = (service) => {

    setServices((prev) =>
      prev.includes(service)
        ? prev.filter((item) => item !== service)
        : [...prev, service]
    );

  };

  /* ---------------- CITY CHANGE ---------------- */

  const handleCityChange = (nextCity) => {

    const nextAreas = getAreasForCity(nextCity);

    setCity(nextCity);
    setServiceArea(nextAreas[0]);

  };

  /* ---------------- SAVE PROFILE ---------------- */

  const handleSave = async (event) => {

    event.preventDefault();

    if (!currentUser) return;

    setSaving(true);
    setError("");

    try {

      if (role === "mechanic") {

        if (!garageName.trim()) {
          setError("Garage name required.");
          setSaving(false);
          return;
        }

        if (!/^\d{10}$/.test(phoneNumber)) {
          setError("Enter a valid 10 digit phone number.");
          setSaving(false);
          return;
        }

        if (services.length === 0) {
          setError("Select at least one service.");
          setSaving(false);
          return;
        }

      }

      await createOrUpdateUserProfile(currentUser.uid, {

        name: profile?.name || currentUser.displayName || "User",
        email: profile?.email || currentUser.email,

        role,

        ...(role === "mechanic"
          ? {
              city,
              serviceArea: normalizeAreaName(city, serviceArea),
              garageName,
              phoneNumber,
              experienceYears: Number(experienceYears),
              services,
              availabilityStatus: "available",
            }
          : {
              city: null,
              serviceArea: null,
              garageName: null,
              phoneNumber: null,
              experienceYears: null,
              services: [],
              availabilityStatus: null,
            }),

      });

      await refreshProfile(currentUser.uid);

      navigate("/");

    } catch (err) {

      console.error(err);
      setError("Unable to save profile.");

    } finally {

      setSaving(false);

    }

  };

  /* ---------------- LOADING ---------------- */

  if (isLoading) {

    return (
      <div className="flex justify-center pt-20">
        Loading profile...
      </div>
    );

  }

  /* ---------------- UI ---------------- */

  return (

    <div className="flex justify-center pt-16">

      <div className="card w-full max-w-2xl">

        <h1 className="text-3xl font-semibold text-center">
          Complete Your Profile
        </h1>

        <form className="space-y-6 mt-8" onSubmit={handleSave}>

          {/* ROLE SELECT */}

          <div className="grid grid-cols-2 gap-4">

            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`card p-4 ${role === "customer" ? "border-amber" : ""}`}
            >
              Customer
            </button>

            <button
              type="button"
              onClick={() => setRole("mechanic")}
              className={`card p-4 ${role === "mechanic" ? "border-amber" : ""}`}
            >
              Mechanic
            </button>

          </div>

          {/* MECHANIC SETTINGS */}

          {role === "mechanic" && (

            <div className="space-y-4">

              {/* CITY */}

              <select
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                className="input"
              >
                {CITY_OPTIONS.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>

              {/* AREA */}

              <select
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                className="input"
              >
                {areaOptions.map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </select>

              {/* GARAGE */}

              <input
                className="input"
                placeholder="Garage Name"
                value={garageName}
                onChange={(e) => setGarageName(e.target.value)}
              />

              {/* PHONE */}

              <input
                className="input"
                placeholder="Phone Number"
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(
                    e.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
              />

              {/* EXPERIENCE */}

              <input
                className="input"
                type="number"
                min="0"
                placeholder="Years of experience"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />

              {/* SERVICES PROVIDED */}

              <div>

                <p className="text-sm font-medium mb-2">
                  Services Provided
                </p>

                <div className="flex flex-wrap gap-2">

                  {SERVICE_TYPES.map((service) => (

                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={`badge ${
                        services.includes(service)
                          ? "badge-success"
                          : ""
                      }`}
                    >
                      {service}
                    </button>

                  ))}

                </div>

              </div>

            </div>

          )}

          {/* ERROR */}

          {error && (
            <div className="badge badge-danger">
              {error}
            </div>
          )}

          {/* SAVE */}

          <button
            className="btn-primary w-full"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

        </form>

      </div>

    </div>

  );

};

export default RoleSelectionPage;