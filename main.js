// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — UI formatting restored + Raw JSON collapsible + numeric=>order + hide redacted (v2026-02-20l)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /* ---------------- CONFIG ---------------- */

  // IMPORTANT: This must point at your Cloudflare Worker (Arnold Admin worker)
  // Example: https://arnold-admin-worker.bob-b5c.workers.dev
  const PROXY_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  /* ---------------- STATE ---------------- */

  const state = {
    loggedIn: false,
    user: null,
    roles: [],
    lastQuery: ""
  };

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

  /* ---------------- UTIL: formatting ---------------- */

  function fmtPhone(raw) {
    if (!raw) return "";
    const digits = String(raw).replace(/\D+/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
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

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function addressLine(a) {
    if (!a) return "";
    const parts = [
      [a.first_name, a.last_name].filter(Boolean).join(" ").trim(),
      a.address_1,
      a.address_2,
      [a.city, a.state].filter(Boolean).join(", ").trim(),
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

  // Uses index.html CSS classes: .row .k .v  (this is the “pretty formatting” grid)
  function kvRow(key, value) {
    const v = String(value ?? "").trim();
    if (!v) return "";
    return `<div class="row"><div class="k">${esc(key)}</div><div class="v">${esc(v)}</div></div>`;
  }

  /* ---------------- Raw JSON: hide redacted fields ---------------- */

  function stripRedacted(val) {
    // Remove any fields whose value is exactly "[redacted]" (recursively).
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

  /* ---------------- UI: Raw JSON collapsible (default closed) ---------------- */

  function setupRawJsonCollapsible() {
    // Find the "Raw JSON" card from index.html markup: <div class="card"><h3>Raw JSON</h3><div class="body"><pre id="outJson">...</pre>
    if (!el.outJson) return;

    const pre = el.outJson;
    const body = pre.closest(".body");
    const card = pre.closest(".card");
    if (!body || !card) return;

    const h3 = card.querySelector("h3");
    if (!h3) return;

    // Default collapsed (closed)
    let open = false;

    // Add a right-side chevron indicator
    const chev = document.createElement("span");
    chev.textContent = "▸";
    chev.style.marginLeft = "auto";
    chev.style.opacity = "0.85";

    // Make header a flex row so the chevron can sit to the right without changing index.html
    h3.style.display = "flex";
    h3.style.alignItems = "center";
    h3.style.gap = "10px";
    h3.style.cursor = "pointer";
    h3.appendChild(chev);

    const apply = () => {
      body.style.display = open ? "block" : "none";
      chev.textContent = open ? "▾" : "▸";
    };

    apply();

    h3.addEventListener("click", () => {
      open = !open;
      apply();
    });
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

    const txt = await resp.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch (_) {
      data = txt;
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
      ${kvRow("Customer ID", customer.id ?? "")}
      ${kvRow("Username", customer.username ?? "")}
      ${kvRow("Name", getDisplayName(customer))}
      ${kvRow("Email", email)}
      ${kvRow("Phone", fmtPhone(phone))}
      ${kvRow("Billing Address", addressLine(billing))}
      ${kvRow("Shipping Address", addressLine(shipping))}
    `;
  }

  function normalizeNotesArray(notesMaybe) {
    // Worker may return notes under different keys; accept several.
    const n =
      notesMaybe ||
      null;

    if (Array.isArray(n)) return n;

    // Sometimes notes arrive as meta_data entries; we only render if worker already extracted them.
    return [];
  }

  function renderSubNotes(notes) {
    const arr = normalizeNotesArray(notes);
    if (!arr.length) return "";

    // newest-first if dates exist
    const sorted = arr.slice().sort((a, b) => {
      const da = Date.parse(a?.date_created || a?.date || "") || 0;
      const db = Date.parse(b?.date_created || b?.date || "") || 0;
      return db - da;
    });

    // Keep compact: each note as “date — note”
    return sorted.map((n) => {
      const when = fmtDateTime(n?.date_created || n?.date || "");
      const note = n?.note != null ? String(n.note) : "";
      if (!note && !when) return "";
      return `<div class="muted" style="margin-top:6px">${esc(when)}</div><div style="margin-top:2px">${esc(note)}</div>`;
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
      const start = fmtDateTime(s.start_date || s.date_created || "");
      const next = fmtDateTime(s.next_payment_date || "");
      const end = fmtDateTime(s.end_date || "");
      const pm = s.payment_method_title || s.payment_method || "";
      const notes = renderSubNotes(s.notes || s.subscription_notes || s.note_history);

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
          <td>${notes || ""}</td>
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
      const itemText = items
        .map((li) => li?.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(" • ");

      return `
        <tr>
          <td>
            <strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span>
            <div class="muted">${esc(when)}</div>
          </td>
          <td>${esc(total)}</td>
          <td>${esc(pm)}</td>
          <td>${esc(itemText || "")}</td>
        </tr>
      `;
    }).join("");

    el.outOrders.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderBundle(context, rawJson) {
    renderCustomer(context?.customer || null);
    renderSubs(context?.subscriptions || []);
    renderOrders(context?.orders || []);

    if (el.outJson) {
      const cleaned = stripRedacted(rawJson ?? {});
      el.outJson.textContent = JSON.stringify(cleaned === undefined ? {} : cleaned, null, 2);
    }
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

  function coerceQuery(raw) {
    const q = String(raw || "").trim();

    // Numeric-only => order lookup
    if (/^\d+$/.test(q)) return `order #${q}`;
    if (/^#\d+$/.test(q)) return `order ${q}`;

    return q;
  }

  async function doSearch() {
    setMsg("");
    if (!state.loggedIn) {
      setMsg("Admin access required.", "warn");
      return;
    }

    const qRaw = (el.query?.value || "").trim();
    state.lastQuery = qRaw;

    const q = coerceQuery(qRaw);
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
  }

  /* ---------------- WIREUP ---------------- */

  function wire() {
    if (el.btnLogin) el.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
    if (el.btnLogout) el.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
    if (el.btnSearch) el.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

    if (el.loginPass) el.loginPass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doLogin(); }
    });
    if (el.query) el.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doSearch(); }
    });
  }

  async function boot() {
    wire();
    setupRawJsonCollapsible(); // default closed + clickable
    await refreshStatus();
    setMsg("", "info");
  }

  boot().catch((err) => {
    console.error(err);
    setMsg("App failed to start. Check console.", "error");
  });
})();

// 🔴 main.js