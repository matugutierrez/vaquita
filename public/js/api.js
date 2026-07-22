"use strict";

/* Cliente HTTP mínimo con token en memoria + localStorage. */
const API = (() => {
	let token = localStorage.getItem("vaquita_token") || "";
	let user = null;
	try {
		user = JSON.parse(localStorage.getItem("vaquita_user") || "null");
	} catch {
		user = null;
	}

	async function call(method, path, body) {
		const headers = { "Content-Type": "application/json" };
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(`/api${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const data = await res.json().catch(() => ({}));
		if (res.status === 401 && token) {
			// Sesión vencida: limpiar y volver al login.
			API.logout();
			location.hash = "#/login";
			location.reload();
		}
		if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
		return data;
	}

	return {
		isDemo: false,
		get: (p) => call("GET", p),
		post: (p, b) => call("POST", p, b ?? {}),
		put: (p, b) => call("PUT", p, b ?? {}),
		del: (p) => call("DELETE", p),
		getToken: () => token,
		getUser: () => user,
		setSession(t, u) {
			token = t;
			user = u;
			localStorage.setItem("vaquita_token", t);
			localStorage.setItem("vaquita_user", JSON.stringify(u));
		},
		setUser(u) {
			user = u;
			localStorage.setItem("vaquita_user", JSON.stringify(u));
		},
		logout() {
			token = "";
			user = null;
			localStorage.removeItem("vaquita_token");
			localStorage.removeItem("vaquita_user");
		},
	};
})();
