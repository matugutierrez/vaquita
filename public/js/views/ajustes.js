"use strict";
window.Views = window.Views || {};

Views.ajustes = {
	async render(shell) {
		const me = await API.get("/auth/me").then((r) => r.user).catch(() => API.getUser());
		API.setUser(me);

		shell.append(App.topbar("Ajustes", me.email, null));
		const content = h("div", { class: "content" });
		shell.append(content);

		/* --- Perfil --- */
		content.append(h("div", { class: "section-label" }, "Perfil"));
		const nombre = h("input", { type: "text", value: me.nombre, maxlength: "60" });
		content.append(h("div", { class: "card" },
			h("div", { class: "field" }, h("label", {}, "Tu nombre"), nombre),
			h("button", {
				class: "btn block",
				onClick: async () => {
					try {
						const r = await API.put("/auth/perfil", { nombre: nombre.value });
						API.setUser({ ...me, nombre: r.nombre });
						toast("Nombre actualizado");
					} catch (e) { toast(e.message, "err"); }
				},
			}, "Guardar"),
		));

		/* --- Seguridad --- */
		content.append(h("div", { class: "section-label" }, "Seguridad"));
		const seg = h("div", { class: "card" });
		content.append(seg);

		seg.append(h("div", { class: "row" },
			h("div", { class: "avatar" }, icon("shield", 17)),
			h("div", { class: "grow" },
				h("div", { class: "title" }, "Dos pasos (2FA)"),
				h("div", { class: "sub" }, me.totp_enabled
					? "Activada. Tu cuenta est\u00e1 protegida con c\u00f3digo."
					: "Sum\u00e1 un c\u00f3digo de Google Authenticator al ingresar."),
			),
			h("button", {
				class: me.totp_enabled ? "btn danger" : "btn accent",
				style: { padding: "8px 14px", fontSize: "13px" },
				onClick: () => me.totp_enabled ? Views.ajustes.desactivar2fa() : Views.ajustes.activar2fa(),
			}, me.totp_enabled ? "Desactivar" : "Activar"),
		));

		seg.append(h("div", { class: "row" },
			h("div", { class: "avatar" }, icon("logout", 17)),
			h("div", { class: "grow" },
				h("div", { class: "title" }, "Cerrar otras sesiones"),
				h("div", { class: "sub" }, "Invalida tus sesiones en todos los dispositivos."),
			),
			h("button", {
				class: "btn", style: { padding: "8px 14px", fontSize: "13px" },
				onClick: async () => {
					if (!confirm("\u00bfCerrar sesi\u00f3n en todos los dispositivos?")) return;
					try {
						await API.post("/auth/logout-all");
						API.logout();
						location.hash = "#/login";
						location.reload();
					} catch (e) { toast(e.message, "err"); }
				},
			}, "Cerrar"),
		));

		/* --- Cómo cuidamos tus datos --- */
		content.append(h("div", { class: "section-label" }, "C\u00f3mo cuidamos tus datos"));
		content.append(h("div", { class: "card small muted", style: { lineHeight: "1.7" } },
			"Tu contrase\u00f1a se guarda con hash scrypt y sal \u00fanica: ni nosotros podemos leerla. ",
			"Las sesiones usan tokens firmados que expiran solos. ",
			"La cuenta se bloquea tras varios intentos fallidos y todo viaja por HTTPS.",
		));

		/* --- Sesión --- */
		content.append(h("button", {
			class: "btn danger block mt16",
			onClick: () => {
				API.logout();
				location.hash = "#/login";
				location.reload();
			},
		}, "Cerrar sesi\u00f3n"));

		content.append(h("p", { class: "small muted center mt16" }, "VAQUITA v1.0 \u00b7 hecha en Argentina"));
	},

	/* ----- Activar 2FA (2 pasos) ----- */
	async activar2fa() {
		let setup;
		try {
			setup = await API.post("/auth/2fa/setup");
		} catch (e) {
			return toast(e.message, "err");
		}
		openSheet("Dos pasos (2FA)", (close) => {
			const code = h("input", {
				type: "text", inputmode: "numeric", placeholder: "000000", maxlength: "6",
				style: { textAlign: "center", letterSpacing: ".4em", fontFamily: "var(--mono)", fontSize: "20px" },
			});
			return h("div", {},
				h("p", { class: "small muted mb8" }, "1. Abr\u00ed Google Authenticator (o Authy) y agreg\u00e1 una cuenta con esta clave:"),
				h("div", { class: "invite-code", style: { fontSize: "15px", letterSpacing: ".12em" } }, setup.secret),
				h("button", {
					class: "btn block mt8",
					onClick: async () => {
						try {
							await navigator.clipboard.writeText(setup.secret);
							toast("Clave copiada");
						} catch { toast("No se pudo copiar", "err"); }
					},
				}, icon("copy", 16), "Copiar clave"),
				h("p", { class: "small muted mt16 mb8" }, "2. Ingres\u00e1 el c\u00f3digo de 6 d\u00edgitos que te muestra la app:"),
				h("div", { class: "field" }, code),
				h("button", {
					class: "btn accent block",
					onClick: async () => {
						try {
							await API.post("/auth/2fa/confirm", { code: code.value });
							const u = API.getUser();
							API.setUser({ ...u, totp_enabled: true });
							close();
							toast("2FA activado");
							App.render();
						} catch (e) { toast(e.message, "err"); }
					},
				}, "Activar"),
			);
		});
	},

	desactivar2fa() {
		openSheet("Desactivar 2FA", (close) => {
			const code = h("input", {
				type: "text", inputmode: "numeric", placeholder: "000000", maxlength: "6",
				style: { textAlign: "center", letterSpacing: ".4em", fontFamily: "var(--mono)", fontSize: "20px" },
			});
			return h("div", {},
				h("p", { class: "small muted mb16" }, "Ingres\u00e1 un c\u00f3digo v\u00e1lido de tu app para confirmar."),
				h("div", { class: "field" }, code),
				h("button", {
					class: "btn danger block",
					onClick: async () => {
						try {
							await API.post("/auth/2fa/disable", { code: code.value });
							const u = API.getUser();
							API.setUser({ ...u, totp_enabled: false });
							close();
							toast("2FA desactivado");
							App.render();
						} catch (e) { toast(e.message, "err"); }
					},
				}, "Desactivar"),
			);
		});
	},
};
