const MechanicCard = ({
  mechanic,
  onRequest,
  requestDisabled = false,
  requestLabel = "Request Help",
}) => {
  return (
    <div className="card flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-semibold">
          {mechanic.name}
        </h3>

        <p className="text-muted text-sm mt-1">
          {mechanic.garageName}
        </p>

        <div className="mt-4 space-y-1 text-sm text-muted">
          <p>Phone: +91 {mechanic.phoneNumber}</p>
          <p>Area: {mechanic.serviceArea}, {mechanic.city}</p>
          <p>Experience: {mechanic.experienceYears} years</p>

          {mechanic.estimatedEtaMinutes != null && (
            <p>
              ETA: {mechanic.estimatedEtaMinutes} min
              {mechanic.distanceKm != null
                ? ` | ${mechanic.distanceKm.toFixed(1)} km`
                : ""}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {mechanic.services?.map((service) => (
            <span
              key={service}
              className="badge"
            >
              {service}
            </span>
          ))}
        </div>

        <div className="mt-4">
          <span
            className={
              mechanic.availabilityStatus === "busy"
                ? "badge badge-warning"
                : "badge badge-success"
            }
          >
            {mechanic.availabilityStatus || "available"}
          </span>

          {mechanic.rank === 1 && (
            <span className="badge badge-warning ml-2">
              Closest Match
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRequest(mechanic)}
        disabled={requestDisabled}
        className={`btn-primary w-full mt-6 ${
          requestDisabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {requestLabel}
      </button>
    </div>
  );
};

export default MechanicCard;
