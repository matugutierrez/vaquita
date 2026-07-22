/*
 * Capa de seguridad HTTP: rate limiting por IP y headers defensivos.
 */

/* ---------- Rate limiting (memoria, ventana deslizante) ---------- */

const buckets = new Map();

setInterval(() => {
	const now = Date.now();
	for (const [key, hits] of buckets) {
		const fresh = hits.filter((t) => now - t < 60000);
		if (fresh.length === 0) buckets.delete(key);
		else buckets.set(key, fresh);
	}
}, 60000).unref();

export function clientIp(req) {
	const fwd = req.headers["x-forwarded-for"];
	if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
	return req.socket.remoteAddress || "?";
}

/**
 * true si la IP superó el límite para ese scope en el último minuto.
 * Límites: auth 10/min (fuerza bruta), api 240/min (uso normal generoso).
 */
export function rateLimited(req, scope) {
	const limit = scope === "auth" ? 10 : 240;
	const key = `${scope}:${clientIp(req)}`;
	const now = Date.now();
	const hits = (buckets.get(key) || []).filter((t) => now - t < 60000);
	hits.push(now);
	buckets.set(key, hits);
	return hits.length > limit;
}

/* ---------- Headers de seguridad ---------- */

export function securityHeaders(req) {
	const h = {
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Referrer-Policy": "no-referrer",
		"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
		"Content-Security-Policy":
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
		"Cross-Origin-Opener-Policy": "same-origin",
	};
	if ((req.headers["x-forwarded-proto"] || "") === "https") {
		h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
	}
	return h;
}
