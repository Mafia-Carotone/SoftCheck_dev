const express = require('express');
const router = express.Router();

// Ruta básica de autenticación para que la importación en index.js no falle
router.get('/signin', (req, res) => {
  res.json({ message: 'Auth signin endpoint' });
});

module.exports = router; 