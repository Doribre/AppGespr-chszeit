(function registerCrossOriginIsolationWorker() {
  const reloadKey = "schwaetzometer-coi-reloaded";

  if (window.crossOriginIsolated || !window.isSecureContext || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register("./coi-serviceworker.js")
    .then(() => {
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            if (sessionStorage.getItem(reloadKey) !== "1") {
              sessionStorage.setItem(reloadKey, "1");
              window.location.reload();
            }
          },
          { once: true }
        );
        return;
      }

      if (sessionStorage.getItem(reloadKey) !== "1") {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
    })
    .catch((error) => {
      console.warn("Cross-origin isolation service worker could not be registered.", error);
    });
})();
