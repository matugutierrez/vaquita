/*
 * Adaptador de base de datos dual:
 *  - Si existe DATABASE_URL -> PostgreSQL (Render, Neon, Supabase) vía "pg".
 *  - Si no -> SQLite nativo de Node (node:sqlite), cero dependencias.
 * Interfaz unificada: db.all / db.get / db.run (async, placeholders "?").
 *
 * El esquema se declara una sola vez y se genera para cada motor. En PostgreSQL
 * además se aplica una migración de reparación: si la base vino de un dump con el
 * esquema viejo (típicamente "id" integer en vez de TEXT), se normalizan los
 * tipos ANTES de crear las claves foráneas, que si no explotan al arrancar con
 * "foreign key constraint ... cannot be implemented".
 */

const DATABASE_URL = process.env.DATABASE_URL || "";

/* Columnas de cada tabla, en orden. */
const columns = (now) => ({
	users: {
		id: "TEXT PRIMARY KEY",
		email: "TEXT UNIQUE NOT NULL",
		password: "TEXT NOT NULL",
		nombre: "TEXT NOT NULL",
		totp_secret: "TEXT DEFAULT ''",
		totp_enabled: "INTEGER DEFAULT 0",
		failed_attempts: "INTEGER DEFAULT 0",
		locked_until: "TEXT DEFAULT ''",
		token_epoch: "INTEGER DEFAULT 0",
		created_at: `TEXT DEFAULT ${now}`,
	},
	grupos: {
		id: "TEXT PRIMARY KEY",
		nombre: "TEXT NOT NULL",
		codigo: "TEXT UNIQUE NOT NULL",
		creador_id: "TEXT NOT NULL",
		color: "TEXT DEFAULT 'verde'",
		created_at: `TEXT DEFAULT ${now}`,
	},
	miembros: {
		id: "TEXT PRIMARY KEY",
		grupo_id: "TEXT NOT NULL",
		user_id: "TEXT NOT NULL",
		created_at: `TEXT DEFAULT ${now}`,
	},
	gastos: {
		id: "TEXT PRIMARY KEY",
		grupo_id: "TEXT NOT NULL",
		pagador_id: "TEXT NOT NULL",
		titulo: "TEXT NOT NULL",
		monto: "BIGINT NOT NULL",
		fecha: "TEXT NOT NULL",
		categoria: "TEXT DEFAULT 'otro'",
		partes: "TEXT DEFAULT '[]'",
		created_at: `TEXT DEFAULT ${now}`,
	},
	pagos: {
		id: "TEXT PRIMARY KEY",
		grupo_id: "TEXT NOT NULL",
		de_id: "TEXT NOT NULL",
		a_id: "TEXT NOT NULL",
		monto: "BIGINT NOT NULL",
		fecha: "TEXT NOT NULL",
		created_at: `TEXT DEFAULT ${now}`,
	},
});

/* Claves foráneas: [tabla, columna, tabla referenciada] (siempre sobre "id"). */
const foreignKeys = [
	["grupos", "creador_id", "users"],
	["miembros", "grupo_id", "grupos"],
	["miembros", "user_id", "users"],
	["gastos", "grupo_id", "grupos"],
	["gastos", "pagador_id", "users"],
	["pagos", "grupo_id", "grupos"],
	["pagos", "de_id", "users"],
	["pagos", "a_id", "users"],
];

/* Restricciones a nivel de tabla (mismo SQL sirve para los dos motores). */
const tableConstraints = {
	miembros: ["UNIQUE (grupo_id, user_id)"],
};

/* "TEXT DEFAULT ''" -> "TEXT" */
const typeOf = (def) => def.replace(/\s+(NOT NULL|PRIMARY KEY|UNIQUE|DEFAULT).*$/, "");

/* "TEXT DEFAULT 'verde'" -> "'verde'" */
const defaultOf = (def) => def.match(/DEFAULT\s+(.+)$/)?.[1] ?? null;

/* Nombre canónico que le pone PostgreSQL a las FK de columna única. */
const fkName = (table, col) => `${table}_${col}_fkey`;

/* Genera el CREATE TABLE de una tabla. conFks=false crea las tablas "peladas",
 * para poder arreglar los tipos antes de enlazarlas (ver pgMigrate). */
