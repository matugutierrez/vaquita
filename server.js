/*
 * VAQUITA — gastos compartidos sin drama.
 * Backend Node.js sin frameworks. SQLite local o PostgreSQL vía DATABASE_URL.
 */
import http from "node:http";
import { handleApi } from "./src/router.js";
import { serveStatic } from "./src/static.js";
import { send } from "./src/utils.js";

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(async (req, res) => {
	const host = req.headers.host || "localhost";
	const { pathname } = new URL(req.url, "http://" + host);
	try {
		if (pathname.startsWith("/api/")) {
			await handleApi(req, res, pathname);
		} else {
			serveStatic(req, res, pathname);
		}
	} catch (err) {
		console.error(err);
		if (!res.headersSent) send(res, 500, { error: "Error interno" });
	}
});

server.listen(PORT, () => {
	console.log(`VAQUITA lista en http://localhost:${PORT}`);
});
