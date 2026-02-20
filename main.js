// 🟢 main.js
// Arnold Admin SPA (GitHub Pages) — cookie-session auth + pretty formatting (v2026-02-20n)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /* ---------------- CONFIG ---------------- */

  // 🔧 Cloudflare Worker (production)
  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  /* ---------------- DOM ---------------- */

  const el = {
    loginUser: document.getElementById("loginUser"),
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    statusPill: document.getElementById("statusPill"),
    msg: document.getElementById("msg"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),

    outCustomer: document.getElementById("outCustomer"),
    outSubs: document.getElementById("outSubs"),
    outOrders: document.getElementById("outOrders"),
    outJson: document.getElementById("outJson"),
  };

  const state = {
    loggedIn: false,
    user: null,
    roles: [],
    lastQuery: "",
  };

  /* ---------------- UTIL ---------------- */

  async function api(path, { method = "GET", body = null } = {}) {
    const headers = { "Content-Type": "application/json" };
    const init = { method, headers, credentials: "include" };
    if (body != null) init.body = JSON.stringify(body);
    const r = await fetch(`${WORKER_BASE}${path}`, init);
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { ok: r.ok, status: r.status, data };
  }

  function fmtDateTime(iso) {
    const s = String(iso || "").trim();
    if (!s) return "";
    const d = new Date(s);
    if (!isFinite(d)) return s;
    try {
      return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (_) {
      return d.toString();
    }
  }

  function fmtMoney(amount, currency) {
    const c = (currency || "USD").toUpperCase();
    const n = Number(amount);
    if (!isFinite(n)) return String(amount ?? "");
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);
    } catch (_) {
      return `${n.toFixed(2)} ${c}`;
    }
  }

  function fmtPhone(phone) {
    const s = String(phone || "").trim();
    if (!s) return "";
    // very light prettifier
    const digits = s.replace(/[^\d]/g, "");
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    return s;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\'/g, "&#39;");
  }

  /* ---------------- UI Tweaks ---------------- */

  function injectUiTweaks() {
    // Inject small, safe CSS tweaks without touching index.html
    const id = "arnoldAdminUiTweaks";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      /* OkObserver-ish label color */
      .row .k{ color:#1E90FF; font-weight:600; }

      /* Customer top fields: 2 columns on desktop */
      .oo-cust-grid{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        margin-top: 10px;
      }
      .oo-cust-col{
        border: 1px solid rgba(15,23,42,.06);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255,255,255,.75);
      }
      @media (max-width: 900px){
        .oo-cust-grid{ grid-template-columns: 1fr; }
      }

      /* Billing / Mailing side-by-side */
      .oo-addr-grid{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        margin-top: 14px;
      }
      .oo-addr-card{
        border: 1px solid rgba(15,23,42,.06);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255,255,255,.75);
      }
      .oo-addr-title{
        font-weight:700;
        margin-bottom: 8px;
        color: rgba(15,23,42,.86);
      }
      @media (max-width: 900px){
        .oo-addr-grid{ grid-template-columns: 1fr; }
      }

      /* Raw JSON collapsible */
      .oo-json-details{
        border: 1px solid rgba(15,23,42,.08);
        border-radius: 16px;
        overflow:hidden;
        background: rgba(255,255,255,.80);
      }
      .oo-json-summary{
        list-style:none;
        cursor:pointer;
        padding: 12px 14px;
        font-weight:700;
        display:flex;
        align-items:center;
        justify-content:space-between;
        user-select:none;
      }
      .oo-json-summary::-webkit-details-marker{ display:none; }
      .oo-json-summary:after{
        content:"›";
        transform: rotate(0deg);
        transition: transform .15s ease;
        font-size: 18px;
        opacity:.65;
      }
      details[open] > .oo-json-summary:after{
        transform: rotate(90deg);
      }
      .oo-json-panel{
        padding: 12px 14px;
        border-top: 1px solid rgba(15,23,42,.08);
      }

      /* Subscription notes: card style */
      .oo-note-card{
        background: #fff;
        border: 1px solid rgba(15,23,42,.08);
        border-radius: 14px;
        padding: 10px 12px;
        box-shadow: 0 6px 18px rgba(0,0,0,.06);
        margin: 10px 0;
      }
      .oo-note-date{
        color: rgba(15,23,42,.6);
        font-size: 12px;
        margin-bottom: 6px;
      }
      .oo-note-text{
        color: rgba(15,23,42,.92);
        line-height: 1.35;
      }
    `;
    document.head.appendChild(style);
  }

  function setupRawJsonCollapsible() {
    const pre = document.getElementById("outJson");
    if (!pre) return;

    // Avoid double-wrapping
    if (pre.closest(".oo-json-details")) return;

    // Find the Raw JSON card header and hide it so the summary becomes the clickable header.
    const headers = Array.from(document.querySelectorAll(".card h3"));
    const h3 = headers.find((x) => (x.textContent || "").trim().toLowerCase() === "raw json");
    if (h3) h3.style.display = "none";

    const body = pre.closest(".body") || pre.parentElement;
    if (!body) return;

    const details = document.createElement("details");
    details.className = "oo-json-details";

    const summary = document.createElement("summary");
    summary.className = "oo-json-summary";
    summary.textContent = "Raw JSON";

    const panel = document.createElement("div");
    panel.className = "oo-json-panel";

    // Move the PRE into the panel
    panel.appendChild(pre);
    details.appendChild(summary);
    details.appendChild(panel);

    // Replace body contents with the details element
    body.innerHTML = "";
    body.appendChild(details);
  }

  function deepStripRedacted(value) {
    // Remove any fields whose value is exactly "[redacted]" (case-insensitive), recursively.
    const isRedacted = (v) =>
      typeof v === "string" && v.trim().toLowerCase() === "[redacted]";

    if (value == null) return value;

    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        if (isRedacted(item)) continue;
        const cleaned = deepStripRedacted(item);
        if (isRedacted(cleaned)) continue;
        // Drop empty objects/arrays only if they are completely empty; keep primitives.
        if (Array.isArray(cleaned) && cleaned.length === 0) continue;
        if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) continue;
        out.push(cleaned);
      }
      return out;
    }

    if (typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (isRedacted(v)) continue;
        const cleaned = deepStripRedacted(v);
        if (isRedacted(cleaned)) continue;
        if (Array.isArray(cleaned) && cleaned.length === 0) continue;
        if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) continue;
        out[k] = cleaned;
      }
      return out;
    }

    return value;
  }

  function renderSubNotes(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return "";
    const sorted = [...arr].sort((a, b) => {
      const da = new Date(a?.date_created || a?.date || 0).getTime();
      const db = new Date(b?.date_created || b?.date || 0).getTime();
      return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
    });

    return sorted
      .map((n) => {
        const when = fmtDateTime(n?.date_created || n?.date || "");
        const note = n?.note != null ? String(n.note) : "";
        if (!note && !when) return "";
        return `
          <div class="oo-note-card">
            ${when ? `<div class="oo-note-date">${esc(when)}</div>` : ""}
            ${note ? `<div class="oo-note-text">${esc(note)}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function addressName(a) {
    if (!a) return "";
    return [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  }

  function setMsg(text, kind = "info") {
    if (!el.msg) return;
    el.msg.className = `msg ${kind}`;
    el.msg.textContent = text || "";
  }

  function setStatusPill(loggedIn) {
    if (!el.statusPill) return;
    el.statusPill.className = `pill ${loggedIn ? "ok" : "off"}`;
    el.statusPill.textContent = loggedIn ? "Session: logged in" : "Session: logged out";
  }

  /* ---------------- RENDER ---------------- */

  function dlRow(label, value) {
    if (value == null || String(value).trim() === "") return "";
    return `<div class="row"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div></div>`;
  }

  function addressLine(a) {
    if (!a) return "";
    const bits = [
      [a.first_name, a.last_name].filter(Boolean).join(" ").trim(),
      a.company,
      a.address_1,
      a.address_2,
      [a.city, a.state].filter(Boolean).join(", "),
      a.postcode,
      a.country
    ].filter(Boolean).map((x) => String(x).trim()).filter(Boolean);

    return bits.join(" • ");
  }

  function getDisplayName(cust) {
    const full = [cust?.first_name, cust?.last_name].filter(Boolean).join(" ").trim();
    return full || cust?.username || cust?.email || "";
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
    const phone = customer.phone || billing?.phone || "";

    el.outCustomer.innerHTML = `
      <div class="cardInner">
        <div class="oo-cust-grid">
          <div class="oo-cust-col">
            ${dlRow("Customer ID", customer.id ?? "")}
            ${dlRow("Username", customer.username ?? "")}
            ${dlRow("Name", getDisplayName(customer))}
          </div>

          <div class="oo-cust-col">
            ${dlRow("Email", email)}
            ${dlRow("Phone", fmtPhone(phone))}
          </div>
        </div>

        <div class="oo-addr-grid">
          <div class="oo-addr-card">
            <div class="oo-addr-title">Billing</div>
            ${dlRow("Name", addressName(billing))}
            ${dlRow("Address", addressLine(billing))}
            ${dlRow("Email", billing?.email ?? "")}
            ${dlRow("Phone", fmtPhone(billing?.phone ?? ""))}
          </div>

          <div class="oo-addr-card">
            <div class="oo-addr-title">Mailing</div>
            ${dlRow("Name", addressName(shipping))}
            ${dlRow("Address", addressLine(shipping))}
          </div>
        </div>
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

    const rows = arr.map((s) => {
      const id = s.id != null ? `#${s.id}` : "";
      const status = s.status ? String(s.status) : "";
      const total = fmtMoney(s.total, s.currency);

      const start = fmtDateTime(s.start_date || s.date_created || "");
      const next = fmtDateTime(s.next_payment_date || "");
      const end = fmtDateTime(s.end_date || "");

      const pm = s.payment_method_title || s.payment_method || "";

      // Notes (worker should provide `notes` as an array)
      const notesHtml = renderSubNotes(s.notes || s.subscription_notes || []);

      return `
        <tr>
          <td>
            <strong>${esc(id)}</strong>
            ${status ? `<span class="pill">${esc(status)}</span>` : ""}
          </td>
          <td>${esc(total)}</td>
          <td>${esc(start)}</td>
          <td>${esc(next)}</td>
          <td>${esc(end)}</td>
          <td>${esc(pm)}</td>
          <td>${notesHtml || `<span class="muted">—</span>`}</td>
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
      const items = Array.isArray(o.line_items) ? o.line_items.map(li => li?.name).filter(Boolean).join(", ") : "";
      return `
        <tr>
          <td><strong>${esc(id)}</strong> <span class="pill">${esc(status)}</span><div class="muted">${esc(when)}</div></td>
          <td>${esc(total)}</td>
          <td>${esc(pm)}</td>
          <td>${esc(items)}</td>
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
      const cleaned = deepStripRedacted(rawJson ?? {});
      el.outJson.textContent = JSON.stringify(cleaned ?? {}, null, 2);
    }
  }

  /* ---------------- AUTH ---------------- */

  async function refreshStatus() {
    const r = await api("/admin/status");
    if (!r.ok) {
      state.loggedIn = false;
      state.user = null;
      state.roles = [];
      setStatusPill(false);
      return;
    }

    state.loggedIn = !!r.data?.loggedIn;
    state.user = r.data?.user || null;
    state.roles = Array.isArray(r.data?.roles) ? r.data.roles : [];
    setStatusPill(state.loggedIn);
  }

  async function doLogin() {
    setMsg("");
    const username = (el.loginUser?.value || "").trim();
    const password = (el.loginPass?.value || "").trim();
    if (!username || !password) {
      setMsg("Login failed: Username and password required.", "warn");
      return;
    }

    const r = await api("/admin/login", { method: "POST", body: { username, password } });
    if (!r.ok) {
      const msg = r.data?.message || r.data?.error || `Login failed (${r.status}).`;
      setMsg(msg, "error");
      await refreshStatus();
      return;
    }

    await refreshStatus();
    setMsg("Done.", "ok");
  }

  async function doLogout() {
    setMsg("");
    const r = await api("/admin/logout", { method: "POST" });
    if (!r.ok) {
      setMsg(`Logout failed (${r.status}).`, "error");
      await refreshStatus();
      return;
    }
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

    let q = (el.query?.value || "").trim();

    // If user enters a purely numeric term, treat it as an order lookup.
    // Example: "389312" => "order #389312"
    if (/^#?\d+$/.test(q)) {
      q = `order #${String(q).replace(/^#/, "")}`;
      if (el.query) el.query.value = q;
    }
    state.lastQuery = q;

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

  /* ---------------- WIRE UP ---------------- */

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
    injectUiTweaks();
    setupRawJsonCollapsible();

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