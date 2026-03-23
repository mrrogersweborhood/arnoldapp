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
  <div class="pulse-modal-intro">
    ${body}
  </div>

  <div class="pulse-modal-meta">
    Gateway
    <strong>${esc(window.__pulseModalGateway || "unknown")}</strong>
  </div>

  <div class="pulse-modal-section-label">
    Recommended action
  </div>

  <div class="pulse-modal-actions-primary">
    <button class="pulse-modal-action-btn primary" data-action="retry">
      Move to Retry Queue
    </button>
  </div>

  <div class="pulse-modal-section-label secondary">
    Other actions
  </div>

  <div class="pulse-modal-actions-secondary">
    <button class="pulse-modal-action-btn danger" data-action="pause">
      Pause Retries
    </button>

    <button class="pulse-modal-action-btn" data-action="resume">
      Resume Paused
    </button>

    <button class="pulse-modal-action-btn ghost" data-action="customers">
      View Affected Customers
    </button>
  </div>
`;

    modal.classList.remove("hidden");
  }

  function closePulseModal() {
    const modal = document.getElementById("pulse-modal");
    if (!modal) return;
    modal.classList.add("hidden");
  }
  function formatPulseMoney(value) {
    const amount = Number(value || 0) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(amount);
  }

  function renderAffectedCustomersModal(gateway, data) {
    const modalTitle = document.getElementById("pulse-modal-title");
    const modalBody = document.getElementById("pulse-modal-body");

    if (!modalTitle || !modalBody) return;

    const customers = Array.isArray(data?.customers) ? data.customers : [];
    const count = Number(data?.count || customers.length || 0);

    modalTitle.textContent = `${String(gateway || "Gateway").toUpperCase()} Affected Customers`;

    if (!customers.length) {
      modalBody.innerHTML = `
        <div style="margin-bottom:16px;">
          No affected customers were returned for <strong>${esc(gateway)}</strong>.
        </div>
      `;
      return;
    }

    modalBody.innerHTML = `
      <div style="margin-bottom:16px;">
        <strong>${count}</strong> affected customer${count === 1 ? "" : "s"} for
        <strong>${esc(gateway)}</strong>.
      </div>

      <div style="overflow:auto; border:1px solid rgba(255,255,255,.12); border-radius:14px;">
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <thead>
            <tr style="background:rgba(255,255,255,.06); text-align:left;">
              <th style="padding:10px 12px;">Email</th>
              <th style="padding:10px 12px;">Amount</th>
              <th style="padding:10px 12px;">Reason</th>
              <th style="padding:10px 12px;">Status</th>
              <th style="padding:10px 12px;">Order</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map((row) => `
              <tr data-email="${esc(row?.email || "")}" style="border-top:1px solid rgba(255,255,255,.08); cursor:pointer;">
                <td style="padding:10px 12px;">${esc(row?.email || "—")}</td>
                <td style="padding:10px 12px;">${esc(formatPulseMoney(row?.amount))}</td>
                <td style="padding:10px 12px;">${esc(row?.reason || "—")}</td>
                <td style="padding:10px 12px;">${esc(String(row?.status || "—").toUpperCase())}</td>
                <td style="padding:10px 12px;">${esc(row?.order_id || "—")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    // CLICK HANDLER: open customer in full UI
modalBody.querySelectorAll("tr[data-email]").forEach((rowEl) => {
  rowEl.addEventListener("click", () => {
    const email = rowEl.getAttribute("data-email");
    if (!email) return;

    closePulseModal();

    if (typeof window.doSearch === "function") {
      window.doSearch(email);
    } else {
      console.error("doSearch is not available on window");
    }
  });
});
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

if (action === "customers") {
  fetch(`https://pulse-worker.bob-b5c.workers.dev/pulse/affected-customers?gateway=${encodeURIComponent(gateway)}`, {
    method: "GET"
  })
    .then((r) => r.json())
    .then((data) => {
      btn.disabled = false;
      btn.textContent = originalLabel;

      if (!data?.ok) {
        showPulseBanner(`Failed to load affected customers for ${gateway}`, "error");
        return;
      }

      const customers = Array.isArray(data?.customers) ? data.customers : [];

      if (!customers.length) {
        showPulseBanner(`No affected customers for ${gateway}`, "error");
        return;
      }

closePulseModal();

if (typeof window.setPulseAffectedCustomers === "function") {
  window.setPulseAffectedCustomers(gateway, data);
} else {
  console.error("setPulseAffectedCustomers is not available on window");
}
    })
    .catch((err) => {
      console.error(err);
      btn.disabled = false;
      btn.textContent = originalLabel;
      showPulseBanner("Failed to load affected customers", "error");
    });

  return;
}

    const endpoint =
      action === "pause"
        ? "https://pulse-worker.bob-b5c.workers.dev/radar/action/pause"
        : action === "retry"
        ? "https://pulse-worker.bob-b5c.workers.dev/radar/action/retry"
        : action === "resume"
        ? "https://pulse-worker.bob-b5c.workers.dev/radar/action/resume"
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

const count = Number(data?.affected_count || 0);

