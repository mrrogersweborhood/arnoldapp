// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — cookie-session auth + pretty formatting (v2026-02-20k)
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
    badge: $("#sessionBadge"),
    statusText: $("#sessionText"),
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
    msg: $("#msg")
  };

  const state = {
    loggedIn: false,
    user: null,
    roles: [],
    lastQuery: ""
  };

  /* ---------------- UTIL ---------------- */

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripRedacted(val) {
    // Removes any fields whose value is exactly "[redacted]" (recursively).
    if (val === "[redacted]") return undefined;
    if (val == null) return val;

    if (Array.isArray(val)) {
      const out = [];
      for (const item of val) {
        const v = stripRedacted(item);
        if (v === undefined) continue;
        out.push(v);
      }
      return out;
    }

    if (typeof val === "object") {
      const out = {};
      for (const [k, v0] of Object.entries(val)) {
        const v = stripRedacted(v0);
        if (v === undefined) continue;
        out[k] = v;
      }
      return out;
    }

    return val;
  }

  function setMsg(text, kind = "info") {
    if (!el.msg) return;
    el.msg.textContent = text || "";
    el.msg.className = kind ? `msg msg-${kind}` : "msg";
    el.msg.style.display = text ? "block" : "none";
  }

  function setSessionUi() {
    if (el.badge) el.badge.classList.toggle("on", !!state.loggedIn);
    if (el.statusText) el.statusText.textContent = state.loggedIn ? "Session: logged in" : "Session: logged out";

    if (el.btnLogin) el.btnLogin.disabled = !!state.loggedIn;
    if (el.btnLogout) el.btnLogout.disabled = !state.loggedIn;

    if (el.query) el.query.disabled = !state.loggedIn;
    if (el.btnSearch) el.btnSearch.disabled = !state.loggedIn;
  }

  function fmtPhone(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const digits = s.replace(/[^\d]/g, "");
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    return String(raw);
  }

  function fmtDateTime(raw) {
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function fmtMoney(amount, currency) {
    const n = Number(amount);
    const c = (currency || "USD").toUpperCase();
    if (!Number.isFinite(n)) return String(amount ?? "");
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);
    } catch (_) {
      return `${n.toFixed(2)} ${c}`;
    }
  }

  function addressLine(a) {
    if (!a) return "";
    const parts = [
      [a.first_name, a.last_name].filter(Boolean).join(" "),
      a.address_1,
      a.address_2,
      [a.city, a.state].filter(Boolean).join(", "),
      a.postcode,
      a.country
    ].filter(Boolean);
    return parts.join(" • ");
  }

  function getDisplayName(customer) {
    const fn = customer?.first_name ? String(customer.first_name).trim() : "";
    const ln = customer?.last_name ? String(customer.last_name).trim() : "";
    const nm = [fn, ln].filter(Boolean).join(" ").trim();
    if (nm) return nm;
    return customer?.username || customer?.email || "";
  }

  function dlRow(label, value) {
    const v = String(value ?? "");
    if (!v) return "";
    return `<div class="dlRow"><div class="dlKey">${esc(label)}</div><div class="dlVal">${esc(v)}</div></div>`;
  }

  function renderCustomer(customer) {
    if (!el.outCustomer) return;
    if (!customer) {
      el.outCustomer.innerHTML = `<div class="empty">No customer record found for this query.</div>`;
      return;
    }

    const billing = customer.billing || null;
    const shipping = customer.shipping || null;
    const email = customer.email || billing?.email || "";
    const phone = billing?.phone || "";

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

  function renderSubNotes(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return "";
    // Newest first if dates present
    const sorted = arr.slice().sort((a, b) => {
      const da = Date.parse(a?.date_created || "") || 0;
      const db = Date.parse(b?.date_created || "") || 0;
      return db - da;
    });

    return sorted.map((n) => {
      const when = fmtDateTime(n?.date_created || "");
      const note = n?.note != null ? String(n.note) : "";
      // Keep it readable; notes can contain HTML, so escape it.
      return `<div class="noteLine"><div class="muted">${esc(when)}</div><div>${esc(note)}</div></div>`;
    }).join("");
  }

  function renderSubs(subs) {
    if (!el.outSubs) return;
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      el.outSubs.innerHTML = `<div class="empty">No subscriptions found.</div>`;
      return;
    }

    const rows = arr.map((s) => {
      const id = s.id != null ? `#${s.id}` : "";
      const status = s.status ? String(s.status) : "";
      const total = fmtMoney(s.total, s.currency);
      const start = fmtDateTime(s.start_date || "");
      const next = fmtDateTime(s.next_payment_date || "");
      const end = fmtDateTime(s.end_date || "");
      const pm = s.payment_method_title || s.payment_method || "";
      const notesHtml = renderSubNotes(s.notes);

      return `
        <tr>
          <td>
            <strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span>
            <div class="muted">${esc(start)}</div>
          </td>
          <td>${esc(total)}</td>
          <td>${esc(next)}</td>
          <td>${esc(end)}</td>
          <td>${esc(pm)}</td>
          <td>${notesHtml || ""}</td>
        </tr>
      `;
    }).join("");

    el.outSubs.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Total</th>
            <th>Next Payment</th>
            <th>End</th>
            <th>Payment Method</th>
            <th>Notes</th>
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

    const rows = arr.map((o) => {
      const id = o.id != null ? `#${o.id}` : "";
      const status = o.status ? String(o.status) : "";
      const total = fmtMoney(o.total, o.currency);
      const when = fmtDateTime(o.date_created || "");
      const pm = o.payment_method_title || o.payment_method || "";
      const items = Array.isArray(o.line_items) ? o.line_items : [];
      const itemText = items.map((li) => li?.name).filter(Boolean).slice(0, 3).join(" • ");

      return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span><div class="muted">${esc(when)}</div></td>
          <td>${esc(total)}</td>
          <td>${esc(pm)}</td>
          <td>${esc(itemText || "")}</td>
        </tr>
      `;
    }).join("");

    el.outOrders.innerHTML = `
      <table class="tbl">
        <thead>
          <tr><th>Order</th><th>Total</th><th>Payment</th><th>Items</th></tr>
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
      el.outJson.textContent = JSON.stringify(stripRedacted(rawJson ?? {}), null, 2);
    }
  }

  /* ---------------- API ---------------- */

  async function api(path, { method = "GET", body = null } = {}) {
    const url = `${PROXY_BASE}${path}`;
    const headers = { "Accept": "application/json" };
    if (body != null) headers["Content-Type"] = "application/json";

    const resp = await fetch(url, {
      method,
      headers,
      credentials: "include", // IMPORTANT: cookie-session auth
      body: body != null ? JSON.stringify(body) : null
    });

    let data = null;
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await resp.json().catch(() => null);
    } else {
      data = await resp.text().catch(() => "");
    }

    return { ok: resp.ok, status: resp.status, data };
  }

  async function refreshStatus() {
    const r = await api("/admin/status");
    if (r.ok && r.data && typeof r.data.loggedIn === "boolean") {
      state.loggedIn = !!r.data.loggedIn;
      state.user = r.data.user || null;
      state.roles = Array.isArray(r.data.roles) ? r.data.roles : [];
    } else {
      state.loggedIn = false;
      state.user = null;
      state.roles = [];
    }
    setSessionUi();
  }

  /* ---------------- AUTH ---------------- */

  async function doLogin() {
    setMsg("");
    const username = (el.loginEmail?.value || "").trim();
    const password = (el.loginPass?.value || "").trim();

    if (!username || !password) {
      setMsg("Login failed: Username and password required.", "error");
      return;
    }

    const r = await api("/admin/login", { method: "POST", body: { username, password } });
    if (!r.ok) {
      const msg = (r.data && r.data.message) ? r.data.message : `Login failed (${r.status}).`;
      setMsg(msg, "error");
      await refreshStatus();
      return;
    }

    setMsg("Done.", "ok");
    await refreshStatus();
  }

  async function doLogout() {
    setMsg("");
    await api("/admin/logout", { method: "POST" });
    await refreshStatus();
    setMsg("Logged out.", "info");
  }

  /* ---------------- SEARCH ---------------- */

  async function doSearch() {
    setMsg("");
    if (!state.loggedIn) {
      setMsg("Admin access required.", "warn");
      return;
    }

    const qRaw = (el.query?.value || "").trim();
    state.lastQuery = qRaw;

    // Numeric-only input => treat as order lookup
    let q = qRaw;
    if (/^\d+$/.test(qRaw)) q = `order #${qRaw}`;
    else if (/^#\d+$/.test(qRaw)) q = `order ${qRaw}`;

    if (!q) {
      setMsg("Enter a query (example: orders for email bob@abc.com).", "warn");
      return;
    }

    if (el.outCustomer) el.outCustomer.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outSubs) el.outSubs.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outOrders) el.outOrders.innerHTML = `<div class="empty">Loading…</div>`;
    if (el.outJson) el.outJson.textContent = "";

    const r = await api("/admin/nl-search", { method: "POST", body: { query: q } });
    if (!r.ok) {
      const msg = (r.data && r.data.error) ? r.data.error : `Search failed (${r.status}).`;
      setMsg(msg, "error");
      await refreshStatus();
      return;
    }

    const data = r.data || {};
    const ctx = data.context || { customer: null, subscriptions: [], orders: [] };
    renderBundle(ctx, data);
    setMsg("", "info");
  }

  /* ---------------- WIREUP ---------------- */

  function wire() {
    if (el.btnLogin) el.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
    if (el.btnLogout) el.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
    if (el.btnSearch) el.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

    // Enter-to-submit
    if (el.loginPass) el.loginPass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doLogin(); }
    });
    if (el.query) el.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doSearch(); }
    });
  }

  async function boot() {
    wire();
    await refreshStatus();
    setMsg("", "info");
  }

  boot().catch((err) => {
    console.error(err);
    setMsg("App failed to start. Check console.", "error");
  });
})();

// 🔴 main.js