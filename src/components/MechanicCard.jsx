const MechanicCard = ({
  mechanic,
  onRequest,
  requestDisabled = false,
  requestLabel = "Request Help",
}) => {

  return (

    <div className="card flex flex-col justify-between">

      {/* TOP SECTION */}

      <div>

        {/* NAME */}

        <h3 className="text-lg font-semibold">
          {mechanic.name}
        </h3>

        <p className="text-muted text-sm mt-1">
          {mechanic.garageName}
        </p>

        {/* DETAILS */}

        <div className="mt-4 space-y-1 text-sm text-muted">

          <p>
            📞 +91 {mechanic.phoneNumber}
          </p>

          <p>
            📍 {mechanic.serviceArea}, {mechanic.city}
          </p>

          <p>
            🛠 {mechanic.experienceYears} years experience
          </p>

        </div>

        {/* SERVICES */}

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

        {/* STATUS */}

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

        </div>

      </div>

      {/* ACTION */}

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
