// 🟢 main.js
// Arnold Admin SPA — FULL REPLACEMENT (v2026-02-21d)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

/*
  Arnold Admin — v2026-02-21d

  Regression guardrails:
  - This file is LOCKED to index.html element IDs:
      sessionBadge, sessionText,
      loginEmail, loginPass, btnLogin, btnLogout,
      query, btnSearch,
      msg, outCustomer, outSubs, outOrders, outJson
  - Worker base URL MUST be:
      https://arnold-admin-worker.bob-b5c.workers.dev

  UI rules implemented:
  - Phone numbers render “pretty” for US formats when possible.
  - Orders render as ONE-LINER rows (no redundant address blocks).
  - Subscriptions render as ONE-LINER rows; Notes render as right-justified cards.
  - Raw JSON is clickable toggle (default CLOSED), and any fields with value "[redacted]" are omitted entirely.
  - If the search term is numeric => order lookup.
*/

(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const EP = {
    status: "/admin/status",
    login: "/admin/login",
    logout: "/admin/logout",
    search: "/admin/nl-search"
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    sessionBadge: $("sessionBadge"),
    sessionText: $("sessionText"),

    user: $("loginEmail"),
    pass: $("loginPass"),
    btnLogin: $("btnLogin"),
    btnLogout: $("btnLogout"),

    query: $("query"),
    btnSearch: $("btnSearch"),

    msg: $("msg"),
    outCustomer: $("outCustomer"),
    outSubs: $("outSubs"),
    outOrders: $("outOrders"),
    outJson: $("outJson")
  };

  // Hard fail loudly if index.html + main.js drift again.
  const missing = Object.entries(els).filter(([_, el]) => !el).map(([k]) => k);
  if (missing.length) {
    const msg = `DOM mismatch: missing element(s): ${missing.join(", ")}. index.html and main.js must be updated together.`;
    // Disable actions so it can’t “look clickable but do nothing”.
    if (els.btnLogin) els.btnLogin.disabled = true;
    if (els.btnLogout) els.btnLogout.disabled = true;
    if (els.btnSearch) els.btnSearch.disabled = true;
    if (els.msg) {
      els.msg.className = "msg bad";
      els.msg.textContent = msg;
    } else {
      alert(msg);
    }
    return;
  }

  /* ---------------- minimal style injection (OkObserver look) ---------------- */

  (function injectStyles() {
    const css = `
      .aa-kvGrid{display:grid;gap:10px}
      .aa-kvRow{display:grid;grid-template-columns:160px 1fr;gap:12px;padding:7px 0;border-bottom:1px dashed rgba(0,0,0,.08)}
      .aa-kvRow:last-child{border-bottom:none}
      .aa-k{color:var(--blue);font-weight:900;font-size:12.5px;letter-spacing:.15px;text-transform:lowercase}
      .aa-v{font-weight:700;font-size:14px;word-break:break-word}

      .aa-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}
      @media (max-width:860px){ .aa-grid2{grid-template-columns:1fr} }

      .aa-card{background:#fbfdff;border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:12px;box-shadow:0 10px 22px rgba(0,0,0,.06)}
      .aa-title{font-weight:950;margin-bottom:8px}
      .aa-muted{color:var(--muted);font-weight:750;font-size:12.5px}

      .aa-tag{display:inline-flex;align-items:center;gap:8px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:950;
              background:rgba(59,130,246,.12); color:var(--blue2); border:1px solid rgba(59,130,246,.16)}
      .aa-lineRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .aa-lineRow .aa-sp{opacity:.45}

      .aa-noteWrap{margin-left:auto;min-width:280px;max-width:520px;text-align:right}
      @media (max-width:860px){ .aa-noteWrap{margin-left:0;max-width:none;text-align:left} }

      .aa-noteCard{background:#ffffff;border:1px solid rgba(0,0,0,.06);border-radius:12px;padding:10px 12px;box-shadow:0 10px 22px rgba(0,0,0,.06);margin:8px 0}
      .aa-noteMeta{font-size:12px;color:var(--muted);font-weight:850;margin-bottom:6px}
      .aa-noteText{font-size:13px;font-weight:750;line-height:1.35;white-space:pre-wrap}
      .aa-empty{color:var(--muted);font-weight:800}
    `;
    const tag = document.createElement("style");
    tag.setAttribute("data-aa", "1");
    tag.appendChild(document.createTextNode(css));
    document.head.appendChild(tag);
  })();

  /* ---------------- utilities ---------------- */

  function setMsg(type, text) {
    els.msg.className = "msg " + (type || "");
    els.msg.textContent = text || "";
  }

  function setSession(loggedIn) {
    els.sessionBadge.textContent = loggedIn ? "●" : "○";
    els.sessionBadge.style.color = loggedIn ? "#37d67a" : "rgba(255,255,255,.75)";
    els.sessionText.textContent = loggedIn ? "Session: logged in" : "Session: logged out";
  }

  function safeText(x) {
    const s = String(x ?? "");
    return s
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
      return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
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

  function fmtPhone(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "—";

    const digits = s.replace(/[^\d]/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    // Keep as-is for international/odd formats.
    return s;
  }

  function joinName(a) {
    return [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim();
  }

  function formatAddress(a) {
    if (!a) return "—";
    const parts = [a.address_1, a.address_2, a.city, a.state, a.postcode, a.country].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }

  function productSummary(items) {
    const arr = Array.isArray(items) ? items : [];
    const names = arr.map(li => li?.name).filter(Boolean);
    if (!names.length) return "—";
    return names.slice(0, 6).join(" • ");
  }

  async function apiFetch(path, options = {}) {
    const url = WORKER_BASE + path;

    const init = {
      method: options.method || "GET",
      headers: { "Accept": "application/json", ...(options.headers || {}) },
      credentials: "include"
    };

    if (options.json != null) {
      init.method = options.method || "POST";
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.json);
    }

    const resp = await fetch(url, init);
    const txt = await resp.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { resp, data };
  }

  /* ---------------- Raw JSON toggle (default CLOSED) ---------------- */

  let rawOpen = false;
  function setRawOpen(open) {
    rawOpen = !!open;
    els.outJson.style.display = rawOpen ? "block" : "none";
  }
  setRawOpen(false);

  // Make the "Raw JSON" card header clickable without changing index.html.
  (function wireRawToggle() {
    const h3s = Array.from(document.querySelectorAll("h3"));
    const rawH3 = h3s.find(h => (h.textContent || "").trim().toLowerCase() === "raw json");
    if (!rawH3) return;

    rawH3.style.cursor = "pointer";
    rawH3.title = "Click to toggle";
    rawH3.addEventListener("click", () => setRawOpen(!rawOpen));
  })();

  /* ---------------- render helpers ---------------- */

  function kvGrid(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return `
      <div class="aa-kvGrid">
        ${safeRows.map(r => `
          <div class="aa-kvRow">
            <div class="aa-k">${safeText(r.k)}</div>
            <div class="aa-v">${safeText(r.v ?? "—") || "—"}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderAddressCard(title, a) {
    const name = joinName(a) || "—";
    const addr = formatAddress(a);
    const email = a?.email ?? "—";
    const phone = fmtPhone(a?.phone);

    return `
      <div class="aa-card">
        <div class="aa-title">${safeText(title)}</div>
        ${kvGrid([
          { k: "name", v: name },
          { k: "address", v: addr },
          { k: "email", v: email },
          { k: "phone", v: phone }
        ])}
      </div>
    `;
  }

  function renderCustomer(cust) {
    if (!cust) return `<div class="aa-empty">—</div>`;

    const phone = fmtPhone(cust?.billing?.phone ?? cust?.shipping?.phone ?? "");
    const name = [cust?.first_name, cust?.last_name].filter(Boolean).join(" ").trim() || "—";

    const billing = cust?.billing || null;
    const shipping = cust?.shipping || null;

    return `
      ${kvGrid([
        { k: "customer id", v: cust?.id ?? "—" },
        { k: "username", v: cust?.username ?? "—" },
        { k: "name", v: name },
        { k: "email", v: cust?.email ?? "—" },
        { k: "phone", v: phone }
      ])}

      <div class="aa-grid2">
        ${renderAddressCard("Billing", billing)}
        ${renderAddressCard("Shipping", shipping)}
      </div>
    `;
  }

  function renderNotes(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    const out = [];

    for (const n of arr) {
      const body = String(n?.note ?? "").trim();
      if (!body) continue;
      const when = fmtDateTime(n?.date_created ?? n?.date_created_gmt ?? null);
      out.push(`
        <div class="aa-noteCard">
          <div class="aa-noteMeta">${safeText(when)}</div>
          <div class="aa-noteText">${safeText(body)}</div>
        </div>
      `);
    }

    return out.length ? out.join("") : `<div class="aa-empty">—</div>`;
  }

  // Subscriptions: ONE-LINER row, notes right-justified
  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) return `<div class="aa-empty">—</div>`;

    return arr.map(s => {
      const id = s?.id ?? "—";
      const status = s?.status ?? "";
      const total = fmtMoney(s?.total, s?.currency);
      const start = fmtDateTime(s?.start_date);
      const nextPay = fmtDateTime(s?.next_payment_date); // end_date intentionally ignored when empty/unset (worker normalizes)
      const pm = s?.payment_method_title || s?.payment_method || "—";
      const items = productSummary(s?.line_items);

      return `
        <div class="aa-card" style="margin-top:10px;">
          <div style="display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;">
            <div class="aa-lineRow" style="flex:1 1 520px;min-width:320px;">
              <span style="font-weight:950">Subscription #${safeText(id)}</span>
              ${status ? `<span class="aa-tag">${safeText(status)}</span>` : ""}
              <span class="aa-sp">•</span>
              <span><span class="aa-k" style="display:inline;color:var(--blue)">total</span> <span class="aa-v" style="display:inline">${safeText(total)}</span></span>
              <span class="aa-sp">•</span>
              <span><span class="aa-k" style="display:inline;color:var(--blue)">start</span> <span class="aa-v" style="display:inline">${safeText(start)}</span></span>
              <span class="aa-sp">•</span>
              <span><span class="aa-k" style="display:inline;color:var(--blue)">next</span> <span class="aa-v" style="display:inline">${safeText(nextPay)}</span></span>
              <span class="aa-sp">•</span>
              <span><span class="aa-k" style="display:inline;color:var(--blue)">pay</span> <span class="aa-v" style="display:inline">${safeText(pm)}</span></span>
              <span class="aa-sp">•</span>
              <span><span class="aa-k" style="display:inline;color:var(--blue)">items</span> <span class="aa-v" style="display:inline">${safeText(items)}</span></span>
            </div>

            <div class="aa-noteWrap">
              <div class="aa-noteMeta" style="margin-top:2px;">Notes</div>
              ${renderNotes(s?.notes)}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Orders: ONE-LINER row (no redundant address blocks)
  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) return `<div class="aa-empty">—</div>`;

    return arr.map(o => {
      const id = o?.id ?? "—";
      const status = o?.status ?? "";
      const total = fmtMoney(o?.total, o?.currency);
      const when = fmtDateTime(o?.date_created);
      const pm = o?.payment_method_title || o?.payment_method || "—";
      const items = productSummary(o?.line_items);

      return `
        <div class="aa-card" style="margin-top:10px;">
          <div class="aa-lineRow">
            <span style="font-weight:950">Order #${safeText(id)}</span>
            ${status ? `<span class="aa-tag">${safeText(status)}</span>` : ""}
            <span class="aa-sp">•</span>
            <span><span class="aa-k" style="display:inline;color:var(--blue)">date</span> <span class="aa-v" style="display:inline">${safeText(when)}</span></span>
            <span class="aa-sp">•</span>
            <span><span class="aa-k" style="display:inline;color:var(--blue)">total</span> <span class="aa-v" style="display:inline">${safeText(total)}</span></span>
            <span class="aa-sp">•</span>
            <span><span class="aa-k" style="display:inline;color:var(--blue)">pay</span> <span class="aa-v" style="display:inline">${safeText(pm)}</span></span>
            <span class="aa-sp">•</span>
            <span><span class="aa-k" style="display:inline;color:var(--blue)">items</span> <span class="aa-v" style="display:inline">${safeText(items)}</span></span>
          </div>
        </div>
      `;
    }).join("");
  }

  function clearOutputs() {
    els.outCustomer.innerHTML = "—";
    els.outSubs.innerHTML = "—";
    els.outOrders.innerHTML = "—";
    els.outJson.textContent = "{}";
    setRawOpen(false);
  }

  function normalizeContext(payload) {
    const ctx = payload?.context || payload?.results?.context || payload?.data?.context || payload?.context_data || null;
    const customer = ctx?.customer ?? null;
    const subscriptions = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    // Some order-only intents might put orders in `results`
    const intent = String(payload?.intent || "");
    if (Array.isArray(payload?.results) && intent.toLowerCase().includes("orders")) {
      return { customer, subscriptions, orders: payload.results };
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
    const username = String(els.user.value || "").trim();
    const password = String(els.pass.value || "");

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
      els.pass.value = "";
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
    if (/^\d+$/.test(s)) return `order #${s}`; // numeric => order lookup
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

      // Raw JSON: default closed; strip redacted fields entirely.
      const cleaned = stripRedacted(r.data);
      els.outJson.textContent = JSON.stringify(cleaned, null, 2);

      if (!r.resp.ok || r.data?.ok === false) {
        setMsg("bad", r.data?.error || r.data?.message || `Search failed (${r.resp.status}).`);
        return;
      }

      const ctx = normalizeContext(r.data);
      els.outCustomer.innerHTML = renderCustomer(ctx.customer);
      els.outSubs.innerHTML = renderSubscriptions(ctx.subscriptions);
      els.outOrders.innerHTML = renderOrders(ctx.orders);

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