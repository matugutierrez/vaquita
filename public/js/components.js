"use strict";

function h(tag, attrs = {}, ...children) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (v === false || v === null || v === undefined) continue;
		if (k.startsWith("on") && typeof v === "function") {
			el.addEventListener(k.slice(2).toLowerCase(), v);
		} else if (k === "style" && typeof v === "object") {
			Object.assign(el.style, v);
		} else if (k === "html") {
			el.innerHTML = v;
		} else if (v === true) {
			el.setAttribute(k, "");
		} else {
			el.setAttribute(k, v);
		}
	}
	for (const c of children.flat(Infinity)) {
		if (c === null || c === undefined || c === false) continue;
		el.append(c instanceof Node ? c : document.createTextNode(String(c)));
	}
	return el;
}

const ICON_PATHS = {
	home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
	group: '<circle cx="8.5" cy="8" r="3.2"/><circle cx="16" cy="9.5" r="2.6"/><path d="M2.8 19c.6-3.2 2.9-5 5.7-5s5.1 1.8 5.7 5"/><path d="M15.4 14.3c2.3.2 4.1 1.7 4.7 4.2"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	arrowLeft: '<path d="M15 5l-7 7 7 7"/>',
	settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
	receipt: '<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9 8h6M9 12h6"/>',
	scale: '<path d="M12 4v16M4 20h16"/><path d="M12 6l-6 3.5L12 6l6 3.5"/><path d="M6 9.5 3.5 15a3 3 0 0 0 5 0L6 9.5zM18 9.5 15.5 15a3 3 0 0 0 5 0L18 9.5z"/>',
	shield: '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
	trash: '<path d="M4.5 6.5h15M9 6V4.5h6V6M7 6.5l.8 13h8.4l.8-13"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
	logout: '<path d="M9 4H5.5v16H9M14.5 8l4 4-4 4M18 12H9.5"/>',
	cow: '<path d="M7 8.5C5 8.5 3.5 7 3.5 5c1.8 0 3 .7 3.7 1.8h9.6C17.5 5.7 18.7 5 20.5 5 20.5 7 19 8.5 17 8.5"/><path d="M7 8.5h10l1 5.5c.3 2-.8 6-6 6s-6.3-4-6-6z"/><circle cx="9.6" cy="12.4" r=".9" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12.4" r=".9" fill="currentColor" stroke="none"/><path d="M9.5 17h5"/>',
	qr: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z"/>',
};

function icon(name, size = 20) {
	const span = document.createElement("span");
	span.style.display = "inline-flex";
	span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ""}</svg>`;
	return span;
}

const fmtARS = (() => {
	const f = new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 2,
	});
	return (centavos) => f.format(Number(centavos || 0) / 100);
})();

function parseMonto(str) {
	let s = String(str || "").trim().replace(/\s|\$/g, "");
	if (!s) return null;
	if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
	const n = Number(s);
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.round(n * 100);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function hoyIso() {
	return new Date().toISOString().slice(0, 10);
}
function fmtFecha(iso) {
	if (!iso) return "";
	const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
	const hoy = hoyIso();
	if (iso.slice(0, 10) === hoy) return "hoy";
	return `${d} ${MESES[m - 1]}${String(y) !== hoy.slice(0, 4) ? ` ${y}` : ""}`;
}

function iniciales(nombre) {
	const parts = String(nombre || "?").trim().split(/\s+/);
	return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

let toastTimer = null;
function toast(msg, tone = "ok") {
	document.querySelector(".toast")?.remove();
	clearTimeout(toastTimer);
	const el = h("div", { class: `toast${tone === "err" ? " err" : ""}` }, msg);
	document.body.append(el);
	toastTimer = setTimeout(() => el.remove(), 2600);
}

function openSheet(title, buildContent) {
	const backdrop = h("div", {
		class: "modal-backdrop",
		onClick: (e) => {
			if (e.target === backdrop) close();
		},
	});
	const sheet = h("div", { class: "sheet" }, h("div", { class: "handle" }), title ? h("h2", {}, title) : null);
	function close() {
		backdrop.remove();
	}
	sheet.append(buildContent(close));
	backdrop.append(sheet);
	document.body.append(backdrop);
	return close;
}

const CATEGORIAS = [
	["comida", "Comida"],
	["super", "S\u00faper"],
	["transporte", "Transporte"],
	["alojamiento", "Alojamiento"],
	["salida", "Salida"],
	["servicios", "Servicios"],
	["otro", "Otro"],
];
const CAT_LABEL = Object.fromEntries(CATEGORIAS);

const COLORES_GRUPO = ["verde", "tierra", "azul", "vino", "mostaza", "gris"];
