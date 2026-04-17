// 🟢 renderCustomer.js
// Arnold Admin — SAFE SPLIT PASS 1 (customer/address renderers only)
// (Markers are comments only: 🟢 renderCustomer.js ... 🔴 renderCustomer.js)

function renderCustomerCard(customer, healthInlineHTML = "") {
    const id = customer?.id ?? "—";
    const email = String(customer?.email ?? customer?.billing?.email ?? "").trim() || "—";
    const username = customer?.username ?? customer?.email ?? "—";
    const fn = (customer?.first_name ?? "").trim();
    const ln = (customer?.last_name ?? "").trim();
    const name = [fn, ln].filter(Boolean).join(" ").trim() || "—";
// 🟢 NEW: worker-driven summary (if present)
const summary = customer?.summary || {};
const summaryHTML = summary?.headline
  ? `
        <div style="margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(168,85,247,.08); border:1px solid rgba(168,85,247,.14); font-size:13px; font-weight:700; color:#4c1d95;">
          ${esc(String(summary.headline || ""))}
        </div>
  `
  : "";
    return `
  <div class="aa-card aa-card-compact">

    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">

       <div>
        <div style="font-size:20px; font-weight:600;">
          ${esc(String(name))}
        </div>
        <div class="aa-muted" style="margin-top:4px;">
          ${esc(String(email))}
        </div>
        <div class="aa-muted" style="font-size:12px; margin-top:2px;">
          ID: ${esc(String(id))}
        </div>
        ${summaryHTML}
      </div>

       <div style="display:flex; gap:12px; flex-wrap:wrap;">

        <div class="aa-tile">
          <div class="aa-label">Subscriptions</div>
          <div class="aa-value">${esc(String(customer?.subscriptions_count ?? "—"))}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Orders</div>
          <div class="aa-value">${esc(String(customer?.orders_count ?? "—"))}</div>
        </div>

        <div class="aa-tile">
          <div class="aa-label">Revenue</div>
          <div class="aa-value">${esc(String(customer?.total_spent ?? "—"))}</div>
        </div>

      </div>
    </div>

     <div style="margin-top:16px;">
       ${healthInlineHTML}
     </div>

    <div class="aa-copy-row" style="margin-top:16px;">
      <a
        class="aa-copy-btn aa-copy-btn-primary"
        href="https://okobserver.org/wp-admin/user-edit.php?user_id=${esc(String(id))}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open WP
      </a>

      <a
        class="aa-copy-btn aa-copy-btn-secondary aa-copy-btn-subscriptions"
        href="https://okobserver.org/wp-admin/edit.php?post_type=shop_subscription&_customer_user=${esc(String(id))}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Subscriptions
      </a>

      <a
        class="aa-copy-btn aa-copy-btn-secondary aa-copy-btn-orders"
        href="https://okobserver.org/wp-admin/edit.php?post_type=shop_order&_customer_user=${esc(String(id))}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Orders
      </a>
    </div>

  </div>
`;  }

function renderAddressBlock(title, addr, fallbackAddr) {
    const a = addr || null;
    const f = fallbackAddr || null;

    const first = (a?.first_name ?? "").trim();
    const last = (a?.last_name ?? "").trim();
    const name = [first, last].filter(Boolean).join(" ").trim();

    const addr1 = (a?.address_1 ?? "").trim();
    const addr2 = (a?.address_2 ?? "").trim();
    const city = (a?.city ?? "").trim();
    const state = (a?.state ?? "").trim();
    const zip = (a?.postcode ?? "").trim();
    const country = (a?.country ?? "").trim();

    const email = (a?.email ?? "").trim();
    const phone = fmtPhone((a?.phone ?? "").trim());

    const hasAny =
      name || addr1 || addr2 || city || state || zip || country || email || phone;

    // Shipping fallback: if missing, show "Same as billing" and use billing fields
    const sameAsBilling = title.toLowerCase() === "shipping" && !hasAny && f;

    const pick = (key) => {
      if (!sameAsBilling) return (a?.[key] ?? "");
      return (f?.[key] ?? "");
    };

    const showName = (() => {
      const fn = String(pick("first_name") ?? "").trim();
      const ln = String(pick("last_name") ?? "").trim();
      const nm = [fn, ln].filter(Boolean).join(" ").trim();
      if (nm) return nm;
      if (sameAsBilling) return "Same as billing";
      return "—";
    })();

    const showAddrLines = (() => {
      const b1 = String(pick("address_1") ?? "").trim();
      const b2 = String(pick("address_2") ?? "").trim();
      const c = String(pick("city") ?? "").trim();
      const s = String(pick("state") ?? "").trim();
      const z = String(pick("postcode") ?? "").trim();
      const co = String(pick("country") ?? "").trim();

      const lines = [];
      if (b1) lines.push(b1);
      if (b2) lines.push(b2);
      const cs = [c, s].filter(Boolean).join(", ");
      const csz = [cs, z].filter(Boolean).join(" ");
      if (csz) lines.push(csz);
      if (co) lines.push(co);
      return lines.length ? lines.join("<br>") : "—";
    })();

    const showEmail = (() => {
      const e = String(pick("email") ?? "").trim();
      return e || "—";
    })();

    const showPhone = (() => {
      const p = fmtPhone(String(pick("phone") ?? "").trim());
      return p || "—";
    })();

    const isBilling = title.toLowerCase() === "billing";
    const emailHref = isBilling && showEmail !== "—" ? `mailto:${showEmail}` : "";
    const phoneHref = isBilling && showPhone !== "—" ? `tel:${String(showPhone).replace(/[^\d+]/g, "")}` : "";

    return `
  <div class="aa-address-block">

    <div class="aa-address-name">
      ${esc(showName)}
    </div>

    <div class="aa-address-lines">
      ${showAddrLines}
    </div>

    <div class="aa-address-meta">
      ${isBilling && emailHref
        ? `<a href="${esc(emailHref)}">${esc(showEmail)}</a>`
        : esc(showEmail)}
      ${showPhone !== "—" ? ` • ${isBilling && phoneHref ? `<a href="${esc(phoneHref)}">${esc(showPhone)}</a>` : esc(showPhone)}` : ""}
    </div>

  </div>
`;
  }

