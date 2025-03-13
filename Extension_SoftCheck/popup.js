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
  
  // Tiempo de espera para conexiones (en milisegundos)
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

document.addEventListener('DOMContentLoaded', function() {
  // Verificar el estado del servidor
  checkServerConnection();
  
  // Cargar configuración guardada
  loadSavedConfig();
  
  // Obtener elementos del DOM
  const configSection = document.getElementById('config-section');
  const downloadsSection = document.getElementById('downloads-section');
  const apiKeyInput = document.getElementById('apiKey');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const sendAllBtn = document.getElementById('sendAllBtn');
  const statusDiv = document.getElementById('status');
  
  // Event listeners
  saveConfigBtn.addEventListener('click', saveConfiguration);
  sendAllBtn.addEventListener('click', sendAllDownloads);
  
  // Actualizar la interfaz según la configuración
  updateUI();
  
  // Cargar y mostrar las descargas
  loadPendingDownloads();
  
  // Actualizar las descargas cada 5 segundos
  setInterval(loadPendingDownloads, 5000);
});

// Actualizar la interfaz según si hay configuración o no
function updateUI() {
  chrome.storage.local.get(['apiKey'], function(result) {
    const configSection = document.getElementById('config-section');
    const downloadsSection = document.getElementById('downloads-section');
    
    if (result.apiKey) {
      // Hay configuración: mostrar sección de descargas
      configSection.style.display = 'none';
      downloadsSection.style.display = 'block';
    } else {
      // No hay configuración: mostrar sección de configuración
      configSection.style.display = 'block';
      downloadsSection.style.display = 'none';
    }
  });
}

// Cargar la configuración guardada
function loadSavedConfig() {
  chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });
}

// Guardar la configuración
function saveConfiguration() {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Por favor ingresa una API key válida', 'error');
    return;
  }
  
  // Guardar en el almacenamiento local
  chrome.storage.local.set({
    apiKey: apiKey,
    selectedTeamId: CONFIG.defaultTeamId
  }, function() {
    showStatus('Configuración guardada correctamente', 'success');
    // Actualizar la interfaz
    updateUI();
  });
}

// Verificar conexión con el servidor de manera proactiva
function checkServerConnection() {
  showStatus('Verificando conexión con servidor...', 'info');

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
      connectionSuccess();
    })
    .catch(error => {
      console.warn('Ping falló, intentando con API health:', error);
      tryApiConnection();
    });
  });
}

// Intentar conectar directamente a la API
function tryApiConnection() {
  chrome.storage.local.get(['apiKey'], function(result) {
    const headers = {
      ...CONFIG.fetchOptions.headers,
      'Accept': 'application/json'
    };

    if (result.apiKey) {
      headers['Authorization'] = `Bearer ${result.apiKey}`;
    }

    fetch(`${CONFIG.apiUrl}${CONFIG.endpoints.health}`, {
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
      console.log('API health check exitoso:', data);
      connectionSuccess();
    })
    .catch(error => {
      console.error('Todos los intentos de conexión fallaron:', error);
      connectionFailed(error.message || 'Error de conexión: No se pudo conectar al servidor SoftCheck. Verifica que esté ejecutándose.');
    });
  });
}

// Función para manejar una conexión exitosa
function connectionSuccess() {
  console.log('Conexión establecida correctamente');
  chrome.storage.local.set({ serverConnected: true });
  showStatus('Conexión establecida', 'success');
  
  setTimeout(() => { 
    const statusDiv = document.getElementById('status');
    if (statusDiv) statusDiv.style.display = 'none'; 
  }, 2000);
  
  // Cargar los equipos si estamos en la pantalla de configuración
  if (document.getElementById('config-section') && 
      document.getElementById('config-section').style.display !== 'none') {
    loadTeams();
  }
}

// Función para manejar un fallo de conexión
function connectionFailed(message) {
  console.error('Fallo de conexión al servidor');
  chrome.storage.local.set({ serverConnected: false });
  showStatus(message, 'error');
}

