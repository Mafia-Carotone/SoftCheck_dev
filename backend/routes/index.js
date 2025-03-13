const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth');
const teamsRoutes = require('./teams');
const softwareRequestsRoutes = require('./software-requests');

// Registrar rutas
router.use('/auth', authRoutes);
router.use('/teams', teamsRoutes);
router.use('/software-requests', softwareRequestsRoutes);

module.exports = router; 