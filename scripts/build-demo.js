/*
 * Genera demo.html: un solo archivo autocontenido con la app completa
 * y una API simulada con datos de ejemplo. Para abrir con doble clic.
 */
import fs from "node:fs";

const css = fs.readFileSync("public/css/main.css", "utf8");

const jsFiles = [
	"demo/mock-api.js",
	"public/js/components.js",
	"public/js/views/login.js",
	"public/js/views/grupos.js",
	"public/js/views/grupo.js",
	"public/js/views/ajustes.js",
	"public/js/app.js",
];

const js = jsFiles
	.map((f) => `/* ===== ${f} ===== */\n` + fs.readFileSync(f, "utf8"))
	.join("\n\n");

const icon = fs.readFileSync("public/icons/icon.svg", "utf8");
const iconDataUri = "data:image/svg+xml," + encodeURIComponent(icon);

const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#faf8f3">
<title>VAQUITA \u00b7 demo</title>
<link rel="icon" href="${iconDataUri}">
<style>
${css}
.demo-ribbon {
	position: fixed; top: 8px; right: 8px;
	z-index: 100; border-radius: 8px; background: #1c1a17; color: #faf8f3;
	font: 600 11px/1 -apple-system, sans-serif; letter-spacing: .12em;
	padding: 6px 14px; text-transform: uppercase;
}
</style>
</head>
<body>
<div class="demo-ribbon">demo \u00b7 datos de ejemplo</div>
<div id="app"></div>
<script>
${js}
</script>
</body>
</html>
`;

fs.writeFileSync("demo.html", html);
console.log(`\u2705 demo.html generado (${(html.length / 1024).toFixed(1)} KB)`);
