// ==============================================================================
// 1. CONFIGURACIÓN Y ESTADO GLOBAL
// ==============================================================================
const AWS_PROD_URL = 'https://lbhl4mazt9.execute-api.us-east-2.amazonaws.com/Prod/';

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
        const condos = await res.json();
        grid.innerHTML = condos.map(c => `
            <div class="card" onclick="exploreUnits('${c.id}', '${c.nombre}')" style="cursor:pointer; padding:0; overflow:hidden;">
                <img src="${c.foto_url}" style="width:100%; height:150px; object-fit:cover;">
                <div style="padding:15px;">
                    <h4 style="margin:0;">${c.nombre}</h4>
                    <p style="color:#64748b; font-size:0.8rem; margin-top:5px;">📍 ${c.direccion}</p>
                </div>
            </div>
        `).join('') || '<p style="text-align:center; width:100%;">No hay edificios registrados.</p>';
    } catch (e) { grid.innerHTML = `<p style="color:red; text-align:center; width:100%;">Error de conexión.</p>`; }
}

async function exploreUnits(condoId, condoName) {
    currentCondoId = condoId;
    const title = document.getElementById('market-title');
    const btnBack = document.getElementById('btn-back-to-condos');
    const grid = document.getElementById('available-grid');
    
    if(title && condoName) title.textContent = `Unidades en ${condoName}`;
    if(btnBack) btnBack.style.display = 'block';

    grid.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">Cargando unidades...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        grid.innerHTML = units.map(u => `
            <div class="card" style="padding:10px;">
                <img src="${u.foto_url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
                <div style="padding:10px 5px;">
                    <h5 style="margin:0;">${u.nombre}</h5>
                    <p style="font-weight:bold; color:#2563eb; font-size:1.2rem; margin:8px 0;">$${u.precio} <span style="font-size:0.8rem; color:#64748b; font-weight:normal;">/ día</span></p>
                    <button onclick="openReserveModal('${u.id}', '${u.nombre}', ${u.precio})" class="btn-primary" style="width:100%;">Reservar</button>
                </div>
            </div>
        `).join('') || '<p style="text-align:center; width:100%;">No hay unidades disponibles.</p>';
    } catch (e) { grid.innerHTML = '<p style="color:red;">Error al cargar unidades.</p>'; }
}

async function loadMyReservations() {
    const grid = document.getElementById('my-reservas-grid');
    if (!grid) return;
    grid.innerHTML = '<p style="text-align:center; width:100%;">Cargando reservas...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/units/my-reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
        const myRes = await res.json();

        grid.innerHTML = myRes.map(r => {
            const f1 = new Date(r.fecha_inicio).toLocaleString();
            const f2 = new Date(r.fecha_fin).toLocaleString();
            return `
            <div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border-left: 6px solid #2563eb; margin-bottom:15px; flex-wrap: wrap;">
                <img src="${r.unit_details?.foto_url || ''}" style="width: 140px; height: 100px; object-fit: cover; border-radius: 8px;">
                <div style="flex: 2; min-width: 250px;">
                    <h4 style="margin:0; font-size: 1.2rem;">${r.unit_details?.nombre || 'Unidad'}</h4>
                    <p style="margin: 0; color: #2563eb; font-weight: bold; font-size: 0.9rem;">🏢 ${r.unit_details?.condo_name || 'Condominio'}</p>
                    <div style="margin-top: 10px; font-size: 0.95rem; color: #475569; line-height: 1.6;">
                        <p style="margin:2px 0;">📅 <b>Entrada:</b> ${f1}</p>
                        <p style="margin:2px 0;">📅 <b>Salida:</b> ${f2}</p>
                    </div>
                </div>
                <div style="text-align: right; flex: 1; min-width: 120px;">
                    <p style="margin:0; font-size: 0.8rem; color: #64748b;">Total Pagado</p>
                    <p style="margin:0; font-size: 1.6rem; font-weight: 800; color: #2563eb;">$${r.total}</p>
                    <span class="badge-status status-disponible" style="margin-top:10px; display:inline-block;">Confirmada</span>
                </div>
            </div>
        `}).join('') || '<p style="text-align:center; width:100%; padding: 40px;">No tienes reservas activas.</p>';
    } catch (e) { grid.innerHTML = '<p style="color:red; text-align:center;">Error al cargar reservas.</p>'; }
}

// ==============================================================================
// 3. FUNCIONES ADMINISTRADOR
// ==============================================================================

async function loadAdminCondos() {
    const list = document.getElementById('condos-list-admin');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center; width:100%;">Cargando propiedades...</p>';
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        list.innerHTML = condos.map(c => `
            <div class="card" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; margin-bottom: 15px;">
                <img src="${c.foto_url}" style="width: 100%; height: 150px; object-fit: cover;">
                <div style="padding: 15px;">
                    <h3 style="margin: 0;">${c.nombre}</h3>
                    <p style="color: #64748b; font-size: 0.85rem;">📍 ${c.direccion}</p>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="viewUnits('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1;">👁️ Gestionar</button>
                        <button onclick="openUnitModal('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1;">➕ Unidad</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error("Error Admin:", e); }
}

