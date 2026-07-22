# Seguridad de VAQUITA

Qué protege la app y cómo, punto por punto. Todo implementado con `node:crypto`, sin librerías de terceros.

## Contraseñas

- **Nunca se guardan en texto plano.** Se guarda `sal:hash` usando **scrypt** con N=16384, r=8, p=1 y sal aleatoria de 16 bytes por usuario.
- scrypt es deliberadamente costoso en memoria: hace inviables los ataques masivos con GPU.
- Mínimo 10 caracteres; se rechazan contraseñas triviales (todo un mismo caracter, solo números).
- La verificación usa `timingSafeEqual` (tiempo constante, no filtra información por timing).

## Sesiones

- Tokens **firmados con HMAC-SHA256** usando la variable `SECRET` (en Render se genera sola con `generateValue: true`).
- Expiran a los **7 días**. La firma se verifica en tiempo constante.
- Cada usuario tiene una **época de tokens** (`token_epoch`): "Cerrar sesión en todos lados" la incrementa e invalida instantáneamente todos los tokens emitidos.

## Verificación en dos pasos (2FA)

- **TOTP estándar RFC 6238** (HMAC-SHA1, 6 dígitos, período 30 s, ventana ±1): compatible con Google Authenticator, Authy, 1Password, etc.
- Flujo de login con 2FA: la contraseña correcta devuelve un **token intermedio de 5 minutos** que solo sirve para completar el segundo paso; la API real lo rechaza.
- Activar/desactivar 2FA exige un código válido en el momento.

## Fuerza bruta

- **Bloqueo de cuenta**: 5 intentos fallidos → 15 minutos bloqueada.
- **Rate limiting por IP**: 10 requests/min en `/api/auth/*`, 240/min en el resto.
- **Mensajes genéricos**: "Email o contraseña incorrectos" — nunca se revela si un email está registrado.

## Transporte y headers

- `Strict-Transport-Security` (HSTS) cuando corre detrás de HTTPS.
- `Content-Security-Policy` estricta: solo scripts propios, sin inline scripts.
- `X-Frame-Options: DENY` (anti clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` denegando cámara/mic/geolocalización.

## Datos

- **Montos en centavos enteros** (INTEGER): jamás aritmética de punto flotante con plata.
- **SQL 100% parametrizado**: cero concatenación de strings → cero inyección SQL.
- **Autorización por membresía**: cada endpoint de grupo verifica que el usuario sea miembro antes de mostrar o tocar nada.
- Validación estricta de todo input (longitudes, formatos, categorías permitidas, partes que deben sumar exacto el total).
- Body límite 100 KB. Anti path-traversal en archivos estáticos.

## Qué conviene agregar a futuro

- Recuperación de contraseña por email (requiere un servicio de emails tipo Resend).
- Códigos de respaldo para 2FA.
- Auditoría de sesiones activas por dispositivo.
