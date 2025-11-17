// backend/routes/projectRoutes.js
const express = require('express');
const multer = require('multer');
// Hapus 'checkSubdomain' dari sini
const { deployProject, getMyProjects, deleteProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ dest: '/tmp/autohost-uploads' });

// Hapus rute '/check/:subdomain' dari file ini
// router.get('/check/:subdomain', checkSubdomain); <-- HAPUS BARIS INI

// Terapkan middleware 'protect' pada semua rute di bawah ini
router.use(protect);

router.post('/deploy', upload.single('projectFile'), deployProject);
router.get('/', getMyProjects);
router.delete('/:id/:subdomain', deleteProject);

module.exports = router;