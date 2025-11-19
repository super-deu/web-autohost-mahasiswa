/**
 * AutoHost Mahasiswa - Frontend Logic Final
 * File ini menangani semua interaksi dinamis di halaman dashboard utama.
 * Arsitektur: API-driven dengan konfigurasi dinamis dan otentikasi berbasis cookie.
 */

document.addEventListener('DOMContentLoaded', () => {

    /**
     * Fungsi utama yang membungkus seluruh logika aplikasi.
     * Dijalankan setelah halaman HTML dimuat.
     */
    async function initializeApp() {
        try {
            // =================================================================
            // LANGKAH 1: AMBIL KONFIGURASI APLIKASI DARI SERVER
            // =================================================================
            const configResponse = await fetch('./api/get-config.php');
            if (!configResponse.ok) {
                throw new Error('Gagal mengambil file konfigurasi (get-config.php).');
            }
            
            const dapp_config = await configResponse.json();
            const API_BASE_URL = `${dapp_config.apiBaseUrl}/projects`;
            const AUTH_API_URL = `${dapp_config.apiBaseUrl}/auth`;
            
            // =================================================================
            // LANGKAH 2: LAKUKAN PENGECEKAN OTENTIKASI
            // =================================================================
            // Kita cek 'username' di localStorage sebagai penanda sesi di sisi klien.
            // Otentikasi sesungguhnya terjadi via httpOnly cookie yang dikirim otomatis.
            const username = localStorage.getItem('autohost_user');

            if (!username) {
                // Redirect ke halaman login jika tidak ada penanda sesi.
                window.location.replace('login.php');
                return; // Hentikan eksekusi.
            }

            // Jika otentikasi sisi klien berhasil, tampilkan halaman dan siapkan UI.
            document.body.style.visibility = 'visible';
            document.getElementById('usernameDisplay').textContent = username;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                // Hapus penanda sesi di klien dan kembali ke halaman login.
                localStorage.removeItem('autohost_user');
                window.location.replace('login.php');
            });

            // =================================================================
            // LANGKAH 3: SIAPKAN FUNGSI DAN EVENT LISTENER
            // =================================================================
            const projectListBody = document.getElementById('projectList');
            const uploadForm = document.getElementById('uploadForm');
            const statusDiv = document.getElementById('status');
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btn-text');
            const btnSpinner = document.getElementById('btn-spinner');
            const subdomainInput = document.getElementById('subdomain');
            const subdomainStatus = document.getElementById('subdomainStatus');
            const projectFileInput = document.getElementById('projectFile');
            
            let checkTimeout;
            subdomainInput.addEventListener('keyup', () => {
                clearTimeout(checkTimeout);
                
                const subdomain = subdomainInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                subdomainInput.value = subdomain;
                
                if (subdomain.length < 3) {
                    subdomainStatus.textContent = '';
                    return;
                }

                // Pengecualian untuk 'web' di frontend
                if (subdomain === 'web') {
                    subdomainStatus.textContent = '❌ Subdomain "web" tidak diizinkan.';
                    subdomainStatus.className = 'form-text text-danger';
                    return;
                }

                subdomainStatus.textContent = 'Mengecek ketersediaan...';
                subdomainStatus.className = 'form-text text-muted';

                checkTimeout = setTimeout(async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/check/${subdomain}`);
                        const result = await response.json();

                        subdomainStatus.textContent = result.available ? `✅ ${result.message}` : `❌ ${result.message}`;
                        subdomainStatus.className = result.available ? 'form-text text-success' : 'form-text text-danger';
                    } catch (error) {
                        subdomainStatus.textContent = 'Gagal mengecek ketersediaan.';
                        subdomainStatus.className = 'form-text text-warning';
                    }
                }, 500);
            });
            
            projectFileInput.addEventListener('change', () => {
                // Kosongkan pesan status setiap kali file baru dipilih
                statusDiv.innerHTML = '';
                // Aktifkan kembali tombol submit sebagai default
                submitBtn.disabled = false;

                // Cek apakah ada file yang dipilih
                if (projectFileInput.files.length === 0) {
                    return; // Tidak ada file, tidak perlu validasi
                }
                
                const file = projectFileInput.files[0];
                const MAX_SIZE = 10 * 1024 * 1024; // 10 MB dalam bytes
                const ALLOWED_TYPES = ['application/zip', 'application/x-zip-compressed'];
                
                // 1. Validasi Tipe File
                if (!ALLOWED_TYPES.includes(file.type)) {
                    statusDiv.innerHTML = `<div class="alert alert-danger p-2"><b>Error:</b> Hanya file dengan format .zip yang diizinkan.</div>`;
                    projectFileInput.value = ''; // Hapus file yang tidak valid dari input
                    submitBtn.disabled = true; // Nonaktifkan tombol submit
                    return;
                }
                
                // 2. Validasi Ukuran File
                if (file.size > MAX_SIZE) {
                    statusDiv.innerHTML = `<div class="alert alert-danger p-2"><b>Error:</b> Ukuran file tidak boleh melebihi 10 MB. Ukuran file Anda: ${(file.size / 1024 / 1024).toFixed(2)} MB.</div>`;
                    projectFileInput.value = ''; // Hapus file yang tidak valid dari input
                    submitBtn.disabled = true; // Nonaktifkan tombol submit
                    return;
                }
            });
            
            /**
             * Mengambil dan menampilkan daftar proyek milik pengguna yang sedang login.
             */
            const fetchProjects = async () => {
                try {
                    const response = await fetch(API_BASE_URL, { credentials: 'include' }); // 'credentials: include' penting untuk mengirim cookie
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);

                    projectListBody.innerHTML = '';
                    if (result.projects.length === 0) {
                        projectListBody.innerHTML = '<tr><td colspan="3" class="text-center">Anda belum memiliki proyek.</td></tr>';
                    } else {
                        result.projects.forEach(p => {
                            const row = `<tr>
                                <td>${p.project_name}</td>
                                <td><a href="${p.public_url}" target="_blank" rel="noopener noreferrer">${p.public_url}</a></td>
                                <td>
                                    <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id}, '${p.subdomain}')">Hapus</button>
                                </td>
                            </tr>`;
                            projectListBody.innerHTML += row;
                        });
                    }
                } catch (error) {
                    projectListBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Gagal memuat proyek: ${error.message}</td></tr>`;
                }
            };

            /**
             * Menghapus proyek berdasarkan ID. Dibuat global agar bisa diakses oleh onclick.
             */
            window.deleteProject = async (id, subdomain) => {
                if (!confirm(`Apakah Anda yakin ingin menghapus proyek "${subdomain}"?`)) return;

                try {
                    statusDiv.innerHTML = `<div class="alert alert-warning">Menghapus proyek ${subdomain}...</div>`;
                    const response = await fetch(`${API_BASE_URL}/${id}/${subdomain}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);

                    statusDiv.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
                    fetchProjects();
                } catch (error) {
                    statusDiv.innerHTML = `<div class="alert alert-danger">Gagal menghapus: ${error.message}</div>`;
                }
            };

            /**
             * Membersihkan string dari karakter HTML berbahaya.
             */
            const sanitizeHTML = (str) => {
                const temp = document.createElement('div');
                temp.textContent = str;
                return temp.innerHTML;
            };

            // Event listener utama untuk form upload
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                // --- Sanitasi Input ---
                const projectNameInput = document.getElementById('projectName');
                const subdomainInput = document.getElementById('subdomain');
                const cleanProjectName = sanitizeHTML(projectNameInput.value.trim());
                const cleanSubdomain = subdomainInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

                if (!cleanProjectName || !cleanSubdomain || !document.getElementById('projectFile').files[0]) {
                    statusDiv.innerHTML = `<div class="alert alert-danger">Semua field wajib diisi.</div>`;
                    return;
                }
                
                projectNameInput.value = cleanProjectName;
                subdomainInput.value = cleanSubdomain;
                // --- Akhir Sanitasi ---

                submitBtn.disabled = true;
                btnText.textContent = 'Memproses...';
                btnSpinner.classList.remove('d-none');
                statusDiv.innerHTML = `<div class="alert alert-info">Mengunggah file...</div>`;

                const formData = new FormData(uploadForm);
                
                try {
                    const response = await fetch(`${API_BASE_URL}/deploy`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);

                    statusDiv.innerHTML = `<div class="alert alert-success"><strong>Berhasil!</strong> Proyek aktif di <a href="${result.url}" target="_blank">${result.url}</a>.</div>`;
                    uploadForm.reset();
                    fetchProjects();
                } catch (error) {
                    statusDiv.innerHTML = `<div class="alert alert-danger"><strong>Error Deploy:</strong> ${error.message}</div>`;
                } finally {
                    submitBtn.disabled = false;
                    btnText.textContent = 'Validasi & Deploy';
                    btnSpinner.classList.add('d-none');
                }
            });
            
            const deleteAccountBtn = document.getElementById('deleteAccountBtn');
            deleteAccountBtn.addEventListener('click', async () => {
                const confirmation = prompt("Ini adalah tindakan permanen dan akan menghapus semua proyek Anda. Untuk melanjutkan, ketik username Anda: '" + username + "'");
                
                if (confirmation !== username) {
                    alert("Konfirmasi salah. Penghapusan akun dibatalkan.");
                    return;
                }
                try {
                    statusDiv.innerHTML = `<div class="alert alert-warning">Menghapus akun Anda...</div>`;
                    const response = await fetch(`${AUTH_API_URL}/me`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);
                    
                    alert(result.message); // Tampilkan pesan sukses
                    // Hapus penanda sesi dan redirect
                    localStorage.removeItem('autohost_user');
                    window.location.replace('login.php');
                    
                } catch (error) {
                    statusDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
                }
            });

            // =================================================================
            // LANGKAH 4: PANGGIL FUNGSI AWAL
            // =================================================================
            fetchProjects();

        } catch (error) {
            console.error("Gagal menginisialisasi aplikasi:", error);
            document.body.style.visibility = 'visible';
            document.body.innerHTML = `<div class="alert alert-danger m-5"><strong>Error Kritis:</strong> Tidak dapat memuat konfigurasi aplikasi. Pastikan file get-config.php ada dan benar.</div>`;
        }
    }

    // Jalankan seluruh aplikasi.
    initializeApp();
});