if (data?.simulated === true) {
  showPulseBanner(
    data?.message ||
      `TEST MODE: ${count} subscription${count === 1 ? "" : "s"} simulated for ${gateway}. No live records were changed.`,
    "success"
  );
} else {
  showPulseBanner(
    `${count} subscription${count === 1 ? "" : "s"} updated for ${gateway}`,
    "success"
  );
}

closePulseModal();

// 🔥 CRITICAL FIX — force backend re-fetch (no stale UI)
if (typeof window.loadPulseDashboard === "function") {
  console.log("Refreshing Pulse dashboard via loadPulseDashboard()");
  window.loadPulseDashboard();
} else if (typeof window.doPulseDashboard === "function") {
  console.warn("loadPulseDashboard not found, falling back to doPulseDashboard()");
  window.doPulseDashboard();
} else {
  console.warn("No dashboard refresh function found — forcing reload");
  window.location.reload();
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

    const analysis = window.__pulseLastAnalysis || {};
    const gateways = Array.isArray(analysis?.gateways) ? analysis.gateways : [];
    const gatewayData = gateways.find(
      (g) => String(g?.gateway || "").trim().toLowerCase() === String(gateway).trim().toLowerCase()
    ) || null;

    const gatewayIncidents = Array.isArray(analysis?.gateway_incidents) ? analysis.gateway_incidents : [];
    const incidentData = gatewayIncidents.find(
      (g) => String(g?.gateway || "").trim().toLowerCase() === String(gateway).trim().toLowerCase()
    ) || null;

    const confidencePct = Number(
      incidentData?.confidence != null
        ? Number(incidentData.confidence) * 100
        : 0
    );

    const customersAtRisk = Number(
      incidentData?.customers_at_risk != null
        ? incidentData.customers_at_risk
        : gatewayData?.customers_at_risk
    ) || 0;

    const revenueAtRisk = Number(gatewayData?.recoverable_revenue || 0) || 0;

    openPulseModal(
      gateway.toUpperCase() + " Recovery Action",

      action === "RETRY_LATER"
        ? `
? `
  <div class="pulse-modal-signal pulse-modal-signal-danger">
    ⚠️ High-confidence gateway outage detected
  </div>

  <div class="pulse-modal-badge">
    ${esc(confidencePct.toFixed(0))}% confidence
  </div>

  <div class="pulse-modal-impact">
    <span>${esc(String(customersAtRisk))} customer${customersAtRisk === 1 ? "" : "s"}</span>
    <strong>${esc(formatPulseMoney(revenueAtRisk))}</strong>
  </div>

  <div style="margin-bottom:12px;">
    Retrying payments now will likely continue to fail.
  </div>

  <div style="margin-bottom:12px;">
    <strong>Recommended:</strong> Pause retries and wait for gateway recovery.
  </div>

  <div style="font-size:13px; opacity:.75;">
    Resume once successful payments are observed.
  </div>
`

          <div style="margin-bottom:10px;">
            <strong>${esc(confidencePct.toFixed(0))}% confidence</strong> that current failures are gateway-related.
          </div>

          <div style="margin-bottom:10px;">
            <strong>${esc(String(customersAtRisk))}</strong> customer${customersAtRisk === 1 ? "" : "s"} at risk •
            <strong>${esc(formatPulseMoney(revenueAtRisk))}</strong> recoverable revenue
          </div>

          <div style="margin-bottom:12px;">
            Retrying payments now will likely continue to fail.
          </div>

          <div style="margin-bottom:12px;">
            <strong>Recommended:</strong> Pause retries and wait for gateway recovery.
          </div>

          <div style="font-size:13px; opacity:.75;">
            Retries can resume once successful payments are observed again.
          </div>
        `

                : action === "RETRY_NOW"
        ? `
          <div class="pulse-modal-signal pulse-modal-signal-positive">
            ⚡ Recovery opportunity detected
          </div>

          <div class="pulse-modal-impact">
            <span>${esc(String(customersAtRisk))} ready for retry</span>
            <strong>${esc(formatPulseMoney(revenueAtRisk))}</strong>
          </div>

          <div style="margin-bottom:12px;">
            Failed payments appear recoverable.
          </div>

          <div style="margin-bottom:12px;">
            <strong>Recommended:</strong> Move subscriptions into the retry queue now.
          </div>

          <div style="font-size:13px; opacity:.75;">
            Pulse will attempt recovery automatically.
          </div>
        `

        : `
          <div style="font-size:16px; font-weight:900; margin-bottom:10px;">
            ℹ️ Monitoring only
          </div>

          <div style="margin-bottom:10px;">
            <strong>${esc(String(customersAtRisk))}</strong> customer${customersAtRisk === 1 ? "" : "s"} currently affected •
            <strong>${esc(formatPulseMoney(revenueAtRisk))}</strong> recoverable revenue
          </div>

          <div style="margin-bottom:12px;">
            No immediate action is recommended.
          </div>

          <div style="font-size:13px; opacity:.75;">
            Pulse will continue watching for changes in gateway behavior.
          </div>
        `
    );
  });
})();