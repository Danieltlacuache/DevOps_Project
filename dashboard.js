// ==============================================================================
// 1. CONFIGURACIÓN Y ESTADO GLOBAL (Dinámico)
// ==============================================================================
const API_BASE_URL = ENV.AWS_API_URL.replace(/\/$/, "");
const SUPER_USER_EMAIL = ENV.SUPER_USER_EMAIL; 

let WS_URL = ""; 
const token = localStorage.getItem('token');
const userData = token ? JSON.parse(atob(token.split('.')[1])) : null;
let currentCondoId = null; 

const fallbackImageCondo = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22150%22 style=%22background:%23e2e8f0%22%3E%3Ctext fill=%22%2394a3b8%22 y=%2250%25%22 x=%2250%25%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216px%22%3ESin Imagen%3C/text%3E%3C/svg%3E";
const fallbackImageUnit = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2270%22 height=%2270%22 style=%22background:%23e2e8f0%22%3E%3Ctext fill=%22%2394a3b8%22 y=%2250%25%22 x=%2250%25%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224px%22%3EX%3C/text%3E%3C/svg%3E";

if (!token) window.location.href = 'index.html';

// ==============================================================================
// VALIDACIONES BANCARIAS Y FIX DE IMÁGENES
// ==============================================================================
function validarFechaTarjeta(expValue) {
    if (!expValue || !expValue.includes('/')) return false;
    const [month, year] = expValue.split('/').map(n => parseInt(n));
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = parseInt(now.getFullYear().toString().slice(-2));

    if (!month || !year || month < 1 || month > 12) return false;
    if (year < currentYear) return false; 
    if (year === currentYear && month < currentMonth) return false; 
    return true;
}

function validarCVV(cvv) {
    return /^\d{3}$/.test(cvv);
}

function handleImageError(img) {
    if (!img.dataset.tried) {
        img.dataset.tried = "true";
        const oldUrl = img.src;
        try {
            const fileKey = oldUrl.split('/').pop();
            const bucketName = ENV.AWS_API_URL.split('.')[0].replace('https://', '');
            img.src = `https://${bucketName}.s3.us-east-2.amazonaws.com/uploads/${fileKey}`;
        } catch(e) { img.src = fallbackImageCondo; }
    } else {
        img.src = fallbackImageCondo;
    }
}

['fee-pay-card', 'res-pay-card'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
});
['fee-pay-cvv', 'res-pay-cvv'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => { 
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); 
    });
});
['fee-pay-exp', 'res-pay-exp'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => { 
        let v = e.target.value.replace(/\D/g, ''); 
        if (v.length >= 2) e.target.value = v.slice(0, 2) + '/' + v.slice(2, 4); 
        else e.target.value = v; 
    });
});

