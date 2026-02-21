// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-21a)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /* ============================================================
     Arnold Admin main.js — v2026-02-21a
     Goals:
     - FIX regression: align JS DOM IDs with index.html (no mismatches)
     - Use correct Worker base: https://arnold-admin-worker.bob-b5c.workers.dev
     - Keep OkObserver look/feel: use index.html CSS classes (no injected CSS)
     - Notes render as cards (noteCard)
     - Raw JSON updates in <pre id="outJson">
     ============================================================ */

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const ENDPOINTS = {
    status: "/admin/status",
    login: "/admin/login",
    logout: "/admin/logout",
    search: "/admin/nl-search"
  };

  const els = {
    loginEmail: document.getElementById("loginEmail"),
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),

    sessionBadge: document.getElementById("sessionBadge"),
    sessionText: document.getElementById("sessionText"),

    msg: document.getElementById("msg"),

    queryInput: document.getElementById("queryInput"),
    btnSearch: document.getElementById("btnSearch"),

    customerSection: document.getElementById("customerSection"),
    subsSection: document.getElementById("subsSection"),
    ordersSection: document.getElementById("ordersSection"),

    outJson: document.getElementById("outJson")
  };

  // Defensive: if anything critical is missing, fail loud (prevents silent churn)
  const required = [
    "loginEmail","loginPass","btnLogin","btnLogout",
    "sessionBadge","sessionText","msg",
    "queryInput","btnSearch",
    "customerSection","subsSection","ordersSection","outJson"
  ];
  for (const k of required) {
    if (!els[k]) {
      alert(`Arnold Admin: missing element #${k} (index.html/main.js mismatch).`);
      return;
    }
  }

  function setMsg(type, text) {
    els.msg.className = "msg " + (type || "");
    els.msg.textContent = text || "";
  }

  function setSession(loggedIn) {
    els.sessionBadge.classList.toggle("on", !!loggedIn);
    els.sessionText.textContent = loggedIn ? "Session: logged in" : "Session: logged out";
  }

  async function apiFetch(path, options = {}) {
    const url = WORKER_BASE + path;
    const opts = {
      method: options.method || "GET",
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      },
      credentials: "include",
      ...(options.body != null ? { body: options.body } : {})
    };

    if (options.json != null) {
      opts.method = options.method || "POST";
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(options.json);
    }

    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { resp, data, url };
  }

  function clearOutputs() {
    els.customerSection.innerHTML = `<div class="muted">—</div>`;
    els.subsSection.innerHTML = `<div class="muted">—</div>`;
    els.ordersSection.innerHTML = `<div class="muted">—</div>`;
    els.outJson.textContent = "";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtMoney(total, currency) {
    const t = (total == null || total === "") ? "" : String(total);
    const c = currency ? String(currency) : "";
    return t ? (t + (c ? (" " + c) : "")) : "—";
  }

  function fmtDate(s) {
    if (!s) return "—";
    return String(s);
  }

  function kvRow(label, value) {
    const v = (value == null || value === "") ? "—" : String(value);
    return `<div class="kv"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(v)}</div></div>`;
  }

  function renderAddressCard(title, a) {
    const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—";
    const addrBits = [a?.address_1, a?.address_2, a?.city, a?.state, a?.postcode, a?.country].filter(Boolean);
    const addr = addrBits.length ? addrBits.join(" • ") : "—";

    return `
      <div class="card">
        <div class="h3">${escapeHtml(title)}</div>
        <div class="kvGrid">
          ${kvRow("name", name)}
          ${kvRow("address", addr)}
          ${kvRow("email", a?.email)}
          ${kvRow("phone", a?.phone)}
        </div>
      </div>
    `;
  }

  function renderCustomer(customer) {
    if (!customer) {
      els.customerSection.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const fullName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim()
      || (customer?.name || "—");

    const left = `
      <div class="kvGrid">
        ${kvRow("customer id", customer?.id)}
        ${kvRow("username", customer?.username)}
        ${kvRow("name", fullName)}
        ${kvRow("email", customer?.email)}
        ${kvRow("phone", customer?.billing?.phone || customer?.shipping?.phone || "")}
      </div>
    `;

    const billing = renderAddressCard("Billing", customer?.billing || null);
    const shipping = renderAddressCard("Shipping", customer?.shipping || null);

    els.customerSection.innerHTML = `
      ${left}
      <div class="grid2" style="margin-top:12px">
        ${billing}
        ${shipping}
      </div>
    `;
  }

  function renderNotes(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return `<div class="muted">—</div>`;

    return `
      <div class="noteStack">
        ${arr.map(n => {
          const when = n?.date_created ? String(n.date_created) : "";
          const txt = n?.note ? String(n.note) : "";
          return `
            <div class="noteCard">
              <div class="noteMeta">${escapeHtml(when)}</div>
              <div class="noteBody">${escapeHtml(txt)}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      els.subsSection.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    els.subsSection.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Total</th>
            <th>Start</th>
            <th>Next pay</th>
            <th>Payment method</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map(s => {
            const id = s?.id ?? "";
            const status = s?.status ?? "";
            const start = fmtDate(s?.start_date);
            const nextPay = fmtDate(s?.next_payment_date);
            const total = fmtMoney(s?.total, s?.currency);
            const pm = s?.payment_method_title || s?.payment_method || "—";
            const badge = status ? `<span class="badge">${escapeHtml(status)}</span>` : "";

            return `
              <tr>
                <td><strong>#${escapeHtml(id)}</strong> ${badge}</td>
                <td>${escapeHtml(total)}</td>
                <td>${escapeHtml(start)}</td>
                <td>${escapeHtml(nextPay)}</td>
                <td>${escapeHtml(pm)}</td>
                <td>${renderNotes(s?.notes)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      els.ordersSection.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    function itemsText(o) {
      const lis = Array.isArray(o?.line_items) ? o.line_items : [];
      if (!lis.length) return "—";
      return lis.slice(0, 3).map(li => li?.name || "").filter(Boolean).join(" • ") || "—";
    }

    els.ordersSection.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map(o => {
            const id = o?.id ?? "";
            const status = o?.status ?? "";
            const created = fmtDate(o?.date_created);
            const total = fmtMoney(o?.total, o?.currency);
            const pm = o?.payment_method_title || o?.payment_method || "—";
            const badge = status ? `<span class="badge">${escapeHtml(status)}</span>` : "";

            return `
              <tr>
                <td><strong>#${escapeHtml(id)}</strong> ${badge}<div class="muted">${escapeHtml(created)}</div></td>
                <td>${escapeHtml(total)}</td>
                <td>${escapeHtml(pm)}</td>
                <td>${escapeHtml(itemsText(o))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function normalizeContext(payload) {
    const ctx = payload?.context || {};

    let customer = ctx.customer || null;
    let subscriptions = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    let orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    if (Array.isArray(payload?.results) && payload?.intent && String(payload.intent).includes("orders")) {
      orders = payload.results;
    }

    return { customer, subscriptions, orders };
  }

  async function refreshStatus() {
    try {
      const r = await apiFetch(ENDPOINTS.status);
      const ok = r.resp.ok && r.data && (r.data.loggedIn === true || r.data.loggedIn === false);
      if (!ok) { setSession(false); return; }
      setSession(!!r.data.loggedIn);
    } catch (_) {
      setSession(false);
    }
  }

  async function doLogin() {
    setMsg("", "");
    const username = String(els.loginEmail.value || "").trim();
    const password = String(els.loginPass.value || "");
    if (!username || !password) { setMsg("bad", "Username and password required."); return; }

    els.btnLogin.disabled = true;
    try {
      const r = await apiFetch(ENDPOINTS.login, { json: { username, password } });
      if (!r.resp.ok || !r.data?.success) {
        const msg = r.data?.message || `Login failed (${r.resp.status}).`;
        setMsg("bad", msg);
        setSession(false);
        return;
      }
      setMsg("good", "Logged in.");
      setSession(true);
      els.loginPass.value = "";
    } catch (_) {
      setMsg("bad", "Login failed (network).");
      setSession(false);
    } finally {
      els.btnLogin.disabled = false;
    }
  }

  async function doLogout() {
    setMsg("", "");
    els.btnLogout.disabled = true;
    try { await apiFetch(ENDPOINTS.logout, { method: "POST" }); } catch (_) {}
    setSession(false);
    setMsg("good", "Logged out.");
    els.btnLogout.disabled = false;
    clearOutputs();
  }

  async function doSearch() {
    setMsg("", "");
    clearOutputs();

    const q = String(els.queryInput.value || "").trim();
    if (!q) { setMsg("bad", "Enter a query."); return; }

    await refreshStatus();

    els.btnSearch.disabled = true;
    try {
      const r = await apiFetch(ENDPOINTS.search, { json: { query: q } });
      els.outJson.textContent = JSON.stringify(r.data, null, 2);

      if (!r.resp.ok || r.data?.ok === false) {
        const msg = r.data?.error || r.data?.message || `Search failed (${r.resp.status}).`;
        setMsg("bad", msg);
        return;
      }

      const ctx = normalizeContext(r.data);
      renderCustomer(ctx.customer);
      renderSubscriptions(ctx.subscriptions);
      renderOrders(ctx.orders);

      setMsg("good", "Search complete.");
    } catch (_) {
      setMsg("bad", "Search failed (network).");
    } finally {
      els.btnSearch.disabled = false;
    }
  }

  els.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
  els.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
  els.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

  els.queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doSearch(); }
  });

  clearOutputs();
  refreshStatus();

})();

// 🔴 main.js