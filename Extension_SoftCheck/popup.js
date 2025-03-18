const CONFIG = {
  // URL base de la API - opciones ampliadas con más puertos y rutas
  apiUrls: [
    'http://localhost:80/api',      // Opción 1: API en puerto estándar HTTP (prioridad)
    'http://localhost/api',         // Opción 2: API sin puerto (default 80)
    'http://127.0.0.1:80/api',      // Opción 3: Usando IP explícita puerto 80
    'http://127.0.0.1/api',         // Opción 4: IP sin puerto (default 80)
    'http://localhost:3000/api',    // Opción 5: API en puerto Next.js desarrollo
    'http://localhost:8000/api',    // Opción 6: Puerto alternativo común
    'http://localhost:4000/api',    // Opción 7: Otro puerto común para APIs
    'http://localhost:5000/api',    // Opción 8: Puerto 5000, común para APIs en Node/Express
    'http://localhost/backend/api', // Opción 9: Subcarpeta backend
    // Opciones basadas en la URL base sin sufijo /api
    'http://localhost:80',          // Opción 10: Raíz del puerto 80
    'http://localhost',             // Opción 11: Raíz sin puerto (default 80)
    'http://localhost:3000',        // Opción 12: Raíz del puerto Next.js
    'http://localhost:8080/api'     // Opción 13: Puerto 8080 común para desarrollo
  ],
  
  // URL activa (se puede cambiar dinámicamente) - ahora puerto 80 por defecto
  apiUrl: 'http://localhost:80/api',
  
  // Endpoints específicos con variantes para probar
  endpoints: {
    ping: '/ping',
    health: '/health',
    // Múltiples posibles rutas para solicitudes de software
    softwareRequestsOptions: [
      '/software-requests',           // Opción estándar (priorizada)
      '/api/software-requests',       // Con prefijo /api explícito
      '/requests',                    // Sin prefijo "software"
      '/api/requests',                // Sin prefijo "software" con /api
      '/software-request',            // Singular
      '/api/software-request',        // Singular con /api
      '/request',                     // Singular sin prefijo
      '/api/request',                 // Singular sin prefijo con /api
      '/softwares',                   // Otra variante
      '/api/softwares'                // Otra variante con /api
    ],
    // El endpoint predeterminado (se actualizará si se encuentra uno que funcione)
    softwareRequests: '/software-requests',
    auth: '/auth/signin'
  },
  
  // ID del equipo para usar en la URL
  // Este valor ahora se usará solo si es necesario, pero se evitará incluirlo en la URL
  defaultTeamId: 'default-team',
  
  // Tiempo de espera para conexiones (en milisegundos)
  connectionTimeout: 5000,
  
  // Opciones por defecto para fetch - configuración reforzada para JSON
  fetchOptions: {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    }
  }
};

// Cuando el documento esté cargado completamente
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOMContentLoaded - Inicializando extensión SoftCheck');
  
  // Depurar la estructura del DOM
  console.log('🔍 Verificando elementos del DOM:');
  console.log('- apiKey input:', !!document.getElementById('apiKey'));
  console.log('- config-section:', !!document.getElementById('config-section'));
  console.log('- downloads-section:', !!document.getElementById('downloads-section'));
  console.log('- downloads-list:', !!document.getElementById('downloads-list'));
  console.log('- pendingCount:', !!document.getElementById('pendingCount'));
  console.log('- status:', !!document.getElementById('status'));
  console.log('- download-item-template:', !!document.getElementById('download-item-template'));
  console.log('- saveConfigBtn:', !!document.getElementById('saveConfigBtn'));
  console.log('- sendAllBtn:', !!document.getElementById('sendAllBtn'));
  console.log('- changeApiKeyBtn:', !!document.getElementById('changeApiKeyBtn'));
  
  // Verificar descargas pendientes directamente
  chrome.storage.local.get(['pendingDownloads'], function(result) {
    console.log('📦 Descargas pendientes en storage:', result.pendingDownloads);
    console.log('📦 Cantidad de descargas:', result.pendingDownloads ? result.pendingDownloads.length : 0);
  });
  
  // Añadir estilos CSS personalizados
  addCustomStyles();
  
  // Primero cargar la configuración guardada
  loadSavedConfig();
  
  // Esperar un momento para asegurar que la configuración se haya cargado
  setTimeout(function() {
    // Actualizar la interfaz según la configuración
    updateUI();
    
    // Actualizar la visualización de la API key
    updateApiKeyDisplay();
    
    // Verificar el estado del servidor con la API key ya cargada
    checkServerConnection();
    
    console.log('🔄 Configurando event listeners...');
    
    // Obtener elementos del DOM
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const sendAllBtn = document.getElementById('sendAllBtn');
    const changeApiKeyBtn = document.getElementById('changeApiKeyBtn');
    
    // Event listeners
    if (saveConfigBtn) {
      console.log('✅ Configurando listener para saveConfigBtn');
      saveConfigBtn.addEventListener('click', saveConfiguration);
    } else {
      console.error('❌ No se encontró el botón saveConfigBtn');
    }
    
    if (sendAllBtn) {
      console.log('✅ Configurando listener para sendAllBtn');
      sendAllBtn.addEventListener('click', sendAllDownloads);
    } else {
      console.error('❌ No se encontró el botón sendAllBtn');
    }
    
    if (changeApiKeyBtn) {
      console.log('✅ Configurando listener para changeApiKeyBtn');
      changeApiKeyBtn.addEventListener('click', showApiKeyChangeDialog);
    } else {
      console.error('❌ No se encontró el botón changeApiKeyBtn');
    }
    
    // Cargar y mostrar las descargas
    console.log('🔄 Cargando descargas pendientes...');
    loadPendingDownloads();
    
    // Actualizar las descargas cada 5 segundos
    console.log('⏱️ Configurando intervalo para actualizar descargas');
    setInterval(loadPendingDownloads, 5000);
  }, 300); // Esperar 300ms para asegurar que la API key se haya guardado
});

