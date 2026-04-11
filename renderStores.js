// 🟢 renderStores.js
// Store Manager renderer
// Exposes:
// - window.renderStoresLoadingShell
// - window.renderStoresDashboard

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

  function formatMode(value) {
    const raw = String(value || "test").trim().toUpperCase();
    return raw === "LIVE" ? "LIVE" : "TEST";
  }

  function formatLabel(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function renderStoreStats(totalStores, liveStores, testStores, distinctGateways, isLoading = false) {
    if (isLoading) {
      return `
        <div class="pulse-stat-grid">
          <div class="pulse-stat-card pulse-stat-accent-neutral">
            <div class="aa-loading-row" style="width:120px"></div>
            <div class="aa-loading-row" style="width:72px; margin-top:10px"></div>
          </div>
          <div class="pulse-stat-card pulse-stat-accent-neutral">
            <div class="aa-loading-row" style="width:140px"></div>
            <div class="aa-loading-row" style="width:72px; margin-top:10px"></div>
          </div>
          <div class="pulse-stat-card pulse-stat-accent-neutral">
            <div class="aa-loading-row" style="width:120px"></div>
            <div class="aa-loading-row" style="width:72px; margin-top:10px"></div>
          </div>
          <div class="pulse-stat-card pulse-stat-accent-neutral">
            <div class="aa-loading-row" style="width:120px"></div>
            <div class="aa-loading-row" style="width:72px; margin-top:10px"></div>
          </div>
        </div>
      `;
    }

    return `
      <div class="pulse-stat-grid">
        <div class="pulse-stat-card pulse-stat-accent-neutral">
          <div class="pulse-stat-label">Total stores</div>
          <div class="pulse-stat-value">${esc(String(totalStores))}</div>
          <div class="pulse-stat-meta">Current records returned from the stores endpoint.</div>
        </div>

        <div class="pulse-stat-card pulse-stat-accent-danger">
          <div class="pulse-stat-label">Live stores</div>
          <div class="pulse-stat-value">${esc(String(liveStores))}</div>
          <div class="pulse-stat-meta">Stores currently set to live execution mode.</div>
        </div>

        <div class="pulse-stat-card pulse-stat-accent-warning">
          <div class="pulse-stat-label">Test stores</div>
          <div class="pulse-stat-value">${esc(String(testStores))}</div>
          <div class="pulse-stat-meta">Stores currently set to test mode.</div>
        </div>

        <div class="pulse-stat-card pulse-stat-accent-neutral">
          <div class="pulse-stat-label">Gateways</div>
          <div class="pulse-stat-value">${esc(String(distinctGateways))}</div>
          <div class="pulse-stat-meta">Distinct configured payment gateways.</div>
        </div>
      </div>
    `;
  }

  function renderStoreCard(store) {
    const storeId = String(store?.store_id || "");
    const storeName = String(store?.store_name || "Untitled Store");
    const gateway = String(store?.gateway || "unknown");
    const executionMode = formatMode(store?.execution_mode);
    const timezone = String(store?.timezone || "—");
    const windowHours = store?.gateway_activity_window_hours ?? "—";

        return `
      <div class="pulse-shell pulse-store-manager">
        <section class="card pulse-hero">
        <div class="pulse-gateway-top">
          <div>
            <div class="pulse-gateway-name">${esc(storeName)}</div>
            <div class="pulse-gateway-share">Store ID: ${esc(storeId || "—")}</div>
          </div>
          <div class="pulse-priority-pill ${executionMode === "LIVE" ? "pulse-priority-high" : "pulse-priority-medium"}">
            ${esc(executionMode)}
          </div>
        </div>

        <div class="store-manager-summary">
          <div class="store-manager-summary-row store-manager-summary-row-primary">
            <div class="store-manager-summary-item">
              <span class="store-manager-summary-label">Gateway</span>
              <span class="store-manager-summary-value">${esc(formatLabel(gateway) || "Unknown")}</span>
            </div>

            <div class="store-manager-summary-item">
              <span class="store-manager-summary-label">Timezone</span>
              <span class="store-manager-summary-value">${esc(timezone)}</span>
            </div>

            <div class="store-manager-summary-item">
              <span class="store-manager-summary-label">Retry Window</span>
              <span class="store-manager-summary-value">${esc(String(windowHours))} hours</span>
            </div>

            <div class="store-manager-summary-item">
              <span class="store-manager-summary-label">Order Notes</span>
              <span class="store-manager-summary-value">
                ${
                  Number(store?.allow_order_note_writes || 0) === 1
                    ? "Enabled"
                    : "Disabled"
                }
              </span>
            </div>
          </div>

          <div class="store-manager-summary-row store-manager-summary-row-url">
            <div class="store-manager-summary-item store-manager-summary-item-url">
              <span class="store-manager-summary-label">Store URL</span>
              <span class="store-manager-summary-value store-manager-summary-url">
                ${
                  store?.store_url
                    ? `<a href="${esc(store.store_url)}" target="_blank" rel="noopener noreferrer">${esc(store.store_url)}</a>`
                    : "—"
                }
              </span>
            </div>
          </div>
        </div>

                <div class="store-action-row store-manager-card-actions-row" style="margin-top:12px;">
          <button
            class="store-action-btn"
            data-store-action="edit"
            data-store-id="${esc(storeId)}"
          >
            Edit Store
          </button>

          <button
            class="store-action-btn ghost"
            data-store-action="delete"
            data-store-id="${esc(storeId)}"
          >
            Delete Store
          </button>
        </div>
      </article>
    `;
  }

  function renderStoreCards(stores, isLoading = false) {
    if (isLoading) {
      return `
        <div class="pulse-grid">
          <div class="pulse-gateway-card">
            <div class="aa-loading-row" style="width:160px"></div>
            <div class="aa-loading-row" style="width:90px; margin-top:10px"></div>
            <div class="aa-loading-row" style="width:100%; margin-top:12px"></div>
            <div class="aa-loading-row" style="width:84%; margin-top:8px"></div>
          </div>
          <div class="pulse-gateway-card">
            <div class="aa-loading-row" style="width:160px"></div>
            <div class="aa-loading-row" style="width:90px; margin-top:10px"></div>
            <div class="aa-loading-row" style="width:100%; margin-top:12px"></div>
            <div class="aa-loading-row" style="width:84%; margin-top:8px"></div>
          </div>
        </div>
      `;
    }

    if (!stores.length) {
      return `
        <div class="aa-muted">
          No stores were returned by the backend.
        </div>
      `;
    }

    return `<div class="pulse-grid">${stores.map(renderStoreCard).join("")}</div>`;
  }

  function renderStoresShell({
    title,
    subtitle,
    sectionTitle,
    sectionSubtitle,
    totalStores = 0,
    liveStores = 0,
    testStores = 0,
    distinctGateways = 0,
    stores = [],
    isLoading = false
  }) {
    return `
      <div class="pulse-shell pulse-store-manager">
        <section class="card pulse-hero">
          <div class="pulse-hero-top">
            <div>
              <div class="pulse-kicker">Platform</div>
              <div class="pulse-title">${esc(title)}</div>
              <div class="pulse-subtitle">${esc(subtitle)}</div>
            </div>
          </div>

          ${
            isLoading
              ? ""
              : `
                    <div class="store-action-row" style="margin-top:16px; margin-bottom:14px;">
            <button
              id="btnAddStore"
              class="store-action-btn"
              type="button"
            >
              Add Store
            </button>
          </div>
          `
          }

          ${renderStoreStats(totalStores, liveStores, testStores, distinctGateways, isLoading)}
        </section>

        <section class="card pulse-section">
          <div class="pulse-section-head">
            <div>
              <div class="pulse-section-title">${esc(sectionTitle)}</div>
              <div class="pulse-section-subtitle">${esc(sectionSubtitle)}</div>
            </div>
          </div>

          ${renderStoreCards(stores, isLoading)}
        </section>
      </div>
    `;
  }

  function renderStoresLoadingShell() {
    return renderStoresShell({
      title: "Store Manager",
      subtitle: "Add, review, and maintain store-level Pulse configuration.",
      sectionTitle: "Configured stores",
      sectionSubtitle: "Store records returned by the backend.",
      isLoading: true
    });
  }

  function renderStoresDashboard(payload) {
    const stores = Array.isArray(payload?.stores) ? payload.stores : [];
    const totalStores = stores.length;
    const liveStores = stores.filter((store) => formatMode(store?.execution_mode) === "LIVE").length;
    const testStores = stores.filter((store) => formatMode(store?.execution_mode) !== "LIVE").length;
    const distinctGateways = new Set(
      stores.map((store) => String(store?.gateway || "").trim()).filter(Boolean)
    ).size;

    return renderStoresShell({
      title: "Store Manager",
      subtitle: "Add, review, and maintain store-level Pulse configuration.",
      sectionTitle: "Configured stores",
      sectionSubtitle: "Store records returned by the backend.",
      totalStores,
      liveStores,
      testStores,
      distinctGateways,
      stores,
      isLoading: false
    });
  }

  window.renderStoresLoadingShell = renderStoresLoadingShell;
  window.renderStoresDashboard = renderStoresDashboard;
})();
// 🔴 renderStores.js