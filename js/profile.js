
const API_URL = "https://accessible-world.onrender.com";

const token = localStorage.getItem("access_token");

const profileMessage = document.getElementById("profileMessage");
const editForm = document.getElementById("profileEditForm");
const editButton = document.getElementById("editProfileBtn");
const cancelButton = document.getElementById("cancelEditBtn");

// Check login
if (!token) {
    window.location.href = "login.html";
}

// Display messages
function showProfileMessage(message, isError = false) {
    profileMessage.textContent = message;
    profileMessage.style.color = isError ? "#d35d50" : "#087f5b";
}

// Load profile information
async function loadProfile() {
    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            logout();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load profile.");
        }

        const data = await response.json();

        // Basic information
        document.getElementById("profileName").textContent = data.full_name;
        document.getElementById("profileEmail").textContent = data.email;
        document.getElementById("profileRole").textContent = data.user_role;

        document.getElementById("profileAvatar").textContent =
            data.full_name.trim().charAt(0).toUpperCase() || "U";

        // Account details
        document.getElementById("detailName").textContent = data.full_name;
        document.getElementById("detailEmail").textContent = data.email;
        document.getElementById("detailRole").textContent = data.user_role;

        document.getElementById("detailCreated").textContent =
            data.created_at
                ? new Date(data.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                })
                : "Not available";

        // Report statistics
        document.getElementById("totalReports").textContent = data.total_reports ?? 0;
        document.getElementById("pendingReports").textContent = data.pending_reports ?? 0;
        document.getElementById("approvedReports").textContent = data.approved_reports ?? 0;
        document.getElementById("rejectedReports").textContent = data.rejected_reports ?? 0;

        // Fill edit field
        document.getElementById("editFullName").value = data.full_name;

    } catch (error) {
        console.error("Profile error:", error);
        showProfileMessage(
            "Could not load your profile. Please refresh and try again.",
            true
        );
    }
}

// Open edit form
editButton.addEventListener("click", function () {
    editForm.hidden = false;
    editButton.style.display = "none";
    document.getElementById("editFullName").focus();
});

// Cancel editing
cancelButton.addEventListener("click", function () {
    editForm.hidden = true;
    editButton.style.display = "inline-flex";
    showProfileMessage("");
});

// Save profile changes
editForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fullName = document.getElementById("editFullName").value.trim();

    if (fullName.length < 2) {
        showProfileMessage("Please enter a valid full name.", true);
        return;
    }

    const saveButton = editForm.querySelector(".profile-save-button");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                full_name: fullName
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Could not update profile.");
        }

        await loadProfile();

        editForm.hidden = true;
        editButton.style.display = "inline-flex";

        showProfileMessage("Profile updated successfully!");

    } catch (error) {
        showProfileMessage(error.message, true);

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
});

// Load profile when page opens
if (token) {
    loadProfile();
}
