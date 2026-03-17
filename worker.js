// 🟢 worker.js
const ALLOWED_ORIGINS = new Set([
  "https://mrrogersweborhood.github.io"
]);

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      if (method === "OPTIONS") {
        return handleOptions(request);
      }

      if (path === "/" && method === "GET") {
        return json(request, {
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
        return await handleListIncidents(request, env);
      }

      if (path === "/radar/test-create" && method === "GET") {
        return await handleTestIncident(request, env);
      }

      if (path === "/scanner/run" && method === "GET") {
        return await runPulseScanner(request, env);
      }

      if (path === "/pulse/summary" && method === "GET") {
        return await handlePulseSummary(request, env);
      }

      if (path === "/pulse/failure-analysis" && method === "GET") {
        return await handleFailureAnalysis(request, env);
      }

      return json(request, { ok: false, error: "Not found" }, 404);

    } catch (error) {
      return json(request, {
        ok: false,
        error: error.message || "Unexpected error"
      }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log("CRON TRIGGER FIRED", new Date().toISOString());
    ctx.waitUntil(runPulseScanner(null, env));
  }
};

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request)
  });
}

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

  return json(request, {
    ok: true,
    incident_id: result.meta.last_row_id
  });
}

async function handleListIncidents(request, env) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM radar_incidents
    ORDER BY id DESC
    LIMIT 100
  `).all();

  return json(request, {
    ok: true,
    incidents: result.results || []
  });
}

async function handleTestIncident(request, env) {
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

  return json(request, {
    ok: true,
    test_incident: result.meta.last_row_id
  });
}

async function runPulseScanner(request, env) {
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

  return json(request, {
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

    const orderNotes = await fetchOrderNotesForOrder(baseUrl, consumerKey, consumerSecret, orderId);
    const reason = classifyFailureReason(order, gateway, store, orderNotes);

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
        reason,
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

async function fetchOrderNotesForOrder(baseUrl, consumerKey, consumerSecret, orderId) {
  if (!orderId) return [];

  try {
    const url = `${baseUrl}/wp-json/wc/v3/orders/${encodeURIComponent(orderId)}/notes?per_page=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: "Basic " + btoa(consumerKey + ":" + consumerSecret)
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const notes = Array.isArray(data) ? data : [];

    return notes.map((note) => ({
      id: note?.id ?? null,
      added_by_user: !!note?.added_by_user,
      date_created: note?.date_created || null,
      note: asText(note?.note)
    }));
  } catch (_) {
    return [];
  }
}

function classifyFailureReason(order, gateway, store, orderNotes = []) {
  const text = buildFailureText(order, gateway, store, orderNotes);

  if (matchesAny(text, [
    "card expired",
    "expired card",
    "expiration date",
    "expiry date",
    "expired",
    "card_expired",
    "expired_card"
  ])) {
    return "CARD_EXPIRED";
  }

  if (matchesAny(text, [
    "insufficient funds",
    "not sufficient funds",
    "insufficient_funds",
    "insufficientfunds",
    "funds unavailable"
  ])) {
    return "INSUFFICIENT_FUNDS";
  }

  if (matchesAny(text, [
    "do not honor",
    "do_not_honor",
    "do not honour",
    "generic decline",
    "decline code do not honor"
  ])) {
    return "DO_NOT_HONOR";
  }

  if (matchesAny(text, [
    "cvv",
    "cvc",
    "security code",
    "incorrect_cvc",
    "incorrect cvv",
    "cvv mismatch"
  ])) {
    return "CVV_DECLINE";
  }

  if (matchesAny(text, [
    "avs",
    "address verification",
    "zip mismatch",
    "postal code mismatch",
    "street mismatch"
  ])) {
    return "AVS_DECLINE";
  }

  if (matchesAny(text, [
    "3d secure",
    "3ds",
    "authentication required",
    "sca_required",
    "strong customer authentication",
    "secure authentication",
    "verification required"
  ])) {
    return "AUTHENTICATION_REQUIRED";
  }

  if (matchesAny(text, [
    "processor unavailable",
    "gateway unavailable",
    "gateway down",
    "gateway error",
    "processor error",
    "payment gateway error",
    "internal gateway error",
    "api error"
  ])) {
    return "GATEWAY_ERROR";
  }

  if (matchesAny(text, [
    "timeout",
    "timed out",
    "request timeout",
    "gateway timeout"
  ])) {
    return "GATEWAY_TIMEOUT";
  }

  if (matchesAny(text, [
    "network error",
    "connection error",
    "connection timed out",
    "dns error",
    "socket error"
  ])) {
    return "NETWORK_ERROR";
  }

  if (matchesAny(text, [
    "stolen card",
    "pickup card",
    "pick up card",
    "lost card",
    "fraud",
    "fraudulent"
  ])) {
    return "FRAUD_SUSPECTED";
  }

  if (matchesAny(text, [
    "processor declined",
    "payment declined",
    "card declined",
    "declined",
    "soft decline",
    "hard decline"
  ])) {
    return "PROCESSOR_DECLINED";
  }

  return "FAILED_GENERIC";
}

function buildFailureText(order, gateway, store, orderNotes = []) {
  const parts = [];

  const push = (value) => {
    const text = asText(value);
    if (text) parts.push(text.toLowerCase());
  };

  push(order?.status);
  push(order?.payment_method);
  push(order?.payment_method_title);
  push(order?.transaction_id);
  push(order?.customer_note);
  push(order?.payment_details?.result);
  push(order?.payment_details?.message);
  push(order?.payment_details?.error);
  push(order?.payment_result?.result);
  push(order?.payment_result?.message);
  push(order?.payment_result?.error);
  push(gateway);
  push(store?.gateway);

  if (Array.isArray(order?.meta_data)) {
    for (const item of order.meta_data) {
      push(item?.key);
      if (typeof item?.value === "string" || typeof item?.value === "number" || typeof item?.value === "boolean") {
        push(item.value);
      } else if (item?.value && typeof item.value === "object") {
        try {
          push(JSON.stringify(item.value));
        } catch (_) {}
      }
    }
  }

  if (Array.isArray(order?.fee_lines)) {
    for (const item of order.fee_lines) {
      push(item?.name);
      push(item?.total);
    }
  }

  if (Array.isArray(order?.coupon_lines)) {
    for (const item of order.coupon_lines) {
      push(item?.code);
    }
  }

  if (Array.isArray(orderNotes)) {
    for (const note of orderNotes) {
      push(note?.note);
      push(note?.date_created);
    }
  }

  return parts.join(" | ");
}

function matchesAny(text, needles) {
  return needles.some((needle) => text.includes(String(needle).toLowerCase()));
}

async function handlePulseSummary(request, env) {
  const revenue = await env.DB.prepare(`
    SELECT SUM(amount) AS total FROM radar_incidents WHERE status = 'pending'
  `).first();

  const incidentCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM radar_incidents WHERE status = 'pending'
  `).first();

  return json(request, {
    ok: true,
    recoverable_revenue: Number(revenue?.total || 0),
    failed_subscriptions: Number(incidentCount?.count || 0)
  });
}

async function handleFailureAnalysis(request, env) {
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

  return json(request, {
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

function buildCorsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...buildCorsHeaders(request)
    }
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