// 🟢 main.js — Pulse hydration version (matched to new renderPulse.js)

(() => {
  "use strict";

  const PULSE_BASE = "https://pulse-worker.bob-b5c.workers.dev";

  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------
  // Pulse shell mount (ONCE ONLY)
  // --------------------------------------------------
  function ensurePulseShellMounted() {
    const results = $("results");
    if (!results) return false;

    if (!results.querySelector("#pulse-shell")) {
      results.innerHTML = window.renderPulseShell();
    }

    return true;
  }

  // --------------------------------------------------
  // Pulse render pipeline (HYDRATION ONLY)
  // --------------------------------------------------
  window.updatePulseView = function (viewModel) {
    if (!ensurePulseShellMounted()) return;

    if (typeof window.hydratePulseView === "function") {
      window.hydratePulseView(viewModel || {});
    }
  };

  // --------------------------------------------------
  // Load Pulse dashboard
  // --------------------------------------------------
  async function loadPulseDashboard() {
    ensurePulseShellMounted();

    // loading state
    window.updatePulseView(
      window.buildPulseViewModel(null, null, { isLoading: true })
    );

    try {
      const [analysisRes, summaryRes] = await Promise.all([
        fetch(`${PULSE_BASE}/pulse/failure-analysis`),
        fetch(`${PULSE_BASE}/pulse/summary`)
      ]);

      const analysis = await analysisRes.json().catch(() => null);
      const summary = await summaryRes.json().catch(() => null);

      if (!analysisRes.ok || !analysis?.ok) {
        console.warn("Pulse analysis failed");
        return;
      }

      if (!summaryRes.ok || !summary?.ok) {
        console.warn("Pulse summary failed");
        return;
      }

      window.updatePulseView(
        window.buildPulseViewModel(analysis, summary)
      );

    } catch (err) {
      console.error("Pulse load error:", err);
    }
  }

  // expose
  window.loadPulseDashboard = loadPulseDashboard;
  window.doPulseDashboard = loadPulseDashboard;

  // --------------------------------------------------
  // Radar actions (Pause / Retry / Resume)
  // --------------------------------------------------
  async function pulseAction(endpoint, payload) {
    try {
      const res = await fetch(
        `${PULSE_BASE}${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {})
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        window.showPulseBanner?.("Action failed", "error");
        return;
      }

      window.showPulseBanner?.("Action applied", "success");

      // 🔥 refresh dashboard after action
      await loadPulseDashboard();

    } catch (err) {
      console.error("Pulse action error:", err);
      window.showPulseBanner?.("Network error", "error");
    }
  }

  // expose action helpers
  window.pulsePauseGateway = (gateway) =>
    pulseAction("/radar/action/pause", { gateway });

  window.pulseRetryGateway = (gateway) =>
    pulseAction("/radar/action/retry", { gateway });

  window.pulseResumeGateway = (gateway) =>
    pulseAction("/radar/action/resume", { gateway });

  // --------------------------------------------------
  // Affected customers (expand/collapse)
  // --------------------------------------------------
  window.loadAffectedCustomers = async function (gateway, container) {
    if (!gateway || !container) return;

    try {
      container.innerHTML = "Loading…";

      const res = await fetch(
        `${PULSE_BASE}/pulse/affected-customers?gateway=${encodeURIComponent(gateway)}`
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        container.innerHTML = "Failed to load";
        return;
      }

      const customers = Array.isArray(data.customers) ? data.customers : [];

      container.innerHTML = customers.length
        ? customers.map(c => `
            <div class="pulse-customer-row">
              <div class="pulse-customer-email"
                   data-email="${c.email}"
                   style="cursor:pointer;text-decoration:underline;">
                ${c.email}
              </div>
              <div>${c.count} failures</div>
              <div>${c.total}</div>
            </div>
          `).join("")
        : `<div>No affected customers</div>`;

      // click → search
      container.querySelectorAll(".pulse-customer-email").forEach((el) => {
        el.addEventListener("click", () => {
          if (typeof window.runSearch === "function") {
            window.runSearch(el.dataset.email);
          }
        });
      });

    } catch (err) {
      console.error("Affected customers error:", err);
      container.innerHTML = "Error loading customers";
    }
  };
  // --------------------------------------------------
  // Scanner trigger (manual run)
  // --------------------------------------------------
  window.runPulseScan = async function () {
    try {
      window.showPulseBanner?.("Running scan…", "info");

      const res = await fetch(`${PULSE_BASE}/scanner/run`, {
        method: "POST"
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        window.showPulseBanner?.("Scan failed", "error");
        return;
      }

      // store last scan snapshot for delta
      try {
        localStorage.setItem(
          "pulse_last_scan",
          JSON.stringify({
            ts: Date.now(),
            failed: data.failed_subscriptions || 0,
            recoverable: data.recoverable_revenue || 0
          })
        );
      } catch (_) {}

      window.showPulseBanner?.("Scan complete", "success");

      await loadPulseDashboard();

    } catch (err) {
      console.error("Scan error:", err);
      window.showPulseBanner?.("Scan error", "error");
    }
  };

  // --------------------------------------------------
  // Lightweight navigation helpers (non-destructive)
  // --------------------------------------------------
  window.showPulse = function () {
    loadPulseDashboard();
  };

  window.refreshPulse = function () {
    loadPulseDashboard();
  };

  // --------------------------------------------------
  // Initial load (safe)
  // --------------------------------------------------
  window.addEventListener("DOMContentLoaded", () => {
    // Only auto-load if Pulse is the current view
    const results = $("results");
    if (!results) return;

    // Do NOT wipe other views — only mount if empty
    if (!results.innerHTML.trim()) {
      loadPulseDashboard();
    }
  });
  // --------------------------------------------------
  // Backward compatibility (SAFE)
  // --------------------------------------------------
  // Some parts of the app may still call legacy Pulse functions.
  // We keep them wired, but they now route through hydration.

  window.renderPulseDashboard = function (analysis, summary) {
    // DO NOT return HTML anymore
    // Instead, route into hydration pipeline

    const vm = window.buildPulseViewModel(analysis, summary);
    window.updatePulseView(vm);

    return ""; // prevent old callers from injecting HTML
  };

  window.renderPulseLoadingShell = function () {
    const vm = window.buildPulseViewModel(null, null, { isLoading: true });
    window.updatePulseView(vm);
    return "";
  };

  window.renderPulseLoadingShellSafe = window.renderPulseLoadingShell;
})();