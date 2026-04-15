// --- CONFIGURACIÓN ---
const API_BASE_URL = 'https://hpqvi22yyd.execute-api.us-east-2.amazonaws.com/Prod';

console.log("Script register.js cargado correctamente.");

const passInput = document.getElementById('register-password');
const confirmInput = document.getElementById('register-password-confirm');
const messageDiv = document.getElementById('message');

// --- VALIDACIÓN VISUAL EN TIEMPO REAL ---
function validarCoincidencia() {
    if (!confirmInput.value) {
        confirmInput.style.borderColor = "#e2e8f0";
    } else if (passInput.value === confirmInput.value) {
        confirmInput.style.borderColor = "#22c55e"; // Verde
        messageDiv.style.display = "none";
    } else {
        confirmInput.style.borderColor = "#ef4444"; // Rojo
    }
}

if (passInput && confirmInput) {
    passInput.addEventListener('input', validarCoincidencia);
    confirmInput.addEventListener('input', validarCoincidencia);
}

// --- LÓGICA DE REGISTRO ---
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value.trim();
    const password = passInput.value;
    const confirmPassword = confirmInput.value;
    const adminKey = document.getElementById('admin-key').value.trim();

    // 1. Validaciones de Seguridad
    if (password !== confirmPassword) {
        mostrarMensaje("Error: Las contraseñas no coinciden.", "error");
        return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        mostrarMensaje("Error: Introduce un correo válido.", "error");
        return;
    }

    try {
        console.log("Enviando registro a AWS...");
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email.toLowerCase(),
                password: password,
                admin_token: adminKey || null // Enviamos null si no hay token
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Limpieza preventiva para evitar errores de sesión previa al loguearse
            localStorage.clear();
            
            mostrarMensaje("✅ ¡Registro exitoso! Redirigiendo al login...", "success");
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            // Sincronizado con 'msg' de tu Lambda profesional
            mostrarMensaje("❌ Error: " + (data.msg || "No se pudo registrar."), "error");
        }

    } catch (error) {
        console.error("Error de conexión:", error);
        mostrarMensaje("❌ Error: No hay conexión con el servidor.", "error");
    }
});

// --- HELPER PARA MENSAJES ---
function mostrarMensaje(texto, tipo) {
    messageDiv.textContent = texto;
    messageDiv.className = `message ${tipo}`;
    messageDiv.style.display = "block";
}