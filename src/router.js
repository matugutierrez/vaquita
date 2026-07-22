import { send, readBody } from "./utils.js";
import { getUser } from "./auth.js";
import { rateLimited } from "./security.js";
import * as auth from "./controllers/auth.js";
import * as grupos from "./controllers/grupos.js";
import * as gastos from "./controllers/gastos.js";
import * as saldos from "./controllers/saldos.js";

const routes = [
	["GET", /^\/api\/health$/, async (req, res) => send(res, 200, { ok: true }), false],

	["POST", /^\/api\/auth\/register$/, auth.register, false],
	["POST", /^\/api\/auth\/login$/, auth.login, false],
	["POST", /^\/api\/auth\/2fa$/, auth.login2fa, false],
	["GET", /^\/api\/auth\/me$/, auth.me, true],
	["POST", /^\/api\/auth\/2fa\/setup$/, auth.setup2fa, true],
	["POST", /^\/api\/auth\/2fa\/confirm$/, auth.confirm2fa, true],
	["POST", /^\/api\/auth\/2fa\/disable$/, auth.disable2fa, true],
	["POST", /^\/api\/auth\/logout-all$/, auth.logoutAll, true],
	["PUT", /^\/api\/auth\/perfil$/, auth.updatePerfil, true],

	["GET", /^\/api\/grupos$/, grupos.listar, true],
	["POST", /^\/api\/grupos$/, grupos.crear, true],
	["POST", /^\/api\/grupos\/unirse$/, grupos.unirse, true],
	["GET", /^\/api\/grupos\/([\w-]+)$/, grupos.detalle, true],
	["DELETE", /^\/api\/grupos\/([\w-]+)$/, grupos.salirOBorrar, true],

	["POST", /^\/api\/grupos\/([\w-]+)\/gastos$/, gastos.crear, true],
	["DELETE", /^\/api\/grupos\/([\w-]+)\/gastos\/([\w-]+)$/, gastos.borrar, true],
	["POST", /^\/api\/grupos\/([\w-]+)\/pagos$/, gastos.registrarPago, true],
	["DELETE", /^\/api\/grupos\/([\w-]+)\/pagos\/([\w-]+)$/, gastos.borrarPago, true],
	["GET", /^\/api\/grupos\/([\w-]+)\/saldos$/, saldos.obtener, true],
];

export async function handleApi(req, res, pathname) {
	const scope = pathname.startsWith("/api/auth/") ? "auth" : "api";
	if (rateLimited(req, scope)) {
		return send(res, 429, {
			error: "Demasiadas solicitudes. Esper\u00e1 un minuto y prob\u00e1 de nuevo.",
		});
	}

	for (const [method, pattern, handler, needsAuth] of routes) {
		if (req.method !== method) continue;
		const match = pathname.match(pattern);
		if (!match) continue;

		const body =
			method === "POST" || method === "PUT" ? await readBody(req) : {};

		if (needsAuth) {
			const user = await getUser(req);
			if (!user) return send(res, 401, { error: "Sesi\u00f3n inv\u00e1lida o expirada" });
			return handler(req, res, user, body, ...match.slice(1));
		}
		return handler(req, res, body, ...match.slice(1));
	}
	return send(res, 404, { error: "Ruta no encontrada" });
}
