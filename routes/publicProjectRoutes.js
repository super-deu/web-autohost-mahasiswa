// backend/routes/publicProjectRoutes.js
const express = require('express');
const { checkSubdomain } = require('../controllers/projectController');

const router = express.Router();

// Rute ini bersifat PUBLIK dan tidak memerlukan token/login
router.get('/check/:subdomain', checkSubdomain);

module.exports = router;