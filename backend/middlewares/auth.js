const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

/**
 * Middleware para verificar la API key en las solicitudes
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
async function verifyApiKey(req, res, next) {
  try {
    // Obtener la API key del header
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: { message: 'API key no proporcionada' } 
      });
    }
    
    // Calcular el hash de la API key
    const hashedApiKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
    
    // Buscar un usuario con esta API key
    const user = await prisma.user.findFirst({
      where: {
        apiKeyHash: hashedApiKey
      }
    });
    
    if (!user) {
      return res.status(401).json({ 
        error: { message: 'API key inválida' } 
      });
    }
    
    // Añadir el usuario a la solicitud para usarlo en las rutas
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name
    };
    
    // Si todo está correcto, continuar con la siguiente función middleware
    next();
  } catch (error) {
    console.error('Error al verificar API key:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
}

/**
 * Middleware para verificar si el usuario está autenticado mediante JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
function verifyJWT(req, res, next) {
  // Implementación existente de verificación JWT si la hay
  // ...

  // Si no hay implementación JWT, simplemente devolver un error
  return res.status(401).json({ 
    error: { message: 'Autenticación JWT no implementada' } 
  });
}

/**
 * Middleware combinado que intenta autenticar primero con API key y luego con JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
async function authenticate(req, res, next) {
  // Verificar si hay una API key
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    try {
      await verifyApiKey(req, res, next);
      return;
    } catch (error) {
      // Si falla, intentar con JWT
      console.error('Error al autenticar con API key, intentando JWT:', error);
    }
  }
  
  // Si no hay API key o falló, intentar con JWT
  verifyJWT(req, res, next);
}

module.exports = {
  verifyApiKey,
  verifyJWT,
  authenticate
}; 