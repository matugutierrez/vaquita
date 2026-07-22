import crypto from "node:crypto";

/** Respuesta JSON estándar con headers de seguridad y CORS. */
export function send(res, status, data) {
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	});
	res.end(JSON.stringify(data));
}

/** Lee y parsea el body JSON de una request (límite 100 KB: nadie manda gastos de 1 MB). */
export function readBody(req) {
	return new Promise((resolve) => {
		let data = "";
		req.on("data", (chunk) => {
			data += chunk;
			if (data.length > 1e5) req.destroy();
		});
		req.on("end", () => {
			try {
				resolve(data ? JSON.parse(data) : {});
			} catch {
				resolve({});
			}
		});
		req.on("error", () => resolve({}));
	});
}

export function uuid() {
	return crypto.randomUUID();
}

/** Código de invitación legible: 6 caracteres sin ambiguos (0/O, 1/I/L). */
export function codigoInvitacion() {
	const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
	let out = "";
	const bytes = crypto.randomBytes(6);
	for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
	return out;
}

/** Fecha de hoy en ISO (YYYY-MM-DD). */
export function today(offsetDays = 0) {
	const d = new Date(Date.now() + offsetDays * 86400000);
	return d.toISOString().slice(0, 10);
}

export function isIsoDate(s) {
	return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/* ---------- Validación estricta de entrada ---------- */

export function vStr(v, { min = 0, max = 200 } = {}) {
	if (typeof v !== "string") return null;
	const t = v.trim();
	if (t.length < min || t.length > max) return null;
	return t;
}

/** Monto en CENTAVOS: entero positivo, tope 1.000 millones de pesos. */
export function vMonto(v) {
	const n = Number(v);
	if (!Number.isInteger(n) || n <= 0 || n > 1e11) return null;
	return n;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
