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

const fallbackImageCondo = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22150%22 style=%22background:%23e2e8f0%22%3E%3Ctext fill=%22%2394a3b8%22 y=%2250%25%22 x=%2250%25%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216px%22%3ESin Imagen%3C/text%3E%3C/svg%3E";
const fallbackImageUnit = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22 style=%22background:%23e2e8f0%22%3E%3Ctext fill=%22%2394a3b8%22 y=%2250%25%22 x=%2250%25%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224px%22%3EX%3C/text%3E%3C/svg%3E";

if (!token) window.location.href = 'index.html';

// ==============================================================================
// 2. TABS Y NAVEGACIÓN
// ==============================================================================
function switchTab(tab) {
    const market = document.getElementById('view-market');
    const reservas = document.getElementById('view-reservas');
    const anuncios = document.getElementById('view-anuncios');
    
    document.getElementById('tab-market')?.classList.remove('active');
    document.getElementById('tab-reservas')?.classList.remove('active');
    document.getElementById('tab-anuncios')?.classList.remove('active');
    
    market.style.display = 'none';
    reservas.style.display = 'none';
    anuncios.style.display = 'none';

    if (tab === 'market') { 
        market.style.display = 'block'; 
        document.getElementById('tab-market').classList.add('active'); 
        loadResidenteDashboard();
    } else if (tab === 'reservas') { 
        reservas.style.display = 'block'; 
        document.getElementById('tab-reservas').classList.add('active'); 
        loadMyReservations(); 
    } else if (tab === 'anuncios') {
        anuncios.style.display = 'block';
        document.getElementById('tab-anuncios').classList.add('active');
        loadAnnouncements();
    }
}

// ==============================================================================
// 3. COMUNIDAD, INCIDENTES Y TAREAS
// ==============================================================================
async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    const adminContainer = document.getElementById('admin-announcements-list');
    try {
        const res = await fetch(`${API_BASE_URL}/announcements`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const html = data.map(a => `
            <div style="padding:10px; border-bottom:1px solid #e2e8f0; margin-bottom:5px; position:relative;">
                ${userData.role === 'admin' ? `<button onclick="deleteAnnouncement('${a.id}')" style="position:absolute; right:5px; top:5px; background:none; border:none; cursor:pointer;" title="Borrar">🗑️</button>` : ''}
                <strong style="color:#1e293b;">${a.titulo}</strong>
                <p style="margin:5px 0 0 0; color:#475569; font-size:0.9rem;">${a.mensaje}</p>
                <small style="color:#94a3b8;">${new Date(a.fecha).toLocaleDateString()}</small>
            </div>
        `).join('') || '<p style="color:#64748b; font-size:0.9rem;">No hay anuncios para mostrar.</p>';
        
        if (container) container.innerHTML = html;
        if (adminContainer) adminContainer.innerHTML = html;
    } catch(e) {}
}

async function deleteAnnouncement(id) {
    if(!confirm("¿Deseas borrar este anuncio?")) return;
    await fetch(`${API_BASE_URL}/announcements`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id}) });
}

async function openIncidentModal() {
    const select = document.getElementById('incident-unit-id');
    select.innerHTML = '<option value="">Cargando tus unidades...</option>';
    document.getElementById('incident-modal').style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE_URL}/units/my-reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
        const myRes = await res.json();
        select.innerHTML = '<option value="">Selecciona la unidad con problemas...</option>' + 
            myRes.map(r => `<option value="${r.unit_id}">${r.unit_details?.nombre} (${r.unit_details?.condo_name})</option>`).join('');
    } catch(e) { select.innerHTML = '<option value="">Error al cargar</option>'; }
}

