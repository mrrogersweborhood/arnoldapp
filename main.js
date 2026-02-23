// 🟢 main.js
// Arnold Admin UI — FULL REPLACEMENT (v2026-02-23b)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)

(() => {
  const $ = (sel) => document.querySelector(sel);

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    loginUser: $("#loginUser"),
    loginPass: $("#loginPass"),
    loginBtn: $("#loginBtn"),
    logoutBtn: $("#logoutBtn"),
    sessionPill: $("#sessionPill"),
    sessionText: $("#sessionText"),

    query: $("#query"),
    searchBtn: $("#searchBtn"),
    intentBadge: $("#intentBadge"),

    outCustomer: $("#outCustomer"),
    outSubs: $("#outSubs"),
    outOrders: $("#outOrders"),
    outRaw: $("#outRaw"),
    toggleRawBtn: $("#toggleRawBtn")
  };

  let rawVisible = false;

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function titleCaseLabel(s) {
    const t = String(s ?? "").trim();
    if (!t) return "";
    // keep short known acronyms and symbols
    return t.replace(/\b[a-z]/g, (m) => m.toUpperCase());
  }

  function fmtMoney(total, currency) {
    const n = Number(String(total ?? "").replace(/[^0-9.\-]/g, ""));
    if (!isFinite(n)) return "—";
    // OkObserver store is USD; display as $0.00
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
    } catch (_) {
      return "$" + n.toFixed(2);
    }
  }

  function parseLooseDate(s) {
    if (!s) return null;
    const str = String(s);
    // if it's already YYYY-MM-DD, keep it
    const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtDate(s) {
    const d = parseLooseDate(s);
    if (!d) return "—";
    // display as MM/DD/YYYY
    const [yyyy, mm, dd] = d.split("-");
    return `${mm}/${dd}/${yyyy}`;
  }

  function badge(text, kind = "neutral") {
    return `<span class="badge badge-${esc(kind)}">${esc(text)}</span>`;
  }

  function setIntent(text) {
    els.intentBadge.textContent = text ? `Intent: ${text}` : "";
  }

  async function api(path, init) {
    const url = `${WORKER_BASE}${path}`;
    const resp = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.headers || {}),
        "Content-Type": "application/json"
      }
    });
    const txt = await resp.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch (_) {
      data = txt;
    }
    if (!resp.ok) {
      const msg =
        (data && typeof data === "object" && (data.message || data.error)) ||
        `Request failed: ${resp.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function refreshSession() {
    try {
      const s = await api("/admin/status", { method: "GET" });
      const loggedIn = !!s?.loggedIn;
      if (loggedIn) {
        els.sessionPill.classList.add("on");
        els.sessionText.textContent = "Session: logged in";
      } else {
        els.sessionPill.classList.remove("on");
        els.sessionText.textContent = "Session: logged out";
      }
      return loggedIn;
    } catch (_) {
      els.sessionPill.classList.remove("on");
      els.sessionText.textContent = "Session: unknown";
      return false;
    }
  }

  function renderCustomer(c) {
    if (!c) return `<div class="muted">No customer found.</div>`;

    const fullName = [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();
    const displayName = fullName || c?.name || "—";

    const usernameVal =
      (c?.username && String(c.username).trim()) ? String(c.username).trim() : "—";

    const fields = [
      { k: "Customer ID", val: (c?.id ?? "—") },
      { k: "Username", val: usernameVal }
    ];

    const billing = c?.billing || {};
    const shipping = c?.shipping || {};

    function addrLines(a) {
      if (!a) return [];
      const lines = [];
      const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
      if (name) lines.push(name);
      if (a.address_1) lines.push(a.address_1);
      if (a.address_2) lines.push(a.address_2);
      const cityState = [a.city, a.state].filter(Boolean).join(" • ");
      const zip = a.postcode ? String(a.postcode) : "";
      const country = a.country ? String(a.country) : "";
      const tail = [cityState, zip, country].filter(Boolean).join(" • ");
      if (tail) lines.push(tail);
      return lines;
    }

    const billingLines = addrLines(billing);
    const shippingLines = addrLines(shipping);

    const billingEmail = billing?.email || c?.email || null;
    const billingPhone = billing?.phone || null;

    return `
      <div class="cards3">
        <div class="card">
          <div class="cardHd">
            <h3>Identity</h3>
            <div class="cardHint">Customer</div>
          </div>
          <div class="kv">
            ${fields
              .map(
                (f) => `
              <div class="row">
                <div class="k">${esc(f.k)}</div>
                <div class="v">${esc(f.val)}</div>
              </div>`
              )
              .join("")}
          </div>
        </div>

        <div class="card">
          <div class="cardHd">
            <h3>Billing</h3>
            <div class="cardHint">${esc(displayName)}</div>
          </div>
          <div class="kv">
            <div class="row">
              <div class="k">Name</div>
              <div class="v">${esc(displayName)}</div>
            </div>
            <div class="row">
              <div class="k">Address</div>
              <div class="v">${billingLines.map((x) => `<div>${esc(x)}</div>`).join("") || "—"}</div>
            </div>
            <div class="row">
              <div class="k">Email</div>
              <div class="v">${billingEmail ? esc(billingEmail) : "—"}</div>
            </div>
            <div class="row">
              <div class="k">Phone</div>
              <div class="v">${billingPhone ? esc(billingPhone) : "—"}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="cardHd">
            <h3>Shipping</h3>
            <div class="cardHint">${esc(shipping?.first_name || shipping?.last_name ? [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") : (shippingLines[0] || "—"))}</div>
          </div>
          <div class="kv">
            <div class="row">
              <div class="k">Name</div>
              <div class="v">${esc([shipping?.first_name, shipping?.last_name].filter(Boolean).join(" ").trim() || "—")}</div>
            </div>
            <div class="row">
              <div class="k">Address</div>
              <div class="v">${shippingLines.map((x) => `<div>${esc(x)}</div>`).join("") || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) return `<div class="muted">No subscriptions.</div>`;

    const rows = arr
      .map((s) => {
        const status = s?.status || "—";
        const statusKind =
          status === "active" ? "ok" : status === "cancelled" ? "bad" : "neutral";

        const total = fmtMoney(s?.total, s?.currency);
        const nextPay = fmtDate(s?.next_payment_date);
        const end =
          s?.end_date ? fmtDate(s.end_date) : "Auto-renews";

        const notes = Array.isArray(s?.notes) ? s.notes : [];
        const notesHtml = notes.length
          ? `<div class="oo-notesWrap">
              ${notes
                .slice(0, 50)
                .map((n) => {
                  const when = fmtDate(n?.date_created);
                  const author = n?.author || n?.added_by || "WooCommerce";
                  const body = n?.note || "";
                  return `
                    <div class="oo-note">
                      <div class="oo-noteTop">
                        <div class="oo-noteMeta">${esc(when)} • ${esc(author)}</div>
                      </div>
                      <div class="oo-noteBody">${esc(body)}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : "";

        return `
          <tr>
            <td><strong>#${esc(s?.id)}</strong> ${badge(status, statusKind)}</td>
            <td>${esc(total)}</td>
            <td>${esc(nextPay)}</td>
            <td>${esc(end)}</td>
            <td>${notesHtml}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="card">
        <div class="cardHd">
          <h3>Subscriptions</h3>
          <div class="cardHint">Contract + schedule</div>
        </div>
        <div class="tableWrap">
          <table class="table">
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Total</th>
                <th>Next Payment</th>
                <th>End</th>
                <th class="right">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) return `<div class="muted">No orders.</div>`;

    const rows = arr
      .map((o) => {
        const status = o?.status || "—";
        const statusKind =
          status === "completed" ? "ok" : status === "failed" ? "bad" : "neutral";

        const total = fmtMoney(o?.total, o?.currency);
        const pay = o?.payment_method_title || o?.payment_method || "—";
        const date = fmtDate(o?.date_created);

        const items = Array.isArray(o?.line_items) ? o.line_items : [];
        const itemsText = items.length
          ? items
              .slice(0, 10)
              .map((li) => `${li?.quantity ?? 0} × ${li?.name ?? ""}`.trim())
              .filter(Boolean)
              .join(" • ")
          : "—";

        return `
          <tr>
            <td><strong>#${esc(o?.id)}</strong></td>
            <td>${esc(date)}</td>
            <td>${badge(status, statusKind)}</td>
            <td>${esc(total)}</td>
            <td>${esc(pay)}</td>
            <td>${esc(itemsText)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="card">
        <div class="cardHd">
          <h3>Orders</h3>
          <div class="cardHint">Most recent first</div>
        </div>
        <div class="tableWrap">
          <table class="table">
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
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function showRaw(obj) {
    els.outRaw.textContent =
      obj && typeof obj === "object" ? JSON.stringify(obj, null, 2) : String(obj ?? "");
  }

  function setOutputs(payload) {
    const ctx = payload?.context || null;
    const customer = ctx?.customer || null;
    const subs = ctx?.subscriptions || [];
    const orders = ctx?.orders || [];

    els.outCustomer.innerHTML = renderCustomer(customer);
    els.outSubs.innerHTML = renderSubscriptions(subs);
    els.outOrders.innerHTML = renderOrders(orders);

    showRaw(payload);
  }

  async function doLogin() {
    const username = String(els.loginUser.value || "").trim();
    const password = String(els.loginPass.value || "").trim();
    if (!username || !password) {
      alert("Enter username and password.");
      return;
    }
    await api("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    await refreshSession();
  }

  async function doLogout() {
    await api("/admin/logout", { method: "POST", body: JSON.stringify({}) });
    await refreshSession();
  }

  async function doSearch() {
    const q = String(els.query.value || "").trim();
    if (!q) return;

    const payload = await api("/admin/nl-search", {
      method: "POST",
      body: JSON.stringify({ query: q })
    });

    setIntent(payload?.intent || "");
    setOutputs(payload);
  }

  function toggleRaw() {
    rawVisible = !rawVisible;
    els.outRaw.parentElement.classList.toggle("hidden", !rawVisible);
    els.toggleRawBtn.textContent = rawVisible ? "Hide Raw" : "Toggle Raw";
  }

  // Wiring
  els.loginBtn.addEventListener("click", () => doLogin().catch((e) => alert(e.message)));
  els.logoutBtn.addEventListener("click", () => doLogout().catch((e) => alert(e.message)));
  els.searchBtn.addEventListener("click", () => doSearch().catch((e) => alert(e.message)));
  els.toggleRawBtn.addEventListener("click", toggleRaw);

  // Enter-to-submit
  els.loginPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin().catch((err) => alert(err.message));
  });
  els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch().catch((err) => alert(err.message));
  });

  refreshSession();
})();

// 🔴 main.js