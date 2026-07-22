import db from "../db.js";
import {
	hashPassword,
	verifyPassword,
	makeToken,
	makeTempToken,
	verifyTempToken,
	newTotpSecret,
	verifyTotp,
	otpauthUrl,
} from "../auth.js";
import { send, uuid, vStr, EMAIL_RE } from "../utils.js";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC = "Email o contrase\u00f1a incorrectos"; // nunca revelar cu\u00e1l fall\u00f3

function nowIso() {
	return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function publicUser(u) {
	return {
		id: u.id,
		email: u.email,
		nombre: u.nombre,
		totp_enabled: Number(u.totp_enabled) === 1,
	};
}

/* POST /api/auth/register */
export async function register(req, res, body) {
	const email = vStr(body.email, { min: 5, max: 120 })?.toLowerCase();
	const nombre = vStr(body.nombre, { min: 2, max: 60 });
	const password = typeof body.password === "string" ? body.password : "";
	if (!email || !EMAIL_RE.test(email))
		return send(res, 400, { error: "Email inv\u00e1lido" });
	if (!nombre) return send(res, 400, { error: "Nombre inv\u00e1lido (2-60 caracteres)" });
	if (password.length < 10 || password.length > 200)
		return send(res, 400, {
			error: "La contrase\u00f1a debe tener al menos 10 caracteres",
		});
	if (/^(.)\1+$/.test(password) || /^\d+$/.test(password))
		return send(res, 400, {
			error: "Contrase\u00f1a demasiado d\u00e9bil: us\u00e1 letras y n\u00fameros variados",
		});

	const existing = await db.get("SELECT id FROM users WHERE email = ?", [email]);
	if (existing) return send(res, 409, { error: "Ese email ya est\u00e1 registrado" });

	const user = {
		id: uuid(),
		email,
		nombre,
		password: hashPassword(password),
	};
	await db.run(
		"INSERT INTO users (id, email, password, nombre) VALUES (?, ?, ?, ?)",
		[user.id, user.email, user.password, user.nombre],
	);
	const fresh = await db.get("SELECT * FROM users WHERE id = ?", [user.id]);
	return send(res, 201, { token: makeToken(fresh), user: publicUser(fresh) });
}

/* POST /api/auth/login */
export async function login(req, res, body) {
	const email = vStr(body.email, { min: 5, max: 120 })?.toLowerCase();
	const password = typeof body.password === "string" ? body.password : "";
	if (!email || !password) return send(res, 401, { error: GENERIC });

	const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
	if (!user) return send(res, 401, { error: GENERIC });

	// ¿Cuenta bloqueada por intentos fallidos?
	if (user.locked_until && user.locked_until > nowIso()) {
		return send(res, 423, {
			error: `Cuenta bloqueada por seguridad. Prob\u00e1 de nuevo en unos minutos.`,
		});
	}

	if (!verifyPassword(password, user.password)) {
		const attempts = Number(user.failed_attempts || 0) + 1;
		const lock =
			attempts >= MAX_FAILED
				? new Date(Date.now() + LOCK_MINUTES * 60000)
						.toISOString()
						.slice(0, 19)
						.replace("T", " ")
				: "";
		await db.run(
			"UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
			[attempts >= MAX_FAILED ? 0 : attempts, lock, user.id],
		);
		return send(res, 401, { error: GENERIC });
	}

	await db.run(
		"UPDATE users SET failed_attempts = 0, locked_until = '' WHERE id = ?",
		[user.id],
	);

	// Si tiene 2FA, exigir el c\u00f3digo con un token intermedio de vida corta.
	if (Number(user.totp_enabled) === 1) {
		return send(res, 200, { requiere2fa: true, tempToken: makeTempToken(user) });
	}
	return send(res, 200, { token: makeToken(user), user: publicUser(user) });
}

/* POST /api/auth/2fa  { tempToken, code } */
export async function login2fa(req, res, body) {
	const payload = verifyTempToken(body.tempToken);
	if (!payload) return send(res, 401, { error: "Sesi\u00f3n expirada, ingres\u00e1 de nuevo" });
	const user = await db.get("SELECT * FROM users WHERE id = ?", [payload.uid]);
	if (!user || Number(user.totp_enabled) !== 1)
		return send(res, 401, { error: "Sesi\u00f3n inv\u00e1lida" });
	if (!verifyTotp(user.totp_secret, body.code))
		return send(res, 401, { error: "C\u00f3digo incorrecto" });
	return send(res, 200, { token: makeToken(user), user: publicUser(user) });
}

/* GET /api/auth/me (auth) */
export async function me(req, res, user) {
	return send(res, 200, { user: publicUser(user) });
}

/* POST /api/auth/2fa/setup (auth) -> genera secreto pendiente */
export async function setup2fa(req, res, user) {
	const secret = newTotpSecret();
	await db.run("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?", [
		secret,
		user.id,
	]);
	return send(res, 200, {
		secret,
		otpauth: otpauthUrl(user.email, secret),
	});
}

/* POST /api/auth/2fa/confirm (auth) { code } -> activa 2FA si el c\u00f3digo es v\u00e1lido */
export async function confirm2fa(req, res, user, body) {
	const row = await db.get("SELECT totp_secret FROM users WHERE id = ?", [user.id]);
	if (!row?.totp_secret)
		return send(res, 400, { error: "Primero gener\u00e1 el secreto (paso 1)" });
	if (!verifyTotp(row.totp_secret, body.code))
		return send(res, 400, { error: "C\u00f3digo incorrecto, prob\u00e1 de nuevo" });
	await db.run("UPDATE users SET totp_enabled = 1 WHERE id = ?", [user.id]);
	return send(res, 200, { ok: true });
}

/* POST /api/auth/2fa/disable (auth) { code } */
export async function disable2fa(req, res, user, body) {
	const row = await db.get(
		"SELECT totp_secret, totp_enabled FROM users WHERE id = ?",
		[user.id],
	);
	if (Number(row?.totp_enabled) !== 1)
		return send(res, 400, { error: "El 2FA no est\u00e1 activado" });
	if (!verifyTotp(row.totp_secret, body.code))
		return send(res, 400, { error: "C\u00f3digo incorrecto" });
	await db.run(
		"UPDATE users SET totp_enabled = 0, totp_secret = '' WHERE id = ?",
		[user.id],
	);
	return send(res, 200, { ok: true });
}

/* POST /api/auth/logout-all (auth) -> invalida tokens en todos los dispositivos */
export async function logoutAll(req, res, user) {
	await db.run("UPDATE users SET token_epoch = token_epoch + 1 WHERE id = ?", [
		user.id,
	]);
	return send(res, 200, { ok: true });
}

/* PUT /api/auth/perfil (auth) { nombre } */
export async function updatePerfil(req, res, user, body) {
	const nombre = vStr(body.nombre, { min: 2, max: 60 });
	if (!nombre) return send(res, 400, { error: "Nombre inv\u00e1lido" });
	await db.run("UPDATE users SET nombre = ? WHERE id = ?", [nombre, user.id]);
	return send(res, 200, { ok: true, nombre });
}
