// 🟢 worker.js
// OkObserver Cloudflare Worker — FULL REPLACEMENT (v2026-03-11-radar1)
// (Markers are comments only: 🟢 worker.js ... 🔴 worker.js)

/**
 * OkObserver Cloudflare Worker — FULL REPLACEMENT (v2026-03-11-radar1)
 *
 * Changes in this build:
 * - ✅ Add /admin/radar endpoint for Arnold Admin Support Radar
 * - ✅ Keep Radar limited to current actionable problems only
 * - ✅ Keep /admin/nl-search untouched
 * - ✅ Reuse existing admin-cookie auth and Woo auth patterns
 *
 * Safety retained:
 * - Do NOT reshape WP payloads for OkObserver content routes
 * - Do NOT remove Woo fallbacks
 * - Do NOT loosen admin security
 */

const ORIGIN = "https://okobserver.org";
const API_ALLOW = ["/wp-json/", "/content/full-post"];

const CACHE_TTL = 300;
const NOCACHE_QS = "nocache";

/* ---------------- AUTH HELPERS ---------------- */

const JWT_COOKIE_NAME = "okobserver_jwt";
const JWT_MAX_AGE = 60 * 60 * 8;

// Arnold Admin cookie auth
const ADMIN_COOKIE_NAME = "arnold_admin_jwt";
const ADMIN_JWT_MAX_AGE = 60 * 60 * 2;

const WP_JWT_ENDPOINT = `${ORIGIN}/wp-json/jwt-auth/v1/token`;

/**
 * CORS allowlist
 * - GitHub Pages origin is scheme+host only (no path)
 * - Add localhost only if you truly need it
 */
const ALLOWED_ORIGINS = new Set([
  "https://mrrogersweborhood.github.io"
  // "http://localhost:5173",
  // "http://localhost:5500"
]);

async function handleLogin(request) {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return json(
        400,
        { success: false, message: "Username and password required." },
        { "cache-control": "no-store" },
        request
      );
    }

    const wpResp = await fetch(WP_JWT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }).toString()
    });

    const data = await wpResp.json();
    if (!wpResp.ok || !data?.token) {
      return json(
        401,
        { success: false, message: data?.message || "Invalid credentials." },
        { "cache-control": "no-store" },
        request
      );
    }

    const token = data.token;

    const user = {
      id: data?.data?.user?.id || null,
      name: data.user_display_name || data.user_nicename || username,
      email: data.user_email || null
    };

    const headers = new Headers(corsHeaders(request));
    headers.append("Set-Cookie", makeJwtCookie(token, JWT_MAX_AGE));
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("cache-control", "no-store");

    return new Response(JSON.stringify({ success: true, user, token }), { status: 200, headers });
  } catch (err) {
    console.error("[Auth] Login failed:", err?.message || err);
    return jsonError(500, "Login failed", err, request);
  }
}