async function viewUnits(condoId, condoName) {
    currentCondoId = condoId;
    if(condoName) document.getElementById('modal-condo-name').textContent = condoName;
    const container = document.getElementById('units-container');
    container.innerHTML = '<p style="text-align:center;">Cargando...</p>';
    document.getElementById('unit-modal').style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        container.innerHTML = units.map(u => {
            const isOcupado = u.estado === 'Ocupado';
            return `
            <div class="unit-card ${isOcupado ? 'ocupado' : 'disponible'}" style="padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom:10px;">
                <div style="display: flex; gap: 15px; align-items: center; flex: 1;">
                    <img src="${u.foto_url}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px;">
                    <div style="flex: 1;">
                        <h5 style="margin:0; font-size:1.1rem;">${u.nombre} <span style="font-weight:normal; color:#64748b;">($${u.precio}/día)</span></h5>
                        <span class="badge-status ${isOcupado ? 'status-ocupado' : 'status-disponible'}">${u.estado}</span>
                        ${isOcupado ? `
                            <div style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; font-size: 0.85rem;">
                                <p style="margin:0;">👤 <b>Inquilino:</b> ${u.ocupado_por}</p>
                                <p style="margin:2px 0;">📅 <b>Check-in:</b> ${new Date(u.fecha_inicio).toLocaleString()}</p>
                                <p style="margin:2px 0;">📅 <b>Check-out:</b> ${new Date(u.fecha_fin).toLocaleString()}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="openTaskModal('${u.id}', '${condoId}')" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Asignar Mantenimiento">🛠️</button>
                    <button onclick="toggleDeleteUnit('${u.id}', ${u.borrado_logico || false}, '${u.condo_id}')" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">${u.borrado_logico ? '🔄' : '🗑️'}</button>
                </div>
            </div>
        `}).join('') || '<p style="text-align:center;">Sin unidades registradas.</p>';
    } catch (e) { container.innerHTML = 'Error al cargar unidades.'; }
}

async function toggleDeleteUnit(unitId, isDeleted, condoId) {
    if (!confirm(`¿Deseas ${isDeleted ? 'Reactivar' : 'Ocultar'} esta unidad?`)) return;
    try {
        await fetch(`${API_BASE_URL}/units`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: unitId, action: isDeleted ? 'activate' : 'delete', condo_id: condoId })
        });
        viewUnits(condoId, document.getElementById('modal-condo-name').textContent);
    } catch (e) { alert("Error al actualizar estado"); }
}

// ==============================================================================
// 4. FUNCIONES MANTENIMIENTO (NUEVO)
// ==============================================================================

async function loadMaintenanceTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;">Cargando tareas...</p>';
    try {
        const res = await fetch(`${API_BASE_URL}/maintenance/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
        const tasks = await res.json();
        container.innerHTML = tasks.map(t => `
            <div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border-left: 6px solid ${t.status === 'Completado' ? '#22c55e' : '#eab308'}; margin-bottom:15px;">
                <div style="flex: 1;">
                    <h4 style="margin:0;">${t.descripcion}</h4>
                    <p style="margin:5px 0; color:#64748b; font-size:0.9rem;">📍 Unidad ID: ${t.unit_id}</p>
                    <p style="font-size:0.8rem; color:#94a3b8;">📅 Asignada: ${new Date(t.fecha).toLocaleString()}</p>
                </div>
                <select onchange="updateTaskStatus('${t.id}', this.value)" style="padding:10px; border-radius:8px; border:1px solid #e2e8f0; background:white;">
                    <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                    <option value="En Progreso" ${t.status === 'En Progreso' ? 'selected' : ''}>🚧 En Progreso</option>
                    <option value="Completado" ${t.status === 'Completado' ? 'selected' : ''}>✅ Completado</option>
                </select>
            </div>
        `).join('') || '<p style="text-align:center; width:100%;">No tienes tareas de mantenimiento asignadas.</p>';
    } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Error al cargar tareas.</p>'; }
}

async function updateTaskStatus(taskId, newStatus) {
    try {
        await fetch(`${API_BASE_URL}/maintenance/tasks`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskId, status: newStatus })
        });
    } catch (e) { alert("Error al actualizar tarea."); }
}

