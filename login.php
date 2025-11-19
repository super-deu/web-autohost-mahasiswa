<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - AutoHost</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style> body { background-color: #f8f9fa; } </style>
</head>
<body>
<div class="container">
    <div class="row justify-content-center" style="min-height: 100vh; align-items: center;">
        <div class="col-lg-4 col-md-6">
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <h2 class="text-center mb-4 fw-bold">🚀 AutoHost</h2>
                    <p class="text-center text-muted mb-4">Silakan login untuk melanjutkan</p>
                    <form id="loginForm">
                        <div class="mb-3">
                            <label for="username" class="form-label">Username</label>
                            <input type="text" class="form-control" id="username" required>
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 mt-3">Login</button>
                    </form>
                    <div id="status" class="mt-3"></div>
                    <div class="text-center mt-3">
                        <small>Belum punya akun? <a href="register.php">Daftar di sini</a></small>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    // Langsung redirect ke dashboard jika sudah ada penanda sesi
    if (localStorage.getItem('autohost_user')) {
        window.location.replace('index.php');
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const statusDiv = document.getElementById('status');
        
        try {
            // LANGKAH 1: Ambil URL API dari get-config.php
            const configResponse = await fetch('./api/get-config.php');
            if (!configResponse.ok) throw new Error('Gagal memuat konfigurasi.');
            const dapp_config = await configResponse.json();
            const API_URL = `${dapp_config.apiBaseUrl}/auth/login`;

            // LANGKAH 2: Kirim request login ke URL yang sudah didapat
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include' // Penting untuk mengirim cookie
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            // Simpan HANYA username sebagai penanda di sisi klien
            localStorage.setItem('autohost_user', result.username);
            window.location.replace('index.php');
        } catch (error) {
            statusDiv.innerHTML = `<div class="alert alert-danger p-2">${error.message}</div>`;
        }
    });
</script>
</body>
</html>