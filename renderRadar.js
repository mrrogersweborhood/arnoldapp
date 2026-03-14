// 🟢 renderRadar.js
// Arnold Admin — Radar renderer (clickable ID -> lookup)

window.renderRadar = function (data) {

  const items = Array.isArray(data?.items) ? data.items : [];
// Top Recovery Opportunities
// Top Recovery Opportunities
const oppGrid = document.getElementById("radarOppsGrid");

if (oppGrid) {
  if (!items.length) {
    oppGrid.innerHTML = `
      <div class="aa-opp-card aa-opp-placeholder">
        <div class="aa-opp-title">No recovery opportunities right now.</div>
      </div>
    `;
  } else {
    const recoveryRank = (r) => {
      const reasonUpper = String(r?.reason || "").toUpperCase();
      const rawIssue = String(r?.issue || "").toLowerCase();

      if (reasonUpper.includes("SAVED PAYMENT") || reasonUpper.includes("CARD_EXPIRED") || reasonUpper.includes("EXPIRED")) return 1;
      if (reasonUpper.includes("DECLINED")) return 2;
      if (reasonUpper.includes("INSUFFICIENT")) return 3;
      if (rawIssue === "on-hold") return 4;
      if (rawIssue === "pending-cancel") return 5;
      if (reasonUpper.includes("SQUARE")) return 8;

      return 10;
    };

    const ranked = [...items]
      .sort((a, b) => {
        const rankDiff = recoveryRank(a) - recoveryRank(b);
        if (rankDiff !== 0) return rankDiff;

        const aValue = Number(a?.total || a?._source_order?.total || 0);
        const bValue = Number(b?.total || b?._source_order?.total || 0);
        if (aValue !== bValue) return bValue - aValue;

        const aTs = a?.date ? new Date(a.date).getTime() : 0;
        const bTs = b?.date ? new Date(b.date).getTime() : 0;
        return bTs - aTs;
      })
      .slice(0, 3);

    oppGrid.innerHTML = ranked.map((r) => {
      const displayName = r?.customer_name || "Subscriber";
      const displayEmail = r?.email || "";
      const displayReason = r?.reason || "Payment issue";
      const displayValue = Number(r?.total || r?._source_order?.total || 0);
      const valueText = displayValue > 0
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2
          }).format(displayValue)
        : "—";

return `
  <button
    type="button"
    class="aa-opp-card aa-candidate-open-btn"
    data-open-query="${displayEmail}"
    title="Open subscriber by email"
    style="cursor:pointer"
  >
    <div class="aa-opp-title">${displayName}</div>
    <div class="aa-opp-value">${valueText}</div>
    <div class="aa-opp-reason">${displayReason}</div>
    <div class="aa-opp-email">${displayEmail}</div>
  </button>
`;
    }).join("");
  }
}  const visible = items.length;
  const total = data?.total_actionable_items ?? visible;

  const summary = data?.summary || {};
  const failedRenewals = Number(summary.failedRenewals || 0);
  const onHold = Number(summary.onHold || 0);
  const pendingCancel = Number(summary.pendingCancel || 0);
  const recentExpired = Number(summary.recentExpired || 0);
const revenueAtRisk = Number(summary.revenueAtRisk || 0);
const revenueAtRiskDisplay = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
}).format(revenueAtRisk);
  const activeIssue = String(data?.active_issue_filter || "").trim();
  const repeatCount = Array.from(
  new Set(
    items
      .map((r) => String(r?.email || "").trim().toLowerCase())
      .filter(Boolean)
  )
).filter((emailKey) => {
  return items.filter((r) => String(r?.email || "").trim().toLowerCase() === emailKey).length > 1;
}).length;

// Populate dashboard KPI header band
const kpiFailed = document.getElementById("radarKpiFailed");
const kpiOnHold = document.getElementById("radarKpiOnHold");
const kpiPendingCancel = document.getElementById("radarKpiPendingCancel");
const kpiRepeat = document.getElementById("radarKpiRepeat");
const kpiRevenue = document.getElementById("radarKpiRevenue");
const kpiExpired = document.getElementById("radarKpiExpired");

