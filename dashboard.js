const API_BASE_URL = 'https://7y2exkoxi2.execute-api.us-east-2.amazonaws.com/Prod'; 
const SUPER_USER_EMAIL = 'admin@admin.com'; // Cambia por tu correo maestro
const token = localStorage.getItem('token');

if (!token) window.location.href = 'index.html';

const userData = JSON.parse(atob(token.split('.')[1]));

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user-email').textContent = userData.email;

    if (userData.role === 'admin') {
        document.getElementById('admin-section').style.display = 'block';
        if (userData.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()) {
            document.getElementById('super-user-controls').style.display = 'block';
        }
        loadAdminCondos();
    } else {
        document.getElementById('residente-section').style.display = 'block';
        loadResidenteDashboard();
    }
});

// --- PREVISUALIZACIÓN ---
document.getElementById('condo-file')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('preview');
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            preview.src = event.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// --- NAVEGACIÓN RESIDENTE ---
function switchTab(tab) {
    document.getElementById('tab-market').classList.toggle('active', tab === 'market');
    document.getElementById('tab-reservas').classList.toggle('active', tab === 'reservas');
    document.getElementById('view-market').style.display = tab === 'market' ? 'block' : 'none';
    document.getElementById('view-reservas').style.display = tab === 'reservas' ? 'block' : 'none';
}

// --- ACCIONES ADMIN ---
document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('condo-file').files[0];
    const nombre = document.getElementById('condo-nombre').value;
    const direccion = document.getElementById('condo-direccion').value;

    if (!file) return alert("Selecciona una foto.");

    try {
        // 1. URL Firmada
        const resUrl = await fetch(`${API_BASE_URL}/condos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ file_type: file.type })
        });
        const { upload_url, file_key } = await resUrl.json();

        // 2. Subida a S3 (PUT)
        await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });

        // 3. DynamoDB
        await fetch(`${API_BASE_URL}/condos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nombre, direccion, file_key })
        });

        alert("¡Éxito!");
        location.reload();
    } catch (err) {
        alert("Error en la subida.");
    }
});

async function loadAdminCondos() {
    const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const condos = await res.json();
    document.getElementById('condos-list-admin').innerHTML = condos.map(c => `
        <div class="condo-box card" style="padding:0; overflow:hidden; position:relative;">
            <span class="status-badge ${c.estado.toLowerCase()}">${c.estado}</span>
            <img src="${c.foto_url}" style="width:100%; height:140px; object-fit:cover;">
            <div style="padding:15px;">
                <h4 style="margin:0;">${c.nombre}</h4>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button class="btn-sm" onclick="copyId('${c.id}')">🆔 ID</button>
                    <button class="btn-sm" style="color:red" onclick="deleteCondo('${c.id}')">🗑️</button>
                </div>
            </div>
        </div>`).join('');
}

// --- ACCIONES RESIDENTE ---
async function loadResidenteDashboard() {
    const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();

    document.getElementById('available-grid').innerHTML = data.available.map(c => `
        <div class="condo-box card">
            <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
            <h4>${c.nombre}</h4>
            <button class="btn-primary" onclick="reserve('${c.id}')">Reservar</button>
        </div>`).join('');

    document.getElementById('my-reservas-grid').innerHTML = data.my_reserva.map(c => `
        <div class="condo-box card">
            <div class="status-badge ocupado">Tu Hogar</div>
            <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
            <h4>${c.nombre}</h4>
        </div>`).join('');
}

async function reserve(id) {
    await fetch(`${API_BASE_URL}/condos/reserve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ condo_id: id })
    });
    alert("Reservado!");
    loadResidenteDashboard();
}

// --- UTILIDADES ---
async function createInviteToken() {
    const res = await fetch(`${API_BASE_URL}/auth/generate-token`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    prompt("Token Generado:", data.admin_token);
}

function copyId(id) { navigator.clipboard.writeText(id); alert("ID Copiado"); }

async function deleteCondo(id) {
    if(confirm("¿Borrar edificio e imagen?")) {
        await fetch(`${API_BASE_URL}/condos?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        loadAdminCondos();
    }
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }