// Configuración global
const CONFIG = {
  // URL base de la API
  apiUrl: 'http://localhost:80/api',
  
  // Endpoints específicos
  endpoints: {
    ping: '/ping',
    health: '/health',
    softwareRequests: '/teams/{teamId}/software-requests'
  },
  
  // ID del equipo por defecto
  defaultTeamId: '1',
  
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
  console.log('New download detected:', downloadItem);
  
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
  
  // Almacenar la descarga pendiente
  chrome.storage.local.get(['pendingDownloads'], function(result) {
    const downloads = result.pendingDownloads || [];
    downloads.push(downloadInfo);
    
    // Guardar en almacenamiento local
    chrome.storage.local.set({ pendingDownloads: downloads }, function() {
      console.log('Download saved to storage:', downloadInfo);
      
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
    // Obtener API key y descargas pendientes
    chrome.storage.local.get(['apiKey', 'pendingDownloads'], function(result) {
      const apiKey = result.apiKey;
      const pendingDownloads = result.pendingDownloads || [];
      
      if (!apiKey) {
        sendResponse({ success: false, error: 'No se ha configurado una API key' });
        return;
      }
      
      if (pendingDownloads.length === 0) {
        sendResponse({ success: false, message: 'No hay descargas pendientes' });
        return;
      }
      
      console.log(`Enviando ${pendingDownloads.length} descargas para aprobación...`);
      
      // URL específica para software-requests
      const requestUrl = CONFIG.apiUrl + CONFIG.endpoints.softwareRequests.replace('{teamId}', CONFIG.defaultTeamId);
      
      // Enviar cada descarga como una solicitud
      Promise.all(pendingDownloads.map(download => {
        console.log(`Enviando: ${download.fileName} a ${requestUrl}`);
        
        const requestData = {
          fileName: download.fileName || "NA",
          fileSize: download.fileSize || 0,
          fileUrl: download.fileUrl || "NA",
          downloadSource: download.downloadSource || "NA",
          status: 'pending'
          // El teamId ya va en la URL, no necesitamos enviarlo en el body
          // El userId será asignado por el backend basado en el token
        };

        console.log('Datos a enviar:', requestData);
        
        return fetch(requestUrl, {
          ...CONFIG.fetchOptions,
          method: 'POST',
          headers: {
            ...CONFIG.fetchOptions.headers,
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestData)
        })
        .then(async response => {
          const text = await response.text();
          console.log('Respuesta del servidor:', text);
          
          if (!response.ok) {
            try {
              const errorData = JSON.parse(text);
              throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
            } catch (e) {
              throw new Error(`Error ${response.status}: ${text || response.statusText}`);
            }
          }
          
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            throw new Error('Respuesta del servidor no válida');
          }
        });
      }))
      .then(results => {
        console.log('Todas las solicitudes enviadas con éxito:', results);
        // Limpiar descargas enviadas
        chrome.storage.local.set({ pendingDownloads: [] });
        sendResponse({ 
          success: true, 
          sentCount: pendingDownloads.length,
          results: results 
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
});

// Comprobar si el servidor está disponible
function checkServerConnection() {
  console.log('Verificando conexión con el servidor...');
  console.log('Intentando conectar a:', `${CONFIG.apiUrl}${CONFIG.endpoints.ping}`);
  
  chrome.storage.local.get(['apiKey'], function(result) {
    const headers = {
      ...CONFIG.fetchOptions.headers,
      'Accept': 'text/plain'
    };

    if (result.apiKey) {
      headers['Authorization'] = `Bearer ${result.apiKey}`;
    }
    
    fetch(`${CONFIG.apiUrl}${CONFIG.endpoints.ping}`, {
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
          if (errorData.error?.message === 'Unauthorized' || response.status === 401) {
            throw new Error('API Key inválida o no autorizada');
          }
          throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
        } catch (e) {
          throw new Error(`Error ${response.status}: ${text || response.statusText}`);
        }
      }
      const text = await response.text();
      console.log('Ping exitoso:', text);
      chrome.storage.local.set({ serverConnected: true });
      
      // Si el ping funciona, intentamos la conexión real a la API
      tryApiConnection();
    })
    .catch(error => {
      console.warn('Ping falló, intentando con API health:', error);
      tryApiConnection();
    });
  });
}

// Función para intentar la conexión a la API
function tryApiConnection() {
  const healthUrl = `${CONFIG.apiUrl}${CONFIG.endpoints.health}`;
  console.log('Intentando health check en:', healthUrl);
  
  chrome.storage.local.get(['apiKey'], function(result) {
    const headers = {
      ...CONFIG.fetchOptions.headers,
      'Accept': 'application/json'
    };

    if (result.apiKey) {
      headers['Authorization'] = `Bearer ${result.apiKey}`;
    }
    
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
          if (errorData.error?.message === 'Unauthorized' || response.status === 401) {
            throw new Error('API Key inválida o no autorizada');
          }
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
      throw error;
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