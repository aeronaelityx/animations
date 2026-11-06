# AELITYX Motion Studio

Editor web para animar imágenes en una hélice 3D. El procesamiento de archivos se realiza en el navegador.

```sh
npm ci
npm run dev
npm run build
```

Vercel: preset Vite, salida `dist`. Para grabar WebM usa un navegador con WebGL2 y MediaRecorder con VP8 o VP9. Los GIF y WebP animados se importan como imagen fija. Los archivos HEIC/HEIF usan un decodificador local. La grabación ocurre en tiempo real.
