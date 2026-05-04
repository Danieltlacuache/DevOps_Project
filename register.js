// ==============================================================================
// CONFIGURACIÓN CENTRALIZADA
// ==============================================================================
// Tomamos la URL del config.js y le quitamos la barra final si la tiene
const API_BASE_URL = ENV.AWS_API_URL.replace(/\/$/, "");

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
    const adminKey = document.getElementById('admin-key')?.value.trim();

    if (password !== confirmPassword) {
        mostrarMensaje("❌ Las contraseñas no coinciden.", "error");
        return;
    }

    if (password.length < 6) {
        mostrarMensaje("❌ La contraseña es muy corta.", "error");
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        mostrarMensaje("❌ Ingresa un correo válido.", "error");
        return;
    }

    try {
        console.log("Enviando registro a AWS...");
        
        // Deshabilitar botón durante la petición
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Registrando...";
        
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
            btn.disabled = false;
            btn.textContent = originalText;
        }

    } catch (error) {
        console.error("Error de conexión:", error);
        mostrarMensaje("❌ Error: No hay conexión con el servidor.", "error");
        const btn = document.querySelector('#register-form button');
        btn.disabled = false;
        btn.textContent = "Registrarse";
    }
});

// --- HELPER PARA MENSAJES ---
function mostrarMensaje(texto, tipo) {
    if (!messageDiv) return;
    messageDiv.textContent = texto;
    messageDiv.className = "message " + tipo;
    messageDiv.style.display = "block";
    
    // Opcional: Ocultar el mensaje después de unos segundos
    if(tipo === 'error') {
        setTimeout(() => {
            messageDiv.style.display = "none";
        }, 6000);
    }
}