function openTaskModal(unitId, condoId) {
    document.getElementById('task-unit-id').value = unitId;
    document.getElementById('task-condo-id').value = condoId;
    document.getElementById('task-modal').style.display = 'flex';
}

// ==============================================================================
// 5. TIEMPO REAL (WEBSOCKETS)
// ==============================================================================

function initWS() {
    if (!WS_URL) return;
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'REFRESH') {
            if (userData.role === 'admin') loadAdminCondos();
            else if (userData.role === 'residente') loadResidenteDashboard(); 
        }
        if (data.action === 'REFRESH_UNITS') {
            if (userData.role === 'admin') {
                if (currentCondoId === data.condo_id) viewUnits(data.condo_id, "");
            } else if (userData.role === 'residente') {
                if (currentCondoId === data.condo_id && document.getElementById('view-market').style.display === 'block') exploreUnits(currentCondoId, "");
                if (document.getElementById('view-reservas').style.display === 'block') loadMyReservations();
            }
        }
        if (data.action === 'REFRESH_TASKS') {
            if (userData.role === 'mantenimiento' || userData.role === 'admin') loadMaintenanceTasks();
        }
    };
    socket.onclose = () => setTimeout(initWS, 3000);
}

// ==============================================================================
// 6. MODALES Y NAVEGACIÓN
// ==============================================================================

function switchTab(tab) {
    const market = document.getElementById('view-market'), reservas = document.getElementById('view-reservas');
    const tabM = document.getElementById('tab-market'), tabR = document.getElementById('tab-reservas');
    if (tab === 'market') {
        market.style.display = 'block'; reservas.style.display = 'none';
        tabM.classList.add('active'); tabR.classList.remove('active');
        loadResidenteDashboard();
    } else {
        market.style.display = 'none'; reservas.style.display = 'block';
        tabM.classList.remove('active'); tabR.classList.add('active');
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

function openReserveModal(id, nombre, precio) {
    document.getElementById('reserve-unit-id').value = id;
    document.getElementById('reserve-unit-price').value = precio;
    document.getElementById('reserve-unit-name').textContent = nombre;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const formatted = now.toISOString().slice(0, 19);
    document.getElementById('reserve-start').min = formatted;
    document.getElementById('reserve-end').min = formatted;
    document.getElementById('reserve-total-display').textContent = '$0.00';
    document.getElementById('reserve-modal').style.display = 'flex';
}

function calculateTotal() {
    const start = document.getElementById('reserve-start').value;
    const end = document.getElementById('reserve-end').value;
    const pricePerDay = parseFloat(document.getElementById('reserve-unit-price').value);
    const display = document.getElementById('reserve-total-display');
    const btn = document.getElementById('btn-confirm-reserve');
    if (start && end) {
        const diffSecs = (new Date(end) - new Date(start)) / 1000;
        if (diffSecs > 0) {
            let total = (diffSecs / 86400) * pricePerDay;
            if (total < 0.01) total = 0.01;
            display.textContent = `$${total.toFixed(2)}`;
            display.dataset.total = total;
            btn.disabled = false;
        } else { btn.disabled = true; display.textContent = "Error tiempo"; }
    }
}

// MÁSCARA AUTOMÁTICA MM/YY (PAGO)
document.getElementById('pay-exp')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, ''); 
    if (v.length >= 2) e.target.value = v.slice(0, 2) + '/' + v.slice(2, 4);
    else e.target.value = v;
});

