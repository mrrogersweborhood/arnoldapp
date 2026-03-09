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
    if (latestOrder && isProblemOrderStatus(latestOrder?.status)) {
      tone = "problem";
      headline = "Latest payment has a problem";
    } else if (failedCount > 0) {
      tone = "problem";
      headline = "Customer has failed/problem payments";
    } else if (!primarySub) {
      tone = "watch";
      headline = "No subscription found";
    }

    const alertHtml = tone === "problem" ? `
      <div class="aa-health-alert aa-health-alert-problem">
        <span class="aa-health-alert-icon">🔴</span>
        <span class="aa-health-alert-text">${esc(headline)}${latestOrderId !== "—" ? ` • ${latestOrderId}` : ""}</span>
      </div>
    ` : "";

    return `
      <section class="card aa-section">
        <div class="aa-section-head">
          <div class="aa-section-title">Subscription Health</div>
          <div class="aa-section-subtitle">Quick support summary</div>
        </div>
        ${alertHtml}
        <div class="aa-health-grid">
          <div class="aa-health-card aa-health-card-${esc(tone)}">
            <div class="aa-health-kicker">Health</div>
            <div class="aa-health-value">${esc(headline)}</div>
            <div class="aa-health-meta">${primarySub ? renderStatusPill(subStatus) : '<span class="aa-muted">No subscription</span>'}</div>
          </div>
          <div class="aa-health-card">
            <div class="aa-health-kicker">Latest payment</div>
            <div class="aa-health-value">${esc(latestOrderId)}</div>
            <div class="aa-health-meta">${latestOrder ? `${renderStatusPill(latestOrderStatus)} <span class="aa-muted">${esc(latestOrderDate)}</span>` : '<span class="aa-muted">No orders</span>'}</div>
          </div>
          <div class="aa-health-card">
            <div class="aa-health-kicker">Latest total</div>
            <div class="aa-health-value">${esc(latestOrderTotal)}</div>
            <div class="aa-health-meta">${latestOrderDate !== "—" ? esc(latestOrderDate) : '<span class="aa-muted">—</span>'}</div>
          </div>
          <div class="aa-health-card">
            <div class="aa-health-kicker">Failed/problem payments</div>
            <div class="aa-health-value">${esc(String(failedCount))}</div>
            <div class="aa-health-meta">${nextPayment !== "—" ? `Next payment ${esc(nextPayment)}` : '<span class="aa-muted">No next payment</span>'}</div>
          </div>
        </div>
      </section>
    `;
  }

// 🔴 renderHealth.js