async function loadIncidentsAdmin() {
    const container = document.getElementById('incidents-admin-container');
    if (!container) return;
    const res = await fetch(`${API_BASE_URL}/incidents`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    container.innerHTML = data.map(i => {
        let statusColor = '#eab308'; // Pendiente amarillo
        let badgeClass = 'status-ocupado';
        
        if(i.estado === 'Resuelto' || i.estado === 'Completado') {
            statusColor = '#22c55e'; badgeClass = 'status-disponible';
        } else if (i.estado === 'En Progreso') {
            statusColor = '#f59e0b'; badgeClass = 'status-progreso';
        }

        return `
        <div class="card" style="border-left: 5px solid ${statusColor}; margin-bottom:10px; padding:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h5 style="margin:0;">Reporte de ${i.residente} <span class="badge-status ${badgeClass}">${i.estado}</span></h5>
                    <p style="margin:5px 0; font-size:0.85rem; color:#475569;">${i.descripcion}</p>
                    <small>Unidad: ${i.unit_id} | Reportado: ${new Date(i.fecha).toLocaleString()}</small>
                </div>
            </div>
        </div>
        `;
    }).join('') || '<p>No hay incidentes reportados.</p>';
}

async function loadMaintenanceTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;">Cargando tareas...</p>';
    const res = await fetch(`${API_BASE_URL}/maintenance/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
    const tasks = await res.json();
    container.innerHTML = tasks.map(t => `<div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border-left: 6px solid ${t.status === 'Completado' ? '#22c55e' : (t.status === 'En Progreso' ? '#f59e0b' : '#eab308')}; margin-bottom:15px;"><div style="flex: 1;"><h4 style="margin:0;">${t.descripcion}</h4><p style="margin:5px 0; color:#64748b; font-size:0.9rem;">📍 Unidad ID: ${t.unit_id}</p></div><select onchange="updateTaskStatus('${t.id}', this.value)" style="padding:10px; border-radius:8px; border:1px solid #e2e8f0;"><option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option><option value="En Progreso" ${t.status === 'En Progreso' ? 'selected' : ''}>🚧 En Progreso</option><option value="Completado" ${t.status === 'Completado' ? 'selected' : ''}>✅ Completado</option></select></div>`).join('') || '<p style="text-align:center; width:100%;">No tienes tareas de mantenimiento asignadas.</p>';
}

async function updateTaskStatus(taskId, newStatus) {
    await fetch(`${API_BASE_URL}/maintenance/tasks`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status: newStatus }) });
}

// ==============================================================================
// 4. ADMIN: GESTIÓN DE CONDOMINIOS Y UNIDADES
// ==============================================================================
async function loadAdminCondos() {
    const listActivos = document.getElementById('condos-list-admin');
    const listInactivos = document.getElementById('condos-list-inactive');
    if (!listActivos) return;
    
    listActivos.innerHTML = '<p style="text-align:center; width:100%;">Cargando tus propiedades...</p>';
    const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const condos = await res.json();
    
    const renderCondo = (c) => `
        <div class="card ${c.activo === false ? 'inactivo' : ''}" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; margin-bottom: 15px; ${c.activo===false?'opacity:0.6':''}">
            <img src="${c.foto_url}" onerror="this.src='${fallbackImageCondo}'" style="width: 100%; height: 150px; object-fit: cover;">
            <div style="padding: 15px;">
                <div style="display:flex; justify-content:space-between;">
                    <h3 style="margin: 0;">${c.nombre}</h3>
                    <div>
                        <button onclick="editCondo('${c.id}', '${c.nombre}', '${c.direccion}')" class="btn-action" title="Editar">✏️</button>
                        <button onclick="toggleCondoStatus('${c.id}', ${c.activo !== false})" class="btn-action" title="Habilitar/Ocultar">${c.activo !== false ? '🚫' : '👁️'}</button>
                    </div>
                </div>
                <p style="color: #64748b; font-size: 0.85rem;">📍 ${c.direccion}</p>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button onclick="viewUnits('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1;">👁️ Gestionar</button>
                    <button onclick="openUnitModal('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1;">➕ Unidad</button>
                </div>
            </div>
        </div>
    `;

    const activos = condos.filter(c => c.activo !== false);
    const inactivos = condos.filter(c => c.activo === false);

    listActivos.innerHTML = activos.map(renderCondo).join('') || '<p>No hay condominios activos.</p>';
    listInactivos.innerHTML = inactivos.map(renderCondo).join('') || '<p>No hay condominios ocultos.</p>';
    
    loadIncidentsAdmin(); 
}