// ==============================================================================
// 2. FINANZAS Y PAGOS (RESIDENTE)
// ==============================================================================
async function loadFees() {
    const contPendientes = document.getElementById('my-fees-pendientes');
    const contPagadas = document.getElementById('my-fees-pagadas');
    if (!contPendientes) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/fees`, { headers: { 'Authorization': `Bearer ${token}` } });
        const fees = await res.json();
        
        let htmlPendientes = '';
        let htmlPagadas = '';

        fees.forEach(f => {
            const isPaid = f.estado === 'Pagado';
            const html = `
            <div class="card" style="border-left: 5px solid ${isPaid ? '#22c55e' : '#eab308'}; margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center; background: white;">
                <div>
                    <h4 style="margin:0;">${f.mes}</h4>
                    <p style="margin:2px 0; font-size:0.85rem; color:#64748b;">${f.detalles || 'Cuota General'}</p>
                    <p style="margin:5px 0; color:#0f172a; font-weight:bold; font-size:1.1rem;">Monto: $${f.monto}</p>
                    <span class="badge-status ${isPaid ? 'status-disponible' : 'status-ocupado'}">${f.estado}</span>
                </div>
                ${isPaid ? `
                <div style="text-align: right;">
                    <small style="color:#64748b; display: block; margin-bottom: 5px;">Pagado el: ${new Date(f.fecha_pago).toLocaleDateString()}</small>
                    <button class="btn-action" style="color: #ef4444;" onclick="deleteFeeHistory('${f.id}')" title="Borrar del historial">🗑️</button>
                </div>
                ` : `<button class="btn-primary" style="background:#059669;" onclick="openFeePayModal('${f.id}')">Pagar Ahora</button>`}
            </div>`;
            
            if(isPaid) htmlPagadas += html;
            else htmlPendientes += html;
        });

        contPendientes.innerHTML = htmlPendientes || '<p style="color:#64748b; font-style:italic;">No tienes pagos pendientes. ¡Todo al corriente!</p>';
        contPagadas.innerHTML = htmlPagadas || '<p style="color:#64748b;">No hay historial de pagos.</p>';
    } catch (e) { console.error("Error cargando cuotas:", e); }
}

async function deleteFeeHistory(id) {
    if (!confirm("¿Ocultar este pago de tu historial de residente?")) return;
    const res = await fetch(`${API_BASE_URL}/fees`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }) 
    });
    if (res.ok) {
        loadFees();
    } else {
        alert("❌ Error al borrar el historial.");
    }
}

function openFeePayModal(id) {
    document.getElementById('pay-fee-id').value = id;
    document.getElementById('fee-pay-modal').style.display = 'flex';
}

document.getElementById('fee-pay-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const expDate = document.getElementById('fee-pay-exp')?.value;
    const cvv = document.getElementById('fee-pay-cvv')?.value;

    if (expDate && !validarFechaTarjeta(expDate)) {
        alert("❌ La tarjeta está vencida o la fecha es inválida.");
        return;
    }
    if (!validarCVV(cvv)) return alert("❌ El CVV debe tener exactamente 3 dígitos.");

    const btn = document.getElementById('btn-confirm-fee') || e.target.querySelector('button[type="submit"]');
    if(btn) { btn.disabled = true; btn.textContent = "Procesando..."; }
    try {
        const res = await fetch(`${API_BASE_URL}/fees`, { 
            method: 'PATCH', 
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ id: document.getElementById('pay-fee-id').value }) 
        });
        if(res.ok) { 
            alert("✅ Pago procesado correctamente."); 
            closeModal('fee-pay-modal'); 
            loadFees(); 
            e.target.reset();
        } else { alert("❌ Falló el pago."); }
    } catch(err) { alert("Error de red"); } finally { if(btn) { btn.disabled = false; btn.textContent = "Procesar"; } }
});

// ==============================================================================
// 3. COMUNIDAD, INCIDENTES Y TAREAS (MANTENIMIENTO)
// ==============================================================================
async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    const adminContainer = document.getElementById('admin-announcements-list');
    try {
        const res = await fetch(`${API_BASE_URL}/announcements`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const hiddenAnns = JSON.parse(localStorage.getItem('hiddenAnns') || '[]');
        
        let html = '';
        data.forEach(a => {
            if (userData.role === 'residente' && hiddenAnns.includes(a.id)) return;
            html += `
            <div style="padding:15px; border-bottom:1px solid #e2e8f0; position:relative; background: white; margin-bottom: 5px; border-radius: 8px;">
                ${userData.role === 'admin' ? `<button onclick="deleteAnnouncement('${a.id}')" style="position:absolute; right:10px; top:10px; background:none; border:none; cursor:pointer;" title="Eliminar para todos">🗑️</button>` : `<button onclick="hideAnnouncement('${a.id}')" style="position:absolute; right:10px; top:10px; background:none; border:none; cursor:pointer; color:#94a3b8;" title="Ocultar">✖</button>`}
                <strong style="color:#1e293b; display:block; margin-bottom:5px;">${a.titulo}</strong>
                <p style="margin:0; color:#475569; font-size:0.9rem; line-height:1.4;">${a.mensaje}</p>
                <small style="color:#94a3b8; display:block; margin-top:8px;">${new Date(a.fecha).toLocaleString()}</small>
            </div>`;
        });
        
        if (container) container.innerHTML = html || '<p style="color:#64748b;">No hay anuncios.</p>';
        if (adminContainer) adminContainer.innerHTML = html || '<p style="color:#64748b;">No has publicado anuncios.</p>';
    } catch(e) {}
}

function hideAnnouncement(id) {
    const hidden = JSON.parse(localStorage.getItem('hiddenAnns') || '[]');
    hidden.push(id); localStorage.setItem('hiddenAnns', JSON.stringify(hidden));
    loadAnnouncements();
}

async function deleteAnnouncement(id) {
    if(!confirm("¿Borrar este anuncio permanentemente?")) return;
    await fetch(`${API_BASE_URL}/announcements`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id}) });
}

async function loadIncidentsAdmin() {
    const container = document.getElementById('incidents-admin-container');
    if (!container) return;
    const res = await fetch(`${API_BASE_URL}/incidents`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    container.innerHTML = data.map(i => {
        let isCompleted = (i.estado === 'Resuelto' || i.estado === 'Completado');
        return `
        <div class="card" style="border-left: 5px solid ${isCompleted ? '#22c55e' : '#eab308'}; margin-bottom:10px; padding:15px; background: white;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h5 style="margin:0;">${i.condo_name} - ${i.unit_name} <span class="badge-status ${isCompleted ? 'status-disponible' : 'status-ocupado'}">${i.estado}</span></h5>
                    <p style="margin:5px 0; font-size:0.85rem; color:#475569;">📝 ${i.descripcion}</p>
                    <small>👤 Reportado por: ${i.residente} | 📅 ${new Date(i.fecha).toLocaleString()}</small>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${isCompleted ? `<button onclick="deleteIncident('${i.id}')" class="btn-action" title="Eliminar Registro">🗑️</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('') || '<p>No hay incidentes reportados.</p>';
}

async function loadMyIncidents() {
    const container = document.getElementById('my-incidents-grid');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE_URL}/incidents`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        container.innerHTML = data.map(i => {
            const isDone = (i.estado === 'Resuelto' || i.estado === 'Completado');
            return `
            <div class="card" style="border-left: 5px solid ${isDone ? '#22c55e' : '#f59e0b'}; margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center; background: white;">
                <div>
                    <h5 style="margin:0;">${i.condo_name} - ${i.unit_name} <span class="badge-status ${isDone ? 'status-disponible' : 'status-progreso'}">${i.estado}</span></h5>
                    <p style="margin:5px 0 0 0; font-size:0.9rem;">${i.descripcion}</p>
                    <small style="color:#64748b;">Reportado el: ${new Date(i.fecha).toLocaleString()}</small>
                </div>
                ${isDone ? `<button onclick="deleteIncident('${i.id}')" class="btn-action" style="color:#ef4444;" title="Limpiar reporte terminado">🗑️</button>` : ''}
            </div>`;
        }).join('') || '<p style="color:#64748b;">No tienes reportes pendientes.</p>';
    } catch(e) {}
}

