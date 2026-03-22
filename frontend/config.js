(function () {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const API_BASE = isLocal
    ? "http://localhost:5000/api"
    : "https://mahima-chatrabas-backend.onrender.com/api/";

  window.APP_CONFIG = {
    API_BASE
  };
})();
