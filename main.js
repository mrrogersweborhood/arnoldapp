// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-23b)
// Markers are comments only: 🟢 main.js ... 🔴 main.js

(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const API = {
    status: `${WORKER_BASE}/admin/status`,
    login: `${WORKER_BASE}/admin/login`,
    logout: `${WORKER_BASE}/admin/logout`,
    search: `${WORKER_BASE}/admin/nl-search`
  };

  const els = {
    loginUser: null,
    loginPass: null,
    btnLogin: null,
    btnLogout: null,
    sessionPill: null,
    sessionText: null,

    query: null,
    btnSearch: null,
    btnRaw: null,
    rawWrap: null,

    msg: null,

    outCustomer: null,
    outSubs: null,
    outOrders: null,
    outJson: null
  };

  function $(id) { return document.getElementById(id); }

  function bindEls() {
    // Required IDs (ground truth)
    els.loginUser = $("loginUser");
    els.loginPass = $("loginPass");
    els.btnLogin = $("btnLogin");
    els.btnLogout = $("btnLogout");
    els.sessionPill = $("sessionPill");
    els.sessionText = $("sessionText");

    els.query = $("query");
    els.btnSearch = $("btnSearch");
    els.btnRaw = $("btnRaw");
    els.rawWrap = $("rawWrap");

    els.msg = $("msg");

    els.outCustomer = $("customerOut");
    els.outSubs = $("subsOut");
    els.outOrders = $("ordersOut");
    els.outJson = $("rawOut");

    // Legacy fallback IDs (do not rely on these)
    if (!els.btnRaw) els.btnRaw = $("btnShowRaw");
    if (!els.rawWrap) els.rawWrap = $("rawJsonWrap");
    if (!els.outJson) els.outJson = $("rawOut");
  }

  function setMsg(text, cls) {
    if (!els.msg) return;
    els.msg.className = "";
    if (cls) els.msg.classList.add(cls);
    els.msg.textContent = text || "";
  }

  function setBadge(text, ok) {
    if (els.sessionText) els.sessionText.textContent = text;
    if (els.sessionPill) {
      els.sessionPill.classList.remove("ok", "bad");
      els.sessionPill.classList.add(ok ? "ok" : "bad");
    }
  }

  function showLogout(show) {
    if (els.btnLogout) els.btnLogout.style.display = show ? "" : "none";
  }

  async function apiFetch(url, init) {
    const resp = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init && init.headers ? init.headers : {})
      }
    });
    return resp;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtMoney(total, currency) {
    const t = String(total ?? "").trim();
    if (!t) return "—";
    const c = String(currency ?? "").trim();
    return c ? `${t} ${esc(c)}` : t;
  }

  function parseLooseDate(input) {
    if (!input) return null;
    const s = String(input).trim();
    if (!s) return null;

    // Accept "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", ISO
    // Convert "YYYY-MM-DD HH:MM:SS" → ISO-ish by replacing space with "T"
    const isoish = s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s;

    const d = new Date(isoish);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function fmtDate(input) {
    const d = parseLooseDate(input);
    if (!d) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function fmtPhone(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "—";

    const digits = s.replace(/\D/g, "");
    if (digits.length === 10) {
      const a = digits.slice(0, 3);
      const b = digits.slice(3, 6);
      const c = digits.slice(6);
      return `(${a}) ${b}-${c}`;
    }
    return s;
  }

  function renderCustomer(c) {
    if (!c) {
      return `<div class="oo-card"><div class="oo-card-bd">No customer found.</div></div>`;
    }

    const id = esc(c?.id ?? "—");
    const username = esc(c?.username ?? "—");

    const billing = c?.billing || {};
    const shipping = c?.shipping || {};

    // Requirement: don't duplicate name/email/phone if already present in Billing
    const bName = [billing?.first_name, billing?.last_name].filter(Boolean).join(" ").trim();
    const bEmail = billing?.email || c?.email || null;
    const bPhone = billing?.phone || null;

    const left = `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Identity</b><small>Customer</small></div>
        <div class="oo-card-bd">
          <div class="oo-kv">
            <div class="k">Customer ID</div><div class="v">${id}</div>
            <div class="k">Username</div><div class="v">${username}</div>
          </div>
        </div>
      </div>
    `;

    const addr = (a) => {
      const lines = [
        [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim(),
        a?.company,
        a?.address_1,
        a?.address_2,
        [a?.city, a?.state, a?.postcode].filter(Boolean).join(" ").trim(),
        a?.country
      ].filter(Boolean);

      const email = a?.email ? `Email: ${esc(a.email)}` : (bEmail ? `Email: ${esc(bEmail)}` : null);
      const phone = a?.phone ? `Phone: ${esc(fmtPhone(a.phone))}` : (bPhone ? `Phone: ${esc(fmtPhone(bPhone))}` : null);

      const footer = [email, phone].filter(Boolean);

      return `
        <div class="oo-card">
          <div class="oo-card-hd"><b>${esc(a?.__label || "Address")}</b><small>${bName ? esc(bName) : ""}</small></div>
          <div class="oo-card-bd">
            <div style="display:grid;gap:6px;">
              ${lines.length ? `<div>${lines.map(esc).join("<br>")}</div>` : `<div>—</div>`}
              ${footer.length ? `<div style="color:#475569;font-size:13px;">${footer.join("<br>")}</div>` : ``}
            </div>
          </div>
        </div>
      `;
    };

    billing.__label = "Billing";
    shipping.__label = "Shipping";

    // Side-by-side billing/shipping
    return `
      <div class="oo-out" style="display:grid;gap:12px;">
        ${left}

        <div style="display:grid;gap:12px;">
          <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr;">
            ${addr(billing)}
            ${addr(shipping)}
          </div>
        </div>
      </div>
    `;
  }

  function renderSubscriptions(subs) {
    if (!subs || !subs.length) {
      return `<div class="oo-card"><div class="oo-card-bd">No subscriptions found.</div></div>`;
    }

    const rows = subs.map((s) => {
      const id = esc(s?.id ?? "—");
      const status = esc(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);

      // IMPORTANT: these can be "YYYY-MM-DD HH:MM:SS" → handled by parseLooseDate()
      const nextPay = fmtDate(s?.next_payment_date);
      const end =
        (!s?.end_date && String(s?.status || "").toLowerCase() === "active")
          ? "Auto-renews"
          : fmtDate(s?.end_date);

      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const notesHtml = notes.length
        ? `<div style="display:grid;gap:10px;margin-top:12px;">
            ${notes.map(n => `
              <div class="oo-note">
                <small>${esc(fmtDate(n?.date_created))} • ${esc(n?.author || n?.added_by || "")}</small>
                <div class="txt">${esc(n?.note || "")}</div>
              </div>
            `).join("")}
          </div>`
        : "";

      return `
        <div class="oo-card">
          <div class="oo-card-hd">
            <b>Subscription #${id}</b>
            <small>${status} • ${esc(total)}</small>
          </div>
          <div class="oo-card-bd">
            <table class="oo-table">
              <thead>
                <tr>
                  <th style="width:140px;">Status</th>
                  <th style="width:160px;">Next Payment</th>
                  <th style="width:140px;">End</th>
                  <th style="width:160px;">Total</th>
                  <th>Parent Order</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${status}</td>
                  <td>${esc(nextPay)}</td>
                  <td>${esc(end)}</td>
                  <td>${esc(total)}</td>
                  <td>${esc(s?.parent_id ?? "—")}</td>
                </tr>
              </tbody>
            </table>

            ${notesHtml}
          </div>
        </div>
      `;
    });

    return `<div class="oo-out">${rows.join("")}</div>`;
  }

  function orderProductSummary(o) {
    const items = Array.isArray(o?.line_items) ? o.line_items : [];
    if (!items.length) return "—";

    const first = items[0] || {};
    const name = String(first?.name || "").trim();
    const qty = (first?.quantity == null) ? null : Number(first.quantity);

    const primary = name ? esc(name) : "—";
    const qtyPart = (qty && Number.isFinite(qty) && qty > 0) ? ` (${qty}×)` : "";

    const extraCount = Math.max(0, items.length - 1);
    const extraPart = extraCount ? ` + ${extraCount} more` : "";

    return `${primary}${qtyPart}${extraPart}`;
  }

  function renderOrders(orders) {
    if (!orders || !orders.length) {
      return `<div class="oo-card"><div class="oo-card-bd">No orders found.</div></div>`;
    }

    const header = `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Orders</b><small>Most recent first</small></div>
        <div class="oo-card-bd" style="padding:0;">
          <table class="oo-table">
            <thead>
              <tr>
                <th style="width:110px;">Order</th>
                <th style="width:140px;">Date</th>
                <th style="width:120px;">Status</th>
                <th style="width:160px;">Total</th>
                <th style="width:220px;">Payment</th>
                <th style="width:320px;">Product(s)</th>
                <th>Customer</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => {
                const id = esc(o?.id ?? "—");
                const date = esc(fmtDate(o?.date_created));
                const status = esc(o?.status ?? "—");
                const total = esc(fmtMoney(o?.total, o?.currency));
                const pmRaw = String(o?.payment_method_title || o?.payment_method || "").trim();
                if (!pmRaw) console.warn("[ArnoldAdmin] Order missing payment method fields:", o?.id ?? "(no id)", o);
                const pm = esc(pmRaw || "Unknown");

                const prod = orderProductSummary(o);
                if (prod === "—") console.warn("[ArnoldAdmin] Order missing line_items (product) data:", o?.id ?? "(no id)", o);

                const b = o?.billing || {};
                const name = [b?.first_name, b?.last_name].filter(Boolean).join(" ").trim();
                const email = b?.email || "";
                const who = esc([name, email].filter(Boolean).join(" • ") || "—");

                return `
                  <tr>
                    <td>#${id}</td>
                    <td>${date}</td>
                    <td>${status}</td>
                    <td>${total}</td>
                    <td>${pm}</td>
                    <td>${prod}</td>
                    <td>${who}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return header;
  }

  function renderJson(payload) {
    try {
      const pretty = JSON.stringify(payload, null, 2);
      return `<pre>${esc(pretty)}</pre>`;
    } catch {
      return `<pre>(Unable to render JSON)</pre>`;
    }
  }

  async function checkStatus() {
    try {
      const r = await apiFetch(API.status, { method: "GET" });
      const data = await r.json().catch(() => null);

      const loggedIn = !!data?.loggedIn;
      if (loggedIn) {
        setBadge("Session: logged in", true);
        showLogout(true);
      } else {
        setBadge("Session: logged out", false);
        showLogout(false);
      }
      return loggedIn;
    } catch (err) {
      console.warn("[ArnoldAdmin] status check error:", err);
      setBadge("Session: error", false);
      showLogout(false);
      return false;
    }
  }

  function setOutputs(payload) {
    const ctx = payload?.context || payload?.results || payload || {};
    const customer = ctx?.customer || null;
    const rawSubs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const rawOrders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    const isLikelySubscription = (x) =>
      x && (
        x.next_payment_date != null ||
        x.billing_interval != null ||
        x.billing_period != null ||
        x.parent_id != null
      );

    const isLikelyOrder = (x) =>
      x && (
        x.payment_method != null ||
        x.payment_method_title != null ||
        x.date_created != null ||
        Array.isArray(x.line_items)
      ) && !isLikelySubscription(x);

    const subs = rawSubs.filter(isLikelySubscription);
    const orders = rawOrders.filter(isLikelyOrder);

    if (rawSubs.length !== subs.length || rawOrders.length !== orders.length) {
      console.warn("[ArnoldAdmin] Classified arrays:", {
        rawSubs: rawSubs.length, subs: subs.length,
        rawOrders: rawOrders.length, orders: orders.length
      });
    }

    if (els.outCustomer) els.outCustomer.innerHTML = renderCustomer(customer);
    if (els.outSubs) els.outSubs.innerHTML = renderSubscriptions(subs);
    if (els.outOrders) els.outOrders.innerHTML = renderOrders(orders);
    if (els.outJson) els.outJson.innerHTML = renderJson(payload);
  }

  // ---- Search ----

  async function doSearch() {
    setMsg("", "");

    const q = els.query?.value?.trim();
    if (!q) {
      setMsg("Enter a search query.", "bad");
      return;
    }

    // Visible “Searching…” immediately (no silent no-op)
    setMsg("Searching…", "ok");

    let r, data;
    try {
      r = await apiFetch(API.search, {
        method: "POST",
        body: JSON.stringify({ query: q })
      });
    } catch (err) {
      console.error("[ArnoldAdmin] search network error:", err);
      setMsg("Search failed (network). See console.", "bad");
      return;
    }

    let txt = "";
    try { txt = await r.text(); } catch (_) { txt = ""; }

    try { data = txt ? JSON.parse(txt) : null; }
    catch (err) {
      console.error("[ArnoldAdmin] search JSON parse error:", err, txt);
      setMsg(`Search failed (bad JSON). HTTP ${r.status}. See console.`, "bad");
      if (els.outJson) els.outJson.innerHTML = `<pre>${esc(txt || "(empty)")}</pre>`;
      return;
    }

    console.log("[ArnoldAdmin] /admin/nl-search", { status: r.status, data });

    if (!r.ok || data?.ok === false) {
      setMsg(`Search failed. HTTP ${r.status}. ${data?.error || data?.message || ""}`.trim(), "bad");
      setOutputs(data || {});
      return;
    }

    setMsg(`Search OK. Intent: ${data?.intent || "unknown"}`, "ok");
    setOutputs(data || {});
  }

  // ---- Login/Logout ----

  async function doLogin() {
    const u = els.loginUser?.value?.trim();
    const p = els.loginPass?.value;

    if (!u || !p) {
      setMsg("Username and password required.", "bad");
      return;
    }

    setMsg("Logging in…", "ok");

    let r, data;
    try {
      r = await apiFetch(API.login, {
        method: "POST",
        body: JSON.stringify({ username: u, password: p })
      });
    } catch (err) {
      console.error("[ArnoldAdmin] login network error:", err);
      setMsg("Login failed (network). See console.", "bad");
      return;
    }

    const txt = await r.text().catch(() => "");
    try { data = txt ? JSON.parse(txt) : null; }
    catch (err) {
      console.error("[ArnoldAdmin] login JSON parse error:", err, txt);
      setMsg(`Login failed (bad JSON). HTTP ${r.status}.`, "bad");
      return;
    }

    console.log("[ArnoldAdmin] /admin/login", { status: r.status, data });

    if (!r.ok || data?.success === false) {
      setMsg(`Login failed. HTTP ${r.status}. ${data?.message || data?.error || ""}`.trim(), "bad");
      await checkStatus();
      return;
    }

    setMsg("Login OK.", "ok");
    await checkStatus();
  }

  async function doLogout() {
    setMsg("Logging out…", "ok");

    try {
      const r = await apiFetch(API.logout, { method: "POST", body: JSON.stringify({}) });
      const data = await r.json().catch(() => null);
      console.log("[ArnoldAdmin] /admin/logout", { status: r.status, data });
    } catch (err) {
      console.error("[ArnoldAdmin] logout error:", err);
    }

    setMsg("Logged out.", "ok");
    await checkStatus();
  }

  function toggleRaw() {
    if (!els.rawWrap) return;
    const isHidden = els.rawWrap.style.display === "none" || !els.rawWrap.style.display;
    els.rawWrap.style.display = isHidden ? "" : "none";
  }

  // ---- Bind handlers ----

  window.addEventListener("DOMContentLoaded", async () => {
    bindEls();

    if (els.btnLogin) els.btnLogin.addEventListener("click", doLogin);
    if (els.btnLogout) els.btnLogout.addEventListener("click", doLogout);
    if (els.btnSearch) els.btnSearch.addEventListener("click", doSearch);
    if (els.btnRaw) els.btnRaw.addEventListener("click", toggleRaw);

    // Enter key convenience
    if (els.query) {
      els.query.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }
    if (els.loginPass) {
      els.loginPass.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    }

    setBadge("Session: checking…", false);
    await checkStatus();
  });

  window.addEventListener("error", (e) => {
    console.error("[ArnoldAdmin] window error:", e?.message || e);
    setMsg("Unexpected error (see console).", "bad");
    setBadge("Session: error", false);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("[ArnoldAdmin] unhandled rejection:", e?.reason || e);
    setMsg("Unexpected error (see console).", "bad");
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js