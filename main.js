// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-18a)
// - Pretty OkObserver-style cards (no CRT)
// - Renders wp-admin-ish sections (General/Billing/Shipping/Items/Related)
// - Still provides Raw JSON toggle for debugging
// NOTE: This is for the ArnoldApp site (mrrogersweborhood.github.io/arnoldapp/).

(() => {
  "use strict";

  // IMPORTANT: must point to your Arnold admin worker service base
  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    q: document.getElementById("queryInput"),
    btn: document.getElementById("searchBtn"),
    results: document.getElementById("results"),
    tokenDot: document.getElementById("tokenDot"),
    tokenText: document.getElementById("tokenText")
  };

  function getToken() {
    return localStorage.getItem("ARNOLD_ADMIN_TOKEN") || "";
  }

  function refreshTokenStatus() {
    const t = getToken().trim();
    if (t) {
      els.tokenDot.classList.remove("off");
      els.tokenText.textContent = "Token: set";
    } else {
      els.tokenDot.classList.add("off");
      els.tokenText.textContent = "Token: not set";
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function prettyJson(obj) {
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }

  function money(total, currency) {
    const t = (total === null || total === undefined) ? "" : String(total);
    const c = (currency || "").toUpperCase();
    return c ? `${t} ${c}` : t;
  }

  function statusBadge(status) {
    const s = String(status || "unknown");
    return `<span class="badge">${esc(s)}</span>`;
  }

  function dlRow(label, value) {
    if (value === null || value === undefined || value === "") return "";
    return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
  }

  function renderAddressBlock(title, addr) {
    if (!addr) return "";
    const lines = [];
    const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim();
    if (name) lines.push(name);
    if (addr.company) lines.push(addr.company);
    if (addr.address_1) lines.push(addr.address_1);
    if (addr.address_2) lines.push(addr.address_2);
    const cityLine = [addr.city, addr.state, addr.postcode].filter(Boolean).join(", ").replace(", ,", ",").trim();
    if (cityLine) lines.push(cityLine);
    if (addr.country) lines.push(addr.country);

    return `
      <div class="kv">
        <h4>${esc(title)}</h4>
        <dl>
          ${dlRow("Address", lines.join(" • "))}
          ${dlRow("Phone", addr.phone)}
          ${dlRow("Email", addr.email)}
        </dl>
      </div>
    `;
  }

  function renderMetaBlock(meta) {
    const arr = Array.isArray(meta) ? meta : [];
    if (!arr.length) return "";
    const rows = arr.slice(0, 25).map(m => `<tr><td>${esc(m.key)}</td><td>${esc(m.value)}</td></tr>`).join("");
    return `
      <div class="kv items">
        <h4>Custom fields (safe)</h4>
        <table>
          <thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderItemsTable(title, items) {
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) return "";
    const rows = arr.map(li => `
      <tr>
        <td>${esc(li.name || "")}<div class="subline">${esc(li.sku || "")}</div></td>
        <td>${esc(li.quantity ?? "")}</td>
        <td>${esc(li.total ?? "")}</td>
      </tr>
    `).join("");
    return `
      <div class="kv items">
        <h4>${esc(title)}</h4>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderActions(entity) {
    const links = [];
    if (entity && entity.admin_edit_url) {
      links.push(`<a class="linkbtn" href="${esc(entity.admin_edit_url)}" target="_blank" rel="noopener">Open in wp-admin</a>`);
    }
    if (!links.length) return "";
    return `<div class="actions">${links.join("")}</div>`;
  }

  function card(title, subtitle, badgeHtml, bodyHtml, rawObj) {
    return `
      <div class="card">
        <div class="card-hd">
          <div class="card-title">
            <strong>${esc(title)}</strong>
            ${subtitle ? `<div class="subline">${esc(subtitle)}</div>` : ""}
          </div>
          ${badgeHtml || ""}
        </div>
        <div class="card-bd">
          ${bodyHtml || ""}
          <details class="raw">
            <summary>Raw JSON</summary>
            <pre>${esc(prettyJson(rawObj))}</pre>
          </details>
        </div>
      </div>
    `;
  }

  function renderOrder(o, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Order ID", o.id)}
          ${dlRow("Order #", o.number)}
          ${dlRow("Status", o.status)}
          ${dlRow("Total", money(o.total, o.currency))}
          ${dlRow("Discount", o.discount_total)}
          ${dlRow("Shipping", o.shipping_total)}
          ${dlRow("Created", o.date_created)}
          ${dlRow("Paid", o.date_paid)}
          ${dlRow("Payment", o.payment_method_title || o.payment_method)}
          ${dlRow("Customer ID", o.customer_id)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
        ${renderAddressBlock("Billing", o.billing)}
        ${renderAddressBlock("Shipping", o.shipping)}
      </div>
      ${renderItemsTable("Items", o.line_items)}
      ${renderMetaBlock(o.meta_data)}
      ${renderActions(o)}
    `;

    return card(
      `Order ${o.number ? "#" + o.number : (o.id ? "#" + o.id : "")}`.trim(),
      "WooCommerce Order",
      statusBadge(o.status),
      blocks,
      raw
    );
  }

  function renderCustomer(c, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Customer ID", c.id)}
          ${dlRow("Name", [c.first_name, c.last_name].filter(Boolean).join(" "))}
          ${dlRow("Username", c.username)}
          ${dlRow("Email", c.email)}
          ${dlRow("Role", c.role)}
          ${dlRow("Created", c.date_created)}
          ${dlRow("Paying customer", c.is_paying_customer)}
          ${dlRow("Orders", c.orders_count)}
          ${dlRow("Total spent", c.total_spent)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
        ${renderAddressBlock("Billing", c.billing)}
        ${renderAddressBlock("Shipping", c.shipping)}
      </div>
      ${renderMetaBlock(c.meta_data)}
      ${renderActions(c)}
    `;

    return card(
      `Customer ${c.id ? "#" + c.id : ""}`.trim(),
      "WooCommerce Customer",
      `<span class="badge">customer</span>`,
      blocks,
      raw
    );
  }

  function renderSubscription(s, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Subscription ID", s.id)}
          ${dlRow("Status", s.status)}
          ${dlRow("Total", money(s.total, s.currency))}
          ${dlRow("Customer ID", s.customer_id)}
          ${dlRow("Parent order", s.parent_id)}
          ${dlRow("Start", s.start_date)}
          ${dlRow("Next payment", s.next_payment_date)}
          ${dlRow("End", s.end_date)}
          ${dlRow("Payment", s.payment_method_title || s.payment_method)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
        ${renderAddressBlock("Billing", s.billing)}
        ${renderAddressBlock("Shipping", s.shipping)}
      </div>
      ${renderItemsTable("Items", s.line_items)}
      ${renderMetaBlock(s.meta_data)}
      ${renderActions(s)}
    `;

    return card(
      `Subscription #${s.id || ""}`.trim(),
      "WooCommerce Subscription",
      statusBadge(s.status),
      blocks,
      raw
    );
  }

  function renderMembership(m, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Membership ID", m.id)}
          ${dlRow("Status", m.status)}
          ${dlRow("Plan", m.plan)}
          ${dlRow("Plan ID", m.plan_id)}
          ${dlRow("Customer ID", m.customer_id)}
          ${dlRow("Start", m.start_date)}
          ${dlRow("End", m.end_date)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
      </div>
      ${renderMetaBlock(m.meta_data)}
      ${renderActions(m)}
    `;

    return card(
      `Membership #${m.id || ""}`.trim(),
      "WooCommerce Membership",
      statusBadge(m.status),
      blocks,
      raw
    );
  }

  function renderCoupon(c, raw) {
    const general = `
      <div class="kv">
        <h4>General</h4>
        <dl>
          ${dlRow("Coupon ID", c.id)}
          ${dlRow("Code", c.code)}
          ${dlRow("Amount", c.amount)}
          ${dlRow("Type", c.discount_type)}
          ${dlRow("Expires", c.date_expires)}
          ${dlRow("Usage", c.usage_count)}
          ${dlRow("Limit", c.usage_limit)}
          ${dlRow("Free shipping", c.free_shipping)}
          ${dlRow("Min", c.minimum_amount)}
          ${dlRow("Max", c.maximum_amount)}
        </dl>
      </div>
    `;

    const blocks = `
      <div class="grid-3">
        ${general}
      </div>
      ${renderMetaBlock(c.meta_data)}
    `;

    return card(
      `Coupon ${c.code ? `"${c.code}"` : ""}`.trim(),
      "WooCommerce Coupon",
      `<span class="badge">coupon</span>`,
      blocks,
      raw
    );
  }

  function renderError(msg, raw) {
    return `
      <div class="error">
        <strong>Error:</strong> ${esc(msg)}
        <details class="raw" style="margin-top:10px;">
          <summary>Raw response</summary>
          <pre>${esc(prettyJson(raw))}</pre>
        </details>
      </div>
    `;
  }

  function setBusy(on) {
    els.btn.disabled = !!on;
    els.btn.textContent = on ? "Searching…" : "Search";
  }

  async function doSearch() {
    refreshTokenStatus();

    const query = (els.q.value || "").trim();
    if (!query) return;

    const token = getToken().trim();
    if (!token) {
      els.results.innerHTML = renderError(
        'ARNOLD_ADMIN_TOKEN is not set. In DevTools Console run: localStorage.setItem("ARNOLD_ADMIN_TOKEN","YOUR_REAL_TOKEN")',
        { ok: false }
      );
      return;
    }

    setBusy(true);
    els.results.innerHTML = "";

    try {
      const resp = await fetch(`${ARNOLD_WORKER_BASE}/admin/nl-search`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-arnold-token": token
        },
        body: JSON.stringify({ query })
      });

      const text = await resp.text();
      let data;
      try { data = text ? JSON.parse(text) : null; }
      catch { data = { ok: false, error: "Non-JSON response", raw: text }; }

      if (!resp.ok || !data || data.ok === false) {
        els.results.innerHTML = renderError(
          data?.error || data?.message || `HTTP ${resp.status}`,
          data
        );
        return;
      }

      // Render by intent
      const intent = data.intent || "unknown";

      if (intent === "order_by_id" && data.result) {
        els.results.innerHTML = renderOrder(data.result, data);
        return;
      }

      if (intent === "customer_by_email" && Array.isArray(data.results)) {
        els.results.innerHTML = data.results.map(c => renderCustomer(c, data)).join("");
        return;
      }

      if (intent === "subscription_by_email" && Array.isArray(data.results)) {
        els.results.innerHTML = data.results.map(s => renderSubscription(s, data)).join("");
        return;
      }

      if (intent === "membership_by_email" && Array.isArray(data.results)) {
        els.results.innerHTML = data.results.map(m => renderMembership(m, data)).join("");
        return;
      }

      if (intent === "coupon_by_code") {
        if (data.result) els.results.innerHTML = renderCoupon(data.result, data);
        else els.results.innerHTML = renderError("No exact coupon match found.", data);
        return;
      }

      // Fallback: show raw
      els.results.innerHTML = card(
        "Results",
        `Intent: ${intent}`,
        `<span class="badge">${esc(intent)}</span>`,
        "",
        data
      );
    } catch (err) {
      els.results.innerHTML = renderError(err?.message || "Failed to fetch", { ok: false });
    } finally {
      setBusy(false);
    }
  }

  els.btn.addEventListener("click", doSearch);
  els.q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  refreshTokenStatus();
})();

// 🔴 main.js
