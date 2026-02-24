// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (UI stabilization pass 2026-02-23)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  /* ========= CONFIG ========= */

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const API = {
    login: `${WORKER_BASE}/admin/login`,
    status: `${WORKER_BASE}/admin/status`,
    logout: `${WORKER_BASE}/admin/logout`,
    search: `${WORKER_BASE}/admin/nl-search`
  };

  /* ========= DOM ========= */

  const els = {
    wpUser: document.getElementById("wpUser"),
    wpPass: document.getElementById("wpPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    loginStatus: document.getElementById("loginStatus"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    searchStatus: document.getElementById("searchStatus"),

    sessionPill: document.getElementById("sessionPill"),
    sessionDot: document.getElementById("sessionDot"),
    sessionText: document.getElementById("sessionText"),

    results: document.getElementById("results"),

    btnRaw: document.getElementById("btnRaw"),
    rawWrap: document.getElementById("rawWrap"),
    rawJson: document.getElementById("rawJson")
  };

  /* ========= UTIL ========= */

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtDate = (iso) => {
    if (!iso) return "";
    const s = String(iso);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      // If server gave "YYYY-MM-DD", pass it through.
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
    }
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  };

  const fmtMoney = (total, currency) => {
    const n = Number(total);
    const val = Number.isFinite(n) ? n : 0;
    const sym = currency && String(currency).toUpperCase() === "USD" ? "$" : "$";
    return `${sym}${val.toFixed(2)}`;
  };

  // For Raw JSON panel: remove Woo meta_data blocks (can be large and noisy).
  function sanitizeForRaw(obj) {
    try {
      return JSON.parse(JSON.stringify(obj ?? null, (k, v) => (k === "meta_data" ? undefined : v)));
    } catch (_) {
      return obj ?? null;
    }
  }

  const fmtPhone = (s) => String(s ?? "").trim();

  function setStatus(el, msg, cls) {
    if (!el) return;
    el.className = `statusline ${cls || ""}`.trim();
    el.textContent = msg || "";
  }

  function setBadge(text, ok) {
    if (!els.sessionText || !els.sessionDot) return;
    els.sessionText.textContent = text || "";
    els.sessionDot.classList.toggle("ok", !!ok);
  }

  async function fetchJson(url, opts) {
    const r = await fetch(url, {
      method: opts?.method || "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(opts?.headers || {})
      },
      body: opts?.body
    });

    const txt = await r.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch (_) {
      data = txt;
    }
    return { ok: r.ok, status: r.status, data };
  }

  function toggleRaw(show) {
    els.rawWrap.style.display = show ? "" : "none";
  }

  function pickEmail(c) {
    // We do NOT render email in Subscriber card per your spec,
    // but it’s still useful as a fallback for billing/shipping blocks.
    return c?.billing?.email || c?.email || null;
  }

  /* ========= RENDER ========= */

  function renderAddressCard(title, a, fallbackEmail) {
    const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—";
    const lines = [
      a?.company,
      a?.address_1,
      a?.address_2,
      [a?.city, a?.state, a?.postcode].filter(Boolean).join(" ").trim(),
      a?.country
    ].filter(Boolean);

    const emailLine = a?.email || fallbackEmail || null;
    const phoneLine = a?.phone ? fmtPhone(a.phone) : "";

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">${esc(title)}</div>
          <div class="card-sub">Address</div>
        </div>
        <div class="card-bd">
          <div class="aa-kv">
            <div class="aa-k">Name</div>
            <div class="aa-v">${esc(name)}</div>

            <div class="aa-k">Address</div>
            <div class="aa-v">${lines.length ? lines.map(esc).join("<br>") : "—"}</div>

            <div class="aa-k">Email</div>
            <div class="aa-v">${emailLine ? esc(emailLine) : "—"}</div>

            <div class="aa-k">Phone</div>
            <div class="aa-v">${phoneLine ? esc(phoneLine) : "—"}</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderSubscriber(c) {
    if (!c) {
      return `
        <section class="card">
          <div class="card-hd">
            <div class="card-title">Subscriber</div>
            <div class="card-sub">Not found</div>
          </div>
          <div class="card-bd">No subscriber found.</div>
        </section>
      `;
    }

    const id = c?.id ?? "—";
    const username = c?.username ?? "—";

    const displayName =
      [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() ||
      c?.billing?.first_name ||
      "—";

    const fallbackEmail = pickEmail(c);

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Subscriber</div>
          <div class="card-sub">${esc(displayName)}</div>
        </div>
        <div class="card-bd">
          <div class="aa-identity-row" style="margin-bottom:12px;">
            <div><span class="aa-pill-k">Customer ID</span><span class="aa-pill-v">${esc(id)}</span></div>
            <div><span class="aa-pill-k">Username</span><span class="aa-pill-v">${esc(username)}</span></div>
          </div>

          <div class="aa-grid-2">
            ${renderAddressCard("Billing", c?.billing || null, fallbackEmail)}
            ${renderAddressCard("Shipping", c?.shipping || null, fallbackEmail)}
          </div>
        </div>
      </section>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) {
      return `
        <section class="card">
          <div class="card-hd">
            <div class="card-title">Subscriptions</div>
            <div class="card-sub">None</div>
          </div>
          <div class="card-bd">No subscriptions found.</div>
        </section>
      `;
    }

    const rowHtml = (s) => {
      const id = esc(s?.id ?? "—");
      const status = esc(s?.status ?? "—");
      const total = fmtMoney(s?.total, s?.currency);
      const nextPay = s?.next_payment_date ? esc(fmtDate(s.next_payment_date)) : "—";

      // Don’t invent values. If end_date is empty, show em dash.
      const end = s?.end_date ? esc(fmtDate(s.end_date)) : "—";

      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const notesHtml = notes.length
        ? `
          <div class="aa-notes-wrap">
            <div class="aa-notes-col">
              ${notes.slice(0, 50).map(n => `
                <div class="aa-note-card">
                  <div class="aa-note-meta">${esc(fmtDate(n?.date_created || ""))}${n?.author ? ` • ${esc(n.author)}` : ""}</div>
                  <div class="aa-note-text">${esc(n?.note || "")}</div>
                </div>
              `).join("")}
            </div>
          </div>
        `
        : "";

      return `
        <tr>
          <td><span class="aa-mono">#${id}</span> <span class="aa-badge">${status}</span></td>
          <td>${total}</td>
          <td>${nextPay}</td>
          <td>${end}</td>
        </tr>
        <tr class="aa-sub-notes-row">
          <td colspan="4">${notesHtml}</td>
        </tr>
      `;
    };

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Subscriptions</div>
          <div class="card-sub">Schedule &amp; Notes</div>
        </div>
        <div class="card-bd">
          <div class="aa-table-wrap">
            <table class="aa-table">
              <thead>
                <tr>
                  <th>Subscription</th>
                  <th>Total</th>
                  <th>Next Payment</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                ${arr.map(rowHtml).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) {
      return `
        <section class="card">
          <div class="card-hd">
            <div class="card-title">Orders</div>
            <div class="card-sub">None</div>
          </div>
          <div class="card-bd">No orders found.</div>
        </section>
      `;
    }

    const itemsSummary = (o) => {
      const items = Array.isArray(o?.line_items) ? o.line_items : [];
      if (!items.length) return "—";
      const parts = items.slice(0, 6).map(li => {
        const q = Number(li?.quantity || 0) || 0;
        const nm = String(li?.name || "").trim();
        if (!nm) return "";
        return `${q} × ${nm}`;
      }).filter(Boolean);
      const more = items.length > 6 ? ` (+${items.length - 6} more)` : "";
      return esc(parts.join(" • ") + more);
    };

    const rowHtml = (o) => {
      const id = esc(o?.id ?? "—");
      const status = esc(o?.status ?? "—");
      const total = fmtMoney(o?.total, o?.currency);
      const date = o?.date_created ? esc(fmtDate(o.date_created)) : "—";
      const payment = esc(o?.payment_method_title || o?.payment_method || "—");
      const items = itemsSummary(o);

      return `
        <tr>
          <td class="aa-mono">#${id}</td>
          <td>${date}</td>
          <td><span class="aa-badge">${status}</span></td>
          <td>${total}</td>
          <td>${payment}</td>
          <td class="aa-items">${items}</td>
        </tr>
      `;
    };

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Orders</div>
          <div class="card-sub">Most recent first</div>
        </div>
        <div class="card-bd">
          <div class="aa-table-wrap">
            <table class="aa-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                ${arr.map(rowHtml).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderAll(context) {
    const c = context?.customer || null;
    const subs = context?.subscriptions || [];
    const orders = context?.orders || [];

    return `
      ${renderSubscriber(c)}
      <div style="height:14px;"></div>
      ${renderSubscriptions(subs)}
      <div style="height:14px;"></div>
      ${renderOrders(orders)}
    `;
  }

  /* ========= ACTIONS ========= */

  async function refreshStatus() {
    const { ok, data } = await fetchJson(API.status, { method: "GET" });
    if (ok && data && data.loggedIn) {
      setBadge("Session: logged in", true);
      setStatus(els.loginStatus, "Logged in (cookie session active).", "ok");
      return true;
    }
    setBadge("Session: logged out", false);
    setStatus(els.loginStatus, "Logged out.", "");
    return false;
  }

  async function doLogin() {
    const username = String(els.wpUser.value || "").trim();
    const password = String(els.wpPass.value || "").trim();
    if (!username || !password) {
      setStatus(els.loginStatus, "Username + password required.", "err");
      return;
    }

    els.btnLogin.disabled = true;
    try {
      setStatus(els.loginStatus, "Logging in…", "");
      const { ok, status, data } = await fetchJson(API.login, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      if (!ok) {
        setStatus(els.loginStatus, `Login failed (${status}). ${data?.message || ""}`, "err");
        await refreshStatus();
        return;
      }

      setStatus(els.loginStatus, "Login successful.", "ok");
      await refreshStatus();
    } catch (e) {
      setStatus(els.loginStatus, `Login error: ${e?.message || e}`, "err");
      await refreshStatus();
    } finally {
      els.btnLogin.disabled = false;
    }
  }

  async function doLogout() {
    els.btnLogout.disabled = true;
    try {
      await fetchJson(API.logout, { method: "POST" });
    } catch (_) {}
    await refreshStatus();
    els.btnLogout.disabled = false;
  }

  async function doSearch() {
    const q = String(els.query.value || "").trim();
    if (!q) {
      setStatus(els.searchStatus, "Enter a search (email, order #12345, etc.).", "err");
      return;
    }

    els.btnSearch.disabled = true;
    try {
      setStatus(els.searchStatus, "Searching…", "");
      const { ok, status, data } = await fetchJson(API.search, {
        method: "POST",
        body: JSON.stringify({ query: q })
      });

      // Raw JSON panel: remove meta_data blocks per spec.
      els.rawJson.textContent = JSON.stringify(sanitizeForRaw(data), null, 2);

      if (!ok) {
        setStatus(els.searchStatus, `Search failed (${status}).`, "err");
        els.results.innerHTML = `
          <section class="card">
            <div class="card-hd"><div class="card-title">Error</div><div class="card-sub">Search</div></div>
            <div class="card-bd">${esc(JSON.stringify(data))}</div>
          </section>
        `;
        return;
      }

      const ctx = data?.context || null;
      els.results.innerHTML = ctx
        ? renderAll(ctx)
        : `
          <section class="card">
            <div class="card-hd"><div class="card-title">Results</div><div class="card-sub">Empty</div></div>
            <div class="card-bd">No context returned.</div>
          </section>
        `;
      setStatus(els.searchStatus, "Search complete.", "ok");
    } catch (e) {
      setStatus(els.searchStatus, `Search error: ${e?.message || e}`, "err");
    } finally {
      els.btnSearch.disabled = false;
    }
  }

  /* ========= WIRE UP ========= */

  els.btnLogin.addEventListener("click", doLogin);
  els.btnLogout.addEventListener("click", doLogout);
  els.btnSearch.addEventListener("click", doSearch);

  els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  els.btnRaw.addEventListener("click", () => {
    const show = els.rawWrap.style.display === "none";
    toggleRaw(show);
  });

  // Init
  toggleRaw(false);
  refreshStatus().catch(() => {
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js