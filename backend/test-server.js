// Servidor de prueba simple para diagnosticar problemas
const express = require('express');
const app = express();
const PORT = 3000; // Usar explícitamente el puerto 3000

// Middleware para parsear JSON
app.use(express.json());

// Configurar CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Logging de todas las peticiones
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Endpoint de prueba principal
app.get('/', (req, res) => {
  res.send('Servidor de prueba funcionando correctamente');
});

// Endpoint ping para verificación de conexión
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Endpoint de prueba para software-requests
app.post('/api/software-requests', (req, res) => {
  console.log('Recibida solicitud POST a /api/software-requests');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  // Verificar API key como prueba
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      error: { message: 'API key no proporcionada' }
    });
  }
  
  // Simular respuesta exitosa
  res.status(201).json({
    id: 'test-request-123',
    fileName: req.body.fileName || 'archivo.txt',
    status: 'pending',
    teamId: 'test-team-id',
    teamName: 'Equipo de Prueba',
    teamSlug: 'test-team',
    createdAt: new Date().toISOString()
  });
});

// Endpoint de prueba para cancelación
app.delete('/api/software-requests/:requestId', (req, res) => {
  console.log(`Recibida solicitud DELETE a /api/software-requests/${req.params.requestId}`);
  console.log('Headers:', req.headers);
  
  // Verificar API key como prueba
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      error: { message: 'API key no proporcionada' }
    });
  }
  
  // Simular respuesta exitosa
  res.status(200).json({
    message: 'Solicitud eliminada correctamente'
  });
});

// Manejador de 404
app.use((req, res) => {
  console.log(`404 - Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({
    error: {
      message: 'Recurso no encontrado',
      path: req.url,
      method: req.method
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`=== SERVIDOR DE PRUEBA ===`);
  console.log(`Ejecutándose en puerto ${PORT}`);
  console.log(`URL base: http://localhost:${PORT}`);
  console.log(`Endpoints disponibles:`);
  console.log(`GET /api/ping - Verificación de conexión`);
  console.log(`GET /api/health - Estado del servidor`);
  console.log(`POST /api/software-requests - Crear solicitud de software`);
  console.log(`DELETE /api/software-requests/:requestId - Cancelar solicitud`);
  console.log(`===========================`);
}); 