async function deleteIncident(id) {
    if(!confirm("¿Eliminar este reporte del historial?")) return;
    const res = await fetch(`${API_BASE_URL}/incidents`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id}) });
    if(!res.ok) alert("❌ Error al borrar.");
}

async function loadMaintenanceTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;">Cargando tareas...</p>';
    const res = await fetch(`${API_BASE_URL}/maintenance/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
    const tasks = await res.json();
    container.innerHTML = tasks.map(t => {
        const isDone = t.status === 'Completado';
        return `
        <div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border-left: 6px solid ${isDone ? '#22c55e' : '#f59e0b'}; margin-bottom:15px; background: white;">
            <div style="flex: 1;">
                <h4 style="margin:0;">${t.descripcion}</h4>
                <p style="margin:5px 0; color:#64748b; font-size:0.85rem;">📍 ${t.condo_name} - ${t.unit_name}</p>
                ${userData.role === 'admin' ? `<p style="margin:0; font-size:0.8rem; color:#2563eb;">👷 Técnico: ${t.assigned_to}</p>` : ''}
            </div>
            <select onchange="updateTaskStatus('${t.id}', this.value)" style="padding:8px; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                <option value="En Progreso" ${t.status === 'En Progreso' ? 'selected' : ''}>🚧 En Progreso</option>
                <option value="Completado" ${isDone ? 'selected' : ''}>✅ Completado</option>
            </select>
            ${isDone ? `<button onclick="deleteTask('${t.id}')" class="btn-action">🗑️</button>` : ''}
        </div>`;
    }).join('') || '<p style="text-align:center;">Sin tareas asignadas.</p>';
}

async function updateTaskStatus(taskId, newStatus) {
    await fetch(`${API_BASE_URL}/maintenance/tasks`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status: newStatus }) });
}

async function deleteTask(id) {
    if(confirm("¿Borrar tarea?")) await fetch(`${API_BASE_URL}/maintenance/tasks`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id}) });
}

// ==============================================================================
// 4. ADMIN: GESTIÓN DE CONDOMINIOS Y UNIDADES
// ==============================================================================
async function loadAdminCondos() {
    const listActivos = document.getElementById('condos-list-admin');
    const listInactivos = document.getElementById('condos-list-inactive');
    const selectAm = document.getElementById('amenity-condo-id');
    if (!listActivos) return;
    
    listActivos.innerHTML = '<p style="text-align:center; width:100%;">Cargando tus propiedades...</p>';
    if (listInactivos) listInactivos.innerHTML = '';

    const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
    const condos = await res.json();
    
    if(selectAm) selectAm.innerHTML = '<option value="">Selecciona Edificio...</option>' + condos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    const renderCondo = (c) => `
        <div class="card ${c.activo === false ? 'inactivo' : ''}" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; background: white; opacity: ${c.activo===false?'0.6':'1'}">
            <img src="${c.foto_url || ''}" onerror="handleImageError(this)" style="width: 100%; height: 160px; object-fit: cover;">
            <div style="padding: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h3 style="margin: 0;">${c.nombre}</h3>
                    <div>
                        <button onclick="editCondo('${c.id}', '${c.nombre}', '${c.direccion}')" class="btn-action">✏️</button>
                        <button onclick="toggleCondoStatus('${c.id}', ${c.activo !== false})" class="btn-action">${c.activo !== false ? '🚫' : '👁️'}</button>
                    </div>
                </div>
                <p style="color: #64748b; font-size: 0.85rem; margin-top:5px;">📍 ${c.direccion}</p>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button onclick="viewUnits('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1;">👁️ Unidades</button>
                    <button onclick="openUnitModal('${c.id}', '${c.nombre}')" class="btn-primary" style="flex: 1;">➕ Añadir</button>
                </div>
            </div>
        </div>`;

    const activos = condos.filter(c => c.activo !== false);
    const inactivos = condos.filter(c => c.activo === false);

    listActivos.innerHTML = activos.map(renderCondo).join('') || '<p style="width:100%;">No hay condominios activos.</p>';
    if (listInactivos) listInactivos.innerHTML = inactivos.map(renderCondo).join('') || '<p style="width:100%;">No hay condominios ocultos.</p>';
}

async function viewUnits(condoId, condoName) {
    currentCondoId = condoId;
    document.getElementById('modal-condo-name').textContent = condoName;
    const container = document.getElementById('units-container');
    container.innerHTML = 'Cargando...';
    document.getElementById('unit-modal').style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        container.innerHTML = units.map(u => {
            const isVenta = u.modalidad === 'Venta';
            const isOcupado = u.estado === 'Ocupado';
            const isEspera = u.estado === 'En Espera';
            const isDeleted = u.borrado_logico === true;
            const suspendido = u.privilegios_suspendidos;
            
            let badge = isDeleted ? 'OCULTA' : u.estado;
            let badgeStyle = isDeleted ? 'status-inactivo' : (isOcupado ? 'status-ocupado' : (isEspera ? 'status-espera' : 'status-disponible'));

            return `
            <div class="unit-card ${isDeleted ? 'inactiva' : (isOcupado ? 'ocupado' : (isEspera ? 'espera' : 'disponible'))}">
                <div style="display: flex; gap: 15px; align-items: center; flex: 1;">
                    <img src="${u.foto_url || ''}" onerror="handleImageError(this)" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                    <div style="flex: 1;">
                        <h5 style="margin:0;">${u.nombre} <span class="badge-status" style="background:#e0f2fe; color:#0369a1;">Para ${u.modalidad || 'Renta'}</span></h5>
                        <p style="margin:2px 0; font-weight:bold; color:#2563eb;">$${u.precio}</p>
                        <span class="badge-status ${badgeStyle}">${badge}</span>
                        ${suspendido ? `<span class="badge-status status-ocupado">🚫 PRIVILEGIOS SUSPENDIDOS</span>` : ''}
                        ${(isOcupado || isEspera) ? `<p style="margin:5px 0 0 0; font-size:0.8rem; color:#475569;">👤 ${isVenta ? 'Dueño' : 'Inquilino'}: ${u.ocupado_por}</p>` : ''}
                        ${isEspera ? `<p style="margin:2px 0; color:#c2410c; font-size:0.75rem;"><b>Motivo Desalojo:</b> ${u.motivo_desalojo}</p>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="openEditUnitModal('${u.id}', '${u.nombre}', '${u.precio}', '${u.modalidad || 'Renta'}', '${u.condo_id}')" class="btn-action" title="Editar">✏️</button>
                    ${isOcupado && isVenta ? `<button onclick="togglePrivileges('${u.id}', '${u.condo_id}')" class="btn-action" title="Suspender/Activar Privilegios">${suspendido ? '✅' : '🚫'}</button>` : ''}
                    ${isOcupado && !isVenta ? `<button onclick="evictUnit('${u.id}', '${u.condo_id}', '${u.nombre}')" class="btn-action" title="Desalojar">🏃‍♂️</button>` : ''}
                    <button onclick="toggleDeleteUnit('${u.id}', ${isDeleted}, '${u.condo_id}')" class="btn-action" title="${isDeleted ? 'Reactivar' : 'Eliminar'}">${isDeleted ? '🔄' : '🗑️'}</button>
                </div>
            </div>`;
        }).join('') || '<p style="text-align:center;">Sin unidades.</p>';
    } catch (e) { container.innerHTML = 'Error.'; }
}

