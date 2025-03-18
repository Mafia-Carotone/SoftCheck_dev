// Configuración global
const CONFIG = {
  // URL base de la API - puerto 80 como indica el .env
  apiUrl: 'http://localhost:80/api',
  
  // Endpoints específicos
  endpoints: {
    ping: '/ping',
    health: '/health',
    softwareRequests: '/software-requests',
    auth: '/auth/signin'
  },
  
  // ID del equipo para usar en la URL - usar un equipo real que exista en la base de datos
  defaultTeamId: 'default-team',
  
  // Tiempo de espera para la conexión (en milisegundos)
  connectionTimeout: 5000,
  
  // Opciones por defecto para fetch
  fetchOptions: {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
};

// Store downloads globally
let pendingDownloads = [];

// Listen for downloads
chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('🔍 Nueva descarga detectada:', downloadItem);
  
  // Verificar si el archivo es software antes de procesarlo
  if (!isSoftwareFile(downloadItem)) {
    console.log('⏭️ Descarga ignorada, no es software:', downloadItem.filename);
    return;
  }
  
  console.log('✅ Descarga de software detectada:', downloadItem.filename);
  
  // Extraer información relevante del archivo
  const downloadInfo = {
    id: downloadItem.id,
    fileName: downloadItem.filename.split('\\').pop().split('/').pop(), // Extract filename only
    fileSize: downloadItem.fileSize || 0,
    fileUrl: downloadItem.url || '',
    downloadSource: downloadItem.referrer || 'Direct download',
    mimeType: downloadItem.mime || '',
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  console.log('📦 Información de descarga extraída:', downloadInfo);
  
  // Almacenar la descarga pendiente
  chrome.storage.local.get(['pendingDownloads'], function(result) {
    console.log('📂 Descargas pendientes actuales:', result.pendingDownloads);
    
    const downloads = result.pendingDownloads || [];
    downloads.push(downloadInfo);
    
    // Guardar en almacenamiento local
    chrome.storage.local.set({ pendingDownloads: downloads }, function() {
      console.log('💾 Descarga guardada en almacenamiento local. Total descargas:', downloads.length);
      
      // Mostrar notificación
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Nueva descarga detectada',
        message: `Archivo: ${downloadInfo.fileName}\nTamaño: ${formatFileSize(downloadInfo.fileSize)}`,
        priority: 2
      });
    });
  });
});

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Gestionar mensajes de la extensión
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {  
  // Comprobar descargas y enviar solicitudes
  if (message.action === 'checkDownloads') {    
    // Obtener descargas pendientes
    chrome.storage.local.get(['pendingDownloads', 'workingSoftwareRequestsEndpoint'], function(result) {
      const pendingDownloads = result.pendingDownloads || [];
      
      if (!message.apiKey) {
        sendResponse({ success: false, error: 'No se ha configurado una API key' });
        return;
      }
      
      // Filtrar solo las descargas que no han sido enviadas aún
      const unsentDownloads = pendingDownloads.filter(download => download.status === 'pending');
      
      if (unsentDownloads.length === 0) {
        sendResponse({ success: false, message: 'No hay descargas pendientes para enviar' });
        return;
      }
      
      console.log(`Enviando ${unsentDownloads.length} descargas para aprobación...`);
      
      // Usar el endpoint pasado en el mensaje o el guardado, o el predeterminado
      const endpoint = message.softwareRequestsEndpoint || 
                     result.workingSoftwareRequestsEndpoint || 
                     CONFIG.endpoints.softwareRequests;
                     
      // URL para software-requests con el endpoint correcto
      const requestUrl = CONFIG.apiUrl + endpoint;
      
      console.log(`Usando URL: ${requestUrl}`);
      
      // Enviar cada descarga como una solicitud
      Promise.all(unsentDownloads.map(download => {
        console.log(`Enviando: ${download.fileName} a ${requestUrl}`);
        
        const requestData = {
          fileName: download.fileName || "NA",
          fileSize: download.fileSize || 0,
          fileUrl: download.fileUrl || "NA",
          downloadSource: download.downloadSource || "NA",
          status: 'pending',
          notes: `Descarga detectada automáticamente por la extensión SoftCheck`
          // Ya no enviamos el teamId ya que el backend lo determinará basado en la API key
        };

        console.log('Datos a enviar:', requestData);
        
        // Crear encabezados para API
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': message.apiKey,
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        };
        
        return fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'same-origin',
          redirect: 'follow',
          body: JSON.stringify(requestData)
        })
        .then(async response => {
          const text = await response.text();
          console.log('Respuesta:', text);
          
          // Verificar si es HTML
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error(`Error: Se recibió HTML en lugar de JSON. Endpoint incorrecto.`);
          }
          
          if (!response.ok) {
            try {
              const errorData = JSON.parse(text);
              throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
            } catch (e) {
              if (text.includes('<!DOCTYPE html>')) {
                throw new Error(`Error ${response.status}: Endpoint no encontrado`);
              }
              throw new Error(`Error ${response.status}: ${text || response.statusText}`);
            }
          }
          
          try {
            return {
              download,
              response: JSON.parse(text),
              success: true
            };
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            throw new Error('Respuesta del servidor no válida');
          }
        })
        .catch(error => {
          return {
            download,
            error: error.message,
            success: false
          };
        });
      }))
      .then(results => {
        console.log('Resultados de solicitudes:', results);
        
        // Actualizar el estado de las descargas procesadas
        const updatedDownloads = [...pendingDownloads];
        
        results.forEach(result => {
          // Encontrar el índice de la descarga en el array original
          const index = updatedDownloads.findIndex(d => d.id === result.download.id);
          
          if (index !== -1) {
            if (result.success) {
              // Determinar el estado según la respuesta
              // Detectar si fue aprobado o rechazado automáticamente
              const responseStatus = result.response.status || 'sent';
              const isAutoApproved = result.response.autoApproved === true;
              const isAutoRejected = result.response.autoRejected === true;
              
              // Actualizar estado según la respuesta
              updatedDownloads[index] = {
                ...updatedDownloads[index],
                status: responseStatus,
                serverRequestId: result.response.id || null,
                teamId: result.response.teamId || null,
                sentAt: new Date().toISOString(),
                // Añadir información adicional si fue auto-aprobado/rechazado
                autoProcessed: isAutoApproved || isAutoRejected,
                existingSoftwareId: result.response.existingSoftwareId || null,
                statusNotes: result.response.notes || null
              };
              
              // Si fue auto-aprobado o rechazado, mostrar notificación específica
              if (isAutoApproved || isAutoRejected) {
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: isAutoApproved ? 'icon-approved.png' : 'icon-rejected.png',
                  title: isAutoApproved ? 'Software Aprobado Automáticamente' : 'Software Rechazado Automáticamente',
                  message: `${result.download.fileName}\n${result.response.notes || ''}`,
                  priority: 2
                });
              }
            } else {
              // Marcar como error pero mantener en pendiente para reintentar
              updatedDownloads[index] = {
                ...updatedDownloads[index],
                lastError: result.error
              };
            }
          }
        });
        
        // Guardar las descargas actualizadas
        chrome.storage.local.set({ pendingDownloads: updatedDownloads }, function() {
          sendResponse({ 
            success: true, 
            sentCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length,
            results: results.map(r => ({
              fileName: r.download.fileName,
              success: r.success,
              message: r.success ? 'Enviado correctamente' : r.error
            }))
          });
        });
      })
      .catch(error => {
        console.error('Error al enviar solicitudes:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Error al enviar solicitudes' 
        });
      });
    });
    
    return true; // Mantener canal abierto para respuesta asíncrona
  }
  
  // Cancelar solicitud enviada
  if (message.action === 'cancelSoftwareRequest') {
    chrome.storage.local.get(['pendingDownloads', 'apiKey'], function(result) {
      const pendingDownloads = result.pendingDownloads || [];
      const apiKey = result.apiKey || message.apiKey;
      const { downloadId, serverRequestId } = message;
      
      if (!apiKey) {
        sendResponse({ success: false, error: 'No se ha configurado una API key' });
        return;
      }
      
      const downloadIndex = pendingDownloads.findIndex(d => d.id.toString() === downloadId.toString());
      
      if (downloadIndex === -1) {
        sendResponse({ success: false, error: 'Descarga no encontrada' });
        return;
      }
      
      const download = pendingDownloads[downloadIndex];
      const requestId = serverRequestId || download.serverRequestId;
      
      // Si la solicitud ya fue enviada al servidor y tenemos su ID, intentar cancelarla
      if (download.status === 'sent' && requestId) {
        // URL para cancelar la solicitud (mediante el endpoint correcto sin teamId)
        const cancelUrl = `${CONFIG.apiUrl}/software-requests/${requestId}`;
        
        fetch(cancelUrl, {
          ...CONFIG.fetchOptions,
          method: 'DELETE',
          headers: {
            ...CONFIG.fetchOptions.headers,
            'X-API-Key': apiKey
          }
        })
        .then(async response => {
          const text = await response.text();
          console.log(`Respuesta cancelación: ${text}`);
          
          if (!response.ok) {
            throw new Error(text || `Error ${response.status}: No se pudo cancelar la solicitud en el servidor`);
          }
          
          // Eliminar la descarga del almacenamiento local
          pendingDownloads.splice(downloadIndex, 1);
          chrome.storage.local.set({ pendingDownloads }, function() {
            sendResponse({ success: true, message: 'Solicitud cancelada correctamente' });
          });
        })
        .catch(error => {
          console.error('Error al cancelar solicitud:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        // Si no fue enviada o no tenemos el ID, simplemente eliminarla del almacenamiento local
        pendingDownloads.splice(downloadIndex, 1);
        chrome.storage.local.set({ pendingDownloads }, function() {
          sendResponse({ success: true, message: 'Descarga eliminada correctamente' });
        });
      }
    });
    
    return true; // Mantener canal abierto para respuesta asíncrona
  }
});

// Función para iniciar el proceso de autenticación
function initiateGithubAuth() {
  const authUrl = `${CONFIG.apiUrl.replace('/api', '')}${CONFIG.endpoints.auth}`;
  
  // Abrir ventana de autenticación
  chrome.windows.create({
    url: authUrl,
    type: 'popup',
    width: 800,
    height: 600
  });
}

// Comprobar si el servidor está disponible
function checkServerConnection() {
  console.log('Verificando conexión con el servidor...');
  
  // Lista de URLs para intentar, en orden de prioridad
  const urlsToTry = [
    `${CONFIG.apiUrl}${CONFIG.endpoints.ping}`,         // localhost:80/api/ping (configuración por defecto)
    `http://localhost/api${CONFIG.endpoints.ping}`,      // Sin especificar puerto (default 80)
    `http://127.0.0.1:80/api${CONFIG.endpoints.ping}`,   // Usando IP explícita puerto 80
    `http://127.0.0.1/api${CONFIG.endpoints.ping}`,      // IP sin puerto (default 80)
    `http://localhost:3000/api${CONFIG.endpoints.ping}`, // Intento en puerto 3000 (desarrollo Next.js)
    `http://localhost:8080/api${CONFIG.endpoints.ping}`  // Intento en puerto 8080
  ];
  
  console.log('Intentando conectar a múltiples URLs:', urlsToTry);
  
  chrome.storage.local.get(['apiKey'], function(result) {
    const headers = {
      ...CONFIG.fetchOptions.headers,
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    };

    // Siempre incluir la API key si está disponible
    if (result.apiKey) {
      headers['X-API-Key'] = result.apiKey;
      console.log('Incluyendo API key en verificación de conexión');
    } else {
      console.warn('No hay API key disponible para verificación de conexión');
    }
    
    // Función para intentar la siguiente URL
    function tryNextUrl(index) {
      if (index >= urlsToTry.length) {
        console.warn('Todos los intentos de conexión fallaron');
        tryApiConnection(); // Intentar la conexión a health como último recurso
        return;
      }
      
      const currentUrl = urlsToTry[index];
      console.log(`Intento #${index + 1}: Conectando a ${currentUrl}`);
      
      fetch(currentUrl, {
        ...CONFIG.fetchOptions,
        method: 'GET',
        headers
      })
      .then(async response => {
        if (!response.ok) {
          const text = await response.text();
          console.error(`Error en ${currentUrl}:`, text);
          throw new Error(`Error ${response.status}: ${text || response.statusText}`);
        }
        const text = await response.text();
        console.log(`Ping exitoso a ${currentUrl}:`, text);
        
        // Si llegamos aquí, guardamos la URL exitosa para futuros usos
        chrome.storage.local.set({ 
          serverConnected: true,
          successfulApiUrl: currentUrl.split(CONFIG.endpoints.ping)[0] // Guardar solo la base URL
        });
        
        tryApiConnection();
      })
      .catch(error => {
        console.warn(`Ping a ${currentUrl} falló:`, error);
        // Intentar con la siguiente URL
        tryNextUrl(index + 1);
      });
    }
    
    // Comenzar con la primera URL
    tryNextUrl(0);
  });
}

// Función para intentar la conexión a la API
function tryApiConnection() {
  chrome.storage.local.get(['apiKey', 'successfulApiUrl'], function(result) {
    const headers = {
      ...CONFIG.fetchOptions.headers
    };

    if (result.apiKey) {
      headers['X-API-Key'] = result.apiKey;
    }
    
    // Usar la URL que funcionó en checkServerConnection si está disponible
    const baseUrl = result.successfulApiUrl || CONFIG.apiUrl;
    const healthUrl = `${baseUrl}${CONFIG.endpoints.health}`;
    
    console.log('Intentando health check en:', healthUrl);
    
    fetch(healthUrl, {
      ...CONFIG.fetchOptions,
      method: 'GET',
      headers
    })
    .then(async response => {
      if (!response.ok) {
        const text = await response.text();
        console.error('Error response:', text);
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
        } catch (e) {
          throw new Error(`Error ${response.status}: ${text || response.statusText}`);
        }
      }
      const data = await response.json();
      console.log('API health check successful:', data);
      chrome.storage.local.set({ serverConnected: true });
    })
    .catch(error => {
      console.error('API health check failed:', error);
      chrome.storage.local.set({ serverConnected: false });
      // No lanzamos el error para evitar que rompa la ejecución
      console.error(error);
    });
  });
}

