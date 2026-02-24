// 🟢 main.js
// Arnold Admin main.js — FULL REPLACEMENT (v2026-02-23a)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const API = {
    login: `${WORKER_BASE}/admin/login`,
    logout: `${WORKER_BASE}/admin/logout`,
    status: `${WORKER_BASE}/admin/status`,
    search: `${WORKER_BASE}/admin/nl-search`
  };

  const els = {
    user: document.getElementById("loginUser"),
    pass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    btnToggleRaw: document.getElementById("btnToggleRaw"),

    statusMsg: document.getElementById("msg"),

    sessionPill: document.getElementById("sessionPill"),
    sessionText: document.getElementById("sessionText"),
    sessionDot: document.getElementById("sessionDot"),

    outCustomer: document.getElementById("customerOut"),
    outSubs: document.getElementById("subsOut"),
    outOrders: document.getElementById("ordersOut"),

    rawWrap: document.getElementById("rawWrap"),
    outJson: document.getElementById("rawOut")
  };

  /* ---------------- Utils ---------------- */

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setMsg(text, kind) {
    if (!els.statusMsg) return;
    els.statusMsg.textContent = text || "";
    els.statusMsg.className = "statusMsg";
    if (kind === "ok") els.statusMsg.classList.add("statusOk");
    if (kind === "bad") els.statusMsg.classList.add("statusBad");
  }

  function setBadge(text, ok) {
    if (els.sessionText) els.sessionText.textContent = text;
    if (els.sessionDot) {
      els.sessionDot.classList.toggle("ok", !!ok);
    }
  }

  function parseLooseDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    // accepts "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
    const iso = s.replace(" ", "T");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  // Dates: DROP TIME everywhere per your requirement
  function fmtDate(val) {
    const d = parseLooseDate(val);
    if (!d) return "—";
    return d.toLocaleDateString("en-US");
  }

  // Currency: $0.00 style (symbol), never "USD"
  function fmtMoney(total, currency) {
    if (total == null || total === "") return "—";
    const num = Number(total);
    if (Number.isNaN(num)) return "—";

    // Use provided currency if valid; default to USD
    const cur = (currency && String(currency).trim()) ? String(currency).trim().toUpperCase() : "USD";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch (_) {
      // fallback
      return `$${num.toFixed(2)}`;
    }
  }

  async function apiFetch(url, init) {
    const resp = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init && init.headers ? init.headers : {})
      },
      credentials: "include"
    });

    const txt = await resp.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { resp, data };
  }

  /* ---------------- Auth ---------------- */

  async function refreshStatus() {
    try {
      const { resp, data } = await apiFetch(API.status, { method: "GET" });
      const loggedIn = !!(resp.ok && data && data.loggedIn);

      if (loggedIn) {
        setBadge("Session: logged in", true);
      } else {
        setBadge("Session: logged out", false);
      }
    } catch (err) {
      console.error("[ArnoldAdmin] status error:", err);
      setBadge("Session: error", false);
    }
  }

  async function doLogin() {
    setMsg("", "");
    const username = els.user?.value?.trim();
    const password = els.pass?.value ?? "";

    if (!username || !password) {
      setMsg("Enter username and password.", "bad");
      return;
    }

    els.btnLogin && (els.btnLogin.disabled = true);
    setMsg("Logging in…", "ok");

    try {
      const { resp, data } = await apiFetch(API.login, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      console.log("[ArnoldAdmin] POST /admin/login", resp.status, data);

      if (!resp.ok || !data?.success) {
        setMsg((data && (data.message || data.error)) || `Login failed (${resp.status}).`, "bad");
        setBadge("Session: logged out", false);
        return;
      }

      setMsg("Logged in.", "ok");
      setBadge("Session: logged in", true);
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
    setMsg("Logging out…", "ok");

    try {
      const { resp, data } = await apiFetch(API.logout, { method: "POST" });
      console.log("[ArnoldAdmin] POST /admin/logout", resp.status, data);

      if (!resp.ok) {
        setMsg((data && (data.message || data.error)) || `Logout failed (${resp.status}).`, "bad");
        return;
      }

      setMsg("Logged out.", "ok");
      setBadge("Session: logged out", false);
    } catch (err) {
      console.error("[ArnoldAdmin] logout error:", err);
      setMsg("Logout error (see Console).", "bad");
    } finally {
      els.btnLogout && (els.btnLogout.disabled = false);
    }
  }

  /* ---------------- Rendering ---------------- */

  function renderIdentity(customer) {
    const id = customer?.id ?? "—";
    const username = customer?.username ?? customer?.slug ?? null;

    return `
      <div class="card" style="box-shadow:none;border:1px solid rgba(15,23,42,.10);border-radius:14px;">
        <div class="cardHead" style="padding:12px 14px;">
          <div class="cardTitle" style="font-size:13px;">Identity</div>
          <div class="cardMeta">Customer</div>
        </div>
        <div class="cardBody" style="padding:12px 14px;">
          <div style="display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;">
            <div class="label" style="margin:0;">Customer ID</div>
            <div class="mono" style="font-weight:900;">${esc(id)}</div>

            <div class="label" style="margin:0;">Username</div>
            <div class="mono" style="font-weight:900;">${esc(username || "Not available")}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAddressBlock(title, a) {
    const first = (a?.first_name || "").trim();
    const last = (a?.last_name || "").trim();
    const name = [first, last].filter(Boolean).join(" ").trim();

    const line1 = (a?.address_1 || "").trim();
    const line2 = (a?.address_2 || "").trim();
    const city = (a?.city || "").trim();
    const state = (a?.state || "").trim();
    const zip = (a?.postcode || "").trim();
    const country = (a?.country || "").trim();

    const loc = [city, state, zip, country].filter(Boolean).join(" • ");

    const email = (a?.email || "").trim();
    const phone = (a?.phone || "").trim();

    const rows = [
      ["Name", name || "—"],
      ["Address", [line1, line2].filter(Boolean).join(", ") || "—"],
      ["", loc || ""],
      ["Email", email || "—"],
      ["Phone", phone || "—"]
    ].filter(([k, v]) => (k !== "" ? true : !!v));

    const rowHtml = rows
      .map(([k, v]) => {
        if (k === "") {
          return `<div></div><div style="font-weight:800;">${esc(v)}</div>`;
        }
        return `<div class="label" style="margin:0;">${esc(k)}</div><div style="font-weight:900;">${esc(v)}</div>`;
      })
      .join("");

    return `
      <div class="card" style="box-shadow:none;border:1px solid rgba(15,23,42,.10);border-radius:14px;">
        <div class="cardHead" style="padding:12px 14px;">
          <div class="cardTitle" style="font-size:13px;">${esc(title)}</div>
          <div class="cardMeta">${esc(name || "—")}</div>
        </div>
        <div class="cardBody" style="padding:12px 14px;">
          <div style="display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:center;">
            ${rowHtml}
          </div>
        </div>
      </div>
    `;
  }

  function renderCustomer(customer) {
    if (!customer) return "<div class='muted'>—</div>";

    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        ${renderIdentity(customer)}
        ${renderAddressBlock("Billing", billing)}
        ${renderAddressBlock("Shipping", shipping)}
      </div>
    `;
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
        ? `<div class="notesStack">${
            notes.slice(0, 50).map((n) => {
              const when = fmtDate(n?.date_created);
              const body = (n?.note ?? "").trim();
              const who = (n?.author || n?.added_by || "").trim() || "WooCommerce";
              return `
                <div class="noteCard">
                  <div class="noteTop"><span>${esc(when)}</span><span>${esc(who)}</span></div>
                  <div class="noteBody">${esc(body || "—")}</div>
                </div>
              `;
            }).join("")
          }</div>`
        : "<div class='muted'>—</div>";

      return `
        <tr>
          <td><strong>#${id}</strong> <span class="pill" style="margin-left:8px;">${status}</span></td>
          <td class="mono">${esc(total)}</td>
          <td class="mono">${esc(nextPay)}</td>
          <td class="mono">${esc(end)}</td>
          <td>${notesHtml}</td>
        </tr>
      `;
    });

    return `
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:separate;border-spacing:0 10px;">
          <thead>
            <tr class="orderHeader" style="display:table-row;">
              <th style="text-align:left;padding:10px;">Subscription</th>
              <th style="text-align:left;padding:10px;">Total</th>
              <th style="text-align:left;padding:10px;">Next Payment</th>
              <th style="text-align:left;padding:10px;">End</th>
              <th style="text-align:left;padding:10px;">Notes</th>
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
      const date = fmtDate(o?.date_created); // DROP TIME
      const pm = esc(o?.payment_method_title || o?.payment_method || "—");

      // Orders: show product ordered (line_items)
      const items = Array.isArray(o?.line_items)
        ? o.line_items
            .map((li) => `${li?.quantity ?? 0}× ${esc(li?.name ?? "")}`.trim())
            .filter(Boolean)
            .join(", ")
        : "";

      return `
        <div class="orderRow">
          <div class="mono"><strong>#${esc(id)}</strong></div>
          <div><span class="pill">${status}</span></div>
          <div class="mono">${esc(total)}</div>
          <div>${pm}</div>
          <div class="mono">${esc(date)}</div>
          <div class="items">${items || "—"}</div>
        </div>
      `;
    });

    return `<div class="orderLines">${header}${rows.join("")}</div>`;
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

  /* ---------------- Search ---------------- */

  async function doSearch() {
    setMsg("", "");

    const q = els.query?.value?.trim();
    if (!q) {
      setMsg("Enter a search query.", "bad");
      return;
    }

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

  function toggleRaw() {
    if (!els.rawWrap) return;
    els.rawWrap.classList.toggle("on");
  }

  /* ---------------- Init ---------------- */

  async function init() {
    const required = [
      ["loginUser", els.user],
      ["loginPass", els.pass],
      ["btnLogin", els.btnLogin],
      ["btnLogout", els.btnLogout],
      ["query", els.query],
      ["btnSearch", els.btnSearch],
      ["btnToggleRaw", els.btnToggleRaw],
      ["msg", els.statusMsg],
      ["customerOut", els.outCustomer],
      ["subsOut", els.outSubs],
      ["ordersOut", els.outOrders],
      ["rawWrap", els.rawWrap],
      ["rawOut", els.outJson],
      ["sessionPill", els.sessionPill],
      ["sessionText", els.sessionText],
      ["sessionDot", els.sessionDot]
    ];

    const missing = required.filter(([, el]) => !el).map(([name]) => name);
    if (missing.length) {
      console.error("[ArnoldAdmin] Missing required DOM nodes:", missing);
      setMsg(`Fatal: DOM mismatch (missing: ${missing.join(", ")}). Check index.html ids.`, "bad");
      setBadge("Session: error", false);
      return;
    }

    els.btnLogin.addEventListener("click", doLogin);
    els.btnLogout.addEventListener("click", doLogout);
    els.btnSearch.addEventListener("click", doSearch);
    els.btnToggleRaw.addEventListener("click", toggleRaw);

    els.query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    await refreshStatus();
  }

  init();
})();

// 🔴 main.js