import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSoftware } from 'models/software'; // Importar la función existente

// Tipo para las solicitudes de software
type SoftwareRequest = {
  id?: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  downloadSource: string;
  status: string;
  notes?: string;
  teamId?: string;
  createdAt?: string;
};

// Base de datos simple en memoria para almacenar solicitudes
// En una implementación real, esto se conectaría a una base de datos
const softwareRequests: SoftwareRequest[] = [];

// Inicializamos el cliente Prisma para acceder a la base de datos
const prisma = new PrismaClient();

// Función para hashear una API key utilizando el mismo algoritmo que se usa al crearlas
function hashApiKey(apiKey: string): string {
  // Utilizamos SHA-256 como algoritmo de hash, que es común para este tipo de aplicaciones
  // En una implementación real, se debería usar el mismo algoritmo y salt que se usa al crear las keys
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Validación de API key contra la base de datos
const validateApiKey = async (apiKey: string | string[] | undefined): Promise<boolean> => {
  // Comprobaciones básicas
  if (!apiKey || Array.isArray(apiKey)) {
    console.log('❌ API key no proporcionada o en formato inválido');
    return false;
  }
  
  try {
    // Eliminamos la validación de keys de prueba
    // y solo confiamos en la validación contra la base de datos
    
    // Hashear la API key recibida
    const hashedKey = hashApiKey(apiKey);
    
    // Imprimir información de debug
    console.log('🔐 API key recibida (primeros 10 caracteres):', apiKey.substring(0, 10) + '...');
    console.log('🔐 Hash generado (completo):', hashedKey);
    
    // Obtener la fecha actual para verificar si la key ha expirado
    const now = new Date();
    
    // Buscar en la base de datos una coincidencia con el hash
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        hashedKey: hashedKey,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      }
    });
    
    // Si encontramos un registro con ese hash y no ha expirado, la key es válida
    if (apiKeyRecord) {
      console.log('✅ API key encontrada en la base de datos');
      console.log('📝 ID de la API key en la base de datos:', apiKeyRecord.id);
      console.log('📝 Hash almacenado en la base de datos:', apiKeyRecord.hashedKey);
      console.log('📝 Equipo asociado:', apiKeyRecord.teamId);
      console.log('📝 Nombre de la API key:', apiKeyRecord.name);
      console.log('📝 Fecha de expiración:', apiKeyRecord.expiresAt || 'No expira');
      
      // Actualizar lastUsedAt si existe el registro
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: now }
      });
      
      // Verificación final - confirmar que los hashes coinciden
      const hashesMatch = apiKeyRecord.hashedKey === hashedKey;
      console.log('🔍 ¿Los hashes coinciden?', hashesMatch ? '✅ Sí' : '❌ No');
      
      return true;
    }
    
    console.log('❌ No se encontró la API key en la base de datos o ha expirado');
    return false;
  } catch (error) {
    console.error('❌ Error al validar la API key:', error);
    return false;
  }
};

// Función para obtener un ID de equipo basado en la API key
// Ahora consulta la base de datos para obtener el equipo correcto
const getTeamIdFromApiKey = async (apiKey: string): Promise<string> => {
  try {
    // Hashear la API key
    const hashedKey = hashApiKey(apiKey);
    
    // Obtener la fecha actual para verificar si la key ha expirado
    const now = new Date();
    
    // Buscar en la base de datos
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        hashedKey: hashedKey,
        // Verificar que la key no ha expirado (o que expiresAt es null, lo que significa que no expira)
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      }
    });
    
    if (apiKeyRecord && apiKeyRecord.teamId) {
      return apiKeyRecord.teamId;
    }
    
    // Si no encontramos el equipo, usamos uno por defecto
    return 'default-team';
  } catch (error) {
    console.error('Error al obtener el teamId desde la API key:', error);
    return 'default-team';
  }
};

/**
 * Manejador de API unificado para solicitudes de software
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Extraer API key del encabezado
  const apiKey = req.headers['x-api-key'];
  
  // Verificar API key - ahora es una función asíncrona
  const isValidKey = await validateApiKey(apiKey);
  if (!isValidKey) {
    return res.status(401).json({
      error: {
        message: 'API key inválida o no proporcionada'
      }
    });
  }
  
  // Manejar diferentes métodos HTTP
  switch (req.method) {
    case 'GET':
      return handleGetRequests(req, res, apiKey as string);
    
    case 'POST':
      return handleCreateRequest(req, res, apiKey as string);
    
    case 'DELETE':
      return handleDeleteRequest(req, res, apiKey as string);
    
    default:
      return res.status(405).json({ 
        error: { 
          message: 'Método no permitido' 
        } 
      });
  }
}

/**
 * Maneja la creación de una nueva solicitud de software
 */
