"use strict";
window.Views = window.Views || {};

Views.login = {
	async render(root) {
		let modo = "login"; // login | registro | 2fa
		let tempToken = "";

		const wrap = h("div", { class: "login-wrap" });
		root.append(wrap);

		function draw() {
			wrap.innerHTML = "";
			const logo = h("div", { class: "login-logo" },
				h("div", { class: "mark" }, icon("cow", 46)),
				h("div", { class: "brand" }, "Vaquita"),
				h("div", { class: "tag" }, "Gastos compartidos, sin drama."),
			);

			const errBox = h("div");
			function showErr(msg) {
				errBox.innerHTML = "";
				errBox.append(h("div", { class: "error-msg" }, msg));
			}

			if (modo === "2fa") {
				const code = h("input", {
					type: "text", inputmode: "numeric", autocomplete: "one-time-code",
					placeholder: "000000", maxlength: "6",
					style: { textAlign: "center", letterSpacing: ".4em", fontSize: "22px", fontFamily: "var(--mono)" },
				});
				wrap.append(
					logo, errBox,
					h("p", { class: "muted center mb16" }, "Ingres\u00e1 el c\u00f3digo de tu app de autenticaci\u00f3n"),
					h("div", { class: "field" }, code),
					h("button", {
						class: "btn primary block",
						onClick: async () => {
							try {
								const r = await API.post("/auth/2fa", { tempToken, code: code.value });
								API.setSession(r.token, r.user);
								location.hash = "#/grupos";
							} catch (e) { showErr(e.message); }
						},
					}, "Verificar"),
					h("button", { class: "btn ghost block mt8", onClick: () => { modo = "login"; draw(); } }, "Volver"),
				);
				code.focus();
				return;
			}

			const esRegistro = modo === "registro";
			const nombre = h("input", { type: "text", placeholder: "Tu nombre", autocomplete: "name" });
			const email = h("input", { type: "email", placeholder: "tu@email.com", autocomplete: "email" });
			const pass = h("input", {
				type: "password",
				placeholder: esRegistro ? "Contrase\u00f1a (m\u00edn. 10 caracteres)" : "Contrase\u00f1a",
				autocomplete: esRegistro ? "new-password" : "current-password",
			});

			async function enviar() {
				try {
					if (esRegistro) {
						const r = await API.post("/auth/register", {
							nombre: nombre.value, email: email.value, password: pass.value,
						});
						API.setSession(r.token, r.user);
						location.hash = "#/grupos";
					} else {
						const r = await API.post("/auth/login", { email: email.value, password: pass.value });
						if (r.requiere2fa) {
							tempToken = r.tempToken;
							modo = "2fa";
							draw();
						} else {
							API.setSession(r.token, r.user);
							location.hash = "#/grupos";
						}
					}
				} catch (e) { showErr(e.message); }
			}

			for (const inp of [email, pass]) {
				inp.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(); });
			}

			wrap.append(
				logo, errBox,
				esRegistro ? h("div", { class: "field" }, nombre) : null,
				h("div", { class: "field" }, email),
				h("div", { class: "field" }, pass),
				h("button", { class: "btn primary block", onClick: enviar },
					esRegistro ? "Crear cuenta" : "Entrar"),
				h("div", { class: "divider" }, esRegistro ? "ya ten\u00e9s cuenta" : "primera vez"),
				h("button", {
					class: "btn block",
					onClick: () => { modo = esRegistro ? "login" : "registro"; draw(); },
				}, esRegistro ? "Entrar con mi cuenta" : "Crear cuenta nueva"),
				API.isDemo
					? h("p", { class: "small muted center mt16" }, "Modo demo: us\u00e1 cualquier email y contrase\u00f1a, o simplemente toc\u00e1 Entrar.")
					: h("p", { class: "small muted center mt16" },
						"Tus datos se guardan cifrados y protegidos. Nunca compartimos tu informaci\u00f3n."),
			);
		}

		draw();
	},
};
