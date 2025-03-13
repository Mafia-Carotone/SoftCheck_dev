const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyApiKey } = require('../middlewares/auth');

// Aplicar middleware de verificación de API key
router.use(verifyApiKey);

// Ruta básica de equipos
router.get('/', async (req, res) => {
  try {
    const { userId } = req.user;
    
    if (!userId) {
      return res.status(401).json({ 
        error: { message: 'Usuario no autenticado' } 
      });
    }
    
    // Buscar equipos del usuario
    const teams = await prisma.teamMember.findMany({
      where: {
        userId: userId
      },
      include: {
        team: true
      }
    });
    
    return res.json(teams.map(member => member.team));
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
});

// Obtener equipo por slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { userId } = req.user;
    
    if (!userId) {
      return res.status(401).json({ 
        error: { message: 'Usuario no autenticado' } 
      });
    }
    
    // Buscar equipo por slug y verificar pertenencia
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: userId,
        team: {
          slug: slug
        }
      },
      include: {
        team: true
      }
    });
    
    if (!teamMember) {
      return res.status(404).json({ 
        error: { message: 'Equipo no encontrado o no eres miembro' } 
      });
    }
    
    return res.json(teamMember.team);
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor', details: error.message } 
    });
  }
});

// Esta ruta todavía se mantiene para compatibilidad con código existente
// Crear solicitud de software para un equipo específico
router.post('/:slug/software-requests', async (req, res) => {
  try {
    const { slug } = req.params;
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
    
    // Buscar equipo por slug y verificar pertenencia
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: userId,
        team: {
          slug: slug
        }
      },
      include: {
        team: true
      }
    });
    
    if (!teamMember) {
      return res.status(404).json({ 
        error: { message: 'Equipo no encontrado o no eres miembro' } 
      });
    }
    
    // Crear la solicitud
    const softwareRequest = await prisma.softwareRequest.create({
      data: {
        fileName,
        fileSize: fileSize || 0,
        fileUrl: fileUrl || '',
        downloadSource: downloadSource || 'Extension download',
        status: status || 'pending',
        notes: notes || '',
        teamId: teamMember.teamId,
        requestedBy: userId
      }
    });
    
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

module.exports = router; 