async function handleCreateRequest(
  req: NextApiRequest, 
  res: NextApiResponse, 
  apiKey: string
) {
  try {
    // Verificar que el cuerpo de la solicitud contiene los datos necesarios
    const { fileName, fileSize, fileUrl, downloadSource, status, notes, teamId } = req.body;
    
    if (!fileName) {
      return res.status(400).json({
        error: {
          message: 'Se requiere al menos el nombre del archivo'
        }
      });
    }
    
    // Obtener el ID del equipo basado en la API key si no se proporciona
    const effectiveTeamId = teamId || await getTeamIdFromApiKey(apiKey);
    
    // Utilizamos downloadSource como nombre del software
    // Si no está disponible, extraemos del nombre del archivo
    let softwareName = downloadSource || 'Desconocido';
    let version = "1.0"; // Versión por defecto
    
    // Si no hay downloadSource o es genérico, intentamos extraer del nombre del archivo
    if (!downloadSource || downloadSource === 'Extension' || downloadSource === 'Direct download') {
      // Intentar extraer el nombre del software y la versión del nombre del archivo
      const versionRegex = /\bv?(\d+(\.\d+)+)\b/i;
      const versionMatch = fileName.match(versionRegex);
      
      if (versionMatch) {
        version = versionMatch[1];
        // Eliminar la versión del nombre del software
        let extractedName = fileName.replace(versionRegex, '').trim();
        // Eliminar extensión si existe
        extractedName = extractedName.replace(/\.[^/.]+$/, '').trim();
        // También podemos limpiar otras partes comunes como "setup", "installer", etc.
        extractedName = extractedName.replace(/\b(setup|installer|install|x64|x86)\b/gi, '').trim();
        
        // Solo usamos el nombre extraído si no tenemos un downloadSource específico
        if (softwareName === 'Desconocido' || softwareName === 'Extension' || softwareName === 'Direct download') {
          softwareName = extractedName;
        }
      }
    } else {
      // Si tenemos un origen específico (ej: "Google Chrome" o "Adobe Photoshop"), lo usamos tal cual
      console.log(`Usando origen como nombre del software: "${softwareName}"`);
      
      // Aún intentamos extraer la versión del nombre de archivo
      const versionRegex = /\bv?(\d+(\.\d+)+)\b/i;
      const versionMatch = fileName.match(versionRegex);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }
    
    console.log(`Procesando solicitud para software: "${softwareName}" versión "${version}"`);
    
    // Para almacenar en la memoria temporal también (compatibilidad con el código existente)
    const newRequest: SoftwareRequest = {
      id: uuidv4(), // Generar un ID único
      fileName,
      fileSize: fileSize || 0,
      fileUrl: fileUrl || '',
      downloadSource: downloadSource || 'Extension',
      status: status || 'pending',
      notes: notes || '',
      teamId: effectiveTeamId,
      createdAt: new Date().toISOString()
    };
    
    // Guardar en memoria temporal (mantener compatibilidad)
    softwareRequests.push(newRequest);
    
    // Intentar obtener el userId del usuario asociado al equipo
    // Para una solicitud de la extensión sin usuario específico, usaremos el primer usuario admin o owner
    let userId = 'system'; // Valor por defecto si no encontramos un usuario

    try {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: effectiveTeamId,
          OR: [
            { role: 'ADMIN' },
            { role: 'OWNER' },
          ]
        },
        select: {
          userId: true
        }
      });

      if (teamMember) {
        userId = teamMember.userId;
      }
    } catch (error) {
      console.warn('Error al obtener usuario para la solicitud:', error);
      // Continuamos con el valor predeterminado
    }
    
    // 1. Guardar la solicitud en la base de datos (SoftwareRequest)
    const softwareRequest = await prisma.softwareRequest.create({
      data: {
        fileName,
        fileSize: fileSize || 0,
        fileUrl: fileUrl || '',
        downloadSource: downloadSource || 'Extension',
        status: status || 'pending',
        notes: notes || '',
        teamId: effectiveTeamId,
        userId: userId
      }
    });
    
    // 2. También guardar en la tabla de Software si está aprobado automáticamente
    // Para extensión podemos aprobar automáticamente o dejarlo en pendiente según la configuración
    const autoApprove = true; // Cambiado a true para aprobar automáticamente
    let savedSoftware = null;
    
    if (autoApprove) {
      // Determinar en qué campo guardar la ruta del ejecutable basado en la extensión del archivo
      const isWindowsExe = fileName.toLowerCase().endsWith('.exe') || 
                          fileName.toLowerCase().endsWith('.msi');
      const isMacApp = fileName.toLowerCase().endsWith('.app') || 
                       fileName.toLowerCase().endsWith('.dmg') ||
                       fileName.toLowerCase().endsWith('.pkg');
      
      try {
        // Preparar los datos del software según el formato esperado por createSoftware
        const softwareData = {
          id: uuidv4(), // Generar un ID único para el software
          teamId: effectiveTeamId,
          softwareName, // Ahora es el valor del campo downloadSource
          version,
          windowsEXE: isWindowsExe ? fileUrl : undefined,
          macosEXE: isMacApp ? fileUrl : undefined,
          approved: true,
          // El campo answers debe ser un Record<string, string>
          answers: {
            source: 'extension',
            automaticallyApproved: 'true', // Convertido a string
            requestId: softwareRequest.id,
            fileName: fileName,
            fileSize: String(fileSize || 0),
            downloadSource: downloadSource || 'Extension',
            originalFileName: fileName // Guardar el nombre original por si acaso
          }
        };
        
        console.log('Creando software con datos:', softwareData);
        
        // Llamar a la función createSoftware correctamente
        const result = await createSoftware(softwareData);
        savedSoftware = result;
        
        console.log('Software creado exitosamente:', savedSoftware);
        
        // Actualizar la solicitud para marcarla como aprobada
        await prisma.softwareRequest.update({
          where: { id: softwareRequest.id },
          data: {
            status: 'approved',
            processedAt: new Date()
          }
        });
      } catch (error) {
        console.error('Error al crear software:', error);
        // Seguimos adelante con la solicitud aunque falle la creación del software
      }
    }
    
    console.log(`Nueva solicitud creada: ${softwareRequest.id} para el equipo: ${effectiveTeamId}`);
    if (savedSoftware) {
      console.log(`Software automáticamente aprobado: ${savedSoftware.id}`);
    }
    
    // Responder con éxito y los datos de la solicitud
    return res.status(200).json({
      ...softwareRequest,
      autoApproved: autoApprove,
      software: savedSoftware
    });
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    return res.status(500).json({
      error: {
        message: 'Error interno al procesar la solicitud'
      }
    });
  }
}

