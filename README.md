# AELITYX Motion Studio

**Cinematic Lab 2.2 · Orden de imágenes**

Convierte tus imágenes en recorridos animados en 3D y descarga el resultado en WebM. Cada imagen conserva su ficha y sus ajustes cuando la mueves en la secuencia. La importación, la vista previa y el render se hacen en el navegador.

[Probar la versión 2.2](https://animations-pb3p7mueu-illumination-keeper.vercel.app/) · [Versión respaldada en Git](https://github.com/aeronaelityx/animations/tree/stable-v2.2)

> La vista previa de Vercel puede pedirte iniciar sesión. También puedes ejecutar el editor en local.

## Primer recorrido

1. Abre **Cargar demo → Materia** o importa tus imágenes. Puedes arrastrar archivos al escenario.
2. En la tira de miniaturas, arrastra una imagen hacia el lado anterior o posterior de otra. También puedes seleccionarla y usar **Antes** o **Después**. La numeración indica el orden de exportación.
3. En **Recorrido**, elige la coreografía. **Reproducir recorrido** muestra la secuencia y **Previsualizar efecto** permite revisar una imagen.
4. Edita el título y el detalle de cada tarjeta. Ajusta la posición, tipografía, alineación y colores de las fichas.
5. Elige encuadre, segundos por imagen, FPS y contenido. Pulsa **Descargar WebM**.

## Recorridos

| Recorrido | Cómo se mueve |
| --- | --- |
| **Radiant · intercaladas** | Tarjetas en diagonal que alternan cara y canto a distintas profundidades. |
| **Vórtice infinito** | Las tarjetas giran y se alejan hacia un punto de fuga. |
| **Burbujas** | Cada esfera se abre como una cartulina, muestra la imagen y vuelve a cerrarse. |
| **Diapositivas** | Las imágenes pasan de derecha a izquierda. |
| **Onda flotante** | Las imágenes suben, bajan y se inclinan mientras avanzan. |
| **Collage · torbellino** | Recortes de papel giran en capas de forma continua. |
| **Rompecabezas · alberca** | Nueve piezas flotan, encajan para revelar la imagen y vuelven a separarse. |

## Controles de edición

**Dirección** orienta el recorrido hacia la izquierda, la derecha, abajo o arriba. Los recorridos diagonales giran o se reflejan con el eje elegido. La orientación del recorrido se aplica al WebM.

- **Por imagen.** Ajusta el efecto, su intensidad, el título y el detalle. **Aplicar efecto a todas** copia también la intensidad. Activa **Ajustar intensidad de todas** para mover el deslizador en conjunto sin cambiar los efectos asignados. Puedes aleatorizar sus efectos. Mover una miniatura también mueve sus ajustes.
- **Cámara y profundidad.** En los recorridos de tarjetas puedes elegir entre el efecto habitual, 3D Float y parallax. El parallax por capas usa la imagen base y recortes transparentes aportados por ti. El modo por mapa usa una imagen de profundidad en escala de grises con blanco para lo cercano. El rompecabezas usa su propia puesta en escena.
- **Código del efecto.** Consulta la función del preset y edita sus fotogramas clave como JSON. Usa entre 2 y 120 puntos ordenados, con `t` de 0 a 1. Puedes ajustar `x`, `y`, `z`, `rx`, `ry`, `rz`, `scale` y `opacity`. **Restaurar preset** vuelve al efecto original.
- **Escena.** Elige luz suave, color sólido o partículas y ajusta el fondo. La alberca añade su superficie de agua animada.
- **Texto.** Desmarca **Mostrar ficha de texto** para ocultar título, detalle y fondo de la ficha en la vista previa y el WebM. Puedes volver a activarla con el texto que ya escribiste. El título admite 52 caracteres y el detalle 400. La ficha reparte el texto en líneas y reduce el tamaño cuando hace falta.

## Exportación

En **9:16**, elige **Posición al desplegar** en cualquier recorrido. En todos los formatos puedes ajustar **Tamaño al desplegar** del 35 % al 98 % del tamaño máximo que cabe en el cuadro. Estos controles se aplican a la imagen destacada o al rompecabezas armado. Si la ficha coincide con el extremo elegido, aparece en el extremo opuesto.

| Ajuste | Opciones |
| --- | --- |
| Encuadre | **1:1** 1024 × 1024, **9:16** 1080 × 1920 o **16:9** 1920 × 1080 |
| Composición WebM | **Pantalla completa** recorta la imagen al cuadro con un acercamiento suave. **Galería** conserva los efectos 3D del escenario. |
| FPS | 24, 30 o 60 |
| Duración | De 1 a 12 segundos por imagen |
| Contenido | Recorrido continuo, secuencia con efectos o imagen seleccionada |
| Archivos | Video WebM sin audio e imagen individual WebP |

Las secuencias exportadas empiezan por la miniatura 1 y siguen el orden visible. **Imagen seleccionada** exporta solo esa tarjeta. Para un recorrido continuo, usa al menos dos imágenes, salvo Collage, Rompecabezas y Burbujas con el despliegue activado, que admiten una.

Cuando el navegador puede codificar con WebCodecs, el editor renderiza fotograma a fotograma. La ruta de compatibilidad graba en tiempo real con MediaRecorder y el rendimiento del equipo puede afectar la cadencia.

## Alcance y límites

| Tema | Qué esperar en la 2.2 |
| --- | --- |
| Capacidad | Hasta 20 imágenes por sesión. |
| Importación | Formatos que el navegador pueda decodificar, más HEIC/HEIF mediante conversión local. GIF y WebP animados se usan como imágenes fijas. |
| Proporciones | La app prepara copias WebP de hasta 2048 px en el lado mayor sin estirar la imagen. La esfera cerrada usa un recorte circular. Al desplegarse, encuadra la imagen completa. |
| Parallax | Usa tus capas o tu mapa de profundidad. El editor no genera esos recursos automáticamente. |
| Sesión | Los ajustes y las imágenes viven en la pestaña. Descarga tus resultados antes de recargar o cerrar el editor. La 2.2 no guarda proyectos editables ni ofrece sincronización. |
| Formato de salida | WebM para video y WebP para la imagen. MP4 y pistas de audio quedan fuera del editor. |
| Navegador | El escenario requiere WebGL 2. La exportación depende de que el navegador tenga un codificador WebM compatible. |

## Desarrollo local

Requiere **Node.js 22.x** y npm.

```sh
git clone --branch stable-v2.2 https://github.com/aeronaelityx/animations.git
cd animations
npm ci
npm run dev
```

Abre la dirección que Vite muestra en la terminal. Usa `npm run build` para generar `dist/`. Vercel está configurado con el preset **Vite** y sirve ese directorio.

### Mapa del código

| Archivo | Responsabilidad |
| --- | --- |
| [index.html](index.html) y [style.css](style.css) | Controles, escenario, tira de miniaturas y estilos. |
| [src.js](src.js) | Estado de la sesión, importación, reordenamiento, recorridos y coordinación del render. |
| [gallery.js](gallery.js) y [collages.js](collages.js) | Geometría de tarjetas y esferas, collage y rompecabezas. |
| [cinematic.js](cinematic.js) y [effects.js](effects.js) | Cámara, profundidad y presets de movimiento. |
| [caption.js](caption.js) | Composición, ajuste de texto y dibujo de fichas. |
| [webm.js](webm.js) | Render WebM con Mediabunny y ruta de grabación en tiempo real. |
| [materia.js](materia.js) | Imágenes generadas para la demo Materia. |

## Versiones

| Referencia | Contenido |
| --- | --- |
| `stable-v2.2` | Versión aprobada con reordenamiento por arrastre o botones y documentación de uso. |
| [`stable-v2.0`](https://github.com/aeronaelityx/animations/tree/stable-v2.0) | Respaldo de Cinematic Lab antes de añadir Collage y Rompecabezas. |
| [`cinematic-collages`](https://github.com/aeronaelityx/animations/tree/cinematic-collages) | Rama de trabajo de la variante que incorpora esos recorridos. |
