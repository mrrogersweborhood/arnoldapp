// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-21b)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  const BUILD = "2026-02-21b";

  // ✅ Arnold Admin Worker base URL (do not change without updating handoff docs)
  const API_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  // -------- DOM (supports legacy IDs to prevent churn) --------
  const byId = (id) => document.getElementById(id);
  const first = (...ids) => {
    for (const id of ids) {
      const n = byId(id);
      if (n) return n;
    }
    return null;
  };

  const el = {
    // Session
    sessionPill: first("sessionPill", "sessionBadge"),
    sessionText: first("sessionText"),

    // Auth
    loginUser: first("loginUser", "loginEmail", "user"),
    loginPass: first("loginPass"),
    btnLogin: first("btnLogin", "loginBtn"),
    btnLogout: first("btnLogout", "logoutBtn"),

    // Search
    query: first("query"),
    btnSearch: first("btnSearch", "searchBtn"),
    msg: first("msg"),

    // Outputs
    outCustomer: first("customerOut", "outCustomer"),
    outSubs: first("subsOut", "outSubs"),
    outOrders: first("ordersOut", "outOrders"),
    outJson: first("rawOut", "outJson"),
  };

  // Hard stop if index.html / main.js are mismatched.
  const REQUIRED = [
    "sessionPill","sessionText","loginUser","loginPass","btnLogin","btnLogout","query","btnSearch","msg",
    "outCustomer","outSubs","outOrders","outJson"
  ];
  const missing = REQUIRED.filter((k) => !el[k]);
  if (missing.length) {
    const warn = `DOM mismatch: missing element(s): ${missing.join(", ")}. index.html and main.js must be updated together.`;
    console.error(warn);
    // Best effort to display
    if (el.msg) {
      el.msg.textContent = warn;
      el.msg.style.display = "block";
      el.msg.style.color = "#b91c1c";
      el.msg.style.fontWeight = "800";
    } else {
      alert(warn);
    }
    return;
  }

  // -------- helpers --------
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  function fmtPhone(v) {
    const raw = String(v ?? "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw;
  }

  const fmtMoney = (v) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const fmtDateTime = (v) => {
    if (!v) return "—";
    // Accept ISO, unix seconds, or unix ms
    let d = null;
    if (typeof v === "number") d = new Date(v > 1e12 ? v : v * 1000);
    else {
      const s = String(v);
      if (/^\d{10,13}$/.test(s)) {
        const n = Number(s);
        d = new Date(n > 1e12 ? n : n * 1000);
      } else {
        d = new Date(s);
      }
    }
    if (!(d instanceof Date) || isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  };

  const badgeClass = (status) => {
    const s = String(status ?? "").toLowerCase();
    if (["active","processing","completed","paid"].includes(s)) return "badge green";
    if (["cancelled","canceled","failed","refunded","expired","trash"].includes(s)) return "badge red";
    return "badge gray";
  };

  const setMsg = (text, tone = "normal") => {
    el.msg.textContent = text || "";
    el.msg.style.display = text ? "block" : "none";
    el.msg.style.color = tone === "error" ? "#b91c1c" : "inherit";
    el.msg.style.fontWeight = tone === "error" ? "800" : "normal";
  };

  const setSession = (state, extra = "") => {
    // state: "checking" | "in" | "out"
    const label =
      state === "checking" ? "Session: checking…" :
      state === "in" ? "Session: logged in" :
      "Session: logged out";
    el.sessionText.textContent = extra ? `${label} — ${extra}` : label;

    el.sessionPill.dataset.state = state;
  };

  async function api(path, { method = "GET", body = null, headers = {}, timeoutMs = 15000 } = {}) {
    const url = `${API_BASE}${path}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    const opts = {
      method,
      credentials: "include",
      headers: { ...headers },
      signal: ctrl.signal
    };

    if (body !== null) {
      // Default to JSON; worker should accept JSON.
      if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
      opts.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      const res = await fetch(url, opts);
      const ctype = (res.headers.get("content-type") || "").toLowerCase();

      let data = null;
      if (ctype.includes("application/json")) data = await res.json();
      else data = await res.text();

      return { ok: res.ok, status: res.status, data, res };
    } finally {
      clearTimeout(t);
    }
  }

  function clearOutputs() {
    el.outCustomer.innerHTML = "—";
    el.outSubs.innerHTML = "—";
    el.outOrders.innerHTML = "—";
    el.outJson.textContent = "";
  }

  // -------- renderers --------
  function kvRow(k, v) {
    return `<div class="row"><div class="k">${esc(k)}</div><div class="v">${v || "—"}</div></div>`;
  }

  function renderAddressCard(title, obj = {}) {
    const name = esc(obj.name || (obj.first_name && obj.last_name ? `${obj.first_name} ${obj.last_name}` : obj.company || ""));
    const email = esc(obj.email || "");
    const phone = esc(fmtPhone(obj.phone || ""));
    const parts = [
      obj.address_1, obj.address_2, obj.city,
      obj.state, obj.postcode, obj.country
    ].filter(Boolean);

    const addr = parts.length ? esc(parts.join(" • ")) : "—";

    return `
      <div class="card">
        <div class="h2">${esc(title)}</div>
        ${kvRow("name", name || "—")}
        ${kvRow("address", addr)}
        ${kvRow("email", email || "—")}
        ${kvRow("phone", phone || "—")}
      </div>
    `;
  }

  function renderCustomer(data = {}) {
    const c = data.customer || data || {};
    const billing = c.billing || data.billing || {};
    const shipping = c.shipping || data.shipping || {};

    // Customer summary: ONLY id + username (as requested)
    const cid = c.id ?? c.customer_id ?? "—";
    const uname = c.username || c.user_login || c.email || "—";

    const top = `
      <div class="card">
        <div class="h2">Customer</div>
        <div class="cols2">
          <div>${kvRow("customer id", `<span class="mono">${esc(cid)}</span>`)}</div>
          <div>${kvRow("username", esc(uname))}</div>
        </div>
      </div>
    `;

    // Billing + Shipping side-by-side
    const cards = `
      <div class="cols2">
        ${renderAddressCard("Billing", billing)}
        ${renderAddressCard("Shipping", shipping)}
      </div>
    `;

    return `${top}${cards}`;
  }

  function renderSubscriptionNotes(notes) {
    if (!Array.isArray(notes) || notes.length === 0) return "—";
    return notes.map((n) => {
      const when = fmtDateTime(n.date_created_gmt || n.date_created || n.created || n.time || n.date);
      const who = esc(n.author || n.by || n.type || "WooCommerce");
      const text = esc(n.note || n.content || n.message || "");
      return `
        <div class="note">
          <div class="noteTop"><span>${esc(when)}</span><span>${who}</span></div>
          <div class="noteText">${text || "—"}</div>
        </div>
      `;
    }).join("");
  }

  function renderSubs(data = {}) {
    const subs = data.subscriptions || data.subs || [];
    if (!Array.isArray(subs) || subs.length === 0) return "—";

    const rows = subs.map((s) => {
      const id = s.id ?? s.subscription_id ?? "—";
      const status = s.status ?? "—";
      const total = s.total ?? s.recurring_total ?? s.order_total ?? "—";

      const nextPay =
        s.next_payment_date || s.next_payment || s.schedule_next_payment || s.date_next_payment || s.next_payment_gmt || null;

      const end =
        s.end_date || s.date_end || s.schedule_end || s.date_end_gmt || null;

      const notes = s.notes || s.subscription_notes || s.note || [];

      return `
        <tr>
          <td><span class="mono">#${esc(id)}</span></td>
          <td><span class="${badgeClass(status)}">${esc(status)}</span></td>
          <td>${esc(fmtMoney(total))}</td>
          <td>${esc(fmtDateTime(nextPay))}</td>
          <td>${esc(fmtDateTime(end))}</td>
          <td class="right">${renderSubscriptionNotes(notes)}</td>
        </tr>
      `;
    }).join("");

    return `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Status</th>
            <th>Total</th>
            <th>Next payment</th>
            <th>End</th>
            <th class="right">Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderOrders(data = {}) {
    const orders = data.orders || [];
    if (!Array.isArray(orders) || orders.length === 0) return "—";

    const rows = orders.map((o) => {
      const id = o.id ?? o.order_id ?? "—";
      const status = o.status ?? "—";
      const total = o.total ?? o.order_total ?? "—";
      const payment = o.payment_method_title || o.payment_method || "—";
      const when = o.date_created_gmt || o.date_created || o.created || o.date || null;

      const items = Array.isArray(o.line_items) ? o.line_items.map((li) => li.name).filter(Boolean) : [];
      const itemText = items.length ? esc(items.slice(0, 2).join(" • ") + (items.length > 2 ? ` • +${items.length - 2} more` : "")) : "—";

      return `
        <tr>
          <td><span class="mono">#${esc(id)}</span> <span class="${badgeClass(status)}">${esc(status)}</span></td>
          <td>${esc(fmtMoney(total))}</td>
          <td>${esc(payment)}</td>
          <td>${esc(fmtDateTime(when))}</td>
          <td>${itemText}</td>
        </tr>
      `;
    }).join("");

    return `
      <table class="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Date</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function setRawJson(obj) {
    const pretty = JSON.stringify(obj, null, 2);
    el.outJson.textContent = pretty;
  }

  // -------- actions --------
  async function checkStatus() {
    setSession("checking");
    try {
      const r = await api("/admin/status", { method: "GET" });
      if (r.ok && r.data && typeof r.data === "object") {
        const loggedIn = !!(r.data.logged_in ?? r.data.ok ?? r.data.authenticated);
        setSession(loggedIn ? "in" : "out");
        return loggedIn;
      }
      setSession("out");
      return false;
    } catch (e) {
      console.warn("status check failed", e);
      setSession("out", "status error");
      return false;
    }
  }

  async function doLogin() {
    setMsg("");
    const user = String(el.loginUser.value || "").trim();
    const pass = String(el.loginPass.value || "").trim();
    if (!user || !pass) {
      setMsg("Enter username and password.", "error");
      return;
    }

    setSession("checking");
    try {
      const r = await api("/admin/login", { method: "POST", body: { username: user, password: pass } });
      if (r.ok) {
        await checkStatus();
        setMsg("");
        return;
      }
      setSession("out");
      setMsg("Login failed.", "error");
    } catch (e) {
      setSession("out");
      setMsg("Login failed (network error).", "error");
    }
  }

  async function doLogout() {
    setMsg("");
    setSession("checking");
    try {
      await api("/admin/logout", { method: "POST", body: {} });
    } catch {}
    await checkStatus();
    clearOutputs();
  }

  async function doSearch() {
    setMsg("");
    const q = String(el.query.value || "").trim();
    if (!q) return;

    const ok = await checkStatus();
    if (!ok) {
      setMsg("Not logged in. Please log in first.", "error");
      return;
    }

    el.btnSearch.disabled = true;
    try {
      const r = await api("/admin/nl-search", { method: "POST", body: { q } });
      if (!r.ok) {
        setMsg(`Search failed (HTTP ${r.status}).`, "error");
        return;
      }
      const data = r.data && typeof r.data === "object" ? r.data : { raw: r.data };

      // Render in strict order: Customer → Subscriptions → Orders
      el.outCustomer.innerHTML = renderCustomer(data);
      el.outSubs.innerHTML = renderSubs(data);
      el.outOrders.innerHTML = renderOrders(data);

      setRawJson(data);
    } catch (e) {
      console.error(e);
      setMsg("Search failed (network error).", "error");
    } finally {
      el.btnSearch.disabled = false;
    }
  }

  // -------- wire up --------
  el.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
  el.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
  el.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

  el.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // Initial paint
  setRawJson({ build: BUILD, apiBase: API_BASE });
  clearOutputs();
  checkStatus();

})();

// 🔴 main.js