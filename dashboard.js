// ==============================================================================
// 1. CONFIGURACIÓN Y ESTADO GLOBAL
// ==============================================================================
const AWS_PROD_URL = 'https://hpqvi22yyd.execute-api.us-east-2.amazonaws.com/Prod';

const getBaseUrl = () => {
    const origin = window.location.origin;
    if (origin.includes('127.0.0.1') || origin.includes('localhost')) return AWS_PROD_URL;
    return origin + (window.location.pathname.includes('/Prod') ? '/Prod' : '');
};

const API_BASE_URL = getBaseUrl();
let WS_URL = ""; 
const SUPER_USER_EMAIL = 'admin@admin.com'; 

const token = localStorage.getItem('token');
const userData = token ? JSON.parse(atob(token.split('.')[1])) : null;
let currentCondoId = null; 

if (!token) window.location.href = 'index.html';

// ==============================================================================
// 2. FUNCIONES DE CARGA (RESIDENTE)
// ==============================================================================

async function loadResidenteDashboard() {
    currentCondoId = null;
    const grid = document.getElementById('available-grid');
    const marketTitle = document.getElementById('market-title');
    const btnBack = document.getElementById('btn-back-to-condos');
    
    if (marketTitle) marketTitle.textContent = "Edificios Disponibles";
    if (btnBack) btnBack.style.display = 'none';
    if (!grid) return;

    grid.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">Cargando edificios...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        const condos = await res.json();

        if (condos.length === 0) {
            grid.innerHTML = '<p style="text-align:center; width:100%;">No hay edificios registrados en el sistema.</p>';
            return;
        }

        grid.innerHTML = condos.map(c => `
            <div class="card" onclick="exploreUnits('${c.id}', '${c.nombre}')" style="cursor:pointer; padding:0; overflow:hidden;">
                <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover;">
                <div style="padding:15px;">
                    <h4 style="margin:0;">${c.nombre}</h4>
                    <p style="color:#64748b; font-size:0.8rem; margin-top:5px;">📍 ${c.direccion}</p>
                </div>
            </div>
        `).join('');
    } catch (e) { grid.innerHTML = `<p style="color:#ef4444; text-align:center; width:100%;">Error de conexión: ${e.message}</p>`; }
}

async function exploreUnits(condoId, condoName) {
    currentCondoId = condoId;
    const title = document.getElementById('market-title');
    const btnBack = document.getElementById('btn-back-to-condos');
    const grid = document.getElementById('available-grid');
    
    if(title && condoName) title.textContent = `Unidades en ${condoName}`;
    if(btnBack) btnBack.style.display = 'block';

    grid.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">Cargando unidades disponibles...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();

        if (units.length === 0) {
            grid.innerHTML = `<div style="text-align:center; width:100%; padding: 40px; background: #f8fafc; border-radius: 8px;">
                                <h3>No hay unidades disponibles</h3>
                              </div>`;
            return;
        }
        
        grid.innerHTML = units.map(u => `
            <div class="card" style="padding:10px;">
                <img src="${u.foto_url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
                <div style="padding:10px 5px;">
                    <h5 style="margin:0; font-size: 1.1rem;">${u.nombre}</h5>
                    <p style="font-weight:bold; color:#2563eb; font-size:1.2rem; margin:8px 0;">$${u.precio} <span style="font-size:0.8rem; color:#64748b; font-weight:normal;">/ noche</span></p>
                    <button onclick="openReserveModal('${u.id}', '${u.nombre}', ${u.precio})" class="btn-primary" style="width:100%;">Reservar</button>
                </div>
            </div>
        `).join('');
    } catch (e) { grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Error al conectar con la base de datos.</p>'; }
}

