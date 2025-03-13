const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { PrismaClient } = require('@prisma/client');

// Importar índice de rutas
const apiRoutes = require('./routes/index');

// Inicializar Express
const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging de peticiones para depuración
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Headers:`, req.headers);
  next();
});

// Configuración básica
const PORT = process.env.PORT || 80;

// Endpoints de salud y estado
app.get('/api/ping', (req, res) => {
  console.log('Endpoint /api/ping hit');
  res.send('pong');
});

app.get('/api/health', async (req, res) => {
  console.log('Endpoint /api/health hit');
  try {
    // Verificar conexión a la base de datos
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rutas API principales
app.use('/api', apiRoutes);

// Log de rutas disponibles para depuración
console.log('Rutas registradas:');
app._router.stack.forEach(r => {
  if (r.route && r.route.path) {
    console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
  } else if (r.name === 'router') {
    r.handle.stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',');
        console.log(`${methods.toUpperCase()} /api${layer.route.path}`);
      }
    });
  }
});

// Manejador de errores 404
app.use((req, res, next) => {
  console.log(`404 - Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({
    error: {
      message: 'Recurso no encontrado',
      path: req.url,
      method: req.method
    }
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log(`Endpoints principales:`);
  console.log(`GET /api/ping - Verificación básica de conexión`);
  console.log(`GET /api/health - Verificación de salud del servidor`);
  console.log(`POST /api/software-requests - Crear solicitud de software`);
  console.log(`DELETE /api/software-requests/:requestId - Cancelar solicitud`);
});

// Manejo de terminación de proceso
process.on('SIGINT', async () => {
  console.log('Cerrando conexión a la base de datos...');
  await prisma.$disconnect();
  console.log('Conexión cerrada. Deteniendo servidor...');
  process.exit(0);
});

module.exports = app; 