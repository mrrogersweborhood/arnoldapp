// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-02-25b — Totals screen + pretty formatting + shipping fallback)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  /* ========= CONFIG ========= */

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const API = {
    login: `${WORKER_BASE}/admin/login`,
    status: `${WORKER_BASE}/admin/status`,
    logout: `${WORKER_BASE}/admin/logout`,
    nlSearch: `${WORKER_BASE}/admin/nl-search`,
    stats: `${WORKER_BASE}/admin/stats`,
  };

  /* ========= DOM ========= */

  // Selector helper:
  // - "loginUser" -> getElementById("loginUser")
  // - "#loginUser" / ".class" / "div > span" -> querySelector(...)
  const $ = (sel) => {
    const s = String(sel || "").trim();
    if (!s) return null;
    const looksLikeCss =
      s.startsWith("#") ||
      s.startsWith(".") ||
      s.includes(" ") ||
      s.includes("[") ||
      s.includes(">") ||
      s.includes(":");
    return looksLikeCss ? document.querySelector(s) : document.getElementById(s);
  };

  const must = (el, name) => {
    if (!el) {
      console.error(`[ArnoldAdmin] Missing required element: ${name}`);
      return false;
    }
    return true;
  };

  const elLoginUser = $("loginUser");
  const elLoginPass = $("loginPass");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  const elQuery = $("q");
  const btnSearch = $("btnSearch");
  const btnTotals = $("btnTotals");

  const statusLine = $("statusLine");
  const results = $("results");

  const sessionText = $("sessionText");
  const sessionPill = $("sessionPill");
  const btnRawJson = $("btnRawJson");

  let lastRaw = null;
  let rawJsonVisible = false;

  const openSubNotes = new Set();
  const openOrderNotes = new Set();

  /* ========= UTILS ========= */

  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  function fmtDate(val) {
    if (!val) return "—";
    const s = String(val);
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return s;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  function fmtMoney(total, currency) {
    if (total == null) return "—";
    const raw = String(total).trim();
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return "—";

    const usd = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

    const cur = currency ? String(currency).trim().toUpperCase() : "";
    if (cur && cur !== "USD") return `${usd} ${cur}`;
    return usd;
  }

  function fmtPhone(val) {
    if (!val) return "—";
    const raw = String(val).trim();
    if (!raw) return "—";

    const extMatch = raw.match(/\b(?:ext\.?|x|#)\s*(\d+)\b/i);
    const ext = extMatch ? extMatch[1] : null;

    let digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);

    if (digits.length === 10) {
      const pretty = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      return ext ? `${pretty} x${ext}` : pretty;
    }

    return raw;
  }

  function normalizeNullableDate(val) {
    if (val == null) return null;
    const s = String(val).trim();
    if (!s) return null;
    if (s === "0000-00-00" || s === "0000-00-00 00:00:00") return null;
    return s;
  }

  function htmlToText(html) {
    const s = String(html ?? "");
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    const t = tmp.textContent || tmp.innerText || "";
    return t.replace(/\s+/g, " ").trim();
  }

  function stripMetaData(obj) {
    const seen = new WeakSet();
    const walk = (x) => {
      if (x == null) return x;
      if (typeof x !== "object") return x;
      if (seen.has(x)) return null;
      seen.add(x);

      if (Array.isArray(x)) return x.map(walk);

      const out = {};
      for (const [k, v] of Object.entries(x)) {
        if (k === "meta_data") continue;
        out[k] = walk(v);
      }
      return out;
    };
    return walk(obj);
  }

  function setStatusLine(text, tone) {
    if (!must(statusLine, "#statusLine")) return;

    const t = String(text ?? "").trim();
    if (!t) {
      statusLine.style.display = "none";
      statusLine.textContent = "";
      statusLine.className = "msg";
      return;
    }

    statusLine.style.display = "block";
    statusLine.textContent = t;

    const cls = ["msg"];
    if (tone === "warn") cls.push("warn");
    if (tone === "busy") cls.push("busy");
    statusLine.className = cls.join(" ");
  }

  function setSessionPill(loggedIn, userLabel) {
    if (!must(sessionText, "#sessionText") || !must(sessionPill, "#sessionPill")) return;

    const label = userLabel ? String(userLabel) : "unknown";
    const dot = sessionPill.querySelector(".dot");

    if (loggedIn) {
      sessionText.textContent = `Session: logged in as ${label}`;
      if (dot) {
        dot.style.background = "#86efac";
        dot.style.boxShadow = "0 0 0 3px rgba(134,239,172,.25)";
      }
    } else {
      sessionText.textContent = "Session: unknown";
      if (dot) {
        dot.style.background = "#fca5a5";
        dot.style.boxShadow = "0 0 0 3px rgba(252,165,165,.20)";
      }
    }
  }

  async function jsonFetch(url, opts) {
    const r = await fetch(url, {
      credentials: "include",
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts && opts.headers ? opts.headers : {})
      }
    });
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { ok: r.ok, status: r.status, data };
  }

  function renderPill(status) {
    const s = String(status ?? "—").toLowerCase();
    return `<span class="pill">${esc(s)}</span>`;
  }

  /* ========= RENDER ========= */

  function renderAddressCard(title, addr, opts) {
    const a = addr || {};
    const o = opts || {};
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();

    const extraPairs = Array.isArray(o.extraPairs) ? o.extraPairs : [];

    // Shipping fallback: if shipping address is missing, show "Same as billing"
    const isShipping = String(title || "").toLowerCase() === "shipping";
    const hasAny = !!(a && (a.address_1 || a.address_2 || a.city || a.state || a.postcode || a.country || a.first_name || a.last_name || a.company));
    if (isShipping && !hasAny) {
      return `
        <div class="card mini">
          <div class="mini-title">${esc(title)}</div>
          <div class="aa-kv">
            <div class="aa-k">Address</div>
            <div class="aa-v">Same as billing</div>
          </div>
        </div>
      `;
    }

    const pairs = [];

    for (const p of extraPairs) {
      if (!p) continue;
      const k = String(p.k || "").trim();
      const v = p.v;
      if (!k) continue;
      pairs.push({ k, v: (v == null || String(v).trim() === "") ? "—" : String(v) });
    }

    if (name) pairs.push({ k: "Name", v: name });

    const lines = [
      a.address_1,
      a.address_2,
      [a.city, a.state, a.postcode].filter(Boolean).join(", "),
      a.country
    ].filter(Boolean);

    pairs.push({
      k: "Address",
      v: lines.length ? `<div class="aa-addr-lines">${lines.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` : "—",
      isHtml: true
    });

    pairs.push({ k: "Email", v: (a.email || "—") });
    pairs.push({ k: "Phone", v: fmtPhone(a.phone) });

    return `
      <div class="card mini">
        <div class="mini-title">${esc(title)}</div>
        <div class="aa-kv">
          ${pairs.map((p) => `
            <div class="aa-k">${esc(p.k)}</div>
            <div class="aa-v">${p.isHtml ? p.v : esc(p.v)}</div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderSubscriber(contextCustomer) {
    const c = contextCustomer || {};
    const first = c?.first_name ?? null;
    const last = c?.last_name ?? null;
    const displayName = [first, last].filter(Boolean).join(" ").trim();

    const customerPairs = [
      { k: "Customer ID", v: (c?.id != null ? String(c.id) : "—") },
      { k: "Username", v: (c?.username ? String(c.username) : "—") },
    ];
    if (displayName) customerPairs.push({ k: "Name", v: displayName });

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
        </div>

        <div class="aa-grid-2">
          <div class="card mini aa-span-all">
            <div class="mini-title">Customer</div>
            <div class="aa-kv">
              ${customerPairs.map((p) => `
                <div class="aa-k">${esc(p.k)}</div>
                <div class="aa-v">${esc(p.v)}</div>
              `).join("")}
            </div>
          </div>

          ${renderAddressCard("Billing", c.billing || {})}
          ${renderAddressCard("Shipping", c.shipping || {})}
        </div>
      </section>
    `;
  }

  function renderNotesList(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return `<div class="aa-note"><div class="aa-note-body">No notes.</div></div>`;

    return arr.slice(0, 200).map((n) => {
      const when = n?.date_created ? fmtDate(n.date_created) : "—";
      const who = n?.author || n?.added_by || "—";
      const body = htmlToText(n?.note || "");
      return `
        <div class="aa-note">
          <div class="aa-note-meta">${esc(when)} • ${esc(who)}</div>
          <div class="aa-note-body">${esc(body)}</div>
        </div>
      `;
    }).join("");
  }

  function renderNotesToggle(kind, id, notes) {
    const arr = Array.isArray(notes) ? notes : [];
    const count = arr.length;

    const isOpen = (kind === "sub")
      ? openSubNotes.has(String(id))
      : openOrderNotes.has(String(id));

    const label = count ? `Notes (${count})` : "Notes";

    return `
      <div class="aa-notes-col">
        <button class="aa-linkbtn"
          data-notes-kind="${esc(kind)}"
          data-notes-id="${esc(String(id ?? ""))}"
          aria-expanded="${isOpen ? "true" : "false"}"
        >${esc(label)}</button>

        ${isOpen ? `<div class="aa-notes-panel">${renderNotesList(arr)}</div>` : ""}
      </div>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriptions</div>
          <div class="aa-section-subtitle">Schedule & Notes</div>
        </div>

        <div class="aa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Status</th>
                <th>Total</th>
                <th>Next Payment</th>
                <th>End</th>
                <th class="aa-notes-col">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${arr.length ? arr.map((s) => {
                const id = s?.id ?? "—";
                const status = s?.status ?? "—";
                const total = fmtMoney(s?.total, s?.currency);
                const nextPay = normalizeNullableDate(s?.next_payment_date) ? fmtDate(s.next_payment_date) : "—";
                const end = normalizeNullableDate(s?.end_date) ? fmtDate(s.end_date) : "Auto-renews";

                return `
                  <tr>
                    <td><b>#${esc(String(id))}</b></td>
                    <td>${renderPill(status)}</td>
                    <td><b>${esc(total)}</b></td>
                    <td>${esc(nextPay)}</td>
                    <td><b>${esc(end)}</b></td>
                    <td class="aa-notes-col">${renderNotesToggle("sub", id, s?.notes)}</td>
                  </tr>
                `;
              }).join("") : `
                <tr><td colspan="6" class="items">No subscriptions.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Orders</div>
          <div class="aa-section-subtitle">Most recent first</div>
        </div>

        <div class="aa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Items</th>
                <th class="aa-notes-col">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${arr.length ? arr.map((o) => {
                const id = o?.id ?? "—";
                const date = o?.date_created ? fmtDate(o.date_created) : "—";
                const status = o?.status ?? "—";
                const total = fmtMoney(o?.total, o?.currency);
                const payment = o?.payment_method_title || o?.payment_method || "—";

                const items = Array.isArray(o?.line_items) ? o.line_items : [];
                const itemText = items.length
                  ? items.map((li) => `${li?.quantity ?? 0} × ${li?.name ?? ""}`.trim()).filter(Boolean).join("<br/>")
                  : "—";

                return `
                  <tr>
                    <td><b>#${esc(String(id))}</b></td>
                    <td>${esc(date)}</td>
                    <td>${renderPill(status)}</td>
                    <td><b>${esc(total)}</b></td>
                    <td>${esc(payment)}</td>
                    <td class="items">${itemText}</td>
                    <td class="aa-notes-col">${renderNotesToggle("order", id, o?.notes)}</td>
                  </tr>
                `;
              }).join("") : `
                <tr><td colspan="7" class="items">No orders.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderRawJson(raw) {
    if (!rawJsonVisible || !raw) return "";
    const safe = stripMetaData(raw);
    return `
      <div class="rawjson-wrap">
        <div class="rawjson-title">Raw JSON</div>
        <pre>${esc(JSON.stringify(safe, null, 2))}</pre>
      </div>
    `;
  }

  function renderAll(context) {
    const ctx = context || {};
    const customer = ctx.customer || null;
    const subs = ctx.subscriptions || [];
    const orders = ctx.orders || [];

    return `
      ${customer ? renderSubscriber(customer) : ""}
      ${renderSubscriptions(subs)}
      ${renderOrders(orders)}
      ${renderRawJson(lastRaw)}
    `;
  }

  function bindNotesToggles() {
    if (!results) return;
    results.querySelectorAll(".aa-linkbtn[data-notes-kind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-notes-kind");
        const id = btn.getAttribute("data-notes-id");
        if (!kind || !id) return;

        const key = String(id);
        if (kind === "sub") {
          if (openSubNotes.has(key)) openSubNotes.delete(key);
          else openSubNotes.add(key);
        } else {
          if (openOrderNotes.has(key)) openOrderNotes.delete(key);
          else openOrderNotes.add(key);
        }

        if (lastRaw?.context) {
          results.innerHTML = renderAll(lastRaw.context);
          bindNotesToggles();
        }
      });
    });
  }

  /* ========= API FLOW ========= */

  async function refreshSession() {
    const r = await jsonFetch(API.status, { method: "GET" });
    const loggedIn = !!(r.ok && r.data && r.data.loggedIn);
    const user = loggedIn ? (r.data.user?.slug || r.data.user?.name || "admin") : null;
    setSessionPill(loggedIn, user);
    return loggedIn;
  }

  async function doLogin() {
    if (!must(elLoginUser, "#loginUser") || !must(elLoginPass, "#loginPass")) return;

    const username = elLoginUser.value.trim();
    const password = elLoginPass.value;

    if (!username || !password) {
      setStatusLine("Username and password required.", "warn");
      return;
    }

    setStatusLine("Logging in…", "busy");
    const r = await jsonFetch(API.login, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!r.ok) {
      setStatusLine(`Login failed (${r.status}).`, "warn");
      await refreshSession();
      return;
    }

    setStatusLine("Logged in.", "");
    await refreshSession();
  }

  async function doLogout() {
    setStatusLine("Logging out…", "busy");
    await jsonFetch(API.logout, { method: "POST", body: "{}" });
    setStatusLine("Logged out.", "");
    await refreshSession();
  }

  async function doSearch() {
    if (!must(elQuery, "#q")) return;

    const q = elQuery.value.trim();
    if (!q) {
      setStatusLine("Enter a search query.", "warn");
      return;
    }

    const ok = await refreshSession();
    if (!ok) {
      setStatusLine("Please login first.", "warn");
      return;
    }

    setStatusLine("Searching…", "busy");
    if (results) results.innerHTML = "";

    const r = await jsonFetch(API.nlSearch, {
      method: "POST",
      body: JSON.stringify({ query: q }),
    });

    if (!r.ok) {
      lastRaw = r.data;
      if (results) {
        results.innerHTML =
          `<div class="card aa-section"><b>Search failed (${r.status}).</b><div style="margin-top:8px;">See Raw JSON for details.</div></div>` +
          renderRawJson(lastRaw);
      }
      setStatusLine("Search failed.", "warn");
      return;
    }

    lastRaw = r.data;
    const context = r.data?.context || null;

    if (!context) {
      if (results) results.innerHTML = `<div class="card aa-section"><b>No context returned.</b></div>${renderRawJson(lastRaw)}`;
      setStatusLine("No results.", "warn");
      return;
    }

    if (results) results.innerHTML = renderAll(context);
    bindNotesToggles();
    setStatusLine("Search complete.", "");
  }

  function renderTotals(data) {
    const d = data || {};
    const subs = d.subscriptions_by_status || {};
    const orders = d.orders_last_30d || {};
    const gen = d.generated_at ? fmtDate(d.generated_at) : "";

    const subRows = Object.entries(subs)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td style="text-align:right;"><b>${esc(String(v))}</b></td></tr>`)
      .join("") || `<tr><td colspan="2">—</td></tr>`;

    const orderRows = Object.entries(orders.by_status || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td style="text-align:right;"><b>${esc(String(v))}</b></td></tr>`)
      .join("") || `<tr><td colspan="2">—</td></tr>`;

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Totals</div>
          <div class="aa-section-subtitle">${esc(gen ? `Generated ${gen}` : "")}</div>
        </div>

        <div class="aa-grid-2">
          <div class="card mini">
            <div class="mini-title">Subscriptions by status</div>
            <div class="aa-table-wrap" style="min-width:unset;">
              <table style="min-width:unset;">
                <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
                <tbody>${subRows}</tbody>
              </table>
            </div>
          </div>

          <div class="card mini">
            <div class="mini-title">Orders (last 30 days)</div>
            <div class="aa-kv" style="margin-bottom:10px;">
              <div class="aa-k">Total</div>
              <div class="aa-v" style="font-size:22px;">${esc(String(orders.total ?? "—"))}</div>
              <div class="aa-k">Failed</div>
              <div class="aa-v">${esc(String(orders.failed ?? "—"))}</div>
              <div class="aa-k">Pending</div>
              <div class="aa-v">${esc(String(orders.pending ?? "—"))}</div>
            </div>

            <div class="aa-table-wrap" style="min-width:unset;">
              <table style="min-width:unset;">
                <thead><tr><th>Status</th><th style="text-align:right;">Count</th></tr></thead>
                <tbody>${orderRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async function doTotals() {
    const ok = await refreshSession();
    if (!ok) {
      setStatusLine("Please login first.", "warn");
      return;
    }

    setStatusLine("Loading totals…", "busy");
    if (results) results.innerHTML = "";

    const r = await jsonFetch(API.stats, { method: "GET" });
    if (!r.ok) {
      lastRaw = r.data;
      if (results) {
        results.innerHTML =
          `<div class="card aa-section"><b>Totals failed (${r.status}).</b><div style="margin-top:8px;">See Raw JSON for details.</div></div>` +
          renderRawJson(lastRaw);
      }
      setStatusLine("Totals failed.", "warn");
      return;
    }

    lastRaw = r.data;
    if (results) results.innerHTML = renderTotals(r.data) + renderRawJson(lastRaw);
    setStatusLine("Totals loaded.", "");
  }

  function toggleRawJson() {
    rawJsonVisible = !rawJsonVisible;
    if (lastRaw?.context) {
      results.innerHTML = renderAll(lastRaw.context);
      bindNotesToggles();
    } else {
      results.innerHTML = renderRawJson(lastRaw);
    }
  }

  function init() {
    if (btnLogin) btnLogin.addEventListener("click", doLogin);
    if (btnLogout) btnLogout.addEventListener("click", doLogout);
    if (btnSearch) btnSearch.addEventListener("click", doSearch);
    if (btnTotals) btnTotals.addEventListener("click", doTotals);

    if (elQuery) {
      elQuery.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }

    if (btnRawJson) btnRawJson.addEventListener("click", toggleRawJson);

    refreshSession().catch(() => setSessionPill(false, null));
  }

  init();
})();
// 🔴 main.js