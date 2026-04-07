// Asegúrate de que esta URL sea la correcta de tu API Gateway
const API_BASE_URL = 'https://7y2exkoxi2.execute-api.us-east-2.amazonaws.com/Prod';

console.log("Script register.js cargado correctamente.");

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Formulario enviado. Procesando...");

    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const adminKey = document.getElementById('admin-key').value;
    const messageDiv = document.getElementById('message');

    // Validación local rápida de formato de email (con punto y dominio)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        messageDiv.textContent = "Error: Por favor introduce un correo válido (ej. usuario@dominio.com)";
        messageDiv.className = "message error";
        return;
    }

    try {
        console.log("Intentando conectar con AWS en:", `${API_BASE_URL}/auth/register`);
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password,
                admin_key: adminKey
            })
        });

        const data = await response.json();
        console.log("Respuesta recibida de AWS:", data);

        if (response.ok) {
            messageDiv.textContent = "¡Registro exitoso! Redirigiendo...";
            messageDiv.className = "message success";
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            // Aquí capturamos errores como "Usuario ya existe" o errores de la Lambda
            messageDiv.textContent = "Error: " + (data.message || "No se pudo completar el registro");
            messageDiv.className = "message error";
        }

    } catch (error) {
        console.error("Error crítico de conexión:", error);
        messageDiv.textContent = "Error de conexión: No se pudo contactar al servidor.";
        messageDiv.className = "message error";
    }
});