// Actualizar la interfaz según si hay configuración o no
function updateUI() {
  console.log('🔄 Actualizando interfaz UI...');
  
  chrome.storage.local.get(['apiKey'], function(result) {
    const configSection = document.getElementById('config-section');
    const downloadsSection = document.getElementById('downloads-section');
    
    if (!configSection || !downloadsSection) {
      console.error('❌ ERROR: No se encontraron secciones principales del DOM');
      return;
    }
    
    console.log('🔑 API Key presente:', !!result.apiKey);
    
    if (result.apiKey) {
      // Hay configuración: mostrar sección de descargas
      configSection.style.display = 'none';
      downloadsSection.style.display = 'block';
      
      console.log('🔄 Mostrando sección de descargas');
      
      // Asegurarnos de que existe el botón de cambio de API key
      let apiKeyButton = document.getElementById('changeApiKeyBtn');
      
      if (!apiKeyButton) {
        console.log('🔄 Creando botón de cambio de API Key');
        // Crear el contenedor de acciones si no existe
        let actionsContainer = document.getElementById('actions-container');
        if (!actionsContainer) {
          actionsContainer = document.createElement('div');
          actionsContainer.id = 'actions-container';
          actionsContainer.className = 'actions-bar';
          
          // Insertarlo al principio de la sección de descargas
          downloadsSection.insertBefore(actionsContainer, downloadsSection.firstChild);
        }
        
        // Crear el botón
        apiKeyButton = document.createElement('button');
        apiKeyButton.id = 'changeApiKeyBtn';
        apiKeyButton.className = 'secondary-button';
        apiKeyButton.innerHTML = '<i class="fas fa-key"></i> Cambiar API Key';
        
        // Añadir el botón al contenedor
        actionsContainer.appendChild(apiKeyButton);
        
        // Configurar evento
        apiKeyButton.addEventListener('click', showApiKeyChangeDialog);
        console.log('✅ Evento click configurado para el botón changeApiKeyBtn creado dinámicamente');
      } else {
        // Si el botón ya existe, asegurarse de que tenga el evento click
        console.log('🔄 El botón changeApiKeyBtn ya existe, asegurando el evento click');
        apiKeyButton.addEventListener('click', showApiKeyChangeDialog);
      }
      
      // Mostrar la API key actual (parcialmente)
      let currentApiKeyDisplay = document.getElementById('currentApiKeyDisplay');
      if (!currentApiKeyDisplay) {
        currentApiKeyDisplay = document.createElement('div');
        currentApiKeyDisplay.id = 'currentApiKeyDisplay';
        currentApiKeyDisplay.className = 'api-key-display';
        
        // Insertar después del botón
        apiKeyButton.parentNode.insertBefore(currentApiKeyDisplay, apiKeyButton.nextSibling);
      }
      
      // Mostrar parte de la API key
      const apiKey = result.apiKey;
      const displayKey = apiKey.length > 8 
        ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) 
        : apiKey;
      currentApiKeyDisplay.textContent = `API Key: ${displayKey}`;
    } else {
      // No hay configuración: mostrar sección de configuración
      configSection.style.display = 'block';
      downloadsSection.style.display = 'none';
      console.log('🔄 Mostrando sección de configuración (no hay API Key)');
    }
  });
}

