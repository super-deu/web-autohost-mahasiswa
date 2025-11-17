// backend/app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
// Impor KEDUA file rute
const publicProjectRoutes = require('./routes/publicProjectRoutes');
const projectRoutes = require('./routes/projectRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

const corsOptions = {
    origin: 'https://web.autohost.my.id', // Sesuaikan dengan URL frontend Anda
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Daftarkan rute-rute dalam urutan yang benar
app.use('/api/auth', authRoutes);
app.use('/api/projects', publicProjectRoutes); // Rute publik, tanpa 'protect'
app.use('/api/projects', projectRoutes);      // Rute privat, 'protect' ada di dalam file-nya

module.exports = app;