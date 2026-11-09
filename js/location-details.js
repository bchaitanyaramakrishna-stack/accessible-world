
const API_URL = "https://accessible-world.onrender.com";

async function loadLocationDetails() {

    const params = new URLSearchParams(window.location.search);
    const locationId = params.get("id");

    const nameElement = document.getElementById("locationName");
    const addressElement = document.getElementById("locationAddress");
    const cityElement = document.getElementById("locationCity");
    const descriptionElement = document.getElementById("locationDescription");
    const featuresContainer = document.getElementById("accessibilityDetails");
    const message = document.getElementById("detailsMessage");

    if (!locationId) {
        nameElement.textContent = "Location not selected.";
        featuresContainer.textContent = "";
        message.textContent = "Please select a location from the homepage.";
        message.className = "register-message error";
        return;
    }

    try {

        const response = await fetch(`${API_URL}/locations`);

        if (!response.ok) {
            throw new Error("Unable to retrieve location details.");
        }

        const locations = await response.json();

        const location = locations.find(
            item => String(item.location_id) === locationId
        );

        if (!location) {
            nameElement.textContent = "Location not found.";
            descriptionElement.textContent = "";
            featuresContainer.textContent = "";
            message.textContent = "The requested location does not exist.";
            message.className = "register-message error";
            return;
        }

        nameElement.textContent = location.name;
        addressElement.textContent =
            "Address: " + (location.address || "Not provided");

        cityElement.textContent =
            "City: " + (location.city || "Not provided");

        descriptionElement.textContent =
            location.description || "No description available.";

        featuresContainer.replaceChildren();

        const features = location.features || [];

        if (features.length === 0) {

            featuresContainer.textContent =
                "No accessibility information available.";

        } else {

            features.forEach(feature => {

                const card = document.createElement("div");
                card.className = "detail-feature-card";

                const heading = document.createElement("h3");
                heading.textContent = feature.feature_name;

                const status = document.createElement("p");
                status.textContent =
                    "Availability: " +
                    (feature.availability || "Not specified");

                card.append(heading, status);

                if (feature.notes) {

                    const notes = document.createElement("p");
                    notes.textContent = "Notes: " + feature.notes;

                    card.appendChild(notes);
                }

                featuresContainer.appendChild(card);
            });
        }

    } catch (error) {

        console.error("Location details error:", error);

        nameElement.textContent = "Unable to load location.";

        message.textContent =
            "Please check whether the backend server is running.";

        message.className = "register-message error";
    }
}

// Submit Accessibility Report
async function submitAccessibilityReport(event) {

    event.preventDefault();

    const token = localStorage.getItem("access_token");

    const reportType = document.getElementById("reportType").value;
    const reportDescription = document.getElementById("reportDescription").value.trim();
    const reportMessage = document.getElementById("reportMessage");

    const params = new URLSearchParams(window.location.search);
    const locationId = Number(params.get("id"));

    if (!token) {
        reportMessage.textContent = "Please log in before submitting a report.";
        return;
    }

    if (!locationId || !reportType || !reportDescription) {
        reportMessage.textContent = "Please complete all fields.";
        return;
    }

    try {

        reportMessage.textContent = "Submitting your report...";

        const response = await fetch(`${API_URL}/reports`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                location_id: locationId,
                report_type: reportType,
                report_description: reportDescription
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Report submission failed.");
        }

        reportMessage.textContent =
            "Your accessibility report was submitted successfully!";

        reportMessage.className = "register-message success";

        document.getElementById("reportForm").reset();

    } catch (error) {

        console.error("Report submission error:", error);

        reportMessage.textContent = error.message;
        reportMessage.className = "register-message error";
    }
}


// Page initialization
document.addEventListener("DOMContentLoaded", () => {

    loadLocationDetails();

    const reportForm = document.getElementById("reportForm");

    if (reportForm) {
        reportForm.addEventListener("submit", submitAccessibilityReport);
    }

});