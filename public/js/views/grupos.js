"use strict";
window.Views = window.Views || {};

/* Home: lista de vaquitas + crear / unirse */
Views.grupos = {
	async render(shell) {
		const user = API.getUser();
		shell.append(App.topbar("Mis vaquitas", `Hola, ${user?.nombre || ""}`.trim(), null));

		const content = h("div", { class: "content" });
		shell.append(content);

		const grupos = await API.get("/grupos");

		if (grupos.length === 0) {
			content.append(
				h("div", { class: "empty" },
					icon("cow", 44),
					h("div", { class: "t" }, "Todav\u00eda no ten\u00e9s ninguna vaquita"),
					h("div", { class: "small" }, "Cre\u00e1 una para el asado, el viaje o el depto, o unite con un c\u00f3digo."),
				),
			);
		} else {
			const card = h("div", { class: "card", style: { padding: "4px 16px" } });
			for (const g of grupos) {
				card.append(
					h("div", {
						class: "row",
						style: { cursor: "pointer" },
						onClick: () => { location.hash = `#/grupo/${g.id}`; },
					},
						h("div", { class: `gcolor gc-${g.color}` }),
						h("div", { class: "grow" },
							h("div", { class: "title" }, g.nombre),
							h("div", { class: "sub" },
								`${g.n_miembros} ${g.n_miembros === 1 ? "persona" : "personas"} \u00b7 ${g.n_gastos} ${g.n_gastos === 1 ? "gasto" : "gastos"}`),
						),
						h("div", { class: "amount" }, fmtARS(g.total)),
					),
				);
			}
			content.append(card);
		}

		content.append(
			h("div", { class: "grid2 mt16" },
				h("button", { class: "btn primary", onClick: () => Views.grupos.crearSheet() },
					icon("plus", 18), "Nueva vaquita"),
				h("button", { class: "btn", onClick: () => Views.grupos.unirseSheet() },
					icon("group", 18), "Unirme"),
			),
		);
	},

	crearSheet() {
		openSheet("Nueva vaquita", (close) => {
			const nombre = h("input", { type: "text", placeholder: "Asado del s\u00e1bado, Bariloche 2026\u2026", maxlength: "60" });
			let color = COLORES_GRUPO[0];
			const chips = h("div", { class: "chips mb16" },
				...COLORES_GRUPO.map((c) =>
					h("button", {
						class: `chip${c === color ? " on" : ""}`,
						onClick: (e) => {
							color = c;
							chips.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
							e.currentTarget.classList.add("on");
						},
					}, c),
				),
			);
			return h("div", {},
				h("div", { class: "field" }, h("label", {}, "Nombre"), nombre),
				h("div", { class: "field" }, h("label", {}, "Color"), chips),
				h("button", {
					class: "btn primary block",
					onClick: async () => {
						try {
							const g = await API.post("/grupos", { nombre: nombre.value, color });
							close();
							toast("Vaquita creada");
							location.hash = `#/grupo/${g.id}`;
						} catch (e) { toast(e.message, "err"); }
					},
				}, "Crear"),
			);
		});
	},

	unirseSheet() {
		openSheet("Unirme a una vaquita", (close) => {
			const codigo = h("input", {
				type: "text", placeholder: "C\u00d3DIGO", maxlength: "6",
				style: { textTransform: "uppercase", textAlign: "center", letterSpacing: ".3em", fontFamily: "var(--mono)", fontSize: "20px" },
			});
			return h("div", {},
				h("p", { class: "muted small mb16" }, "Pedile el c\u00f3digo de 6 letras a quien arm\u00f3 la vaquita."),
				h("div", { class: "field" }, codigo),
				h("button", {
					class: "btn primary block",
					onClick: async () => {
						try {
							const g = await API.post("/grupos/unirse", { codigo: codigo.value });
							close();
							toast("Te uniste a la vaquita");
							location.hash = `#/grupo/${g.id}`;
						} catch (e) { toast(e.message, "err"); }
					},
				}, "Unirme"),
			);
		});
	},
};
