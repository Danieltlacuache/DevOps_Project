// --- CONFIGURACIÓN ---
const API_BASE_URL = 'https://hpqvi22yyd.execute-api.us-east-2.amazonaws.com/Prod'; 
const SUPER_USER_EMAIL = 'admin@admin.com'; 
const token = localStorage.getItem('token');

// Redirigir al login si no hay token
if (!token) window.location.href = 'index.html';

// Decodificar info del usuario desde el JWT
const userData = JSON.parse(atob(token.split('.')[1]));

document.addEventListener('DOMContentLoaded', () => {
    // Mostrar el email del usuario en el header
    document.getElementById('user-email').textContent = userData.email;

    // --- CONTROL DE VISTAS Y SINCRONIZACIÓN POR ROL ---
    if (userData.role === 'admin') {
        document.getElementById('admin-section').style.display = 'block';
        if (userData.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()) {
            document.getElementById('super-user-controls').style.display = 'block';
        }
        
        loadAdminCondos(); // Carga inicial

        // Sincronización para el Admin (detectar reservas de residentes)
        setInterval(() => {
            console.log("Admin: Sincronizando estado de inventario...");
            loadAdminCondos();
        }, 5000); // Cada 5 segundos para la demo

    } else {
        document.getElementById('residente-section').style.display = 'block';
        switchTab('market'); 
        
        // Sincronización para el Residente (detectar nuevos edificios o bajas)
        setInterval(() => {
            console.log("Residente: Sincronizando Marketplace...");
            loadResidenteDashboard();
        }, 8000);
    }

    // --- LÓGICA DE PREVISUALIZACIÓN DE IMAGEN ---
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

// ==============================================================================
// SECCIÓN ADMINISTRADOR (OPTIMISTIC UI)
// ==============================================================================

document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('condo-file').files[0];
    const nombre = document.getElementById('condo-nombre').value;
    const direccion = document.getElementById('condo-direccion').value;
    const previewSrc = document.getElementById('preview').src;

    if (!file) return alert("Por favor, selecciona una foto.");

    // --- CAMBIO INSTANTÁNEO ---
    const listContainer = document.getElementById('condos-list-admin');
    const tempId = 'temp-' + Date.now();
    const optimisticHTML = `
        <div class="condo-box card" id="${tempId}" style="padding:10px; border:1px solid #e2e8f0; margin-bottom:10px; opacity: 0.7;">
            <img src="${previewSrc}" style="width:100%; height:120px; object-fit:cover; border-radius:8px; filter: grayscale(100%);">
            <h4 style="margin:10px 0 5px 0;">${nombre}</h4>
            <span class="badge" style="font-size:12px; background:#fef08a; padding:2px 8px; border-radius:10px;">Subiendo...</span>
        </div>`;
    
    listContainer.insertAdjacentHTML('afterbegin', optimisticHTML);
    e.target.reset();
    document.getElementById('preview').style.display = 'none';

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

        // Confirmar éxito visualmente
        const tempElement = document.getElementById(tempId);
        if (tempElement) {
            tempElement.style.opacity = "1";
            tempElement.querySelector('img').style.filter = "none";
            const badge = tempElement.querySelector('.badge');
            badge.textContent = "Disponible";
            badge.style.background = "#22c55e";
            badge.style.color = "white";
        }
        
        setTimeout(() => loadAdminCondos(), 2000);
    } catch (err) {
        document.getElementById(tempId)?.remove();
        alert("❌ Error al subir el condominio.");
    }
});

async function loadAdminCondos() {
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        const listContainer = document.getElementById('condos-list-admin');
        
        listContainer.innerHTML = condos.map(c => {
            const isOcupado = c.estado === 'Ocupado';
            const badgeBg = isOcupado ? '#ef4444' : '#22c55e';
            
            return `
            <div class="condo-box card" style="padding:10px; border:1px solid #e2e8f0; margin-bottom:10px;">
                <img src="${c.foto_url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
                <h4 style="margin:10px 0 5px 0;">${c.nombre}</h4>
                <span class="badge" style="font-size:12px; background:${badgeBg}; color:white; padding:2px 8px; border-radius:10px;">
                    ${c.estado}
                </span>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <button class="btn-sm" onclick="copyId('${c.id}')">🆔 ID</button>
                    <button class="btn-sm" onclick="deleteCondo('${c.id}')" style="color:red; background:none; border:1px solid red; border-radius:4px; cursor:pointer;">🗑️</button>
                </div>
            </div>`;
        }).join('');
    } catch (err) { console.error(err); }
}

// ==============================================================================
// SECCIÓN RESIDENTE
// ==============================================================================

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
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        // Marketplace
        document.getElementById('available-grid').innerHTML = (data.available || []).map(c => `
            <div class="condo-box card">
                <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
                <h4>${c.nombre}</h4>
                <p style="font-size:13px; color:#64748b;">${c.direccion}</p>
                <button class="btn-primary" onclick="reserve('${c.id}')" style="width:100%; margin-top:10px;">Reservar</button>
            </div>`).join('');

        // Mis Reservas
        const resGrid = document.getElementById('my-reservas-grid');
        if (data.my_reserva && data.my_reserva.length > 0) {
            resGrid.innerHTML = data.my_reserva.map(c => `
                <div class="condo-box card">
                    <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
                    <h4>${c.nombre}</h4>
                    <button onclick="cancelReserve('${c.id}')" style="width:100%; margin-top:10px; color:red; border:1px solid red; background:none; padding:8px; border-radius:8px; cursor:pointer;">❌ Cancelar Reserva</button>
                </div>`).join('');
        } else {
            resGrid.innerHTML = '<p style="padding:20px; color:#64748b;">No tienes propiedades reservadas.</p>';
        }
    } catch (err) { console.error(err); }
}

// --- ACCIONES ---

async function reserve(id) {
    const res = await fetch(`${API_BASE_URL}/condos/reserve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ condo_id: id })
    });
    if (res.ok) {
        alert("✅ Reserva confirmada");
        loadResidenteDashboard();
    }
}

async function cancelReserve(id) {
    if (!confirm("¿Liberar propiedad?")) return;
    const res = await fetch(`${API_BASE_URL}/condos/reserve?condo_id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) loadResidenteDashboard();
}

async function createInviteToken() {
    const res = await fetch(`${API_BASE_URL}/auth/generate-token`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.admin_token) prompt("Token para nuevo Admin:", data.admin_token);
}

async function deleteCondo(id) {
    if (!confirm("¿Borrar edificio y foto de S3?")) return;
    const res = await fetch(`${API_BASE_URL}/condos?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) loadAdminCondos();
}

function copyId(id) { navigator.clipboard.writeText(id); alert("ID Copiado"); }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }