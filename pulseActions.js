// 🟢 pulseActions.js
// Pulse modal + action system extracted from renderPulse.js

(() => {
  "use strict";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function showPulseBanner(message, type = "success") {
    let banner = document.getElementById("pulse-action-banner");

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pulse-action-banner";
      document.body.appendChild(banner);
    }

    banner.textContent = message;
    banner.className = `pulse-action-banner pulse-action-banner-${type}`;
    banner.style.display = "block";

    setTimeout(() => {
      banner.style.display = "none";
    }, 3000);
  }

  function openPulseModal(title, body) {
    const modal = document.getElementById("pulse-modal");
    if (!modal) return;

    document.getElementById("pulse-modal-title").textContent = title;

    document.getElementById("pulse-modal-body").innerHTML = `
      <div style="margin-bottom:16px;">${body}</div>
      <div style="font-size:14px; color:#5b5670; margin-bottom:16px;">
        Gateway: <strong>${esc(window.__pulseModalGateway || "unknown")}</strong>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="pulse-modal-action-btn" data-action="pause">Pause Retries</button>
        <button class="pulse-modal-action-btn" data-action="retry">Move to Retry Queue</button>
        <button class="pulse-modal-action-btn" data-action="customers">View Customers</button>
      </div>
    `;

    modal.classList.remove("hidden");
  }

  function closePulseModal() {
    const modal = document.getElementById("pulse-modal");
    if (!modal) return;
    modal.classList.add("hidden");
  }

  // CLOSE HANDLER
  document.addEventListener("click", function (e) {
    if (
      e.target.id === "pulse-modal-close" ||
      e.target.id === "pulse-modal-ok" ||
      e.target.classList.contains("pulse-modal-backdrop")
    ) {
      closePulseModal();
    }
  });

  // ACTION HANDLER
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".pulse-modal-action-btn");
    if (!btn) return;

    const action = String(btn.getAttribute("data-action") || "").trim();
    const gateway = window.__pulseModalGateway || null;

    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = "Processing...";

    if (!gateway) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      showPulseBanner("Missing gateway context", "error");
      return;
    }

    const endpoint =
      action === "pause"
        ? "https://pulse-worker.bob-b5c.workers.dev/radar/action/pause"
        : action === "retry"
        ? "https://pulse-worker.bob-b5c.workers.dev/radar/action/retry"
        : null;

    if (!endpoint) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      showPulseBanner("Action not implemented yet", "error");
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway })
    })
      .then((r) => r.json())
      .then((data) => {
        btn.disabled = false;
        btn.textContent = originalLabel;

        if (!data?.ok) {
          showPulseBanner(`Action failed for ${gateway}`, "error");
          return;
        }

        showPulseBanner(`Updated ${gateway} successfully`, "success");

        closePulseModal();

        if (typeof window.doPulseDashboard === "function") {
          window.doPulseDashboard();
        }
      })
      .catch((err) => {
        console.error(err);
        btn.disabled = false;
        btn.textContent = originalLabel;
        showPulseBanner("Action failed", "error");
      });
  });

  // TRIGGER HANDLERS
  document.addEventListener("click", function (e) {
    const trigger =
      e.target.closest(".pulse-action-pill") ||
      e.target.closest(".pulse-incident-strip-action");

    if (!trigger) return;

    const action = String(trigger.getAttribute("data-action") || "").trim();
    const gateway = String(trigger.getAttribute("data-gateway") || "").trim();

    if (!action || !gateway) return;

    window.__pulseModalGateway = gateway;

    openPulseModal(
      gateway.toUpperCase() + " Recovery Action",
      action === "RETRY_LATER"
        ? "Pause retries.<br>Wait for gateway recovery.<br>Retry once successful payments resume."
        : action === "RETRY_NOW"
        ? "Retry failed payments immediately."
        : "Monitor gateway activity."
    );
  });
})();