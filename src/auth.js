import crypto from "node:crypto";
import db from "./db.js";

const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SECRET) {
	console.warn(
		"\u26A0\uFE0F  SECRET no definido: los tokens se invalidan al reiniciar. Defin\u00ed SECRET en producci\u00f3n.",
	);
}

const TOKEN_TTL_S = 7 * 24 * 3600;
const TEMP_TTL_S = 5 * 60;

export function hashPassword(password) {
	const salt = crypto.randomBytes(16).toString("hex");
	const hash = crypto
		.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
		.toString("hex");
	return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
	const [salt, hash] = String(stored).split(":");
	if (!salt || !hash) return false;
	const calc = crypto
		.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
		.toString("hex");
	return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calc));
}

function sign(payload) {
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
	return `${body}.${sig}`;
}

function verify(token) {
	if (typeof token !== "string") return null;
	const [body, sig] = token.split(".");
	if (!body || !sig) return null;
	const expected = crypto
		.createHmac("sha256", SECRET)
		.update(body)
		.digest("base64url");
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
	try {
		const payload = JSON.parse(Buffer.from(body, "base64url").toString());
		if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
		return payload;
	} catch {
		return null;
	}
}

export function makeToken(user) {
	return sign({
		uid: user.id,
		epoch: user.token_epoch || 0,
		typ: "session",
		exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S,
	});
}

export function makeTempToken(user) {
	return sign({
		uid: user.id,
		typ: "2fa-pending",
		exp: Math.floor(Date.now() / 1000) + TEMP_TTL_S,
	});
}

export function verifyTempToken(token) {
	const p = verify(token);
	return p && p.typ === "2fa-pending" ? p : null;
}

export async function getUser(req) {
	const auth = req.headers.authorization || "";
	if (!auth.startsWith("Bearer ")) return undefined;
	const payload = verify(auth.slice(7));
	if (!payload || payload.typ !== "session") return undefined;
	const user = await db.get(
		"SELECT id, email, nombre, totp_enabled, token_epoch, created_at FROM users WHERE id = ?",
		[payload.uid],
	);
	if (!user) return undefined;
	if ((user.token_epoch || 0) !== (payload.epoch || 0)) return undefined;
	return user;
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf) {
	let bits = 0;
	let value = 0;
	let out = "";
	for (const byte of buf) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += B32[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += B32[(value << (5 - bits)) & 31];
	return out;
}

function base32Decode(str) {
	let bits = 0;
	let value = 0;
	const out = [];
	for (const ch of String(str).toUpperCase().replace(/[^A-Z2-7]/g, "")) {
		value = (value << 5) | B32.indexOf(ch);
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

export function newTotpSecret() {
	return base32Encode(crypto.randomBytes(20));
}

function hotp(secretB32, counter) {
	const buf = Buffer.alloc(8);
	buf.writeBigUInt64BE(BigInt(counter));
	const hmac = crypto
		.createHmac("sha1", base32Decode(secretB32))
		.update(buf)
		.digest();
	const offset = hmac[hmac.length - 1] & 0xf;
	const code =
		((hmac[offset] & 0x7f) << 24) |
		(hmac[offset + 1] << 16) |
		(hmac[offset + 2] << 8) |
		hmac[offset + 3];
	return String(code % 1e6).padStart(6, "0");
}

export function verifyTotp(secretB32, code) {
	const clean = String(code || "").replace(/\D/g, "");
	if (clean.length !== 6) return false;
	const counter = Math.floor(Date.now() / 1000 / 30);
	for (const c of [counter, counter - 1, counter + 1]) {
		const expected = hotp(secretB32, c);
		if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean)))
			return true;
	}
	return false;
}

export function otpauthUrl(email, secretB32) {
	return `otpauth://totp/VAQUITA:${encodeURIComponent(email)}?secret=${secretB32}&issuer=VAQUITA&algorithm=SHA1&digits=6&period=30`;
}
