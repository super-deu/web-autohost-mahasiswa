// backend/routes/authRoutes.js
const express = require('express');
const { registerUser, loginUser, deleteMyAccount} = require('../controllers/authController');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.delete('/me', protect, deleteMyAccount); // <-- Tambahkan rute ini

module.exports = router;