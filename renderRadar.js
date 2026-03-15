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
let failureDate = "";

if (r?.date) {
  const d = new Date(r.date);
  const now = new Date();

  const opts =
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };

  failureDate = d.toLocaleDateString("en-US", opts);
}
return `
  <button
    type="button"
    class="aa-opp-card aa-candidate-open-btn"
    data-open-query="${displayEmail}"
    title="Open subscriber by email"
    style="cursor:pointer"
  >
<div class="aa-opp-title">${displayName}</div>
<div class="aa-opp-value">
  <span class="aa-opp-revenue">${valueText}</span>
  <span class="aa-opp-risk-label">at risk</span>
</div>
<div class="aa-opp-reason">${displayReason}</div>
<div class="aa-opp-date">Failed ${failureDate}</div>
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

const heroRecoverable = document.getElementById("heroRecoverable");
const heroAtRisk = document.getElementById("heroAtRisk");
const heroFailed = document.getElementById("heroFailed");
const heroGateway = document.getElementById("heroGateway");

const revenueAtRiskDisplay = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
}).format(revenueAtRisk);
  const activeIssue = String(data?.active_issue_filter || "").trim();
const squareFailureCount = items.filter((r) =>
  String(r?.reason || "").toLowerCase().includes("square")
).length;

const authFailureCount = items.filter((r) => {
  const reason = String(r?.reason || "").toLowerCase();
  return reason.includes("authentication required") || reason.includes("authentication failed");
}).length;
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
if (kpiExpired) kpiExpired.textContent = recentExpired;  
const gatewaySignals = data?.radar_signals || {};
const gatewayFailureCount5m = Number(gatewaySignals.gateway_failure_count_5m || 0);
const gatewayFailureCount30m = Number(gatewaySignals.gateway_failure_count_30m || 0);
const gatewayFailureCount60m = Number(gatewaySignals.gateway_failure_count_60m || 0);
const gatewayFailureTrend = String(gatewaySignals.gateway_failure_trend || "stable").toLowerCase();
const gatewayOutage = !!gatewaySignals.gateway_outage_detected;
const gatewayEscalating = !!gatewaySignals.gateway_escalating;

let squareStatus = "OK";
if (gatewayOutage) {
  squareStatus = "DEGRADED";
} else if (gatewayFailureCount5m >= 3) {
  squareStatus = "ELEVATED";
}

const gatewayHealthPanel = `
  <div class="aa-health-alert aa-health-alert-muted" style="margin-bottom:12px">
    <strong>Gateway Health</strong><br>
    Square — ${squareStatus}
  </div>
`;
const gatewayIncidents = Array.isArray(data?.gateway_incidents)
  ? data.gateway_incidents
  : [];

const gatewayIncidentPanel = gatewayIncidents.length
  ? gatewayIncidents.map((incident) => {
      const gatewayNameRaw = String(incident?.gateway || "gateway").trim();
      const gatewayName =
        gatewayNameRaw.charAt(0).toUpperCase() + gatewayNameRaw.slice(1);

      const status = String(incident?.status || "elevated").toUpperCase();
      const failures5m = Number(incident?.failures_5m || 0);
      const failures30m = Number(incident?.failures_30m || 0);
      const failures60m = Number(incident?.failures_60m || 0);
      const trend = String(incident?.failure_trend || "stable").toLowerCase();
      const affectedSubscribers5m = Number(incident?.affected_subscribers_5m || 0);
      const revenueAtRisk5m = Number(incident?.revenue_at_risk_5m || 0);

      const revenueText = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      }).format(revenueAtRisk5m);

      const trendLabel =
        trend === "increasing"
          ? "↑ increasing"
          : trend === "cooling"
            ? "↓ cooling"
            : "→ stable";

      return `
        <div class="aa-health-alert aa-health-alert-problem" style="margin-bottom:12px">
          <strong>⚠ Gateway Incident</strong><br>
          ${gatewayName} — ${status}<br>
          5m: ${failures5m} • 30m: ${failures30m} • 60m: ${failures60m}<br>
          Trend: ${trendLabel}<br>
          ${affectedSubscribers5m} subscriber${affectedSubscribers5m === 1 ? "" : "s"} affected in 5m •
          ${revenueText} at risk in 5m
        </div>
      `;
    }).join("")
  : "";let radarAlert = "";

if (gatewayEscalating) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-problem">
      ⚠ Escalating gateway outage detected — ${gatewayFailureCount5m} failure${gatewayFailureCount5m === 1 ? "" : "s"} in 5m, ${gatewayFailureCount30m} in 30m, ${gatewayFailureCount60m} in 60m • trend ${gatewayFailureTrend}
    </div>
  `;
}
else if (gatewayOutage) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-problem">
      ⚠ Possible gateway outage — ${gatewayFailureCount5m} gateway failure${gatewayFailureCount5m === 1 ? "" : "s"} in the last 5 minutes
    </div>
  `;
}
else if (squareFailureCount >= 3) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-problem">
      ⚠ Square gateway failures detected across multiple subscribers
    </div>
  `;
}
else if (authFailureCount >= 3) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-watch">
      ⚠ Payment authentication failures increasing
    </div>
  `;
}
else if (failedRenewals >= 10) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-problem">
      ⚠ High volume of failed renewals detected today
    </div>
  `;
}
else if (failedRenewals > 0) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-problem">
      ⚠ ${failedRenewals} failed renewal${failedRenewals === 1 ? "" : "s"} require attention
    </div>
  `;
}
else if (onHold >= 10) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-watch">
      ⚠ Unusual number of subscriptions moved to On Hold
    </div>
  `;
}
else if (onHold > 0) {
  radarAlert = `
    <div class="aa-health-alert aa-health-alert-watch">
      ${onHold} subscription${onHold === 1 ? "" : "s"} currently on hold
    </div>
  `;
}

