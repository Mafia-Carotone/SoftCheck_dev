const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyApiKey } = require('../middlewares/auth');

// Middleware para verificar la API key en cada solicitud
router.use(verifyApiKey);

/**
 * @route POST /api/software-requests
 * @desc Crear una nueva solicitud de software identificando el equipo mediante la API key
 * @access Private (requiere API key)
 */
router.post('/', async (req, res) => {
  try {
    // El middleware verifyApiKey ya habrá añadido el usuario a req.user
    const { userId } = req.user;
    
    if (!userId) {
      return res.status(401).json({ 
        error: { message: 'Usuario no autenticado' } 
      });
    }
    
    // Obtener datos de la solicitud
    const { fileName, fileSize, fileUrl, downloadSource, status, notes } = req.body;
    
    // Validar datos necesarios
    if (!fileName) {
      return res.status(400).json({ 
        error: { message: 'El nombre del archivo es obligatorio' } 
      });
    }
    
    // Buscar el equipo al que pertenece el usuario
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: userId
      },
      include: {
        team: true
      }
    });
    
    if (!teamMember) {
      return res.status(404).json({ 
        error: { message: 'El usuario no pertenece a ningún equipo' } 
      });
    }
    
    // Crear la solicitud de software asociada al equipo
    const softwareRequest = await prisma.softwareRequest.create({
      data: {
        fileName,
        fileSize: fileSize || 0,
        fileUrl: fileUrl || '',
        downloadSource: downloadSource || 'Extension download',
        status: status || 'pending',
        notes: notes || '',
        teamId: teamMember.teamId, // Asociar con el equipo encontrado
        requestedBy: userId
      }
    });
    
    // Devolver la solicitud creada con el teamId para que la extensión lo almacene
    return res.status(201).json({
      id: softwareRequest.id,
      fileName: softwareRequest.fileName,
      status: softwareRequest.status,
      teamId: teamMember.teamId,
      teamName: teamMember.team.name,
      teamSlug: teamMember.team.slug,
      createdAt: softwareRequest.createdAt
    });
    
  } catch (error) {
    console.error('Error al crear solicitud de software:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
});

/**
 * @route DELETE /api/software-requests/:requestId
 * @desc Cancelar una solicitud de software
 * @access Private (requiere API key)
 */
router.delete('/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.user;
    
    if (!userId) {
      return res.status(401).json({ 
        error: { message: 'Usuario no autenticado' } 
      });
    }
    
    // Verificar que la solicitud exista y pertenezca al usuario
    const softwareRequest = await prisma.softwareRequest.findFirst({
      where: {
        id: requestId,
        OR: [
          { requestedBy: userId },
          {
            team: {
              members: {
                some: {
                  userId: userId,
                  role: 'ADMIN' // Solo administradores pueden eliminar solicitudes de otros
                }
              }
            }
          }
        ]
      }
    });
    
    if (!softwareRequest) {
      return res.status(404).json({ 
        error: { message: 'Solicitud no encontrada o no tiene permisos para eliminarla' } 
      });
    }
    
    // Eliminar la solicitud
    await prisma.softwareRequest.delete({
      where: {
        id: requestId
      }
    });
    
    return res.status(200).json({
      message: 'Solicitud eliminada correctamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar solicitud de software:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
});

/**
 * @route GET /api/software-requests
 * @desc Obtener todas las solicitudes de software del usuario
 * @access Private (requiere API key)
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.user;
    
    if (!userId) {
      return res.status(401).json({ 
        error: { message: 'Usuario no autenticado' } 
      });
    }
    
    // Obtener todas las solicitudes de software del usuario en todos sus equipos
    const softwareRequests = await prisma.softwareRequest.findMany({
      where: {
        OR: [
          { requestedBy: userId },
          {
            team: {
              members: {
                some: {
                  userId: userId
                }
              }
            }
          }
        ]
      },
      include: {
        team: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json(softwareRequests);
    
  } catch (error) {
    console.error('Error al obtener solicitudes de software:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
});

/**
 * @route GET /api/software-requests/:requestId
 * @desc Obtener detalles de una solicitud de software
 * @access Private (requiere API key)
 */
router.get('/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.user;
    
    if (!userId) {
      return res.status(401).json({ 
        error: { message: 'Usuario no autenticado' } 
      });
    }
    
    // Buscar la solicitud y verificar permisos
    const softwareRequest = await prisma.softwareRequest.findFirst({
      where: {
        id: requestId,
        OR: [
          { requestedBy: userId },
          {
            team: {
              members: {
                some: {
                  userId: userId
                }
              }
            }
          }
        ]
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    
    if (!softwareRequest) {
      return res.status(404).json({ 
        error: { message: 'Solicitud no encontrada o no tiene permisos para verla' } 
      });
    }
    
    return res.status(200).json(softwareRequest);
    
  } catch (error) {
    console.error('Error al obtener detalles de la solicitud:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
});

module.exports = router; 