async function editCondo(id, oldName, oldDir) {
    const n = prompt("Nuevo nombre:", oldName);
    const d = prompt("Nueva dirección:", oldDir);
    if(n && d) await fetch(`${API_BASE_URL}/condos`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id, nombre: n, direccion: d})});
}

async function toggleCondoStatus(id, isActive) {
    if(!confirm(`¿${isActive ? 'Ocultar' : 'Habilitar'} este condominio a los residentes?`)) return;
    const res = await fetch(`${API_BASE_URL}/condos`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id, activo: !isActive})});
    if (!res.ok) {
        const data = await res.json();
        alert("❌ " + data.msg); // Aquí mostrará si no puede porque tiene unidades activas
    }
}

async function viewUnits(condoId, condoName) {
    currentCondoId = condoId;
    if(condoName) document.getElementById('modal-condo-name').textContent = condoName;
    const container = document.getElementById('units-container');
    container.innerHTML = 'Cargando...';
    document.getElementById('unit-modal').style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        container.innerHTML = units.map(u => {
            const isOcupado = u.estado === 'Ocupado';
            const isDeleted = u.borrado_logico === true;
            return `
            <div class="unit-card ${isOcupado ? 'ocupado' : 'disponible'} ${isDeleted ? 'inactiva' : ''}">
                <div style="display: flex; gap: 15px; align-items: center; flex: 1;">
                    <img src="${u.foto_url}" onerror="this.src='${fallbackImageUnit}'" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px;">
                    <div style="flex: 1;">
                        <h5 style="margin:0; font-size:1.1rem;">${u.nombre} <span style="color:#64748b; font-weight:normal;">($${u.precio})</span></h5>
                        <span class="badge-status ${isOcupado ? 'status-ocupado' : 'status-disponible'}">${isDeleted ? 'OCULTA' : u.estado}</span>
                        ${isOcupado ? `<div style="margin-top: 8px; font-size: 0.85rem;"><p style="margin:0;">👤 <b>Inquilino:</b> ${u.ocupado_por}</p></div>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="editUnit('${u.id}', '${u.nombre}', '${u.precio}')" class="btn-action" title="Editar">✏️</button>
                    <button onclick="toggleDeleteUnit('${u.id}', ${isDeleted}, '${u.condo_id}')" class="btn-action" title="Ocultar/Mostrar">${isDeleted ? '🔄' : '🗑️'}</button>
                </div>
            </div>
            `;
        }).join('') || '<p style="text-align:center;">Sin unidades registradas.</p>';
    } catch (e) { container.innerHTML = 'Error.'; }
}

async function editUnit(id, oldName, oldPrice) {
    const n = prompt("Nuevo nombre:", oldName);
    const p = prompt("Nuevo precio:", oldPrice);
    if(n && p) await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id, action: 'edit', nombre: n, precio: p})});
}

async function toggleDeleteUnit(unitId, isDeleted, condoId) {
    if (!confirm(`¿Deseas ${isDeleted ? 'Reactivar' : 'Ocultar'} esta unidad?`)) return;
    await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: unitId, action: isDeleted ? 'activate' : 'delete', condo_id: condoId }) });
}

// ==============================================================================
// 5. RESIDENTE: DASHBOARD Y CONTRATOS
// ==============================================================================
async function loadResidenteDashboard() {
    currentCondoId = null;
    const grid = document.getElementById('available-grid');
    document.getElementById('market-title').textContent = "Edificios Disponibles";
    document.getElementById('btn-back-to-condos').style.display = 'none';
    if (!grid) return;
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        grid.innerHTML = condos.map(c => `
            <div class="card" onclick="exploreUnits('${c.id}', '${c.nombre}')" style="cursor:pointer; padding:0; overflow:hidden;">
                <img src="${c.foto_url}" onerror="this.src='${fallbackImageCondo}'" style="width:100%; height:150px; object-fit:cover;">
                <div style="padding:15px;"><h4 style="margin:0;">${c.nombre}</h4><p style="color:#64748b; font-size:0.8rem; margin-top:5px;">📍 ${c.direccion}</p></div>
            </div>
        `).join('') || '<p style="text-align:center; width:100%;">No hay edificios disponibles.</p>';
    } catch (e) { grid.innerHTML = `<p style="color:red; text-align:center; width:100%;">Error de conexión.</p>`; }
}

async function exploreUnits(condoId, condoName) {
    currentCondoId = condoId;
    if(condoName) document.getElementById('market-title').textContent = `Unidades en ${condoName}`;
    document.getElementById('btn-back-to-condos').style.display = 'block';
    const grid = document.getElementById('available-grid');
    grid.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">Cargando...</p>';
    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        grid.innerHTML = units.map(u => `
            <div class="card" style="padding:10px;">
                <img src="${u.foto_url}" onerror="this.src='${fallbackImageCondo}'" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">
                <div style="padding:10px 5px;">
                    <h5 style="margin:0;">${u.nombre}</h5>
                    <p style="font-weight:bold; color:#2563eb; font-size:1.2rem; margin:8px 0;">$${u.precio} <span style="font-size:0.8rem; color:#64748b; font-weight:normal;">/ mensual</span></p>
                    <button onclick="openReserveModal('${u.id}', '${u.nombre}', ${u.precio})" class="btn-primary" style="width:100%;">Solicitar Contrato</button>
                </div>
            </div>
        `).join('') || '<p style="text-align:center; width:100%;">No hay unidades disponibles.</p>';
    } catch (e) { grid.innerHTML = '<p style="color:red;">Error.</p>'; }
}

async function loadMyReservations() {
    const grid = document.getElementById('my-reservas-grid');
    if (!grid) return;
    loadFees(); 
    try {
        const res = await fetch(`${API_BASE_URL}/units/my-reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
        const myRes = await res.json();
        grid.innerHTML = myRes.map(r => `
            <div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border-left: 6px solid #2563eb; margin-bottom:15px; flex-wrap: wrap;">
                <img src="${r.unit_details?.foto_url || ''}" onerror="this.src='${fallbackImageCondo}'" style="width: 140px; height: 100px; object-fit: cover; border-radius: 8px;">
                <div style="flex: 2; min-width: 250px;">
                    <h4 style="margin:0; font-size: 1.2rem;">${r.unit_details?.nombre || 'Unidad'}</h4>
                    <p style="margin: 0; color: #2563eb; font-weight: bold; font-size: 0.9rem;">🏢 ${r.unit_details?.condo_name || 'Condominio'}</p>
                    <div style="margin-top: 10px; font-size: 0.95rem; color: #475569; line-height: 1.6;">
                        <p style="margin:2px 0;">📅 <b>Inicia:</b> ${new Date(r.fecha_inicio).toLocaleDateString()}</p>
                        <p style="margin:2px 0;">📅 <b>Termina:</b> ${new Date(r.fecha_fin).toLocaleDateString()}</p>
                    </div>
                </div>
                <div style="text-align: right; flex: 1; min-width: 120px;">
                    <p style="margin:0; font-size: 0.8rem; color: #64748b;">Cuota Actual</p>
                    <p style="margin:0; font-size: 1.6rem; font-weight: 800; color: #2563eb;">$${r.total}</p>
                    <span class="badge-status status-disponible" style="margin-top:10px; display:inline-block;">Asignada</span>
                </div>
            </div>
        `).join('') || '<p style="text-align:center; width:100%; padding: 40px;">No tienes unidades asignadas.</p>';
    } catch (e) { grid.innerHTML = '<p style="color:red; text-align:center;">Error.</p>'; }
}

async function loadFees() {
    const container = document.getElementById('my-fees-grid');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE_URL}/fees`, { headers: { 'Authorization': `Bearer ${token}` } });
        const fees = await res.json();
        container.innerHTML = fees.map(f => {
            const isPaid = f.estado === 'Pagado';
            return `
            <div class="card" style="border-left: 5px solid ${isPaid ? '#22c55e' : '#eab308'}; margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin:0;">Cuota: ${f.mes}</h4>
                    <p style="margin:5px 0; color:#475569; font-weight:bold;">Monto: $${f.monto}</p>
                    <span class="badge-status ${isPaid ? 'status-disponible' : 'status-ocupado'}">${f.estado}</span>
                </div>
                ${isPaid ? `<small style="color:#64748b;">Abonado el: ${new Date(f.fecha_pago).toLocaleDateString()}</small>` : `<button class="btn-primary" style="background:#059669;" onclick="openFeePayModal('${f.id}')">Pagar Ahora</button>`}
            </div>
            `;
        }).join('') || '<p style="color:#64748b;">No tienes cuotas registradas.</p>';
    } catch (e) { console.error(e); }
}

// ==============================================================================
// 6. EVENTOS Y WEBSOCKETS
// ==============================================================================
function initWS() {
    if (!WS_URL) return;
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'REFRESH') { 
            if (userData.role === 'admin') loadAdminCondos(); 
            else if (document.getElementById('view-market').style.display === 'block') loadResidenteDashboard(); 
        }
        if (data.action === 'REFRESH_UNITS') { 
            if (userData.role === 'admin') {
                if (document.getElementById('unit-modal').style.display === 'flex') viewUnits(currentCondoId, "");
            } else {
                if (document.getElementById('view-reservas').style.display === 'block') loadMyReservations();
                else exploreUnits(currentCondoId, ""); 
            }
        }
        if (data.action === 'REFRESH_ANNOUNCEMENTS') {
            if (userData.role === 'admin' || document.getElementById('view-anuncios').style.display === 'block') loadAnnouncements();
        }
        if (data.action === 'REFRESH_INCIDENTS' && userData.role === 'admin') loadIncidentsAdmin();
        if (data.action === 'REFRESH_TASKS' && (userData.role === 'mantenimiento' || userData.role === 'admin')) loadMaintenanceTasks();
        if (data.action === 'REFRESH_FEES' && userData.role === 'residente') loadFees();
    };
    socket.onclose = () => setTimeout(initWS, 3000);
}

function openReserveModal(id, nombre, precio) {
    document.getElementById('reserve-unit-id').value = id; document.getElementById('reserve-unit-price').value = precio; document.getElementById('reserve-unit-name').textContent = nombre;
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('reserve-start').min = now.toISOString().slice(0, 19); document.getElementById('reserve-end').min = now.toISOString().slice(0, 19);
    document.getElementById('reserve-total-display').textContent = `$${precio}`; document.getElementById('reserve-total-display').dataset.total = precio;
    document.getElementById('btn-confirm-reserve').disabled = false;
    document.getElementById('reserve-modal').style.display = 'flex';
}

function openUnitModal(id, nombre) { document.getElementById('modal-condo-id').value = id; document.getElementById('modal-condo-unit-name').textContent = nombre; document.getElementById('add-unit-modal').style.display = 'flex'; }
function openFeePayModal(id) { document.getElementById('pay-fee-id').value = id; document.getElementById('fee-pay-modal').style.display = 'flex'; }

document.getElementById('reserve-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-confirm-reserve'); btn.disabled = true; btn.textContent = "Procesando...";
    const payload = { unit_id: document.getElementById('reserve-unit-id').value, total: parseFloat(document.getElementById('reserve-total-display').dataset.total), condo_id: currentCondoId, fecha_inicio: new Date(document.getElementById('reserve-start').value).toISOString(), fecha_fin: new Date(document.getElementById('reserve-end').value).toISOString() };
    try {
        const res = await fetch(`${API_BASE_URL}/units/reserve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        if(res.ok){ alert("✅ Contrato Firmado. Tu primera cuota ha sido generada."); closeModal('reserve-modal'); switchTab('reservas'); } else { alert("❌ Error"); }
    } catch (e) { alert("Error de conexión."); } finally { btn.textContent = "Firmar y Generar Cuota"; btn.disabled = false; }
});

