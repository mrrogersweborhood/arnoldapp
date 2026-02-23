// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-23d)
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
    // Resilient DOM lookups: accept both current ids and legacy ids
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

  function fmtDateTime(input) {
    const d = parseLooseDate(input);
    if (!d) return "—";
    return d.toLocaleString();
  }

  function fmtPhone(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "—";
    const digits = s.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return s;
  }

  function fmtMoney(total, currency) {
    // Display in $0.00 format (no "USD" suffix)
    const raw = total == null ? "" : String(total).trim();
    if (!raw) return "—";
    const n = Number(raw);
    if (!Number.isFinite(n)) return `$${raw}`; // fallback if API returns non-numeric
    return `$${n.toFixed(2)}`;
  }

  function renderKVRows(pairs) {
    return pairs
      .map(([k, v]) => {
        const val = v == null || v === "" ? "—" : String(v);
        return `<div class="kvRow"><div class="kvK">${esc(k)}</div><div class="kvV">${esc(val)}</div></div>`;
      })
      .join("");
  }

  function renderAddressBlock(title, a) {
    const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—";
    const cityLine = [a?.city, a?.state, a?.postcode, a?.country].filter(Boolean).join(" • ") || "—";
    const email = a?.email || "—";
    const phone = fmtPhone(a?.phone);

    const rows = [
      ["name", name],
      ["address", a?.address_1 || "—"],
      ...(a?.address_2 ? [["", a.address_2]] : []),
      ["", cityLine],
      ...(title === "Billing" ? [["email", email], ["phone", phone]] : [])
    ];

    return `
      <div class="card">
        <div class="cardHd"><b>${esc(title)}</b><small>${esc(name)}</small></div>
        <div class="cardBd">
          <div class="kv">
            ${renderKVRows(rows)}
          </div>
        </div>
      </div>
    `;
  }

  function renderCustomer(customer) {
    if (!customer) return "<div class='muted'>—</div>";

    const id = customer?.id ?? "—";
    const username = customer?.username ?? "—";

    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    // Put identity into a visible card so it can't "disappear" visually.
    const identityCard = `
      <div class="card">
        <div class="cardHd"><b>Identity</b><small>Customer</small></div>
        <div class="cardBd">
          <div class="kv">
            ${renderKVRows([
              ["customer id", id],
              ["username", username]
            ])}
          </div>
        </div>
      </div>
    `;

    const addr = `
      <div class="cardGrid2" style="margin-top:12px;">
        ${renderAddressBlock("Billing", billing)}
        ${renderAddressBlock("Shipping", shipping)}
      </div>
    `;

    return `${identityCard}${addr}`;
  }

  function renderSubscriptions(subs) {
    if (!subs?.length) return "<div class='muted'>—</div>";

    const rows = subs.slice(0, 50).map((s) => {
      const id = esc(s?.id ?? "");
      const status = esc(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);

      const nextPay = fmtDate(s?.next_payment_date);
      const end = fmtDate(s?.end_date);

      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const notesHtml = notes.length
        ? `<div class="notesStack">${notes.slice(0, 50).map((n) => {
            const when = fmtDateTime(n?.date_created);
            const body = (n?.note ?? "").trim();
            const who = (n?.author || n?.added_by || "").trim() || "WooCommerce";
            return `
              <div class="noteCard">
                <div class="noteTop"><span>${esc(when)}</span><span>${esc(who)}</span></div>
                <div class="noteBody">${esc(body || "—")}</div>
              </div>
            `;
          }).join("")}</div>`
        : "<div class='muted'>—</div>";

      return `
        <tr>
          <td><strong>#${id}</strong> <span class="pillStatus" style="margin-left:8px;">${status}</span></td>
          <td class="mono">${esc(total)}</td>
          <td class="mono">${esc(nextPay)}</td>
          <td class="mono">${esc(end)}</td>
          <td>${notesHtml}</td>
        </tr>
      `;
    });

    return `
      <div class="subTableWrap">
        <table class="subTable">
          <thead>
            <tr>
              <th>Subscription</th>
              <th>Total</th>
              <th>Next payment</th>
              <th>End</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOrders(orders) {
    if (!orders?.length) return "<div class='muted'>—</div>";

    const header = `
      <div class="orderHeader">
        <div>Order</div>
        <div>Status</div>
        <div>Total</div>
        <div>Payment</div>
        <div>Date</div>
        <div>Items</div>
      </div>
    `;

    const rows = orders.slice(0, 25).map((o) => {
      const id = o?.id ?? "";
      const status = esc(o?.status ?? "—");
      const total = fmtMoney(o?.total, o?.currency);
      const date = fmtDateTime(o?.date_created);
      const pm = esc(o?.payment_method_title || o?.payment_method || "—");

      const items = Array.isArray(o?.line_items)
        ? o.line_items
            .map((li) => `${li?.quantity ?? 0}× ${esc(li?.name ?? "")}`.trim())
            .filter(Boolean)
            .join(", ")
        : "";

      return `
        <div class="orderRow">
          <div class="mono"><strong>#${esc(id)}</strong></div>
          <div><span class="pillStatus">${status}</span></div>
          <div class="mono">${esc(total)}</div>
          <div>${pm}</div>
          <div class="mono">${esc(date)}</div>
          <div class="items">${items || "—"}</div>
        </div>
      `;
    });

    return `<div class="orderTableWrap"><div class="orderLines">${header}${rows.join("")}</div></div>`;
  }

  function renderJson(obj) {
    const pretty = JSON.stringify(obj ?? null, null, 2);
    return `<pre class="json">${esc(pretty)}</pre>`;
  }

  function setOutputs(payload) {
    const ctx = payload?.context || payload?.results || payload || {};
    const customer = ctx?.customer || null;
    const subs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    if (els.outCustomer) els.outCustomer.innerHTML = renderCustomer(customer);
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
      r = await apiFetch(API.login, {
        method: "POST",
        body: JSON.stringify({ username, password })
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
      if (els.outJson) els.outJson.innerHTML = `<pre class="json">${esc(txt || "(empty)")}</pre>`;
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