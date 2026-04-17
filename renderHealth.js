// 🟢 renderHealth.js
// Arnold Admin — PASS 2 SAFE SPLIT (Build 2026-03-10-024)
// (Markers are comments only: 🟢 renderHealth.js ... 🔴 renderHealth.js)

function renderSubscriptionHealthSummary(customer, subs, orders) {
    const orderArr = Array.isArray(orders) ? [...orders] : [];
    orderArr.sort((a, b) => new Date(b?.date_created || 0) - new Date(a?.date_created || 0));

    const latestOrder = orderArr[0] || null;
    const failedCount = orderArr.filter((o) => isProblemOrderStatus(o?.status)).length;
    const latestOrderId = latestOrder ? `#${String(latestOrder?.id ?? "").trim()}` : "—";
    const latestOrderStatus = latestOrder ? String(latestOrder?.status ?? "—") : "—";
    const latestOrderTotal = latestOrder ? fmtMoney(latestOrder?.total, latestOrder?.currency) : "—";
    const latestOrderDate = latestOrder?.date_created ? fmtDate(latestOrder.date_created) : "—";

    const primarySub = Array.isArray(subs) && subs.length ? subs[0] : null;
    const subStatus = String(primarySub?.status ?? "—");
    const nextPayment = primarySub?.next_payment_date ? fmtDate(primarySub.next_payment_date) : "—";

let tone = "healthy";
let headline = "Subscription looks healthy";

const latestStatus = String(latestOrder?.status ?? "").toLowerCase();
const subStatusLower = String(primarySub?.status ?? "").toLowerCase();

if (latestStatus === "failed") {
  tone = "problem";
  headline = "Latest payment failed";
} else if (failedCount > 0) {
  tone = "problem";
  headline = "Customer has failed/problem payments";
} else if (subStatusLower === "on-hold") {
  tone = "problem";
  headline = "Subscription is on hold";
} else if (subStatusLower === "pending-cancel") {
  tone = "problem";
  headline = "Subscription pending cancellation";
} else if (subStatusLower === "expired") {
  tone = "problem";
  headline = "Subscription expired";
} else if (!primarySub) {
  tone = "watch";
  headline = "No subscription found";
}

let alertHtml = "";

if (tone === "problem" || tone === "watch") {

  const icon = tone === "problem" ? "🔴" : "⚠️";

  alertHtml = `
    <div class="aa-health-alert aa-health-alert-${esc(tone)}">
      <span class="aa-health-alert-icon">${icon}</span>
      <span class="aa-health-alert-text">
        ${esc(headline)}
        ${latestOrderId !== "—" ? ` • ${latestOrderId}` : ""}
      </span>
    </div>
  `;
}

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscription Health</div>
          <div class="aa-section-subtitle">Quick support summary</div>
        </div>
        ${alertHtml}
          <div class="aa-health-compact">
          <div class="aa-health-summary-row">

          <div class="aa-health-summary-main">
            <div class="aa-health-headline">
              ${esc(headline)}
            </div>
            <div class="aa-health-status-line">
              ${primarySub ? renderStatusPill(subStatus) : '<span class="aa-muted">No subscription</span>'}
            </div>
          </div>

            <div class="aa-health-metrics">

            <div class="aa-health-block">
              <div class="aa-label">Latest</div>
              <div class="aa-health-block-value">
                ${esc(latestOrderId)}
                ${latestOrder ? renderStatusPill(latestOrderStatus) : ""}
              </div>
              <div class="aa-muted">${esc(latestOrderDate)}</div>
            </div>

            <div class="aa-health-block">
              <div class="aa-label">Failed</div>
              <div class="aa-health-block-value">${esc(String(failedCount))}</div>
            </div>

            <div class="aa-health-block">
              <div class="aa-label">Next</div>
                <div class="aa-health-block-value">${esc(nextPayment)}</div>
            </div>

          </div>

          </div>
        </div>
      </section>
    `;
  }

// 🔴 renderHealth.js