async function evictUnit(unitId, condoId, unitName) {
    const motivo = prompt(`Ingresa el motivo del desalojo para "${unitName}":`);
    if (!motivo) return;
    const res = await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: unitId, action: 'start_evict', motivo: motivo, condo_id: condoId }) });
    if (res.ok) alert("✅ Solicitud enviada.");
}

async function editCondo(id, oldName, oldDir) { const n = prompt("Nuevo nombre:", oldName); const d = prompt("Nueva dirección:", oldDir); if(n && d) await fetch(`${API_BASE_URL}/condos`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id, nombre: n, direccion: d})}); }

async function toggleCondoStatus(id, isActive) { 
    if(confirm(`¿${isActive ? 'Ocultar' : 'Habilitar'} este condominio?`)) {
        const res = await fetch(`${API_BASE_URL}/condos`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({id, activo: !isActive})});
        if(!res.ok) { const err = await res.json(); alert("❌ " + err.msg); }
    }
}

async function toggleDeleteUnit(unitId, isDeleted, condoId) { 
    if(confirm(`¿${isDeleted ? 'Reactivar' : 'Ocultar'} esta unidad?`)) { 
        const res = await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: unitId, action: isDeleted ? 'activate' : 'delete', condo_id: condoId }) }); 
        if (!res.ok) { const err = await res.json(); alert("❌ " + err.msg); } 
    } 
}

function openEditUnitModal(id, nombre, precio, modalidad, condoId) {
    document.getElementById('edit-unit-id').value = id;
    document.getElementById('edit-unit-condo-id').value = condoId;
    document.getElementById('edit-unit-nombre').value = nombre;
    document.getElementById('edit-unit-precio').value = precio;
    document.getElementById('edit-unit-modalidad').value = modalidad;
    document.getElementById('edit-unit-modal').style.display = 'flex';
}

document.getElementById('edit-unit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        action: 'edit',
        id: document.getElementById('edit-unit-id').value,
        condo_id: document.getElementById('edit-unit-condo-id').value,
        nombre: document.getElementById('edit-unit-nombre').value,
        precio: document.getElementById('edit-unit-precio').value,
        modalidad: document.getElementById('edit-unit-modalidad').value
    };
    
    const res = await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { closeModal('edit-unit-modal'); viewUnits(payload.condo_id, document.getElementById('modal-condo-name').textContent); } 
    else { const error = await res.json(); alert("❌ " + error.msg); }
});

async function togglePrivileges(unitId, condoId) {
    if(confirm("¿Cambiar el estado de privilegios (amenidades) de este dueño?")) {
        await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: unitId, action: 'toggle_privileges', condo_id: condoId }) });
    }
}

// ==============================================================================
// 5. AMENIDADES (RESERVAS, CHOQUES Y CANCELACIONES)
// ==============================================================================
document.getElementById('add-amenity-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    const body = { condo_id: document.getElementById('amenity-condo-id').value, nombre: document.getElementById('amenity-nombre').value };
    const res = await fetch(`${API_BASE_URL}/amenities`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if(res.ok) { alert("Amenidad Creada"); e.target.reset(); }
    btn.disabled = false;
});

