/*
 * Adaptador de base de datos dual:
 *  - Si existe DATABASE_URL -> PostgreSQL (Render, Neon, Supabase) vía "pg".
 *  - Si no -> SQLite nativo de Node (node:sqlite), cero dependencias.
 * Interfaz unificada: db.all / db.get / db.run (async, placeholders "?").
 */

const DATABASE_URL = process.env.DATABASE_URL || "";

const schema = (now) => `
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT UNIQUE NOT NULL,
	password TEXT NOT NULL,
	nombre TEXT NOT NULL,
	totp_secret TEXT DEFAULT '',
	totp_enabled INTEGER DEFAULT 0,
	failed_attempts INTEGER DEFAULT 0,
	locked_until TEXT DEFAULT '',
	token_epoch INTEGER DEFAULT 0,
	created_at TEXT DEFAULT ${now}
);
CREATE TABLE IF NOT EXISTS grupos (
	id TEXT PRIMARY KEY,
	nombre TEXT NOT NULL,
	codigo TEXT UNIQUE NOT NULL,
	creador_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	color TEXT DEFAULT 'verde',
	created_at TEXT DEFAULT ${now}
);
CREATE TABLE IF NOT EXISTS miembros (
	id TEXT PRIMARY KEY,
	grupo_id TEXT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TEXT DEFAULT ${now},
	UNIQUE (grupo_id, user_id)
);
CREATE TABLE IF NOT EXISTS gastos (
	id TEXT PRIMARY KEY,
	grupo_id TEXT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
	pagador_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	titulo TEXT NOT NULL,
	monto BIGINT NOT NULL,
	fecha TEXT NOT NULL,
	categoria TEXT DEFAULT 'otro',
	partes TEXT DEFAULT '[]',
	created_at TEXT DEFAULT ${now}
);
CREATE TABLE IF NOT EXISTS pagos (
	id TEXT PRIMARY KEY,
	grupo_id TEXT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
	de_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	monto BIGINT NOT NULL,
	fecha TEXT NOT NULL,
	created_at TEXT DEFAULT ${now}
);
`;

let db;

if (DATABASE_URL) {
	const { default: pg } = await import("pg");
	const host = new URL(DATABASE_URL).hostname;
	const ssl =
		host.includes(".") && host !== "localhost"
			? { rejectUnauthorized: false }
			: undefined;
	const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl });

	const toPg = (sql) => {
		let i = 0;
		return sql.replace(/\?/g, () => `$${++i}`);
	};

	await pool.query(schema("to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"));
	await pool.query("ALTER TABLE gastos ALTER COLUMN monto TYPE BIGINT");
	await pool.query("ALTER TABLE pagos ALTER COLUMN monto TYPE BIGINT");

	db = {
		engine: "postgres",
		async all(sql, params = []) {
			const r = await pool.query(toPg(sql), params);
			return r.rows;
		},
		async get(sql, params = []) {
			const r = await pool.query(toPg(sql), params);
			return r.rows[0];
		},
		async run(sql, params = []) {
			const r = await pool.query(toPg(sql), params);
			return { changes: r.rowCount };
		},
	};
	console.log(`\u{1F418} Base de datos: PostgreSQL (${host})`);
} else {
	const { DatabaseSync } = await import("node:sqlite");
	const path = process.env.DB_PATH || "./vaquita.db";
	const sqlite = new DatabaseSync(path);
	sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
	sqlite.exec(schema("(datetime('now'))"));

	db = {
		engine: "sqlite",
		async all(sql, params = []) {
			return sqlite.prepare(sql).all(...params);
		},
		async get(sql, params = []) {
			return sqlite.prepare(sql).get(...params);
		},
		async run(sql, params = []) {
			const r = sqlite.prepare(sql).run(...params);
			return { changes: r.changes };
		},
	};
	console.log(`\u{1F5C3}\u{FE0F} Base de datos: SQLite (${path})`);
}

export default db;
