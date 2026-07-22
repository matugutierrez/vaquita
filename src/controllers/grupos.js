import db from "../db.js";
import { send, uuid, codigoInvitacion, vStr } from "../utils.js";

const COLORES = ["verde", "tierra", "azul", "vino", "mostaza", "gris"];

/** ¿Es miembro del grupo? Toda la API de grupos pasa por acá. */
export async function esMiembro(grupoId, userId) {
	const m = await db.get(
		"SELECT id FROM miembros WHERE grupo_id = ? AND user_id = ?",
		[grupoId, userId],
	);
	return Boolean(m);
}

/* GET /api/grupos (auth) -> mis grupos con totales */
export async function listar(req, res, user) {
	const grupos = await db.all(
		`SELECT g.id, g.nombre, g.codigo, g.color, g.creador_id, g.created_at,
			(SELECT COUNT(*) FROM miembros m2 WHERE m2.grupo_id = g.id) AS n_miembros,
			(SELECT COUNT(*) FROM gastos x WHERE x.grupo_id = g.id) AS n_gastos,
			(SELECT COALESCE(SUM(x.monto), 0) FROM gastos x WHERE x.grupo_id = g.id) AS total
		FROM grupos g
		JOIN miembros m ON m.grupo_id = g.id
		WHERE m.user_id = ?
		ORDER BY g.created_at DESC`,
		[user.id],
	);
	for (const g of grupos) {
		g.n_miembros = Number(g.n_miembros);
		g.n_gastos = Number(g.n_gastos);
		g.total = Number(g.total);
	}
	return send(res, 200, grupos);
}

/* POST /api/grupos (auth) { nombre, color? } */
export async function crear(req, res, user, body) {
	const nombre = vStr(body.nombre, { min: 2, max: 60 });
	if (!nombre) return send(res, 400, { error: "Nombre inv\u00e1lido (2-60 caracteres)" });
	const color = COLORES.includes(body.color) ? body.color : COLORES[0];

	// Código único con reintentos (colisión casi imposible, pero por las dudas).
	let codigo = codigoInvitacion();
	for (let i = 0; i < 5; i++) {
		const clash = await db.get("SELECT id FROM grupos WHERE codigo = ?", [codigo]);
		if (!clash) break;
		codigo = codigoInvitacion();
	}

	const id = uuid();
	await db.run(
		"INSERT INTO grupos (id, nombre, codigo, creador_id, color) VALUES (?, ?, ?, ?, ?)",
		[id, nombre, codigo, user.id, color],
	);
	await db.run(
		"INSERT INTO miembros (id, grupo_id, user_id) VALUES (?, ?, ?)",
		[uuid(), id, user.id],
	);
	const grupo = await db.get("SELECT * FROM grupos WHERE id = ?", [id]);
	return send(res, 201, grupo);
}

/* POST /api/grupos/unirse (auth) { codigo } */
export async function unirse(req, res, user, body) {
	const codigo = vStr(body.codigo, { min: 6, max: 6 })?.toUpperCase();
	if (!codigo) return send(res, 400, { error: "C\u00f3digo inv\u00e1lido" });
	const grupo = await db.get("SELECT * FROM grupos WHERE codigo = ?", [codigo]);
	if (!grupo)
		return send(res, 404, { error: "No existe ninguna vaquita con ese c\u00f3digo" });
	if (await esMiembro(grupo.id, user.id))
		return send(res, 409, { error: "Ya sos parte de esta vaquita" });
	await db.run(
		"INSERT INTO miembros (id, grupo_id, user_id) VALUES (?, ?, ?)",
		[uuid(), grupo.id, user.id],
	);
	return send(res, 200, grupo);
}

/* GET /api/grupos/:id (auth, miembro) -> detalle completo */
export async function detalle(req, res, user, _body, id) {
	if (!(await esMiembro(id, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });
	const grupo = await db.get("SELECT * FROM grupos WHERE id = ?", [id]);
	if (!grupo) return send(res, 404, { error: "Vaquita no encontrada" });

	const miembros = await db.all(
		`SELECT u.id, u.nombre, m.created_at AS se_unio
		FROM miembros m JOIN users u ON u.id = m.user_id
		WHERE m.grupo_id = ? ORDER BY m.created_at ASC`,
		[id],
	);
	const gastos = await db.all(
		"SELECT * FROM gastos WHERE grupo_id = ? ORDER BY fecha DESC, created_at DESC",
		[id],
	);
	const pagos = await db.all(
		"SELECT * FROM pagos WHERE grupo_id = ? ORDER BY fecha DESC, created_at DESC",
		[id],
	);
	return send(res, 200, { grupo, miembros, gastos, pagos });
}

/* DELETE /api/grupos/:id (auth) -> solo el creador borra; otros salen del grupo */
export async function salirOBorrar(req, res, user, _body, id) {
	const grupo = await db.get("SELECT * FROM grupos WHERE id = ?", [id]);
	if (!grupo) return send(res, 404, { error: "Vaquita no encontrada" });
	if (!(await esMiembro(id, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });

	if (grupo.creador_id === user.id) {
		await db.run("DELETE FROM pagos WHERE grupo_id = ?", [id]);
		await db.run("DELETE FROM gastos WHERE grupo_id = ?", [id]);
		await db.run("DELETE FROM miembros WHERE grupo_id = ?", [id]);
		await db.run("DELETE FROM grupos WHERE id = ?", [id]);
		return send(res, 200, { ok: true, borrada: true });
	}
	await db.run("DELETE FROM miembros WHERE grupo_id = ? AND user_id = ?", [
		id,
		user.id,
	]);
	return send(res, 200, { ok: true, salio: true });
}
