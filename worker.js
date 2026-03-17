// 🟢 worker.js
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      if (path === "/" && method === "GET") {
        return json({
          ok: true,
          app: "Pulse Revenue Intelligence",
          worker: "pulse-worker",
          status: "running"
        });
      }

      if (path === "/radar/incident" && method === "POST") {
        return await handleCreateIncident(request, env);
      }

      if (path === "/radar/incidents" && method === "GET") {
        return await handleListIncidents(env);
      }

      if (path === "/radar/test-create" && method === "GET") {
        return await handleTestIncident(env);
      }

      if (path === "/scanner/run" && method === "GET") {
        return await runPulseScanner(env);
      }

      if (path === "/pulse/summary" && method === "GET") {
        return await handlePulseSummary(env);
      }

      if (path === "/pulse/failure-analysis" && method === "GET") {
        return await handleFailureAnalysis(env);
      }

      return json({ ok: false, error: "Not found" }, 404);

    } catch (error) {
      return json({
        ok: false,
        error: error.message || "Unexpected error"
      }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log("CRON TRIGGER FIRED", new Date().toISOString());
    ctx.waitUntil(runPulseScanner(env));
  }
};

async function handleCreateIncident(request, env) {
  const body = await request.json();

  const store_id = asText(body.store_id);
  const subscription_id = asText(body.subscription_id);
  const order_id = asText(body.order_id);
  const customer_email = asText(body.customer_email);
  const gateway = asText(body.gateway);
  const reason = asText(body.reason);
  const amount = asNumber(body.amount);
  const currency = asText(body.currency) || "USD";
  const status = asText(body.status) || "pending";
  const detected_at = new Date().toISOString();

  const result = await env.DB.prepare(`
    INSERT INTO radar_incidents (
      store_id,
      subscription_id,
      order_id,
      customer_email,
      gateway,
      reason,
      amount,
      currency,
      status,
      detected_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      store_id,
      subscription_id,
      order_id,
      customer_email,
      gateway,
      reason,
      amount,
      currency,
      status,
      detected_at
    )
    .run();

  return json({
    ok: true,
    incident_id: result.meta.last_row_id
  });
}

async function handleListIncidents(env) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM radar_incidents
    ORDER BY id DESC
    LIMIT 100
  `).all();

  return json({
    ok: true,
    incidents: result.results || []
  });
}

async function handleTestIncident(env) {
  const detected_at = new Date().toISOString();

  const result = await env.DB.prepare(`
    INSERT INTO radar_incidents (
      store_id,
      subscription_id,
      order_id,
      customer_email,
      gateway,
      reason,
      amount,
      currency,
      status,
      detected_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      "okobserver",
      "389642",
      "389642",
      "subscriber@test.com",
      "square",
      "CARD_EXPIRED",
      40,
      "USD",
      "pending",
      detected_at
    )
    .run();

  return json({
    ok: true,
    test_incident: result.meta.last_row_id
  });
}

async function runPulseScanner(env) {
  const stores = await loadActiveStores(env);

  let totalScanned = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  const storeResults = [];

  for (const store of stores) {
    try {
      const result = await scanStoreFailedOrders(env, store);

      totalScanned += result.scanned;
      totalCreated += result.incidents_created;
      totalSkipped += result.incidents_skipped;

      storeResults.push(result);
    } catch (error) {
      storeResults.push({
        store_id: store.store_id,
        ok: false,
        error: error.message
      });
    }
  }

  return json({
    ok: true,
    stores_scanned: stores.length,
    scanned: totalScanned,
    incidents_created: totalCreated,
    incidents_skipped: totalSkipped,
    store_results: storeResults
  });
}

async function loadActiveStores(env) {
  const result = await env.DB.prepare(`
    SELECT store_id, store_name, store_url, gateway
    FROM stores
    ORDER BY id ASC
  `).all();

  return result.results || [];
}

async function scanStoreFailedOrders(env, store) {
  const consumerKey = env.WC_KEY;
  const consumerSecret = env.WC_SECRET;

  const baseUrl = store.store_url.replace(/\/+$/, "");
  const url = `${baseUrl}/wp-json/wc/v3/orders?status=failed&per_page=20`;

  const response = await fetch(url, {
    headers: {
      Authorization: "Basic " + btoa(consumerKey + ":" + consumerSecret)
    }
  });

  const data = await response.json();
  const orders = Array.isArray(data) ? data : [];

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const orderId = String(order.id || "");
    const email = asText(order.billing?.email) || "unknown";
    const amount = asNumber(order.total) || 0;
    const orderStatus = asText(order.status) || "pending";

    const gateway =
      asText(order.payment_method_title) ||
      asText(order.payment_method) ||
      store.gateway ||
      "unknown";

    if (orderStatus !== "failed") {
      skipped++;
      continue;
    }

    const existing = await env.DB.prepare(`
      SELECT id FROM radar_incidents WHERE order_id = ? LIMIT 1
    `)
      .bind(orderId)
      .first();

    if (existing) {
      skipped++;
      continue;
    }

    await env.DB.prepare(`
      INSERT INTO radar_incidents (
        store_id,
        subscription_id,
        order_id,
        customer_email,
        gateway,
        reason,
        amount,
        currency,
        status,
        detected_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        store.store_id,
        orderId,
        orderId,
        email,
        gateway,
        orderStatus,
        amount,
        "USD",
        "pending",
        new Date().toISOString()
      )
      .run();

    created++;
  }

  return {
    ok: true,
    store_id: store.store_id,
    scanned: orders.length,
    incidents_created: created,
    incidents_skipped: skipped
  };
}