/**
 * Maneja la obtención de solicitudes de software
 */
async function handleGetRequests(
  req: NextApiRequest, 
  res: NextApiResponse, 
  apiKey: string
) {
  try {
    // Obtener el ID del equipo basado en la API key
    const teamId = await getTeamIdFromApiKey(apiKey);
    
    // Obtener solicitudes de la base de datos
    const requests = await prisma.softwareRequest.findMany({
      where: {
        teamId: teamId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Responder con las solicitudes encontradas
    return res.status(200).json(requests);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    return res.status(500).json({
      error: {
        message: 'Error interno al obtener las solicitudes'
      }
    });
  }
}

/**
 * Maneja la eliminación de una solicitud de software
 */
async function handleDeleteRequest(
  req: NextApiRequest, 
  res: NextApiResponse, 
  apiKey: string
) {
  try {
    // Obtener el ID de la solicitud de la URL
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        error: {
          message: 'Se requiere un ID válido'
        }
      });
    }
    
    // Obtener el ID del equipo basado en la API key
    const teamId = await getTeamIdFromApiKey(apiKey);
    
    // Buscar y eliminar la solicitud en la base de datos
    try {
      const deletedRequest = await prisma.softwareRequest.deleteMany({
        where: {
          id: id,
          teamId: teamId
        }
      });
      
      if (deletedRequest.count === 0) {
        return res.status(404).json({
          error: {
            message: 'Solicitud no encontrada o no autorizada'
          }
        });
      }
      
      console.log(`Solicitud eliminada: ${id}`);
      
      // Responder con éxito
      return res.status(200).json({ success: true, message: 'Solicitud eliminada correctamente' });
    } catch (error) {
      console.error('Error al eliminar solicitud en BD:', error);
      
      // Si falla la eliminación en BD, intentar en el array temporal como fallback
      const requestIndex = softwareRequests.findIndex(
        request => request.id === id && request.teamId === teamId
      );
      
      if (requestIndex === -1) {
        return res.status(404).json({
          error: {
            message: 'Solicitud no encontrada o no autorizada'
          }
        });
      }
      
      // Eliminar la solicitud del array
      softwareRequests.splice(requestIndex, 1);
      
      console.log(`Solicitud eliminada de memoria temporal: ${id}`);
      
      return res.status(200).json({ success: true, message: 'Solicitud eliminada correctamente' });
    }
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    return res.status(500).json({
      error: {
        message: 'Error interno al eliminar la solicitud'
      }
    });
  }
}