async function loadMyReservations() {
    const grid = document.getElementById('my-reservas-grid');
    if (!grid) return;
    grid.innerHTML = '<p style="text-align:center; width:100%;">Cargando tus reservas...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/units/my-reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
        const myRes = await res.json();

        grid.innerHTML = myRes.map(r => `
            <div class="card" style="display: flex; gap: 20px; padding: 15px; align-items: center; border-left: 5px solid #2563eb; margin-bottom:10px;">
                <img src="${r.unit_details?.foto_url || ''}" style="width: 100px; height: 70px; object-fit: cover; border-radius: 8px;">
                <div style="flex: 1;">
                    <h4 style="margin:0;">${r.unit_details?.nombre || 'Unidad'}</h4>
                    <p style="margin:4px 0; color: #64748b; font-size: 0.9rem;">
                        📅 ${r.fecha_inicio || 'N/A'} ➔ ${r.fecha_fin || 'N/A'}<br>
                        Pagado: <b>$${r.total}</b>
                    </p>
                </div>
                <div class="badge-status status-disponible">Confirmada</div>
            </div>
        `).join('') || '<p style="text-align:center; width:100%;">No tienes reservas aún.</p>';
    } catch (e) { grid.innerHTML = '<p style="text-align:center; width:100%;">Error al cargar reservas.</p>'; }
}

// ==============================================================================
// 3. FUNCIONES DE ADMINISTRADOR Y SUPER ADMIN
// ==============================================================================

async function loadAdminCondos() {
    const list = document.getElementById('condos-list-admin');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center; width:100%;">Cargando tus propiedades...</p>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        
        // Tarjetas rediseñadas para evitar el desbordamiento (Layout vertical adaptable)
        list.innerHTML = condos.map(c => `
            <div class="card" style="display: flex; flex-direction: column; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 15px;">
                <img src="${c.foto_url}" style="width: 100%; height: 150px; object-fit: cover;">
                
                <div style="padding: 15px; display: flex; flex-direction: column; flex: 1;">
                    <h3 style="margin: 0; font-size: 1.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.nombre}</h3>
                    <p style="color: #64748b; font-size: 0.85rem; margin: 5px 0 15px 0;">📍 ${c.direccion}</p>
                    
                    <div style="display: flex; gap: 10px; margin-top: auto;">
                        <button onclick="viewUnits('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1; padding: 10px 5px; font-size: 0.9rem;">👁️ Gestionar</button>
                        <button onclick="openUnitModal('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1; padding: 10px 5px; font-size: 0.9rem;">➕ Unidad</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error("Error Admin Condos:", e); }
}

async function viewUnits(condoId, condoName) {
    currentCondoId = condoId;
    document.getElementById('modal-condo-name').textContent = condoName;
    const container = document.getElementById('units-container');
    container.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando unidades...</p>';
    document.getElementById('unit-modal').style.display = 'flex';
    
    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        
        container.innerHTML = units.map(u => `
            <div class="unit-card ${u.estado === 'Ocupado' ? 'ocupado' : 'disponible'}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:15px; align-items:center;">
                        <img src="${u.foto_url}" style="width:60px; height:60px; border-radius:6px; object-fit:cover;">
                        <div>
                            <h5 style="margin:0;">${u.nombre} <span style="color:#2563eb;">($${u.precio}/día)</span></h5>
                            <span class="badge-status">${u.estado} ${u.borrado_logico ? '<b style="color:red;">- OCULTO</b>' : ''}</span>
                            ${u.estado === 'Ocupado' ? `<p style="margin:5px 0 0 0; font-size:0.75rem; color:#64748b; line-height: 1.4;">
                                👤 Reservado por: <b>${u.ocupado_por || 'N/A'}</b><br>
                                📅 Del: ${u.fecha_inicio || '?'} al ${u.fecha_fin || '?'}
                            </p>` : ''}
                        </div>
                    </div>
                    <button onclick="toggleDeleteUnit('${u.id}', ${u.borrado_logico || false}, '${u.condo_id}')" style="border:none; background:none; cursor:pointer; font-size:1.2rem;" title="${u.borrado_logico ? 'Reactivar' : 'Ocultar'}">
                        ${u.borrado_logico ? '🔄' : '🗑️'}
                    </button>
                </div>
            </div>
        `).join('') || '<p style="text-align:center;">No hay unidades registradas en este edificio.</p>';
    } catch (e) { container.innerHTML = '<p style="text-align:center; color:red;">Error al cargar unidades.</p>'; }
}

async function toggleDeleteUnit(unitId, isDeleted, condoId) {
    const action = isDeleted ? 'activate' : 'delete';
    if (!confirm(`¿Deseas ${isDeleted ? 'Reactivar' : 'Dar de baja (Ocultar)'} esta unidad?`)) return;

    try {
        await fetch(`${API_BASE_URL}/units`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: unitId, action: action, condo_id: condoId })
        });
        viewUnits(condoId, document.getElementById('modal-condo-name').textContent);
    } catch (e) { alert("Error al actualizar estado"); }
}

async function createInviteToken() {
    const btn = document.querySelector('.master-card button');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando...";

    try {
        const res = await fetch(`${API_BASE_URL}/admin/token`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
        const data = await res.json();
        
        if (res.ok) prompt("✅ Token Maestro generado con éxito. Cópialo y compártelo:", data.token);
        else alert("❌ Error: " + data.msg);
    } catch (e) { alert("Error de conexión al generar el token."); } 
    finally { btn.disabled = false; btn.textContent = originalText; }
}

// ==============================================================================
// 4. TIEMPO REAL (WEBSOCKETS)
// ==============================================================================

function initWS() {
    if (!WS_URL) return;
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'REFRESH' && userData.role === 'admin') loadAdminCondos();
        if (data.action === 'REFRESH_UNITS' && currentCondoId === data.condo_id) {
            if (userData.role === 'admin') viewUnits(data.condo_id, document.getElementById('modal-condo-name').textContent);
            else exploreUnits(currentCondoId, document.getElementById('market-title').textContent.replace('Unidades en ', ''));
        }
    };
    socket.onclose = () => setTimeout(initWS, 3000);
}

async function fetchServerConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/config`);
        const config = await res.json();
        WS_URL = config.ws_url;
        initWS();
    } catch (e) { console.error("Error auto-config WS:", e); }
}

