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

    const titleEl = document.getElementById("pulse-modal-title");
    const bodyEl = document.getElementById("pulse-modal-body");
    const footerEl = document.getElementById("pulse-modal-footer");
    if (!titleEl || !bodyEl) return;

    modal.classList.remove("store-manager-modal");
    if (footerEl) footerEl.style.display = "";

    titleEl.textContent = title;

    bodyEl.innerHTML = `
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
    const footerEl = document.getElementById("pulse-modal-footer");
    if (!modal) return;

    modal.classList.remove("store-manager-modal");
    if (footerEl) footerEl.style.display = "";

    modal.classList.add("hidden");
    window.__pulseModalGateway = null;
  }

  function formatPulseMoney(value) {
    const amount = Number(value || 0) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(amount);
  }

  const STORE_GATEWAY_OPTIONS = [
    { value: "square", label: "Square" },
    { value: "stripe", label: "Stripe" },
    { value: "paypal", label: "PayPal" }
  ];

  const STORE_EXECUTION_MODE_OPTIONS = [
    { value: "test", label: "Test" },
    { value: "live", label: "Live" }
  ];

    const STORE_TIMEZONE_OPTIONS = [
    { value: "UTC", label: "UTC" },

    { value: "America/New_York", label: "Eastern (New York)" },
    { value: "America/Chicago", label: "Central (Chicago)" },
    { value: "America/Denver", label: "Mountain (Denver)" },
    { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },

    { value: "America/Phoenix", label: "Arizona (Phoenix — no DST)" },

    { value: "America/Anchorage", label: "Alaska (Anchorage)" },
    { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" }
  ];

  function normalizeGatewayForForm(value) {
    const gateway = String(value || "").trim().toLowerCase();
    if (!gateway) return "";
    return gateway;
  }

  function normalizeTimezoneForForm(value) {
    const timezone = String(value || "").trim();
    return timezone || "UTC";
  }

  function buildSelectOptions(options, selectedValue) {
    return options.map((option) => {
      const value = String(option?.value ?? "");
      const label = String(option?.label ?? value);
      const selected = value === String(selectedValue ?? "") ? " selected" : "";
      return `<option value="${esc(value)}"${selected}>${esc(label)}</option>`;
    }).join("");
  }

    function buildTimezoneOptions(selectedValue) {
    return STORE_TIMEZONE_OPTIONS.map((option) => {
      const value = String(option?.value ?? "");
      const label = String(option?.label ?? value);
      const selected = value === String(selectedValue ?? "") ? " selected" : "";
      return `<option value="${esc(value)}"${selected}>${esc(label)}</option>`;
    }).join("");
  }

  function findStoreById(storeId) {
    const stores = Array.isArray(window.__storeManagerPayload?.stores)
      ? window.__storeManagerPayload.stores
      : [];

    return stores.find((row) => String(row?.store_id || "") === String(storeId || "")) || null;
  }

      function renderStoreFormModal(mode, store) {
    const isEdit = String(mode || "").toLowerCase() === "edit";
    const modalTitle = document.getElementById("pulse-modal-title");
    const modalBody = document.getElementById("pulse-modal-body");
    if (!modalTitle || !modalBody) return;

    const storeId = String(store?.store_id || "");
    const storeName = String(store?.store_name || "");
    const storeUrl = String(store?.store_url || "");
    const gateway = normalizeGatewayForForm(store?.gateway || "");
    const executionMode = String(store?.execution_mode || "test").trim().toLowerCase();
    const timezone = normalizeTimezoneForForm(store?.timezone || "UTC");
    const gatewayWindowHours = Number(store?.gateway_activity_window_hours || 24) || 24;
    const allowOrderNoteWrites = Number(store?.allow_order_note_writes || 0) === 1;

    modalTitle.textContent = isEdit ? "Edit Store" : "Create Store";

    modalBody.innerHTML = `
      <div class="store-manager-form-card store-manager-form-card-polished">
        <div class="store-manager-modal-hero">
          <div class="store-manager-modal-kicker">Store Manager</div>
          <div class="store-manager-modal-title-row">
            <div class="store-manager-modal-title-copy">
              <div class="store-manager-modal-title">
                ${isEdit ? "Edit Store Configuration" : "Create Store Configuration"}
              </div>
              <div class="store-manager-modal-subtitle">
                ${isEdit ? "Update monitoring, execution, and WooCommerce write behavior for this store." : "Create a new monitored store for Pulse and define its execution behavior."}
              </div>
            </div>
            <div class="store-manager-modal-badge">
              ${isEdit ? esc(storeId || "Existing Store") : "New Store"}
            </div>
          </div>
        </div>

        <div class="store-manager-form-layout">
          <div class="store-manager-form-main">
            <section class="store-manager-form-section">
              <div class="store-manager-form-section-head">
                <div class="store-manager-form-section-title">Store Identity</div>
                <div class="store-manager-form-section-copy">
                  Core identifiers and storefront address.
                </div>
              </div>

              <div class="store-manager-form-grid">
                <label class="store-manager-field">
                  <span>Store ID</span>
                  <input
                    id="storeFormStoreId"
                    type="text"
                    value="${esc(storeId)}"
                    ${isEdit ? "disabled" : ""}
                    placeholder="primary-store"
                  />
                </label>

                <label class="store-manager-field">
                  <span>Store Name</span>
                  <input
                    id="storeFormStoreName"
                    type="text"
                    value="${esc(storeName)}"
                    placeholder="Main Store"
                  />
                </label>

                <label class="store-manager-field store-manager-field-wide">
                  <span>Store URL</span>
                  <input
                    id="storeFormStoreUrl"
                    type="text"
                    value="${esc(storeUrl)}"
                    placeholder="https://okobserver.org"
                  />
                </label>
              </div>
            </section>

            <section class="store-manager-form-section">
              <div class="store-manager-form-section-head">
                <div class="store-manager-form-section-title">Processing Rules</div>
                <div class="store-manager-form-section-copy">
                  Controls for execution mode, gateway scope, timezone, and gateway activity window.
                </div>
              </div>

              <div class="store-manager-form-grid">
                <label class="store-manager-field">
                  <span>Execution Mode</span>
                  <select id="storeFormExecutionMode">
                    ${buildSelectOptions(STORE_EXECUTION_MODE_OPTIONS, executionMode)}
                  </select>
                </label>

                <label class="store-manager-field">
                  <span>Gateway</span>
                  <select id="storeFormGateway">
                    ${buildSelectOptions(STORE_GATEWAY_OPTIONS, gateway)}
                  </select>
                </label>

                <label class="store-manager-field">
                  <span>Timezone</span>
                  <select id="storeFormTimezone">
                    ${buildTimezoneOptions(timezone)}
                  </select>
                </label>

                <label class="store-manager-field">
                  <span>Gateway Activity Window (hours)</span>
                  <input
                    id="storeFormGatewayWindow"
                    type="number"
                    min="1"
                    step="1"
                    value="${esc(String(gatewayWindowHours))}"
                    placeholder="24"
                  />
                </label>
              </div>
            </section>
          </div>

          <aside class="store-manager-form-rail">
            <section class="store-manager-form-section store-manager-form-section-rail">
              <div class="store-manager-form-section-head">
                <div class="store-manager-form-section-title">WooCommerce Writes</div>
                <div class="store-manager-form-section-copy">
                  Controls whether Pulse can write recovery activity into WooCommerce order notes.
                </div>
              </div>

              <div class="store-manager-rail-panel">
                <div class="store-manager-checkbox-row">
                  <input
                    id="storeFormAllowOrderNoteWrites"
                    type="checkbox"
                    ${allowOrderNoteWrites ? "checked" : ""}
                  />
                  <label for="storeFormAllowOrderNoteWrites" class="store-manager-checkbox-label">
                    Allow WooCommerce order note writes
                  </label>
                </div>

                <div class="store-manager-checkbox-help">
                  When enabled, Pulse can write recovery activity into WooCommerce order notes for this store.
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div class="store-manager-card-actions">
          <button
            class="pulse-modal-action-btn primary"
            data-store-submit="${isEdit ? "update" : "create"}"
            data-store-id="${esc(storeId)}"
          >
            ${isEdit ? "Save Store" : "Create Store"}
          </button>
        </div>
      </div>
        `;

    const modalEl = document.getElementById("pulse-modal");
    const footerEl = document.getElementById("pulse-modal-footer");
    modalEl?.classList.add("store-manager-modal");
    if (footerEl) footerEl.style.display = "none";
    modalEl?.classList.remove("hidden");
  }  function renderStoreDeleteModal(store) {
    const modalTitle = document.getElementById("pulse-modal-title");
    const modalBody = document.getElementById("pulse-modal-body");
    if (!modalTitle || !modalBody) return;

    const storeId = String(store?.store_id || "");
    const storeName = String(store?.store_name || "Untitled Store");

    modalTitle.textContent = "Delete Store";

    modalBody.innerHTML = `
      <div class="store-manager-form-card">
        <div class="pulse-modal-intro">
          Delete <strong>${esc(storeName)}</strong>?
        </div>

        <div class="store-manager-help">
          This will remove store <strong>${esc(storeId)}</strong> from the Store Manager once the backend endpoint is available.
        </div>

        <div class="store-manager-card-actions">
          <button
            class="pulse-modal-action-btn danger"
            data-store-submit="delete"
            data-store-id="${esc(storeId)}"
          >
            Delete Store
          </button>
        </div>
      </div>
       `;

    const modalEl = document.getElementById("pulse-modal");
    const footerEl = document.getElementById("pulse-modal-footer");
    modalEl?.classList.add("store-manager-modal");
    if (footerEl) footerEl.style.display = "none";
    modalEl?.classList.remove("hidden");
  }

  function getStoreFormPayload() {
    return {
      store_id: String(document.getElementById("storeFormStoreId")?.value || "").trim(),
      store_name: String(document.getElementById("storeFormStoreName")?.value || "").trim(),
      store_url: String(document.getElementById("storeFormStoreUrl")?.value || "").trim(),
      gateway: normalizeGatewayForForm(document.getElementById("storeFormGateway")?.value || ""),
      execution_mode: String(document.getElementById("storeFormExecutionMode")?.value || "test").trim().toLowerCase(),
      timezone: normalizeTimezoneForForm(document.getElementById("storeFormTimezone")?.value || ""),
      gateway_activity_window_hours: Number(document.getElementById("storeFormGatewayWindow")?.value || 0) || 0,
      allow_order_note_writes: document.getElementById("storeFormAllowOrderNoteWrites")?.checked ? 1 : 0
    };
  }

  function validateStoreFormPayload(payload) {
    if (!payload.store_id) return "Store ID is required.";
    if (!payload.store_name) return "Store name is required.";
    if (!payload.store_url) return "Store URL is required.";
    if (!/^https?:\/\//i.test(payload.store_url)) return "Store URL must start with http:// or https://";
    if (!payload.gateway) return "Gateway is required.";
    if (!payload.execution_mode) return "Execution mode is required.";
    if (!payload.timezone) return "Timezone is required.";
    if (!payload.gateway_activity_window_hours) return "Gateway activity window hours is required.";
    return "";
  }

  function refreshStoreManagerView() {
    if (typeof window.doStoreManager === "function") return window.doStoreManager();
    if (typeof window.doPulseDashboard === "function") return window.doPulseDashboard();
    window.location.reload();
  }

  function getPulseActionEndpoint(action) {
    const token = String(action || "").trim().toLowerCase();

    if (token === "pause") return "https://pulse-worker.bob-b5c.workers.dev/radar/action/pause";
    if (token === "retry") return "https://pulse-worker.bob-b5c.workers.dev/radar/action/retry";
    if (token === "resume") return "https://pulse-worker.bob-b5c.workers.dev/radar/action/resume";

    return null;
  }

  async function fetchPulseAffectedCustomers(gateway) {
    const response = await fetch(`https://pulse-worker.bob-b5c.workers.dev/pulse/affected-customers?gateway=${encodeURIComponent(gateway)}`, {
      method: "GET"
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `Failed to load affected customers for ${gateway}`);
    }

    return data;
  }

  function getIncidentIdsFromAffectedCustomers(data) {
    return Array.isArray(data?.customers)
      ? data.customers
          .map((item) => Number(item?.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];
  }

  async function executePulseGatewayAction(action, gateway) {
    const endpoint = getPulseActionEndpoint(action);

    if (!endpoint) {
      throw new Error("Action not implemented yet");
    }

    const affectedData = await fetchPulseAffectedCustomers(gateway);
    const incident_ids = getIncidentIdsFromAffectedCustomers(affectedData);

    if (!incident_ids.length) {
      throw new Error(`No incident_ids found for gateway: ${gateway}`);
    }

    const store_id =
      String(window.__pulseStoreId || "").trim() ||
      String(window.__activeStoreId || "").trim() ||
      "okobserver";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id,
        gateway,
        incident_ids
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `Action failed for ${gateway}`);
    }

    return data;
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

  document.addEventListener("click", function (e) {
    if (
      e.target.id === "pulse-modal-close" ||
      e.target.id === "pulse-modal-ok" ||
      e.target.classList.contains("pulse-modal-backdrop")
    ) {
      closePulseModal();
    }
  });

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".pulse-modal-action-btn");
    if (!btn || !btn.hasAttribute("data-action")) return;

    const action = String(btn.getAttribute("data-action") || "").trim().toLowerCase();
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
      fetchPulseAffectedCustomers(gateway)
        .then((data) => {
          btn.disabled = false;
          btn.textContent = originalLabel;

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
          showPulseBanner(err?.message || "Failed to load affected customers", "error");
        });

      return;
    }

    executePulseGatewayAction(action, gateway)
      .then((data) => {
        btn.disabled = false;
        btn.textContent = originalLabel;

        const count =
          Number(data?.affected_count) ||
          Number(data?.count) ||
          Number(data?.incident_ids?.length) ||
          0;

        const revenueRaw =
          data?.affected_revenue ??
          data?.revenue ??
          null;

        const revenue =
          revenueRaw === null || revenueRaw === undefined || revenueRaw === ""
            ? null
            : Number(revenueRaw);

        if (action === "pause") {
          window.__pulseOptimisticAction = {
            type: "pause",
            gateway,
            count,
            revenue
          };
        }

        if (action === "retry") {
          window.__pulseOptimisticAction = {
            type: "retry",
            gateway,
            count,
            revenue
          };
        }

        window.__pulseActionFeedback = {
          gateway: String(gateway || "").trim().toLowerCase(),
          action,
          count,
          revenue: Number.isFinite(revenue) ? revenue : null,
          simulated: data?.simulated === true,
          mode: String(data?.mode || "").trim().toLowerCase(),
          at: Date.now()
        };

        closePulseModal();

        if (typeof window.loadPulseDashboard === "function") {
          window.loadPulseDashboard();
          console.log("Pulse: refreshed via loadPulseDashboard()");
        } else {
          console.warn("Pulse: loadPulseDashboard missing — fallback reload");
          window.location.reload();
        }
      })
      .catch((err) => {
        console.error(err);
        btn.disabled = false;
        btn.textContent = originalLabel;
        showPulseBanner(err?.message || `Action failed for ${gateway}`, "error");
      });
  });

  document.addEventListener("click", function (e) {
    const addBtn = e.target.closest("#btnAddStore");
    if (!addBtn) return;
    renderStoreFormModal("create", null);
  });

  document.addEventListener("click", async function (e) {
    const btn = e.target.closest("[data-store-action]");
    if (!btn) return;

    const action = String(btn.getAttribute("data-store-action") || "").trim();
    const storeId = String(btn.getAttribute("data-store-id") || "").trim();
    const store = findStoreById(storeId);

    if (action === "edit") {
      renderStoreFormModal("edit", store || { store_id: storeId });
      return;
    }

    if (action === "delete") {
      const resolvedStoreId = btn.getAttribute("data-store-id");
      const storeName = btn.closest(".pulse-gateway-card")?.querySelector(".pulse-gateway-name")?.textContent || resolvedStoreId;

      const confirmDelete = confirm(
        `Delete Store\n\nAre you sure you want to delete "${storeName}"?\n\nThis action cannot be undone.`
      );

      if (!confirmDelete) return;

      try {
        btn.disabled = true;
        btn.textContent = "Deleting...";

        const res = await fetch("https://pulse-worker.bob-b5c.workers.dev/stores/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            store_id: resolvedStoreId
          })
        });

        const data = await res.json().catch(() => null);

        if (!data?.ok) {
          throw new Error(data?.error || "Delete failed");
        }

        showPulseBanner("Store deleted.", "success");
        refreshStoreManagerView();
      } catch (err) {
        console.error("Delete store failed:", err);
        showPulseBanner(err?.message || "Failed to delete store.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Delete Store";
      }

      return;
    }
  });

  document.addEventListener("click", async function (e) {
    const btn = e.target.closest("[data-store-submit]");
    if (!btn) return;

    const submitAction = String(btn.getAttribute("data-store-submit") || "").trim();
    const storeId = String(btn.getAttribute("data-store-id") || "").trim();

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Processing...";

    if (submitAction === "delete") {
      fetch("https://pulse-worker.bob-b5c.workers.dev/stores/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId })
      })
        .then((r) => r.json())
        .then((data) => {
          btn.disabled = false;
          btn.textContent = originalLabel;

          if (!data?.ok) {
            showPulseBanner(data?.error || "Delete store failed.", "error");
            return;
          }

          closePulseModal();
          showPulseBanner("Store deleted.", "success");
          refreshStoreManagerView();
        })
        .catch((err) => {
          console.error(err);
          btn.disabled = false;
          btn.textContent = originalLabel;
          showPulseBanner("Delete store failed.", "error");
        });

      return;
    }

    const payload = getStoreFormPayload();
    const validationError = validateStoreFormPayload(payload);

    if (validationError) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      showPulseBanner(validationError, "error");
      return;
    }

    const endpoint =
      submitAction === "update"
        ? "https://pulse-worker.bob-b5c.workers.dev/stores/update"
        : "https://pulse-worker.bob-b5c.workers.dev/stores/create";

    fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then((r) => r.json())
      .then((data) => {
        btn.disabled = false;
        btn.textContent = originalLabel;

        if (!data?.ok) {
          showPulseBanner(data?.error || "Save store failed.", "error");
          return;
        }

        closePulseModal();
        showPulseBanner(submitAction === "update" ? "Store updated." : "Store created.", "success");
        refreshStoreManagerView();
      })
      .catch((err) => {
        console.error(err);
        btn.disabled = false;
        btn.textContent = originalLabel;
        showPulseBanner(submitAction === "update" ? "Update store failed." : "Create store failed.", "error");
      });
  });

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

// 🔴 pulseActions.js