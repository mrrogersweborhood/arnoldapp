// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — cookie-session auth + pretty formatting (v2026-02-20i)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /* ---------------- CONFIG ---------------- */

  // IMPORTANT: This must point at your Cloudflare Worker (Arnold Admin worker)
  // Example: https://arnold-admin-worker.bob-b5c.workers.dev
  const PROXY_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  /* ---------------- DOM ---------------- */

  const $ = (sel) => document.querySelector(sel);

  const el = {
    loginEmail: $("#loginEmail"),
    loginPass: $("#loginPass"),
    btnLogin: $("#btnLogin"),
    btnLogout: $("#btnLogout"),
    query: $("#query"),
    btnSearch: $("#btnSearch"),
    outCustomer: $("#outCustomer"),
    outSubs: $("#outSubs"),
    outOrders: $("#outOrders"),
    outJson: $("#outJson"),
    msg: $("#msg"),
    badge: $("#sessionBadge"),
    statusText: $("#sessionText"),
  };

  /* ---------------- STATE ---------------- */

  const state = {
    loggedIn: false,
    user: null,
    roles: [],
  };

  /* ---------------- UTIL: formatting ---------------- */

  function fmtPhone(raw) {
    if (!raw) return "";
    const digits = String(raw).replace(/\D+/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return String(raw);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\'/g, "&#39;");
  }

  function dlRow(k, v) {
    return `
      <div class="row">
        <div class="k">${esc(k)}</div>
        <div class="v">${esc(v ?? "")}</div>
      </div>
    `;
  }

  function getDisplayName(customer) {
    const fn = customer?.first_name || "";
    const ln = customer?.last_name || "";
    const name = `${fn} ${ln}`.trim();
    if (name) return name;
    return customer?.billing?.first_name || customer?.shipping?.first_name || "";
  }

  function addressLine(a) {
    if (!a) return "";
    const parts = [
      a.company,
      a.address_1,
      a.address_2,
      [a.city, a.state, a.postcode].filter(Boolean).join(" "),
      a.country
    ].filter(Boolean);
    return parts.join(", ");
  }

  function setMsg(text, kind = "info") {
    if (!el.msg) return;
    el.msg.textContent = text || "";
    el.msg.className = kind ? `msg msg-${kind}` : "msg";
    el.msg.style.display = text ? "block" : "none";
  }

  // --- strip redacted fields from JSON display ONLY ---
  // Worker uses "[redacted]" (lowercase) for sensitive meta; we remove those keys/entries from Raw JSON.
  function stripRedacted(value) {
    const isRedacted = (v) => {
      if (v == null) return false;
      const s = String(v).trim().toLowerCase();
      return s === "redacted" || s === "[redacted]" || s.startsWith("redacted");
    };

    if (Array.isArray(value)) {
      return value.map(stripRedacted).filter(v => v !== undefined);
    }

    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (isRedacted(v)) continue;
        const cleaned = stripRedacted(v);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return out;
    }

    return value;
  }

  function setSessionUi() {
    if (el.badge) el.badge.classList.toggle("on", !!state.loggedIn);
    if (el.statusText) el.statusText.textContent = state.loggedIn ? "Session: logged in" : "Session: logged out";
  }

  /* ---------------- API ---------------- */

  async function api(path, { method = "GET", body = null } = {}) {
    const url = `${PROXY_BASE}${path}`;
    const headers = { "Accept": "application/json" };
    if (body != null) headers["Content-Type"] = "application/json";

    const resp = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: "include", // cookie session (HttpOnly)
      mode: "cors"
    });

    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { ok: resp.ok, status: resp.status, data };
  }

  /* ---------------- AUTH ---------------- */

  async function refreshStatus() {
    const r = await api("/admin/status");
    if (r.ok && r.data && typeof r.data === "object") {
      state.loggedIn = !!r.data.loggedIn;
      state.user = r.data.user || null;
      state.roles = Array.isArray(r.data.roles) ? r.data.roles : [];
    } else {
      state.loggedIn = false;
      state.user = null;
      state.roles = [];
    }
    setSessionUi();
    return state.loggedIn;
  }

  async function doLogin() {
    setMsg("");
    const username = (el.loginEmail?.value || "").trim();
    const password = (el.loginPass?.value || "").trim();
    if (!username || !password) {
      setMsg("Email/username and password are required.", "warn");
      return;
    }

    // Worker expects { username, password }
    const r = await api("/admin/login", { method: "POST", body: { username, password } });
    if (!r.ok) {
      const msg = (r.data && r.data.message) ? r.data.message : `Login failed (${r.status}).`;
      setMsg(msg, "error");
      await refreshStatus();
      return;
    }

    setMsg("Logged in.", "ok");
    await refreshStatus();
  }

  async function doLogout() {
    setMsg("");
    const r = await api("/admin/logout", { method: "POST" });
    if (!r.ok) {
      setMsg(`Logout failed (${r.status}).`, "warn");
    } else {
      setMsg("Logged out.", "ok");
    }
    await refreshStatus();
  }

  /* ---------------- RENDER ---------------- */

  function renderCustomer(customer) {
    if (!el.outCustomer) return;
    if (!customer) {
      el.outCustomer.innerHTML = `<div class="empty">No customer record found for this query.</div>`;
      return;
    }

    const billing = customer.billing || null;
    const shipping = customer.shipping || null;

    const email = customer.email || billing?.email || "";
    const phone = customer.phone || billing?.phone || "";

    el.outCustomer.innerHTML = `
      <div class="cardInner">
        ${dlRow("Customer ID", customer.id ?? "")}
        ${dlRow("Username", customer.username ?? "")}
        ${dlRow("Name", getDisplayName(customer))}
        ${dlRow("Email", email)}
        ${dlRow("Phone", fmtPhone(phone))}
        ${dlRow("Billing Address", addressLine(billing))}
        ${dlRow("Shipping Address", addressLine(shipping))}
      </div>
    `;
  }

  function renderSubs(subs) {
    if (!el.outSubs) return;
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      el.outSubs.innerHTML = `<div class="empty">No subscriptions found.</div>`;
      return;
    }

    const rows = arr.slice(0, 50).map((s) => {
      const id = s.id ?? "";
      const status = s.status ?? "";
      const total = s.total ?? "";
      const start = s.start_date ?? s.date_created ?? "";
      const nextPay = s.next_payment_date ?? "";
      const end = s.end_date ?? "";
      const email = s.billing?.email ?? "";

      return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span><div class="muted">${esc(email)}</div></td>
          <td>${esc(total)}</td>
          <td>${esc(start)}</td>
          <td>${esc(nextPay)}</td>
          <td>${esc(end)}</td>
        </tr>
      `;
    }).join("");

    el.outSubs.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Total</th>
            <th>Start</th>
            <th>Next Pay</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderOrders(orders) {
    if (!el.outOrders) return;
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      el.outOrders.innerHTML = `<div class="empty">No orders found.</div>`;
      return;
    }

    const rows = arr.slice(0, 20).map((o) => {
      const id = o.id ?? "";
      const status = o.status ?? "";
      const total = o.total ?? "";
      const date = o.date_created ?? "";
      const email = o.billing?.email ?? "";
      const name = `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim();

      return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span><div class="muted">${esc(name)}${name && email ? " • " : ""}${esc(email)}</div></td>
          <td>${esc(total)}</td>
          <td>${esc(date)}</td>
        </tr>
      `;
    }).join("");

    el.outOrders.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderBundle(context, rawJson) {
    // Always render: Customer -> Subscriptions -> Orders
    renderCustomer(context?.customer || null);
    renderSubs(context?.subscriptions || []);
    renderOrders(context?.orders || []);

    if (el.outJson) {
      const cleaned = stripRedacted(rawJson ?? {});
      el.outJson.textContent = JSON.stringify(cleaned, null, 2);
    }
  }

  /* ---------------- SEARCH ---------------- */

  async function doSearch() {
    setMsg("");
    if (!state.loggedIn) {
      setMsg("Admin access required.", "warn");
      return;
    }

    const q = (el.query?.value || "").trim();
    if (!q) {
      setMsg("Enter a query.", "warn");
      return;
    }

    setMsg("Searching…", "info");
    if (el.outCustomer) el.outCustomer.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outSubs) el.outSubs.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outOrders) el.outOrders.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outJson) el.outJson.textContent = "";

    const r = await api("/admin/nl-search", { method: "POST", body: { query: q } });
    if (!r.ok) {
      const msg = (r.data && r.data.error) ? r.data.error : `Search failed (${r.status}).`;
      setMsg(msg, "error");
      return;
    }

    // Worker returns { ok:true, intent:..., context:{...} }
    const context = (r.data && typeof r.data === "object") ? (r.data.context || null) : null;
    renderBundle(context || { customer: null, subscriptions: [], orders: [] }, r.data);

    setMsg("Done.", "ok");
  }

  /* ---------------- WIRE UP ---------------- */

  function wire() {
    if (el.btnLogin) el.btnLogin.addEventListener("click", doLogin);
    if (el.btnLogout) el.btnLogout.addEventListener("click", doLogout);
    if (el.btnSearch) el.btnSearch.addEventListener("click", doSearch);

    if (el.loginPass) el.loginPass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });

    if (el.query) el.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  }

  async function boot() {
    wire();
    await refreshStatus();
  }

  boot().catch((err) => {
    console.error(err);
    setMsg("App failed to start. Check console.", "error");
  });
})();

// 🔴 main.js