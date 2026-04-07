// --- CONFIGURACIÓN DE CONEXIÓN ---
const API_BASE_URL = 'https://7y2exkoxi2.execute-api.us-east-2.amazonaws.com/Prod'; 
const token = localStorage.getItem('token');

if (!token) { 
    window.location.href = 'index.html'; 
}

function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) { 
        console.error("Token inválido");
        return null; 
    }
}

const userData = parseJwt(token);

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if (!userData) { logout(); return; }
    
    const emailElem = document.getElementById('user-email');
    if (emailElem) emailElem.textContent = userData.email;

    if (userData.role === 'admin') {
        const adminSec = document.getElementById('admin-section');
        if (adminSec) {
            adminSec.style.display = 'block';
            loadAdminCondos();    
            loadAdminResidents(); 
        }
    } else {
        const resSec = document.getElementById('residente-section');
        if (resSec) {
            resSec.style.display = 'block';
            loadResidenteDashboard(); 
        }
    }
});

// --- LÓGICA ADMINISTRADOR ---

// Previsualización de Imagen
const condoFileInput = document.getElementById('condo-file');
if (condoFileInput) {
    condoFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.size > 5 * 1024 * 1024) {
            alert("La imagen es muy pesada (Máx 5MB).");
            this.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = function() {
            const preview = document.getElementById('preview');
            if (preview) {
                preview.src = reader.result;
                preview.style.display = 'block';
            }
        }
        if (file) reader.readAsDataURL(file);
    });
}

// Crear Condominio
const condoForm = document.getElementById('add-condo-form');
if (condoForm) {
    condoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('condo-file').files[0];
        if (!file) return alert("Selecciona una foto");

        const reader = new FileReader();
        reader.onloadend = async () => {
            const payload = {
                nombre: document.getElementById('condo-nombre').value,
                direccion: document.getElementById('condo-direccion').value,
                image_data: reader.result 
            };

            try {
                const res = await fetch(`${API_BASE_URL}/condos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert("¡Condominio creado!");
                    location.reload(); // Recarga para limpiar y actualizar todo
                }
            } catch (err) { alert("Error al conectar"); }
        };
        reader.readAsDataURL(file);
    });
}

async function loadAdminCondos() {
    const container = document.getElementById('condos-list-admin');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        container.innerHTML = condos.map(c => `
            <div class="admin-box" style="border: 1px solid #ddd; padding: 10px; border-radius: 8px; background: #fff; text-align: center;">
                <img src="${c.foto_url}" style="width:100%; height:80px; object-fit:cover; border-radius:4px;">
                <h4 style="margin:5px 0; font-size:0.9rem;">${c.nombre}</h4>
                <p style="font-size:0.6rem; color: #888;">ID: ${c.id}</p>
                <button class="btn btn-sm" onclick="copyToClipboard('${c.id}')">Copiar ID</button>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

const resForm = document.getElementById('add-resident-form');
if (resForm) {
    resForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('res-name').value,
            email: document.getElementById('res-email').value,
            apartment: document.getElementById('res-apt').value,
            condo_id: document.getElementById('res-condo-id').value
        };
        const res = await fetch(`${API_BASE_URL}/residents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Residente vinculado.");
            resForm.reset();
            loadAdminResidents();
        }
    });
}

async function loadAdminResidents() {
    const list = document.getElementById('residents-list');
    if (!list) return;
    try {
        const res = await fetch(`${API_BASE_URL}/residents`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(r => `
            <tr>
                <td>${r.name}</td>
                <td>${r.apartment}</td>
                <td>${r.email}</td>
                <td><button class="btn-delete" onclick="deleteResident('${r.id}')">Eliminar</button></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// --- LÓGICA RESIDENTE ---
async function loadResidenteDashboard() {
    const visual = document.getElementById('mi-condominio-visual');
    if (!visual) return;
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        if (condos.length > 0) {
            const c = condos[0];
            visual.innerHTML = `
                <img src="${c.foto_url}" style="width:100%; border-radius:12px; margin-bottom:20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <h1 style="color:var(--primary-color);">Tu Hogar en ${c.nombre}</h1>
                <p>📍 <b>Dirección:</b> ${c.direccion}</p>
            `;
        } else {
            visual.innerHTML = "<h3>⚠️ Sin Edificio Asignado</h3>";
        }
    } catch (e) { console.error(e); }
}

// --- FUNCIONES DE UTILIDAD (CORREGIDAS) ---

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => alert("ID Copiado"));
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// CORRECCIÓN: Usar Query Parameter para el DELETE
async function deleteResident(id) {
    if (!confirm("¿Eliminar residente?")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/residents?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            alert("Eliminado.");
            loadAdminResidents();
        }
    } catch (e) { console.error("Error al borrar:", e); }
}