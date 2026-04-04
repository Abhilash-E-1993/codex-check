const Loader = ({
  label = 'Loading...',
  detail = '',
  fullScreen = false,
  compact = false,
}) => (
  <div
    className={`loader-shell ${fullScreen ? 'loader-shell-fullscreen' : ''} ${
      compact ? 'loader-shell-compact' : ''
    }`}
  >
    <div className="loader-orbit">
      <span className="loader-core" />
      <span className="loader-ring loader-ring-one" />
      <span className="loader-ring loader-ring-two" />
    </div>

    <div className="loader-copy">
      <p className="loader-label">{label}</p>
      {detail && <p className="loader-detail">{detail}</p>}
    </div>
  </div>
);

export default Loader;
