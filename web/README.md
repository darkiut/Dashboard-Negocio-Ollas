# Sitio Web - Inventario de Ollas

Este es el panel web para la gestión del negocio de ollas, conectado a Firebase.

## Configuración

El proyecto ya está configurado para conectarse al proyecto Firebase `inventarioollas`.

## Despliegue

Para desplegar este sitio web, puedes usar Firebase Hosting

1. Instala Firebase CLI: `npm install -g firebase-tools`
2. Inicia sesión: `firebase login`
3. Inicializa el proyecto: `firebase init hosting`
   - Selecciona el proyecto `inventarioollas`.
   - Carpeta pública: `web` (o la carpeta actual si estás dentro de `web`).
   - Configurar como SPA: No.
4. Despliega: `firebase deploy`

Alternativamente, puedes abrir `index.html` en un navegador localmente para probar, pero asegúrate de tener acceso a internet.
