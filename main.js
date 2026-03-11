var openSubNotes = window.openSubNotes || new Set();
var openOrderNotes = window.openOrderNotes || new Set();
window.openSubNotes = openSubNotes;
window.openOrderNotes = openOrderNotes;
window.WOO_ADMIN = window.WOO_ADMIN || "https://okobserver.org/wp-admin/post.php";

// 🟢 main.js
// Arnold Admin — FULL REPLACEMENT (Build 2026-03-11R2-controllerOnlyAbortCache)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------
  // Session / view state
  // --------------------------------------------------
  let lastMode = null; // 'search' | 'totals'
  let lastPayload = null;
  let lastRaw = null;
  let rawVisible = false;

  let currentSearchController = null;
  let lastCustomerResult = null;

  // --------------------------------------------------
  // Status / UI helpers
  // --------------------------------------------------
  function setStatus(kind, text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg" + (kind ? ` ${kind}` : "");
    sl.textContent = friendlyText(text ?? "");
  }

  function applyLoginUserMask(isLoggedIn) {
    const u = $("loginUser");
    if (!u) return;
    const hasValue = !!String(u.value || "").trim();

    if (isLoggedIn && hasValue) {
      if (u.type !== "password") u.type = "password";
      return;
    }

    if (u.type !== "text") u.type = "text";
  }

  function setSessionPill(isLoggedIn, name) {
    const pill = $("sessionPill");
    const txt = $("sessionText");
    if (!pill || !txt) return;

    if (isLoggedIn) {
      pill.classList.add("ok");
      txt.textContent = `Session: logged in as ${name || "admin"}`;
    } else {
      pill.classList.remove("ok");
      txt.textContent = "Session: unknown";
    }

    applyLoginUserMask(!!isLoggedIn);
  }

  function toggleLoginSearchUI(isLoggedIn) {
    const login = $("loginFields");
    const search = $("searchFields");

    if (login) login.style.display = isLoggedIn ? "none" : "contents";
    if (search) search.style.display = isLoggedIn ? "contents" : "none";
  }

  async function refreshSession() {
    const r = await fetch(`${WORKER_BASE}/admin/status`, {
      method: "GET",
      credentials: "include"
    });

    const j = await r.json().catch(() => null);

    if (j && j.loggedIn) {
      setSessionPill(true, j?.user?.name || j?.user?.slug || "admin");
      toggleLoginSearchUI(true);
      return true;
    }

    setSessionPill(false, null);
    toggleLoginSearchUI(false);
    return false;
  }

  // --------------------------------------------------
  // Raw JSON viewer
  // --------------------------------------------------
  function scrubMetaData(obj) {
    if (obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(scrubMetaData);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "meta_data") continue;
      out[k] = scrubMetaData(v);
    }
    return out;
  }

  function ensureRawBox() {
    let box = $("rawJsonBox");
    if (box) return box;

    const wrap = document.querySelector(".wrap");
    const btn = $("btnRawJson");
    if (!wrap || !btn) return null;

    box = document.createElement("pre");
    box.id = "rawJsonBox";
    box.style.display = "none";
    wrap.insertBefore(box, btn);
    return box;
  }

  function renderRawJson() {
    const box = ensureRawBox();
    if (!box) return;

    if (!rawVisible) {
      box.textContent = "";
      box.style.display = "none";
      return;
    }

    box.style.display = "block";
    box.textContent = JSON.stringify(scrubMetaData(lastRaw), null, 2);
  }

  function toggleRawJson() {
    rawVisible = !rawVisible;
    renderRawJson();
  }

  // --------------------------------------------------
  // Search state helpers
  // --------------------------------------------------
  function abortActiveSearch() {
    if (currentSearchController) {
      try {
        currentSearchController.abort();
      } catch (_) {}
    }
    currentSearchController = null;
  }

  function cacheLastCustomerFromPayload(payload) {
    const customer = payload?.context?.customer || payload?.customer || null;
    if (customer) {
      lastCustomerResult = customer;
    }
  }

  function isLikelyEmailLookupQuery(q) {
    const s = String(q ?? "").trim();
    if (!s) return false;
    if (/(?:\border\s*#?\s*)(\d{3,})\b/i.test(s) || /^#?(\d{3,})$/.test(s)) return false;
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s);
  }

  // --------------------------------------------------
  // Event binding helpers
  // --------------------------------------------------
  async function copyText(text) {
    const value = String(text ?? "").trim();
    if (!value || value === "—") return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      } catch (_) {
        return false;
      }
    }
  }

  function bindCopyButtons(container) {
    if (!container) return;

    container.querySelectorAll(".aa-copy-btn[data-copy], .aa-copy-icon[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy") || "";
        const oldHtml = btn.innerHTML;
        const oldTitle = btn.getAttribute("title") || "";
        const isIcon = btn.classList.contains("aa-copy-icon");
        const ok = await copyText(text);

        if (isIcon) {
          btn.innerHTML = ok ? "✓" : "!";
          btn.setAttribute("title", ok ? "Copied" : "Copy failed");
        } else {
          btn.innerHTML = ok ? 'Copied <span aria-hidden="true">✓</span>' : "Copy failed";
        }

        btn.classList.toggle("copied", !!ok);

        window.setTimeout(() => {
          btn.innerHTML = oldHtml;
          if (oldTitle) btn.setAttribute("title", oldTitle);
          else btn.removeAttribute("title");
          btn.classList.remove("copied");
        }, 1200);
      });
    });
  }

  function bindNotesToggles(container) {
    if (!container) return;

    container.querySelectorAll(".aa-notes-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-kind");
        const id = btn.getAttribute("data-id");
        if (!kind || !id) return;

        const set = kind === "sub" ? openSubNotes : openOrderNotes;
        if (set.has(id)) set.delete(id);
        else set.add(id);

        if (lastMode === "search" && lastPayload) {
          const results = $("results");
          if (!results) return;
          results.innerHTML = renderResults(lastPayload);
          bindNotesToggles(results);
          bindCopyButtons(results);
          bindOpenCandidateButtons(results);
        }
      });
    });
  }

  function bindOpenCandidateButtons(container) {
    if (!container) return;

    container.querySelectorAll(".aa-candidate-open-btn[data-open-query]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const query = String(btn.getAttribute("data-open-query") || "").trim();
        if (!query) return;
        const qEl = $("q");
        if (qEl) qEl.value = query;
        await doSearch();
      });
    });
  }

  // --------------------------------------------------
  // Render helpers
  // --------------------------------------------------
  function renderCandidateMatches(payload) {
    const matches = Array.isArray(payload?.possible_matches) ? payload.possible_matches : [];

    if (!matches.length) {
      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">Possible Matches</div>
            <div class="aa-section-subtitle">No candidate matches returned</div>
          </div>
          <div class="aa-muted">No matches found.</div>
        </section>
      `;
    }

    const rows = matches.map((m) => {
      const c = m?.customer || {};
      const name = [c?.first_name, c?.last_name]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .join(" ") || "—";
      const email = String(c?.email ?? "").trim() || "—";
      const idRaw = c?.id != null && String(c.id).trim() ? String(c.id).trim() : "";
      const id = idRaw ? `#${idRaw}` : "—";
      const openValue = email !== "—" ? email : (idRaw ? `customer #${idRaw}` : "");
      const openCell = openValue
        ? `<button type="button" class="aa-copy-btn aa-candidate-open-btn" data-open-query="${esc(openValue)}">Open</button>`
        : `<span class="aa-muted">—</span>`;
      return `
        <tr>
          <td>${openCell}</td>
          <td>${esc(name)}</td>
          <td>${esc(email)}</td>
          <td>${esc(id)}</td>
        </tr>
      `;
    }).join("");

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Possible Matches</div>
          <div class="aa-section-subtitle">Select the correct customer</div>
        </div>

        <div class="aa-table-wrap">
          <table class="aa-table" style="min-width:760px; table-layout:fixed;">
            <colgroup>
              <col style="width:120px;">
              <col style="width:220px;">
              <col style="width:280px;">
              <col style="width:140px;">
            </colgroup>
            <thead>
              <tr>
                <th>Open</th>
                <th>Name</th>
                <th>Email</th>
                <th>Customer ID</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderProgressiveShell(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer && typeof window.renderCustomerCard === "function"
      ? window.renderCustomerCard(customer)
      : "";

    const billingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Billing", billing, null)
      : "";

    const shippingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Shipping", shipping, billing)
      : "";

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
          <div class="aa-section-subtitle">Customer loaded first</div>
        </div>

        ${customerCard}

        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Loading subscription(s) / order(s)</div>
          <div class="aa-section-subtitle">Fetching subscriptions, orders, and notes…</div>
        </div>
        <div class="aa-loading-rows">
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
        </div>
      </section>
    `;
  }

  function renderResults(payload) {
    if (payload?.intent === "customer_candidates_by_name") {
      return renderCandidateMatches(payload);
    }

    if (payload?.intent === "unknown") {
      const note = String(payload?.note || "Try an email address, customer #123, or order #12345.").trim();
      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">No supported match yet</div>
            <div class="aa-section-subtitle">${esc(note)}</div>
          </div>
          <div class="aa-muted">Try an email address, a customer lookup like customer #123, or an order lookup like order #12345.</div>
        </section>
      `;
    }

    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subs = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];
    const billing = customer?.billing || null;
    const shipping = customer?.shipping || null;

    const customerCard = customer && typeof window.renderCustomerCard === "function"
      ? window.renderCustomerCard(customer)
      : "";

    const billingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Billing", billing, null)
      : "";

    const shippingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Shipping", shipping, billing)
      : "";

    const activity = typeof window.renderCustomerActivity === "function"
      ? window.renderCustomerActivity(customer, subs, orders)
      : "";

    const healthSummary = typeof window.renderSubscriptionHealthSummary === "function"
      ? window.renderSubscriptionHealthSummary(customer, subs, orders)
      : "";

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscriber</div>
        </div>

        ${customerCard}

        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      ${activity || ""}
      ${healthSummary || ""}
    `;
  }

  function renderTotals(data) {
    const d = data || {};

    const subsByLabel = (d.subscriptions_by_status && typeof d.subscriptions_by_status === "object")
      ? d.subscriptions_by_status
      : {};

    const ordersBlock = (d.orders_last_30d && typeof d.orders_last_30d === "object")
      ? d.orders_last_30d
      : (d.orders_by_status && typeof d.orders_by_status === "object")
        ? { by_status: d.orders_by_status, total: d.orders_total || null }
        : {};

    const ordersByStatus = (ordersBlock.by_status && typeof ordersBlock.by_status === "object")
      ? ordersBlock.by_status
      : {};

    const SUB_STATUS_ORDER = [
      "Trash",
      "Active",
      "Expired",
      "On hold",
      "Pending payment",
      "Pending cancellation",
      "Cancelled"
    ];

    const ORDER_STATUS_ORDER = [
      ["Pending", "pending"],
      ["Processing", "processing"],
      ["On hold", "on-hold"],
      ["Completed", "completed"],
      ["Cancelled", "cancelled"],
      ["Refunded", "refunded"],
      ["Failed", "failed"]
    ];
    const subRows = SUB_STATUS_ORDER
      .map((label) => {
        const countRaw = subsByLabel[label];
        const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 0;

        return `
          <tr>
            <td>${esc(label)}</td>
            <td class="aa-num">${esc(String(count))}</td>
          </tr>
        `;
      })
      .join("");

    const subTotal = SUB_STATUS_ORDER.reduce((acc, label) => {
      const v = Number(subsByLabel[label] ?? 0);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);

    const orderRows = ORDER_STATUS_ORDER
      .map(([label, slug]) => {
        const countRaw = ordersByStatus[slug];
        const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 0;

        return `
          <tr>
            <td>${esc(label)}</td>
            <td class="aa-num">${esc(String(count))}</td>
          </tr>
        `;
      })
      .join("");

    let orderTotal = Number(ordersBlock.total);

    if (!Number.isFinite(orderTotal)) {
      orderTotal = ORDER_STATUS_ORDER.reduce((acc, [, slug]) => {
        const v = Number(ordersByStatus[slug] ?? 0);
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0);
    }

    return `
      <div class="aa-totals-grid">

        <div class="aa-card aa-totals-card">
          <div class="aa-card-title">Subscriptions (all time)</div>

          <table class="aa-totals-table">
            <tbody>
              ${subRows}

              <tr class="aa-totals-divider">
                <td colspan="2"></td>
              </tr>

              <tr class="aa-totals-total">
                <td>Total</td>
                <td class="aa-num">${esc(String(subTotal))}</td>
              </tr>

            </tbody>
          </table>
        </div>

        <div class="aa-card aa-totals-card">
          <div class="aa-card-title">Orders (all time)</div>

          <table class="aa-totals-table">
            <tbody>
              ${orderRows}

              <tr class="aa-totals-divider">
                <td colspan="2"></td>
              </tr>

              <tr class="aa-totals-total">
                <td>Total</td>
                <td class="aa-num">${esc(String(orderTotal))}</td>
              </tr>

            </tbody>
          </table>
        </div>

      </div>
    `;
  }
  async function doLogin() {

    const u = $("loginUser")?.value?.trim() || "";
    const p = $("loginPass")?.value?.trim() || "";

    if (!u || !p) {
      setStatus("warn", "Username and password required.");
      return;
    }

    setStatus("busy", "Logging in…");

    const r = await fetch(`${WORKER_BASE}/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: u,
        password: p
      })
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.success) {
      setStatus("warn", j?.message || `Login failed (${r.status})`);
      setSessionPill(false, null);
      return;
    }

    setStatus("", "Logged in.");

    const loggedIn = await refreshSession();
    toggleLoginSearchUI(!!loggedIn);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    const q = $("q");
    if (q) q.focus();
  }


  async function doLogout() {

    setStatus("busy", "Logging out…");

    await fetch(`${WORKER_BASE}/admin/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => null);

    setStatus("", "Logged out.");
    setSessionPill(false, null);
    toggleLoginSearchUI(false);
  }
  async function doSearch() {

    const q = $("q")?.value?.trim() || "";

    if (!q) {
      setStatus("warn", "Enter a query (email or order #).");
      return;
    }

    abortActiveSearch();

    const controller = new AbortController();
    currentSearchController = controller;

    setStatus("busy", "Searching…");

    if (rawVisible) {
      rawVisible = false;
      renderRawJson();
    }

    $("results").innerHTML = "";

    const shouldProgressiveLoad = isLikelyEmailLookupQuery(q);

    try {

      if (shouldProgressiveLoad) {

        const partialResp = await fetch(`${WORKER_BASE}/admin/nl-search`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            mode: "customer_only"
          }),
          signal: controller.signal
        });

        const partialJson = await partialResp.json().catch(() => null);

        if (controller !== currentSearchController) return;

        if (!partialResp.ok || !partialJson?.ok) {

          setStatus("warn", friendlyText(partialJson?.error || partialJson?.message) || `Search failed (${partialResp.status})`);

          lastRaw = partialJson;
          lastMode = "search";
          lastPayload = partialJson;

          renderRawJson();
          return;
        }

        lastRaw = partialJson;
        lastMode = "search";
        lastPayload = partialJson;

        cacheLastCustomerFromPayload(partialJson);

        $("results").innerHTML = renderProgressiveShell(partialJson);
        bindCopyButtons($("results"));

        setStatus("busy", "Customer found. Loading subscriptions, orders, and notes…");
        const fullResp = await fetch(`${WORKER_BASE}/admin/nl-search`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            mode: "full"
          }),
          signal: controller.signal
        });

        const fullJson = await fullResp.json().catch(() => null);

        if (controller !== currentSearchController) return;

        lastRaw = fullJson;
        lastMode = "search";
        lastPayload = fullJson;

        if (!fullResp.ok || !fullJson?.ok) {

          setStatus("warn", friendlyText(fullJson?.error || fullJson?.message) || `Search failed (${fullResp.status})`);
          renderRawJson();
          return;
        }

        cacheLastCustomerFromPayload(fullJson);

        setStatus("", "Search complete.");

        $("results").innerHTML = renderResults(fullJson);

        bindNotesToggles($("results"));
        bindCopyButtons($("results"));
        bindOpenCandidateButtons($("results"));

        renderRawJson();
        return;
      }

      const r = await fetch(`${WORKER_BASE}/admin/nl-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          mode: "full"
        }),
        signal: controller.signal
      });

      const j = await r.json().catch(() => null);

      if (controller !== currentSearchController) return;

      lastRaw = j;
      lastMode = "search";
      lastPayload = j;

      if (!r.ok || !j?.ok) {

        setStatus("warn", friendlyText(j?.error || j?.message) || `Search failed (${r.status})`);
        renderRawJson();
        return;
      }

      cacheLastCustomerFromPayload(j);

      setStatus("", "Search complete.");

      $("results").innerHTML = renderResults(j);

      bindNotesToggles($("results"));
      bindCopyButtons($("results"));
      bindOpenCandidateButtons($("results"));

      renderRawJson();
      return;

    } catch (err) {

      if (err?.name === "AbortError") {
        return;
      }

      setStatus("warn", friendlyText(err) || "Search failed.");

    } finally {

      if (currentSearchController === controller) {
        currentSearchController = null;
      }
    }
  }


  async function doTotals() {

    setStatus("busy", "Loading totals…");

    if (rawVisible) {
      rawVisible = false;
      renderRawJson();
    }

    $("results").innerHTML = "";

    const r = await fetch(`${WORKER_BASE}/admin/stats`, {
      method: "GET",
      credentials: "include"
    });

    const j = await r.json().catch(() => null);

    lastRaw = j;
    lastMode = "totals";
    lastPayload = j;

    if (!r.ok || !j?.ok) {
      setStatus("warn", j?.error || `Totals failed (${r.status})`);
      renderRawJson();
      return;
    }

    setStatus("", "Totals loaded.");

    $("results").innerHTML = renderTotals(j);
    renderRawJson();
  }


  function init() {

    $("btnLogin")?.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin().catch(console.error);
    });

    $("btnLogout")?.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout().catch(console.error);
    });

    $("btnLogout2")?.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout().catch(console.error);
    });

    $("btnSearch")?.addEventListener("click", (e) => {
      e.preventDefault();
      doSearch().catch(console.error);
    });
// Allow Enter key in search box to trigger search
$("q")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    doSearch().catch(console.error);
  }
});
    $("btnTotals")?.addEventListener("click", (e) => {
      e.preventDefault();
      doTotals().catch(console.error);
    });

    $("btnRawJson")?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleRawJson();
    });

    const u = $("loginUser");

    u?.addEventListener("focus", () => {
      if (u.type !== "text") u.type = "text";
    });

    u?.addEventListener("blur", () => {
      const loggedInNow = $("sessionPill")?.classList?.contains("ok");
      applyLoginUserMask(!!loggedInNow);
    });

    toggleLoginSearchUI(false);

    refreshSession()
      .then((loggedIn) => {
        setSessionPill(!!loggedIn);
        toggleLoginSearchUI(!!loggedIn);
      })
      .catch(() => {
        setSessionPill(false, null);
        toggleLoginSearchUI(false);
      });
  }

  init();

})();

// 🔴 main.js