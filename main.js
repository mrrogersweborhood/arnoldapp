// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (v2026-02-21a)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
//
// Notes:
// - index.html and main.js MUST be deployed together (DOM contract).
// - Worker base: https://arnold-admin-worker.bob-b5c.workers.dev

(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";

  const el = (id) => document.getElementById(id);

  const ids = [
    "sessionBadge",
    "sessionDot",
    "sessionText",
    "user",
    "pass",
    "btnLogin",
    "btnLogout",
    "q",
    "btnSearch",
    "err",
    "outCustomer",
    "outSubs",
    "outOrders",
    "outJson"
  ];

  const missing = ids.filter((x) => !el(x));
  if (missing.length) {
    const msg = `DOM mismatch: missing element(s): ${missing.join(", ")}. index.html and main.js must be updated together.`;
    console.error(msg);
    const banner = document.createElement("div");
    banner.style.cssText = "margin-top:10px;color:#b91c1c;font-weight:900;";
    banner.textContent = msg;
    const err = el("err");
    if (err) {
      err.style.display = "block";
      err.textContent = msg;
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return;
  }

  const $sessionDot = el("sessionDot");
  const $sessionText = el("sessionText");
  const $user = el("user");
  const $pass = el("pass");
  const $btnLogin = el("btnLogin");
  const $btnLogout = el("btnLogout");
  const $q = el("q");
  const $btnSearch = el("btnSearch");
  const $err = el("err");
  const $outCustomer = el("outCustomer");
  const $outSubs = el("outSubs");
  const $outOrders = el("outOrders");
  const $outJson = el("outJson");

  function showErr(message) {
    $err.style.display = "block";
    $err.textContent = message || "Error.";
  }

  function clearErr() {
    $err.style.display = "none";
    $err.textContent = "";
  }

  function safeText(v) {
    if (v == null) return "";
    const s = String(v);
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(s) {
    if (!s) return "";
    const t = String(s).trim();
    if (!t) return "";
    // Keep exact text (Woo returns local string)
    return t.replace("T", " ").replace("Z", "");
  }

  function fmtPhone(v) {
    const raw = String(v ?? "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D+/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return raw;
  }

  function buildNLQuery(input) {
    return String(input || "").trim().replace(/\s+/g, " ");
  }

  async function api(path, init) {
    const url = `${WORKER_BASE}${path}`;
    const resp = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init && init.headers ? init.headers : {})
      }
    });

    let data = null;
    try {
      data = await resp.json();
    } catch (_) {
      data = null;
    }

    return { resp, data };
  }

  function setSessionUI(loggedIn) {
    if (loggedIn) {
      $sessionDot.style.background = "#22c55e";
      $sessionText.textContent = "Session: logged in";
    } else {
      $sessionDot.style.background = "rgba(255,255,255,.7)";
      $sessionText.textContent = "Session: logged out";
    }
  }

  async function refreshStatus() {
    try {
      const { resp, data } = await api("/admin/status", { method: "GET" });
      if (!resp.ok) throw new Error("status failed");
      setSessionUI(!!data?.loggedIn);
      return !!data?.loggedIn;
    } catch (_) {
      setSessionUI(false);
      return false;
    }
  }

  function renderNotes(notes) {
    const arr = Array.isArray(notes) ? notes : [];
    if (!arr.length) return "—";

    return `
      <div class="noteStack">
        ${arr.map(n => {
          const d = safeText(fmtDate(n?.date_created) || "");
          const body = safeText(n?.note || "");
          const by = safeText(n?.author || n?.added_by || "");
          return `
            <div class="noteCard">
              <div class="noteMeta">
                <span>${d || "—"}</span>
                <span>${by || ""}</span>
              </div>
              <div class="noteBody">${body || "—"}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderCustomer(c) {
    if (!c) return "—";

    const id = safeText(c?.id ?? "—");
    const username = safeText(c?.username ?? "—");

    const billing = c?.billing || {};
    const shipping = c?.shipping || {};

    return `
      <div class="metaRow">
        <div class="kv"><div class="k">customer id</div><div class="v">${id}</div></div>
        <div class="kv"><div class="k">username</div><div class="v">${username}</div></div>
      </div>

      <div class="grid2">
        <div class="cardInner">
          <h4 class="subhead">Billing</h4>
          ${renderAddressCompact(billing)}
        </div>
        <div class="cardInner">
          <h4 class="subhead">Shipping</h4>
          ${renderAddressCompact(shipping)}
        </div>
      </div>
    `;
  }

  function renderAddressCompact(a) {
    if (!a) return "<div class=\"muted\">—</div>";

    const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || "—";
    const address = [
      a?.address_1,
      a?.address_2,
      a?.city,
      a?.state,
      a?.postcode,
      a?.country
    ].filter(Boolean).join(" • ").trim() || "—";

    const email = a?.email ? safeText(a.email) : "—";
    const phone = a?.phone ? safeText(fmtPhone(a.phone)) : "—";

    return `
      <div class="kvGrid">
        <div class="kv"><div class="k">name</div><div class="v">${name}</div></div>
        <div class="kv"><div class="k">address</div><div class="v">${address}</div></div>
        <div class="kv"><div class="k">email</div><div class="v">${email}</div></div>
        <div class="kv"><div class="k">phone</div><div class="v">${phone}</div></div>
      </div>
    `;
  }

  function renderSubscriptions(subs) {
    const arr = Array.isArray(subs) ? subs : [];
    if (!arr.length) return "—";

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Next Payment</th>
            <th>End</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map(s => {
            return `
              <tr>
                <td class="nowrap">
                  <div class="oneLine"><strong>#${safeText(s?.id)}</strong> <span class="tag">${safeText(s?.status || "—")}</span></div>
                </td>
                <td>${safeText(fmtDate(s?.next_payment_date) || "—")}</td>
                <td>${safeText(fmtDate(s?.end_date) || "—")}</td>
                <td class="notesCell">${renderNotes(s?.notes)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderOrders(orders) {
    const arr = Array.isArray(orders) ? orders : [];
    if (!arr.length) return "—";

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map(o => {
            const items = Array.isArray(o?.line_items) ? o.line_items : [];
            const itemNames = items.map(x => x?.name).filter(Boolean).join(" • ");
            return `
              <tr>
                <td class="nowrap">
                  <div class="oneLine"><strong>#${safeText(o?.id)}</strong> <span class="tag">${safeText(o?.status || "—")}</span> <span class="muted">${fmtDate(o?.date_created) || ""}</span></div>
                </td>
                <td>${safeText(o?.total || "")}</td>
                <td>${safeText(o?.payment_method_title || "")}</td>
                <td>${safeText(itemNames || "—")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function renderJson(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (_) {
      return "—";
    }
  }

  function resetOutputs() {
    $outCustomer.textContent = "—";
    $outSubs.textContent = "—";
    $outOrders.textContent = "—";
    $outJson.textContent = "—";
  }

  async function doLogin() {
    clearErr();

    const username = String($user.value || "").trim();
    const password = String($pass.value || "").trim();
    if (!username || !password) {
      showErr("Username and password required.");
      return;
    }

    $btnLogin.disabled = true;
    try {
      const { resp, data } = await api("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      if (!resp.ok || !data?.success) {
        showErr(data?.message || "Login failed.");
        setSessionUI(false);
        return;
      }

      setSessionUI(true);
      resetOutputs();
    } catch (err) {
      showErr(err?.message || "Login failed.");
      setSessionUI(false);
    } finally {
      $btnLogin.disabled = false;
    }
  }

  async function doLogout() {
    clearErr();
    $btnLogout.disabled = true;
    try {
      await api("/admin/logout", { method: "POST" });
      setSessionUI(false);
      resetOutputs();
    } catch (_) {
      setSessionUI(false);
      resetOutputs();
    } finally {
      $btnLogout.disabled = false;
    }
  }

  async function doSearch() {
    clearErr();

    const q = buildNLQuery($q.value);
    if (!q) {
      showErr("Enter a query.");
      return;
    }

    $btnSearch.disabled = true;

    try {
      const { resp, data } = await api("/admin/nl-search", {
        method: "POST",
        body: JSON.stringify({ query: q })
      });

      if (!resp.ok || !data?.ok) {
        showErr(data?.error || "Search failed.");
        return;
      }

      const ctx = data?.context || {};
      const customer = ctx?.customer || null;
      const subs = Array.isArray(ctx?.subscriptions) ? ctx.subscriptions : [];
      const orders = Array.isArray(ctx?.orders) ? ctx.orders : [];

      $outCustomer.innerHTML = renderCustomer(customer);
      $outSubs.innerHTML = renderSubscriptions(subs);
      $outOrders.innerHTML = renderOrders(orders);
      $outJson.textContent = renderJson(data);

    } catch (err) {
      showErr(err?.message || "Search failed.");
    } finally {
      $btnSearch.disabled = false;
    }
  }

  $btnLogin.addEventListener("click", doLogin);
  $btnLogout.addEventListener("click", doLogout);
  $btnSearch.addEventListener("click", doSearch);

  $pass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  $q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  refreshStatus();
})();

// 🔴 main.js