async function handleLogout(request) {
  const headers = new Headers(corsHeaders(request));
  headers.append("Set-Cookie", expireJwtCookie());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

function makeJwtCookie(token, maxAge) {
  return [
    `${JWT_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${maxAge}`
  ].join("; ");
}

function expireJwtCookie() {
  return [
    `${JWT_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Max-Age=0"
  ].join("; ");
}

/**
 * IMPORTANT: Path is "/" so the cookie is reliably included for:
 * - /admin/status
 * - /admin/nl-search
 * - /admin/logout
 * - /admin/radar
 * This avoids silent “logged out” after login.
 */
function makeAdminJwtCookie(token, maxAge) {
  return [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${maxAge}`
  ].join("; ");
}

function expireAdminJwtCookie() {
  return [
    `${ADMIN_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Max-Age=0"
  ].join("; ");
}

function getCookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";").map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return null;
}

function getJwtFromCookie(request) {
  return getCookieValue(request, JWT_COOKIE_NAME);
}

/* ---------------- ADMIN VERIFICATION ---------------- */

async function verifyWpAdmin(jwt) {
  const meUrl = `${ORIGIN}/wp-json/wp/v2/users/me?context=edit`;

  const r = await fetch(meUrl, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/json"
    }
  });

  const txt = await r.text();
  console.log("[ADMIN DEBUG] /users/me raw =", txt);

  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (_) {}

  if (!r.ok) return { ok: false, status: r.status, data };

  const roles = Array.isArray(data?.roles)
    ? data.roles.map((x) => String(x).toLowerCase())
    : [];

  const roleIsAllowed =
    roles.includes("administrator") ||
    roles.includes("shop_manager");

  if (roleIsAllowed) {
    return {
      ok: true,
      isAdmin: true,
      roles,
      user: {
        id: data?.id ?? null,
        name: data?.name ?? null,
        slug: data?.slug ?? null
      }
    };
  }

  try {
    const probe = await fetch(`${ORIGIN}/wp-json/wc/v3/orders?per_page=1`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Accept": "application/json"
      }
    });

    if (probe.ok) {
      console.log("[ADMIN DEBUG] Woo probe: allowed");

      return {
        ok: true,
        isAdmin: true,
        roles,
        user: {
          id: data?.id ?? null,
          name: data?.name ?? null,
          slug: data?.slug ?? null
        }
      };
    }

    console.log("[ADMIN DEBUG] Woo probe: denied", probe.status);

  } catch (err) {
    console.log("[ADMIN DEBUG] Woo probe error:", err?.message || err);
  }

  return {
    ok: true,
    isAdmin: false,
    roles,
    user: {
      id: data?.id ?? null,
      name: data?.name ?? null,
      slug: data?.slug ?? null
    }
  };
}

async function requireAdminCookie(request) {
  const jwt = getCookieValue(request, ADMIN_COOKIE_NAME);
  if (!jwt || !jwt.trim()) return { ok: false, status: 401, error: "Not logged in" };

  const v = await verifyWpAdmin(jwt.trim());
  if (!v.ok) return { ok: false, status: 401, error: "Invalid session" };
  if (!v.isAdmin) return { ok: false, status: 403, error: "Admin required" };

  return { ok: true, jwt: jwt.trim(), user: v.user, roles: v.roles };
}

function storeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function storeWindowHours(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 24;
  return Math.round(num);
}

async function handleListStores(request, env) {
  const auth = await requireAdminCookie(request);
  if (!auth.ok) {
    return json(
      auth.status || 401,
      { ok: false, error: auth.error || "Unauthorized" },
      { "cache-control": "no-store" },
      request
    );
  }

  const result = await env.DB.prepare(`
    SELECT
      store_id,
      store_name,
      store_url,
      gateway,
      execution_mode,
      timezone,
      gateway_activity_window_hours
    FROM stores
    ORDER BY store_name ASC, store_id ASC
  `).all();

  return json(
    200,
    {
      ok: true,
      stores: (result.results || []).map((row) => ({
        store_id: storeText(row?.store_id),
        store_name: storeText(row?.store_name),
        store_url: storeText(row?.store_url),
        gateway: storeText(row?.gateway),
        execution_mode: (storeText(row?.execution_mode) || "test").toLowerCase(),
        timezone: storeText(row?.timezone) || "UTC",
        gateway_activity_window_hours: storeWindowHours(row?.gateway_activity_window_hours)
      }))
    },
    { "cache-control": "no-store" },
    request
  );
}

async function handleCreateStore(request, env) {
  const auth = await requireAdminCookie(request);
  if (!auth.ok) {
    return json(
      auth.status || 401,
      { ok: false, error: auth.error || "Unauthorized" },
      { "cache-control": "no-store" },
      request
    );
  }

  const body = await request.json().catch(() => null);

  const store_id = storeText(body?.store_id);
  const store_name = storeText(body?.store_name);
  const store_url = storeText(body?.store_url);
  const gateway = storeText(body?.gateway);
  const execution_mode = (storeText(body?.execution_mode) || "test").toLowerCase();
  const timezone = storeText(body?.timezone) || "UTC";
  const gateway_activity_window_hours = storeWindowHours(body?.gateway_activity_window_hours);

  if (!store_id) {
    return json(400, { ok: false, error: "Store ID is required." }, { "cache-control": "no-store" }, request);
  }

  if (!store_name) {
    return json(400, { ok: false, error: "Store name is required." }, { "cache-control": "no-store" }, request);
  }

  if (!gateway) {
    return json(400, { ok: false, error: "Gateway is required." }, { "cache-control": "no-store" }, request);
  }

  const existing = await env.DB.prepare(`
    SELECT store_id
    FROM stores
    WHERE store_id = ?
    LIMIT 1
  `).bind(store_id).first();

  if (existing) {
    return json(409, { ok: false, error: "A store with that Store ID already exists." }, { "cache-control": "no-store" }, request);
  }

  await env.DB.prepare(`
    INSERT INTO stores (
      store_id,
      store_name,
      store_url,
      gateway,
      execution_mode,
      timezone,
      gateway_activity_window_hours
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    store_id,
    store_name,
    store_url,
    gateway,
    execution_mode === "live" ? "live" : "test",
    timezone,
    gateway_activity_window_hours
  ).run();

  return json(
    200,
    {
      ok: true,
      created: true,
      store: {
        store_id,
        store_name,
        store_url,
        gateway,
        execution_mode: execution_mode === "live" ? "live" : "test",
        timezone,
        gateway_activity_window_hours
      }
    },
    { "cache-control": "no-store" },
    request
  );
}

async function handleUpdateStore(request, env) {
  const auth = await requireAdminCookie(request);
  if (!auth.ok) {
    return json(
      auth.status || 401,
      { ok: false, error: auth.error || "Unauthorized" },
      { "cache-control": "no-store" },
      request
    );
  }

  const body = await request.json().catch(() => null);
  const store_id = storeText(body?.store_id);

  if (!store_id) {
    return json(400, { ok: false, error: "Store ID is required." }, { "cache-control": "no-store" }, request);
  }

  const existing = await env.DB.prepare(`
    SELECT
      store_id,
      store_name,
      store_url,
      gateway,
      execution_mode,
      timezone,
      gateway_activity_window_hours
    FROM stores
    WHERE store_id = ?
    LIMIT 1
  `).bind(store_id).first();

  if (!existing) {
    return json(404, { ok: false, error: "Store not found." }, { "cache-control": "no-store" }, request);
  }

  const nextStoreName = storeText(body?.store_name) || storeText(existing?.store_name);
  const nextStoreUrl =
    body && Object.prototype.hasOwnProperty.call(body, "store_url")
      ? storeText(body?.store_url)
      : storeText(existing?.store_url);
  const nextGateway = storeText(body?.gateway) || storeText(existing?.gateway);
  const nextExecutionMode = ((storeText(body?.execution_mode) || storeText(existing?.execution_mode) || "test").toLowerCase() === "live")
    ? "live"
    : "test";
  const nextTimezone = storeText(body?.timezone) || storeText(existing?.timezone) || "UTC";
  const nextGatewayWindowHours =
    body && Object.prototype.hasOwnProperty.call(body, "gateway_activity_window_hours")
      ? storeWindowHours(body?.gateway_activity_window_hours)
      : storeWindowHours(existing?.gateway_activity_window_hours);

  await env.DB.prepare(`
    UPDATE stores
    SET
      store_name = ?,
      store_url = ?,
      gateway = ?,
      execution_mode = ?,
      timezone = ?,
      gateway_activity_window_hours = ?
    WHERE store_id = ?
  `).bind(
    nextStoreName,
    nextStoreUrl,
    nextGateway,
    nextExecutionMode,
    nextTimezone,
    nextGatewayWindowHours,
    store_id
  ).run();

  return json(
    200,
    {
      ok: true,
      updated: true,
      store: {
        store_id,
        store_name: nextStoreName,
        store_url: nextStoreUrl,
        gateway: nextGateway,
        execution_mode: nextExecutionMode,
        timezone: nextTimezone,
        gateway_activity_window_hours: nextGatewayWindowHours
      }
    },
    { "cache-control": "no-store" },
    request
  );
}

async function handleDeleteStore(request, env) {
  const auth = await requireAdminCookie(request);
  if (!auth.ok) {
    return json(
      auth.status || 401,
      { ok: false, error: auth.error || "Unauthorized" },
      { "cache-control": "no-store" },
      request
    );
  }

  const body = await request.json().catch(() => null);
  const store_id = storeText(body?.store_id);

  if (!store_id) {
    return json(400, { ok: false, error: "Store ID is required." }, { "cache-control": "no-store" }, request);
  }

  const existing = await env.DB.prepare(`
    SELECT store_id
    FROM stores
    WHERE store_id = ?
    LIMIT 1
  `).bind(store_id).first();

  if (!existing) {
    return json(404, { ok: false, error: "Store not found." }, { "cache-control": "no-store" }, request);
  }

  await env.DB.prepare(`
    DELETE FROM stores
    WHERE store_id = ?
  `).bind(store_id).run();

  return json(
    200,
    { ok: true, deleted: true, store_id },
    { "cache-control": "no-store" },
    request
  );
}

/* ---------------- MAIN FETCH HANDLER ---------------- */

async function fetchUpstreamWithOptionalAuth(upstream, init, hadAuth) {
  const resp = await fetch(upstream, init);
  if (hadAuth && resp.status === 401) {
    const retryHeaders = new Headers(init.headers);
    retryHeaders.delete("Authorization");
    const retryInit = { ...init, headers: retryHeaders };
    return fetch(upstream, retryInit);
  }
  return resp;
}

const RADAR_CACHE_SECONDS = 180;
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return text(
        200,
        "Worker is running. Try /status, /admin/health, or /wp-json/wp/v2/posts?per_page=1",
        request,
        { "cache-control": "no-store" }
      );
    }

    /* ------------------ AUTH ROUTES (OkObserver) ------------------ */
    if (url.pathname === "/auth/login" && request.method === "POST") return handleLogin(request);
    if (url.pathname === "/auth/logout" && request.method === "POST") return handleLogout(request);

    if (url.pathname === "/auth/status" && request.method === "GET") {
      const jwt = getJwtFromCookie(request);
      const hasToken = !!(jwt && jwt.trim());
      return json(200, { loggedIn: hasToken, hasToken }, { "cache-control": "no-store" }, request);
    }

    /* ------------------ FULL POST ------------------ */
    if (url.pathname === "/content/full-post" && request.method === "GET") {
      return handleFullPost(request, url, env);
    }

    /* ---------------------- CORS Preflight ---------------------- */
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || "";
      if (origin && ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      return new Response(null, { status: 403, headers: { "cache-control": "no-store" } });
    }

    /* ------------------ ARNOLD ADMIN AUTH ROUTES (cookie) ------------------ */
    if (url.pathname === "/admin/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const { username, password } = body || {};
        if (!username || !password) {
          return json(
            400,
            { success: false, message: "Username and password required." },
            { "cache-control": "no-store" },
            request
          );
        }

        const wpResp = await fetch(WP_JWT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username, password }).toString()
        });

        const data = await wpResp.json().catch(() => null);
        const token = data?.token;

        if (!wpResp.ok || !token) {
          return json(
            401,
            { success: false, message: data?.message || "Invalid credentials." },
            { "cache-control": "no-store" },
            request
          );
        }

        const v = await verifyWpAdmin(String(token).trim());
        if (!v.ok) return json(401, { success: false, message: "Login verification failed." }, { "cache-control": "no-store" }, request);
        if (!v.isAdmin) return json(403, { success: false, message: "Admin access required." }, { "cache-control": "no-store" }, request);

        const headers = new Headers(corsHeaders(request));
        headers.append("Set-Cookie", makeAdminJwtCookie(String(token).trim(), ADMIN_JWT_MAX_AGE));
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("cache-control", "no-store");

        return new Response(JSON.stringify({ success: true, user: v.user, roles: v.roles }), { status: 200, headers });
      } catch (err) {
        console.error("[ArnoldAdmin] Login failed:", err?.message || err);
        return jsonError(500, "Admin login failed", err, request);
      }
    }

    if (url.pathname === "/admin/status" && request.method === "GET") {
      const jwt = getCookieValue(request, ADMIN_COOKIE_NAME);
      if (!jwt || !jwt.trim()) return json(200, { loggedIn: false }, { "cache-control": "no-store" }, request);

      const v = await verifyWpAdmin(jwt.trim());
      if (!v.ok || !v.isAdmin) return json(200, { loggedIn: false }, { "cache-control": "no-store" }, request);

      return json(200, { loggedIn: true, user: v.user, roles: v.roles }, { "cache-control": "no-store" }, request);
    }

    if (url.pathname === "/admin/logout" && request.method === "POST") {
      const headers = new Headers(corsHeaders(request));
      headers.append("Set-Cookie", expireAdminJwtCookie());
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("cache-control", "no-store");
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    /* ---------------- Arnold Admin (cookie locked) ---------------- */

    function maskEmail(email) { return String(email ?? ""); }
    function maskPhone(phone) { return String(phone ?? ""); }

    function isSensitiveMetaKey(key) {
      const k = String(key || "").toLowerCase();
      return (
        k.includes("token") || k.includes("secret") || k.includes("password") || k.includes("pass") ||
        k.includes("auth") || k.includes("nonce") || k.includes("cookie") || k.includes("session") ||
        k.includes("stripe") || k.includes("paypal") || k.includes("square") ||
        k.includes("card") || k.includes("cc") || k.includes("cvc") || k.includes("cvv") ||
        k.includes("account") || k.includes("routing") || k.includes("iban") || k.includes("api_key")
      );
    }

    function sanitizeMetaValue(val) {
      if (val == null) return null;
      if (typeof val === "string") {
        const s = val.trim();
        if (s.length > 80) return "[redacted]";
        return s;
      }
      if (typeof val === "number" || typeof val === "boolean") return val;
      return "[redacted]";
    }

    function pickSafeMeta(metaArr) {
      const arr = Array.isArray(metaArr) ? metaArr : [];
      const out = [];
      for (const m of arr) {
        const key = m?.key ?? m?.meta_key ?? null;
        if (!key) continue;
        if (isSensitiveMetaKey(key)) out.push({ key: String(key), value: "[redacted]" });
        else out.push({ key: String(key), value: sanitizeMetaValue(m?.value) });
        if (out.length >= 50) break;
      }
      return out;
    }

    function pickAddressBlock(a) {
      const email = a?.email ?? null;
      const phone = a?.phone ?? null;
      return {
        first_name: a?.first_name ?? null,
        last_name: a?.last_name ?? null,
        company: a?.company ?? null,
        address_1: a?.address_1 ?? null,
        address_2: a?.address_2 ?? null,
        city: a?.city ?? null,
        state: a?.state ?? null,
        postcode: a?.postcode ?? null,
        country: a?.country ?? null,
        email: email ? maskEmail(email) : null,
        phone: phone ? maskPhone(phone) : null
      };
    }

    function pickLineItems(arr) {
      return Array.isArray(arr)
        ? arr.slice(0, 25).map(li => ({
            product_id: li?.product_id ?? null,
            variation_id: li?.variation_id ?? null,
            sku: li?.sku ?? null,
            name: li?.name ?? "",
            quantity: li?.quantity ?? 0,
            total: li?.total ?? null
          }))
        : [];
    }

    function pickSubscriptionNotes(notesArr) {
      const arr = Array.isArray(notesArr) ? notesArr : [];
      const out = [];
      for (const n of arr) {
        const id = n?.id ?? null;
        const date_created = n?.date_created ?? n?.date_created_gmt ?? null;
        const note = n?.note ?? n?.customer_note ?? n?.content ?? null;
        const author = n?.author ?? n?.author_name ?? null;
        const added_by = n?.added_by ?? null;
        const is_customer_note = (typeof n?.customer_note === "boolean") ? n.customer_note : null;

        const text = (note == null) ? "" : String(note);
        out.push({
          id,
          date_created: date_created ? String(date_created) : null,
          note: text.length > 5000 ? (text.slice(0, 5000) + "…") : text,
          author: author ? String(author) : null,
          added_by: added_by ? String(added_by) : null,
          customer_note: is_customer_note
        });

        if (out.length >= 400) break;
      }
      return out;
    }
    // ✅ Updated signature (SAFE ADDITIVE): accept notesArr and include notes in output
    function pickOrder(o, notesArr) {
      return {
        id: o?.id ?? null,
        status: o?.status ?? null,
        total: o?.total ?? null,
        currency: o?.currency ?? null,
        date_created: o?.date_created ?? null,
        customer_id: o?.customer_id ?? null,
        billing: pickAddressBlock(o?.billing),
        shipping: pickAddressBlock(o?.shipping),
        payment_method: o?.payment_method ?? null,
        payment_method_title: o?.payment_method_title ?? null,
        line_items: pickLineItems(o?.line_items),
        meta_data: pickSafeMeta(o?.meta_data),

        // ✅ ADDITIVE: order notes (same structure as subscription notes)
        notes: pickSubscriptionNotes(notesArr)
      };
    }

    function pickCustomer(c) {
      return {
        id: c?.id ?? null,
        username: c?.username ?? null,
        email: c?.email ? maskEmail(c.email) : null,
        first_name: c?.first_name ?? null,
        last_name: c?.last_name ?? null,
        role: c?.role ?? null,
        date_created: c?.date_created ?? null,
        billing: pickAddressBlock(c?.billing),
        shipping: pickAddressBlock(c?.shipping),
        meta_data: pickSafeMeta(c?.meta_data)
      };
    }

    function normalizeNullableDate(val) {
      if (val == null) return null;
      const s = String(val).trim();
      if (!s) return null;
      if (s === "0000-00-00" || s === "0000-00-00 00:00:00") return null;
      return s;
    }

    function normalizeNextPaymentDate(s) {
      const a = normalizeNullableDate(s?.next_payment_date);
      if (a) return a;

      const b = normalizeNullableDate(s?.next_payment_date_gmt);
      if (b) return b;

      const c = normalizeNullableDate(s?.schedule_next_payment);
      if (c) return c;

      const d = normalizeNullableDate(s?.schedule?.next_payment);
      if (d) return d;

      return null;
    }

    function pickSubscription(s, notesArr) {
      const nextPay = normalizeNextPaymentDate(s);

      return {
        id: s?.id ?? null,
        status: s?.status ?? null,
        total: s?.total ?? null,
        currency: s?.currency ?? null,
        start_date: normalizeNullableDate(s?.start_date ?? s?.date_created ?? null),
        next_payment_date: nextPay,
        end_date: normalizeNullableDate(s?.end_date ?? null),
        billing_interval: s?.billing_interval ?? null,
        billing_period: s?.billing_period ?? null,
        customer_id: s?.customer_id ?? null,
        parent_id: s?.parent_id ?? null,
        created_via: s?.created_via ?? null,
        billing: pickAddressBlock(s?.billing),
        shipping: pickAddressBlock(s?.shipping),
        payment_method: s?.payment_method ?? null,
        payment_method_title: s?.payment_method_title ?? null,
        line_items: pickLineItems(s?.line_items),
        meta_data: pickSafeMeta(s?.meta_data),
        notes: pickSubscriptionNotes(notesArr)
      };
    }

    if (url.pathname === "/admin/health" && request.method === "GET") {
      const auth = await requireAdminCookie(request);
      if (!auth.ok) return json(auth.status || 401, { ok: false, error: auth.error || "Unauthorized" }, { "cache-control": "no-store" }, request);
      return json(200, { ok: true, service: "arnold-admin-worker" }, { "cache-control": "no-store" }, request);
    }

    /* ---------------- Radar: Current Actionable Problems ---------------- */

    if (url.pathname === "/admin/radar" && request.method === "GET") {
      const auth = await requireAdminCookie(request);
      if (!auth.ok) {
        return json(
          auth.status || 401,
          { ok: false, error: auth.error || "Unauthorized" },
          { "cache-control": "no-store" },
          request
        );
      }
const cache = caches.default;
const cacheKey = new Request(request.url, request);

const cached = await cache.match(cacheKey);
if (cached) {
  return cached;
}
      const WP_BASE = (env && env.WP_BASE) ? String(env.WP_BASE).trim() : ORIGIN;
      const CK = (env && env.WC_CONSUMER_KEY) ? String(env.WC_CONSUMER_KEY).trim() : "";
      const CS = (env && env.WC_CONSUMER_SECRET) ? String(env.WC_CONSUMER_SECRET).trim() : "";

      if (!CK || !CS) {
        return json(
          500,
          { ok: false, error: "Missing WC_CONSUMER_KEY / WC_CONSUMER_SECRET in Worker secrets" },
          { "cache-control": "no-store" },
          request
        );
      }

      const AUTH = "Basic " + btoa(`${CK}:${CS}`);

      async function wooGet(path) {
        const u = new URL(path, WP_BASE);
        const resp = await fetch(u.toString(), {
          method: "GET",
          headers: { "Authorization": AUTH, "Accept": "application/json" }
        });
        const txt = await resp.text();
        let data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
        return { resp, data, url: u.toString() };
      }

      async function fetchOrderNotes(orderId) {
        if (!orderId) return [];
        const n = await wooGet(`/wp-json/wc/v3/orders/${encodeURIComponent(String(orderId))}/notes?per_page=20`);
        if (!n.resp.ok) return [];
        return Array.isArray(n.data) ? n.data : [];
      }

      function safeName(first, last) {
        return `${first || ""} ${last || ""}`.trim() || "Unknown customer";
      }

      function issueSortRank(issue) {
        switch (issue) {
          case "failed-renewal": return 1;
          case "on-hold": return 2;
          case "pending-cancel": return 3;
          case "expired": return 4;
          default: return 9;
        }
      }

      function bestRadarDate(item) {
        return item?.date ? String(item.date) : "";
      }

      function normalizeRadarReason(rawText) {
        const s = String(rawText || "").toLowerCase();
if (s.includes("do not honor")) return "Card declined";
if (s.includes("insufficient funds")) return "Insufficient funds";
if (s.includes("card_expired")) return "Expired card";
if (s.includes("expired card")) return "Expired card";
if (s.includes("lost card")) return "Card reported lost";
if (s.includes("stolen card")) return "Card reported stolen";
if (s.includes("pickup card")) return "Card blocked by issuer";
if (s.includes("authentication required")) return "3D secure authentication required";
if (s.includes("authentication failed")) return "3D secure authentication failed";
        if (!s) return null;
        if (s.includes("insufficient")) return "Insufficient funds";
        if (s.includes("expired")) return "Expired card";
        if (s.includes("declined")) return "Card declined";
        if (s.includes("cvv")) return "Card verification failed";
        if (s.includes("verification")) return "Card verification failed";
        if (s.includes("postal")) return "Billing ZIP verification failed";
        if (s.includes("avs")) return "Billing address verification failed";
if (s.includes("saved payment")) return "Card on file needs update";
if (s.includes("token")) return "Card on file needs update";
        if (s.includes("square")) return "Square payment failed";
        if (s.includes("payment failed")) return "Payment failed";
        if (s.includes("failed")) return "Payment failed";

        return null;
      }

      async function deriveFailedOrderReason(orderObj) {
        const orderId = orderObj?.id ?? null;
        if (!orderId) return "Payment failed";

// Fast local checks before expensive notes lookup
const metaArr = Array.isArray(orderObj?.meta_data) ? orderObj.meta_data : [];
for (const m of metaArr) {
  const maybe = normalizeRadarReason(`${m?.key || ""} ${m?.value || ""}`);
  if (maybe) return maybe;
}

const pmTitle = String(orderObj?.payment_method_title || "").toLowerCase();
if (pmTitle.includes("square")) return "Square payment failed";


  try {

    const notesResp = await wooGet(`/wp-json/wc/v3/orders/${orderId}/notes?per_page=20`);

    if (notesResp?.resp?.ok) {
      const notes = await notesResp.data;

      const joined = notes
        .map(n => String(n?.note || ""))
        .filter(Boolean)
        .join(" ");

      const fromNotes = normalizeRadarReason(joined);

      if (fromNotes) return fromNotes;
    }

  } catch (_) {}


        return "Payment failed";
      }

      async function fetchActionableFailedRenewals() {
        const r = await wooGet(`/wp-json/wc/v3/orders?status=failed&per_page=100&orderby=date&order=desc`);
        if (!r.resp.ok) return [];

        const activeSubsResp = await wooGet(
          `/wp-json/wc/v3/subscriptions?status=active&per_page=100&orderby=date&order=desc`
        );

        const activeCustomerIds = new Set();
        const activeEmails = new Set();

        if (activeSubsResp.resp.ok && Array.isArray(activeSubsResp.data)) {
          for (const s of activeSubsResp.data) {
            const cid = String(s?.customer_id || "").trim();
            const email = String(s?.billing?.email || "").trim().toLowerCase();

            if (cid) activeCustomerIds.add(cid);
            if (email) activeEmails.add(email);
          }
        }

        const arr = Array.isArray(r.data) ? r.data : [];
        const seen = new Set();
        const out = [];

        for (const o of arr) {
          const orderId = o?.id ?? null;
          if (!orderId) continue;

          const pmTitle = String(o?.payment_method_title || "").toLowerCase();
          const pm = String(o?.payment_method || "").toLowerCase();
          const createdVia = String(o?.created_via || "").toLowerCase();

          const lineNames = Array.isArray(o?.line_items)
            ? o.line_items.map((li) => String(li?.name || "")).join(" ").toLowerCase()
            : "";

          const metaText = Array.isArray(o?.meta_data)
            ? o.meta_data.map((m) => `${m?.key || ""} ${m?.value || ""}`).join(" ").toLowerCase()
            : "";

          const likelySubscriptionRelated =
            pmTitle.includes("square") ||
            pm.includes("square") ||
            createdVia.includes("subscription") ||
            lineNames.includes("subscription") ||
            lineNames.includes("renewal") ||
            metaText.includes("subscription") ||
            metaText.includes("renewal");

          if (!likelySubscriptionRelated) continue;

          const dedupeKey =
            String(o?.customer_id || "").trim() ||
            String(o?.billing?.email || "").trim().toLowerCase() ||
            `order:${orderId}`;

          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          

          // Skip recovered failures:
          // if this customer/email currently has any active subscription,
          // do not show this failed renewal on Radar.
          const orderCustomerId = String(o?.customer_id || "").trim();
          const orderEmail = String(o?.billing?.email || "").trim().toLowerCase();

          const hasActiveSubscription =
            (orderCustomerId && activeCustomerIds.has(orderCustomerId)) ||
            (orderEmail && activeEmails.has(orderEmail));

          if (hasActiveSubscription) {
            continue;
          }

          const renewalMeta = Array.isArray(o?.meta_data)
            ? o.meta_data.find((m) =>
                m?.key === "_subscription_renewal" ||
                m?.key === "_parent_subscription"
              )
            : null;

          const subscriptionId = renewalMeta?.value != null
            ? String(renewalMeta.value).trim()
            : null;

          out.push({
            id_type: "order",
            id: orderId,
            display_id: `Order #${orderId}`,
            subscription_id: subscriptionId || null,
            customer_name: safeName(o?.billing?.first_name, o?.billing?.last_name),
            email: o?.billing?.email ?? null,
            issue: "failed-renewal",
            date: o?.date_created ?? null,
            reason: null,
            _source_order: o
          });

          if (out.length >= 50) break;
        }

        return out;
      }
      async function fetchActionableOnHoldSubscriptions() {
        const r = await wooGet(`/wp-json/wc/v3/subscriptions?status=on-hold&per_page=100&orderby=date&order=desc`);
        if (!r.resp.ok) return [];

        const arr = Array.isArray(r.data) ? r.data : [];
        const out = [];

        for (const s of arr) {
          const subId = s?.id ?? null;
          if (!subId) continue;

out.push({
  id_type: "subscription",
  id: subId,
  display_id: `Sub #${subId}`,
  customer_name: safeName(s?.billing?.first_name, s?.billing?.last_name),
  email: s?.billing?.email ?? null,
  issue: "on-hold",
  total: s?.total ?? null,
  date: normalizeNullableDate(s?.next_payment_date ?? s?.date_created ?? null),
  reason: "Subscription on hold"
});
        }

        return out;
      }

      async function fetchActionablePendingCancelSubscriptions() {
        const r = await wooGet(`/wp-json/wc/v3/subscriptions?status=pending-cancel&per_page=100&orderby=date&order=desc`);
        if (!r.resp.ok) return [];

        const arr = Array.isArray(r.data) ? r.data : [];
        const out = [];

        for (const s of arr) {
          const subId = s?.id ?? null;
          if (!subId) continue;

out.push({
  id_type: "subscription",
  id: subId,
  display_id: `Sub #${subId}`,
  customer_name: safeName(s?.billing?.first_name, s?.billing?.last_name),
  email: s?.billing?.email ?? null,
  issue: "pending-cancel",
  total: s?.total ?? null,
  date: normalizeNullableDate(s?.end_date ?? s?.next_payment_date ?? s?.date_created ?? null),
  reason: "Pending cancellation"
});
        }

        return out;
      }

      async function fetchActionableRecentExpiredSubscriptions() {
        const r = await wooGet(`/wp-json/wc/v3/subscriptions?status=expired&per_page=100&orderby=date&order=desc`);
        if (!r.resp.ok) return [];

        const arr = Array.isArray(r.data) ? r.data : [];
        const out = [];
        const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);

        for (const s of arr) {
          const subId = s?.id ?? null;
          if (!subId) continue;

          const endRaw = normalizeNullableDate(s?.end_date ?? null);
          if (!endRaw) continue;

          const endTs = new Date(endRaw).getTime();
          if (!endTs || Number.isNaN(endTs)) continue;
          if (endTs < cutoff) continue;

          out.push({
            id_type: "subscription",
            id: subId,
            display_id: `Sub #${subId}`,
            customer_name: safeName(s?.billing?.first_name, s?.billing?.last_name),
            email: s?.billing?.email ?? null,
            issue: "expired",
            date: endRaw,
            reason: "Subscription expired"
          });
        }

        return out;
      }

      const [
        failedRenewals,
        onHold,
        pendingCancel,
        recentExpired
      ] = await Promise.all([
        fetchActionableFailedRenewals(),
        fetchActionableOnHoldSubscriptions(),
        fetchActionablePendingCancelSubscriptions(),
        fetchActionableRecentExpiredSubscriptions()
      ]);

      const MAX_RADAR_ITEMS = 25;

const issueFilter = (url.searchParams.get("issue") || "").trim();

let allItems = [
  ...failedRenewals,
  ...onHold,
  ...pendingCancel,
  ...recentExpired
];

if (issueFilter) {
  allItems = allItems.filter(i => i.issue === issueFilter);
}


function radarReasonPriority(item) {
  const reason = String(item?.reason || "").toLowerCase();

  if (
    reason.includes("square") ||
    reason.includes("gateway") ||
    reason.includes("authentication required") ||
    reason.includes("authentication failed") ||
    reason.includes("3d secure")
  ) return 1;

  if (
    reason.includes("expired") ||
    reason.includes("declined") ||
    reason.includes("insufficient") ||
    reason.includes("card on file needs update")
  ) return 2;

  return 5;
}
function classifyRecoveryOpportunity(item) {
  const reason = String(item?.reason || "").toLowerCase();
  const issue = String(item?.issue || "").toLowerCase();

  if (
    reason.includes("square") ||
    reason.includes("gateway") ||
    reason.includes("authentication required") ||
    reason.includes("authentication failed") ||
    reason.includes("3d secure")
  ) {
    return {
      recovery_type: "investigate_gateway",
      recovery_label: "Investigate gateway"
    };
  }

  if (
    reason.includes("expired") ||
    reason.includes("card on file needs update") ||
    reason.includes("saved payment") ||
    reason.includes("token")
  ) {
    return {
      recovery_type: "update_payment_method",
      recovery_label: "Update payment method"
    };
  }

  if (
    reason.includes("declined") ||
    reason.includes("insufficient")
  ) {
    return {
      recovery_type: "retry_payment",
      recovery_label: "Retry payment"
    };
  }

  if (issue === "on-hold") {
    return {
      recovery_type: "review_on_hold_subscription",
      recovery_label: "Review on-hold subscription"
    };
  }

  if (issue === "pending-cancel") {
    return {
      recovery_type: "save_pending_cancel",
      recovery_label: "Review pending cancel"
    };
  }

  if (issue === "expired") {
    return {
      recovery_type: "winback_expired_subscriber",
      recovery_label: "Review expired subscriber"
    };
  }

  return {
    recovery_type: "review_subscription",
    recovery_label: "Review subscription"
  };
}
allItems = await Promise.all(
  allItems.map(async (item) => {
    if (item.issue !== "failed-renewal" || !item.id) {
      return {
        ...item,
        ...classifyRecoveryOpportunity(item)
      };
    }

    let orderObj = item._source_order || null;

    if (!orderObj) {
      const orderResp = await wooGet(`/wp-json/wc/v3/orders/${encodeURIComponent(String(item.id))}`);
      if (!orderResp.resp.ok || !orderResp.data) {
        const { _source_order, ...cleanItem } = item;
        return {
          ...cleanItem,
          ...classifyRecoveryOpportunity(cleanItem)
        };
      }
      orderObj = orderResp.data;
    }

    const reason = await deriveFailedOrderReason(orderObj);
    const { _source_order, ...cleanItem } = item;

    const enrichedItem = {
      ...cleanItem,
      reason
    };

    return {
      ...enrichedItem,
      ...classifyRecoveryOpportunity(enrichedItem)
    };
  })
);

allItems = allItems.sort((a, b) => {
  const reasonRankDiff = radarReasonPriority(a) - radarReasonPriority(b);
  if (reasonRankDiff !== 0) return reasonRankDiff;

  const issueRankDiff = issueSortRank(a.issue) - issueSortRank(b.issue);
  if (issueRankDiff !== 0) return issueRankDiff;

  const aTs = new Date(bestRadarDate(a) || 0).getTime();
  const bTs = new Date(bestRadarDate(b) || 0).getTime();
  return bTs - aTs;
});

const page = Number(url.searchParams.get("page") || 1);
const pageSize = MAX_RADAR_ITEMS;

// Detect repeat problem subscribers across ALL radar items
const repeatIndex = {};

for (const r of allItems) {
  const email = String(r?.email || "").trim().toLowerCase();
  if (!email) continue;
  repeatIndex[email] = (repeatIndex[email] || 0) + 1;
}

const repeatSubscribers = Object.entries(repeatIndex)
  .filter(([email, count]) => count > 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([email, count]) => ({ email, count }));

const start = (page - 1) * pageSize;
const end = start + pageSize;

let items = allItems.slice(start, end);
    // Compute revenue at risk
let revenueAtRisk = 0;

for (const r of failedRenewals) {
  const total = Number(r?._source_order?.total || 0);
  if (!Number.isNaN(total)) revenueAtRisk += total;
}

for (const s of onHold) {
  const total = Number(s?.total || 0);
  if (!Number.isNaN(total)) revenueAtRisk += total;
}

for (const s of pendingCancel) {
  const total = Number(s?.total || 0);
  if (!Number.isNaN(total)) revenueAtRisk += total;
}      
const summary = {
  failedRenewals: failedRenewals.length,
  onHold: onHold.length,
  pendingCancel: pendingCancel.length,
  recentExpired: recentExpired.length,
  revenueAtRisk
};
const now = Date.now();
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;

const gatewayFailureItems = allItems.filter((item) => {
  const reason = String(item?.reason || "").toLowerCase();
  return (
    reason.includes("square") ||
    reason.includes("gateway") ||
    reason.includes("authentication required") ||
    reason.includes("authentication failed") ||
    reason.includes("3d secure")
  );
});

const recentGatewayFailureItems = gatewayFailureItems.filter((item) => {
  if (!item?.date) return false;
  const ts = new Date(item.date).getTime();
  if (!Number.isFinite(ts)) return false;
  return (now - ts) <= FIVE_MINUTES_MS;
});
const gatewayFailureItems30m = gatewayFailureItems.filter((item) => {
  if (!item?.date) return false;
  const ts = new Date(item.date).getTime();
  if (!Number.isFinite(ts)) return false;
  return (now - ts) <= THIRTY_MINUTES_MS;
});

const gatewayFailureItems60m = gatewayFailureItems.filter((item) => {
  if (!item?.date) return false;
  const ts = new Date(item.date).getTime();
  if (!Number.isFinite(ts)) return false;
  return (now - ts) <= SIXTY_MINUTES_MS;
});
const failureCount5m = recentGatewayFailureItems.length;
const failureCount30m = gatewayFailureItems30m.length;
const failureCount60m = gatewayFailureItems60m.length;

let gatewayFailureTrend = "stable";
if (failureCount5m >= 5 && failureCount30m >= failureCount5m * 2) {
  gatewayFailureTrend = "increasing";
} else if (failureCount5m === 0 && failureCount30m > 0) {
  gatewayFailureTrend = "cooling";
}

const gatewayOutageDetected = failureCount5m >= 5;

const gatewayEscalating =
  gatewayOutageDetected &&
  gatewayFailureTrend === "increasing" &&
  failureCount30m >= 10;

const radarSignals = {
  gateway_outage_detected: gatewayOutageDetected,
  gateway_escalating: gatewayEscalating,
  gateway_failure_count_5m: failureCount5m,
  gateway_failure_count_30m: failureCount30m,
  gateway_failure_count_60m: failureCount60m,
  gateway_failure_trend: gatewayFailureTrend
};
const recentGatewayEmails = new Set(
  recentGatewayFailureItems
    .map((item) => String(item?.email || "").trim().toLowerCase())
    .filter(Boolean)
);

let gatewayRevenueAtRisk5m = 0;
for (const item of recentGatewayFailureItems) {
  const total = Number(item?.total || item?._source_order?.total || 0);
  if (!Number.isNaN(total)) gatewayRevenueAtRisk5m += total;
}

const gatewayIncidents = [];

if (recentGatewayFailureItems.length || gatewayFailureItems30m.length || gatewayFailureItems60m.length) {
  gatewayIncidents.push({
    gateway: "square",
    status: failureCount5m >= 5 ? "degraded" : "elevated",
    failures_5m: failureCount5m,
    failures_30m: failureCount30m,
    failures_60m: failureCount60m,
    failure_trend: gatewayFailureTrend,
    affected_subscribers_5m: recentGatewayEmails.size,
    revenue_at_risk_5m: gatewayRevenueAtRisk5m
  });
}
const payload = {
  ok: true,
  summary,
  items,
  currency: items?.[0]?.currency || "USD",
  repeatSubscribers,
  visible_limit: MAX_RADAR_ITEMS,
  total_actionable_items: allItems.length,
  radar_signals: radarSignals,
  gateway_incidents: gatewayIncidents
};
const response = json(
  200,
  payload,
  { "cache-control": `public, max-age=${RADAR_CACHE_SECONDS}` },
  request
);

ctx.waitUntil(
  caches.default.put(
    new Request(request.url, request),
    response.clone()
  )
);

return response;

    }

    // ✅ /admin/stats (cookie locked) — Totals screen support
    // - Subscriptions: labeled counts
    // - Orders: ALL TIME counts by status (no 30-day window)
    if (url.pathname === "/admin/stats" && request.method === "GET") {
      const auth = await requireAdminCookie(request);
      if (!auth.ok) {
        return json(
          auth.status || 401,
          { ok: false, error: auth.error || "Unauthorized" },
          { "cache-control": "no-store" },
          request
        );
      }

      const WP_BASE = (env && env.WP_BASE) ? String(env.WP_BASE).trim() : ORIGIN;
      const CK = (env && env.WC_CONSUMER_KEY) ? String(env.WC_CONSUMER_KEY).trim() : "";
      const CS = (env && env.WC_CONSUMER_SECRET) ? String(env.WC_CONSUMER_SECRET).trim() : "";
      if (!CK || !CS) {
        return json(
          500,
          { ok: false, error: "Missing WC_CONSUMER_KEY / WC_CONSUMER_SECRET in Worker secrets" },
          { "cache-control": "no-store" },
          request
        );
      }

      const AUTH = "Basic " + btoa(`${CK}:${CS}`);

      async function wooGetWithHeaders(path) {
        const u = new URL(path, WP_BASE);
        const resp = await fetch(u.toString(), {
          method: "GET",
          headers: { "Authorization": AUTH, "Accept": "application/json" }
        });

        const totalHeader = resp.headers.get("X-WP-Total");
        const total = totalHeader ? parseInt(totalHeader, 10) : NaN;

        let data = null;
        try { data = await resp.json(); } catch (_) { data = null; }

        return { resp, total, data, url: u.toString() };
      }

      async function wooCount(pathBase) {
        const first = await wooGetWithHeaders(pathBase);
        if (first.resp.ok && Number.isFinite(first.total)) {
          return { ok: true, count: Math.max(0, first.total), url: first.url };
        }
        if (!first.resp.ok) {
          return { ok: false, status: first.resp.status, url: first.url, error: first.data };
        }

        // Fallback: page through counts
        let count = 0;
        let page = 1;

        while (page <= 200) {
          const sep = pathBase.includes("?") ? "&" : "?";
          const pagedPath = `${pathBase}${sep}per_page=100&page=${page}`;
          const r = await wooGetWithHeaders(pagedPath);
          if (!r.resp.ok) return { ok: false, status: r.resp.status, url: r.url, error: r.data };
          const arr = Array.isArray(r.data) ? r.data : [];
          count += arr.length;
          if (arr.length < 100) break;
          page += 1;
        }

        return { ok: true, count, url: first.url };
      }

      // --- Subscriptions: EXACT labels requested by user (label -> API slug) ---
      const subStatusMap = [
        ["Trash", "trash"],
        ["Active", "active"],
        ["Expired", "expired"],
        ["On hold", "on-hold"],
        ["Pending payment", "pending"],
        ["Pending cancellation", "pending-cancel"],
        ["Cancelled", "cancelled"],
      ];

      const subscriptions_by_status = {};
      for (const [label, slug] of subStatusMap) {
        const r = await wooCount(`/wp-json/wc/v3/subscriptions?status=${encodeURIComponent(slug)}&per_page=1`);
        subscriptions_by_status[label] = r.ok ? r.count : 0;
      }

      // --- Orders: ALL TIME by status (NO `after=` filter) ---
      const orderStatuses = [
        "pending",
        "processing",
        "on-hold",
        "completed",
        "cancelled",
        "refunded",
        "failed"
      ];

      const ordersByStatus = {};
      let ordersTotal = 0;

      for (const st of orderStatuses) {
        const r = await wooCount(
          `/wp-json/wc/v3/orders?status=${encodeURIComponent(st)}&per_page=1`
        );
        const c = r.ok ? r.count : 0;
        ordersByStatus[st] = c;
        ordersTotal += c;
      }

      return json(
        200,
        {
          ok: true,
          generated_at: new Date().toISOString(),
          subscriptions_by_status,

          // Preserve key for UI compatibility; now represents ALL TIME
          orders_last_30d: {
            window: "all_time",
            after: null,
            total: ordersTotal,
            failed: ordersByStatus.failed ?? 0,
            pending: ordersByStatus.pending ?? 0,
            by_status: ordersByStatus
          }
        },
        { "cache-control": "no-store" },
        request
      );
    }

    // ✅ /admin/nl-search (cookie locked)
    if (url.pathname === "/admin/nl-search" && request.method === "POST") {
      const auth = await requireAdminCookie(request);
      if (!auth.ok) return json(auth.status || 401, { ok: false, error: auth.error || "Unauthorized" }, { "cache-control": "no-store" }, request);

      let body = null;
      try { body = await request.json(); } catch (_) { body = null; }

      const raw = String(body?.query || "").trim();
      const mode = String(body?.mode || "full").trim().toLowerCase();
      if (!raw) return json(400, { ok: false, error: "Missing query" }, { "cache-control": "no-store" }, request);

      const WP_BASE = (env && env.WP_BASE) ? String(env.WP_BASE).trim() : ORIGIN;
      const CK = (env && env.WC_CONSUMER_KEY) ? String(env.WC_CONSUMER_KEY).trim() : "";
      const CS = (env && env.WC_CONSUMER_SECRET) ? String(env.WC_CONSUMER_SECRET).trim() : "";
      if (!CK || !CS) return json(500, { ok: false, error: "Missing WC_CONSUMER_KEY / WC_CONSUMER_SECRET in Worker secrets" }, { "cache-control": "no-store" }, request);

      const AUTH = "Basic " + btoa(`${CK}:${CS}`);

      async function wooGet(path) {
        const u = new URL(path, WP_BASE);
        const resp = await fetch(u.toString(), { method: "GET", headers: { "Authorization": AUTH, "Accept": "application/json" } });
        const txt = await resp.text();
        let data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
        return { resp, data, url: u.toString() };
      }

      async function fetchSubscriptionNotes(subId) {
        if (!subId) return [];
        const n = await wooGet(`/wp-json/wc/v3/subscriptions/${encodeURIComponent(String(subId))}/notes?per_page=100`);
        if (!n.resp.ok) return [];
        return Array.isArray(n.data) ? n.data : [];
      }
      // ✅ SAFE ADDITIVE: order notes
      async function fetchOrderNotes(orderId) {
        if (!orderId) return [];
        const n = await wooGet(`/wp-json/wc/v3/orders/${encodeURIComponent(String(orderId))}/notes?per_page=100`);
        if (!n.resp.ok) return [];
        return Array.isArray(n.data) ? n.data : [];
      }

      async function attachNotesAndPickSubscriptions(rawSubs) {
        const subs = Array.isArray(rawSubs) ? rawSubs : [];
        return Promise.all(
          subs.map(async (s) => {
            const id = s?.id ?? null;
            let notes = [];
            try { notes = await fetchSubscriptionNotes(id); } catch (_) { notes = []; }
            return pickSubscription(s, notes);
          })
        );
      }

      // ✅ SAFE ADDITIVE: attach notes to orders and pick
      async function attachNotesAndPickOrders(rawOrders) {
        const orders = Array.isArray(rawOrders) ? rawOrders : [];
        return Promise.all(
          orders.map(async (o) => {
            const id = o?.id ?? null;
            let notes = [];
            try { notes = await fetchOrderNotes(id); } catch (_) { notes = []; }
            return pickOrder(o, notes);
          })
        );
      }

      async function fetchSubscriptionsByCustomerId(customerId) {
        if (!customerId) return [];
        const s = await wooGet(`/wp-json/wc/v3/subscriptions?customer=${encodeURIComponent(String(customerId))}&per_page=50`);
        if (!s.resp.ok) return [];
        const rawSubs = Array.isArray(s.data) ? s.data : [];
        return attachNotesAndPickSubscriptions(rawSubs);
      }

      async function fetchOrdersByCustomerId(customerId) {
        if (!customerId) return [];
        const o = await wooGet(`/wp-json/wc/v3/orders?customer=${encodeURIComponent(String(customerId))}&per_page=10&orderby=date&order=desc`);
        if (!o.resp.ok) return [];
        const rawOrders = Array.isArray(o.data) ? o.data : [];
        return attachNotesAndPickOrders(rawOrders);
      }

      async function fetchOrdersByEmail(email) {
        const emailLc = String(email || "").toLowerCase();
        const o = await wooGet(`/wp-json/wc/v3/orders?search=${encodeURIComponent(email)}&per_page=20&orderby=date&order=desc`);
        if (!o.resp.ok) return [];
        const arr = Array.isArray(o.data) ? o.data : [];

        const filtered = arr
          .filter(x => String(x?.billing?.email || "").toLowerCase() === emailLc)
          .slice(0, 10);

        return attachNotesAndPickOrders(filtered);
      }

      async function fetchSubscriptionsByEmail(email) {
        const emailLc = String(email || "").toLowerCase();
        const s = await wooGet(`/wp-json/wc/v3/subscriptions?search=${encodeURIComponent(email)}&per_page=50&orderby=date&order=desc`);
        if (!s.resp.ok) return [];
        const arr = Array.isArray(s.data) ? s.data : [];
        const filtered = arr
          .filter(x => String(x?.billing?.email || "").toLowerCase() === emailLc)
          .slice(0, 50);
        return attachNotesAndPickSubscriptions(filtered);
      }

      async function fetchCustomerById(customerId) {
        if (!customerId) return null;
        const c = await wooGet(`/wp-json/wc/v3/customers/${encodeURIComponent(String(customerId))}`);
        if (!c.resp.ok) return null;
        return c.data || null;
      }

      // ✅ Username “always correct” helper:
      async function ensureFullCustomerIfUsernameMissing(customerObj) {
        const id = customerObj?.id ?? null;
        const u = customerObj?.username ?? null;
        if (!id) return customerObj;
        if (u != null && String(u).trim()) return customerObj;

        const full = await fetchCustomerById(id);
        return full || customerObj;
      }

      async function fetchCustomerCandidatesByName(nameQuery) {
        const query = String(nameQuery || "").trim();
        if (!query) return [];

        const c = await wooGet(`/wp-json/wc/v3/customers?search=${encodeURIComponent(query)}&per_page=20`);
        if (!c.resp.ok) return [];

        const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
        const arr = Array.isArray(c.data) ? c.data : [];

        const scored = arr.map((cust) => {
          const first = String(cust?.first_name ?? "").trim();
          const last = String(cust?.last_name ?? "").trim();
          const full = `${first} ${last}`.trim();
          const email = String(cust?.email ?? "").trim();
          const username = String(cust?.username ?? "").trim();
          const haystack = [full, first, last, email, username].join(" ").toLowerCase();

          const tokenHits = tokens.filter((t) => haystack.includes(t)).length;
          let score = tokenHits * 10;
          if (full && full.toLowerCase() === query.toLowerCase()) score += 50;
          if (last && last.toLowerCase() === query.toLowerCase()) score += 25;
          if (first && first.toLowerCase() === query.toLowerCase()) score += 20;
          if (email && email.toLowerCase() === query.toLowerCase()) score += 100;
          if (username && username.toLowerCase() === query.toLowerCase()) score += 40;

          return { cust, score, tokenHits };
        })
        .filter((x) => x.tokenHits > 0 || x.score > 0)
        .sort((a, b) => b.score - a.score || String(a.cust?.id ?? "").localeCompare(String(b.cust?.id ?? ""), undefined, { numeric: true }));

        return scored.slice(0, 12).map((x) => pickCustomer(x.cust));
      }

      async function fetchFullContextForCustomerId(customerId) {
        if (!customerId) return null;

        let fullCustomer = await fetchCustomerById(customerId);
        if (fullCustomer?.id) {
          try {
            fullCustomer = await ensureFullCustomerIfUsernameMissing(fullCustomer);
          } catch (_) {}
        }

        const customer = fullCustomer ? pickCustomer(fullCustomer) : null;
        const subscriptions = await fetchSubscriptionsByCustomerId(customerId);
        const orders = await fetchOrdersByCustomerId(customerId);

        return { customer, subscriptions, orders };
      }

      const q = raw.replace(/\s+/g, " ").trim();
      const emailMatch = q.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const wantsSubscription = /\bsubscription(s)?\b/i.test(q);
      const wantsMembership = /\bmembership(s)?\b/i.test(q);
      const wantsOrders = /\borders?\b/i.test(q);

      const orderIdMatch =
        q.match(/(?:\border\s*#?\s*)(\d{3,})\b/i) ||
        q.match(/^#?(\d{3,})$/);

      const subscriptionIdMatch =
        q.match(/(?:\bsubscription\s*#?\s*)(\d{3,})\b/i) ||
        q.match(/(?:\bsub\s*#?\s*)(\d{3,})\b/i);

      const customerIdMatch =
        q.match(/(?:\bcustomer\s*#?\s*)(\d{1,})\b/i) ||
        q.match(/(?:\bcustomer\s+id\s*#?\s*)(\d{1,})\b/i) ||
        q.match(/(?:\bid\s*#?\s*)(\d{1,})\b/i);

           if (orderIdMatch) {
        const orderId = orderIdMatch[1];
        const o = await wooGet(`/wp-json/wc/v3/orders/${encodeURIComponent(String(orderId))}`);
        if (!o.resp.ok) {
          return json(
            o.resp.status,
            { ok: false, intent: "order_by_id", step: "order", order_id: orderId, url: o.url, error: o.data },
            { "cache-control": "no-store" },
            request
          );
        }

        const rawOrder = o.data || null;

        // ✅ SAFE ADDITIVE: pull order notes for this order id
        let orderNotes = [];
        try { orderNotes = rawOrder?.id ? await fetchOrderNotes(rawOrder.id) : []; } catch (_) { orderNotes = []; }

        const order = rawOrder ? pickOrder(rawOrder, orderNotes) : null;

        const customerId = rawOrder?.customer_id ?? null;
        const email = rawOrder?.billing?.email ?? null;

        let customer = null;
        if (customerId) {
          const c = await fetchCustomerById(customerId);
          customer = c ? pickCustomer(c) : null;
        }

        let subscriptions = customerId ? await fetchSubscriptionsByCustomerId(customerId) : [];
        if (!subscriptions.length && email) {
          subscriptions = await fetchSubscriptionsByEmail(email);
        }

        let contextCustomer = customer;
        if (!contextCustomer && order?.billing) {
          contextCustomer = {
            id: customerId ?? null,
            username: null,
            email: order.billing.email ?? email ?? null,
            first_name: order.billing.first_name ?? null,
            last_name: order.billing.last_name ?? null,
            role: null,
            date_created: null,
            billing: order.billing,
            shipping: order.shipping ?? null,
            meta_data: []
          };
        }

        return json(
          200,
          {
            ok: true,
            intent: "order_by_id",
            order_id: String(orderId),
            context: {
              customer: contextCustomer,
              order: order || null,
              subscriptions,
              orders: order ? [order] : []
            }
          },
          { "cache-control": "no-store" },
          request
        );
      }
      if (subscriptionIdMatch) {
        const subscriptionId = subscriptionIdMatch[1];

        const s = await wooGet(`/wp-json/wc/v3/subscriptions/${encodeURIComponent(String(subscriptionId))}`);
        if (!s.resp.ok) {
          return json(
            s.resp.status,
            {
              ok: false,
              intent: "subscription_by_id",
              subscription_id: String(subscriptionId),
              step: "subscription",
              url: s.url,
              error: s.data
            },
            { "cache-control": "no-store" },
            request
          );
        }

        const rawSub = s.data || null;

        let subscriptionNotes = [];
        try { subscriptionNotes = rawSub?.id ? await fetchSubscriptionNotes(rawSub.id) : []; } catch (_) { subscriptionNotes = []; }

        const subscription = rawSub ? pickSubscription(rawSub, subscriptionNotes) : null;

        const customerId = rawSub?.customer_id ?? null;
        const email = rawSub?.billing?.email ?? null;

        let customer = null;
        if (customerId) {
          const c = await fetchCustomerById(customerId);
          customer = c ? pickCustomer(c) : null;
        }

        let subscriptions = subscription ? [subscription] : [];

        let orders = customerId ? await fetchOrdersByCustomerId(customerId) : [];
        if (!orders.length && email) {
          orders = await fetchOrdersByEmail(email);
        }

        let contextCustomer = customer;

        if (!contextCustomer && subscription?.billing) {
          contextCustomer = {
            id: customerId ?? null,
            username: null,
            email: subscription.billing.email ?? email ?? null,
            first_name: subscription.billing.first_name ?? null,
            last_name: subscription.billing.last_name ?? null,
            role: null,
            date_created: null,
            billing: subscription.billing,
            shipping: subscription.shipping ?? null,
            meta_data: []
          };
        }

        return json(
          200,
          {
            ok: true,
            intent: "subscription_by_id",
            subscription_id: String(subscriptionId),
            context: {
              customer: contextCustomer,
              subscriptions,
              orders
            }
          },
          { "cache-control": "no-store" },
          request
        );
      }
      if (customerIdMatch) {
        const customerId = customerIdMatch[1];
        const context = await fetchFullContextForCustomerId(customerId);

        if (!context?.customer && !(context?.subscriptions?.length) && !(context?.orders?.length)) {
          return json(404, { ok: false, intent: "customer_by_id", customer_id: String(customerId), error: "Customer not found" }, { "cache-control": "no-store" }, request);
        }

        return json(
          200,
          {
            ok: true,
            intent: "customer_by_id",
            customer_id: String(customerId),
            context
          },
          { "cache-control": "no-store" },
          request
        );
      }

      if (emailMatch) {
        const email = emailMatch[0];

        const c = await wooGet(`/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}`);
        if (!c.resp.ok) {
          return json(c.resp.status, { ok: false, intent: "customer_lookup", step: "customers", url: c.url, error: c.data }, { "cache-control": "no-store" }, request);
        }

        const customers = Array.isArray(c.data) ? c.data : [];
        let first = customers[0] || null;

        if (first?.id) {
          try {
            first = await ensureFullCustomerIfUsernameMissing(first);
          } catch (_) {}
        }

        const customerId = first?.id || null;
        const customer = first ? pickCustomer(first) : null;

        if (mode === "customer_only" && customer) {
          return json(
            200,
            {
              ok: true,
              intent: "customer_by_email_partial",
              matches: customers.length,
              results: customers.slice(0, 5).map(pickCustomer),
              context: { customer, subscriptions: [], orders: [] }
            },
            { "cache-control": "no-store" },
            request
          );
        }

        let subscriptions = customerId ? await fetchSubscriptionsByCustomerId(customerId) : [];
        if (!subscriptions.length) {
          subscriptions = await fetchSubscriptionsByEmail(email);
        }

        let inferredCustomerId = null;
        if (!customerId && subscriptions.length) {
          const sid = subscriptions[0]?.customer_id ?? null;
          if (sid != null && String(sid).trim()) inferredCustomerId = String(sid).trim();
        }

        let orders = customerId ? await fetchOrdersByCustomerId(customerId) : [];
        if (!orders.length && inferredCustomerId) {
          orders = await fetchOrdersByCustomerId(inferredCustomerId);
        }

        const byEmail = await fetchOrdersByEmail(email);

        const seen = new Set();
        const merged = [];
        for (const o2 of [...orders, ...byEmail]) {
          const id2 = o2?.id ?? null;
          if (!id2) continue;
          if (seen.has(id2)) continue;
          seen.add(id2);
          merged.push(o2);
        }
        orders = merged;

        let contextCustomer = customer;

        if (!contextCustomer && inferredCustomerId) {
          try {
            const full = await fetchCustomerById(inferredCustomerId);
            if (full) contextCustomer = pickCustomer(full);
          } catch (_) {}
        }

        if (!contextCustomer && orders.length) {
          const firstOrder = orders[0];
          const b = firstOrder?.billing || null;
          const s2 = firstOrder?.shipping || null;
          contextCustomer = {
            id: null,
            username: null,
            email: b?.email ?? email,
            first_name: b?.first_name ?? null,
            last_name: b?.last_name ?? null,
            role: null,
            date_created: null,
            billing: b,
            shipping: s2,
            meta_data: []
          };
        }

        if (!contextCustomer && subscriptions.length) {
          const firstSub = subscriptions[0];
          const b = firstSub?.billing || null;
          const s2 = firstSub?.shipping || null;
          contextCustomer = {
            id: firstSub?.customer_id ?? null,
            username: null,
            email: b?.email ?? email,
            first_name: b?.first_name ?? null,
            last_name: b?.last_name ?? null,
            role: null,
            date_created: null,
            billing: b,
            shipping: s2,
            meta_data: []
          };
        }

        const context = { customer: contextCustomer, subscriptions, orders };

        if (wantsOrders && !wantsSubscription && !wantsMembership) {
          return json(
            200,
            {
              ok: true,
              intent: "orders_by_email",
              email,
              customer_id: customerId,
              inferred_customer_id: inferredCustomerId,
              matches: orders.length,
              results: orders,
              context
            },
            { "cache-control": "no-store" },
            request
          );
        }

// ensure at least one result if we have a context customer
let resultCustomers = customers.slice(0, 5).map(pickCustomer);

if (!resultCustomers.length && contextCustomer) {
  resultCustomers = [contextCustomer];
}

return json(
  200,
  {
    ok: true,
    intent: "customer_by_email",
    matches: resultCustomers.length,
    results: resultCustomers,
    context
  },
          { "cache-control": "no-store" },
          request
        );
      }

      const customerCandidates = await fetchCustomerCandidatesByName(q);
      if (customerCandidates.length) {
        return json(
          200,
          {
            ok: true,
            intent: "customer_candidates_by_name",
            query: q,
            possible_matches: customerCandidates.map((customer) => ({ customer })),
            context: { customer: null, subscriptions: [], orders: [] }
          },
          { "cache-control": "no-store" },
          request
        );
      }

            return json(
        200,
        {
          ok: true,
          intent: "unknown",
          note: "Try: customer email, customer #123, orders for email, subscription for email, membership for email, order #123, coupon CODE.",
          context: { customer: null, subscriptions: [], orders: [] }
        },
        { "cache-control": "no-store" },
        request
      );
    }

    if (url.pathname === "/stores" && request.method === "GET") {
      return handleListStores(request, env);
    }

    if (url.pathname === "/stores/create" && request.method === "POST") {
      return handleCreateStore(request, env);
    }

    if (url.pathname === "/stores/update" && request.method === "POST") {
      return handleUpdateStore(request, env);
    }

    if (url.pathname === "/stores/delete" && request.method === "POST") {
      return handleDeleteStore(request, env);
    }

    if (url.pathname === "/status") {
      return json(200, { ok: true, now: new Date().toISOString(), upstream: ORIGIN }, { "cache-control": "no-store" }, request);
    }

    const allowed = API_ALLOW.some((p) => url.pathname.startsWith(p));
    if (!allowed) return text(403, "Not allowed", request, { "cache-control": "no-store" });

    const upstream = new URL(`${ORIGIN}${url.pathname}${url.search}`);

    const fwdHeaders = new Headers(request.headers);
    ["origin", "referer", "cf-connecting-ip", "x-forwarded-for", "x-forwarded-proto"].forEach((h) => fwdHeaders.delete(h));
    fwdHeaders.delete("cookie");
    fwdHeaders.set("user-agent", "okobserver-proxy/1.3 (+workers)");

    const clientAuth = request.headers.get("Authorization") || "";
    let jwt = null;
    if (clientAuth.toLowerCase().startsWith("bearer ")) jwt = clientAuth.slice(7).trim();
    else jwt = getJwtFromCookie(request);

    const hadAuth = !!(jwt && jwt.trim());
    if (hadAuth) fwdHeaders.set("Authorization", `Bearer ${jwt.trim()}`);
    else fwdHeaders.delete("Authorization");

    const cacheable =
      !hadAuth &&
      (request.method === "GET" || request.method === "HEAD") &&
      !upstream.searchParams.has(NOCACHE_QS);

const init = {
  method: request.method,
  headers: fwdHeaders,
  body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  ...(cacheable ? {
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: {
        "200-299": CACHE_TTL,
        "300-399": 60,
        "401": 0,
        "403": 0,
        "404": 0,
        "500-599": 0
      }
    }
  } : {})
};

    let upstreamResp;
    try {
      upstreamResp = await fetchUpstreamWithOptionalAuth(upstream, init, hadAuth);
    } catch (err) {
      return jsonError(502, "Upstream fetch failed", err, request);
    }

    const outHeaders = new Headers(upstreamResp.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => outHeaders.set(k, v));

    outHeaders.set(
      "access-control-allow-headers",
      request.headers.get("access-control-request-headers") ||
        "content-type, authorization, x-requested-with, x-arnold-token"
    );
    outHeaders.set("access-control-allow-methods", "GET,HEAD,POST,OPTIONS");
    outHeaders.set("access-control-max-age", "86400");
    outHeaders.delete("content-security-policy");
    outHeaders.delete("x-frame-options");

    outHeaders.set("x-proxy-cache", cacheable ? "possible" : "bypass");

    if (hadAuth) {
      outHeaders.set("cache-control", "no-store");
      outHeaders.set("pragma", "no-cache");
      outHeaders.set("expires", "0");
    } else if (upstreamResp.status >= 400) {
      outHeaders.set("cache-control", "no-store");
    }

    return new Response(upstreamResp.body, { status: upstreamResp.status, headers: outHeaders });
  }
};

/* ---------------- helpers ---------------- */

async function handleFullPost(request, url, env) {
  try {
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) return json(400, { ok: false, error: "Missing id" }, { "cache-control": "no-store" }, request);

    const basic = env && env.WP_BASIC_AUTH ? String(env.WP_BASIC_AUTH).trim() : "";
    if (!basic) return json(500, { ok: false, error: "WP_BASIC_AUTH not configured" }, { "cache-control": "no-store" }, request);

    const upstream = new URL(`${ORIGIN}/wp-json/wp/v2/posts/${encodeURIComponent(id)}`);
    upstream.searchParams.set("_embed", "author,wp:featuredmedia,wp:term");

    const resp = await fetch(upstream.toString(), {
      method: "GET",
      headers: { "Authorization": `Basic ${basic}`, "Accept": "application/json" }
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return json(resp.status, { ok: false, status: resp.status, upstream: upstream.pathname + upstream.search, error: data || null }, { "cache-control": "no-store" }, request);
    }

    return json(200, { ok: true, post: data }, { "cache-control": "no-store" }, request);
  } catch (err) {
    return jsonError(500, "full-post failed", err, request);
  }
}

function corsHeaders(req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const originAllowed = reqOrigin && ALLOWED_ORIGINS.has(reqOrigin);

  const base = {
    "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
    "access-control-allow-headers":
      req.headers.get("access-control-request-headers") ||
      "content-type, authorization, x-requested-with, x-arnold-token",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };

  if (originAllowed) {
    return {
      ...base,
      "access-control-allow-origin": reqOrigin,
      "access-control-allow-credentials": "true"
    };
  }

  return {
    ...base,
    "cache-control": "no-store"
  };
}
function text(status, body, req, extraHeaders) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(req),
      "content-type": "text/plain; charset=utf-8",
      ...(extraHeaders || {})
    }
  });
}

function json(status, obj, extraHeaders, req) {
  const headers = {
    ...corsHeaders(req),
    "content-type": "application/json; charset=utf-8",
    ...(extraHeaders || {})
  };
  return new Response(JSON.stringify(obj), { status, headers });
}
function jsonError(status, msg, err, req) {
  return json(
    status,
    { error: msg, detail: String(err?.message || err || ""), path: new URL(req.url).pathname },
    { "cache-control": "no-store" },
    req
  );
}

// 🔴 worker.js