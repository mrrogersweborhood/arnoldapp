// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-23b)
// Markers are comments only: 🟢 main.js ... 🔴 main.js

(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    loginUser: document.getElementById("loginUser"),
    loginPass: document.getElementById("loginPass"),
    btnLogin: document.getElementById("btnLogin"),
    btnLogout: document.getElementById("btnLogout"),

    sessionPill: document.getElementById("sessionPill"),
    sessionText: document.getElementById("sessionText"),

    query: document.getElementById("query"),
    btnSearch: document.getElementById("btnSearch"),
    btnRaw: document.getElementById("btnRaw"),
    msg: document.getElementById("msg"),

    outCustomer: document.getElementById("customerOut"),
    outSubs: document.getElementById("subsOut"),
    outOrders: document.getElementById("ordersOut"),

    rawWrap: document.getElementById("rawWrap"),
    rawOut: document.getElementById("rawOut")
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setMsg(text, kind) {
    if (!els.msg) return;
    const t = String(text || "").trim();
    if (!t) {
      els.msg.style.display = "none";
      els.msg.className = "";
      els.msg.textContent = "";
      return;
    }
    els.msg.style.display = "block";
    els.msg.className = kind ? kind : "";
    els.msg.textContent = t;
  }

  function setBadge(text, ok) {
    if (!els.sessionPill || !els.sessionText) return;
    els.sessionText.textContent = text;
    els.sessionPill.classList.remove("ok", "bad");
    els.sessionPill.classList.add(ok ? "ok" : "bad");
  }

  function fmtMoney(total, currency) {
    const tRaw = String(total ?? "").trim();
    if (!tRaw) return "—";

    const n = Number(tRaw);
    if (!Number.isFinite(n)) return "—";

    const cur = String(currency ?? "USD").trim() || "USD";
    try {
      // Always show a symbol-style currency, e.g. $0.00
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
        currencyDisplay: "symbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(n);
    } catch (_) {
      // Fallback: USD-style
      return `$${n.toFixed(2)}`;
    }
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
    // Handle "+1XXXXXXXXXX" or "1XXXXXXXXXX"
    if (digits.length === 11 && digits.startsWith("1")) {
      const d10 = digits.slice(1);
      const a = d10.slice(0, 3);
      const b = d10.slice(3, 6);
      const c = d10.slice(6);
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

    const billingBlock = addr({ ...billing, __label: "Billing" });
    const shippingBlock = addr({ ...shipping, __label: "Shipping" });

    return `
      <div class="oo-grid2">
        ${left}
        <div class="oo-out">
          ${billingBlock}
          ${shippingBlock}
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
        ? `<div class="oo-notes"><div class="stack">
            ${notes.map(n => `
              <div class="oo-note">
                <small>${esc(fmtDate(n?.date_created))}${(n?.author || n?.added_by) ? " • " + esc(n?.author || n?.added_by || "") : ""}</small>
                <div class="txt">${esc(n?.note || "")}</div>
              </div>
            `).join("")}
          </div></div>`
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
                <th>Product</th>
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

                const items = Array.isArray(o?.line_items) ? o.line_items : [];
                const product = (() => {
                  if (!items.length) return "—";
                  const first = items[0];
                  const firstName = String(first?.name || "").trim();
                  const qty = Number(first?.quantity ?? 0) || 0;
                  const rest = items.length > 1 ? ` +${items.length - 1} more` : "";
                  const qtyPart = qty > 1 ? ` (x${qty})` : "";
                  return esc(`${firstName || "Item"}${qtyPart}${rest}`);
                })();

                return `
                  <tr>
                    <td>#${id}</td>
                    <td>${date}</td>
                    <td>${status}</td>
                    <td>${total}</td>
                    <td>${pm}</td>
                    <td>${product}</td>
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

  function renderJson(obj) {
    return `<pre style="margin:0; padding: 12px 10px; overflow:auto; background: rgba(15,23,42,0.04); border-top: 1px solid rgba(15,23,42,0.08);">${esc(JSON.stringify(obj, null, 2))}</pre>`;
  }

  function setOutputs(payload) {
    const ctx = payload?.context || payload?.results || payload || {};
    let customer = ctx?.customer || null;
    const rawSubs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
    const rawOrders = Array.isArray(ctx?.orders) ? ctx.orders : [];

    // Fill missing customer identity from subscriptions/orders context (safe UI-only inference)
    const inferredCustomerId = (customer?.id != null && String(customer.id).trim())
      ? customer.id
      : (rawSubs[0]?.customer_id ?? rawOrders[0]?.customer_id ?? null);

    if (customer && (customer.id == null || String(customer.id).trim() === "") && inferredCustomerId != null) {
      customer = { ...customer, id: inferredCustomerId };
    }

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

    if (els.rawOut) els.rawOut.innerHTML = renderJson(payload);
  }

  async function api(path, init) {
    const url = `${WORKER_BASE}${path}`;
    const method = init?.method || "GET";

    const started = Date.now();
    const resp = await fetch(url, {
      ...init,
      method,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {})
      }
    });

    const took = Date.now() - started;

    if (!resp.ok) {
      console.warn("[ArnoldAdmin] API error", { path, status: resp.status, tookMs: took });
    } else {
      console.log("[ArnoldAdmin] API ok", { path, status: resp.status, tookMs: took });
    }

    const txt = await resp.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = { raw: txt }; }

    return { resp, data };
  }

  async function checkStatus() {
    try {
      const { resp, data } = await api("/admin/status", { method: "GET" });
      const loggedIn = !!data?.loggedIn;
      if (loggedIn) {
        setBadge("Session: logged in", true);
        if (els.btnLogout) els.btnLogout.style.display = "";
      } else {
        setBadge("Session: logged out", false);
        if (els.btnLogout) els.btnLogout.style.display = "none";
      }
      return loggedIn;
    } catch (err) {
      console.error("[ArnoldAdmin] status failed", err);
      setBadge("Session: error", false);
      return false;
    }
  }

  async function doLogin() {
    const u = els.loginUser?.value || "";
    const p = els.loginPass?.value || "";

    setMsg("Logging in…", "");
    setBadge("Session: logging in…", false);

    const { resp, data } = await api("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: u, password: p })
    });

    if (!resp.ok || !data?.success) {
      setMsg(data?.message || `Login failed (${resp.status}).`, "bad");
      setBadge("Session: logged out", false);
      return;
    }

    setMsg("Logged in.", "ok");
    await checkStatus();
  }

  async function doLogout() {
    setMsg("Logging out…", "");
    const { resp, data } = await api("/admin/logout", { method: "POST", body: JSON.stringify({}) });
    if (!resp.ok || !data?.success) {
      setMsg(data?.message || `Logout failed (${resp.status}).`, "bad");
      return;
    }
    setMsg("Logged out.", "ok");
    if (els.btnLogout) els.btnLogout.style.display = "none";
    setBadge("Session: logged out", false);
  }

  async function doSearch() {
    const q = String(els.query?.value || "").trim();
    if (!q) {
      setMsg("Enter a query.", "bad");
      return;
    }

    setMsg("Searching…", "");
    if (els.outCustomer) els.outCustomer.innerHTML = "";
    if (els.outSubs) els.outSubs.innerHTML = "";
    if (els.outOrders) els.outOrders.innerHTML = "";

    const { resp, data } = await api("/admin/nl-search", {
      method: "POST",
      body: JSON.stringify({ query: q })
    });

    if (!resp.ok || !data?.ok) {
      const msg = data?.error || data?.message || `Search failed (${resp.status}).`;
      setMsg(msg, "bad");
      console.warn("[ArnoldAdmin] nl-search failed payload:", data);
      if (els.rawOut) els.rawOut.innerHTML = renderJson(data);
      if (els.rawWrap) els.rawWrap.style.display = "";
      return;
    }

    setMsg(`Search complete (${data?.intent || "ok"}).`, "ok");
    setOutputs(data);

    if (els.rawWrap && els.rawWrap.style.display === "none") {
      // keep hidden until user toggles
    }
  }

  function toggleRaw() {
    if (!els.rawWrap) return;
    const isHidden = els.rawWrap.style.display === "none";
    els.rawWrap.style.display = isHidden ? "" : "none";
  }

  if (els.btnLogin) els.btnLogin.addEventListener("click", () => doLogin());
  if (els.btnLogout) els.btnLogout.addEventListener("click", () => doLogout());
  if (els.btnSearch) els.btnSearch.addEventListener("click", () => doSearch());
  if (els.btnRaw) els.btnRaw.addEventListener("click", () => toggleRaw());

  // Enter key behavior
  if (els.loginPass) els.loginPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
  if (els.query) els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // Boot
  checkStatus().catch((err) => {
    console.error("[ArnoldAdmin] boot status check failed", err);
    setMsg("Unexpected error (see console).", "bad");
    setBadge("Session: error", false);
  });
})();

// 🔴 main.js