const API_BASE_URL = 'https://7y2exkoxi2.execute-api.us-east-2.amazonaws.com/Prod'; 
const SUPER_USER_EMAIL = 'admin@admin.com'; 
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
        switchTab('market'); // Inicia en Marketplace
    }
});

// --- PREVISUALIZACIÓN DE IMAGEN ---
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

// --- NAVEGACIÓN RESIDENTE (TABS) ---
function switchTab(tab) {
    const marketBtn = document.getElementById('tab-market');
    const reservasBtn = document.getElementById('tab-reservas');
    const marketView = document.getElementById('view-market');
    const reservasView = document.getElementById('view-reservas');

    if (tab === 'market') {
        marketBtn.classList.add('active');
        reservasBtn.classList.remove('active');
        marketView.style.display = 'block';
        reservasView.style.display = 'none';
    } else {
        marketBtn.classList.remove('active');
        reservasBtn.classList.add('active');
        marketView.style.display = 'none';
        reservasView.style.display = 'block';
    }
    loadResidenteDashboard();
}

// --- ACCIONES ADMINISTRADOR ---
document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('condo-file').files[0];
    const nombre = document.getElementById('condo-nombre').value;
    const direccion = document.getElementById('condo-direccion').value;

    if (!file) return alert("Selecciona una foto.");

    try {
        const resUrl = await fetch(`${API_BASE_URL}/condos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ file_type: file.type })
        });
        const { upload_url, file_key } = await resUrl.json();

        await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });

        await fetch(`${API_BASE_URL}/condos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nombre, direccion, file_key })
        });

        alert("¡Edificio registrado!");
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

    // Marketplace
    document.getElementById('available-grid').innerHTML = data.available.map(c => `
        <div class="condo-box card">
            <span class="status-badge disponible">Disponible</span>
            <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
            <div class="condo-info">
                <h4>${c.nombre}</h4>
                <p>${c.direccion}</p>
                <button class="btn-primary" onclick="reserve('${c.id}')">Reservar</button>
            </div>
        </div>`).join('');

    // Mis Reservas
    const reservasGrid = document.getElementById('my-reservas-grid');
    if (data.my_reserva.length > 0) {
        reservasGrid.innerHTML = data.my_reserva.map(c => `
            <div class="condo-box card">
                <span class="status-badge ocupado">Tu Residencia</span>
                <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
                <div class="condo-info">
                    <h4>${c.nombre}</h4>
                    <button class="btn-sm" style="color: #dc2626; border-color: #fecaca; width: 100%; margin-top: 10px;" 
                        onclick="cancelReserve('${c.id}')">❌ Cancelar Reserva</button>
                </div>
            </div>`).join('');
    } else {
        reservasGrid.innerHTML = '<p style="text-align:center; color: #64748b; padding: 20px;">No tienes reservas activas.</p>';
    }
}

async function reserve(id) {
    const res = await fetch(`${API_BASE_URL}/condos/reserve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ condo_id: id })
    });
    if (res.ok) {
        alert("¡Reservado!");
        loadResidenteDashboard();
    } else {
        const data = await res.json();
        alert(data.message || "Error al reservar");
    }
}

async function cancelReserve(condoId) {
    if (!confirm("¿Deseas dejar este condominio y liberarlo?")) return;
    const res = await fetch(`${API_BASE_URL}/condos/reserve?condo_id=${condoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        alert("Reserva cancelada.");
        loadResidenteDashboard();
    }
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