document.getElementById('fee-pay-exp')?.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g, ''); if (v.length >= 2) e.target.value = v.slice(0, 2) + '/' + v.slice(2, 4); else e.target.value = v; });
document.getElementById('fee-pay-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const exp = document.getElementById('fee-pay-exp').value;
    const card = document.getElementById('fee-pay-card').value;
    if(card.length < 16) return alert("❌ El número de tarjeta debe tener 16 dígitos.");
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) return alert("❌ Fecha MM/YY inválida.");
    const btn = document.getElementById('btn-confirm-fee');
    btn.disabled = true; btn.textContent = "Procesando...";
    const body = { id: document.getElementById('pay-fee-id').value };
    try {
        const res = await fetch(`${API_BASE_URL}/fees`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if(res.ok) { alert("✅ Cuota pagada exitosamente"); closeModal('fee-pay-modal'); e.target.reset(); }
        else { alert("Error en el pago."); }
    } catch(err) { alert("Error de red"); } finally { btn.disabled = false; btn.textContent = "Procesar Pago"; }
});

document.getElementById('announcement-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const body = { titulo: document.getElementById('ann-titulo').value, mensaje: document.getElementById('ann-mensaje').value }; const res = await fetch(`${API_BASE_URL}/announcements`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if(res.ok) { alert("Anuncio publicado"); closeModal('announcement-modal'); e.target.reset(); } });
document.getElementById('incident-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const body = { unit_id: document.getElementById('incident-unit-id').value, descripcion: document.getElementById('incident-desc').value }; const res = await fetch(`${API_BASE_URL}/incidents`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if(res.ok) { alert("Reporte enviado y asignado al técnico de mantenimiento automáticamente."); closeModal('incident-modal'); e.target.reset(); } });
document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const nombre = document.getElementById('condo-nombre').value, direccion = document.getElementById('condo-direccion').value, file = document.getElementById('condo-file').files[0]; try { const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} }); const { upload_url, file_key } = await resSig.json(); await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }); await fetch(`${API_BASE_URL}/condos`, { method: 'PUT', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ nombre, direccion, file_key }) }); alert("✅ Edificio registrado"); e.target.reset(); loadAdminCondos(); } catch (err) { alert("Error al registrar"); } });
document.getElementById('add-unit-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const condo_id = document.getElementById('modal-condo-id').value, nombre = document.getElementById('unit-nombre').value, precio = document.getElementById('unit-precio').value, file = document.getElementById('unit-file').files[0]; try { const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} }); const { upload_url, file_key } = await resSig.json(); await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }); await fetch(`${API_BASE_URL}/units`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ condo_id, nombre, precio, file_key }) }); alert("✅ Unidad creada"); closeModal('add-unit-modal'); e.target.reset(); viewUnits(condo_id, document.getElementById('modal-condo-name').textContent); } catch (err) { alert("Error al guardar unidad"); } });
async function createInviteToken(type) { const res = await fetch(`${API_BASE_URL}/admin/token`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) }); const data = await res.json(); if (res.ok) prompt(`✅ Token de ${type} generado:`, data.token); }

// ==============================================================================
// 7. INICIALIZACIÓN
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (userData) {
        document.getElementById('user-email').textContent = userData.email;
        fetch(`${API_BASE_URL}/config`).then(r => r.json()).then(c => { WS_URL = c.ws_url; initWS(); }).catch(e => console.error("Error WS:", e));
        if (userData.role === 'admin') {
            document.getElementById('admin-section').style.display = 'block';
            if (userData.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()) { document.getElementById('super-user-controls').style.display = 'block'; }
            loadAdminCondos();
            loadAnnouncements();
        } else if (userData.role === 'mantenimiento') { 
            document.getElementById('mantenimiento-section').style.display = 'block'; 
            loadMaintenanceTasks();
        } else { 
            document.getElementById('residente-section').style.display = 'block'; 
            loadResidenteDashboard(); 
        }
    }
});
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }