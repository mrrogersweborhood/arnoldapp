// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-23g)
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

  const els = (() => {
    const map = {
      loginUser: ["loginUser"],
      loginPass: ["loginPass"],
      btnLogin: ["btnLogin"],
      btnLogout: ["btnLogout"],

      sessionPill: ["sessionPill"],
      sessionText: ["sessionText"],

      query: ["query"],
      btnSearch: ["btnSearch"],
      btnShowRaw: ["btnShowRaw"],
      rawWrap: ["rawWrap"],

      msg: ["msg"],

      outCustomer: ["customerOut"],
      outSubs: ["subsOut"],
      outOrders: ["ordersOut"],
      outJson: ["rawOut"]
    };

    function findFirst(ids) {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
      }
      return null;
    }

    const out = {};
    for (const [k, ids] of Object.entries(map)) out[k] = findFirst(ids);
    return out;
  })();

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMsg(text, state) {
    if (!els.msg) return;
    els.msg.classList.remove("ok", "bad");
    if (state) els.msg.classList.add(state);
    els.msg.textContent = text ?? "";
  }

  function setBadge(text, inSession) {
    if (els.sessionText) els.sessionText.textContent = text ?? "";
    if (els.sessionPill) els.sessionPill.setAttribute("data-state", inSession ? "in" : "out");
  }

  async function apiFetch(url, init) {
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
  }

  function parseLooseDate(input) {
    if (!input) return null;
    const s = String(input).trim();
    if (!s) return null;
    const isoish = s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s;
    const d = new Date(isoish);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function fmtDate(input) {
    const d = parseLooseDate(input);
    if (!d) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function fmtPhone(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "—";
    const digits = s.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return s;
  }

  function fmtMoney(total) {
    const t = String(total ?? "").trim();
    if (!t) return "—";
    const n = Number(t);
    if (!Number.isFinite(n)) return `$${t}`;
    return `$${n.toFixed(2)}`;
  }

  function firstNonEmpty(...vals) {
    for (const v of vals) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  }

  // Derive Customer ID/Username when the Worker had to fall back to billing/shipping-only customer context.
  function deriveIdentity(payload, ctx) {
    const customer = ctx?.customer || null;
    const subs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    const idFromCustomer = customer?.id ?? null;
    const idFromSub = subs[0]?.customer_id ?? null;
    const idFromOrder = orders[0]?.customer_id ?? null;

    const idFromPayload =
      payload?.customer_id ??
      payload?.inferred_customer_id ??
      payload?.context?.customer?.id ??
      null;

    const derivedId = firstNonEmpty(idFromCustomer, idFromSub, idFromOrder, idFromPayload);

    const username = firstNonEmpty(customer?.username);
    const derivedUsername = username || "";

    return {
      derivedCustomerId: derivedId || "",
      derivedUsername
    };
  }

  function renderCustomer(c, identity) {
    if (!c) {
      return `<div class="oo-card"><div class="oo-card-bd">No customer found.</div></div>`;
    }

    const showId = identity?.derivedCustomerId ? esc(identity.derivedCustomerId) : "—";
    const showUser = identity?.derivedUsername
      ? esc(identity.derivedUsername)
      : "<span style='color:var(--oo-muted);font-weight:800;'>(Not available)</span>";

    const billing = c?.billing || {};
    const shipping = c?.shipping || {};

    const identityCard = `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Identity</b><small>Customer</small></div>
        <div class="oo-card-bd">
          <div class="oo-kv">
            <div class="k">Customer ID</div><div class="v">${showId}</div>
            <div class="k">Username</div><div class="v">${showUser}</div>
          </div>
        </div>
      </div>
    `;

    function addrBlock(a, includeEmailPhone) {
      const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—";
      const addr1 = a?.address_1 || "—";
      const addr2 = a?.address_2 || "";
      const city = [a?.city, a?.state, a?.postcode, a?.country].filter(Boolean).join(" • ") || "—";

      const email = includeEmailPhone ? (a?.email || null) : null;
      const phone = includeEmailPhone ? (a?.phone || null) : null;

      return `
        <div class="oo-kv">
          <div class="k">Name</div><div class="v">${esc(name)}</div>
          <div class="k">Address</div>
          <div class="v">${esc(addr1)}${addr2 ? `<br>${esc(addr2)}` : ""}<br>${esc(city)}</div>
          ${email ? `<div class="k">Email</div><div class="v">${esc(email)}</div>` : ""}
          ${phone ? `<div class="k">Phone</div><div class="v">${esc(fmtPhone(phone))}</div>` : ""}
        </div>
      `;
    }

    const billingCard = `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Billing</b><small>${esc([billing?.first_name, billing?.last_name].filter(Boolean).join(" ").trim() || "—")}</small></div>
        <div class="oo-card-bd">
          ${addrBlock(billing, true)}
        </div>
      </div>
    `;

    const shippingCard = `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Shipping</b><small>${esc([shipping?.first_name, shipping?.last_name].filter(Boolean).join(" ").trim() || "—")}</small></div>
        <div class="oo-card-bd">
          ${addrBlock(shipping, false)}
        </div>
      </div>
    `;

    return `<div class="custGrid">${identityCard}${billingCard}${shippingCard}</div>`;
  }

  function renderSubscriptions(subs) {
    if (!subs || !subs.length) {
      return `<div class="oo-card"><div class="oo-card-bd">No subscriptions found.</div></div>`;
    }

    return `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Subscriptions</b><small>Contract + schedule</small></div>
        <div class="oo-card-bd" style="padding:0;">
          <table class="oo-table">
            <thead>
              <tr>
                <th style="width:160px;">Subscription</th>
                <th style="width:140px;">Total</th>
                <th style="width:160px;">Next Payment</th>
                <th style="width:150px;">End</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${subs.map(s => {
                const id = esc(s?.id ?? "—");
                const status = String(s?.status ?? "—");
                const statusLc = status.toLowerCase();

                const total = esc(fmtMoney(s?.total));
                const nextPay = esc(fmtDate(s?.next_payment_date));

                const endRaw = s?.end_date;
                const end = endRaw ? esc(fmtDate(endRaw)) : (statusLc === "active" ? "Auto-renews" : "—");

                const notes = Array.isArray(s?.notes) ? s.notes : [];
                const notesHtml = notes.length
                  ? `<div class="oo-notes" style="margin-top:12px;">
                      ${notes.map(n => `
                        <div class="oo-note">
                          <small>${esc(fmtDate(n?.date_created))} • ${esc(n?.author || n?.added_by || "WooCommerce")}</small>
                          <div class="txt">${esc(n?.note || "")}</div>
                        </div>
                      `).join("")}
                    </div>`
                  : "";

                return `
                  <tr>
                    <td><b>#${id}</b> <span style="color:var(--oo-muted);font-weight:800;">(${esc(status)})</span></td>
                    <td>${total}</td>
                    <td>${nextPay}</td>
                    <td>${end}</td>
                    <td>${notesHtml || "—"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderOrders(orders) {
    if (!orders || !orders.length) {
      return `<div class="oo-card"><div class="oo-card-bd">No orders found.</div></div>`;
    }

    return `
      <div class="oo-card">
        <div class="oo-card-hd"><b>Orders</b><small>Most recent first</small></div>
        <div class="oo-card-bd" style="padding:0;">
          <table class="oo-table">
            <thead>
              <tr>
                <th style="width:110px;">Order</th>
                <th style="width:140px;">Date</th>
                <th style="width:120px;">Status</th>
                <th style="width:140px;">Total</th>
                <th style="width:220px;">Payment</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => {
                const id = esc(o?.id ?? "—");
                const date = esc(fmtDate(o?.date_created));
                const status = esc(o?.status ?? "—");
                const total = esc(fmtMoney(o?.total));

                const pmRaw = String(o?.payment_method_title || o?.payment_method || "").trim();
                const pm = pmRaw || "Unknown";

                const items = Array.isArray(o?.line_items)
                  ? o.line_items
                      .slice(0, 10)
                      .map(li => {
                        const qty = Number(li?.quantity ?? 0) || 0;
                        const name = String(li?.name ?? "").trim();
                        return name ? `${qty} x ${name}` : "";
                      })
                      .filter(Boolean)
                      .join(", ")
                  : "";

                return `
                  <tr>
                    <td><b>#${id}</b></td>
                    <td>${date}</td>
                    <td>${status}</td>
                    <td>${total}</td>
                    <td>${esc(pm)}</td>
                    <td>${esc(items || "—")}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderJson(payload) {
    try {
      const pretty = JSON.stringify(payload, null, 2);
      return `<pre>${esc(pretty)}</pre>`;
    } catch {
      return `<pre>(Unable to render JSON)</pre>`;
    }
  }

  function setOutputs(payload) {
    const ctx = payload?.context || payload?.results || payload || {};
    const customer = ctx?.customer || null;
    const subs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    const identity = deriveIdentity(payload, ctx);

    if (els.outCustomer) els.outCustomer.innerHTML = renderCustomer(customer, identity);
    if (els.outSubs) els.outSubs.innerHTML = renderSubscriptions(subs);
    if (els.outOrders) els.outOrders.innerHTML = renderOrders(orders);
    if (els.outJson) els.outJson.innerHTML = renderJson(payload);
  }

  async function checkStatus() {
    try {
      const r = await apiFetch(API.status, { method: "GET" });
      const data = await r.json().catch(() => null);
      const loggedIn = !!data?.loggedIn;
      setBadge(loggedIn ? "Session: logged in" : "Session: logged out", loggedIn);
      return loggedIn;
    } catch (err) {
      console.warn("[ArnoldAdmin] status check error:", err);
      setBadge("Session: error", false);
      return false;
    }
  }

  async function doLogin() {
    const username = els.loginUser?.value?.trim();
    const password = els.loginPass?.value;

    if (!username || !password) {
      setMsg("Username and password required.", "bad");
      return;
    }

    setMsg("Logging in…", "ok");

    let r, data;
    try {
      r = await apiFetch(API.login, { method: "POST", body: JSON.stringify({ username, password }) });
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

  async function doSearch() {
    setMsg("", "");

    const q = els.query?.value?.trim();
    if (!q) {
      setMsg("Enter a search query.", "bad");
      return;
    }

    setMsg("Searching…", "ok");

    let r, data;
    try {
      r = await apiFetch(API.search, { method: "POST", body: JSON.stringify({ query: q }) });
    } catch (err) {
      console.error("[ArnoldAdmin] search network error:", err);
      setMsg("Search failed (network). See console.", "bad");
      return;
    }

    const txt = await r.text().catch(() => "");
    try { data = txt ? JSON.parse(txt) : null; }
    catch (err) {
      console.error("[ArnoldAdmin] search JSON parse error:", err, txt);
      setMsg(`Search failed (bad JSON). HTTP ${r.status}.`, "bad");
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

  function toggleRaw() {
    if (!els.rawWrap) return;
    const isHidden = els.rawWrap.style.display === "none" || !els.rawWrap.style.display;
    els.rawWrap.style.display = isHidden ? "" : "none";
  }

  window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("btnLogin")?.addEventListener("click", doLogin);
    document.getElementById("btnLogout")?.addEventListener("click", doLogout);
    document.getElementById("btnSearch")?.addEventListener("click", doSearch);
    document.getElementById("btnShowRaw")?.addEventListener("click", toggleRaw);

    document.getElementById("query")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    document.getElementById("loginPass")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

    await checkStatus();
  });

  window.addEventListener("error", (e) => {
    console.error("[ArnoldAdmin] window error:", e?.message || e);
    setMsg("Fatal error in main.js (see Console).", "bad");
    setBadge("Session: error", false);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("[ArnoldAdmin] unhandled rejection:", e?.reason || e);
    setMsg("Fatal error in main.js (see Console).", "bad");
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js