// Cargar la configuración guardada
function loadSavedConfig() {
  chrome.storage.local.get(['apiKey', 'activeApiUrl', 'workingSoftwareRequestsEndpoint', 'selectedTeam'], function(result) {
    console.log('Configuración cargada:', result);
    
    // Cargar API key si está guardada
    if (result.apiKey) {
      document.getElementById('api-key').value = result.apiKey;
      updateApiKeyDisplay(); // Actualizar la visualización de la API key
      verifyApiKey(result.apiKey, updateApiKeyValidityIndicator); // Verificar la validez
    } else {
      // No establecemos una API key por defecto
      document.getElementById('api-key').placeholder = 'Introduce tu API key';
      updateApiKeyValidityIndicator(false);
    }
    
    // Si hay una URL activa guardada, actualizar CONFIG.apiUrl
    if (result.activeApiUrl) {
      CONFIG.apiUrl = result.activeApiUrl;
      console.log('🔄 Cargada URL activa guardada:', CONFIG.apiUrl);
    }
    
    // Si existe el selector de API URL (puede ser añadido después)
    const apiUrlSelect = document.getElementById('apiUrlSelect');
    if (apiUrlSelect) {
      // Crear opciones para cada URL
      CONFIG.apiUrls.forEach((url, index) => {
        const option = document.createElement('option');
        option.value = url;
        option.textContent = `URL ${index + 1}: ${url}`;
        option.selected = (url === CONFIG.apiUrl);
        apiUrlSelect.appendChild(option);
      });
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
  
  // Validar que la API key tiene un formato válido utilizando la función isValidApiKey
  if (!isValidApiKey(apiKey)) {
    showStatus('El formato de la API key no es válido. Debe tener al menos 8 caracteres y contener solo letras, números, guiones, puntos o guiones bajos.', 'error');
    return;
  }
  
  // Verificar si se seleccionó una URL de API
  let selectedApiUrl = CONFIG.apiUrl;
  const apiUrlSelect = document.getElementById('apiUrlSelect');
  if (apiUrlSelect) {
    selectedApiUrl = apiUrlSelect.value;
    CONFIG.apiUrl = selectedApiUrl;
  }
  
  console.log('🌐 URL de API seleccionada:', selectedApiUrl);
  
  // Guardar en el almacenamiento local
  chrome.storage.local.set({
    apiKey: apiKey,
    activeApiUrl: selectedApiUrl
  }, function() {
    showStatus('Configuración guardada correctamente', 'success');
    // Actualizar la interfaz
    updateUI();
    
    // Verificar la conexión con la URL seleccionada
    testApiUrls(CONFIG.apiUrls.indexOf(selectedApiUrl));
  });
}

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

// Verificar conexión con el servidor
function checkServerConnection() {
  showStatus('Verificando conexión con servidor...', 'info');
  
  console.log('🔄 Comprobando conexión a múltiples URLs posibles:', CONFIG.apiUrls);
  
  // Probar cada URL en secuencia hasta encontrar una que funcione
  testApiUrls();
}

// Función para probar sistemáticamente todas las URLs de API configuradas
function testApiUrls(currentIndex = 0) {
  if (currentIndex >= CONFIG.apiUrls.length) {
    console.error('❌ Ninguna URL de API funcionó. Verifica la configuración del servidor.');
    connectionFailed('No se pudo conectar al servidor API. Verifica que el servidor API esté en ejecución en la URL correcta.');
    return;
  }
  
  // Obtener la URL actual para probar
  const currentUrl = CONFIG.apiUrls[currentIndex];
  const pingUrl = `${currentUrl}${CONFIG.endpoints.ping}`;
  
  console.log(`🔄 Probando URL #${currentIndex + 1}/${CONFIG.apiUrls.length}: ${pingUrl}`);
  
  // Encabezados explícitos para forzar respuesta JSON
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  
  // Opciones específicas para solicitud de prueba
  fetch(pingUrl, {
    method: 'GET',
    headers: headers,
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    redirect: 'follow'
  })
  .then(async response => {
    console.log(`📩 Respuesta de ${pingUrl} - Status:`, response.status);
    console.log(`📩 Tipo de contenido:`, response.headers.get('content-type'));
    
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    
    console.log(`📩 Respuesta de ${pingUrl}:`, text);
    
    // Verificar si recibimos HTML en lugar de la respuesta esperada
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || 
        contentType.includes('text/html')) {
      console.warn(`⚠️ La URL ${pingUrl} devolvió HTML en lugar de API JSON`);
      throw new Error('Respuesta HTML recibida - Esta URL apunta a la aplicación web, no a la API');
    }
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${text || response.statusText}`);
    }
    
    // Si llegamos aquí, la URL funciona
    console.log(`✅ Conexión exitosa a ${pingUrl}:`, text);
    
    // Guardar esta URL como la activa
    CONFIG.apiUrl = currentUrl;
    chrome.storage.local.set({ 
      serverConnected: true,
      activeApiUrl: currentUrl
    });
    
    console.log('✅ URL de API válida encontrada y guardada:', currentUrl);
    connectionSuccess();
    
    // Intentar health check ahora que tenemos una URL válida
    tryApiConnection();
  })
  .catch(error => {
    console.warn(`❌ Error al probar ${pingUrl}:`, error);
    // Probar con la siguiente URL
    testApiUrls(currentIndex + 1);
  });
}

// Intentar conectar directamente a la API
function tryApiConnection() {
  chrome.storage.local.get(['apiKey', 'activeApiUrl'], function(result) {
    // Si no hay API key, mostrar mensaje y salir
    if (!result.apiKey) {
      console.warn('⚠️ No hay API key disponible para el health check.');
      connectionFailed('No hay API key configurada. Por favor, configura una API key para continuar.');
      return;
    }
    
    // Crear encabezados explícitos para API
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    };

    // Incluir la API key en los encabezados
    headers['X-API-Key'] = result.apiKey;
    console.log('🔑 Incluyendo API key en el health check:', result.apiKey.substring(0, 3) + '...');
    
    // Usar la URL que funcionó previamente si está disponible
    const baseUrl = result.activeApiUrl || CONFIG.apiUrl;
    const healthUrl = `${baseUrl}${CONFIG.endpoints.health}`;
    
    console.log('🔍 Intentando health check en:', healthUrl);
    console.log('🔤 Usando encabezados:', headers);
    
    fetch(healthUrl, {
      method: 'GET',
      headers: headers,
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'follow'
    })
    .then(async response => {
      console.log('📩 Health check status:', response.status);
      console.log('📩 Tipo de contenido:', response.headers.get('content-type'));
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      
      console.log('📩 Respuesta de health check:', text);
      
      // Verificar si recibimos una página HTML en lugar de la respuesta esperada
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || 
          contentType.includes('text/html')) {
        console.error('❌ Se recibió una página HTML en lugar de JSON');
        
        // Intentar otra URL
        const currentIndex = CONFIG.apiUrls.indexOf(baseUrl);
        if (currentIndex !== -1 && currentIndex + 1 < CONFIG.apiUrls.length) {
          console.log('🔄 Cambiando a la siguiente URL y reintentando...');
          testApiUrls(currentIndex + 1);
          return;
        }
        
        throw new Error('Endpoint incorrecto o servidor no está ejecutando la API correcta');
      }
      
      if (!response.ok) {
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
        } catch (e) {
          if (e.message.includes('Unexpected token')) {
            throw new Error(`Error ${response.status}: Respuesta no válida del servidor`);
          }
          throw new Error(`Error ${response.status}: ${text || response.statusText}`);
        }
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Error parsing JSON response:', e, 'Response was:', text);
        throw new Error('Respuesta del servidor no es JSON válido');
      }
      
      console.log('✅ API health check exitoso:', data);
      connectionSuccess();
    })
    .catch(error => {
      console.error('❌ Todos los intentos de conexión fallaron:', error);
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
  console.log('🔄 loadPendingDownloads() llamada');
  
  chrome.storage.local.get(['pendingDownloads'], function(result) {
    console.log('📦 Datos recuperados de storage:', result);
    
    const pendingDownloads = result.pendingDownloads || [];
    console.log('📦 Cantidad de descargas:', pendingDownloads.length);
    
    const pendingCount = document.getElementById('pendingCount');
    const downloadsList = document.getElementById('downloads-list');
    
    if (!downloadsList) {
      console.error('❌ ERROR: No se encontró el elemento downloads-list en el DOM');
      return;
    }
    
    // Actualizar contador - solo contar las que están en estado pendiente
    const truePendingCount = pendingDownloads.filter(d => d.status === 'pending').length;
    console.log('📊 Descargas realmente pendientes:', truePendingCount);
    
    if (pendingCount) {
      pendingCount.textContent = truePendingCount;
    } else {
      console.error('❌ ERROR: No se encontró el elemento pendingCount');
    }
    
    // Limpiar lista actual
    downloadsList.innerHTML = '';
    
    // Si no hay descargas, mostrar mensaje
    if (pendingDownloads.length === 0) {
      console.log('📭 No hay descargas pendientes, mostrando mensaje');
      downloadsList.innerHTML = '<div class="no-downloads"><i class="fas fa-info-circle"></i> No hay descargas pendientes</div>';
      return;
    }
    
    // Obtener el template
    const template = document.getElementById('download-item-template');
    if (!template) {
      console.error('❌ ERROR: No se encontró el template download-item-template');
      return;
    }
    
    console.log('🔄 Agregando descargas a la lista...');
    
    // Añadir cada descarga a la lista
    pendingDownloads.forEach((download, index) => {
      console.log(`📥 Procesando descarga ${index}:`, download);
      
      // Clonar el template
      const downloadItem = document.importNode(template.content, true);
      
      // Asegurarse de que los elementos existen
      const nameElement = downloadItem.querySelector('.download-name');
      const metaElement = downloadItem.querySelector('.download-meta');
      
      if (!nameElement || !metaElement) {
        console.error('❌ ERROR: No se encontraron elementos esenciales en el template');
        return;
      }
      
      // Rellenar datos
      nameElement.textContent = download.fileName;
      
      // Formato de tamaño y tipo de archivo
      const fileSize = formatFileSize(download.fileSize);
      const fileType = download.mimeType || 'Desconocido';
      
      // Fecha formateada
      const date = new Date(download.timestamp);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      // Origen de la descarga
      const source = download.downloadSource || 'Descarga directa';
      
      // Estado formateado
      let statusText = 'Pendiente';
      let statusClass = 'status-pending';
      
      if (download.status === 'sent') {
        statusText = 'Enviado - Pendiente de aprobación';
        statusClass = 'status-sent';
        
        // Añadir fecha de envío si está disponible
        if (download.sentAt) {
          const sentDate = new Date(download.sentAt);
          statusText += ` (${sentDate.toLocaleDateString()} ${sentDate.toLocaleTimeString()})`;
        }
      } else if (download.status === 'approved') {
        statusText = download.autoProcessed ? 'Aprobado Automáticamente' : 'Aprobado';
        statusClass = 'status-approved';
        
        // Añadir información adicional si está disponible
        if (download.statusNotes) {
          statusText += ` - ${download.statusNotes}`;
        }
      } else if (download.status === 'rejected') {
        statusText = download.autoProcessed ? 'Rechazado Automáticamente' : 'Rechazado';
        statusClass = 'status-rejected';
        
        // Añadir información adicional si está disponible
        if (download.statusNotes) {
          statusText += ` - ${download.statusNotes}`;
        }
      }
      
      metaElement.innerHTML = `
        <div><i class="fas fa-hdd"></i> ${fileSize} • <i class="fas fa-file"></i> ${fileType}</div>
        <div><i class="fas fa-link"></i> Origen: ${source}</div>
        <div><i class="fas fa-calendar"></i> ${formattedDate}</div>
        <div class="${statusClass}"><i class="fas fa-${download.status === 'sent' ? 'paper-plane' : 'clock'}"></i> Estado: ${statusText}</div>
      `;
      
      // Configurar botón de envío - deshabilitarlo si ya fue enviado
      const sendButton = downloadItem.querySelector('.send-button');
      if (!sendButton) {
        console.error('❌ ERROR: No se encontró el botón send-button en el template');
      } else {
        if (download.status === 'sent') {
          sendButton.innerHTML = '<i class="fas fa-check"></i> Enviado';
          sendButton.disabled = true;
          sendButton.classList.add('disabled');
        } else {
          sendButton.addEventListener('click', function() {
            sendSoftwareRequest(index);
          });
        }
      }
      
      // Configurar botón de cancelación - cambiar texto si fue enviado
      const cancelButton = downloadItem.querySelector('.cancel-button');
      if (!cancelButton) {
        console.error('❌ ERROR: No se encontró el botón cancel-button en el template');
      } else {
        if (download.status === 'sent') {
          cancelButton.innerHTML = '<i class="fas fa-trash"></i> Cancelar solicitud';
        }
        cancelButton.addEventListener('click', function() {
          cancelDownload(index);
        });
      }
      
      // Añadir a la lista
      downloadsList.appendChild(downloadItem);
    });
    
    console.log('✅ Finalizada la adición de descargas a la lista');
  });
}

// Enviar una solicitud de software específica
function sendSoftwareRequest(index) {
  chrome.storage.local.get(['apiKey', 'pendingDownloads', 'activeApiUrl'], function(result) {
    if (!result.apiKey) {
      showStatus('Configuración incompleta. Verifica tu API key.', 'error');
      return;
    }
    
    console.log('🔑 API Key utilizada:', result.apiKey);
    console.log('💾 Longitud de API Key:', result.apiKey.length);
    
    // Verificar la API key antes de continuar
    verifyApiKey(result.apiKey, function(isValid, message) {
      if (!isValid) {
        showStatus(`Error de autenticación: ${message}`, 'error');
        return;
      }
      
      const pendingDownloads = result.pendingDownloads || [];
      
      if (index < 0 || index >= pendingDownloads.length) {
        showStatus('Índice de descarga inválido.', 'error');
        return;
      }
      
      const download = pendingDownloads[index];
      
      // No enviar si ya fue enviada previamente
      if (download.status === 'sent') {
        showStatus('Esta solicitud ya fue enviada y está pendiente de aprobación', 'info');
        return;
      }
      
      showStatus('Verificando endpoint de solicitudes...', 'info');
      
      // Usar la URL verificada que está almacenada
      const baseUrl = result.activeApiUrl || CONFIG.apiUrl;
      
      // Primero buscar el endpoint correcto
      findWorkingSoftwareRequestsEndpoint(baseUrl, result.apiKey, download, function(endpointFound) {
        if (!endpointFound) {
          showStatus('No se encontró un endpoint válido para solicitudes. Verifica la configuración del servidor.', 'error');
          return;
        }
        
        showStatus('Enviando solicitud...', 'info');
        
        // Construir la URL con el endpoint encontrado
        const requestUrl = `${baseUrl}${CONFIG.endpoints.softwareRequests}`;
        
        console.log('📤 Enviando solicitud a:', requestUrl);
        
        const requestData = {
          fileName: download.fileName || "NA",
          fileSize: download.fileSize || 0,
          fileUrl: download.fileUrl || "NA",
          downloadSource: download.downloadSource || "NA",
          status: 'pending',
          notes: `Descarga detectada automáticamente por la extensión SoftCheck`
          // No incluimos el teamId, ya que el backend lo determinará basado en la API key
        };
        
        console.log('📦 Datos a enviar:', requestData);
        
        // Serializar a JSON explícitamente
        const jsonData = JSON.stringify(requestData);
        console.log('📝 JSON a enviar:', jsonData);
        
        // Crear los encabezados de manera explícita con la API key
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': result.apiKey,
          'X-Requested-With': 'XMLHttpRequest',
          // Intenta evitar la caché y forzar el servidor a tratar la solicitud como API
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        };
        
        console.log('🔤 Encabezados de solicitud:', headers);
        
        // Enviar la solicitud al endpoint de API con opciones explícitas
        fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'same-origin',
          redirect: 'follow',
          body: jsonData
        })
        .then(async response => {
          console.log('📩 Respuesta recibida. Status:', response.status);
          console.log('📩 Tipo de contenido:', response.headers.get('content-type'));
          
          const contentType = response.headers.get('content-type') || '';
          const text = await response.text();
          
          console.log('📩 Respuesta como texto:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
          
          // Detectar específicamente respuestas HTML
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || 
              contentType.includes('text/html')) {
            console.error('❌ Se recibió una respuesta HTML en lugar de JSON');
            
            // Extraer título de la página HTML si es posible
            const titleMatch = text.match(/<title>(.*?)<\/title>/i);
            const errorTitle = titleMatch ? titleMatch[1] : 'Página HTML recibida';
            
            // Intentar otra URL
            console.log('🔄 Recibimos HTML, intentando con otra URL de API...');
            
            // Probar la siguiente URL en la lista
            const currentIndex = CONFIG.apiUrls.indexOf(baseUrl);
            if (currentIndex !== -1 && currentIndex + 1 < CONFIG.apiUrls.length) {
              // Guardar la siguiente URL para intentar
              const nextUrl = CONFIG.apiUrls[currentIndex + 1];
              chrome.storage.local.set({ 
                activeApiUrl: nextUrl,
                // Borrar el endpoint encontrado para obligar a buscar uno nuevo con la nueva URL
                workingSoftwareRequestsEndpoint: null
              }, function() {
                console.log('🔄 Cambiando a la siguiente URL de API:', nextUrl);
                showStatus(`Reintentando con otra URL de API...`, 'info');
                // Reintentar con la nueva URL
                setTimeout(() => sendSoftwareRequest(index), 500);
              });
              return null; // No continuar con esta respuesta
            }
            
            throw new Error(`URL incorrecta: Se recibió ${errorTitle}. Necesitas configurar la URL correcta de la API.`);
          }
          
          if (!response.ok) {
            try {
              const errorData = JSON.parse(text);
              console.error('❌ Error en formato JSON:', errorData);
              throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
            } catch (e) {
              console.error('❌ Error al analizar respuesta:', e);
              if (e.message.includes('Unexpected token')) {
                throw new Error(`Error ${response.status}: Respuesta no válida del servidor. Verifica que la API esté disponible.`);
              }
              throw new Error(`Error ${response.status}: ${text || response.statusText}`);
            }
          }
          
          let data;
          try {
            data = JSON.parse(text);
            return data;
          } catch (e) {
            console.error('Error parsing JSON response:', e, 'Response was:', text);
            throw new Error('Respuesta del servidor no es JSON válido. Verifica que estés conectando al endpoint correcto.');
          }
        })
        .then(data => {
          // Si recibimos null, es porque estamos reintentando con otra URL
          if (data === null) return;
          
          console.log('📥 Respuesta exitosa:', data);
          
          // Actualizar estado de la descarga a "sent" en lugar de eliminarla
          const updatedDownloads = [...pendingDownloads];
          updatedDownloads[index] = {
            ...updatedDownloads[index],
            status: 'sent',
            serverRequestId: data.id || null,
            teamId: data.teamId || null, // Guardar el teamId devuelto por el servidor
            sentAt: new Date().toISOString()
          };
          
          chrome.storage.local.set({ pendingDownloads: updatedDownloads }, function() {
            showStatus('Solicitud enviada correctamente. Estado: Pendiente de aprobación', 'success');
            loadPendingDownloads();
          });
        })
        .catch(error => {
          console.error('❌ Error al enviar solicitud:', error);
          showStatus(`Error: ${error.message || 'Error al enviar la solicitud'}`, 'error');
        });
      });
    });
  });
}

// Enviar todas las descargas pendientes
function sendAllDownloads() {
  chrome.storage.local.get(['apiKey', 'pendingDownloads', 'activeApiUrl'], function(result) {
    if (!result.apiKey) {
      showStatus('Configuración incompleta. Verifica tu API key.', 'error');
      return;
    }
    
    // Verificar la API key antes de continuar
    verifyApiKey(result.apiKey, function(isValid, message) {
      if (!isValid) {
        showStatus(`Error de autenticación: ${message}`, 'error');
        return;
      }
      
      const pendingDownloads = result.pendingDownloads || [];
      
      if (pendingDownloads.length === 0) {
        showStatus('No hay descargas pendientes para enviar', 'info');
        return;
      }
      
      // Obtener la URL base activa
      const baseUrl = result.activeApiUrl || CONFIG.apiUrl;
      
      // Mostrar estado de búsqueda de endpoint
      showStatus('Verificando endpoint de solicitudes...', 'info');
      
      // Buscar el endpoint correcto primero
      findWorkingSoftwareRequestsEndpoint(baseUrl, result.apiKey, null, function(endpointFound) {
        if (!endpointFound) {
          showStatus('No se encontró un endpoint válido para solicitudes. Verifica la configuración del servidor.', 'error');
          return;
        }
        
        // Ahora enviar el mensaje al background script con la información actualizada del endpoint
        chrome.runtime.sendMessage({
          action: 'checkDownloads',
          apiKey: result.apiKey,
          softwareRequestsEndpoint: CONFIG.endpoints.softwareRequests // Pasar el endpoint encontrado
        }, function(response) {
          if (response && response.success) {
            showStatus(`Se enviaron ${response.sentCount} descargas para aprobación`, 'success');
            loadPendingDownloads();
          } else {
            showStatus(response?.error || 'Error al enviar solicitudes', 'error');
          }
        });
      });
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
  chrome.storage.local.get(['pendingDownloads', 'apiKey', 'activeApiUrl'], function(result) {
    if (!result.apiKey) {
      showStatus('Configuración incompleta. Verifica tu API key.', 'error');
      return;
    }
    
    // Verificar la API key antes de continuar si la descarga ya fue enviada
    const pendingDownloads = result.pendingDownloads || [];
    
    if (index < 0 || index >= pendingDownloads.length) {
      showStatus('Índice de descarga inválido.', 'error');
      return;
    }
    
    const download = pendingDownloads[index];
    
    // Si la descarga ya fue enviada, tenemos que cancelarla en el servidor
    if (download.status === 'sent' && download.serverRequestId) {
      // En este caso necesitamos verificar la API key
      verifyApiKey(result.apiKey, function(isValid, message) {
        if (!isValid) {
          showStatus(`Error de autenticación: ${message}`, 'error');
          return;
        }
        
        showStatus('Cancelando solicitud en el servidor...', 'info');
        
        // Usar la URL activa guardada
        const baseUrl = result.activeApiUrl || CONFIG.apiUrl;
        
        // Construir la URL de cancelación (endpoint directo sin teamId)
        const cancelUrl = `${baseUrl}/software-requests/${download.serverRequestId}`;
        
        console.log('🔄 Cancelando solicitud en:', cancelUrl);
        
        fetch(cancelUrl, {
          ...CONFIG.fetchOptions,
          method: 'DELETE',
          headers: {
            ...CONFIG.fetchOptions.headers,
            'X-API-Key': result.apiKey
          }
        })
        .then(async response => {
          const text = await response.text();
          console.log(`Respuesta cancelación: ${text}`);
          
          // Verificar si recibimos HTML
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            console.error('❌ Se recibió una página HTML en lugar de JSON');
            throw new Error('URL incorrecta: Estás recibiendo una página web en lugar de la API');
          }
          
          if (!response.ok) {
            try {
              const errorData = JSON.parse(text);
              // Si el error indica que el software no existe o no está autorizado,
              // eliminamos la entrada localmente en vez de mostrar error
              if (text.includes('no encontrado') || 
                  text.includes('not found') || 
                  text.includes('no autorizado') ||
                  text.includes('unauthorized') || 
                  response.status === 404) {
                console.log('⚠️ Software no encontrado en la base de datos, eliminando entrada local');
                // Eliminar la descarga del almacenamiento local
                pendingDownloads.splice(index, 1);
                chrome.storage.local.set({ pendingDownloads }, function() {
                  showStatus('Solicitud eliminada localmente', 'success');
                  loadPendingDownloads();
                });
                return; // Salimos para evitar el throw
              }
              throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Error al parsear JSON - probablemente no es un error de formato JSON
                // Si es un 404 o similar, también eliminar localmente
                if (response.status === 404 || response.status === 403 || response.status === 401) {
                  console.log('⚠️ Error de autorización o recurso no encontrado, eliminando entrada local');
                  pendingDownloads.splice(index, 1);
                  chrome.storage.local.set({ pendingDownloads }, function() {
                    showStatus('Solicitud eliminada localmente', 'success');
                    loadPendingDownloads();
                  });
                  return;
                }
              }
              
              if (text.includes('<!DOCTYPE html>')) {
                throw new Error(`Error ${response.status}: Endpoint no encontrado`);
              }
              throw new Error(`Error ${response.status}: ${text || response.statusText}`);
            }
          }
          
          // Eliminar la descarga del almacenamiento local
          pendingDownloads.splice(index, 1);
          chrome.storage.local.set({ pendingDownloads }, function() {
            showStatus('Solicitud cancelada correctamente', 'success');
            loadPendingDownloads();
          });
        })
        .catch(error => {
          console.error('Error al cancelar solicitud:', error);
          
          // Si el mensaje de error indica que el software no existe o no autorizado,
          // eliminamos la entrada localmente en vez de mostrar error
          if (error.message.includes('no encontrado') || 
              error.message.includes('not found') || 
              error.message.includes('no autorizado') ||
              error.message.includes('unauthorized')) {
            console.log('⚠️ Software no encontrado o no autorizado, eliminando entrada local');
            // Eliminar la descarga del almacenamiento local
            pendingDownloads.splice(index, 1);
            chrome.storage.local.set({ pendingDownloads }, function() {
              showStatus('Solicitud eliminada localmente', 'success');
              loadPendingDownloads();
            });
          } else {
            showStatus(`Error: ${error.message || 'Error al cancelar la solicitud'}`, 'error');
          }
        });
      });
    } else {
      // Si no fue enviada, simplemente eliminarla del almacenamiento local
      pendingDownloads.splice(index, 1);
      
      chrome.storage.local.set({ pendingDownloads: pendingDownloads }, function() {
        showStatus(`Se canceló la descarga: ${download.fileName}`, 'success');
        loadPendingDownloads();
      });
    }
  });
}

function loadTeams() {
  console.log('Función loadTeams() implementada');
  // Esta función ya no es necesaria porque el backend determina 
  // el equipo a partir de la API key
  return Promise.resolve();
}

// Función para probar distintos endpoints de software-requests
function findWorkingSoftwareRequestsEndpoint(baseUrl, apiKey, testData, callback) {
  console.log('🔍 Buscando endpoint de software-requests que funcione...');
  
  // Si ya se ha determinado previamente, usar ese
  chrome.storage.local.get(['workingSoftwareRequestsEndpoint'], function(result) {
    if (result.workingSoftwareRequestsEndpoint) {
      console.log('✅ Usando endpoint guardado previamente:', result.workingSoftwareRequestsEndpoint);
      CONFIG.endpoints.softwareRequests = result.workingSoftwareRequestsEndpoint;
      callback(true);
      return;
    }
    
    // Datos de prueba simplificados
    const sampleData = testData || {
      fileName: "test-file.txt",
      fileSize: 1024,
      fileUrl: "https://example.com/test.txt",
      downloadSource: "Test",
      status: "pending",
      notes: "Prueba para encontrar endpoint válido"
    };
    
    // Función para probar cada endpoint secuencialmente
    function tryEndpoint(index) {
      if (index >= CONFIG.endpoints.softwareRequestsOptions.length) {
        console.error('❌ No se encontró ningún endpoint válido para software-requests');
        callback(false);
        return;
      }
      
      const currentEndpoint = CONFIG.endpoints.softwareRequestsOptions[index];
      // Construir la URL sin incluir el ID del equipo en la ruta
      const fullUrl = `${baseUrl}${currentEndpoint}`;
      
      console.log(`🔄 Probando endpoint ${index + 1}/${CONFIG.endpoints.softwareRequestsOptions.length}: ${fullUrl}`);
      
      // Crear encabezados para la prueba
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
      
      // Modificar los datos de prueba, no necesitamos incluir el teamId
      const requestData = {
        ...sampleData
        // Ya no incluimos el teamId porque el backend lo determinará basado en la API key
      };
      
      console.log(`📤 Enviando datos de prueba:`, requestData);
      
      // Enviar una solicitud de prueba
      fetch(fullUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestData),
        mode: 'cors',
        cache: 'no-cache'
      })
      .then(async response => {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        
        console.log(`📩 Respuesta de ${fullUrl} - Status:`, response.status);
        console.log(`📩 Tipo de contenido:`, contentType);
        console.log(`📩 Respuesta de prueba:`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        // Verificar si recibimos HTML
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || 
            contentType.includes('text/html')) {
          console.warn(`⚠️ Endpoint ${fullUrl} devolvió HTML en lugar de JSON`);
          throw new Error('Respuesta HTML recibida');
        }
        
        // Incluso si recibimos un error, si es JSON, el endpoint existe pero puede necesitar datos correctos
        try {
          // Intentar analizar como JSON
          JSON.parse(text);
          
          // Si llegamos aquí, el endpoint existe y devuelve JSON (incluso si es un error)
          console.log(`✅ Encontrado endpoint válido: ${currentEndpoint}`);
          CONFIG.endpoints.softwareRequests = currentEndpoint;
          
          // Guardar para futuras referencias
          chrome.storage.local.set({ workingSoftwareRequestsEndpoint: currentEndpoint });
          
          callback(true);
          return;
        } catch (e) {
          // No es JSON, intentar siguiente endpoint
          console.warn(`⚠️ Endpoint ${fullUrl} no devolvió JSON válido:`, e.message);
          throw new Error('Respuesta no es JSON válido');
        }
      })
      .catch(error => {
        console.warn(`❌ Error con endpoint ${fullUrl}:`, error.message);
        // Probar con el siguiente endpoint
        tryEndpoint(index + 1);
      });
    }
    
    // Comenzar con el primer endpoint
    tryEndpoint(0);
  });
}

// Verificar si la API key es válida
function isValidApiKey(apiKey) {
  // Una API key válida debe tener al menos 8 caracteres
  return apiKey && apiKey.length >= 8;
}

// Función para mostrar u ocultar el indicador de API key válida
function updateApiKeyValidityIndicator(isValid) {
  let indicator = document.getElementById('apiKeyValidIndicator');
  
  // Si no existe el indicador, crearlo
  if (!indicator) {
    const apiKeyInput = document.getElementById('apiKey');
    indicator = document.createElement('span');
    indicator.id = 'apiKeyValidIndicator';
    indicator.style.marginLeft = '10px';
    indicator.style.fontWeight = 'bold';
    
    if (apiKeyInput && apiKeyInput.parentNode) {
      apiKeyInput.parentNode.insertBefore(indicator, apiKeyInput.nextSibling);
    }
  }
  
  // Actualizar el indicador
  if (isValid) {
    indicator.textContent = '✅ API key válida';
    indicator.style.color = 'green';
  } else {
    indicator.textContent = '❌ API key no válida';
    indicator.style.color = 'red';
  }
}

// Añadir un listener para validar la API key mientras se escribe
document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', function() {
      const currentValue = apiKeyInput.value.trim();
      updateApiKeyValidityIndicator(isValidApiKey(currentValue));
    });
  }
});

// Función para actualizar la visualización de la API key actual
function updateApiKeyDisplay() {
  chrome.storage.local.get(['apiKey'], function(result) {
    const apiKey = result.apiKey;
    
    if (apiKey) {
      let currentApiKeyDisplay = document.getElementById('currentApiKeyDisplay');
      
      if (currentApiKeyDisplay) {
        // Mostrar parte de la API key por seguridad
        const displayKey = apiKey.length > 8 
          ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) 
          : apiKey;
        currentApiKeyDisplay.textContent = `API Key: ${displayKey}`;
      }
    }
  });
}

// Función para mostrar un diálogo de cambio de API key
function showApiKeyChangeDialog() {
  console.log('🔍 Función showApiKeyChangeDialog() llamada');
  
  // Ocultar sección de descargas temporalmente
  const downloadsSection = document.getElementById('downloads-section');
  downloadsSection.style.display = 'none';
  
  // Crear el diálogo si no existe
  let dialog = document.getElementById('apiKeyChangeDialog');
  
  if (!dialog) {
    console.log('🔄 Creando nuevo diálogo para cambio de API Key');
    dialog = document.createElement('div');
    dialog.id = 'apiKeyChangeDialog';
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h2>Cambiar API Key</h2>
        <p>Introduce una nueva API key para la extensión:</p>
        <div class="form-group">
          <label for="newApiKey">API Key:</label>
          <input type="text" id="newApiKey" class="input" placeholder="Ingresa tu API key">
          <div id="newApiKeyValidIndicator" style="margin-top: 8px;"></div>
        </div>
        <div class="button-group">
          <button id="saveNewApiKeyBtn" class="primary-button">Guardar</button>
          <button id="cancelApiKeyChangeBtn" class="secondary-button">Cancelar</button>
        </div>
      </div>
    `;
    
    // Añadir al body
    document.body.appendChild(dialog);
    
    console.log('✅ Diálogo de cambio de API Key creado y añadido al DOM');
  } else {
    console.log('🔄 Reutilizando diálogo existente para cambio de API Key');
    // Reset del campo si el diálogo ya existe
    const newApiKeyInput = document.getElementById('newApiKey');
    if (newApiKeyInput) {
      newApiKeyInput.value = '';
    }
    const indicator = document.getElementById('newApiKeyValidIndicator');
    if (indicator) {
      indicator.textContent = '';
    }
  }
  
  // Mostrar el diálogo
  dialog.style.display = 'block';
  console.log('🔍 Diálogo de cambio de API Key mostrado');
  
  // Configurar eventos (asegurarnos de añadirlos cada vez)
  const newApiKeyInput = document.getElementById('newApiKey');
  const saveNewApiKeyBtn = document.getElementById('saveNewApiKeyBtn');
  const cancelApiKeyChangeBtn = document.getElementById('cancelApiKeyChangeBtn');
  
  // Verificar que se encontraron todos los elementos
  if (!newApiKeyInput || !saveNewApiKeyBtn || !cancelApiKeyChangeBtn) {
    console.error('❌ No se encontraron todos los elementos del diálogo');
    return;
  }
  
  // Remover eventos anteriores (evitar duplicación)
  newApiKeyInput.removeEventListener('input', validateNewApiKey);
  saveNewApiKeyBtn.removeEventListener('click', saveNewApiKey);
  cancelApiKeyChangeBtn.removeEventListener('click', cancelApiKeyChange);
  
  // Función para validar la API key
  function validateNewApiKey() {
    const currentValue = newApiKeyInput.value.trim();
    
    // Actualizar indicador de validez
    const indicator = document.getElementById('newApiKeyValidIndicator');
    if (isValidApiKey(currentValue)) {
      // Determinar si es de prueba o real
      const testApiKeys = ['test-api-key', 'dev-key', 'extension-key'];
      const isTestKey = testApiKeys.includes(currentValue);
      
      indicator.textContent = isTestKey 
        ? '✅ API key de prueba válida' 
        : '✅ Formato de API key válido';
      indicator.style.color = 'green';
      saveNewApiKeyBtn.disabled = false;
    } else {
      indicator.textContent = '❌ Formato de API key no válido';
      indicator.style.color = 'red';
      saveNewApiKeyBtn.disabled = true;
    }
  }
  
  // Función para guardar la nueva API key
  function saveNewApiKey() {
    const newApiKey = newApiKeyInput.value.trim();
    
    if (isValidApiKey(newApiKey)) {
      chrome.storage.local.set({ apiKey: newApiKey }, function() {
        showStatus('API key actualizada correctamente', 'success');
        dialog.style.display = 'none';
        downloadsSection.style.display = 'block';
        
        // Actualizar la visualización de la API key
        updateApiKeyDisplay();
        
        // Verificar conexión con la nueva API key
        checkServerConnection();
      });
    } else {
      showStatus('Formato de API key no válido', 'error');
    }
  }
  
  // Función para cancelar el cambio
  function cancelApiKeyChange() {
    dialog.style.display = 'none';
    downloadsSection.style.display = 'block';
    console.log('🔍 Diálogo de cambio de API Key cerrado (cancelado)');
  }
  
  // Añadir eventos
  newApiKeyInput.addEventListener('input', validateNewApiKey);
  saveNewApiKeyBtn.addEventListener('click', saveNewApiKey);
  cancelApiKeyChangeBtn.addEventListener('click', cancelApiKeyChange);
  
  console.log('✅ Eventos configurados para el diálogo de cambio de API Key');
}

// Función para añadir los estilos CSS necesarios
function addCustomStyles() {
  // Comprobar si ya existen los estilos
  if (document.getElementById('customStyles')) {
    return;
  }
  
  // Crear elemento style
  const style = document.createElement('style');
  style.id = 'customStyles';
  style.textContent = `
    /* Estilos para el diálogo */
    .dialog {
      display: none;
      position: fixed;
      z-index: 100;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
    }
    
    .dialog-content {
      background-color: #fff;
      margin: 20px auto;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      max-width: 400px;
    }
    
    /* Estilos para la barra de acciones */
    .actions-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
      border-bottom: 1px solid #ddd;
    }
    
    /* Estilos para el botón de API key */
    #changeApiKeyBtn {
      padding: 6px 12px;
      font-size: 13px;
      display: flex;
      align-items: center;
    }
    
    /* Estilos para la visualización de la API key actual */
    .api-key-display {
      font-size: 12px;
      color: #666;
      margin-left: 10px;
      background-color: #ebebeb;
      padding: 4px 8px;
      border-radius: 3px;
      display: inline-block;
    }
    
    /* Estilos para botones en el diálogo */
    .button-group {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    
    .button-group .button {
      margin-left: 10px;
    }
    
    /* Estilos para inputs en diálogo */
    .form-group {
      margin-bottom: 15px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    
    .form-group .input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }
  `;
  
  // Añadir al head
  document.head.appendChild(style);
}

// Función para verificar si una API key es válida con el servidor
function verifyApiKey(apiKey, callback) {
  console.log('📋 Verificando API key...');
  
  if (!apiKey) {
    console.log('❌ No se proporcionó API key para verificar');
    callback(false, 'No se ha proporcionado una API key');
    return;
  }
  
  console.log(`🔑 Verificando API key: ${apiKey.substring(0, 5)}...`);
  
  // Obtener la URL base activa
  chrome.storage.local.get(['activeApiUrl'], function(result) {
    const baseUrl = result.activeApiUrl || CONFIG.apiUrl;
    
    // Intentar verificar con el servidor primero (endpoint /verify-key)
    fetch(`${baseUrl}/verify-key`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log(`Respuesta de verificación: ${response.status}`);
      
      if (response.status === 200) {
        // La API key es válida según el servidor
        response.json().then(data => {
          console.log('✅ API key validada por el servidor:', data);
          // Guardar el teamId si está disponible
          if (data.teamId) {
            chrome.storage.local.set({ teamId: data.teamId });
          }
          callback(true, `API key válida para equipo: ${data.teamId || 'desconocido'}`);
        });
      } else if (response.status === 401) {
        // La API key es inválida según el servidor
        console.log('❌ API key inválida según el servidor');
        callback(false, 'API key inválida');
      } else {
        // Error al conectar con el servidor, intentamos verificación local
        console.warn('⚠️ No se pudo verificar con el servidor, error:', response.status);
        callback(false, 'No se pudo verificar la API key con el servidor');
      }
    })
    .catch(error => {
      console.error('Error al verificar la API key:', error);
      callback(false, 'Error de conexión al verificar la API key');
    });
  });
} 