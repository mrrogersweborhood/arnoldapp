// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (UI stabilization pass 2026-02-24f: subscriber ID+Username 2-col row, orders notes column rightmost + collapsible like subs)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  const API_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    wpUser: document.getElementById("wpUser"),
    wpPass: document.getElementById("wpPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),
    loginStatus: document.getElementById("loginStatus"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    searchStatus: document.getElementById("searchStatus"),

    sessionDot: document.getElementById("sessionDot"),
    sessionText: document.getElementById("sessionText"),

    msg: document.getElementById("msg"),
    results: document.getElementById("results")
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMsg(text, isErr = false) {
    els.msg.textContent = text || "";
    els.msg.style.display = text ? "block" : "none";
    els.msg.classList.toggle("err", !!isErr);
  }

  function setLoginStatus(text) {
    els.loginStatus.textContent = text;
  }

  function setSearchStatus(text) {
    els.searchStatus.textContent = text;
  }

  function setBadge(text, ok) {
    els.sessionText.textContent = text;
    els.sessionDot.classList.toggle("ok", !!ok);
    els.sessionDot.classList.toggle("no", !ok);
  }

  function fmtDate(d) {
    const s = String(d || "").trim();
    if (!s) return "";
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return s;
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function fmtMoney(amount, currency) {
    const n = Number(amount || 0);
    const cur = String(currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);
    } catch (_) {
      return `$${n.toFixed(2)}`;
    }
  }

  async function api(path, init = {}) {
    const url = `${API_BASE}${path}`;
    return fetch(url, { ...init, credentials: "include" });
  }

  async function apiJson(path, init = {}) {
    const resp = await api(path, init);
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
    return { resp, data, url: `${API_BASE}${path}` };
  }

  function pickEmail(contextCustomer, c, subs, orders) {
    const a = contextCustomer?.email || c?.email;
    if (a) return a;

    const sEmail = subs?.[0]?.billing?.email || subs?.[0]?.shipping?.email;
    if (sEmail) return sEmail;

    const oEmail = orders?.[0]?.billing?.email || orders?.[0]?.shipping?.email;
    return oEmail || null;
  }

  function pickName(contextCustomer, c) {
    const fn = contextCustomer?.first_name ?? c?.first_name ?? "";
    const ln = contextCustomer?.last_name ?? c?.last_name ?? "";
    const nm = `${fn} ${ln}`.trim();
    return nm || null;
  }

  function renderAddressCard(title, a, fallbackEmail) {
    const addr = a || {};
    const emailLine = addr.email || fallbackEmail || "";
    const phoneLine = addr.phone || "";

    // Name goes above address (as requested)
    const nameLine = `${addr.first_name || ""} ${addr.last_name || ""}`.trim();

    const lines = [
      addr.company || "",
      addr.address_1 || "",
      addr.address_2 || "",
      addr.city || "",
      addr.state || "",
      addr.postcode || "",
      addr.country || ""
    ].filter(Boolean);

    return `
      <div class="addr">
        <div class="ttl">${esc(title)}</div>
        ${nameLine ? `<div class="addr-name">${esc(nameLine)}</div>` : ""}
        <div class="kv">
          <div class="aa-k">Address</div>
          <div class="aa-v">${lines.length ? esc(lines.join(", ")) : "—"}</div>

          <div class="aa-k">Email</div>
          <div class="aa-v">${emailLine ? esc(emailLine) : "—"}</div>

          <div class="aa-k">Phone</div>
          <div class="aa-v">${phoneLine ? esc(phoneLine) : "—"}</div>
        </div>
      </div>
    `;
  }

  function renderSubscriber(contextCustomer, customer, subs, orders) {
    const c = contextCustomer || customer || null;
    const customerId = c?.id ?? null;
    const username = c?.username ?? null;

    const displayName = pickName(contextCustomer, customer);

    const fallbackEmail = pickEmail(contextCustomer, customer, subs, orders);
    const billing = c?.billing || subs?.[0]?.billing || orders?.[0]?.billing || null;
    const shipping = c?.shipping || subs?.[0]?.shipping || orders?.[0]?.shipping || null;

    return `
      <section class="card">
        <div class="card-hd">
          <div class="card-title">Subscriber</div>
          <div class="card-sub">${displayName ? esc(displayName) : "Identity"}</div>
        </div>
        <div class="card-bd">
          <!-- Customer ID + Username in one row (2 columns) -->
          <div class="identity-grid">
            <div class="identity-item">
              <span class="aa-k">Customer ID</span>
              <span class="aa-v">${customerId ? esc(customerId) : "—"}</span>
            </div>
            <div class="identity-item">
              <span class="aa-k">Username</span>
              <span class="aa-v">${username ? esc(username) : "—"}</span>
            </div>
          </div>

          <div class="cols">
            ${renderAddressCard("Billing", billing, fallbackEmail)}
            ${renderAddressCard("Shipping", shipping, fallbackEmail)}
          </div>
        </div>
      </section>
    `;
  }

  function renderNotesBlock(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return "";
    return `
      <div class="aa-notes-wrap">
        <div class="aa-notes-col">
          ${arr.slice(0, 50).map(n => `
            <div class="aa-note-card">
              <div class="aa-note-meta">${esc(fmtDate(n?.date_created || ""))}${n?.author ? ` • ${esc(n.author)}` : ""}</div>
              <div class="aa-note-text">${esc(n?.note || "")}</div>
            </div>
          `).join("")}
        </div>
      </div>
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
      const end = s?.end_date ? esc(fmtDate(s.end_date)) : "Auto-renews";

      const notes = Array.isArray(s?.notes) ? s.notes : [];
      const sid = String(s?.id ?? "").trim();
      const notesRowId = sid ? `aaSubNotesRow-${sid}` : "";

      const notesToggle = notes.length
        ? `<button type="button" class="aa-linkbtn" aria-expanded="false" data-aa-toggle="row" data-aa-target="${esc(notesRowId)}">Notes (${notes.length})</button>`
        : "—";

      const notesRow = (notes.length && notesRowId)
        ? `
        <tr id="${esc(notesRowId)}" class="aa-sub-notes-row" style="display:none;">
          <td colspan="5">${renderNotesBlock(notes)}</td>
        </tr>
        `
        : "";

      return `
        <tr>
          <td>
            <span class="aa-mono">#${id}</span> <span class="aa-badge">${status}</span>
          </td>
          <td>${total}</td>
          <td>${nextPay}</td>
          <td>${end}</td>
          <td>${notesToggle}</td>
        </tr>
        ${notesRow}
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
                  <th>Notes</th>
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

      // Order notes: same behavior as subscription notes (right-most column + collapsible row)
      const notes = Array.isArray(o?.notes) ? o.notes : [];
      const oid = String(o?.id ?? "").trim();
      const notesRowId = oid ? `aaOrderNotesRow-${oid}` : "";

      const notesToggle = notes.length
        ? `<button type="button" class="aa-linkbtn" aria-expanded="false" data-aa-toggle="row" data-aa-target="${esc(notesRowId)}">Notes (${notes.length})</button>`
        : "—";

      const notesRow = (notes.length && notesRowId)
        ? `
        <tr id="${esc(notesRowId)}" class="aa-sub-notes-row" style="display:none;">
          <td colspan="7">${renderNotesBlock(notes)}</td>
        </tr>
        `
        : "";

      return `
        <tr>
          <td class="aa-mono">#${id}</td>
          <td>${date}</td>
          <td><span class="aa-badge">${status}</span></td>
          <td>${total}</td>
          <td>${payment}</td>
          <td class="aa-items">${items}</td>
          <td>${notesToggle}</td>
        </tr>
        ${notesRow}
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
                  <th>Notes</th>
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
      ${renderSubscriber(c, c, subs, orders)}
      ${renderSubscriptions(subs)}
      ${renderOrders(orders)}
      <div class="aa-raw-toggle-row">
        <button class="btn secondary" id="btnRaw">Toggle Raw JSON</button>
      </div>
      <div id="rawWrap" style="display:none;">
        <section class="card" style="margin-top:12px;">
          <div class="card-hd">
            <div class="card-title">Raw JSON</div>
            <div class="card-sub">Debug</div>
          </div>
          <div class="card-bd">
            <pre id="rawJson" style="margin:0; white-space:pre-wrap; font-size:13px;"></pre>
          </div>
        </section>
      </div>
    `;
  }

  function toggleRaw(show) {
    const rawWrap = document.getElementById("rawWrap");
    if (!rawWrap) return;
    rawWrap.style.display = show ? "" : "none";
  }

  async function refreshStatus() {
    try {
      const { resp, data, url } = await apiJson("/admin/status", { method: "GET" });
      console.log("[status]", url, resp.status, data);

      const loggedIn = !!data?.loggedIn;
      if (loggedIn) {
        setBadge("Session: logged in", true);
        setLoginStatus("Logged in.");
        document.getElementById("btnLogout").disabled = false;
      } else {
        setBadge("Session: logged out", false);
        setLoginStatus("Not logged in.");
        document.getElementById("btnLogout").disabled = true;
      }
      return loggedIn;
    } catch (err) {
      console.log("[status] error", err?.message || err);
      setBadge("Session: error", false);
      setLoginStatus("Status check failed.");
      return false;
    }
  }

  async function doLogin() {
    showMsg("", false);
    setLoginStatus("Logging in…");

    const username = String(els.wpUser.value || "").trim();
    const password = String(els.wpPass.value || "").trim();

    if (!username || !password) {
      showMsg("Username and password required.", true);
      setLoginStatus("Missing credentials.");
      return;
    }

    els.btnLogin.disabled = true;

    try {
      const { resp, data, url } = await apiJson("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      console.log("[login]", url, resp.status, data);

      if (!resp.ok) {
        showMsg(`Login failed (${resp.status}). ${data?.message || data?.error || "See console."}`, true);
        setLoginStatus("Login failed.");
        return;
      }

      showMsg("Login successful.", false);
      setLoginStatus("Logged in.");
      await refreshStatus();
    } catch (err) {
      console.log("[login] error", err?.message || err);
      showMsg("Login failed. See console for details.", true);
      setLoginStatus("Login failed.");
    } finally {
      els.btnLogin.disabled = false;
    }
  }

  async function doLogout() {
    showMsg("", false);
    setLoginStatus("Logging out…");

    els.btnLogout.disabled = true;

    try {
      const { resp, data, url } = await apiJson("/admin/logout", { method: "POST" });
      console.log("[logout]", url, resp.status, data);

      if (!resp.ok) {
        showMsg(`Logout failed (${resp.status}). See console.`, true);
        setLoginStatus("Logout failed.");
        await refreshStatus();
        return;
      }

      showMsg("Logged out.", false);
      setLoginStatus("Not logged in.");
      await refreshStatus();
      els.results.innerHTML = "";
    } catch (err) {
      console.log("[logout] error", err?.message || err);
      showMsg("Logout failed. See console.", true);
      setLoginStatus("Logout failed.");
      await refreshStatus();
    }
  }

  async function doSearch() {
    showMsg("", false);
    setSearchStatus("Searching…");

    const q = String(els.query.value || "").trim();
    if (!q) {
      showMsg("Enter a query.", true);
      setSearchStatus("Missing query.");
      return;
    }

    els.btnSearch.disabled = true;

    try {
      const { resp, data, url } = await apiJson("/admin/nl-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q })
      });

      console.log("[search]", url, resp.status, data);

      if (!resp.ok) {
        showMsg(`Search failed (${resp.status}). ${data?.error || data?.message || "See console."}`, true);
        setSearchStatus("Search failed.");
        return;
      }

      const ctx = data?.context || null;
      if (!ctx) {
        showMsg("Search succeeded but returned no context payload. See console.", true);
        setSearchStatus("No context.");
        return;
      }

      els.results.innerHTML = renderAll(ctx);

      const btnRaw = document.getElementById("btnRaw");
      const rawJson = document.getElementById("rawJson");
      const rawWrap = document.getElementById("rawWrap");
      if (rawJson) rawJson.textContent = JSON.stringify(data, null, 2);
      if (rawWrap) rawWrap.style.display = "none";
      if (btnRaw) {
        btnRaw.addEventListener("click", () => {
          const show = rawWrap && rawWrap.style.display === "none";
          toggleRaw(show);
        });
      }

      showMsg("Search complete.", false);
      setSearchStatus("Done.");
    } catch (err) {
      console.log("[search] error", err?.message || err);
      showMsg("Search failed. See console for details.", true);
      setSearchStatus("Search failed.");
    } finally {
      els.btnSearch.disabled = false;
    }
  }

  els.btnLogin.addEventListener("click", doLogin);
  els.btnLogout.addEventListener("click", doLogout);
  els.btnSearch.addEventListener("click", doSearch);

  // Collapsible notes toggles (delegated)
  els.results.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-aa-toggle='row']");
    if (!btn) return;

    const targetId = btn.getAttribute("data-aa-target") || "";
    if (!targetId) return;

    const row = document.getElementById(targetId);
    if (!row) return;

    const showing = row.style.display !== "none";
    const willShow = !showing;

    row.style.display = willShow ? "" : "none";
    btn.setAttribute("aria-expanded", willShow ? "true" : "false");
  });

  els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  toggleRaw(false);
  refreshStatus().catch(() => setBadge("Session: error", false));
})();

// 🔴 main.js