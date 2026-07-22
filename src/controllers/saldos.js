import db from "../db.js";
import { send } from "../utils.js";
import { esMiembro } from "./grupos.js";

/**
 * Calcula los saldos netos de un grupo (en centavos):
 *   neto = lo que pagó - lo que le corresponde + pagos hechos - pagos recibidos
 * neto > 0: le deben plata. neto < 0: debe plata.
 */
export async function calcularSaldos(grupoId) {
	const miembros = await db.all(
		`SELECT u.id, u.nombre FROM miembros m JOIN users u ON u.id = m.user_id
		WHERE m.grupo_id = ? ORDER BY m.created_at ASC`,
		[grupoId],
	);
	const gastos = await db.all("SELECT * FROM gastos WHERE grupo_id = ?", [grupoId]);
	const pagos = await db.all("SELECT * FROM pagos WHERE grupo_id = ?", [grupoId]);

	const neto = new Map(miembros.map((m) => [m.id, 0]));
	const pagado = new Map(miembros.map((m) => [m.id, 0]));

	for (const g of gastos) {
		const monto = Number(g.monto);
		if (neto.has(g.pagador_id)) {
			neto.set(g.pagador_id, neto.get(g.pagador_id) + monto);
			pagado.set(g.pagador_id, pagado.get(g.pagador_id) + monto);
		}
		const partes =
			typeof g.partes === "string" ? JSON.parse(g.partes || "[]") : g.partes || [];
		for (const p of partes) {
			if (neto.has(p.user_id))
				neto.set(p.user_id, neto.get(p.user_id) - Number(p.monto));
		}
	}
	for (const p of pagos) {
		const monto = Number(p.monto);
		if (neto.has(p.de_id)) neto.set(p.de_id, neto.get(p.de_id) + monto);
		if (neto.has(p.a_id)) neto.set(p.a_id, neto.get(p.a_id) - monto);
	}

	return miembros.map((m) => ({
		user_id: m.id,
		nombre: m.nombre,
		pagado: pagado.get(m.id),
		neto: neto.get(m.id),
	}));
}

/**
 * Liquidación con mínimo de transferencias (greedy):
 * empareja al mayor deudor con el mayor acreedor hasta saldar todo.
 */
export function liquidar(saldos) {
	const deudores = saldos
		.filter((s) => s.neto < 0)
		.map((s) => ({ ...s, resto: -s.neto }))
		.sort((a, b) => b.resto - a.resto);
	const acreedores = saldos
		.filter((s) => s.neto > 0)
		.map((s) => ({ ...s, resto: s.neto }))
		.sort((a, b) => b.resto - a.resto);

	const transferencias = [];
	let i = 0;
	let j = 0;
	while (i < deudores.length && j < acreedores.length) {
		const d = deudores[i];
		const a = acreedores[j];
		const monto = Math.min(d.resto, a.resto);
		if (monto > 0) {
			transferencias.push({
				de_id: d.user_id,
				de_nombre: d.nombre,
				a_id: a.user_id,
				a_nombre: a.nombre,
				monto,
			});
		}
		d.resto -= monto;
		a.resto -= monto;
		if (d.resto === 0) i++;
		if (a.resto === 0) j++;
	}
	return transferencias;
}

/* GET /api/grupos/:id/saldos (auth, miembro) */
export async function obtener(req, res, user, _body, grupoId) {
	if (!(await esMiembro(grupoId, user.id)))
		return send(res, 403, { error: "No sos miembro de esta vaquita" });
	const saldos = await calcularSaldos(grupoId);
	return send(res, 200, { saldos, transferencias: liquidar(saldos) });
}