if (kpiFailed) kpiFailed.textContent = failedRenewals;
if (kpiOnHold) kpiOnHold.textContent = onHold;
if (kpiPendingCancel) kpiPendingCancel.textContent = pendingCancel;
if (kpiRepeat) kpiRepeat.textContent = repeatCount;
if (kpiRevenue) kpiRevenue.textContent = revenueAtRiskDisplay;
if (kpiExpired) kpiExpired.textContent = recentExpired;  let radarAlert = "";

  if (failedRenewals > 0) {
    radarAlert = `
      <div class="aa-health-alert aa-health-alert-problem">
        ⚠ ${failedRenewals} failed renewal${failedRenewals === 1 ? "" : "s"} require attention
      </div>
    `;
  } else if (onHold > 0) {
    radarAlert = `
      <div class="aa-health-alert aa-health-alert-watch">
        ${onHold} subscription${onHold === 1 ? "" : "s"} currently on hold
      </div>
    `;
  }



const summaryTiles = `
  <div class="aa-radar-summary">
    <button
      type="button"
      class="aa-radar-tile aa-radar-tile-problem aa-radar-summary-filter${activeIssue === "failed-renewal" ? " is-active" : ""}"
      data-issue="failed-renewal"
    >
      <div class="aa-radar-tile-label">Failed renewals</div>
      <div class="aa-radar-tile-value">${failedRenewals}</div>
    </button>

    <button
      type="button"
      class="aa-radar-tile aa-radar-tile-watch aa-radar-summary-filter${activeIssue === "on-hold" ? " is-active" : ""}"
      data-issue="on-hold"
    >
      <div class="aa-radar-tile-label">On hold</div>
      <div class="aa-radar-tile-value">${onHold}</div>
    </button>

    <button
      type="button"
      class="aa-radar-tile aa-radar-tile-watch aa-radar-summary-filter${activeIssue === "pending-cancel" ? " is-active" : ""}"
      data-issue="pending-cancel"
    >
      <div class="aa-radar-tile-label">Pending cancel</div>
      <div class="aa-radar-tile-value">${pendingCancel}</div>
    </button>

    <div class="aa-radar-tile aa-radar-tile-muted">
      <div class="aa-radar-tile-label">Repeat offenders</div>
      <div class="aa-radar-tile-value">${repeatCount}</div>
    </div>

    <div class="aa-radar-tile aa-radar-tile-muted">
      <div class="aa-radar-tile-label">Recently expired</div>
      <div class="aa-radar-tile-value">${recentExpired}</div>
    </div>
<div class="aa-radar-tile aa-radar-tile-problem">
  <div class="aa-radar-tile-label">Revenue at risk</div>
  <div class="aa-radar-tile-value">${revenueAtRiskDisplay}</div>
</div>
  </div>
`;

  if (!items.length) {
    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Support Radar</div>
          <div class="aa-section-subtitle">${activeIssue ? `Filtered: ${activeIssue}` : "Subscribers requiring attention"}</div>
        </div>

        ${radarAlert}
        ${summaryTiles}

        <div class="aa-muted">No Subscribers requiring attention.</div>

        <div class="aa-radar-footer">
          <div class="aa-radar-count">
            Showing 0 of ${total} actionable problems
          </div>

          <div class="aa-radar-paging">
            <button class="aa-btn aa-radar-prev" disabled>Previous</button>
            <span class="aa-radar-page">Page 1</span>
            <button class="aa-btn aa-radar-next" disabled>Next</button>
          </div>
        </div>
      </section>
    `;
  }
// Build repeat-customer index
const repeatIndex = {};

items.forEach((r) => {
  const email = String(r?.email || "").trim().toLowerCase();
  if (!email) return;
  repeatIndex[email] = (repeatIndex[email] || 0) + 1;
});
const repeatSubscribers = Object.entries(repeatIndex)
  .filter(([, count]) => count > 1)
  .map(([emailKey, count]) => {
    const match = items.find((r) => String(r?.email || "").trim().toLowerCase() === emailKey);
    const displayEmail = match?.email || emailKey;
    const displayName = match?.customer_name || "Subscriber";
    return {
      emailKey,
      displayEmail,
      displayName,
      count
    };
  })
  .sort((a, b) => b.count - a.count || a.displayEmail.localeCompare(b.displayEmail));

const repeatSubscribersStrip = repeatSubscribers.length
  ? `
<div class="aa-radar-repeat-subscribers" style="margin-top:12px; margin-bottom:12px">
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center">
          <strong>Repeat Problem Subscribers: ${repeatSubscribers.length}</strong>
          ${repeatSubscribers.slice(0, 8).map((s) => `
            <button
              type="button"
              class="aa-order-id aa-candidate-open-btn"
              data-open-query="${s.displayEmail}"
              title="${s.displayName}"
              style="background:none;border:none;cursor:pointer;padding:0;font:inherit"
            >
              ${s.displayEmail} (${s.count})
            </button>
          `).join("")}
        </div>
      </div>
    `
  : "";
const rows = [...items]
  .sort((a, b) => {
    const aTs = a?.date ? new Date(a.date).getTime() : 0;
    const bTs = b?.date ? new Date(b.date).getTime() : 0;

    const aAgeHours = aTs ? (Date.now() - aTs) / 3600000 : Number.POSITIVE_INFINITY;
    const bAgeHours = bTs ? (Date.now() - bTs) / 3600000 : Number.POSITIVE_INFINITY;

    const getBand = (ageHours) => {
      if (ageHours < 24) return 0;
      if (ageHours < 72) return 1;
      if (ageHours < 168) return 2;
      return 3;
    };

    const aBand = getBand(aAgeHours);
    const bBand = getBand(bAgeHours);

    if (aBand !== bBand) return aBand - bBand;

    const aEmail = String(a?.email || "").trim().toLowerCase();
    const bEmail = String(b?.email || "").trim().toLowerCase();

    const aRepeatCount = repeatIndex[aEmail] || 0;
    const bRepeatCount = repeatIndex[bEmail] || 0;
const aValue = Number(a?.total || a?._source_order?.total || 0);
const bValue = Number(b?.total || b?._source_order?.total || 0);
    const aIsRepeat = aRepeatCount > 1 ? 1 : 0;
    const bIsRepeat = bRepeatCount > 1 ? 1 : 0;

    if (aIsRepeat !== bIsRepeat) return bIsRepeat - aIsRepeat;
// prioritize higher-value recoveries
if (aValue !== bValue) return bValue - aValue;
    return bTs - aTs;
  })
  .map((r) => {
    const displayId = String(r.display_id || "").trim();
    const orderIdMatch = displayId.match(/order\s*#?\s*(\d+)/i);
    const subIdMatch = displayId.match(/sub\s*#?\s*(\d+)/i);

    const orderId = orderIdMatch ? orderIdMatch[1] : "";
    const subId = subIdMatch ? subIdMatch[1] : "";

    const name = r.customer_name || "—";
    const email = r.email || "—";
let repeatBadge = "";

const emailKey = String(email).trim().toLowerCase();
const repeatCount = repeatIndex[emailKey] || 0;

if (repeatCount > 1) {
  repeatBadge = `
    <span class="aa-pill aa-pill-danger" style="margin-left:6px">
      Repeat (${repeatCount})
    </span>
  `;
}
    const rawIssue = r.issue || "";
    const reason = r.reason || "—";
let severityClass = "";

if (rawIssue === "failed-renewal") severityClass = " aa-radar-row-failure";
else if (rawIssue === "on-hold") severityClass = " aa-radar-row-warning";
else if (rawIssue === "pending-cancel") severityClass = " aa-radar-row-neutral";
const itemValue = Number(r?.total || r?._source_order?.total || 0);

let valueClass = "";
if (itemValue >= 100) valueClass = " aa-radar-value-high";
else if (itemValue >= 50) valueClass = " aa-radar-value-medium";

const itemValueDisplay = itemValue > 0
  ? new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(itemValue)
  : "—";
let suggestedAction = "Review subscriber";
let actionClass = " aa-pill-retention";

const reasonLower = String(reason).toLowerCase();

if (reasonLower.includes("expired")) {
  suggestedAction = "Update payment method";
  actionClass = " aa-pill-update";
}
else if (reasonLower.includes("saved payment")) {
  suggestedAction = "Update payment method";
  actionClass = " aa-pill-update";
}
else if (reasonLower.includes("declined")) {
  suggestedAction = "Contact customer";
  actionClass = " aa-pill-contact";
}
else if (reasonLower.includes("insufficient")) {
  suggestedAction = "Retry tomorrow";
  actionClass = " aa-pill-retry";
}
else if (reasonLower.includes("square")) {
  suggestedAction = "Investigate gateway";
  actionClass = " aa-pill-gateway";
}
else if (rawIssue === "on-hold") {
  suggestedAction = "Resume subscription";
  actionClass = " aa-pill-retry";
}
else if (rawIssue === "pending-cancel") {
  suggestedAction = "Retention follow-up";
  actionClass = " aa-pill-retention";
}
let date = "—";
let recentClass = "";

if (r.date) {
  const d = new Date(r.date);
  date = d.toLocaleDateString();

  const ageHours = (Date.now() - d.getTime()) / 3600000;

  if (ageHours < 24) {
    recentClass = " aa-radar-recent-urgent";
  } else if (ageHours < 72) {
    recentClass = " aa-radar-recent";
  } else if (ageHours < 168) {
    recentClass = " aa-radar-recent-soft";
  }
}
    let issueLabel = "—";
    let issueClass = "aa-pill-neutral";

    if (rawIssue === "failed-renewal") {
      issueLabel = "Failed renewal";
      issueClass = "aa-pill-danger";
    } else if (rawIssue === "on-hold") {
      issueLabel = "On hold";
      issueClass = "aa-pill-warning";
    } else if (rawIssue === "pending-cancel") {
      issueLabel = "Pending cancel";
      issueClass = "aa-pill-warning";
    } else if (rawIssue === "expired") {
      issueLabel = "Recent expired";
      issueClass = "aa-pill-muted";
    } else if (rawIssue) {
      issueLabel = rawIssue;
    }

    const issue = `
      <button
        type="button"
        class="aa-pill ${issueClass} aa-radar-issue-filter${activeIssue === rawIssue ? " is-active" : ""}"
        data-issue="${rawIssue}"
        style="border:none;cursor:pointer"
      >
        ${issueLabel}
      </button>
    `;

    const orderQuery = orderId ? `order ${orderId}` : "";
    const subQuery = subId ? `subscription ${subId}` : "";

    return `
      <tr class="${recentClass}${severityClass}">
        <td class="aa-radar-col-id">
          ${orderId ? `
          <button
            type="button"
            class="aa-order-id aa-candidate-open-btn"
            data-open-query="${orderQuery}"
            style="background:none;border:none;cursor:pointer;padding:0;font:inherit"
          >
            ${orderId}
          </button>
          ` : "—"}
        </td>
        <td class="aa-radar-col-sub">
          ${subId ? `
          <button
            type="button"
            class="aa-order-id aa-candidate-open-btn"
            data-open-query="${subQuery}"
            style="background:none;border:none;cursor:pointer;padding:0;font:inherit"
          >
            ${subId}
          </button>
          ` : "—"}
        </td>
<td class="aa-radar-col-value${valueClass}">${itemValueDisplay}</td>
        <td class="aa-radar-col-issue">${issue}</td>
<td class="aa-radar-col-reason">${reason}</td>
<td class="aa-radar-col-action">
  <span class="aa-pill${actionClass}">${suggestedAction}</span>
</td>
<td class="aa-radar-col-date">${date}</td>
        <td class="aa-radar-col-customer">${name}${repeatBadge}</td>
        <td class="aa-radar-col-email">
  <button
    type="button"
    class="aa-radar-email-link aa-candidate-open-btn"
    data-open-query="${email}"
    title="Open subscriber by email"
  >
    ${email}
  </button>
</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="card aa-section">
      <div class="aa-section-head">
        <div class="aa-section-title">Support Radar</div>
        <div class="aa-section-subtitle">${activeIssue ? `Filtered: ${activeIssue}` : "Subscribers requiring attention"}</div>
      </div>

      ${radarAlert}
      ${summaryTiles}
      ${repeatSubscribersStrip}

      <div class="aa-table-wrap">
        <table class="aa-table">
                    <thead>
            <tr>
              <th class="aa-radar-th-id">Order</th>
<th class="aa-radar-th-sub">Subscription</th>
<th class="aa-radar-th-value">Value</th>
<th class="aa-radar-th-issue">Issue</th>
<th class="aa-radar-th-reason">Reason</th>
<th class="aa-radar-th-action">Action</th>
<th class="aa-radar-th-date">Dates</th>
              <th class="aa-radar-th-customer">Subscriber</th>
              <th class="aa-radar-th-email">Email</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div class="aa-radar-footer">
        <div class="aa-radar-count">
          Showing ${visible} of ${total} actionable problems
        </div>

        <div class="aa-radar-paging">
          <button class="aa-btn aa-radar-prev">Previous</button>
          <span class="aa-radar-page">Page 1</span>
          <button class="aa-btn aa-radar-next">Next</button>
        </div>
      </div>
    </section>
  `;
};

// 🔴 renderRadar.js