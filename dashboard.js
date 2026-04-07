// --- CONFIGURACIÓN ---
const API_BASE_URL = 'https://7y2exkoxi2.execute-api.us-east-2.amazonaws.com/Prod'; 
const token = localStorage.getItem('token');

if (!token) window.location.href = 'index.html';

function parseJwt(token) {
    try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; }
}
const userData = parseJwt(token);

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if (!userData) { logout(); return; }
    document.getElementById('user-email').textContent = userData.email;

    if (userData.role === 'admin') {
        document.getElementById('admin-section').style.display = 'block';
        loadAdminCondos();
        loadAdminResidents();
    } else {
        document.getElementById('residente-section').style.display = 'block';
        loadResidenteDashboard();
    }
});

// --- LÓGICA ADMIN: CONDOMINIOS ---

const condoFileInput = document.getElementById('condo-file');
if (condoFileInput) {
    condoFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.size > 5 * 1024 * 1024) {
            alert("Imagen muy pesada (Máx 5MB)");
            this.value = ""; return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const preview = document.getElementById('preview');
            preview.src = reader.result; preview.style.display = 'block';
        };
        if (file) reader.readAsDataURL(file);
    });
}

document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
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
        const res = await fetch(`${API_BASE_URL}/condos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) { alert("¡Condominio Creado!"); location.reload(); }
    };
    reader.readAsDataURL(file);
});

async function loadAdminCondos() {
    const container = document.getElementById('condos-list-admin');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        
        container.innerHTML = condos.map(c => {
            const estado = c.estado || 'Disponible';
            return `
                <div class="admin-box" style="border: 2px solid ${getStatusColor(estado)}; padding: 10px; border-radius: 8px; background: #fff; text-align: center;">
                    <img src="${c.foto_url}" style="width:100%; height:80px; object-fit:cover; border-radius:4px;">
                    <h4 style="margin:5px 0; font-size: 0.9rem;">${c.nombre}</h4>
                    
                    <div style="margin: 8px 0;">
                        <span style="background: ${getStatusColor(estado)}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">
                            ${estado}
                        </span>
                    </div>

                    <p style="font-size:0.65rem; color: #888; margin-bottom: 5px;">ID: ${c.id}</p>
                    <button class="btn-sm" onclick="copyId('${c.id}')" style="font-size: 0.7rem; padding: 2px 8px; cursor: pointer;">
                        Copiar ID
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) { console.error("Error cargando condominios:", e); }
}

// --- LÓGICA ADMIN: RESIDENTES ---

document.getElementById('add-resident-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('res-name').value,
        email: document.getElementById('res-email').value,
        apartment: document.getElementById('res-apt').value,
        condo_id: document.getElementById('res-condo-id').value.trim() 
    };
    const res = await fetch(`${API_BASE_URL}/residents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
    });
    if (res.ok) { 
        alert("Residente Vinculado y Edificio Ocupado"); 
        document.getElementById('add-resident-form').reset();
        loadAdminResidents(); 
        loadAdminCondos(); // Actualización inmediata del estado visual
    }
});

async function loadAdminResidents() {
    const list = document.getElementById('residents-list');
    if (!list) return;

    try {
        const [resRes, condosRes] = await Promise.all([
            fetch(`${API_BASE_URL}/residents`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const residents = await resRes.json();
        const condos = await condosRes.json();

        const condoMap = {};
        condos.forEach(c => { condoMap[c.id] = c.nombre; });

        list.innerHTML = residents.map(r => {
            const nombreEdificio = condoMap[r.condo_id] || "⚠️ No encontrado";
            return `
                <tr>
                    <td>${r.name}</td>
                    <td>${r.apartment}</td>
                    <td>${r.email}</td>
                    <td>
                        <div style="font-size: 0.85rem; font-weight: bold;">${nombreEdificio}</div>
                        <div style="font-size: 0.65rem; color: #888;">ID: ${r.condo_id}</div>
                    </td>
                    <td><button class="btn-delete" onclick="deleteResident('${r.id}')">Eliminar</button></td>
                </tr>
            `;
        }).join('');
    } catch (e) { console.error("Error en tabla:", e); }
}

async function deleteResident(id) {
    if (!confirm("¿Eliminar residente? El edificio volverá a estar Disponible.")) return;
    const res = await fetch(`${API_BASE_URL}/residents?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        loadAdminResidents();
        loadAdminCondos(); // El edificio se libera automáticamente en el backend
    }
}

// --- LÓGICA RESIDENTE ---

async function loadResidenteDashboard() {
    const visual = document.getElementById('mi-condominio-visual');
    if (!visual) return;

    try {
        const res = await fetch(`${API_BASE_URL}/condos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const condos = await res.json();

        if (condos && condos.length > 0) {
            const c = condos[0];
            const estado = c.estado || 'Disponible';
            visual.innerHTML = `
                <div style="background:${getStatusColor(estado)}; color:white; padding:10px; border-radius:8px; margin-bottom:15px; font-weight:bold; text-transform: uppercase;">
                    ESTADO ACTUAL: ${estado}
                </div>
                <img src="${c.foto_url}" style="width:100%; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" onerror="this.src='https://via.placeholder.com/400x200?text=Error+al+cargar+foto+de+S3'">
                <h1 style="margin-top:20px;">Bienvenido a ${c.nombre}</h1>
                <p style="font-size: 1.1rem;">📍 <b>Dirección:</b> ${c.direccion}</p>
                <div style="margin-top:20px; padding:15px; border-radius:8px; background:#e3f2fd; color:#0d47a1;">
                    Tu residencia figura como: <b>${estado}</b>
                </div>
            `;
        } else {
            visual.innerHTML = `<div style="padding:50px; text-align:center;"><h3>⚠️ Sin Edificio Asignado</h3><p>Tu administrador aún no te ha vinculado a un condominio.</p></div>`;
        }
    } catch (e) { visual.innerHTML = "<h3>Error al conectar con el servidor.</h3>"; }
}

// --- UTILS ---
function getStatusColor(s) {
    if (s === 'Ocupado') return '#ef4444'; 
    if (s === 'Apartado') return '#f59e0b'; 
    return '#10b981'; 
}

function copyId(id) { 
    navigator.clipboard.writeText(id).then(() => { alert("ID Copiado: " + id); });
}

function logout() { 
    localStorage.clear(); 
    window.location.href = 'index.html'; 
}