async function cancelAmenityReservation(id) {
    if(!confirm("¿Estás seguro de cancelar esta reserva de amenidad?")) return;
    const res = await fetch(`${API_BASE_URL}/amenities/reservations`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if(res.ok) { 
        alert("✅ Reserva cancelada exitosamente."); 
        if (userData.role === 'admin') loadAmenitiesAdmin();
        else loadAmenitiesForResident();
    } else {
        const err = await res.json();
        alert("❌ Error al cancelar: " + err.msg);
    }
}

async function loadAmenitiesAdmin() {
    const list = document.getElementById('admin-amenities-list');
    const resList = document.getElementById('admin-amenities-reservations');
    
    const amRes = await fetch(`${API_BASE_URL}/amenities`, { headers: { 'Authorization': `Bearer ${token}` } });
    const ams = await amRes.json();
    if(list) list.innerHTML = ams.map(a => `
        <div style="padding:10px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between;">
            <div><strong>${a.nombre}</strong> <small style="color:#64748b;">(${a.condo_name})</small></div>
            <span style="font-size:0.8rem; font-weight:bold; color:${a.estado.includes('Ocupado') ? '#ef4444' : '#22c55e'}">${a.estado}</span>
        </div>`).join('') || '<p>No hay amenidades.</p>';
    
    const bookRes = await fetch(`${API_BASE_URL}/amenities/reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
    const books = await bookRes.json();
    if(resList) resList.innerHTML = books.map(r => `
        <div style="padding:15px; border-bottom:1px solid #e2e8f0; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${r.amenity_name}</strong> en ${r.condo_name}<br>
                <span style="color:#2563eb;">👤 ${r.email}</span><br>
                <small style="color:#64748b;">De: ${new Date(r.fecha_inicio).toLocaleString()} <br> A: ${new Date(r.fecha_fin).toLocaleString()}</small>
            </div>
            <button onclick="cancelAmenityReservation('${r.id}')" class="btn-action" style="color:#ef4444;" title="Cancelar Reserva">🗑️</button>
        </div>`).join('') || '<p>No hay reservas activas.</p>';
}

async function loadAmenitiesForResident() {
    const select = document.getElementById('res-amenity-select');
    const list = document.getElementById('res-amenities-reservations');
    
    const res = await fetch(`${API_BASE_URL}/amenities`, { headers: { 'Authorization': `Bearer ${token}` } });
    const ams = await res.json();
    if(select) select.innerHTML = ams.map(a => `<option value="${a.id}">${a.nombre} - ${a.estado} (${a.condo_name})</option>`).join('') || '<option value="">No hay amenidades en tu edificio</option>';
    
    const bookRes = await fetch(`${API_BASE_URL}/amenities/reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
    const books = await bookRes.json();
    if(list) list.innerHTML = books.map(r => `
        <div class="card" style="margin-bottom:10px; padding:15px; border-left:4px solid #0ea5e9; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4 style="margin:0;">${r.amenity_name} <small style="color:#64748b; font-weight:normal;">(${r.condo_name})</small></h4>
                <p style="margin:5px 0 0 0; font-size:0.9rem; color:#475569;">🕒 ${new Date(r.fecha_inicio).toLocaleString()} - ${new Date(r.fecha_fin).toLocaleString()}</p>
            </div>
            <button onclick="cancelAmenityReservation('${r.id}')" class="btn-action" style="color:#ef4444; border:1px solid #ef4444; border-radius:5px; padding:5px 10px;" title="Cancelar Reserva">🗑️ Cancelar</button>
        </div>`).join('') || '<p>No tienes reservas.</p>';
}

document.getElementById('reserve-amenity-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const startVal = document.getElementById('am-start').value;
    const endVal = document.getElementById('am-end').value;
    if(!startVal || !endVal) return alert("❌ Selecciona las fechas.");

    const payload = { 
        amenity_id: document.getElementById('res-amenity-select').value, 
        fecha_inicio: new Date(startVal).toISOString(), 
        fecha_fin: new Date(endVal).toISOString() 
    };

    const res = await fetch(`${API_BASE_URL}/amenities/reserve`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
    if(res.ok) { alert("✅ Reserva Confirmada"); e.target.reset(); loadAmenitiesForResident(); }
    else { const err = await res.json(); alert("❌ " + err.msg); }
});

// ==============================================================================
// 6. RESIDENTE: EXPLORAR Y RESERVAR (CON PAGO)
// ==============================================================================
async function loadResidenteDashboard() {
    currentCondoId = null;
    const grid = document.getElementById('available-grid');
    document.getElementById('market-title').textContent = "Edificios Disponibles";
    const btnBack = document.getElementById('btn-back-to-condos');
    if(btnBack) btnBack.style.display = 'none';
    if (!grid) return;
    try {
        const res = await fetch(`${API_BASE_URL}/condos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const condos = await res.json();
        grid.innerHTML = condos.map(c => `
            <div class="card" onclick="exploreUnits('${c.id}', '${c.nombre}')" style="cursor:pointer; padding:0; overflow:hidden; background: white;">
                <img src="${c.foto_url || ''}" onerror="handleImageError(this)" style="width:100%; height:160px; object-fit:cover;">
                <div style="padding:15px;"><h4>${c.nombre}</h4><p style="color:#64748b; font-size:0.85rem; margin-top:5px;">📍 ${c.direccion}</p></div>
            </div>`).join('') || '<p style="width:100%; text-align:center;">No hay edificios.</p>';
    } catch (e) {}
}

async function exploreUnits(condoId, condoName) {
    currentCondoId = condoId;
    document.getElementById('market-title').textContent = `Unidades en ${condoName}`;
    const btnBack = document.getElementById('btn-back-to-condos');
    if(btnBack) btnBack.style.display = 'inline-block';
    const grid = document.getElementById('available-grid');
    grid.innerHTML = 'Cargando...';
    try {
        const res = await fetch(`${API_BASE_URL}/units?condo_id=${condoId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const units = await res.json();
        
        const rentas = units.filter(u => u.modalidad === 'Renta' || !u.modalidad);
        const ventas = units.filter(u => u.modalidad === 'Venta');

        const renderUnit = (u) => `
            <div class="card" style="padding:15px; background: white; text-align: center;">
                <img src="${u.foto_url || ''}" onerror="handleImageError(this)" style="width:100%; height:130px; object-fit:cover; border-radius:8px; margin-bottom:10px;">
                <h5 style="margin:0;">${u.nombre}</h5>
                <p style="font-weight:bold; color:#2563eb; font-size:1.3rem; margin:10px 0;">$${u.precio}</p>
                <button onclick="openReserveModal('${u.id}', '${u.nombre}', ${u.precio}, '${u.modalidad || 'Renta'}')" class="btn-primary" style="width:100%;">${u.modalidad === 'Venta' ? 'Comprar Propiedad' : 'Rentar Mensual'}</button>
            </div>`;

        let html = '';
        if (ventas.length > 0) html += `<h4 style="grid-column: 1 / -1; margin-top: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; color: #0f172a;">💎 En Venta</h4>` + ventas.map(renderUnit).join('');
        if (rentas.length > 0) html += `<h4 style="grid-column: 1 / -1; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; color: #0f172a;">📅 En Renta</h4>` + rentas.map(renderUnit).join('');
        
        grid.innerHTML = html || '<p style="grid-column: 1 / -1; text-align: center;">No hay unidades disponibles en este edificio por el momento.</p>';
    } catch (e) {}
}

async function loadMyReservations() {
    const grid = document.getElementById('my-reservas-grid');
    if (!grid) return;
    try {
        const res = await fetch(`${API_BASE_URL}/units/my-reservations`, { headers: { 'Authorization': `Bearer ${token}` } });
        const myRes = await res.json();
        grid.innerHTML = myRes.map(r => {
            const isEspera = r.unit_details?.estado === 'En Espera';
            const isVenta = r.unit_details?.modalidad === 'Venta';
            return `
            <div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border-left: 6px solid ${isEspera ? '#f97316' : '#2563eb'}; margin-bottom:15px; background: white;">
                <img src="${r.unit_details?.foto_url || ''}" onerror="handleImageError(this)" style="width: 120px; height: 90px; object-fit: cover; border-radius: 8px;">
                <div style="flex: 1;">
                    <h4 style="margin:0; font-size: 1.2rem;">${r.unit_details?.nombre} <span class="badge-status" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem;">${isVenta ? 'Propiedad' : 'Rentado'}</span></h4>
                    <p style="margin: 0; color: #2563eb; font-weight: bold;">🏢 ${r.unit_details?.condo_name}</p>
                    ${isEspera ? `
                        <div style="margin-top:10px; padding:10px; background:#fff7ed; border-radius:8px; border:1px solid #fdba74;">
                            <p style="margin:0; color:#c2410c; font-weight:bold;">⚠️ SOLICITUD DE DESALOJO</p>
                            <p style="margin:5px 0; color:#9a3412; font-size:0.85rem;"><b>Motivo:</b> ${r.unit_details?.motivo_desalojo}</p>
                            <button onclick="confirmEvictionResident('${r.unit_details?.id}', '${r.unit_details?.condo_id}')" class="btn-primary" style="background:#ea580c; width:100%; margin-top:5px;">Confirmar y Salir</button>
                        </div>` : `
                        <div style="margin-top: 8px; font-size: 0.9rem; color: #475569;">
                            <p style="margin:0;">📅 Entrada: ${new Date(r.fecha_inicio).toLocaleDateString()}</p>
                            ${!isVenta ? `<p style="margin:0;">📅 Salida: ${new Date(r.fecha_fin).toLocaleDateString()}</p>` : ''}
                        </div>`}
                </div>
            </div>`;
        }).join('') || '<p style="text-align:center; padding: 20px;">No tienes unidades.</p>';
    } catch (e) {}
}

async function confirmEvictionResident(unitId, condoId) {
    if(!confirm("¿Confirmas que desocuparás la unidad ahora? Tu contrato se borrará.")) return;
    const res = await fetch(`${API_BASE_URL}/units`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: unitId, action: 'confirm_evict', condo_id: condoId }) });
    if(res.ok) alert("✅ Unidad liberada.");
}

function updatePaymentAviso() {
    const startInput = document.getElementById('reserve-start').value;
    const avisoPago = document.getElementById('aviso-pago-auto');
    if(startInput && avisoPago) {
        const day = new Date(startInput).getDate();
        avisoPago.textContent = `ℹ️ El pago automático se generará los días ${day} de cada mes.`;
    }
}

function openReserveModal(id, nombre, precio, modalidad) {
    document.getElementById('reserve-unit-id').value = id; 
    document.getElementById('reserve-unit-price').value = precio; 
    document.getElementById('reserve-unit-name').textContent = nombre;
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('reserve-start').value = now.toISOString().slice(0, 16);
    document.getElementById('reserve-start').min = now.toISOString().slice(0, 16);
    document.getElementById('reserve-end').min = now.toISOString().slice(0, 16);
    document.getElementById('reserve-total-display').textContent = `$${precio}`;
    document.getElementById('reserve-total-display').dataset.total = precio;
    
    if(modalidad === 'Venta') {
        document.getElementById('reserve-end').value = "2099-12-31T00:00";
        document.getElementById('reserve-end').parentElement.style.display = 'none';
        document.getElementById('btn-confirm-reserve').textContent = "Pagar Compra Total";
    } else {
        document.getElementById('reserve-end').parentElement.style.display = 'block';
        document.getElementById('btn-confirm-reserve').textContent = "Firmar Contrato y Pagar";
    }
    
    updatePaymentAviso();
    document.getElementById('reserve-modal').style.display = 'flex';
}

document.getElementById('reserve-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const expDate = document.getElementById('res-pay-exp')?.value;
    if (expDate && !validarFechaTarjeta(expDate)) {
        alert("❌ La tarjeta está vencida o la fecha es inválida. Debe ser un año vigente.");
        return;
    }

    const cvv = document.getElementById('res-pay-cvv').value;
    if (!validarCVV(cvv)) return alert("❌ El CVV debe tener exactamente 3 dígitos.");

    if(document.getElementById('res-pay-card').value.length < 16) return alert("❌ Tarjeta incompleta.");
    
    const btn = document.getElementById('btn-confirm-reserve'); btn.disabled = true; btn.textContent = "Procesando...";
    const payload = { 
        unit_id: document.getElementById('reserve-unit-id').value, 
        total: parseFloat(document.getElementById('reserve-total-display').dataset.total), 
        condo_id: currentCondoId, 
        fecha_inicio: new Date(document.getElementById('reserve-start').value).toISOString(), 
        fecha_fin: new Date(document.getElementById('reserve-end').value).toISOString() 
    };
    try {
        const res = await fetch(`${API_BASE_URL}/units/reserve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        if(res.ok){ alert("✅ Transacción Exitosa."); closeModal('reserve-modal'); switchTab('reservas'); e.target.reset(); } 
        else { const err = await res.json(); alert("❌ " + err.msg); }
    } catch (e) { alert("Error de conexión."); } finally { btn.textContent = "Firmar y Pagar Ahora"; btn.disabled = false; }
});

// ==============================================================================
// 7. FLUJOS GENERALES Y CARGA INICIAL
// ==============================================================================
function switchTab(tab) {
    ['market', 'reservas', 'amenidades-res', 'finanzas', 'comunidad'].forEach(t => { 
        const view = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        if(view) view.style.display = 'none'; 
        if(btn) btn.classList.remove('active'); 
    });
    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`tab-${tab}`);
    if(activeView) activeView.style.display = 'block'; 
    if(activeBtn) activeBtn.classList.add('active');

    if (tab === 'market') loadResidenteDashboard(); 
    else if (tab === 'reservas') loadMyReservations(); 
    else if (tab === 'amenidades-res') loadAmenitiesForResident();
    else if (tab === 'finanzas') loadFees(); 
    else if (tab === 'comunidad') { loadAnnouncements(); loadMyIncidents(); }
}

function switchAdminTab(tab) {
    ['propiedades', 'amenidades', 'reportes', 'comunidad', 'ajustes'].forEach(t => { 
        const view = document.getElementById(`view-admin-${t}`);
        const btn = document.getElementById(`tab-admin-${t}`);
        if(view) view.style.display = 'none'; 
        if(btn) btn.classList.remove('active'); 
    });
    const activeView = document.getElementById(`view-admin-${tab}`);
    const activeBtn = document.getElementById(`tab-admin-${tab}`);
    if(activeView) activeView.style.display = 'block'; 
    if(activeBtn) activeBtn.classList.add('active');

    if (tab === 'propiedades') loadAdminCondos(); 
    else if (tab === 'amenidades') { loadAdminCondos(); loadAmenitiesAdmin(); } 
    else if (tab === 'reportes') loadIncidentsAdmin(); 
    else if (tab === 'comunidad') loadAnnouncements();
}

function initWS() {
    if (!WS_URL) return;
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'REFRESH') { if (userData.role === 'admin') loadAdminCondos(); else loadResidenteDashboard(); }
        if (data.action === 'REFRESH_UNITS') { 
            if (userData.role === 'admin') { if (document.getElementById('unit-modal').style.display === 'flex') viewUnits(currentCondoId, ""); } 
            else { loadMyReservations(); if (currentCondoId) exploreUnits(currentCondoId, ""); } 
        }
        if (data.action === 'REFRESH_ANNOUNCEMENTS') loadAnnouncements();
        if (data.action === 'REFRESH_INCIDENTS') { if (userData.role === 'admin') loadIncidentsAdmin(); else loadMyIncidents(); }
        if (data.action === 'REFRESH_TASKS') loadMaintenanceTasks();
        if (data.action === 'REFRESH_FEES') loadFees();
        if (data.action === 'REFRESH_AMENITIES') { if (userData.role === 'admin') loadAmenitiesAdmin(); else loadAmenitiesForResident(); }
    };
    socket.onclose = () => setTimeout(initWS, 3000);
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }

// Listeners Admin (Condominios y Unidades)
document.getElementById('add-condo-form')?.addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const nombre = document.getElementById('condo-nombre').value, direccion = document.getElementById('condo-direccion').value, file = document.getElementById('condo-file').files[0]; 
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = "Subiendo...";
    try { 
        const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ contentType: file.type }) }); 
        const { upload_url, file_key } = await resSig.json(); 
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }); 
        await fetch(`${API_BASE_URL}/condos`, { method: 'PUT', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ nombre, direccion, file_key }) }); 
        alert("✅ Registrado."); e.target.reset(); loadAdminCondos();
    } catch (err) { alert("Error."); } finally { btn.disabled = false; btn.textContent = "Registrar Edificio"; }
});

document.getElementById('add-unit-form')?.addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const condo_id = document.getElementById('modal-condo-id').value;
    const nombre = document.getElementById('unit-nombre').value;
    const precio = document.getElementById('unit-precio').value;
    const modalidad = document.getElementById('unit-modalidad') ? document.getElementById('unit-modalidad').value : 'Renta';
    const file = document.getElementById('unit-file').files[0]; 
    
    const btn = e.target.querySelector('button[type="submit"]'); 
    btn.disabled = true; btn.textContent = "Guardando...";

    try { 
        const resSig = await fetch(`${API_BASE_URL}/condos`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ contentType: file.type }) }); 
        const { upload_url, file_key } = await resSig.json(); 
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }); 
        
        await fetch(`${API_BASE_URL}/units`, { 
            method: 'POST', 
            headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, 
            body: JSON.stringify({ condo_id, nombre, precio, file_key, modalidad }) 
        }); 
        
        closeModal('add-unit-modal'); 
        viewUnits(condo_id, document.getElementById('modal-condo-name').textContent);
    } catch (err) { alert("Error al crear unidad."); } finally { btn.disabled = false; btn.textContent = "Guardar Unidad"; }
});

// Comunidad e Incidentes
document.getElementById('announcement-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await fetch(`${API_BASE_URL}/announcements`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: document.getElementById('ann-titulo').value, mensaje: document.getElementById('ann-mensaje').value }) }); closeModal('announcement-modal'); e.target.reset(); });

document.getElementById('incident-form')?.addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    await fetch(`${API_BASE_URL}/incidents`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ unit_id: document.getElementById('incident-unit-id').value, descripcion: document.getElementById('incident-desc').value }) 
    }); 
    closeModal('incident-modal'); 
    e.target.reset(); 
});

async function createInviteToken(type) { const res = await fetch(`${API_BASE_URL}/admin/token`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) }); const data = await res.json(); if (res.ok) prompt(`✅ Token ${type}:`, data.token); }

function openUnitModal(id, nombre) { document.getElementById('modal-condo-id').value = id; document.getElementById('modal-condo-name').textContent = nombre; document.getElementById('add-unit-modal').style.display = 'flex'; }

async function openIncidentModal() {
    const select = document.getElementById('incident-unit-id'); 
    select.innerHTML = '<option>Cargando...</option>'; 
    document.getElementById('incident-modal').style.display = 'flex';
    try { 
        const res = await fetch(`${API_BASE_URL}/units/my-reservations`, { headers: { 'Authorization': `Bearer ${token}` } }); 
        const myRes = await res.json(); 
        select.innerHTML = '<option value="">Selecciona unidad...</option>' + myRes.map(r => `<option value="${r.unit_id}">${r.unit_details?.nombre} (${r.unit_details?.condo_name})</option>`).join(''); 
    } catch(e) { select.innerHTML = '<option>Error</option>'; }
}

document.addEventListener('DOMContentLoaded', () => {
    if (userData) {
        document.getElementById('user-email').textContent = userData.email;
        fetch(`${API_BASE_URL}/config`).then(r => r.json()).then(c => { WS_URL = c.ws_url; initWS(); }).catch(e => console.error("Error WS:", e));
        if (userData.role === 'admin') { 
            document.getElementById('admin-section').style.display = 'block'; 
            
            if (userData.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()) {
                const btnAjustes = document.getElementById('tab-admin-ajustes');
                if(btnAjustes) btnAjustes.style.display = 'inline-block';
            }
            
            loadAdminCondos(); 
        } 
        else if (userData.role === 'mantenimiento') { 
            const maintSec = document.getElementById('mantenimiento-section');
            if(maintSec) maintSec.style.display = 'block'; 
            loadMaintenanceTasks(); 
        } 
        else { 
            document.getElementById('residente-section').style.display = 'block'; 
            loadResidenteDashboard(); 
        }
    }
});

// ==============================================================================
// AUTO-LIMPIADOR VISUAL (POLLING)
// ==============================================================================
setInterval(() => {
    const viewAdminAm = document.getElementById('view-admin-amenidades');
    const viewResAm = document.getElementById('view-amenidades-res');
    if (viewAdminAm && viewAdminAm.style.display === 'block') loadAmenitiesAdmin();
    if (viewResAm && viewResAm.style.display === 'block') loadAmenitiesForResident();
}, 60000);