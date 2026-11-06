# AELITYX Motion Studio

Editor web con hélice 3D, 20 efectos y exportación local WebP/WebM.

## Desarrollo

Usa Node 22 LTS. Ejecuta `npm ci`, luego `npm run dev` o `npm run build`. Vercel usa el preset Vite y sirve `dist`.

## Uso

Importa hasta 20 tarjetas o abre la demo. Cada efecto admite intensidad. Las imágenes compatibles se convierten a WebP (2048 px máximo por lado). HEIC/HEIF se decodifica localmente. GIF y WebP animados se importan como tarjeta fija. WebM se graba en tiempo real y requiere un navegador con WebGL 2 y MediaRecorder compatible.
