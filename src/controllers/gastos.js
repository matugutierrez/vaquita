import db from "../db.js";
import { send, uuid, vStr, vMonto, isIsoDate, today } from "../utils.js";
import { esMiembro } from "./grupos.js";

const CATEGORIAS = [
	"comida",
	"super",
	"transporte",
	"alojamiento",
	"salida",
	"servicios",
	"otro",
];

/**
 * Valida las partes del gasto: [{ user_id, monto }] en centavos.
 * Deben ser miembros del grupo y sumar exactamente el monto total.
 */
async function validarPartes(grupoId, partes, montoTotal) {
	if (!Array.isArray(partes) || partes.length === 0) return null;
	const miembros = await db.all("SELECT user_id FROM miembros WHERE grupo_id = ?", [
		grupoId,
	]);
	const ids = new Set(miembros.map((m) => m.user_id));
	const limpio = [];
	const vistos = new Set();
	let suma = 0;
	for (const p of partes) {
		const monto = vMonto(p?.monto);
		if (!p?.user_id || !ids.has(p.user_id) || vistos.has(p.user_id) || !monto)
			return null;
		vistos.add(p.user_id);
		suma += monto;
		limpio.push({ user_id: p.user_id, monto });
	}
	if (suma !== montoTotal) return null;
	return limpio;
}

/* POST /api/grupos/:id/gastos (auth, miembro) */
export async function crear(req, res, user, body, grupoId) {
	if (!(await esMiembro(grupoId, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });

	const titulo = vStr(body.titulo, { min: 1, max: 80 });
	const monto = vMonto(body.monto);
	const fecha = isIsoDate(body.fecha) ? body.fecha : today();
	const categoria = CATEGORIAS.includes(body.categoria) ? body.categoria : "otro";
	if (!titulo) return send(res, 400, { error: "Pon\u00e9 un t\u00edtulo al gasto" });
	if (!monto) return send(res, 400, { error: "Monto inv\u00e1lido" });

	const pagadorId =
		typeof body.pagador_id === "string" && body.pagador_id ? body.pagador_id : user.id;
	if (!(await esMiembro(grupoId, pagadorId)))
		return send(res, 400, { error: "El pagador no es miembro del grupo" });

	const partes = await validarPartes(grupoId, body.partes, monto);
	if (!partes)
		return send(res, 400, {
			error: "Las partes no cierran: deben sumar exactamente el total",
		});

	const id = uuid();
	await db.run(
		"INSERT INTO gastos (id, grupo_id, pagador_id, titulo, monto, fecha, categoria, partes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		[id, grupoId, pagadorId, titulo, monto, fecha, categoria, JSON.stringify(partes)],
	);
	const gasto = await db.get("SELECT * FROM gastos WHERE id = ?", [id]);
	return send(res, 201, gasto);
}

/* DELETE /api/grupos/:id/gastos/:gastoId (auth, miembro) */
export async function borrar(req, res, user, _body, grupoId, gastoId) {
	if (!(await esMiembro(grupoId, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });
	const r = await db.run("DELETE FROM gastos WHERE id = ? AND grupo_id = ?", [
		gastoId,
		grupoId,
	]);
	if (!r.changes) return send(res, 404, { error: "Gasto no encontrado" });
	return send(res, 200, { ok: true });
}

/* POST /api/grupos/:id/pagos (auth, miembro) { a_id, monto, fecha? } */
export async function registrarPago(req, res, user, body, grupoId) {
	if (!(await esMiembro(grupoId, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });
	const monto = vMonto(body.monto);
	const fecha = isIsoDate(body.fecha) ? body.fecha : today();
	if (!monto) return send(res, 400, { error: "Monto inv\u00e1lido" });
	const deId =
		typeof body.de_id === "string" && body.de_id ? body.de_id : user.id;
	if (!body.a_id || !(await esMiembro(grupoId, body.a_id)) || !(await esMiembro(grupoId, deId)))
		return send(res, 400, { error: "Destinatario inv\u00e1lido" });
	if (deId === body.a_id)
		return send(res, 400, { error: "No pod\u00e9s pagarte a vos mismo" });

	const id = uuid();
	await db.run(
		"INSERT INTO pagos (id, grupo_id, de_id, a_id, monto, fecha) VALUES (?, ?, ?, ?, ?, ?)",
		[id, grupoId, deId, body.a_id, monto, fecha],
	);
	const pago = await db.get("SELECT * FROM pagos WHERE id = ?", [id]);
	return send(res, 201, pago);
}

/* DELETE /api/grupos/:id/pagos/:pagoId */
export async function borrarPago(req, res, user, _body, grupoId, pagoId) {
	if (!(await esMiembro(grupoId, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });
	const r = await db.run("DELETE FROM pagos WHERE id = ? AND grupo_id = ?", [
		pagoId,
		grupoId,
	]);
	if (!r.changes) return send(res, 404, { error: "Pago no encontrado" });
	return send(res, 200, { ok: true });
}
