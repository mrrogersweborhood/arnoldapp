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
    const brandColor = String(store?.brand_color || "#A855F7").trim() || "#A855F7";

        return `
            <div class="pulse-shell pulse-store-manager">
        <section class="card pulse-hero" style="border-left:4px solid ${esc(brandColor)};">
        <div class="pulse-gateway-top">
          <div>
            <div class="pulse-gateway-name" style="color:${esc(brandColor)};">${esc(storeName)}</div>
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

  function renderStoreEditorView(mode, store) {
    const isEdit = String(mode || "").toLowerCase() === "edit";
    const storeId = String(store?.store_id || "");
    const storeName = String(store?.store_name || "");
    const storeUrl = String(store?.store_url || "");
    const gateway = String(store?.gateway || "").trim().toLowerCase();
    const executionMode = String(store?.execution_mode || "test").trim().toLowerCase();
    const timezone = String(store?.timezone || "UTC").trim() || "UTC";
    const gatewayWindowHours = Number(store?.gateway_activity_window_hours || 24) || 24;
    const allowOrderNoteWrites = Number(store?.allow_order_note_writes || 0) === 1;
    const brandColor = String(store?.brand_color || "#A855F7").trim() || "#A855F7";

    return `
      <div class="pulse-shell pulse-store-manager">
        <section class="card pulse-hero">
          <div class="pulse-hero-top">
            <div>
              <div class="pulse-kicker">Platform</div>
              <div class="pulse-title">${isEdit ? "Edit Store" : "Create Store"}</div>
              <div class="pulse-subtitle">Update store-level Pulse configuration without using the shared modal system.</div>
            </div>
          </div>

          <div class="store-action-row" style="margin-top:16px; margin-bottom:14px;">
            <button
              id="btnStoreEditorBack"
              class="store-action-btn ghost"
              type="button"
            >
              Back to Stores
            </button>
          </div>
        </section>

        <section class="card pulse-section">
          <div class="pulse-section-head">
            <div>
              <div class="pulse-section-title">${isEdit ? "Store editor" : "Create new store"}</div>
              <div class="pulse-section-subtitle">This editor now lives in the Store Manager page instead of the Pulse modal.</div>
            </div>
          </div>

          <div class="store-manager-form-card store-manager-form-card-compact">
            <div class="store-manager-form-head">
              <div>
                <div class="store-manager-form-title">
                  ${isEdit ? "Edit Store" : "Create Store"}
                </div>
                <div class="store-manager-form-subtitle">
                  Full-page store configuration editor
                </div>
              </div>

              <div class="store-manager-form-mode-pill">
                ${esc(executionMode.toUpperCase())}
              </div>
            </div>

            <div class="store-manager-form-grid store-manager-form-grid-compact">
              <label class="store-manager-field">
                <span>Store ID</span>
                <input
                  id="storeEditorStoreId"
                  type="text"
                  value="${esc(storeId)}"
                  ${isEdit ? "disabled" : ""}
                  placeholder="primary-store"
                />
              </label>

              <label class="store-manager-field">
                <span>Store Name</span>
                <input
                  id="storeEditorStoreName"
                  type="text"
                  value="${esc(storeName)}"
                  placeholder="Main Store"
                />
              </label>

              <label class="store-manager-field store-manager-field-wide">
                <span>Store URL</span>
                <input
                  id="storeEditorStoreUrl"
                  type="text"
                  value="${esc(storeUrl)}"
                  placeholder="https://okobserver.org"
                />
              </label>

              <label class="store-manager-field">
                <span>Gateway</span>
                <select id="storeEditorGateway">
                  <option value="square"${gateway === "square" ? " selected" : ""}>Square</option>
                  <option value="stripe"${gateway === "stripe" ? " selected" : ""}>Stripe</option>
                  <option value="paypal"${gateway === "paypal" ? " selected" : ""}>PayPal</option>
                </select>
              </label>

              <label class="store-manager-field">
                <span>Execution Mode</span>
                <select id="storeEditorExecutionMode">
                  <option value="test"${executionMode === "test" ? " selected" : ""}>Test</option>
                  <option value="live"${executionMode === "live" ? " selected" : ""}>Live</option>
                </select>
              </label>

              <label class="store-manager-field">
                <span>Timezone</span>
                <select id="storeEditorTimezone">
                  <option value="UTC"${timezone === "UTC" ? " selected" : ""}>UTC</option>
                  <option value="America/New_York"${timezone === "America/New_York" ? " selected" : ""}>Eastern (New York)</option>
                  <option value="America/Chicago"${timezone === "America/Chicago" ? " selected" : ""}>Central (Chicago)</option>
                  <option value="America/Denver"${timezone === "America/Denver" ? " selected" : ""}>Mountain (Denver)</option>
                  <option value="America/Los_Angeles"${timezone === "America/Los_Angeles" ? " selected" : ""}>Pacific (Los Angeles)</option>
                  <option value="America/Phoenix"${timezone === "America/Phoenix" ? " selected" : ""}>Arizona (Phoenix — no DST)</option>
                  <option value="America/Anchorage"${timezone === "America/Anchorage" ? " selected" : ""}>Alaska (Anchorage)</option>
                  <option value="Pacific/Honolulu"${timezone === "Pacific/Honolulu" ? " selected" : ""}>Hawaii (Honolulu)</option>
                </select>
              </label>

              <label class="store-manager-field">
                <span>Retry Window (hours)</span>
                <input
                  id="storeEditorGatewayWindow"
                  type="number"
                  min="1"
                  step="1"
                  value="${esc(String(gatewayWindowHours))}"
                  placeholder="24"
                />
              </label>

              <div class="store-manager-field store-manager-field-wide">
                <span>Brand Color</span>

                <div class="store-manager-color-control">
                  <label for="storeEditorBrandColor" class="store-manager-color-swatch">
                    <input
                      id="storeEditorBrandColor"
                      type="color"
                      value="${esc(brandColor)}"
                    />
                    <span
                      id="storeEditorBrandColorPreview"
                      class="store-manager-color-preview"
                      style="background:${esc(brandColor)};"
                    ></span>
                  </label>

                  <div class="store-manager-color-input-wrap">
                    <input
                      id="storeEditorBrandColorHex"
                      type="text"
                      value="${esc(brandColor)}"
                      placeholder="#A855F7"
                      spellcheck="false"
                      autocomplete="off"
                    />
                    <div class="store-manager-color-help">
                      Choose a store identity color or enter a hex value.
                    </div>
                  </div>
                </div>
              </div>

              <div class="store-manager-field store-manager-field-wide store-manager-field-checkbox">
                <span>WooCommerce Writes</span>
                <div class="store-manager-checkbox-row">
                  <input
                    id="storeEditorAllowOrderNoteWrites"
                    type="checkbox"
                    ${allowOrderNoteWrites ? "checked" : ""}
                  />
                  <label for="storeEditorAllowOrderNoteWrites" class="store-manager-checkbox-label">
                    Allow order note writes
                  </label>
                </div>

                <div class="store-manager-checkbox-help">
                  Enable WooCommerce order note writing for this store.
                </div>
              </div>
            </div>

            <div class="store-manager-card-actions store-manager-card-actions-compact">
              <button
                id="btnStoreEditorCancel"
                class="store-action-btn ghost"
                type="button"
              >
                Cancel
              </button>

              <button
                id="btnStoreEditorSave"
                class="store-action-btn"
                type="button"
                data-store-editor-submit="${isEdit ? "update" : "create"}"
                data-store-id="${esc(storeId)}"
              >
                ${isEdit ? "Save Store" : "Create Store"}
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
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
  window.renderStoreEditorView = renderStoreEditorView;
})();
// 🔴 renderStores.js