const recoverableItems = items.filter((r) => {
  const type = String(r?.recovery_type || "").trim().toLowerCase();
  return (
    type === "update_payment_method" ||
    type === "retry_payment"
  );
});

let recoverableRevenue = 0;
for (const r of recoverableItems) {
  const value = Number(r?.total || r?._source_order?.total || 0);
  if (!Number.isNaN(value)) recoverableRevenue += value;
}

const recoverableRevenueDisplay = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
}).format(recoverableRevenue);

const recoveryTypeCounts = {};
for (const r of recoverableItems) {
  const label = String(r?.recovery_label || "Review subscription").trim();
  recoveryTypeCounts[label] = (recoveryTypeCounts[label] || 0) + 1;
}

const topRecoveryActions = Object.entries(recoveryTypeCounts)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 3);

const recoveryInsightPanel = recoverableItems.length
  ? `
    <div class="aa-health-alert aa-health-alert-watch" style="margin-bottom:12px">
      <strong>Recovery Insight</strong><br>
      ${recoverableRevenueDisplay} recoverable revenue detected across ${recoverableItems.length} recoverable payment failure${recoverableItems.length === 1 ? "" : "s"}.
      ${topRecoveryActions.length ? `<br>Primary recovery actions: ${topRecoveryActions.map(([label, count]) => `${label} (${count})`).join(" • ")}` : ""}
    </div>
  `
  : "";


if (heroRecoverable) heroRecoverable.textContent = recoverableRevenueDisplay;
if (heroAtRisk) heroAtRisk.textContent = revenueAtRiskDisplay;
if (heroFailed) heroFailed.textContent = failedRenewals;
if (heroGateway) heroGateway.textContent = squareStatus;

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

${gatewayHealthPanel}
${gatewayIncidentPanel}
${radarAlert}
${recoveryInsightPanel}
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

const recoveryScore = (r) => {
  let score = 0;

  const reason = String(r?.reason || "").toLowerCase();
  const email = String(r?.email || "").trim().toLowerCase();
  const value = Number(r?.total || r?._source_order?.total || 0);

  if (reason.includes("square") || reason.includes("gateway")) score += 50;
  else if (reason.includes("expired")) score += 40;
  else if (reason.includes("declined")) score += 35;
  else if (reason.includes("insufficient")) score += 30;

  if ((repeatIndex[email] || 0) > 1) score += 25;

  if (value >= 100) score += 20;
  else if (value >= 50) score += 10;

if (r?.date) {
  const ageHours = (Date.now() - new Date(r.date).getTime()) / 3600000;

  if (ageHours < 24) {
    score += 20;
  }
  else if (ageHours < 72) {
    score += 10;
  }
  else if (ageHours < 168) { // 7 days
    score += 5;
  }
  else if (ageHours > 720) { // 30 days
    score -= 20;
  }
}

  return score;
};

const topRecoveryQueue = [...items]
  .filter((r) => {
    const type = String(r?.recovery_type || "").trim().toLowerCase();
    return (
      type === "update_payment_method" ||
      type === "retry_payment" ||
      type === "investigate_gateway"
    );
  })
  .sort((a, b) => {
    const aScore = recoveryScore(a);
    const bScore = recoveryScore(b);
    if (aScore !== bScore) return bScore - aScore;

    const aValue = Number(a?.total || a?._source_order?.total || 0);
    const bValue = Number(b?.total || b?._source_order?.total || 0);
    if (aValue !== bValue) return bValue - aValue;

    const aTs = a?.date ? new Date(a.date).getTime() : 0;
    const bTs = b?.date ? new Date(b.date).getTime() : 0;
    return bTs - aTs;
  })
  .slice(0, 5);

const recoveryQueueStrip = topRecoveryQueue.length
  ? `
<div class="aa-radar-repeat-subscribers" style="margin-top:12px; margin-bottom:12px">
  <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center">
    <strong>Top Recovery Queue:</strong>
    ${topRecoveryQueue.map((r) => {
      const email = String(r?.email || "").trim();
      const name = String(r?.customer_name || "Subscriber").trim();
      const score = recoveryScore(r);
      const value = Number(r?.total || r?._source_order?.total || 0);
      const valueText = value > 0
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2
          }).format(value)
        : "—";

      return `
        <button
          type="button"
          class="aa-order-id aa-candidate-open-btn"
          data-open-query="${email}"
          title="${name}"
          style="background:none;border:none;cursor:pointer;padding:0;font:inherit"
        >
          ${name} (${valueText}, score ${score})
        </button>
      `;
    }).join("")}
  </div>
</div>
`
  : "";
const rows = items.map((r) => {
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

/* ---------------------------------------------------
   Gateway outage protection
   --------------------------------------------------- */

if (gatewayOutage) {

  suggestedAction = "Investigate gateway outage";
  actionClass = " aa-pill-gateway";

}

else if (reasonLower.includes("expired")) {

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
  const now = new Date();

  const opts =
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };

  date = d.toLocaleDateString("en-US", opts);

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

${gatewayHealthPanel}
${gatewayIncidentPanel}
${radarAlert}
${recoveryInsightPanel}
${summaryTiles}
${recoveryQueueStrip}

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
<th class="aa-radar-th-date">Date</th>
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