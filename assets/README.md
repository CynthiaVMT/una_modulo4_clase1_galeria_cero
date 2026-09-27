# GUÍA DE ARCHIVOS MULTIMEDIA — GALERÍA CERO

En esta carpeta `assets/` puedes guardar tus propias imágenes, videos y archivos de sonido. Simplemente coloca tus archivos con los nombres indicados abajo y la página web los cargará automáticamente.

---

## 📁 Estructura de Carpetas y Nombres de Archivo

```text
PROYECTO WEB 1/
│
├── index.html
├── style.css
├── script.js
│
└── assets/
    │
    ├── videos/
    │   ├── hero.mp4              <-- Video principal del encabezado (Home)
    │   └── sculpture.mp4         <-- Video alternativo para la escultura (opcional)
    │
    ├── audio/
    │   └── ambient.mp3           <-- Música o atmósfera sonora de fondo
    │
    └── images/
        ├── hero/
        │   └── hero-poster.jpg   <-- Imagen de fondo previa mientras carga el video
        │
        ├── pics/
        │   ├── obra1.jpg         <-- Foto 1: "La Escala Imposible" / Slider Home
        │   ├── obra2.jpg         <-- Foto 2: "Abstracción en Sombras" / Slider Home
        │   ├── obra3.jpg         <-- Foto 3: "El Espiral del Silencio" / Slider Home
        │   ├── obra4.jpg         <-- Foto 4: "Anatomía de la Penumbra" / Slider Home
        │   ├── obra5.jpg         <-- Foto 5: "Planos en Colisión"
        │   └── obra6.jpg         <-- Foto 6: "Perfil en Eclipse"
        │
        ├── interactive/
        │   └── interactiva.jpg   <-- Obra digital con efecto de destello al pasar el mouse
        │
        └── museum/
            ├── museo1.jpg        <-- Foto arquitectura: Atrio Central
            ├── museo2.jpg        <-- Foto arquitectura: Galería de Esculturas
            └── museo3.jpg        <-- Foto arquitectura: Pasaje de Transición
```

---

## 📐 Recomendaciones de Formato y Resolución

| Tipo de Archivo | Formato Recomendado | Resolución Sugerida | Notas |
| :--- | :--- | :--- | :--- |
| **Video Hero** (`hero.mp4`) | MP4 (H.264), WebM | 1920x1080 (Full HD) | Ojalá comprimido (menos de 15MB) para carga rápida y en bucle fluido. |
| **Fotografías PICS** (`obra1.jpg` a `obra6.jpg`) | JPG, WebP, PNG | 1600x1000 a 2400x1600 | Excelente nitidez para el visor ampliado Lightbox. Estética en blanco y negro o color. |
| **Obra Interactiva** (`interactiva.jpg`) | JPG, PNG, WebP o GIF | 1200x800 a 1600x1000 | Al pasar el cursor, la web le aplica el destello de halo luminoso y las partículas. |
| **Fotos del Museo** (`museo1.jpg` a `museo3.jpg`) | JPG, WebP | 800x600 a 1200x800 | Fotografías de arquitectura o instalaciones. |
| **Audio Ambiental** (`ambient.mp3`) | MP3, OGG, WAV | Calidad 128 kbps a 192 kbps | Sonido continuo o ambiental tipo drone/chimes. Si no colocas este archivo, la web utiliza automáticamente su sintetizador Web Audio API integrado. |

---

## 💡 ¿Cómo cambiar un archivo?
1. Guarda tu nueva imagen o video con el mismo nombre y formato (por ejemplo: `obra1.jpg`).
2. Reemplaza el archivo existente dentro de la carpeta correspondiente.
3. Actualiza tu navegador (`Cmd + R` en Mac o `F5`) para ver los cambios de inmediato.
