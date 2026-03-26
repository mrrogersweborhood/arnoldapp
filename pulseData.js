// 🟢 pulseData.js
// Pulse data access layer (no rendering logic)

(function () {
  "use strict";

  // ---------------------------------------
  // Fetch affected customers by gateway
  // ---------------------------------------
  window.fetchPulseAffectedCustomers = async function (gateway) {
    if (!gateway) {
      return { ok: false, customers: [] };
    }

    try {
      const res = await fetch(
        `https://pulse-worker.bob-b5c.workers.dev/pulse/affected-customers?gateway=${encodeURIComponent(gateway)}`
      );

      const data = await res.json();

      if (data?.ok && Array.isArray(data.customers)) {
        return { ok: true, customers: data.customers };
      }

      return { ok: false, customers: [] };

    } catch (err) {
      console.error("fetchPulseAffectedCustomers failed:", err);
      return { ok: false, customers: [] };
    }
  };

})();