const createTable = (table, defs, conFks) => {
	const fkCols = new Map(foreignKeys.map(([t, c, r]) => [c, r]));
	const lines = [];
	for (const [name, def] of Object.entries(defs)) {
		const ref = fkCols.get(name);
		lines.push(
			ref && conFks
				? `\t${name} TEXT NOT NULL REFERENCES ${ref}(id) ON DELETE CASCADE`
				: `\t${name} ${def}`,
		);
	}
	for (const extra of tableConstraints[table] ?? []) lines.push(`\t${extra}`);
	return `CREATE TABLE IF NOT EXISTS ${table} (\n${lines.join(",\n")}\n);`;
};

const schema = (now, conFks = true) =>
	Object.entries(columns(now))
		.map(([table, defs]) => createTable(table, defs, conFks))
		.join("\n");

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

	/* Corre una migración y, si falla, avisa sin tumbar el arranque: la app
	 * borra en el orden correcto, así que las FK son una red de seguridad. */
	const migrate = async (sql) => {
		try {
			await pool.query(sql);
		} catch (err) {
			const first = sql.trim().split("\n")[0];
			console.warn(`\u{26A0}\u{FE0F}  Migración omitida: ${first}\n      ${err.message}`);
		}
	};

	/**
	 * Pone al día una base PostgreSQL que vino de un dump con el esquema viejo:
	 *  1. agrega columnas que falten,
	 *  2. normaliza los tipos incompatibles ("integer" -> "TEXT", timestamps,
	 *     booleanos, monto INTEGER -> BIGINT),
	 *  3. recién entonces crea las claves foráneas.
	 * Las FK se sueltan antes del paso 2 porque PostgreSQL no deja convertir el
	 * tipo de una columna referenciada si la restricción quedara inválida.
	 */
	const pgMigrate = async (now) => {
		const defs = columns(now);

		for (const [table, cols] of Object.entries(defs)) {
			for (const [name, def] of Object.entries(cols)) {
				// PRIMARY KEY / UNIQUE no se pueden agregar a una tabla con filas.
				const limpio = def.replace(/\s+PRIMARY KEY|\s+UNIQUE/g, "");
				await migrate(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${name} ${limpio}`);
			}
		}

		for (const [table, col] of foreignKeys) {
			await migrate(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${fkName(table, col)}`);
		}

		const { rows } = await pool.query(
			`SELECT table_name, column_name, data_type
			 FROM information_schema.columns
			 WHERE table_schema = current_schema()`,
		);
		const actual = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r.data_type]));

		for (const [table, cols] of Object.entries(defs)) {
			for (const [name, def] of Object.entries(cols)) {
				const want = typeOf(def);
				const got = actual.get(`${table}.${name}`);
				if (!got || got === want.toLowerCase()) continue;
				const cast =
					got === "timestamp without time zone" || got === "date"
						? `to_char(${name}, 'YYYY-MM-DD HH24:MI:SS')`
						: `${name}::${want}`;
				const fallback = defaultOf(def);
				await migrate(`ALTER TABLE ${table} ALTER COLUMN ${name} DROP DEFAULT`);
				await migrate(`ALTER TABLE ${table} ALTER COLUMN ${name} TYPE ${want} USING ${cast}`);
				if (fallback) {
					await migrate(`ALTER TABLE ${table} ALTER COLUMN ${name} SET DEFAULT ${fallback}`);
				}
			}
		}

		for (const [table, col, ref] of foreignKeys) {
			const name = fkName(table, col);
			const { rows: existe } = await pool.query(
				"SELECT 1 FROM pg_constraint WHERE conname = $1",
				[name],
			);
			if (existe.length) continue;
			await migrate(
				`ALTER TABLE ${table} ADD CONSTRAINT ${name} ` +
					`FOREIGN KEY (${col}) REFERENCES ${ref}(id) ON DELETE CASCADE`,
			);
		}
	};

	const nowPg = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')";
	// Sin FK primero: si la base tiene tipos viejos, crear las tablas con las
	// referencias inline es justamente lo que hace explotar el arranque.
	await pool.query(schema(nowPg, false));
	await pgMigrate(nowPg);

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
	// Columnas agregadas en versiones nuevas (SQLite no tiene ADD COLUMN IF NOT EXISTS).
	const defs = columns("(datetime('now'))");
	for (const [table, cols] of Object.entries(defs)) {
		for (const [name, def] of Object.entries(cols)) {
			try {
				sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
			} catch {
				// La columna ya existe (o el ALTER no aplica): seguimos.
			}
		}
	}

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
