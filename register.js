const API_BASE_URL = 'https://7y2exkoxi2.execute-api.us-east-2.amazonaws.com/Prod';

console.log("Script register.js cargado correctamente.");

const passInput = document.getElementById('register-password');
const confirmInput = document.getElementById('register-password-confirm');
const messageDiv = document.getElementById('message');

// --- VALIDACIÓN VISUAL EN TIEMPO REAL ---
function validarCoincidencia() {
    if (confirmInput.value === "") {
        confirmInput.style.borderColor = "#e2e8f0"; // Color neutro
    } else if (passInput.value === confirmInput.value) {
        confirmInput.style.borderColor = "#22c55e"; // Verde (Coinciden)
        messageDiv.style.display = "none";
    } else {
        confirmInput.style.borderColor = "#ef4444"; // Rojo (No coinciden)
    }
}

passInput.addEventListener('input', validarCoincidencia);
confirmInput.addEventListener('input', validarCoincidencia);

// --- LÓGICA DE REGISTRO ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value.trim();
    const password = passInput.value;
    const confirmPassword = confirmInput.value;
    const adminKey = document.getElementById('admin-key').value;

    // 1. Validar que las contraseñas coincidan antes de ir al servidor
    if (password !== confirmPassword) {
        messageDiv.textContent = "Error: Las contraseñas no coinciden.";
        messageDiv.className = "message error";
        messageDiv.style.display = "block";
        confirmInput.focus();
        return;
    }

    // 2. Validación de formato de email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        messageDiv.textContent = "Error: Introduce un correo válido.";
        messageDiv.className = "message error";
        messageDiv.style.display = "block";
        return;
    }

    try {
        console.log("Enviando datos a AWS...");
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                admin_token: adminKey // Asegúrate de que tu Lambda use 'admin_token'
            })
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.textContent = "✅ ¡Registro exitoso! Redirigiendo...";
            messageDiv.className = "message success";
            messageDiv.style.display = "block";
            
            // Guardamos el token si la lambda lo devuelve ya en el registro (opcional)
            if(data.token) localStorage.setItem('token', data.token);

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            messageDiv.textContent = "❌ Error: " + (data.message || "No se pudo registrar.");
            messageDiv.className = "message error";
            messageDiv.style.display = "block";
        }

    } catch (error) {
        console.error("Error de conexión:", error);
        messageDiv.textContent = "❌ Error: No hay conexión con el servidor.";
        messageDiv.className = "message error";
        messageDiv.style.display = "block";
    }
});