document.getElementById('reserve-start')?.addEventListener('change', calculateTotal);
document.getElementById('reserve-end')?.addEventListener('change', calculateTotal);

// ==============================================================================
// 7. FORMULARIOS (ENVÍO)
// ==============================================================================

document.getElementById('task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        unit_id: document.getElementById('task-unit-id').value,
        condo_id: document.getElementById('task-condo-id').value,
        assigned_to: document.getElementById('task-tech-email').value,
        descripcion: document.getElementById('task-desc').value
    };
    try {
        const res = await fetch(`${API_BASE_URL}/maintenance/tasks`, {
            method: 'POST',
            headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        if(res.ok) {
            alert("✅ Tarea asignada exitosamente.");
            closeModal('task-modal');
            e.target.reset();
        } else { alert("Error al asignar tarea."); }
    } catch (e) { alert("Error de conexión."); }
});

document.getElementById('reserve-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const exp = document.getElementById('pay-exp').value;
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) { alert("Fecha MM/YY inválida."); return; }
    
    const btn = document.getElementById('btn-confirm-reserve');
    btn.disabled = true; btn.textContent = "Validando Pago...";
    
    const payload = {
        unit_id: document.getElementById('reserve-unit-id').value,
        total: parseFloat(document.getElementById('reserve-total-display').dataset.total),
        condo_id: currentCondoId,
        tarjeta: document.getElementById('pay-card').value,
        fecha_inicio: new Date(document.getElementById('reserve-start').value).toISOString(),
        fecha_fin: new Date(document.getElementById('reserve-end').value).toISOString()
    };

    try {
        const res = await fetch(`${API_BASE_URL}/units/reserve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if(res.ok){
            alert("✅ Pago y Reserva Confirmados.");
            closeModal('reserve-modal');
            switchTab('reservas');
        } else { alert("Error en el pago."); }
    } catch (e) { alert("Error conexión."); } 
    finally { btn.textContent = "Pagar y Confirmar"; btn.disabled = false; }
});

// AÑADIR EDIFICIO
document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const nombre = document.getElementById('condo-nombre').value, direccion = document.getElementById('condo-direccion').value;
    const file = document.getElementById('condo-file').files[0];
    try {
        const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} });
        const { upload_url, file_key } = await resSig.json();
        await fetch(upload_url, { method: 'PUT', body: file });
        await fetch(`${API_BASE_URL}/condos`, { method: 'PUT', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ nombre, direccion, file_key }) });
        alert("✅ Edificio registrado");
        e.target.reset(); loadAdminCondos();
    } catch (err) { alert("Error al registrar edificio"); }
});

// AÑADIR UNIDAD
document.getElementById('add-unit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const condo_id = document.getElementById('modal-condo-id').value, nombre = document.getElementById('unit-nombre').value, precio = document.getElementById('unit-precio').value;
    const file = document.getElementById('unit-file').files[0];
    try {
        const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} });
        const { upload_url, file_key } = await resSig.json();
        await fetch(upload_url, { method: 'PUT', body: file });
        await fetch(`${API_BASE_URL}/units`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ condo_id, nombre, precio, file_key }) });
        alert("✅ Unidad creada");
        closeModal('add-unit-modal'); viewUnits(condo_id, "");
    } catch (err) { alert("Error al crear unidad"); }
});

// ==============================================================================
// 8. INICIALIZACIÓN
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (userData) {
        document.getElementById('user-email').textContent = userData.email;
        fetch(`${API_BASE_URL}/config`).then(r => r.json()).then(c => { 
            WS_URL = c.ws_url; 
            initWS(); 
        });

        if (userData.role === 'admin') {
            document.getElementById('admin-section').style.display = 'block';
            if (userData.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()) document.getElementById('super-user-controls').style.display = 'block';
            loadAdminCondos();
        } else if (userData.role === 'mantenimiento') {
            document.getElementById('mantenimiento-section').style.display = 'block';
            loadMaintenanceTasks();
        } else {
            document.getElementById('residente-section').style.display = 'block';
            loadResidenteDashboard();
        }
    }
});

async function createToken(type) {
    const res = await fetch(`${API_BASE_URL}/admin/token`, { method:'POST', headers:{'Authorization':`Bearer ${token}`}, body: JSON.stringify({type}) });
    const data = await res.json();
    prompt(`Token de ${type} generado:`, data.token);
}