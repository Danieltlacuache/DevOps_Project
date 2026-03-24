// Reemplaza con la URL de tu API Gateway después del despliegue
const API_BASE_URL = 'https://4t7zobb7o6.execute-api.us-east-2.amazonaws.com';

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = 'message ' + type;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 5000);
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(API_BASE_URL + '/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Registro exitoso! Ahora puedes iniciar sesión.', 'success');
            // Redirigir a login después de un tiempo
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            showMessage(data.message || 'Error en registro', 'error');
        }
    } catch (error) {
        showMessage('Error de conexión', 'error');
    }
});