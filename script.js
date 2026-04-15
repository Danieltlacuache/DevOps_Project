const API_BASE_URL = 'https://hpqvi22yyd.execute-api.us-east-2.amazonaws.com/Prod';

/**
 * Muestra mensajes de feedback al usuario (éxito o error)
 */
function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';

    // Limpiar el mensaje después de 5 segundos
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
        messageDiv.style.display = 'none';
    }, 5000);
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Limpiamos espacios y convertimos a minúsculas para coincidir con DynamoDB
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        return showMessage('Por favor, completa todos los campos', 'error');
    }

    try {
        console.log("Iniciando sesión...");
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            // Guardar el token JWT para usarlo en el Dashboard
            localStorage.setItem('token', data.token);
            
            showMessage('✅ Login exitoso! Redirigiendo...', 'success');
            
            // Redirigir al dashboard después de un breve delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            // CORRECCIÓN: Usamos data.msg porque así lo definimos en la Lambda profesional
            showMessage(data.msg || 'Credenciales inválidas', 'error');
        }
    } catch (error) {
        console.error("Error en fetch:", error);
        showMessage('❌ Error de conexión con el servidor', 'error');
    }
});