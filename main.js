// 🟢 main.js
// Arnold Admin SPA — FULL REPLACEMENT (v2026-02-20v)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  // IMPORTANT:
  // - This app must talk to the Arnold Admin Worker:
  //     https://arnold-admin-worker.bob-b5c.workers.dev
  // - index.html DOM IDs are authoritative; this file must match them exactly.

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const ENDPOINTS = {
    login: `${WORKER_BASE}/admin/login`,
    logout: `${WORKER_BASE}/admin/logout`,
    status: `${WORKER_BASE}/admin/status`,
    search: `${WORKER_BASE}/admin/nl-search`
  };

  const els = {
    // Auth
    user: document.getElementById("inputUser"),
    pass: document.getElementById("inputPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    sessionPill: document.getElementById("sessionPill"),

    // Search
    query: document.getElementById("inputQuery"),
    btnSearch: document.getElementById("btnSearch"),
    msg: document.getElementById("statusMsg"),

    // Output
    outCustomer: document.getElementById("outCustomer"),
    outSubs: document.getElementById("outSubs"),
    outOrders: document.getElementById("outOrders"),

    // Raw JSON (index.html uses a native <details>)
    rawDetails: document.getElementById("rawJsonDetails"),
    outJson: document.getElementById("outJson")
  };

  const state = {
    loggedIn: false,
    user: null,
    roles: [],
    lastRaw: null
  };

  function injectStyles() {
    if (document.getElementById("arnoldAdminStyles")) return;

    const style = document.createElement("style");
    style.id = "arnoldAdminStyles";
    style.textContent = `
      /* Arnold Admin UI polish (runtime-injected) */
      .kvGrid { display: grid; gap: 10px; }
      .kvRow { display: grid; grid-template-columns: 140px 1fr; gap: 14px; padding: 8px 0; border-bottom: 1px dashed rgba(0,0,0,0.08); }
      .kvRow:last-child { border-bottom: none; }
      .kvK { color: #1E90FF; font-weight: 700; letter-spacing: .2px; text-transform: lowercase; }
      .kvV { color: #111; }
      .addrGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
      @media (max-width: 820px) { .addrGrid { grid-template-columns: 1fr; } }
      .miniCard { background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.06); padding: 14px 16px; }
      .miniCard h4 { margin: 0 0 10px 0; font-size: 15px; }
      .noteStack { display: flex; flex-direction: column; gap: 10px; }
      .noteCard { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 10px 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.05); }
      .noteMeta { color: #666; font-size: 12px; margin-bottom: 6px; }
      .noteText { color: #111; white-space: pre-wrap; }
    `;
    document.head.appendChild(style);
  }

  function setMsg(text) {
    if (!els.msg) return;
    els.msg.textContent = text || "";
    els.msg.style.display = text ? "block" : "none";
  }

  function safeText(v) {
    if (v == null) return "";
    return String(v);
  }

  function fmtDate(s) {
    if (!s) return "";
    const t = String(s).trim();
    if (!t) return "";
    // Keep exact text (Woo returns local string)
    return t.replace("T", " ").replace("Z", "");
  }

  function fmtPhone(v) {
    const raw = String(v ?? "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D+/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return raw;
  }

  function buildNLQuery(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";

    // If user types only digits, treat as order id intent.
    if (/^\d{3,}$/.test(raw)) return `order #${raw}`;

    // If user types "#12345", treat as order id.
    if (/^#\d{3,}$/.test(raw)) return `order ${raw}`;

    return raw;
  }

  async function apiGet(url) {
    const r = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { ok: r.ok, status: r.status, data };
  }

  async function apiPost(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload || {})
    });
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { ok: r.ok, status: r.status, data };
  }

  function setSessionPill(loggedIn) {
    if (!els.sessionPill) return;

    // index.html uses "Session: logged in/out" text
    els.sessionPill.textContent = loggedIn ? "Session: logged in" : "Session: logged out";
  }

  function clearOutputs() {
    if (els.outCustomer) els.outCustomer.innerHTML = "—";
    if (els.outSubs) els.outSubs.innerHTML = "—";
    if (els.outOrders) els.outOrders.innerHTML = "—";
    if (els.outJson) els.outJson.textContent = "";
    state.lastRaw = null;
  }

  function renderKVGrid(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return `
      <div class="kvGrid">
        ${safeRows.map(r => `
          <div class="kvRow">
            <div class="kvK">${safeText(r.k)}</div>
            <div class="kvV">${safeText(r.v) || "—"}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderAddressCard(title, a) {
    const rows = [
      { k: "name", v: [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—" },
      { k: "address", v: [a?.address_1, a?.address_2, a?.city, a?.state, a?.postcode, a?.country].filter(Boolean).join(" • ") || "—" },
      { k: "email", v: a?.email || "—" },
      { k: "phone", v: a?.phone || "—" }
    ];
    return `
      <div class="miniCard">
        <h4>${safeText(title)}</h4>
        ${renderKVGrid(rows)}
      </div>
    `;
  }

  function renderCustomer(c) {
    if (!c) return "—";

    const id = safeText(c?.id ?? "—");
    const username = safeText(c?.username ?? "—");

    const billing = c?.billing || {};
    const shipping = c?.shipping || {};

    return `
      <div class="metaRow">
        <div class="kv"><div class="k">customer id</div><div class="v">${id}</div></div>
        <div class="kv"><div class="k">username</div><div class="v">${username}</div></div>
      </div>

      <div class="grid2">
        <div class="cardInner">
          <h4 class="subhead">Billing</h4>
          ${renderAddressCompact(billing)}
        </div>
        <div class="cardInner">
          <h4 class="subhead">Shipping</h4>
          ${renderAddressCompact(shipping)}
        </div>
      </div>
    `;
  }

  function renderAddressCompact(a) {
    if (!a) return "<div class=\"muted\">—</div>";

    const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—";
    const address = [
      a?.address_1,
      a?.address_2,
      a?.city,
      a?.state,
      a?.postcode,
      a?.country
    ].filter(Boolean).join(" • ").trim() || "—";

    const email = a?.email ? safeText(a.email) : "—";
    const phone = a?.phone ? safeText(fmtPhone(a.phone)) : "—";

    return `
      <div class="kvGrid">
        <div class="kv"><div class="k">name</div><div class="v">${name}</div></div>
        <div class="kv"><div class="k">address</div><div class="v">${address}</div></div>
        <div class="kv"><div class="k">email</div><div class="v">${email}</div></div>
        <div class="kv"><div class="k">phone</div><div class="v">${phone}</div></div>
      </div>
    `;
  }

function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) return "—";

    // Ignore empty end_date (Worker already normalizes, but double-safety)
    const clean = arr.map(s => ({
      ...s,
      end_date: s?.end_date ? String(s.end_date).trim() : null
    }));

    return `
      <table class="table">
        <thead>
          <tr>
            <th>SUBSCRIPTION</th>
            <th>TOTAL</th>
            <th>START</th>
            <th>NEXT PAY</th>
            <th>END</th>
            <th>PAYMENT METHOD</th>
            <th>NOTES</th>
          </tr>
        </thead>
        <tbody>
          ${clean.map(s => {
            const endRaw = s?.end_date ?? s?.schedule_end ?? s?.schedule?.end ?? s?.end ?? null;
            const end = endRaw ? fmtDate(endRaw) : "—";

            const nextRaw = s?.next_payment_date ?? s?.next_payment_date_gmt ?? s?.schedule_next_payment ?? s?.schedule?.next_payment ?? s?.next_payment ?? null;
            const next = nextRaw ? fmtDate(nextRaw) : "—";
            return `
              <tr>
                <td class="nowrap">
                  <div class="oneLine"><strong>#${safeText(s?.id)}</strong> <span class="tag">${safeText(s?.status || "—")}</span></div>
                </td>
                <td>${safeText((s?.total ?? "—"))}</td>
                <td>${fmtDate(s?.start_date ?? s?.date_created ?? "") || "—"}</td>
                <td>${next}</td>
                <td>${end}</td>
                <td>${safeText(s?.payment_method_title || s?.payment_method || "—")}</td>
                <td class="notesCell">${renderNotes(s?.notes)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) return "—";

    return `
      <table class="table">
        <thead>
          <tr>
            <th>ORDER</th>
            <th>TOTAL</th>
            <th>PAYMENT</th>
            <th>ITEMS</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map(o => {
            const items = Array.isArray(o?.line_items) ? o.line_items : [];
            const firstItem = items[0]?.name || "—";
            return `
              <tr>
                <td class="nowrap">
                  <div class="oneLine"><strong>#${safeText(o?.id)}</strong> <span class="tag">${safeText(o?.status || "—")}</span> <span class="muted">${fmtDate(o?.date_created) || ""}</span></div>
                </td>
                <td>${safeText(o?.total || "—")}</td>
                <td>${safeText(o?.payment_method_title || o?.payment_method || "—")}</td>
                <td>${safeText(firstItem)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderAll(payload) {
    const ctx = payload?.context || payload?.results?.context || payload?.data?.context || null;

    // The Worker returns consistent "context" for both email searches and order-id searches.
    const customer = ctx?.customer || null;
    const subs = ctx?.subscriptions || [];
    const orders = ctx?.orders || [];

    if (els.outCustomer) els.outCustomer.innerHTML = renderCustomer(customer);
    if (els.outSubs) els.outSubs.innerHTML = renderSubscriptions(subs);
    if (els.outOrders) els.outOrders.innerHTML = renderOrders(orders);

    if (els.outJson) {
      state.lastRaw = payload;
      els.outJson.textContent = JSON.stringify(payload, null, 2);
    }
  }

  async function refreshStatus() {
    const r = await apiGet(ENDPOINTS.status);
    if (!r.ok) {
      state.loggedIn = false;
      setSessionPill(false);
      return;
    }
    state.loggedIn = !!r.data?.loggedIn;
    setSessionPill(state.loggedIn);
  }

  async function doLogin() {
    setMsg("");
    const username = (els.user?.value || "").trim();
    const password = (els.pass?.value || "").trim();

    if (!username || !password) {
      setMsg("Username and password required.");
      return;
    }

    const r = await apiPost(ENDPOINTS.login, { username, password });
    if (!r.ok) {
      setMsg(`Login failed (${r.status}).`);
      await refreshStatus();
      return;
    }

    setMsg("");
    await refreshStatus();
  }

  async function doLogout() {
    setMsg("");
    await apiPost(ENDPOINTS.logout, {});
    await refreshStatus();
    clearOutputs();
  }

  async function doSearch() {
    setMsg("");
    clearOutputs();

    const raw = (els.query?.value || "").trim();
    const q = buildNLQuery(raw);
    if (!q) {
      setMsg("Enter a search like: customer bob@abc.com • subscription for bob@abc.com • orders for bob@abc.com • order #12997");
      return;
    }

    const r = await apiPost(ENDPOINTS.search, { query: q });
    if (!r.ok) {
      // Show worker error details if present
      const msg = r.data?.error || r.data?.message || "Search failed";
      setMsg(`${msg} (${r.status}).`);
      if (els.outJson) els.outJson.textContent = JSON.stringify(r.data, null, 2);
      return;
    }

    renderAll(r.data);
  }

  function setupRawToggle() {
    // index.html uses a native <details> element for Raw JSON toggling.
    // No custom chevron/button wiring needed; we keep this as a safe no-op.
    return;
  }

  function wireEvents() {
    if (els.btnLogin) els.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
    if (els.btnLogout) els.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
    if (els.btnSearch) els.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

    // Enter-to-submit
    if (els.user) els.user.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    if (els.pass) els.pass.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    if (els.query) els.query.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

    setupRawToggle();
  }

  async function init() {
    injectStyles();
    wireEvents();
    await refreshStatus();
  }

  init();
})();

// 🔴 main.js