// Cargar y mostrar las descargas pendientes
function loadPendingDownloads() {
  chrome.storage.local.get(['pendingDownloads'], function(result) {
    const pendingDownloads = result.pendingDownloads || [];
    const pendingCount = document.getElementById('pendingCount');
    const downloadsList = document.getElementById('downloads-list');
    
    // Actualizar contador
    if (pendingCount) {
      pendingCount.textContent = pendingDownloads.length;
    }
    
    // Limpiar lista actual
    downloadsList.innerHTML = '';
    
    // Si no hay descargas, mostrar mensaje
    if (pendingDownloads.length === 0) {
      downloadsList.innerHTML = '<div class="no-downloads">No hay descargas pendientes</div>';
      return;
    }
    
    // Obtener el template
    const template = document.getElementById('download-item-template');
    
    // Añadir cada descarga a la lista
    pendingDownloads.forEach((download, index) => {
      // Clonar el template
      const downloadItem = document.importNode(template.content, true);
      
      // Rellenar datos
      downloadItem.querySelector('.download-name').textContent = download.fileName;
      
      // Formato de tamaño y tipo de archivo
      const fileSize = formatFileSize(download.fileSize);
      const fileType = download.mimeType || 'Desconocido';
      
      // Fecha formateada
      const date = new Date(download.timestamp);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      // Origen de la descarga
      const source = download.downloadSource || 'Descarga directa';
      
      downloadItem.querySelector('.download-meta').innerHTML = `
        <div>${fileSize} • ${fileType}</div>
        <div>Origen: ${source}</div>
        <div>${formattedDate}</div>
      `;
      
      // Configurar botón de envío
      const sendButton = downloadItem.querySelector('.send-button');
      sendButton.addEventListener('click', function() {
        sendSoftwareRequest(index);
      });
      
      // Configurar botón de cancelación
      const cancelButton = downloadItem.querySelector('.cancel-button');
      cancelButton.addEventListener('click', function() {
        cancelDownload(index);
      });
      
      // Añadir a la lista
      downloadsList.appendChild(downloadItem);
    });
  });
}

// Enviar una solicitud de software específica
function sendSoftwareRequest(index) {
  chrome.storage.local.get(['apiKey', 'pendingDownloads'], function(result) {
    if (!result.apiKey) {
      showStatus('Configuración incompleta. Verifica tu API key.', 'error');
      return;
    }
    
    const pendingDownloads = result.pendingDownloads || [];
    
    if (index < 0 || index >= pendingDownloads.length) {
      showStatus('Índice de descarga inválido.', 'error');
      return;
    }
    
    const download = pendingDownloads[index];
    showStatus('Enviando solicitud...', 'info');
    
    const requestUrl = CONFIG.apiUrl + CONFIG.endpoints.softwareRequests.replace('{teamId}', CONFIG.defaultTeamId);
    console.log('Enviando solicitud a:', requestUrl);
    
    const requestData = {
      fileName: download.fileName || "NA",
      fileSize: download.fileSize || 0,
      fileUrl: download.fileUrl || "NA",
      downloadSource: download.downloadSource || "NA",
      status: 'pending'
    };
    
    console.log('Datos a enviar:', requestData);
    
    fetch(requestUrl, {
      ...CONFIG.fetchOptions,
      method: 'POST',
      headers: {
        ...CONFIG.fetchOptions.headers,
        'Authorization': `Bearer ${result.apiKey}`
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
    })
    .then(data => {
      console.log('Respuesta exitosa:', data);
      pendingDownloads.splice(index, 1);
      
      chrome.storage.local.set({ pendingDownloads: pendingDownloads }, function() {
        showStatus('Solicitud enviada correctamente', 'success');
        loadPendingDownloads();
      });
    })
    .catch(error => {
      console.error('Error al enviar solicitud:', error);
      showStatus(`Error: ${error.message || 'Error al enviar la solicitud'}`, 'error');
    });
  });
}

// Enviar todas las descargas pendientes
function sendAllDownloads() {
  chrome.storage.local.get(['apiKey', 'selectedTeamId', 'pendingDownloads'], function(result) {
    if (!result.apiKey || !result.selectedTeamId) {
      showStatus('Configuración incompleta. Verifica tu API key y equipo.', 'error');
      return;
    }
    
    const pendingDownloads = result.pendingDownloads || [];
    
    if (pendingDownloads.length === 0) {
      showStatus('No hay descargas pendientes para enviar', 'info');
      return;
    }
    
    // Enviar mensaje al background script
    chrome.runtime.sendMessage({
      action: 'checkDownloads',
      teamId: result.selectedTeamId
    }, function(response) {
      if (response && response.success) {
        showStatus(`Se enviaron ${response.sentCount} descargas para aprobación`, 'success');
        loadPendingDownloads();
      } else {
        showStatus(response?.error || 'Error al enviar solicitudes', 'error');
      }
    });
  });
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Mostrar mensajes de estado
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status';
  statusDiv.classList.add(type);
  statusDiv.style.display = 'block';
  
  // Auto-ocultar mensajes de éxito después de 5 segundos
  if (type === 'success') {
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
  }
}

// Función para cancelar una descarga
function cancelDownload(index) {
  chrome.storage.local.get(['pendingDownloads'], function(result) {
    const pendingDownloads = result.pendingDownloads || [];
    
    if (index < 0 || index >= pendingDownloads.length) {
      showStatus('Índice de descarga inválido.', 'error');
      return;
    }
    
    const download = pendingDownloads[index];
    pendingDownloads.splice(index, 1);
    
    chrome.storage.local.set({ pendingDownloads: pendingDownloads }, function() {
      showStatus(`Se canceló la descarga: ${download.fileName}`, 'success');
      loadPendingDownloads();
    });
  });
} 