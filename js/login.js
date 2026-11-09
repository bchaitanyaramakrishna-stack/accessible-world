
const API_URL = "http://127.0.0.1:8000";

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const message = document.getElementById("loginMessage");
    const button = document.getElementById("loginButton");

    message.textContent = "";
    message.className = "register-message";

    button.disabled = true;
    button.textContent = "Logging in...";

    try {

        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed.");
        }

        // Store the authentication token
        localStorage.setItem("access_token", data.access_token);

        localStorage.setItem(
            "logged_in_user",
            JSON.stringify(data.user)
        );

        showMessage(
            "Login successful! Welcome, " + data.user.full_name + ".",
            "success"
        );

        loginForm.reset();

    } catch (error) {

        showMessage(
            error.message || "Unable to connect to the server.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Login →";

    }

});

function showMessage(text, type) {

    const message = document.getElementById("loginMessage");

    message.textContent = text;
    message.className = "register-message " + type;

}
