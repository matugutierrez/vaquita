"use strict";
window.Views = window.Views || {};

/* Detalle de una vaquita: Gastos | Saldos | Gente */
Views.grupo = {
	tab: "gastos",

	async render(shell, id) {
		const me = API.getUser();
		const [det, sal] = await Promise.all([
			API.get(`/grupos/${id}`),
			API.get(`/grupos/${id}/saldos`),
		]);
		const { grupo, miembros, gastos, pagos } = det;
		const { saldos, transferencias } = sal;
		const nombreDe = Object.fromEntries(miembros.map((m) => [m.id, m.nombre]));

		shell.append(App.topbar(grupo.nombre, `${miembros.length} personas \u00b7 c\u00f3digo ${grupo.codigo}`, "#/grupos"));
		const content = h("div", { class: "content" });
		shell.append(content);

		/* --- Mi saldo, grande y claro --- */
		const mio = saldos.find((s) => s.user_id === me.id);
		const neto = mio ? mio.neto : 0;
		content.append(
			h("div", { class: "card center", style: { padding: "22px 16px" } },
				h("div", { class: "small muted", style: { letterSpacing: ".12em", textTransform: "uppercase" } },
					neto === 0 ? "Est\u00e1s al d\u00eda" : neto > 0 ? "Te deben" : "Deb\u00e9s"),
				h("div", { class: `hero-num ${neto > 0 ? "amount pos" : neto < 0 ? "amount neg" : ""}` },
					fmtARS(Math.abs(neto))),
			),
		);

		/* --- Tabs --- */
		const seg = h("div", { class: "seg" });
		const body = h("div");
		const TABS = [["gastos", "Gastos"], ["saldos", "Saldos"], ["gente", "Gente"]];
		for (const [tid, label] of TABS) {
			seg.append(h("button", {
				class: Views.grupo.tab === tid ? "on" : "",
				onClick: (e) => {
					Views.grupo.tab = tid;
					seg.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
					e.currentTarget.classList.add("on");
					drawTab();
				},
			}, label));
		}
		content.append(seg, body);

		function drawTab() {
			body.innerHTML = "";
			if (Views.grupo.tab === "gastos") drawGastos();
			else if (Views.grupo.tab === "saldos") drawSaldos();
			else drawGente();
		}

		/* ----- Gastos ----- */
		function drawGastos() {
			if (gastos.length === 0 && pagos.length === 0) {
				body.append(h("div", { class: "empty" },
					icon("receipt", 44),
					h("div", { class: "t" }, "Sin gastos todav\u00eda"),
					h("div", { class: "small" }, "Toc\u00e1 el + para cargar el primero."),
				));
				return;
			}
			const card = h("div", { class: "card", style: { padding: "4px 16px" } });
			for (const g of gastos) {
				card.append(h("div", { class: "row" },
					h("div", { class: "avatar ink" }, iniciales(nombreDe[g.pagador_id])),
					h("div", { class: "grow" },
						h("div", { class: "title" }, g.titulo),
						h("div", { class: "sub" },
							`${nombreDe[g.pagador_id] || "?"} \u00b7 ${CAT_LABEL[g.categoria] || g.categoria} \u00b7 ${fmtFecha(g.fecha)}`),
					),
					h("div", { class: "amount" }, fmtARS(g.monto)),
					h("button", {
						class: "btn ghost", title: "Borrar",
						onClick: async () => {
							if (!confirm(`\u00bfBorrar "${g.titulo}"?`)) return;
							try {
								await API.del(`/grupos/${id}/gastos/${g.id}`);
								toast("Gasto borrado");
								App.render();
							} catch (e) { toast(e.message, "err"); }
						},
					}, icon("trash", 17)),
				));
			}
			body.append(card);

			if (pagos.length > 0) {
				body.append(h("div", { class: "section-label" }, "Pagos registrados"));
				const pc = h("div", { class: "card", style: { padding: "4px 16px" } });
				for (const p of pagos) {
					pc.append(h("div", { class: "row" },
						h("div", { class: "avatar" }, icon("check", 16)),
						h("div", { class: "grow" },
							h("div", { class: "title" }, `${nombreDe[p.de_id] || "?"} \u2192 ${nombreDe[p.a_id] || "?"}`),
							h("div", { class: "sub" }, fmtFecha(p.fecha)),
						),
						h("div", { class: "amount pos" }, fmtARS(p.monto)),
						h("button", {
							class: "btn ghost",
							onClick: async () => {
								if (!confirm("\u00bfBorrar este pago?")) return;
								try {
									await API.del(`/grupos/${id}/pagos/${p.id}`);
									App.render();
								} catch (e) { toast(e.message, "err"); }
							},
						}, icon("trash", 17)),
					));
				}
				body.append(pc);
			}
		}

		/* ----- Saldos + liquidación ----- */
		function drawSaldos() {
			const card = h("div", { class: "card", style: { padding: "4px 16px" } });
			for (const s of saldos) {
				card.append(h("div", { class: "row" },
					h("div", { class: "avatar ink" }, iniciales(s.nombre)),
					h("div", { class: "grow" },
						h("div", { class: "title" }, s.nombre, s.user_id === me.id ? h("span", { class: "muted" }, " (vos)") : null),
						h("div", { class: "sub" }, `Puso ${fmtARS(s.pagado)}`),
					),
					h("div", { class: `amount ${s.neto > 0 ? "pos" : s.neto < 0 ? "neg" : ""}` },
						(s.neto > 0 ? "+" : "") + fmtARS(s.neto).replace("-", "\u2212")),
				));
			}
			body.append(card);

			body.append(h("div", { class: "section-label" }, "C\u00f3mo saldar todo"));
			if (transferencias.length === 0) {
				body.append(h("div", { class: "card center muted small" }, "Est\u00e1n todos al d\u00eda. Nadie le debe nada a nadie."));
				return;
			}
			const tc = h("div", { class: "card", style: { padding: "4px 16px" } });
			for (const t of transferencias) {
				tc.append(h("div", { class: "row" },
					h("div", { class: "grow" },
						h("div", { class: "title" }, `${t.de_nombre} le paga a ${t.a_nombre}`),
						h("div", { class: "sub" }, "Transferencia sugerida"),
					),
					h("div", { class: "amount" }, fmtARS(t.monto)),
					t.de_id === me.id
						? h("button", {
							class: "btn accent", style: { padding: "8px 12px", fontSize: "13px" },
							onClick: async () => {
								try {
									await API.post(`/grupos/${id}/pagos`, { a_id: t.a_id, monto: t.monto });
									toast("Pago registrado");
									App.render();
								} catch (e) { toast(e.message, "err"); }
							},
						}, "Ya pagu\u00e9")
						: null,
				));
			}
			body.append(tc);
			body.append(h("p", { class: "small muted center mt8" },
				`${transferencias.length} ${transferencias.length === 1 ? "transferencia alcanza" : "transferencias alcanzan"} para saldar todo.`));
		}

		/* ----- Gente ----- */
		function drawGente() {
			body.append(
				h("div", { class: "card" },
					h("div", { class: "small muted mb8", style: { textTransform: "uppercase", letterSpacing: ".12em" } }, "C\u00f3digo de invitaci\u00f3n"),
					h("div", { class: "invite-code" }, grupo.codigo),
					h("button", {
						class: "btn block mt16",
						onClick: async () => {
							try {
								await navigator.clipboard.writeText(`Sumate a "${grupo.nombre}" en VAQUITA con el c\u00f3digo ${grupo.codigo}`);
								toast("Invitaci\u00f3n copiada");
							} catch { toast("No se pudo copiar", "err"); }
						},
					}, icon("copy", 17), "Copiar invitaci\u00f3n"),
				),
			);
			const card = h("div", { class: "card", style: { padding: "4px 16px" } });
			for (const m of miembros) {
				card.append(h("div", { class: "row" },
					h("div", { class: "avatar" }, iniciales(m.nombre)),
					h("div", { class: "grow" },
						h("div", { class: "title" }, m.nombre, m.id === grupo.creador_id ? h("span", { class: "muted small" }, " \u00b7 armador") : null),
						h("div", { class: "sub" }, `Se uni\u00f3 ${fmtFecha(m.se_unio)}`),
					),
				));
			}
			body.append(card);

			body.append(h("button", {
				class: "btn danger block mt16",
				onClick: async () => {
					const esCreador = grupo.creador_id === me.id;
					if (!confirm(esCreador
						? "Sos quien arm\u00f3 la vaquita: se borra para todos, con gastos y pagos. \u00bfSeguro?"
						: "\u00bfSalir de esta vaquita?")) return;
					try {
						await API.del(`/grupos/${id}`);
						location.hash = "#/grupos";
					} catch (e) { toast(e.message, "err"); }
				},
			}, grupo.creador_id === me.id ? "Borrar vaquita" : "Salir de la vaquita"));
		}

		drawTab();

		/* --- FAB: nuevo gasto --- */
		content.append(h("button", {
			class: "fab", "aria-label": "Nuevo gasto",
			onClick: () => Views.grupo.gastoSheet(id, miembros, me),
		}, icon("plus", 24)));
	},

	/* ----- Sheet: nuevo gasto ----- */
	gastoSheet(grupoId, miembros, me) {
		openSheet("Nuevo gasto", (close) => {
			const titulo = h("input", { type: "text", placeholder: "Carne, nafta, s\u00faper\u2026", maxlength: "80" });
			const monto = h("input", { type: "text", inputmode: "decimal", placeholder: "0,00" });
			const fecha = h("input", { type: "date", value: hoyIso() });
			const pagador = h("select", {},
				...miembros.map((m) => h("option", { value: m.id, selected: m.id === me.id }, m.id === me.id ? `${m.nombre} (vos)` : m.nombre)),
			);

			let categoria = "comida";
			const catChips = h("div", { class: "chips" },
				...CATEGORIAS.map(([cid, label]) =>
					h("button", {
						class: `chip${cid === categoria ? " on" : ""}`,
						onClick: (e) => {
							categoria = cid;
							catChips.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
							e.currentTarget.classList.add("on");
						},
					}, label),
				),
			);

			/* Entre quiénes se divide (por defecto: todos) */
			const incluidos = new Set(miembros.map((m) => m.id));
			const quienes = h("div", { class: "chips" },
				...miembros.map((m) =>
					h("button", {
						class: "chip on",
						onClick: (e) => {
							if (incluidos.has(m.id) && incluidos.size > 1) {
								incluidos.delete(m.id);
								e.currentTarget.classList.remove("on");
							} else if (!incluidos.has(m.id)) {
								incluidos.add(m.id);
								e.currentTarget.classList.add("on");
							}
						},
					}, m.nombre),
				),
			);

			return h("div", {},
				h("div", { class: "field" }, h("label", {}, "Qu\u00e9 fue"), titulo),
				h("div", { class: "grid2" },
					h("div", { class: "field" }, h("label", {}, "Cu\u00e1nto (ARS)"), monto),
					h("div", { class: "field" }, h("label", {}, "Cu\u00e1ndo"), fecha),
				),
				h("div", { class: "field" }, h("label", {}, "Pag\u00f3"), pagador),
				h("div", { class: "field" }, h("label", {}, "Categor\u00eda"), catChips),
				h("div", { class: "field" }, h("label", {}, "Se divide entre"), quienes),
				h("button", {
					class: "btn primary block",
					onClick: async () => {
						const centavos = parseMonto(monto.value);
						if (!centavos) return toast("Monto inv\u00e1lido", "err");
						/* División en partes iguales exacta: el resto se reparte de a 1 centavo. */
						const ids = [...incluidos];
						const base = Math.floor(centavos / ids.length);
						const resto = centavos - base * ids.length;
						const partes = ids.map((uid, i) => ({ user_id: uid, monto: base + (i < resto ? 1 : 0) }));
						try {
							await API.post(`/grupos/${grupoId}/gastos`, {
								titulo: titulo.value,
								monto: centavos,
								fecha: fecha.value,
								categoria,
								pagador_id: pagador.value,
								partes,
							});
							close();
							toast("Gasto cargado");
							App.render();
						} catch (e) { toast(e.message, "err"); }
					},
				}, "Cargar gasto"),
			);
		});
	},
};
