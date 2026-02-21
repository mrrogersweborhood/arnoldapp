// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-21b)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  "use strict";

  /*
    Arnold Admin main.js — v2026-02-21b

    Anti-regression contract:
    - DOM IDs MUST match index.html exactly:
      loginUser, loginPass, btnLogin, btnLogout, query, btnSearch,
      msg, sessionPill, sessionDot, sessionText,
      customerOut, subsOut, ordersOut, rawToggle, rawChevron, rawOut
    - Worker base MUST be: https://arnold-admin-worker.bob-b5c.workers.dev
    - Raw JSON: default closed; clickable toggle; hide any fields whose value is "[redacted]".
    - Numeric search term => order lookup.
  */

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const EP = {
    status: "/admin/status",
    login: "/admin/login",
    logout: "/admin/logout",
    search: "/admin/nl-search"
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    loginUser: $("loginUser"),
    loginPass: $("loginPass"),
    btnLogin: $("btnLogin"),
    btnLogout: $("btnLogout"),
    query: $("query"),
    btnSearch: $("btnSearch"),

    msg: $("msg"),

    sessionPill: $("sessionPill"),
    sessionDot: $("sessionDot"),
    sessionText: $("sessionText"),

    customerOut: $("customerOut"),
    subsOut: $("subsOut"),
    ordersOut: $("ordersOut"),

    rawToggle: $("rawToggle"),
    rawChevron: $("rawChevron"),
    rawOut: $("rawOut")
  };

  const missing = Object.entries(els).filter(([_, el]) => !el).map(([k]) => k);

  function hardFailDomMismatch() {
    const list = missing.join(", ");
    // Disable critical actions so it can't silently "do nothing"
    [els.btnLogin, els.btnLogout, els.btnSearch].filter(Boolean).forEach(b => b.disabled = true);

    const msg = `DOM mismatch: missing element(s): ${list}. index.html and main.js must be updated together.`;
    if (els.msg) {
      els.msg.className = "msg bad";
      els.msg.textContent = msg;
    } else {
      alert(msg);
    }
  }

  if (missing.length) {
    hardFailDomMismatch();
    return;
  }

  /* ---------------- utilities ---------------- */

  function setMsg(type, text) {
    els.msg.className = "msg " + (type || "");
    els.msg.textContent = text || "";
  }

  function setSession(loggedIn) {
    els.sessionPill.classList.toggle("on", !!loggedIn);
    els.sessionText.textContent = loggedIn ? "Session: logged in" : "Session: logged out";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isRedactedValue(v) {
    return typeof v === "string" && v.trim().toLowerCase() === "[redacted]";
  }

  // Remove any keys whose value is "[redacted]" recursively.
  function stripRedacted(x) {
    if (x == null) return x;
    if (Array.isArray(x)) {
      return x.map(stripRedacted).filter((v) => v !== undefined);
    }
    if (typeof x === "object") {
      const out = {};
      for (const [k, v] of Object.entries(x)) {
        if (isRedactedValue(v)) continue;
        const vv = stripRedacted(v);
        if (vv === undefined) continue;
        out[k] = vv;
      }
      return out;
    }
    if (isRedactedValue(x)) return undefined;
    return x;
  }

  function fmtMoney(total, currency) {
    if (total == null || total === "") return "—";
    const n = Number(String(total).replace(/[^0-9.+-]/g, ""));
    if (!Number.isFinite(n)) return String(total);

    const cur = (currency || "USD").toString().toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur,
        currencyDisplay: "symbol"
      }).format(n);
    } catch (_) {
      return n.toFixed(2) + (currency ? (" " + currency) : "");
    }
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return String(iso);

    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "medium",
        timeStyle: "short"
      }).format(d);
    } catch (_) {
      return d.toLocaleString();
    }
  }

  function kv(label, value) {
    const v = (value == null || value === "") ? "—" : String(value);
    return `
      <div class="kv">
        <div class="k">${escapeHtml(label)}</div>
        <div class="v">${escapeHtml(v)}</div>
      </div>
    `;
  }

  function joinName(a) {
    return [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim();
  }

  function formatAddress(a) {
    if (!a) return "—";
    const parts = [a.address_1, a.address_2, a.city, a.state, a.postcode, a.country].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }

  function productSummaryFromLineItems(lineItems) {
    const items = Array.isArray(lineItems) ? lineItems : [];
    const names = items.map(li => li?.name).filter(Boolean);
    if (!names.length) return "—";
    return names.slice(0, 6).join(" • ");
  }

  async function apiFetch(path, options = {}) {
    const url = WORKER_BASE + path;

    const init = {
      method: options.method || "GET",
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      },
      credentials: "include"
    };

    if (options.json != null) {
      init.method = options.method || "POST";
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.json);
    } else if (options.body != null) {
      init.body = options.body;
    }

    const resp = await fetch(url, init);
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { resp, data };
  }

  /* ---------------- Raw JSON toggle ---------------- */

  function setRawOpen(open) {
    els.rawOut.style.display = open ? "block" : "none";
    els.rawChevron.textContent = open ? "⌄" : "›";
    els.rawToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  let rawOpen = false;
  setRawOpen(false);

  els.rawToggle.addEventListener("click", () => {
    rawOpen = !rawOpen;
    setRawOpen(rawOpen);
  });

  /* ---------------- renderers ---------------- */

  function clearOutputs() {
    els.customerOut.innerHTML = "—";
    els.subsOut.innerHTML = "—";
    els.ordersOut.innerHTML = "—";
    els.rawOut.textContent = "";
    rawOpen = false;
    setRawOpen(false);
  }

  function renderCustomer(customer) {
    if (!customer) {
      els.customerOut.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    const billing = customer.billing || null;
    const shipping = customer.shipping || null;

    els.customerOut.innerHTML = `
      <div class="kvGrid">
        ${kv("customer id", customer.id)}
        ${kv("username", customer.username)}
        ${kv("name", (customer.first_name || customer.last_name) ? (customer.first_name + " " + customer.last_name).trim() : (customer.name || "—"))}
        ${kv("email", customer.email)}
      </div>

      <div class="grid2" style="margin-top:12px">
        <div class="noteCard">
          <div class="noteMeta">Billing</div>
          <div class="kvGrid">
            ${kv("name", joinName(billing) || "—")}
            ${kv("address", formatAddress(billing))}
            ${kv("email", billing?.email)}
            ${kv("phone", billing?.phone)}
          </div>
        </div>

        <div class="noteCard">
          <div class="noteMeta">Shipping</div>
          <div class="kvGrid">
            ${kv("name", joinName(shipping) || "—")}
            ${kv("address", formatAddress(shipping))}
            ${kv("email", shipping?.email)}
            ${kv("phone", shipping?.phone)}
          </div>
        </div>
      </div>
    `;
  }

  function renderNotes(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    const clean = arr
      .map(n => {
        const when = n?.date_created ? fmtDateTime(n.date_created) : "—";
        const body = (n?.note ?? "").toString().trim();
        if (!body) return "";
        return `
          <div class="noteCard">
            <div class="noteMeta">${escapeHtml(when)}</div>
            <div class="noteText">${escapeHtml(body)}</div>
          </div>
        `;
      })
      .filter(Boolean);

    return clean.length ? clean.join("") : `<div class="muted">—</div>`;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      els.subsOut.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    els.subsOut.innerHTML = `
      ${arr.map(s => {
        const id = s?.id ?? "";
        const status = s?.status ?? "";
        const total = fmtMoney(s?.total, s?.currency);
        const start = fmtDateTime(s?.start_date);
        const nextPay = fmtDateTime(s?.next_payment_date);
        const pm = s?.payment_method_title || s?.payment_method || "—";
        const items = productSummaryFromLineItems(s?.line_items);

        return `
          <div class="noteCard" style="margin-top:10px">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="font-weight:900">Subscription #${escapeHtml(id)}</div>
              ${status ? `<span class="tag">${escapeHtml(status)}</span>` : ""}
            </div>

            <div class="kvGrid" style="margin-top:8px">
              ${kv("total", total)}
              ${kv("start", start)}
              ${kv("next payment", nextPay)}
              ${kv("payment method", pm)}
              ${kv("items", items)}
            </div>

            <div style="margin-top:10px">
              <div class="noteMeta">Notes</div>
              ${renderNotes(s?.notes)}
            </div>
          </div>
        `;
      }).join("")}
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      els.ordersOut.innerHTML = `<div class="muted">—</div>`;
      return;
    }

    els.ordersOut.innerHTML = `
      ${arr.map(o => {
        const id = o?.id ?? "";
        const status = o?.status ?? "";
        const total = fmtMoney(o?.total, o?.currency);
        const created = fmtDateTime(o?.date_created);
        const pm = o?.payment_method_title || o?.payment_method || "—";
        const items = productSummaryFromLineItems(o?.line_items);

        const billing = o?.billing || null;
        const shipping = o?.shipping || null;

        return `
          <div class="noteCard" style="margin-top:10px">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="font-weight:900">Order #${escapeHtml(id)}</div>
              ${status ? `<span class="tag">${escapeHtml(status)}</span>` : ""}
            </div>

            <div class="kvGrid" style="margin-top:8px">
              ${kv("total", total)}
              ${kv("date", created)}
              ${kv("payment", pm)}
              ${kv("items", items)}
            </div>

            <div class="grid2">
              <div class="noteCard" style="margin:0">
                <div class="noteMeta">Billing</div>
                <div class="kvGrid">
                  ${kv("name", joinName(billing) || "—")}
                  ${kv("address", formatAddress(billing))}
                </div>
              </div>
              <div class="noteCard" style="margin:0">
                <div class="noteMeta">Shipping</div>
                <div class="kvGrid">
                  ${kv("name", joinName(shipping) || "—")}
                  ${kv("address", formatAddress(shipping))}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    `;
  }

  function normalizeContext(payload) {
    const ctx = payload?.context || {};
    let customer = ctx.customer || null;
    let subscriptions = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    let orders = Array.isArray(ctx.orders) ? ctx.orders : [];

    // Some intents return orders in results; keep both paths safe.
    if (Array.isArray(payload?.results) && String(payload?.intent || "").includes("orders")) {
      orders = payload.results;
    }

    return { customer, subscriptions, orders };
  }

  /* ---------------- actions ---------------- */

  async function refreshStatus() {
    try {
      const r = await apiFetch(EP.status);
      const loggedIn = !!r.data?.loggedIn;
      setSession(loggedIn);
      return loggedIn;
    } catch (_) {
      setSession(false);
      return false;
    }
  }

  async function doLogin() {
    setMsg("", "");
    const username = String(els.loginUser.value || "").trim();
    const password = String(els.loginPass.value || "");

    if (!username || !password) {
      setMsg("bad", "Username and password required.");
      return;
    }

    els.btnLogin.disabled = true;
    try {
      const r = await apiFetch(EP.login, { json: { username, password } });
      if (!r.resp.ok || !r.data?.success) {
        setMsg("bad", r.data?.message || `Login failed (${r.resp.status}).`);
        setSession(false);
        return;
      }
      setSession(true);
      setMsg("good", "Logged in.");
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
    try {
      await apiFetch(EP.logout, { method: "POST" });
    } catch (_) {}
    setSession(false);
    setMsg("good", "Logged out.");
    els.btnLogout.disabled = false;
    clearOutputs();
  }

  function coerceQuery(q) {
    const s = String(q || "").trim();
    if (!s) return "";
    // User rule: numeric => order lookup
    if (/^\d+$/.test(s)) return `order #${s}`;
    return s;
  }

  async function doSearch() {
    setMsg("", "");
    clearOutputs();

    const q = coerceQuery(els.query.value);
    if (!q) {
      setMsg("bad", "Enter a query.");
      return;
    }

    const loggedIn = await refreshStatus();
    if (!loggedIn) {
      setMsg("bad", "Not logged in.");
      return;
    }

    els.btnSearch.disabled = true;
    try {
      const r = await apiFetch(EP.search, { json: { query: q } });

      // Raw JSON: strip redacted fields
      const cleaned = stripRedacted(r.data);
      els.rawOut.textContent = JSON.stringify(cleaned, null, 2);

      if (!r.resp.ok || r.data?.ok === false) {
        setMsg("bad", r.data?.error || r.data?.message || `Search failed (${r.resp.status}).`);
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

  /* ---------------- bindings ---------------- */

  els.btnLogin.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
  els.btnLogout.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
  els.btnSearch.addEventListener("click", (e) => { e.preventDefault(); doSearch(); });

  els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    }
  });

  clearOutputs();
  refreshStatus();

})();

// 🔴 main.js