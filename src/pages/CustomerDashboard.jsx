import { useEffect, useState, useCallback } from "react";

import MechanicCard from "../components/MechanicCard";
import RequestList from "../components/RequestList";
import Loader from "../components/Loader";

import {
  AREAS,
  CITY_OPTIONS,
  DEFAULT_CITY,
  SERVICE_TYPES,
  getAreasForCity,
  normalizeAreaName,
} from "../constants/appConstants";

import { useAuth } from "../context/AuthContext";

import {
  createOrUpdateUserProfile,
  createServiceRequest,
  getAvailableMechanicsByArea,
  getRequestsForCustomer,
  hasActiveRequestBetweenUsers,
} from "../services/firestoreService";

import { notifyMechanicAboutNewRequest } from "../services/notificationService";

import { getCurrentLocation } from "../utils/locationService";
import { getMechanicAreaLocation } from "../utils/mechanicLocationService";

const CustomerDashboard = () => {

  const { currentUser, profile, refreshProfile } = useAuth();

  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedArea, setSelectedArea] = useState(AREAS[0]);

  const [mechanics, setMechanics] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);

  const [error, setError] = useState("");
  const [notificationWarning, setNotificationWarning] = useState("");
  const [requestProgressMessage, setRequestProgressMessage] = useState("");

  const [requestModalMechanic, setRequestModalMechanic] = useState(null);
  const [selectedServiceType, setSelectedServiceType] = useState(SERVICE_TYPES[0]);

  const areaOptions = getAreasForCity(selectedCity);

  const activeRequestsByMechanic = requests.reduce((acc, request) => {

    if (["Pending", "Accepted"].includes(request.status)) {
      acc[request.mechanicId] = request.status;
    }

    return acc;

  }, {});

  useEffect(() => {

    if (profile?.city) setSelectedCity(profile.city);

    if (profile?.serviceArea) {

      setSelectedArea(
        normalizeAreaName(profile.city || selectedCity, profile.serviceArea)
      );

    }

  }, [profile]);

  const loadData = useCallback(async () => {

    if (!currentUser?.uid) {
      setLoading(false);
      setError("User not authenticated.");
      return;
    }

    setLoading(true);
    setError("");
    setNotificationWarning("");

    try {

      const mechanicPromise = getAvailableMechanicsByArea(
        selectedCity,
        selectedArea
      );

      const requestPromise = getRequestsForCustomer(currentUser.uid);

      const [mechanicResult, requestResult] =
        await Promise.allSettled([
          mechanicPromise,
          requestPromise,
        ]);

      if (mechanicResult.status === "fulfilled") {
        setMechanics(mechanicResult.value || []);
      }

      if (requestResult.status === "fulfilled") {
        setRequests(requestResult.value || []);
      }

    } catch {

      setError("Unable to load dashboard.");

    } finally {

      setLoading(false);

    }

  }, [currentUser, selectedArea, selectedCity]);

  useEffect(() => {

    loadData();

  }, [loadData]);

  const saveLocation = async (city, area) => {

    if (!currentUser?.uid) return;

    const normalizedArea = normalizeAreaName(city, area);

    setSelectedCity(city);
    setSelectedArea(normalizedArea);

    await createOrUpdateUserProfile(currentUser.uid, {

      role: "customer",
      city,
      serviceArea: normalizedArea,

      name: profile?.name || currentUser.displayName || "Customer",
      email: profile?.email || currentUser.email || "",

    });

    await refreshProfile(currentUser.uid);

  };

  const handleCityChange = async (city) => {

    const nextAreas = getAreasForCity(city);

    await saveLocation(city, nextAreas[0]);

  };

  const handleAreaChange = async (area) => {

    await saveLocation(selectedCity, normalizeAreaName(selectedCity, area));

  };

  const handleRequest = async (mechanic) => {

    setSelectedServiceType(SERVICE_TYPES[0]);
    setRequestModalMechanic(mechanic);

  };

  const closeRequestModal = () => {

    if (capturingLocation || creatingRequest) return;

    setRequestModalMechanic(null);

  };

  const confirmRequest = async () => {

    if (!requestModalMechanic || creatingRequest) return;

    setCreatingRequest(true);
    setCapturingLocation(true);

    setError("");
    setNotificationWarning("");
    setRequestProgressMessage("Checking for any active request with this mechanic...");

    try {

      const alreadyHasActiveRequest =
        activeRequestsByMechanic[requestModalMechanic.id] ||
        (await hasActiveRequestBetweenUsers(
          currentUser.uid,
          requestModalMechanic.id
        ));

      if (alreadyHasActiveRequest) {

        setError(
          "You already have an active request with this mechanic."
        );

        return;

      }

      let customerLocation = null;
      setRequestProgressMessage("Pinning your location as quickly as possible...");

      try {

        customerLocation = await getCurrentLocation();

      } catch {

        console.warn("GPS not available. Sending request without location.");

      }

      const mechanicLocation = getMechanicAreaLocation(
        requestModalMechanic.city,
        requestModalMechanic.serviceArea
      );
      setRequestProgressMessage("Sending your request to the mechanic...");

      const requestId = await createServiceRequest({

        customerId: currentUser.uid,
        customerName: profile?.name || "Customer",

        mechanicId: requestModalMechanic.id,
        mechanicName: requestModalMechanic.name,

        garageName: requestModalMechanic.garageName,
        mechanicPhoneNumber: requestModalMechanic.phoneNumber,

        mechanicCity: requestModalMechanic.city,
        mechanicServiceArea: requestModalMechanic.serviceArea,
        mechanicLocation,

        city: selectedCity,
        area: selectedArea,

        serviceType: selectedServiceType,
        customerLocation,

        createdAt: new Date(),

      });

      try {
        setRequestProgressMessage("Delivering instant alert to the mechanic...");

        await notifyMechanicAboutNewRequest({
          currentUser,
          requestId,
        });

      } catch {

        setNotificationWarning(
          "Request created, but notification failed."
        );

      }

      await loadData();

      setRequestModalMechanic(null);
      setRequestProgressMessage("");

    } catch (err) {

      setError(
        err.message || "Unable to create service request."
      );

    } finally {

      setCapturingLocation(false);
      setCreatingRequest(false);
      setRequestProgressMessage("");

    }

  };

  if (loading) {

    return (
      <div className="flex justify-center pt-20">
        <Loader label="Loading dashboard..." />
      </div>
    );

  }

  return (

    <div className="space-y-8">

      {/* LOCATION */}

      <section className="card">

        <h2 className="text-xl font-semibold">
          Find Nearby Mechanics
        </h2>

        <p className="text-muted text-sm mt-1">
          Choose your location to view available mechanics.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mt-6">

          <div>

            <label className="input-label">
              City
            </label>

            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="input"
            >
              {CITY_OPTIONS.map((cityOption) => (
                <option key={cityOption}>
                  {cityOption}
                </option>
              ))}
            </select>

          </div>

          <div>

            <label className="input-label">
              Area
            </label>

            <select
              value={selectedArea}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="input"
            >
              {areaOptions.map((area) => (
                <option key={area}>
                  {area}
                </option>
              ))}
            </select>

          </div>

        </div>

      </section>

      {error && (
        <div className="badge badge-danger">
          {error}
        </div>
      )}

      {notificationWarning && (
        <div className="badge badge-warning">
          {notificationWarning}
        </div>
      )}

      {(capturingLocation || creatingRequest) && (
        <Loader
          compact
          label="Preparing your request"
          detail={
            requestProgressMessage ||
            "We are collecting your location and reaching the selected mechanic."
          }
        />
      )}

      {/* MECHANICS */}

      <section>

        <h3 className="text-lg font-semibold mb-4">

          Available Mechanics in {selectedArea}, {selectedCity}

        </h3>

        {mechanics.length === 0 ? (

          <div className="card text-center text-muted">
            No mechanics available in this area.
          </div>

        ) : (

          <div className="grid gap-4 md:grid-cols-2">

            {mechanics.map((mechanic) => (

              <MechanicCard
                key={mechanic.id}
                mechanic={mechanic}
                onRequest={handleRequest}
                requestDisabled={
                  Boolean(activeRequestsByMechanic[mechanic.id])
                }
                requestLabel={
                  activeRequestsByMechanic[mechanic.id]
                    ? `Request ${activeRequestsByMechanic[mechanic.id]}`
                    : "Request Help"
                }
              />

            ))}

          </div>

        )}

      </section>

      {/* REQUEST HISTORY */}

      <section className="card">

        <h3 className="text-lg font-semibold mb-4">
          My Service Requests
        </h3>

        <RequestList requests={requests} />

      </section>

      {/* REQUEST MODAL */}

      {requestModalMechanic && (

        <div className="modal-backdrop" onClick={closeRequestModal}>

          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >

            <h3 className="text-xl font-semibold">
              {requestModalMechanic.garageName}
            </h3>

            <p className="text-muted text-sm">
              Mechanic: {requestModalMechanic.name}
            </p>

            <p className="text-muted text-sm mb-4">
              {requestModalMechanic.serviceArea}, {requestModalMechanic.city}
            </p>

            <div className="service-option-grid">

              {SERVICE_TYPES.map((serviceType) => (

                <button
                  key={serviceType}
                  type="button"
                  onClick={() =>
                    setSelectedServiceType(serviceType)
                  }
                  className={`service-option-card ${
                    selectedServiceType === serviceType
                      ? "service-option-card-active"
                      : ""
                  }`}
                >
                  {serviceType}
                </button>

              ))}

            </div>

            <div className="mt-6 flex gap-3">

              <button
                onClick={confirmRequest}
                className="btn-primary"
                disabled={capturingLocation || creatingRequest}
              >
                {capturingLocation
                  ? "Sending Request..."
                  : "Confirm Request"}
              </button>

              <button
                onClick={closeRequestModal}
                className="btn-secondary"
                disabled={capturingLocation}
              >
                Cancel
              </button>

            </div>

            {(capturingLocation || creatingRequest) && (
              <div className="mt-6">
                <Loader
                  compact
                  label="Request in progress"
                  detail={
                    requestProgressMessage ||
                    "This usually finishes in a few seconds."
                  }
                />
              </div>
            )}

          </div>

        </div>

      )}

    </div>

  );

};

export default CustomerDashboard;