// ==============================================================================
// 5. MODALES Y NAVEGACIÓN
// ==============================================================================

function switchTab(tab) {
    const market = document.getElementById('view-market'), reservas = document.getElementById('view-reservas');
    const tabM = document.getElementById('tab-market'), tabR = document.getElementById('tab-reservas');
    if (!market || !reservas) return;

    if (tab === 'market') {
        market.style.display = 'block'; reservas.style.display = 'none';
        if(tabM) tabM.classList.add('active'); if(tabR) tabR.classList.remove('active');
        loadResidenteDashboard();
    } else {
        market.style.display = 'none'; reservas.style.display = 'block';
        if(tabM) tabM.classList.remove('active'); if(tabR) tabR.classList.add('active');
        loadMyReservations();
    }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }

function openUnitModal(id, nombre) {
    document.getElementById('modal-condo-id').value = id;
    document.getElementById('modal-condo-unit-name').textContent = nombre;
    document.getElementById('add-unit-modal').style.display = 'flex';
}

// Abre el modal del calendario
function openReserveModal(id, nombre, precio) {
    document.getElementById('reserve-unit-id').value = id;
    document.getElementById('reserve-unit-price').value = precio;
    document.getElementById('reserve-unit-name').textContent = nombre;
    
    // Bloquear fechas anteriores a hoy
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reserve-start').min = today;
    document.getElementById('reserve-end').min = today;
    
    // Limpiar campos
    document.getElementById('reserve-start').value = '';
    document.getElementById('reserve-end').value = '';
    document.getElementById('reserve-total-display').textContent = '$0.00';
    document.getElementById('reserve-total-display').dataset.total = '0';
    document.getElementById('btn-confirm-reserve').disabled = true;

    document.getElementById('reserve-modal').style.display = 'flex';
}