// Inicialización
function init() {
  console.log('SoftCheck extension initialized');
  
  // Intentar conectar al servidor
  try {
    checkServerConnection();
  } catch (error) {
    console.log('Error checking server connection, continuing anyway');
  }
  
  // Configurar intervalo para comprobar la conexión periódicamente (cada 5 minutos)
  setInterval(checkServerConnection, 5 * 60 * 1000);
}

// Iniciar la extensión
init();

// Función para determinar si un archivo es software (implementada explícitamente)
function isSoftwareFile(downloadItem) {
  console.log('📋 Evaluando si el archivo es software:', downloadItem.filename);
  
  // Lista de extensiones de archivos considerados software
  const softwareExtensions = [
    '.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', 
    '.app', '.apk', '.jar', '.zip', '.rar', '.7z', 
    '.tar.gz', '.iso', '.dll', '.appimage'
  ];
  
  // Obtener la extensión del archivo
  const filename = downloadItem.filename.toLowerCase();
  const hasExtension = softwareExtensions.some(ext => filename.endsWith(ext));
  
  console.log(`📋 El archivo ${filename} ${hasExtension ? 'ES' : 'NO es'} considerado software`);
  
  // Descomentar esta línea para filtrar solo archivos de software reales
  // return hasExtension;
  
  // Durante el desarrollo y pruebas, interceptar todas las descargas
  return true; // Interceptar todas las descargas para depuración
} 