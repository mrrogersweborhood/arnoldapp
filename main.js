// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-22e)
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
    // Resilient DOM lookups: accept both current ids and legacy ids.
    const byId = (...ids) => {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
      }
      return null;
    };

    return {
      // Auth
      user: byId("loginUser", "inputUser", "user"),
      pass: byId("loginPass", "inputPass", "pass"),
      btnLogin: byId("btnLogin"),
      btnLogout: byId("btnLogout"),

      // Query
      query: byId("query", "queryInput", "inputQuery"),
      btnSearch: byId("searchBtn", "btnSearch"),

      // Session badge / pill
      sessionBadge: byId("sessionPill", "sessionBadge"),

      // Output
      statusMsg: byId("msg", "statusMsg"),
      outCustomer: byId("customerOut", "outCustomer"),
      outSubs: byId("subsOut", "outSubs"),
      outOrders: byId("ordersOut", "outOrders"),
      outJson: byId("rawOut", "outJson"),
      rawJsonDetails: byId("rawJsonDetails", "rawJson")
    };
  })();

  // ---- Utilities ----

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMsg(text, kind) {
    const m = els.statusMsg;
    if (!m) return;
    if (!text) {
      m.textContent = "";
      m.className = "msg";
      m.style.display = "none";
      return;
    }
    m.textContent = text;
    m.className = `msg ${kind || ""}`.trim();
    m.style.display = "block";
  }

  function setBadge(text, loggedIn) {
    const pill = els.sessionBadge;
    if (!pill) return;
    const label = pill.querySelector("#sessionText") || pill.querySelector("span:last-child");
    if (label) label.textContent = text;
    pill.dataset.state = loggedIn ? "in" : "out";
  }

  function parseLooseDate(val) {
    if (val == null) return null;
    const s = String(val).trim();
    if (!s) return null;

    // First try native parsing (ISO 8601 etc.)
    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct;

    // Woo/Subs often returns: "YYYY-MM-DD HH:MM:SS" (no T, no timezone)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      const hour = m[4] ? Number(m[4]) : 0;
      const min = m[5] ? Number(m[5]) : 0;
      const sec = m[6] ? Number(m[6]) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }

    // Fallback: if it at least starts with YYYY-MM-DD, parse that as a local date.
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) {
      const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const s = String(iso).trim();
    const d = parseLooseDate(s);
    if (!d) return s || "—";
    try {
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return s || "—";
    }
  }

  function fmtMoney(amount, currency) {
    const a = Number(amount);
    if (!isFinite(a)) return amount == null ? "—" : String(amount);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD"
      }).format(a);
    } catch {
      return `$${a.toFixed(2)}`;
    }
  }

  function fmtPhone(raw) {
    if (!raw) return "—";
    const digits = String(raw).replace(/\D/g, "");
    // Common Woo cases: "14059907557" or "4059907557"
    const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return raw;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const s = String(iso).trim();
    const d = parseLooseDate(s);
    if (!d) {
      // If it looks like a date string, show the YYYY-MM-DD portion rather than "—"
      const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m2 ? m2[1] : (s || "—");
    }
    try {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m2 ? m2[1] : (s || "—");
    }
  }

  // ---- Networking ----

  async function apiFetch(url, init) {
    const opts = {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    };

    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { resp, data };
  }

  async function refreshSession() {
    try {
      setBadge("Session: checking…", false);
      const { resp, data } = await apiFetch(API.status, { method: "GET" });
      const loggedIn = !!(resp.ok && data?.loggedIn);

      if (loggedIn) setBadge("Session: logged in", true);
      else setBadge("Session: logged out", false);

      return loggedIn;
    } catch (err) {
      console.error("[ArnoldAdmin] status error:", err);
      setBadge("Session: error", false);
      return false;
    }
  }

  async function doLogin() {
    setMsg("", "");
    const username = els.user?.value?.trim();
    const password = els.pass?.value;

    if (!username || !password) {
      setMsg("Enter username + password.", "bad");
      return;
    }

    els.btnLogin && (els.btnLogin.disabled = true);
    try {
      const { resp, data } = await apiFetch(API.login, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      console.log("[ArnoldAdmin] POST /admin/login", resp.status, data);

      if (!resp.ok || !data?.success) {
        setMsg(data?.message || `Login failed (${resp.status}).`, "bad");
        await refreshSession();
        return;
      }

      setMsg("Logged in.", "ok");
      await refreshSession();
    } catch (err) {
      console.error("[ArnoldAdmin] login error:", err);
      setMsg("Login error (see Console).", "bad");
      setBadge("Session: error", false);
    } finally {
      els.btnLogin && (els.btnLogin.disabled = false);
    }
  }

  async function doLogout() {
    setMsg("", "");
    els.btnLogout && (els.btnLogout.disabled = true);
    try {
      const { resp, data } = await apiFetch(API.logout, { method: "POST" });
      console.log("[ArnoldAdmin] POST /admin/logout", resp.status, data);
      setMsg("Logged out.", "ok");
      await refreshSession();
    } catch (err) {
      console.error("[ArnoldAdmin] logout error:", err);
      setMsg("Logout error (see Console).", "bad");
    } finally {
      els.btnLogout && (els.btnLogout.disabled = false);
    }
  }

  // ---- Rendering ----

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
      ["email", email],
      ["phone", phone]
    ];

    return `
      <div class="card" style="box-shadow:none; background:rgba(0,0,0,.02);">
        <div class="cardTitle">${esc(title)}</div>
        <div class="kv">${renderKVRows(rows)}</div>
      </div>
    `;
  }

  function renderCustomer(customer) {
    if (!customer) return "<div class='muted'>—</div>";

    const id = customer?.id ?? "—";
    const username = customer?.username ?? "—";

    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    // Top row: Customer ID + Username (two columns, one line)
    const top = `
      <div class="kv">
        ${renderKVRows([
          ["customer id", id],
          ["username", username]
        ])}
      </div>
    `;

    const addr = `
      <div class="cardGrid2">
        ${renderAddressBlock("Billing", billing)}
        ${renderAddressBlock("Shipping", shipping)}
      </div>
    `;

    return `${top}<div style="margin-top:12px;">${addr}</div>`;
  }

  function renderSubscriptions(subs) {
    if (!subs?.length) return "<div class='muted'>—</div>";

    const rows = subs.slice(0, 50).map((s) => {
      const id = esc(s?.id ?? "");
      const status = esc(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);

      // IMPORTANT: these can be "YYYY-MM-DD HH:MM:SS" → handled by parseLooseDate()
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
          <td><strong>#${id}</strong> <span class="pill pillStatus" style="margin-left:8px;">${status}</span></td>
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
          <div><span class="pill pillStatus">${status}</span></div>
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

  // ---- Search ----

  async function doSearch() {
    setMsg("", "");

    const q = els.query?.value?.trim();
    if (!q) {
      setMsg("Enter a search query.", "bad");
      return;
    }

    // Visible “Searching…” + disable
    els.btnSearch && (els.btnSearch.disabled = true);
    setMsg("Searching…", "ok");

    try {
      const { resp, data } = await apiFetch(API.search, {
        method: "POST",
        body: JSON.stringify({ query: q })
      });

      console.log("[ArnoldAdmin] POST /admin/nl-search", resp.status, data);

      if (!resp.ok) {
        const msg =
          (data && (data.message || data.error)) ||
          `Search failed (${resp.status}).`;
        setMsg(msg, "bad");
        return;
      }

      if (!data || data.ok !== true) {
        setMsg("Search returned unexpected JSON (see Raw JSON).", "bad");
      } else {
        setMsg("Search complete.", "ok");
      }

      setOutputs(data);
    } catch (err) {
      console.error("[ArnoldAdmin] search error:", err);
      setMsg("Search error (see Console).", "bad");
    } finally {
      els.btnSearch && (els.btnSearch.disabled = false);
    }
  }

  // ---- Init ----

  async function init() {
    // Fail-fast DOM validation (visible)
    const required = [
      ["loginUser", els.user],
      ["loginPass", els.pass],
      ["btnLogin", els.btnLogin],
      ["btnLogout", els.btnLogout],
      ["query", els.query],
      ["btnSearch", els.btnSearch],
      ["msg", els.statusMsg],
      ["customerOut", els.outCustomer],
      ["subsOut", els.outSubs],
      ["ordersOut", els.outOrders],
      ["rawOut", els.outJson],
      ["sessionPill", els.sessionBadge]
    ];

    const missing = required.filter(([, el]) => !el).map(([name]) => name);
    if (missing.length) {
      console.error("[ArnoldAdmin] Missing required DOM nodes:", missing);
      setMsg(`Fatal: DOM mismatch (missing: ${missing.join(", ")}). Check index.html ids.`, "bad");
      setBadge("Session: error", false);
      return;
    }

    // Wire handlers
    els.btnLogin.addEventListener("click", doLogin);
    els.btnLogout.addEventListener("click", doLogout);
    els.btnSearch.addEventListener("click", doSearch);

    // Enter key convenience
    els.pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    els.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    // Initial session check
    await refreshSession();
  }

  init().catch((err) => {
    console.error(err);
    setMsg("Fatal error in main.js (see Console).", "bad");
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js