// Calcula el total automáticamente cuando cambian las fechas
function calculateTotal() {
    const start = document.getElementById('reserve-start').value;
    const end = document.getElementById('reserve-end').value;
    const price = parseFloat(document.getElementById('reserve-unit-price').value);
    const display = document.getElementById('reserve-total-display');
    const btn = document.getElementById('btn-confirm-reserve');

    if (start && end) {
        const d1 = new Date(start);
        const d2 = new Date(end);
        const diffTime = d2 - d1;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays > 0) {
            const total = diffDays * price;
            display.textContent = `$${total.toFixed(2)}`;
            display.dataset.total = total; // Guardamos el valor numérico
            btn.disabled = false;
        } else {
            display.textContent = "Fechas inválidas";
            display.dataset.total = '0';
            btn.disabled = true;
        }
    } else {
        display.textContent = "$0.00";
        btn.disabled = true;
    }
}

// Agregar los listeners para que calculen al vuelo
document.getElementById('reserve-start')?.addEventListener('change', calculateTotal);
document.getElementById('reserve-end')?.addEventListener('change', calculateTotal);


// ==============================================================================
// 6. EVENT LISTENERS (FORMULARIOS DE CREACIÓN Y RESERVAS)
// ==============================================================================

// ENVIAR RESERVA A AWS
document.getElementById('reserve-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const unitId = document.getElementById('reserve-unit-id').value;
    const total = parseFloat(document.getElementById('reserve-total-display').dataset.total);
    const fecha_inicio = document.getElementById('reserve-start').value;
    const fecha_fin = document.getElementById('reserve-end').value;
    
    const btn = document.getElementById('btn-confirm-reserve');
    btn.disabled = true;
    btn.textContent = "Procesando...";

    try {
        const res = await fetch(`${API_BASE_URL}/units/reserve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                unit_id: unitId, 
                total: total, 
                condo_id: currentCondoId,
                fecha_inicio: fecha_inicio,
                fecha_fin: fecha_fin
            })
        });
        
        if(res.ok){
            alert("✅ ¡Reserva Exitosa!");
            closeModal('reserve-modal');
            switchTab('reservas');
        } else {
            alert("Error al procesar la reserva. Puede que ya esté ocupada.");
        }
    } catch (e) { 
        alert("Error de conexión al reservar"); 
    } finally {
        btn.textContent = "Confirmar Reserva";
    }
});


document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = "Registrando Edificio...";

    const nombre = document.getElementById('condo-nombre').value;
    const direccion = document.getElementById('condo-direccion').value;
    const file = document.getElementById('condo-file').files[0];

    try {
        const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} });
        const { upload_url, file_key } = await resSig.json();
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        await fetch(`${API_BASE_URL}/condos`, {
            method: 'PUT', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({ nombre, direccion, file_key })
        });
        alert("✅ Edificio registrado exitosamente");
        e.target.reset(); loadAdminCondos(); 
    } catch (err) { alert("Error al registrar el edificio"); } 
    finally { btn.disabled = false; btn.textContent = originalText; }
});

document.getElementById('add-unit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = "Subiendo imagen y guardando...";

    const condo_id = document.getElementById('modal-condo-id').value;
    const nombre = document.getElementById('unit-nombre').value;
    const precio = document.getElementById('unit-precio').value;
    const file = document.getElementById('unit-file').files[0];

    try {
        const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} });
        const { upload_url, file_key } = await resSig.json();
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        await fetch(`${API_BASE_URL}/units`, {
            method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({ condo_id, nombre, precio, file_key })
        });
        alert("✅ Unidad creada");
        closeModal('add-unit-modal');
        e.target.reset(); 
        viewUnits(condo_id, document.getElementById('modal-condo-name').textContent);
    } catch (err) { alert("Error al guardar unidad"); } 
    finally { btn.disabled = false; btn.textContent = originalText; }
});

// ==============================================================================
// 7. INICIALIZACIÓN
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (userData) {
        document.getElementById('user-email').textContent = userData.email;
        fetchServerConfig();

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
    }
});