
const API_URL = "http://127.0.0.1:8000";

const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    const message = document.getElementById("registerMessage");
    const button = document.getElementById("registerButton");

    message.textContent = "";
    message.className = "register-message";

    if (fullName.length < 2) {
        showMessage("Please enter a valid full name.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.", "error");
        return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        showMessage("Password must contain at least 8 characters, including a letter and a number.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Creating Account...";

    try {

        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Registration failed.");
        }

        showMessage(
            "Registration successful! Your User ID is " + data.user_id,
            "success"
        );

        registerForm.reset();

    } catch (error) {

        showMessage(
            error.message || "Unable to connect to the server. Please try again.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Create Account →";

    }

});

function showMessage(text, type) {

    const message = document.getElementById("registerMessage");

    message.textContent = text;
    message.className = "register-message " + type;

}
