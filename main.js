// 🟢 main.js
// ArnoldApp main.js — FULL REPLACEMENT (v2026-02-19a)
// - Pretty OkObserver-style cards (no CRT)
// - Renders wp-admin-ish sections (General/Billing/Shipping/Items/Related)
// - Uses WP admin cookie session (NO localStorage token)
// - credentials:"include" on all admin requests

(() => {
  const ARNOLD_WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const els = {
    q: document.getElementById("queryInput"),
    btn: document.getElementById("searchBtn"),
    results: document.getElementById("results"),

    // session UI
    sessionDot: document.getElementById("sessionDot"),
    sessionText: document.getElementById("sessionText"),

    // login UI
    loginPanel: document.getElementById("loginPanel"),
    searchPanel: document.getElementById("searchPanel"),
    user: document.getElementById("usernameInput"),
    pass: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    loginHint: document.getElementById("loginHint")
  };

  function setSessionUI(loggedIn) {
    if (loggedIn) {
      els.sessionDot.classList.remove("off");
      els.sessionText.textContent = "Session: logged in";
      els.logoutBtn.disabled = false;
      els.btn.disabled = false;
    } else {
      els.sessionDot.classList.add("off");
      els.sessionText.textContent = "Session: logged out";
      els.logoutBtn.disabled = true;
      els.btn.disabled = true;
    }
  }

  async function api(path, opts) {
    const resp = await fetch(`${ARNOLD_WORKER_BASE}${path}`, {
      ...opts,
      credentials: "include"
    });
    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { ok: false, error: "Non-JSON response", raw: text }; }
    return { resp, data };
  }

  async function refreshSession() {
    try {
      const { resp, data } = await api("/admin/status", { method: "GET" });
      const loggedIn = !!(resp.ok && data && data.loggedIn);
      setSessionUI(loggedIn);
      if (els.searchPanel) els.searchPanel.style.display = loggedIn ? "" : "none";
      return loggedIn;
    } catch (_) {
      setSessionUI(false);
      if (els.searchPanel) els.searchPanel.style.display = "none";
      return false;
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderLoading() {
    return `
      <div class="card">
        <h2>Working…</h2>
        <div class="kv">
          <div class="k">Status</div><div class="v">Fetching WooCommerce data…</div>
        </div>
      </div>
    `;
  }

  function renderError(title, data) {
    return `
      <div class="card">
        <h2>⚠ ${esc(title)}</h2>
        <pre>${esc(JSON.stringify(data, null, 2))}</pre>
      </div>
    `;
  }

  function renderKV(rows) {
    return `
      <div class="kv">
        ${rows.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join("")}
      </div>
    `;
  }

  function renderSection(title, innerHtml) {
    return `
      <div class="card">
        <h2>${esc(title)}</h2>
        ${innerHtml}
      </div>
    `;
  }

  function money(total, currency) {
    if (total == null) return "";
    const t = String(total);
    const c = String(currency || "");
    return c ? `${t} ${c}` : t;
  }

  function renderResult(payload) {
    if (!payload || payload.ok === false) {
      return renderError("Request failed", payload);
    }

    const intent = payload.intent || "unknown";

    if (intent === "order_by_id") {
      const o = payload.result || {};
      const general = renderKV([
        ["Order ID", String(o.id ?? "")],
        ["Status", String(o.status ?? "")],
        ["Created", String(o.date_created ?? "")],
        ["Total", money(o.total, o.currency)],
        ["Payment Method", String(o.payment_method_title ?? o.payment_method ?? "")]
      ]);

      const billing = renderKV(Object.entries(o.billing || {}).map(([k, v]) => [k, String(v ?? "")]));
      const shipping = renderKV(Object.entries(o.shipping || {}).map(([k, v]) => [k, String(v ?? "")]));

      const items = Array.isArray(o.line_items) ? o.line_items : [];
      const itemsHtml = items.length
        ? `<pre>${esc(JSON.stringify(items, null, 2))}</pre>`
        : `<div class="kv"><div class="k">Items</div><div class="v">None</div></div>`;

      return [
        renderSection("Order Summary", general),
        renderSection("Billing", billing),
        renderSection("Shipping", shipping),
        renderSection("Line Items", itemsHtml),
        renderSection("Safe Meta (redacted)", `<pre>${esc(JSON.stringify(o.meta || [], null, 2))}</pre>`)
      ].join("");
    }

    if (intent === "customer_by_email") {
      const arr = Array.isArray(payload.results) ? payload.results : [];
      if (!arr.length) return renderSection("Customer", renderKV([["Matches", "0"]]));

      const blocks = arr.map((c, i) => {
        const general = renderKV([
          ["Customer ID", String(c.id ?? "")],
          ["Username", String(c.username ?? "")],
          ["Email (masked)", String(c.email ?? "")],
          ["Name", `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()],
          ["Created", String(c.date_created ?? "")]
        ]);

        return renderSection(`Customer Match #${i + 1}`, general);
      });

      return blocks.join("");
    }

    if (intent === "subscription_by_email") {
      const arr = Array.isArray(payload.results) ? payload.results : [];
      const head = renderSection(
        "Subscription Lookup",
        renderKV([
          ["Email (masked)", String(payload.email ?? "")],
          ["Customer ID", String(payload.customer_id ?? "")],
          ["Matches", String(payload.matches ?? arr.length)],
          ["Used fallback", String(payload.used_fallback ?? false)]
        ])
      );

      const blocks = arr.map((s, i) => {
        const general = renderKV([
          ["Subscription ID", String(s.id ?? "")],
          ["Status", String(s.status ?? "")],
          ["Total", money(s.total, s.currency)],
          ["Start", String(s.start_date ?? "")],
          ["Next Payment", String(s.next_payment_date ?? "")],
          ["End", String(s.end_date ?? "")],
          ["Interval", `${s.billing_interval ?? ""} ${s.billing_period ?? ""}`.trim()],
          ["Payment Method", String(s.payment_method_title ?? s.payment_method ?? "")]
        ]);
        return renderSection(`Subscription #${i + 1}`, general);
      });

      return [head, ...blocks].join("");
    }

    if (intent === "membership_by_email") {
      const arr = Array.isArray(payload.results) ? payload.results : [];
      const head = renderSection(
        "Membership Lookup",
        renderKV([
          ["Email (masked)", String(payload.email ?? "")],
          ["Customer ID", String(payload.customer_id ?? "")],
          ["Matches", String(payload.matches ?? arr.length)]
        ])
      );

      const blocks = arr.map((m, i) => {
        const general = renderKV([
          ["Membership ID", String(m.id ?? "")],
          ["Status", String(m.status ?? "")],
          ["Plan ID", String(m.plan_id ?? "")],
          ["Start", String(m.start_date ?? "")],
          ["End", String(m.end_date ?? "")]
        ]);
        return renderSection(`Membership #${i + 1}`, general);
      });

      return [head, ...blocks].join("");
    }

    if (intent === "coupon_by_code") {
      const c = payload.result || null;
      if (!c) {
        return renderSection("Coupon", renderKV([["Result", "No exact match"]]));
      }
      const general = renderKV([
        ["Coupon ID", String(c.id ?? "")],
        ["Code", String(c.code ?? "")],
        ["Amount", String(c.amount ?? "")],
        ["Type", String(c.discount_type ?? "")],
        ["Expires", String(c.date_expires ?? "")],
        ["Usage Count", String(c.usage_count ?? "")],
        ["Usage Limit", String(c.usage_limit ?? "")]
      ]);
      return renderSection("Coupon", general);
    }

    return renderSection(
      "Result",
      `<pre>${esc(JSON.stringify(payload, null, 2))}</pre>`
    );
  }

  async function doSearch() {
    const query = (els.q.value || "").trim();
    if (!query) return;

    const loggedIn = await refreshSession();
    if (!loggedIn) {
      els.results.innerHTML = renderError(
        "You are not logged in. Please log in with a WordPress admin account.",
        { ok: false }
      );
      return;
    }

    els.results.innerHTML = renderLoading();

    try {
      const { resp, data } = await api("/admin/nl-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (!resp.ok) {
        els.results.innerHTML = renderError(`HTTP ${resp.status}`, data);
        return;
      }

      els.results.innerHTML = renderResult(data);
    } catch (err) {
      els.results.innerHTML = renderError(err?.message || "Request failed", { ok: false });
    }
  }

  els.btn.addEventListener("click", doSearch);
  els.q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  els.loginBtn.addEventListener("click", async () => {
    const username = (els.user.value || "").trim();
    const password = (els.pass.value || "").trim();

    if (!username || !password) {
      els.loginHint.textContent = "Username and password required.";
      return;
    }

    els.loginBtn.disabled = true;
    els.loginHint.textContent = "Logging in…";

    try {
      const { resp, data } = await api("/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!resp.ok || !data?.success) {
        els.loginHint.textContent = data?.message || `Login failed (HTTP ${resp.status})`;
        await refreshSession();
        return;
      }

      els.loginHint.textContent = "Logged in.";
      els.pass.value = "";
      await refreshSession();
    } catch (err) {
      els.loginHint.textContent = err?.message || "Login failed.";
      await refreshSession();
    } finally {
      els.loginBtn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    els.logoutBtn.disabled = true;
    try {
      await api("/admin/logout", { method: "POST" });
    } catch (_) {}
    await refreshSession();
  });

  // boot
  (async () => {
    if (els.searchPanel) els.searchPanel.style.display = "none";
    els.btn.disabled = true;
    await refreshSession();
  })();
})();

// 🔴 main.js
