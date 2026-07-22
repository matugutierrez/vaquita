# Publicar VAQUITA en Google Play

VAQUITA es una **PWA**, y Google Play acepta PWAs empaquetadas como **TWA (Trusted Web Activity)** — es el método oficial de Google (Chrome) para publicar apps web en la tienda. La app resultante es un APK/AAB real, instalable, con ícono y pantalla completa, sin barra de navegador.

## Requisitos previos

1. **La app deployada con HTTPS** (Render te lo da gratis — ver README). Ejemplo: `https://vaquita.onrender.com`.
2. **Cuenta de Google Play Console**: USD 25 por única vez → https://play.google.com/console
3. La PWA ya cumple lo técnico: `manifest.webmanifest` completo, service worker, íconos 192/512 + maskable.

## Camino fácil: PWABuilder (recomendado)

1. Entrá a **https://www.pwabuilder.com** y poné la URL de tu app deployada.
2. Revisá el reporte (manifest y service worker deberían dar verde) y tocá **Package for Stores → Android**.
3. Completá:
	- **Package ID**: `ar.com.vaquita.app` (o el que quieras, formato dominio invertido).
	- **App name**: VAQUITA · **Version**: 1.0.0.
	- Firma: dejá que genere una **signing key** nueva y **guardala bien** (la necesitás para toda actualización futura).
4. Descargá el `.aab` (Android App Bundle) y el archivo `assetlinks.json` que te genera.

### Digital Asset Links (paso clave)

Para que la app abra sin la barra de URL, Google verifica que el sitio y la app sean tuyos:

1. Serví el archivo en `https://TU-DOMINIO/.well-known/assetlinks.json`.
2. En este proyecto: creá la carpeta `public/.well-known/` y poné ahí el `assetlinks.json` de PWABuilder. El servidor ya sirve cualquier archivo de `public/`.
3. Redeployá y verificá que la URL responda el JSON.

## Camino alternativo: Bubblewrap (CLI)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://TU-DOMINIO/manifest.webmanifest
bubblewrap build
# genera app-release-signed.aab + assetlinks.json
```

## Subir a la tienda

1. En Play Console: **Crear app** → nombre VAQUITA, idioma español (Latinoamérica), gratis.
2. Completá la ficha: descripción corta y larga, ícono 512×512, capturas de teléfono (sacalas del demo o de tu teléfono), política de privacidad (podés hostear una página simple en el mismo dominio).
3. **Producción → Crear versión** → subí el `.aab` → completá los cuestionarios (clasificación de contenido, público objetivo, seguridad de datos).
4. Enviá a revisión. La primera revisión tarda entre 1 y 7 días.

## Checklist de la ficha

- [ ] Título: *VAQUITA: gastos compartidos*
- [ ] Descripción corta: *Para el asado, el viaje, el depto. Quién pone, quién debe, saldado en segundos.*
- [ ] 4–8 capturas de pantalla del teléfono
- [ ] Ícono 512×512 (usá `public/icons/icon-512.png`)
- [ ] URL de política de privacidad
- [ ] Cuestionario de **Data safety**: declará que se recolecta email y nombre, cifrados en tránsito, con eliminación a pedido

## Actualizaciones futuras

Lo mejor del enfoque TWA: **actualizás la web y la app se actualiza sola**. Solo necesitás subir un nuevo `.aab` si cambiás ícono, nombre o configuración nativa.
