// Genera landing/index.html a partir de landing/template.html,
// incrustando las capturas de landing/img/ como base64 (archivo unico, portable).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const landing = path.join(root, "landing");

function img64(name) {
	const buf = fs.readFileSync(path.join(landing, "img", name));
	return "data:image/png;base64," + buf.toString("base64");
}

const cow = fs.readFileSync(path.join(root, "public", "icons", "icon.svg"), "utf8");
const shield = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>';

let html = fs.readFileSync(path.join(landing, "template.html"), "utf8");
html = html
	.split("__IMG_HOME__").join(img64("home.png"))
	.split("__IMG_GASTOS__").join(img64("gastos.png"))
	.split("__IMG_SALDOS__").join(img64("saldos.png"))
	.split("__IMG_AJUSTES__").join(img64("ajustes.png"))
	.split("__COW__").join(cow)
	.split("__SHIELD__").join(shield)
	.split("__FAVICON__").join(encodeURIComponent(cow));

fs.writeFileSync(path.join(landing, "index.html"), html);
const kb = (fs.statSync(path.join(landing, "index.html")).size / 1024).toFixed(1);
console.log("landing/index.html generado (" + kb + " KB)");
