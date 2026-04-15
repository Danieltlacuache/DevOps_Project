const API_BASE_URL = 'https://hpqvi22yyd.execute-api.us-east-2.amazonaws.com/Prod'; 
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
        switchTab('market'); 
    }

    // --- LÓGICA DE PREVISUALIZACIÓN ---
    const fileInput = document.getElementById('condo-file');
    const preview = document.getElementById('preview');

    fileInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                preview.src = event.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
});

// --- ACCIONES ADMINISTRADOR ---
document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('condo-file').files[0];
    const nombre = document.getElementById('condo-nombre').value;
    const direccion = document.getElementById('condo-direccion').value;

    if (!file) return alert("Por favor, selecciona una foto.");

    try {
        // 1. URL Firmada
        const resUrl = await fetch(`${API_BASE_URL}/condos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ file_type: file.type })
        });
        const { upload_url, file_key } = await resUrl.json();

        // 2. Subida a S3
        await fetch(upload_url, { 
            method: 'PUT', 
            headers: { 'Content-Type': file.type }, 
            body: file 
        });

        // 3. Confirmación en DynamoDB
        await fetch(`${API_BASE_URL}/condos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nombre, direccion, file_key })
        });

        alert("¡Edificio registrado!");
        location.reload();
    } catch (err) {
        alert("Error al registrar condominio");
    }
});

async function loadAdminCondos() {
    const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const condos = await res.json();
    document.getElementById('condos-list-admin').innerHTML = condos.map(c => `
        <div class="condo-box card" style="padding:10px; border:1px solid #e2e8f0; margin-bottom:10px;">
            <img src="${c.foto_url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
            <h4 style="margin:10px 0 5px 0;">${c.nombre}</h4>
            <span class="badge" style="font-size:12px; background:#e2e8f0; padding:2px 8px; border-radius:10px;">${c.estado}</span>
            <div style="margin-top:10px; display:flex; gap:5px;">
                <button class="btn-sm" onclick="copyId('${c.id}')" style="flex:1;">🆔 ID</button>
                <button class="btn-sm" onclick="deleteCondo('${c.id}')" style="color:red; flex:1;">🗑️</button>
            </div>
        </div>`).join('');
}

// --- ACCIONES RESIDENTE ---
function switchTab(tab) {
    const marketView = document.getElementById('view-market');
    const reservasView = document.getElementById('view-reservas');
    const tabM = document.getElementById('tab-market');
    const tabR = document.getElementById('tab-reservas');

    if (tab === 'market') {
        marketView.style.display = 'block';
        reservasView.style.display = 'none';
        tabM.classList.add('active');
        tabR.classList.remove('active');
    } else {
        marketView.style.display = 'none';
        reservasView.style.display = 'block';
        tabM.classList.remove('active');
        tabR.classList.add('active');
    }
    loadResidenteDashboard();
}

async function loadResidenteDashboard() {
    const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();

    document.getElementById('available-grid').innerHTML = (data.available || []).map(c => `
        <div class="condo-box card">
            <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
            <h4>${c.nombre}</h4>
            <p style="font-size:14px; color:666;">${c.direccion}</p>
            <button class="btn-primary" onclick="reserve('${c.id}')" style="width:100%; margin-top:10px;">Reservar</button>
        </div>`).join('');

    const resGrid = document.getElementById('my-reservas-grid');
    if (data.my_reserva && data.my_reserva.length > 0) {
        resGrid.innerHTML = data.my_reserva.map(c => `
            <div class="condo-box card">
                <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
                <h4>${c.nombre}</h4>
                <button onclick="cancelReserve('${c.id}')" style="width:100%; margin-top:10px; color:red; border:1px solid red; background:none; padding:8px; border-radius:8px; cursor:pointer;">❌ Cancelar</button>
            </div>`).join('');
    } else {
        resGrid.innerHTML = '<p>No tienes reservas activas.</p>';
    }
}

// --- FUNCIONES COMPARTIDAS ---
// BUSCA ESTA FUNCIÓN EN TU JS Y DÉJALA ASÍ:
async function reserve(id) {
    const res = await fetch(`${API_BASE_URL}/condos/reserve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ condo_id: id }) // <-- La Lambda espera 'condo_id'
    });
    if (res.ok) {
        alert("¡Reserva exitosa!");
        loadResidenteDashboard();
    } else {
        const d = await res.json();
        alert(d.msg || "Error al reservar");
    }
}

async function cancelReserve(id) {
    if (!confirm("¿Liberar propiedad?")) return;
    // Verifica que use: ?condo_id=
    await fetch(`${API_BASE_URL}/condos/reserve?condo_id=${id}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
    });
    loadResidenteDashboard();
}

async function createInviteToken() {
    const res = await fetch(`${API_BASE_URL}/auth/generate-token`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` } 
    });
    const data = await res.json();
    if (data.admin_token) {
        prompt("Token para nuevo Admin:", data.admin_token);
    } else {
        alert(data.msg);
    }
}

async function deleteCondo(id) {
    if (!confirm("¿Borrar edificio?")) return;
    await fetch(`${API_BASE_URL}/condos?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadAdminCondos();
}

function copyId(id) { navigator.clipboard.writeText(id); alert("ID Copiado"); }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }