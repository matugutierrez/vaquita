import fs from "node:fs";
import path from "node:path";
import { securityHeaders } from "./security.js";

const PUBLIC_DIR = path.resolve("./public");

const MIME = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".mp4": "video/mp4",
};

export function serveStatic(req, res, pathname) {
	let rel = decodeURIComponent(pathname);
	if (rel === "/") rel = "/index.html";

	const filePath = path.resolve(path.join(PUBLIC_DIR, rel));
	if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
		res.writeHead(403);
		return res.end("Forbidden");
	}

	let finalPath = filePath;
	if (!fs.existsSync(finalPath) || fs.statSync(finalPath).isDirectory()) {
		finalPath = path.join(PUBLIC_DIR, "index.html");
	}

	const ext = path.extname(finalPath).toLowerCase();
	const headers = {
		"Content-Type": MIME[ext] || "application/octet-stream",
		"Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
		...securityHeaders(req),
	};
	res.writeHead(200, headers);
	fs.createReadStream(finalPath).pipe(res);
}
