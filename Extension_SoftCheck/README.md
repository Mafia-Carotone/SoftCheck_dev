# SoftCheck Browser Extension

Esta extensión para navegadores basados en Chromium permite monitorear las descargas de software y enviarlas al sistema SoftCheck para su aprobación.

## Funcionalidades

- Detección automática de descargas de software
- Envío de solicitudes de aprobación al sistema SoftCheck
- Gestión de equipos y usuarios
- Interfaz sencilla y amigable

## Requisitos

- Navegador compatible con Chrome Extensions (Chrome, Edge, Brave, Opera)
- Una cuenta en el sistema SoftCheck con una API Key válida
- Pertenencia a al menos un equipo en SoftCheck

## Instalación para desarrollo

1. Descarga o clona este repositorio en tu equipo
2. Abre Chrome y navega a `chrome://extensions/`
3. Activa el "Modo desarrollador" usando el interruptor en la esquina superior derecha
4. Haz clic en "Cargar descomprimida" y selecciona la carpeta `Extension_SoftCheck`
5. La extensión debería aparecer en tu navegador

## Configuración

1. Haz clic en el icono de SoftCheck en la barra de herramientas de tu navegador
2. Ingresa tu API Key y selecciona el equipo al que perteneces
3. Guarda la configuración
4. Listo! La extensión comenzará a monitorear tus descargas

## Uso diario

Una vez configurada, la extensión:

1. Detectará automáticamente cuando descargas un archivo de software
2. Mostrará notificaciones cuando se detecten descargas
3. Te permitirá enviar solicitudes de aprobación con un solo clic

## Problemas comunes y soluciones

### La extensión no detecta las descargas
- Asegúrate de que la extensión tenga permiso para acceder a las descargas
- Verifica que el servidor SoftCheck esté en funcionamiento

### No puedo conectarme al servidor
- Verifica que la URL del servidor sea correcta
- Comprueba que tu API Key sea válida y esté activa

### Errores de conexión
- Verifica tu conexión a internet
- Consulta con el administrador de SoftCheck si el servicio está disponible

## Publicación en producción

Para usar esta extensión en un entorno de producción:

1. Modifica la URL del servidor en `background.js` para apuntar a tu servidor SoftCheck
2. Empaqueta la extensión siguiendo las instrucciones de Chrome para desarrolladores
3. Distribuye el archivo .crx o publica en la Chrome Web Store

## Desarrollo

La extensión está construida con JavaScript vanilla y usa:
- Chrome Extension APIs
- Fetch API para comunicación con el servidor
- HTML y CSS para la interfaz

## Contacto y soporte

Para soporte técnico, contacta a tu administrador de SoftCheck o al equipo de desarrollo. 