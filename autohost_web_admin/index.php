<!DOCTYPE html>
<html lang="id">
<head>
    <title>Admin Panel</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        /* Sembunyikan body sampai otentikasi selesai untuk menghindari "flash" konten */
        body { visibility: hidden; }
    </style>
</head>
<body class="container mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>Admin Panel</h1>
        <button id="logoutBtn" class="btn btn-danger">Logout</button>
    </div>
    
    <h2 class="mt-5">Daftar Pengguna</h2>
    <table class="table table-bordered table-striped">
        <thead><tr><th>ID</th><th>Username</th><th>Dibuat</th><th>Aksi</th></tr></thead>
        <tbody id="userList"></tbody>
    </table>

    <h2 class="mt-5">Daftar Proyek</h2>
    <table class="table table-bordered table-striped">
        <thead><tr><th>ID</th><th>Subdomain</th><th>Pemilik</th><th>Aksi</th></tr></thead>
        <tbody id="projectList"></tbody>
    </table>

    <script>
        // Alamat IP backend Anda
        const API_BASE_URL = `URL BACK-END ADMIN ANDA`;

        /**
         * PENJAGA GERBANG JAVASCRIPT
         * Fungsi ini berjalan pertama kali untuk memeriksa otentikasi.
         */
        (async function checkAuthentication() {
            try {
                // Tanya ke backend, "apakah saya punya cookie yang valid?"
                const response = await fetch(`${API_BASE_URL}/admin/check-auth`, { credentials: 'include' });
                if (!response.ok) {
                    // Jika backend bilang tidak (error 401/403), lempar ke login
                    window.location.replace('pages/login.php');
                    return;
                }
                
                // Jika lolos, tampilkan halaman dan jalankan aplikasi utama
                document.body.style.visibility = 'visible';
                initializeApp();

            } catch (e) {
                // Jika fetch gagal total (misal backend mati), lempar ke login
                window.location.replace('pages/login.php');
            }
        })();

        /**
         * Fungsi ini hanya akan berjalan jika otentikasi berhasil.
         */
        function initializeApp() {
            // Logika Logout
            document.getElementById('logoutBtn').addEventListener('click', async () => {
                await fetch(`${API_BASE_URL}/admin/logout`, { method: 'POST', credentials: 'include' });
                window.location.href = 'pages/login.php';
            });
            
            // Logika Fetch Data
            const fetchData = async (url, tableId, renderFunc) => {
                const response = await fetch(url, { credentials: 'include' });
                const data = await response.json();
                const tbody = document.getElementById(tableId);
                tbody.innerHTML = '';
                renderFunc(data, tbody);
            };
            
            fetchData(`${API_BASE_URL}/admin/users`, 'userList', (data, tbody) => {
                data.forEach(u => tbody.innerHTML += `<tr><td>${u.id}</td><td>${u.username}</td><td>${new Date(u.created_at).toLocaleString()}</td><td><button class="btn btn-sm btn-danger">Hapus</button></td></tr>`);
            });

            fetchData(`${API_BASE_URL}/admin/projects`, 'projectList', (data, tbody) => {
                data.forEach(p => tbody.innerHTML += `<tr><td>${p.id}</td><td>${p.subdomain}</td><td>${p.owner}</td><td><button class="btn btn-sm btn-danger">Hapus</button></td></tr>`);
            });
        }
    </script>
</body>
</html>