function renderCustomerPage({
  customer,
  subscriptions,
  orders,
  activityHTML,
  healthHTML
}) {
  const customerCard = renderCustomerCard(customer, healthHTML || "");

   const billingCard = renderAddressBlock(
    "Billing",
    customer?.billing,
    null
  );

  const isSameAddress = JSON.stringify(customer?.billing || {}) === JSON.stringify(customer?.shipping || {});

   const shippingCard = isSameAddress
    ? `
      <div class="aa-address-block">
        <div class="aa-address-name">Same as billing</div>
        <div class="aa-address-meta">Shipping uses the billing address on file.</div>
      </div>
    `
    : renderAddressBlock(
        "Shipping",
        customer?.shipping,
        customer?.billing
      );

   return `
    <div class="aa-results">

      ${customerCard}

       <div class="aa-card aa-customer-section-card">

        <div
          class="aa-card-title aa-customer-accordion-toggle"
          onclick="this.nextElementSibling.classList.toggle('aa-collapsed'); this.classList.toggle('is-open');"
        >
          <span>Recovery Activity</span>
          <span class="aa-chevron" aria-hidden="true">▾</span>
        </div>

        <div class="aa-customer-data-stack aa-collapsed">
          ${activityHTML || `<div class="aa-muted">No recent activity found.</div>`}
        </div>

      </div>

      <div class="aa-card aa-customer-section-card">

         <div
          class="aa-card-title aa-customer-accordion-toggle"
          onclick="this.nextElementSibling.classList.toggle('aa-collapsed'); this.classList.toggle('is-open');"
style="padding-right:6px;"
        >
          <span>Order & Support History</span>
          <span class="aa-chevron" aria-hidden="true">▾</span>
        </div>

        <div class="aa-customer-data-stack aa-collapsed">
          <div class="aa-card aa-card-compact">
            <div class="aa-card-title">Subscriptions</div>

        ${
          Array.isArray(subscriptions) && subscriptions.length
            ? `
              <div class="aa-table-wrap">
                <table class="aa-table" style="min-width:980px;">
                  <thead>
                    <tr>
                      <th>Subscription</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Start Date</th>
                      <th>Next Payment</th>
                      <th>Billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${subscriptions.map((sub) => {
                      const subId = sub?.id != null ? `#${String(sub.id)}` : "—";
                      const status = String(sub?.status ?? "—");
                      const total = String(sub?.total ?? "—");
                      const currency = String(sub?.currency ?? "").trim();
                      const startDate = String(sub?.start_date ?? "—");
                      const nextPayment = String(sub?.next_payment_date ?? "—");
                      const interval = String(sub?.billing_interval ?? "").trim();
                      const period = String(sub?.billing_period ?? "").trim();
                      const billing = interval && period
                        ? `Every ${interval} ${period}`
                        : "—";

                      return `
                        <tr>
                          <td>${esc(subId)}</td>
                          <td>${esc(status)}</td>
                          <td>${esc(currency ? `${total} ${currency}` : total)}</td>
                          <td>${esc(startDate)}</td>
                          <td>${esc(nextPayment)}</td>
                          <td>${esc(billing)}</td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            `
            : `<div class="aa-muted">No subscriptions found.</div>`
        }
      </div>

      <div class="aa-card aa-card-compact">
        <div class="aa-card-title">Orders</div>

        ${
          Array.isArray(orders) && orders.length
            ? `
              <div class="aa-table-wrap">
                <table class="aa-table" style="min-width:880px;">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Date</th>
                      <th>Payment Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${orders.map((order) => {
                      const orderId = order?.id != null ? `#${String(order.id)}` : "—";
                      const status = String(order?.status ?? "—");
                      const total = String(order?.total ?? "—");
                      const currency = String(order?.currency ?? "").trim();
                      const dateCreated = String(order?.date_created ?? "—");
                      const paymentMethod = String(
                        order?.payment_method_title ??
                        order?.payment_method ??
                        "—"
                      );

                      return `
                        <tr>
                          <td>${esc(orderId)}</td>
                          <td>${esc(status)}</td>
                          <td>${esc(currency ? `${total} ${currency}` : total)}</td>
                          <td>${esc(dateCreated)}</td>
                          <td>${esc(paymentMethod)}</td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            `
            : `<div class="aa-muted">No orders found.</div>`
        }
      </div>

       </div>
      </div>

      <div class="aa-card aa-customer-section-card" style="margin-top:16px;">
        <div class="aa-card-title">Contact & Address</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:10px;">

          <div>
            <div class="aa-contact-heading">
              Billing
            </div>
            ${billingCard}
          </div>

          <div>
            <div class="aa-contact-heading">
              Shipping
            </div>
            ${shippingCard}
          </div>

        </div>
      </div>

    </div>
  `;
}

// 🔴 renderCustomer.js
