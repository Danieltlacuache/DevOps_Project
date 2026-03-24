// Reemplaza con la URL de tu API Gateway después del despliegue
const API_BASE_URL = 'https://4t7zobb7o6.execute-api.us-east-2.amazonaws.com';

function showMessage(message, type) {
    // Similar a script.js
    const messageDiv = document.getElementById('message');
    if (!messageDiv) {
        const newMessageDiv = document.createElement('div');
        newMessageDiv.id = 'message';
        newMessageDiv.className = 'message';
        document.querySelector('.dashboard-container').appendChild(newMessageDiv);
    }
    const msgDiv = document.getElementById('message');
    msgDiv.textContent = message;
    msgDiv.className = 'message ' + type;
    setTimeout(() => {
        msgDiv.textContent = '';
        msgDiv.className = 'message';
    }, 5000);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

function showSection(sectionId) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));

    // Mostrar la sección seleccionada
    document.getElementById(sectionId).classList.add('active');

    // Actualizar botones de navegación
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// Gestión de Residentes
document.getElementById('resident-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('resident-name').value;
    const apartment = document.getElementById('resident-apartment').value;
    const email = document.getElementById('resident-email').value;
    const phone = document.getElementById('resident-phone').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/residents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, apartment, email, phone }),
        });

        if (response.ok) {
            showMessage('Residente agregado exitosamente', 'success');
            loadResidents();
            e.target.reset();
        } else {
            showMessage('Error al agregar residente', 'error');
        }
    } catch (error) {
        showMessage('Error de conexión', 'error');
    }
});

async function loadResidents() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/residents', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const residents = await response.json();
            const tbody = document.querySelector('#residents-table tbody');
            tbody.innerHTML = '';

            residents.forEach(resident => {
                const row = `
                    <tr>
                        <td>${resident.name}</td>
                        <td>${resident.apartment}</td>
                        <td>${resident.email}</td>
                        <td>${resident.phone || ''}</td>
                        <td>
                            <button class="btn btn-small" onclick="editResident('${resident.id}')">Editar</button>
                            <button class="btn btn-small logout-btn" onclick="deleteResident('${resident.id}')">Eliminar</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Error loading residents:', error);
    }
}

// Gestión de Pagos
document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const residentId = document.getElementById('payment-resident').value;
    const amount = document.getElementById('payment-amount').value;
    const date = document.getElementById('payment-date').value;
    const description = document.getElementById('payment-description').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ residentId, amount, date, description }),
        });

        if (response.ok) {
            showMessage('Pago registrado exitosamente', 'success');
            loadPayments();
            e.target.reset();
        } else {
            showMessage('Error al registrar pago', 'error');
        }
    } catch (error) {
        showMessage('Error de conexión', 'error');
    }
});

async function loadPayments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/payments', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const payments = await response.json();
            const tbody = document.querySelector('#payments-table tbody');
            tbody.innerHTML = '';

            payments.forEach(payment => {
                const row = `
                    <tr>
                        <td>${payment.residentName}</td>
                        <td>$${payment.amount}</td>
                        <td>${payment.date}</td>
                        <td>${payment.description}</td>
                        <td>
                            <button class="btn btn-small logout-btn" onclick="deletePayment('${payment.id}')">Eliminar</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

// Gestión de Anuncios
document.getElementById('announcement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('announcement-title').value;
    const content = document.getElementById('announcement-content').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/announcements', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, content }),
        });

        if (response.ok) {
            showMessage('Anuncio publicado exitosamente', 'success');
            loadAnnouncements();
            e.target.reset();
        } else {
            showMessage('Error al publicar anuncio', 'error');
        }
    } catch (error) {
        showMessage('Error de conexión', 'error');
    }
});

async function loadAnnouncements() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/announcements', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const announcements = await response.json();
            const list = document.getElementById('announcements-list');
            list.innerHTML = '';

            announcements.forEach(announcement => {
                const card = `
                    <div class="card">
                        <h4>${announcement.title}</h4>
                        <p>${announcement.content}</p>
                        <small>Publicado el ${announcement.date}</small>
                        <button class="btn btn-small logout-btn" onclick="deleteAnnouncement('${announcement.id}')">Eliminar</button>
                    </div>
                `;
                list.innerHTML += card;
            });
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Gestión de Mantenimiento
document.getElementById('maintenance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const residentId = document.getElementById('maintenance-resident').value;
    const type = document.getElementById('maintenance-type').value;
    const description = document.getElementById('maintenance-description').value;
    const priority = document.getElementById('maintenance-priority').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ residentId, type, description, priority }),
        });

        if (response.ok) {
            showMessage('Solicitud de mantenimiento enviada exitosamente', 'success');
            loadMaintenanceRequests();
            e.target.reset();
        } else {
            showMessage('Error al enviar solicitud', 'error');
        }
    } catch (error) {
        showMessage('Error de conexión', 'error');
    }
});

async function loadMaintenanceRequests() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(API_BASE_URL + '/maintenance', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const requests = await response.json();
            const tbody = document.querySelector('#maintenance-table tbody');
            tbody.innerHTML = '';

            requests.forEach(request => {
                const row = `
                    <tr>
                        <td>${request.residentName}</td>
                        <td>${request.type}</td>
                        <td>${request.description}</td>
                        <td>${request.priority}</td>
                        <td>${request.status}</td>
                        <td>
                            <button class="btn btn-small" onclick="updateMaintenanceStatus('${request.id}', 'completado')">Completar</button>
                            <button class="btn btn-small logout-btn" onclick="deleteMaintenance('${request.id}')">Eliminar</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error('Error loading maintenance requests:', error);
    }
}

// Funciones auxiliares para editar/eliminar (placeholders)
function editResident(id) {
    showMessage('Función de edición no implementada aún', 'error');
}

function deleteResident(id) {
    if (confirm('¿Estás seguro de eliminar este residente?')) {
        // Implementar eliminación
        showMessage('Función de eliminación no implementada aún', 'error');
    }
}

function deletePayment(id) {
    if (confirm('¿Estás seguro de eliminar este pago?')) {
        showMessage('Función de eliminación no implementada aún', 'error');
    }
}

function deleteAnnouncement(id) {
    if (confirm('¿Estás seguro de eliminar este anuncio?')) {
        showMessage('Función de eliminación no implementada aún', 'error');
    }
}

function deleteMaintenance(id) {
    if (confirm('¿Estás seguro de eliminar esta solicitud?')) {
        showMessage('Función de eliminación no implementada aún', 'error');
    }
}

function updateMaintenanceStatus(id, status) {
    showMessage('Función de actualización no implementada aún', 'error');
}

// Cargar datos iniciales
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    } else {
        loadResidents();
        loadPayments();
        loadAnnouncements();
        loadMaintenanceRequests();
    }
});