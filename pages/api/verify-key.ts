import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

// Inicializamos el cliente Prisma para acceder a la base de datos
const prisma = new PrismaClient();

// Función para hashear una API key
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Endpoint para verificar la validez de una API key
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir peticiones GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: { 
        message: 'Método no permitido. Solo se acepta GET.' 
      } 
    });
  }

  // Extraer API key del encabezado
  const apiKey = req.headers['x-api-key'];
  console.log('🔑 Verificando API key desde endpoint /verify-key');

  // Verificar que se proporcionó una API key
  if (!apiKey || Array.isArray(apiKey)) {
    console.log('❌ API key no proporcionada o en formato inválido');
    return res.status(401).json({
      error: {
        message: 'API key no proporcionada o formato inválido'
      }
    });
  }

  try {
    // Eliminamos la validación de keys de prueba
    
    // Hashear la API key recibida
    const hashedKey = hashApiKey(apiKey);
    
    // Imprimir información de debug
    console.log('🔐 API key recibida (primeros 10 caracteres):', apiKey.substring(0, 10) + '...');
    console.log('🔐 Hash generado (completo):', hashedKey);
    
    // Obtener la fecha actual para verificar si la key ha expirado
    const now = new Date();

    // Buscar la API key en la base de datos
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        hashedKey: hashedKey,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      }
    });

    if (apiKeyRecord) {
      console.log('✅ API key encontrada en la base de datos');
      console.log('📝 ID de la API key en la base de datos:', apiKeyRecord.id);
      console.log('📝 Hash almacenado en la base de datos:', apiKeyRecord.hashedKey);
      console.log('📝 Equipo asociado:', apiKeyRecord.teamId);
      console.log('📝 Nombre de la API key:', apiKeyRecord.name);
      console.log('📝 Fecha de expiración:', apiKeyRecord.expiresAt || 'No expira');
      
      // Verificación final - confirmar que los hashes coinciden
      const hashesMatch = apiKeyRecord.hashedKey === hashedKey;
      console.log('🔍 ¿Los hashes coinciden?', hashesMatch ? '✅ Sí' : '❌ No');
      
      // Actualizar lastUsedAt
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: now }
      });
      
      // Encontramos una key válida
      return res.status(200).json({
        valid: true,
        teamId: apiKeyRecord.teamId,
        message: 'API key válida',
        keyInfo: {
          id: apiKeyRecord.id,
          name: apiKeyRecord.name,
          createdAt: apiKeyRecord.createdAt,
          expiresAt: apiKeyRecord.expiresAt,
          lastUsedAt: now
        },
        hashInfo: {
          generatedHash: hashedKey,
          storedHash: apiKeyRecord.hashedKey,
          match: hashesMatch
        }
      });
    } else {
      // No encontramos la key o ha expirado
      console.log('❌ No se encontró la API key en la base de datos o ha expirado');
      console.log('❌ Hash buscado:', hashedKey);
      
      return res.status(401).json({
        error: {
          message: 'API key inválida o expirada',
          hashInfo: {
            generatedHash: hashedKey
          }
        }
      });
    }
  } catch (error) {
    console.error('❌ Error al verificar API key:', error);
    return res.status(500).json({
      error: {
        message: 'Error interno al verificar la API key'
      }
    });
  } finally {
    // Cerrar la conexión de Prisma cuando terminemos
    await prisma.$disconnect();
  }
} 