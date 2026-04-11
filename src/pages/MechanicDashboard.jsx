import { useEffect, useState } from "react";

import Loader from "../components/Loader";
import RequestList from "../components/RequestList";

import { useAuth } from "../context/AuthContext";

import {
  getRequestsForMechanic,
  requestCompletionOTP,
  updateRequestStatus,
  verifyCompletionOTP,
} from "../services/firestoreService";

import {
  advanceRequestToNextMechanic,
  notifyCustomerAboutAcceptedRequest,
} from "../services/notificationService";

const MechanicDashboard = () => {

  const { currentUser, profile, refreshProfile } = useAuth();

  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingStatusMessage, setSavingStatusMessage] = useState("");

  const [error, setError] = useState("");
  const [notificationWarning, setNotificationWarning] = useState("");

  const loadRequests = async () => {

    if (!currentUser?.uid) return;

    setLoading(true);

    try {

      const requestList = await getRequestsForMechanic(
        currentUser.uid
      );

      // sort requests
      const sorted = (requestList || []).sort((a, b) => {

        const priority = {
          Pending: 1,
          Accepted: 2,
          Completed: 3,
          Cancelled: 4,
        };

        return priority[a.status] - priority[b.status];

      });

      setRequests(sorted);

    } catch {

      setError("Unable to load requests.");

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    loadRequests();

  }, [currentUser]);

  const mechanicBusy = requests.some(
    (req) => req.status === "Accepted"
  );

  const handleRequestAction = async (requestId, nextStatus) => {

    if (savingStatus) return;

    try {

      if (nextStatus === "Accepted" && mechanicBusy) {

        setError(
          "You already have an active job. Complete it first."
        );

        return;

      }

      setSavingStatus(true);
      setError("");
      setNotificationWarning("");
      setSavingStatusMessage("Updating the request status...");

      if (nextStatus === "Rejected") {
        setSavingStatusMessage("Offering the request to the next nearest mechanic...");

        await advanceRequestToNextMechanic({
          currentUser,
          requestId,
        });
      } else {
        await updateRequestStatus(
          requestId,
          nextStatus,
          currentUser.uid
        );
      }

      if (nextStatus === "Accepted") {

        try {
          setSavingStatusMessage("Notifying the customer that you are on the way...");

          await notifyCustomerAboutAcceptedRequest({
            currentUser,
            requestId,
          });

        } catch {

          setNotificationWarning(
            "Request accepted but customer notification failed."
          );

        }

      }

      await refreshProfile(currentUser.uid);

      await loadRequests();

    } catch (err) {

      setError(
        err.message || "Unable to update request status."
      );

    } finally {

      setSavingStatus(false);
      setSavingStatusMessage("");

    }

  };

  const handleGenerateOtp = async (requestId) => {

    if (savingStatus) return;

    try {

      setSavingStatus(true);
      setError("");
      setSavingStatusMessage("Generating secure completion OTP...");

      await requestCompletionOTP(
        requestId,
        currentUser.uid
      );

      await loadRequests();

    } catch (err) {

      setError(
        err.message ||
        "Unable to generate completion OTP."
      );

    } finally {

      setSavingStatus(false);
      setSavingStatusMessage("");

    }

  };

  const handleVerifyOtp = async (requestId, otp) => {

    if (savingStatus) return;

    setSavingStatus(true);
    setError("");
    setSavingStatusMessage("Verifying OTP and closing the request...");

    try {

      await verifyCompletionOTP(
        requestId,
        currentUser.uid,
        otp
      );

      await refreshProfile(currentUser.uid);

      await loadRequests();

    } catch (err) {

      setError(
        err.message ||
        "Invalid OTP. Please ask the customer again."
      );

      throw err;

    } finally {

      setSavingStatus(false);
      setSavingStatusMessage("");

    }

  };

  if (loading) {

    return (
      <div className="flex justify-center pt-20">
        <Loader label="Loading mechanic dashboard..." />
      </div>
    );

  }

  return (

    <div className="space-y-8">

      {/* DASHBOARD HEADER */}

      <section className="card">

        <h2 className="text-xl font-semibold">
          Mechanic Dashboard
        </h2>

        <p className="text-muted text-sm mt-1">
          Manage incoming breakdown service requests.
        </p>

        <div className="mt-5 flex items-center gap-3">

          <span className="text-sm text-muted">
            Current Status
          </span>

          <span
            className={
              profile?.availabilityStatus === "busy"
                ? "badge badge-warning"
                : "badge badge-success"
            }
          >
            {profile?.availabilityStatus || "available"}
          </span>

        </div>

      </section>

      {/* STATUS UPDATE MESSAGE */}

      {savingStatus && (
        <Loader
          compact
          label="Working on it"
          detail={savingStatusMessage || "Updating request status..."}
        />

      )}

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

      {/* REQUESTS */}

      <section className="card">

        <h3 className="text-lg font-semibold mb-4">
          Incoming Service Requests
        </h3>

        {requests.length === 0 ? (

          <div className="text-muted text-center">
            No service requests yet.
          </div>

        ) : (

          <RequestList
            requests={requests}
            forMechanic
            acceptanceBlocked={mechanicBusy}
            onAction={handleRequestAction}
            onGenerateOtp={handleGenerateOtp}
            onVerifyOtp={handleVerifyOtp}
          />

        )}

      </section>

    </div>

  );

};

export default MechanicDashboard;
