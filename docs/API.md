# API de VAQUITA

Base: `/api`. Autenticación: header `Authorization: Bearer <token>`. Todos los montos en **centavos enteros** (ej.: $1.234,56 → `123456`).

## Salud

- `GET /health` → `{ ok: true }`

## Auth

- `POST /auth/register` `{ nombre, email, password }` → `{ token, user }` — password mín. 10 caracteres.
- `POST /auth/login` `{ email, password }` → `{ token, user }` o `{ requiere2fa: true, tempToken }`
- `POST /auth/2fa` `{ tempToken, code }` → `{ token, user }`
- `GET /auth/me` → `{ user }`
- `PUT /auth/perfil` `{ nombre }`
- `POST /auth/2fa/setup` → `{ secret, otpauth }` (paso 1)
- `POST /auth/2fa/confirm` `{ code }` (paso 2, activa)
- `POST /auth/2fa/disable` `{ code }`
- `POST /auth/logout-all` — invalida todos los tokens del usuario

Errores: `401` credenciales/sesión inválida · `423` cuenta bloqueada · `429` rate limit.

## Grupos (vaquitas)

- `GET /grupos` → lista con `n_miembros`, `n_gastos`, `total`
- `POST /grupos` `{ nombre, color? }` — colores: verde, tierra, azul, vino, mostaza, gris
- `POST /grupos/unirse` `{ codigo }` — código de 6 letras
- `GET /grupos/:id` → `{ grupo, miembros, gastos, pagos }` (solo miembros)
- `DELETE /grupos/:id` — creador: borra todo; miembro: sale del grupo

## Gastos y pagos

- `POST /grupos/:id/gastos` `{ titulo, monto, fecha?, categoria?, pagador_id?, partes }`
	- `partes`: `[{ user_id, monto }]` — **deben sumar exactamente `monto`**.
	- categorías: comida, super, transporte, alojamiento, salida, servicios, otro
- `DELETE /grupos/:id/gastos/:gastoId`
- `POST /grupos/:id/pagos` `{ a_id, monto, fecha?, de_id? }` — registra una transferencia real
- `DELETE /grupos/:id/pagos/:pagoId`

## Saldos

- `GET /grupos/:id/saldos` → `{ saldos: [{ user_id, nombre, pagado, neto }], transferencias: [{ de_id, de_nombre, a_id, a_nombre, monto }] }`
	- `neto > 0`: le deben · `neto < 0`: debe.
	- `transferencias`: plan de liquidación con mínimo de operaciones (greedy sobre mayores deudores/acreedores).