async function handlePulseSummary(env) {
  const revenue = await env.DB.prepare(`
    SELECT SUM(amount) AS total FROM radar_incidents WHERE status = 'pending'
  `).first();

  const incidentCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM radar_incidents WHERE status = 'pending'
  `).first();

  return json({
    ok: true,
    recoverable_revenue: Number(revenue?.total || 0),
    failed_subscriptions: Number(incidentCount?.count || 0)
  });
}

async function handleFailureAnalysis(env) {
  const rows = await env.DB.prepare(`
    SELECT
      gateway,
      reason,
      amount,
      customer_email
    FROM radar_incidents
    WHERE status = 'pending'
  `).all();

  const incidents = rows.results || [];
  const totalPending = incidents.length;
  const gateways = aggregateByGatewayForActions(incidents);

  const reasonsMap = new Map();

  for (const row of incidents) {
    const reason = asText(row.reason) || "FAILED_GENERIC";
    const current = reasonsMap.get(reason) || {
      reason,
      incident_count: 0,
      recoverable_revenue: 0
    };

    current.incident_count += 1;
    current.recoverable_revenue += Number(row.amount || 0);

    reasonsMap.set(reason, current);
  }

  const reasons = Array.from(reasonsMap.values())
    .map((item) => ({
      reason: item.reason,
      incident_count: item.incident_count,
      recoverable_revenue: Number(item.recoverable_revenue.toFixed(2))
    }))
    .sort((a, b) =>
      b.incident_count - a.incident_count ||
      b.recoverable_revenue - a.recoverable_revenue
    );

  return json({
    ok: true,
    total_pending_incidents: totalPending,
    gateways,
    reasons,
    top_gateway: gateways[0] || null,
    top_reason: reasons[0] || null
  });
}

function aggregateByGatewayForActions(incidents) {
  const totalPending = incidents.length;
  const map = new Map();

  for (const row of incidents) {
    const gateway = normalizeGatewayName(row.gateway);
    const current = map.get(gateway) || {
      gateway,
      incident_count: 0,
      recoverable_revenue: 0,
      customers: new Set()
    };

    current.incident_count += 1;
    current.recoverable_revenue += Number(row.amount || 0);

    if (asText(row.customer_email)) {
      current.customers.add(asText(row.customer_email));
    }

    map.set(gateway, current);
  }

  return Array.from(map.values())
    .map((item) => {
      const share = totalPending > 0
        ? Number(((item.incident_count / totalPending) * 100).toFixed(2))
        : 0;

      let recommendedAction = "MONITOR";
      let recommendedPriority = "LOW";
      let recommendedMessage = "No unusual activity detected.";
      let playbook = "Monitor gateway behavior.";

      if (share >= 80 && item.incident_count >= 20) {
        recommendedAction = "RETRY_LATER";
        recommendedPriority = "HIGH";
        recommendedMessage = "Large spike in failures suggests possible gateway outage.";
        playbook = "Pause automated retries and reattempt payments later.";
      } else if (item.incident_count >= 10) {
        recommendedAction = "REVIEW_GATEWAY_STATUS";
        recommendedPriority = "MEDIUM";
        recommendedMessage = "Failure spike detected. Check gateway health dashboard.";
        playbook = "Verify gateway status before retrying payments.";
      } else if (item.incident_count >= 5) {
        recommendedAction = "RETRY_SOFT";
        recommendedPriority = "LOW";
        recommendedMessage = "Small cluster of failures detected.";
        playbook = "Retry payment attempts with normal retry schedule.";
      }

      return {
        gateway: item.gateway,
        incident_count: item.incident_count,
        recoverable_revenue: Number(item.recoverable_revenue.toFixed(2)),
        customers_at_risk: item.customers.size,
        share_of_failures_pct: share,
        recommended_action: recommendedAction,
        recommended_priority: recommendedPriority,
        recommended_message: recommendedMessage,
        playbook: playbook
      };
    })
    .sort((a, b) =>
      b.incident_count - a.incident_count ||
      b.recoverable_revenue - a.recoverable_revenue
    );
}

function normalizeGatewayName(value) {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("square")) return "square";
  if (raw.includes("stripe")) return "stripe";
  if (raw.includes("paypal")) return "paypal";

  return raw || "unknown";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json;charset=UTF-8" }
  });
}

function asText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
// 🔴 worker.js