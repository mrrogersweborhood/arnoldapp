// 🟢 main.js
var openSubNotes = window.openSubNotes || new Set();
var openOrderNotes = window.openOrderNotes || new Set();
window.openSubNotes = openSubNotes;
window.openOrderNotes = openOrderNotes;
window.WOO_ADMIN = window.WOO_ADMIN || "https://okobserver.org/wp-admin/post.php";

// Arnold Admin — FULL REPLACEMENT (Build 2026-03-17R1 — Pulse Dashboard Entry + SaaS Render)
// (Markers are comments only: 🟢 main.js ... 🔴 main.js)
(() => {
  "use strict";

  const WORKER_BASE = "https://arnold-admin-worker.bob-b5c.workers.dev";
  const PULSE_WORKER_BASE = "https://pulse-worker.bob-b5c.workers.dev";
  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------
  // Session / view state
  // --------------------------------------------------
  let lastMode = null; // 'search' | 'totals' | 'radar' | 'pulse'
  let lastPayload = null;
  let lastRaw = null;
  let rawVisible = false;

  let currentSearchController = null;
  let lastCustomerResult = null;
  let radarPage = 1;
  let radarIssueFilter = "";
  let radarLoadingTimer = null;
  let radarLoadingIndex = 0;

  const RADAR_LOADING_MESSAGES = [
    "Loading support radar…",
    "Scanning failed renewals…",
    "Checking on-hold subscriptions…",
    "Reviewing pending cancellations…",
    "Comparing active subscription recoveries…",
    "Prioritizing repeat problem subscribers…",
    "Preparing radar page…"
  ];
  // --------------------------------------------------
  // Status / UI helpers
  // --------------------------------------------------
  function setStatus(kind, text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg" + (kind ? ` ${kind}` : "");
    sl.textContent = friendlyText(text ?? "");
  }
  function updateRadarStatus(data) {
    const banner = $("radarStatusBanner");
    const textEl = $("radarStatusText");
    const metaEl = $("radarStatusMeta");

    if (!banner || !textEl || !metaEl) return;

    banner.classList.remove(
      "aa-radar-status-healthy",
      "aa-radar-status-warning",
      "aa-radar-status-incident"
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    const actionableCount = Number(data?.total_actionable_items || items.length || 0) || 0;

    const hasGatewaySignal = items.some((item) => {
      const reason = String(item?.reason || "").toUpperCase();
      const issue = String(item?.issue || "").toLowerCase();
      const action = String(item?.action || "").toLowerCase();

      return (
        reason.includes("SQUARE") ||
        reason.includes("AUTH") ||
        reason.includes("3D") ||
        action.includes("gateway") ||
        issue.includes("gateway")
      );
    });

    const recentFailures = items.filter((item) => {
      const issue = String(item?.issue || "").toLowerCase();
      return (
        issue.includes("failed") ||
        issue.includes("hold") ||
        issue.includes("cancel") ||
        issue.includes("expired")
      );
    }).length;

    if (hasGatewaySignal) {
      banner.classList.add("aa-radar-status-incident");
      textEl.textContent = "Gateway Incident Suspected";
      metaEl.textContent = "Gateway-related payment failures detected in recent Radar results.";
      return;
    }

    if (actionableCount >= 8 || recentFailures >= 5) {
      banner.classList.add("aa-radar-status-warning");
      textEl.textContent = "Elevated Failures";
      metaEl.textContent = "Recent payment failures are above the normal baseline.";
      return;
    }

    banner.classList.add("aa-radar-status-healthy");
    textEl.textContent = "Healthy";
    metaEl.textContent = "No unusual payment failure patterns detected.";
  }

  function stopRadarLoadingUI() {
    if (radarLoadingTimer) {
      window.clearInterval(radarLoadingTimer);
      radarLoadingTimer = null;
    }

    const sl = $("statusLine");
    if (!sl) return;
    sl.classList.remove("aa-status-center");
    sl.innerHTML = "";
  }

  function setRadarLoadingStatus(text) {
    const sl = $("statusLine");
    if (!sl) return;
    sl.className = "msg busy aa-status-center";
    sl.innerHTML = `
      <span class="aa-inline-spinner" aria-hidden="true"></span>
      <span class="aa-status-center-text">${esc(friendlyText(text ?? ""))}</span>
    `;
  }

  function renderRadarLoadingShell() {
    return `
      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Support Radar</div>
          <div class="aa-section-subtitle">Preparing subscriber issues and paging…</div>
        </div>

        <div class="aa-radar-summary">
          <div class="aa-radar-tile aa-radar-tile-problem"><div class="aa-loading-row" style="width:120px"></div><div class="aa-loading-row" style="width:56px; margin-top:10px"></div></div>
          <div class="aa-radar-tile aa-radar-tile-watch"><div class="aa-loading-row" style="width:80px"></div><div class="aa-loading-row" style="width:56px; margin-top:10px"></div></div>
          <div class="aa-radar-tile aa-radar-tile-watch"><div class="aa-loading-row" style="width:110px"></div><div class="aa-loading-row" style="width:56px; margin-top:10px"></div></div>
        </div>

        <div class="aa-radar-repeat-subscribers" style="margin-top:12px; margin-bottom:12px">
          <div class="aa-loading-row" style="width:220px"></div>
        </div>

        <div class="aa-table-wrap">
          <table class="aa-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Issue</th>
                <th>Reason</th>
                <th>Dates</th>
                <th>Subscriber</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:110px"></div></td>
                <td><div class="aa-loading-row" style="width:130px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:150px"></div></td>
                <td><div class="aa-loading-row" style="width:180px"></div></td>
              </tr>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:100px"></div></td>
                <td><div class="aa-loading-row" style="width:120px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:140px"></div></td>
                <td><div class="aa-loading-row" style="width:170px"></div></td>
              </tr>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:95px"></div></td>
                <td><div class="aa-loading-row" style="width:140px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:145px"></div></td>
                <td><div class="aa-loading-row" style="width:175px"></div></td>
              </tr>
              <tr>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:105px"></div></td>
                <td><div class="aa-loading-row" style="width:125px"></div></td>
                <td><div class="aa-loading-row" style="width:90px"></div></td>
                <td><div class="aa-loading-row" style="width:150px"></div></td>
                <td><div class="aa-loading-row" style="width:180px"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function startRadarLoadingUI() {
    stopRadarLoadingUI();

    radarLoadingIndex = 0;

    const tick = () => {
      const msg = RADAR_LOADING_MESSAGES[radarLoadingIndex % RADAR_LOADING_MESSAGES.length];
      const pageSuffix = radarPage > 1 ? ` (page ${radarPage})` : "";
      setRadarLoadingStatus(msg + pageSuffix);
      radarLoadingIndex += 1;
    };

    tick();
    radarLoadingTimer = window.setInterval(tick, 900);

    const results = $("results");
    if (results) {
      results.innerHTML = renderRadarLoadingShell();
    }
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
    const btnLogin = $("btnLogin");
    const btnLogout = $("btnLogout");
    const btnLogout2 = $("btnLogout2");

    if (login) login.style.display = isLoggedIn ? "none" : "grid";
    if (search) search.style.display = isLoggedIn ? "grid" : "none";
    if (btnLogin) btnLogin.style.display = isLoggedIn ? "none" : "";
    if (btnLogout) btnLogout.style.display = isLoggedIn ? "" : "none";
    if (btnLogout2) btnLogout2.style.display = isLoggedIn ? "" : "none";
  }
  function setLoggedOutLanding(isLoggedIn) {
    const idsToToggle = [
      "radarStatusBanner",
      "radarHeroMetrics",
      "radarKpiBand",
      "radarRecoveryOpps",
      "results",
      "btnRawJson"
    ];

    idsToToggle.forEach((id) => {
      const el = $(id);
      if (!el) return;

      if (isLoggedIn) {
        el.classList.remove("is-hidden");
        el.style.display = "";
      } else {
        el.classList.add("is-hidden");
        el.style.display = "none";
      }
    });
  }
let sessionCache = null;

async function refreshSession() {
  // ✅ prevent overlapping calls (THIS is the fix)
  if (sessionCache) return sessionCache;

  sessionCache = (async () => {
    try {
      const r = await fetch(`${WORKER_BASE}/admin/status`, {
        method: "GET",
        credentials: "include"
      });

      if (!r.ok) throw new Error("status not ok");

      const j = await r.json().catch(() => null);

      const loggedIn = !!j?.loggedIn;

      if (loggedIn) {
        setSessionPill(true, j?.user?.name || j?.user?.slug || "admin");
        toggleLoginSearchUI(true);
        setLoggedOutLanding(true);
        return true;
      }

      setSessionPill(false, null);
      toggleLoginSearchUI(false);
      setLoggedOutLanding(false);

      // 🔥 HARD RESET UI STATE
      setDashboardChrome("search");

      return false;

    } catch (err) {
      console.warn("refreshSession failed", err);

      // ⚠️ DO NOT nuke session on transient failure
      return false;

    } finally {
      // allow future refresh after short delay
      setTimeout(() => { sessionCache = null; }, 2000);
    }
  })();

  return sessionCache;
}


  function setDashboardChrome(view) {
  const isPulse = view === "pulse";
  const isRadar = view === "radar";

  const banner = $("radarStatusBanner");
  const hero = $("radarHeroMetrics");
  const kpi = $("radarKpiBand");
  const opps = $("radarRecoveryOpps");

  if (banner) banner.classList.toggle("is-hidden", !isRadar);
  if (hero) hero.classList.toggle("is-hidden", true);
  if (kpi) kpi.classList.toggle("is-hidden", true);
  if (opps) opps.classList.toggle("is-hidden", true);

  const navRadar = $("navRadar");
  const navPulse = $("navPulse");

  navRadar?.classList.toggle("is-active", isRadar);
  navPulse?.classList.toggle("is-active", isPulse);

  const statusLine = $("statusLine");
  const rawBtn = $("btnRawJson");

  if (statusLine) {
    statusLine.style.display = isPulse ? "none" : "";
  }

  if (rawBtn) {
    rawBtn.style.display = isPulse ? "none" : "";
  }
}
  // --------------------------------------------------
  // Pulse renderer contract
  // --------------------------------------------------
  function renderPulseLoadingShellSafe() {
    if (typeof window.renderPulseLoadingShell === "function") {
      return window.renderPulseLoadingShell();
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Pulse Revenue Intelligence</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderPulseLoadingShell is not available.</div>
      </section>
    `;
  }
// 🆕 Pulse inline affected customers state
window.__pulseAffectedCustomers = null;
window.__pulseAffectedGateway = null;

window.setPulseAffectedCustomers = function (gateway, data) {
  window.__pulseAffectedGateway = gateway;
  window.__pulseAffectedCustomers = Array.isArray(data?.customers) ? data.customers : [];

  if (typeof window.doPulseDashboard === "function") {
    window.doPulseDashboard();
  }
};
  function renderPulseDashboardSafe(analysis, summary) {
    if (typeof window.renderPulseDashboard === "function") {
      return window.renderPulseDashboard(analysis, summary);
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Pulse Revenue Intelligence</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderPulseDashboard is not available.</div>
      </section>
    `;
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
function parseDirectLookupQuery(q) {

  const s = String(q ?? "").trim().toLowerCase();

  // order lookup
  let m = s.match(/^order\s*#?\s*(\d+)$/);
  if (m) return { type: "order", id: m[1] };

  // #12345
  m = s.match(/^#(\d+)$/);
  if (m) return { type: "order", id: m[1] };

  // customer lookup
  m = s.match(/^customer\s*#?\s*(\d+)$/);
  if (m) return { type: "customer", id: m[1] };

  // subscription lookup
  m = s.match(/^sub\s*#?\s*(\d+)$/);
  if (m) return { type: "subscription", id: m[1] };

  return null;
}
function getCachedCustomerShellPayloadForQuery(q) {
  const s = String(q ?? "").trim().toLowerCase();
  if (!s || !lastCustomerResult) return null;

  const email = String(
    lastCustomerResult?.email ||
    lastCustomerResult?.billing?.email ||
    ""
  ).trim().toLowerCase();

  const id = String(lastCustomerResult?.id ?? "").trim().toLowerCase();
  const username = String(lastCustomerResult?.username ?? "").trim().toLowerCase();
  const fullName = [
    lastCustomerResult?.first_name,
    lastCustomerResult?.last_name
  ].map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean).join(" ");

  const matches =
    (email && s === email) ||
    (id && (s === id || s === `#${id}` || s === `customer #${id}`)) ||
    (username && s === username) ||
    (fullName && s === fullName);

  if (!matches) return null;

  return {
    ok: true,
    context: {
      customer: lastCustomerResult,
      subscriptions: [],
      orders: [],
      notes: []
    }
  };
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

  const qEl = $("query");
  if (qEl) qEl.value = query;

  // 🔒 prevent race conditions
  abortActiveSearch();

  // 🔥 run ONE controlled search
  setTimeout(() => {
    doSearch(query).catch(console.error);
  }, 0);
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
      ? window.renderAddressBlock("Billing", billing)
      : "";

    const shippingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Shipping", shipping)
      : "";

    return `
      ${customerCard}

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Addresses</div>
          <div class="aa-section-subtitle">Billing and shipping details</div>
        </div>
        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Loading subscriptions</div>
          <div class="aa-section-subtitle">Pulling subscription records for this customer</div>
        </div>
        <div class="aa-loading-rows">
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
        </div>
      </section>

      <section class="card aa-section aa-loading-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Loading orders</div>
          <div class="aa-section-subtitle">Fetching recent order history</div>
        </div>
        <div class="aa-loading-rows">
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
          <div class="aa-loading-row"></div>
        </div>
      </section>
    `;
  }

  function renderTotals(payload) {
    const totals = payload?.totals || {};
    const all = totals?.all || {};
    const wc = totals?.subscriptions || {};
    const sus = totals?.orders || {};

    const subRows = [
      ["Active", wc.active],
      ["On hold", wc.on_hold],
      ["Pending cancel", wc.pending_cancel],
      ["Expired", wc.expired],
      ["Cancelled", wc.cancelled],
      ["Pending", wc.pending]
    ];

    const orderRows = [
      ["Completed", sus.completed],
      ["Processing", sus.processing],
      ["Pending", sus.pending],
      ["On hold", sus.on_hold],
      ["Cancelled", sus.cancelled],
      ["Failed", sus.failed],
      ["Refunded", sus.refunded]
    ];

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Store Totals</div>
          <div class="aa-section-subtitle">Subscription and order counts for the store</div>
        </div>

        <div class="aa-totals-grid">
          <div class="card aa-card aa-totals-card">
            <div class="aa-card-title">Subscriptions</div>
            <table class="aa-totals-table">
              <tbody>
                ${subRows.map(([label, value]) => `
                  <tr>
                    <td>${esc(label)}</td>
                    <td class="aa-num">${esc(formatCount(value))}</td>
                  </tr>
                `).join("")}
                <tr class="aa-totals-divider"><td colspan="2"></td></tr>
                <tr class="aa-totals-total">
                  <td><strong>Total</strong></td>
                  <td class="aa-num"><strong>${esc(formatCount(all.subscriptions))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card aa-card aa-totals-card">
            <div class="aa-card-title">Orders</div>
            <table class="aa-totals-table">
              <tbody>
                ${orderRows.map(([label, value]) => `
                  <tr>
                    <td>${esc(label)}</td>
                    <td class="aa-num">${esc(formatCount(value))}</td>
                  </tr>
                `).join("")}
                <tr class="aa-totals-divider"><td colspan="2"></td></tr>
                <tr class="aa-totals-total">
                  <td><strong>Total</strong></td>
                  <td class="aa-num"><strong>${esc(formatCount(all.orders))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderResults(payload) {
    const ctx = payload?.context || {};
    const customer = ctx.customer || null;
    const subscriptions = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : [];
    const orders = Array.isArray(ctx.orders) ? ctx.orders : [];
    const notes = Array.isArray(ctx.notes) ? ctx.notes : [];

    if (payload?.possible_matches?.length) {
      return renderCandidateMatches(payload);
    }

    if (!customer) {
      return `
        <section class="card aa-section">
          <div class="aa-section-head">
            <div class="aa-section-title">Search Result</div>
            <div class="aa-section-subtitle">No customer context was returned</div>
          </div>
          <div class="aa-muted">No customer found.</div>
        </section>
      `;
    }

    const customerCard = typeof window.renderCustomerCard === "function"
      ? window.renderCustomerCard(customer)
      : "";

    const billingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Billing", customer?.billing)
      : "";

    const shippingCard = typeof window.renderAddressBlock === "function"
      ? window.renderAddressBlock("Shipping", customer?.shipping)
      : "";

    const subscriptionsCard = typeof window.renderSubscriptionsTable === "function"
      ? window.renderSubscriptionsTable(subscriptions, openSubNotes)
      : "";

    const ordersCard = typeof window.renderOrdersTable === "function"
      ? window.renderOrdersTable(orders, openOrderNotes)
      : "";

    const totalsCard = typeof window.renderTotalsCard === "function"
      ? window.renderTotalsCard(payload)
      : "";

    const healthCard = typeof window.renderHealthCard === "function"
      ? window.renderHealthCard(payload)
      : "";

    const activityCard = typeof window.renderCustomerActivity === "function"
      ? window.renderCustomerActivity(payload)
      : "";

    return `
      ${customerCard}

      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Addresses</div>
          <div class="aa-section-subtitle">Billing and shipping details</div>
        </div>
        <div class="aa-grid-2">
          ${billingCard}
          ${shippingCard}
        </div>
      </section>

      ${subscriptionsCard}
      ${ordersCard}
      ${totalsCard}
      ${healthCard}
      ${activityCard}
    `;
  }

  // --------------------------------------------------
  // Radar render
  // --------------------------------------------------
  function renderRadar(payload) {
    if (typeof window.renderRadarResults === "function") {
      return window.renderRadarResults(payload, {
        radarPage,
        radarIssueFilter
      });
    }

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Radar</div>
          <div class="aa-section-subtitle">Renderer not loaded</div>
        </div>
        <div class="aa-muted">renderRadarResults is not available.</div>
      </section>
    `;
  }

  // --------------------------------------------------
  // Fetch actions
  // --------------------------------------------------
  async function doLogin() {
    abortActiveSearch();

    const user = String($("loginUser")?.value || "").trim();
    const pass = String($("loginPass")?.value || "").trim();

    if (!user || !pass) {
      setStatus("warn", "Enter username and password.");
      return;
    }

    setStatus("busy aa-status-center", "");
    const sl = $("statusLine");
    if (sl) {
      sl.innerHTML = `
        <span class="aa-inline-spinner" aria-hidden="true"></span>
        <span class="aa-status-center-text">Logging in…</span>
      `;
    }

    const r = await fetch(`${WORKER_BASE}/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass })
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.success) {
      setSessionPill(false, null);
      toggleLoginSearchUI(false);
      setStatus("warn", friendlyText(j?.message || j?.error || "Login failed."));
      return;
    }

    setSessionPill(true, j?.user?.name || j?.user?.slug || user);
    toggleLoginSearchUI(true);
    setLoggedOutLanding(true);
    setStatus("", "Logged in.");
    await doPulseDashboard();
  }

  async function doLogout() {
    abortActiveSearch();

    try {
      await fetch(`${WORKER_BASE}/admin/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (_) {}

    setSessionPill(false, null);
    toggleLoginSearchUI(false);
    setLoggedOutLanding(false);
    setStatus("", "Logged out.");

    const results = $("results");
    if (results) results.innerHTML = "";
    lastPayload = null;
    lastRaw = null;
    renderRawJson();
  }

  async function doSearch(searchOverride) {
    abortActiveSearch();

    const q =
      typeof searchOverride === "string"
        ? String(searchOverride).trim()
        : String($("query")?.value || "").trim();

    if (!q) {
      setStatus("warn", "Enter a search query.");
      return;
    }

    currentSearchController = new AbortController();
    const signal = currentSearchController.signal;

    lastMode = "search";
    setDashboardChrome("search");
    setStatus("busy aa-status-center", "");
    const sl = $("statusLine");
    if (sl) {
      sl.innerHTML = `
        <span class="aa-inline-spinner" aria-hidden="true"></span>
        <span class="aa-status-center-text">Searching…</span>
      `;
    }

    const results = $("results");
    if (results) {
      results.innerHTML = "";
    }

    const cachedShell = isLikelyEmailLookupQuery(q) ? getCachedCustomerShellPayloadForQuery(q) : null;
    if (results && cachedShell) {
      results.innerHTML = renderProgressiveShell(cachedShell);
      bindNotesToggles(results);
      bindCopyButtons(results);
      bindOpenCandidateButtons(results);
    }

    try {
      const direct = parseDirectLookupQuery(q);

const r = await fetch(`${WORKER_BASE}/admin/nl-search`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query: q
  }),
  signal
});

      const j = await r.json().catch(() => null);

      if (signal.aborted) return;

      if (!r.ok || !j?.ok) {
        setStatus("warn", friendlyText(j?.error || "Search failed."));
        if (results && !cachedShell) results.innerHTML = "";
        return;
      }

      lastPayload = j;
      lastRaw = j;
      cacheLastCustomerFromPayload(j);

      if (results) {
        results.innerHTML = renderResults(j);
        bindNotesToggles(results);
        bindCopyButtons(results);
        bindOpenCandidateButtons(results);
      }

      setStatus("", "Search complete.");
      renderRawJson();
    } catch (err) {
      if (signal.aborted) return;
      setStatus("warn", friendlyText(err?.message || "Search failed."));
      if (results && !cachedShell) results.innerHTML = "";
    } finally {
      if (currentSearchController?.signal === signal) {
        currentSearchController = null;
      }
    }
  }



  async function doRadar(page = 1, issue = "") {
    abortActiveSearch();
    radarPage = page;
    radarIssueFilter = issue || "";
    lastMode = "radar";
    setDashboardChrome("radar");
    startRadarLoadingUI();

    try {
      const params = new URLSearchParams();
      params.set("page", String(radarPage));
      if (radarIssueFilter) params.set("issue", radarIssueFilter);

      const r = await fetch(`${WORKER_BASE}/admin/radar?${params.toString()}`, {
        method: "GET",
        credentials: "include"
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        stopRadarLoadingUI();
        setStatus("warn", friendlyText(j?.error || "Radar failed."));
        return;
      }

      lastPayload = j;
      lastRaw = j;

      const results = $("results");
      if (results) {
        results.innerHTML = renderRadar(j);
        bindNotesToggles(results);
        bindCopyButtons(results);
        bindOpenCandidateButtons(results);

        results.querySelectorAll("[data-radar-page]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const next = Number(btn.getAttribute("data-radar-page") || "1") || 1;
            doRadar(next, radarIssueFilter).catch(console.error);
          });
        });

        results.querySelectorAll("[data-radar-issue]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const nextIssue = String(btn.getAttribute("data-radar-issue") || "");
            radarPage = 1;
            doRadar(1, nextIssue).catch(console.error);
          });
        });
      }

      updateRadarStatus(j);
      stopRadarLoadingUI();
      setStatus("", "Radar loaded.");
      renderRawJson();
    } catch (err) {
      stopRadarLoadingUI();
      setStatus("warn", friendlyText(err?.message || "Radar failed."));
    }
  }

  async function doPulseDashboard() {
    abortActiveSearch();
    lastMode = "pulse";
    setDashboardChrome("pulse");
    setStatus("busy aa-status-center", "");
    const sl = $("statusLine");
    if (sl) {
      sl.innerHTML = `
        <span class="aa-inline-spinner" aria-hidden="true"></span>
        <span class="aa-status-center-text">Loading Pulse dashboard…</span>
      `;
    }

    const results = $("results");
      if (results) {
        results.innerHTML = renderPulseLoadingShellSafe();
      }

    try {
      const [analysisRes, summaryRes] = await Promise.all([
        fetch(`${PULSE_WORKER_BASE}/pulse/failure-analysis`, { method: "GET" }),
        fetch(`${PULSE_WORKER_BASE}/pulse/summary`, { method: "GET" })
      ]);

      const analysisJson = await analysisRes.json().catch(() => null);
      const summaryJson = await summaryRes.json().catch(() => null);

      if (!analysisRes.ok || !analysisJson?.ok) {
        setStatus("warn", friendlyText(analysisJson?.error || "Pulse analysis failed."));
        return;
      }

      if (!summaryRes.ok || !summaryJson?.ok) {
        setStatus("warn", friendlyText(summaryJson?.error || "Pulse summary failed."));
        return;
      }

      lastPayload = {
        ok: true,
        pulse: {
          analysis: analysisJson,
          summary: summaryJson
        }
      };
      lastRaw = lastPayload;

      if (results) {
        results.innerHTML = renderPulseDashboardSafe(analysisJson, summaryJson);
      }

      setStatus("", "Pulse dashboard loaded.");
      renderRawJson();
    } catch (err) {
      setStatus("warn", friendlyText(err?.message || "Pulse dashboard failed."));
    }
  }
window.doPulseDashboard = doPulseDashboard;
window.doSearch = doSearch;
window.doCustomerSearch = doSearch;
window.doCustomerSearchByEmail = function (email) {
  return doSearch(email);
};
  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function friendlyText(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0) || 0);
  }

  // --------------------------------------------------
  // Init / events
  // --------------------------------------------------
  $("btnLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    doLogin().catch(console.error);
  });

  $("btnSearch")?.addEventListener("click", (e) => {
    e.preventDefault();
    doSearch().catch(console.error);
  });



$("btnRadar")?.addEventListener("click", (e) => {
  e.preventDefault();
  doRadar(1, "").catch(console.error);
});

  $("btnPulse")?.addEventListener("click", (e) => {
    e.preventDefault();
    doPulseDashboard().catch(console.error);
  });
$("btnRunScan")?.addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    setStatus("busy", "Running scan…");

    const scanRes = await fetch(`${PULSE_WORKER_BASE}/scanner/run`, {
      method: "GET"
    });

    const scanData = await scanRes.json().catch(() => null);

    if (!scanRes.ok || !scanData?.ok) {
      setStatus("warn", friendlyText(scanData?.error || "Scan failed."));
      return;
    }

    const summaryRes = await fetch(`${PULSE_WORKER_BASE}/pulse/summary`, {
      method: "GET"
    });

    const summaryData = await summaryRes.json().catch(() => null);

    if (!summaryRes.ok || !summaryData?.ok) {
      setStatus("warn", friendlyText(summaryData?.error || "Pulse summary failed after scan."));
      return;
    }

    setStatus("", `Scan complete — ${scanData?.scanned || 0} scanned, ${scanData?.incidents_created || 0} incidents created.`);

    try {
      localStorage.setItem("pulse_last_scan", JSON.stringify({
        time: Date.now(),
        processed: Number(scanData?.scanned || 0),
        incidents_created: Number(scanData?.incidents_created || 0),
        incidents_skipped: Number(scanData?.incidents_skipped || 0),
        recoverable: Number(summaryData?.recoverable_revenue || 0),
        failed_total: Number(summaryData?.failed_subscriptions || 0)
      }));
    } catch (_) {}

    await doPulseDashboard();
  } catch (err) {
    console.error(err);
    setStatus("warn", "Scan failed");
  }
});

$("btnLogout")?.addEventListener("click", (e) => {    e.preventDefault();
    doLogout().catch(console.error);
  });

  $("btnLogout2")?.addEventListener("click", (e) => {
    e.preventDefault();
    doLogout().catch(console.error);
  });

  $("btnRawJson")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleRawJson();
  });

  $("loginPass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doLogin().catch(console.error);
    }
  });

  $("loginUser")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doLogin().catch(console.error);
    }
  });

  $("query")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch().catch(console.error);
    }
  });

  $("navRadar")?.addEventListener("click", (e) => {
    e.preventDefault();
    doRadar(1, "").catch(console.error);
  });

  $("navPulse")?.addEventListener("click", (e) => {
    e.preventDefault();
    doPulseDashboard().catch(console.error);
  });

  window.addEventListener("DOMContentLoaded", async () => {
    const loggedIn = await refreshSession().catch(() => false);

    if (loggedIn) {
      doPulseDashboard().catch(console.error);
    } else {
      setStatus("", "Enter WordPress credentials to begin.");
    }
  });
})();
// 🔴 main.js