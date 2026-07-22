"use strict";

const App = (() => {
	const root = document.getElementById("app");

	const TABS = [
		["grupos", "home", "Vaquitas"],
		["ajustes", "settings", "Ajustes"],
	];

	function route() {
		const hash = location.hash || "#/grupos";
		const parts = hash.slice(2).split("/").filter(Boolean);
		return { name: parts[0] || "grupos", arg: parts[1] || null };
	}

	async function render() {
		const { name, arg } = route();

		if (!API.getToken() && name !== "login") {
			location.hash = "#/login";
			return;
		}
		if (API.getToken() && name === "login") {
			location.hash = "#/grupos";
			return;
		}

		root.innerHTML = "";

		if (name === "login") {
			await Views.login.render(root);
			return;
		}

		const shell = h("div", { class: "shell" });
		root.append(shell);

		const view =
			name === "grupo" && arg
				? Views.grupo
				: Views[name] || Views.grupos;

		try {
			await view.render(shell, arg);
		} catch (err) {
			shell.append(
				h("div", { class: "content" },
					h("div", { class: "empty" },
						h("div", { class: "t" }, "Algo sali\u00f3 mal"),
						h("div", { class: "small" }, err.message || "Error desconocido"),
					),
				),
			);
		}

		if (name === "grupos" || name === "ajustes") {
			shell.append(tabbar(name));
		}
	}

	function tabbar(active) {
		return h("nav", { class: "tabbar" },
			...TABS.map(([id, ic, label]) =>
				h("button", {
					class: id === active ? "active" : "",
					onClick: () => { location.hash = `#/${id}`; },
				}, icon(ic, 22), label),
			),
		);
	}

	function topbar(title, sub, back) {
		return h("header", { class: "topbar" },
			back
				? h("button", { class: "back", onClick: () => { location.hash = back; } }, icon("arrowLeft", 18))
				: null,
			h("div", { class: "titles" },
				h("h1", {}, title),
				sub ? h("div", { class: "sub" }, sub) : null,
			),
		);
	}

	window.addEventListener("hashchange", render);
	window.addEventListener("DOMContentLoaded", render);

	return { render, topbar };
})();
