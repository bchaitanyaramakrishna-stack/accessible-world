
const message = document.getElementById("reports-message");
const reportsContainer = document.getElementById("my-reports-container");

async function loadMyReports() {
    const token = localStorage.getItem("access_token");

    if (!token) {
        message.textContent = "Please log in to view your reports.";
        return;
    }

    try {
        const response = await fetch(
            "https://accessible-world.onrender.com/my-reports",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load your reports. Please log in again.");
        }

        const reports = await response.json();

        reportsContainer.innerHTML = "";
        message.textContent = "";

        if (reports.length === 0) {
            message.textContent = "You have not submitted any reports yet.";
            return;
        }

        reports.forEach(report => {
            const card = document.createElement("div");
            card.className = "report-card";

            const heading = document.createElement("h3");
            heading.textContent = report.report_type;
            card.appendChild(heading);

            const details = [
                `Report ID: ${report.report_id}`,
                `Location: ${report.location_name}`,
                `Description: ${report.report_description}`,
                `Submitted: ${report.created_at ? new Date(report.created_at).toLocaleString() : "Not available"}`
            ];

            details.forEach(detail => {
                const paragraph = document.createElement("p");
                paragraph.textContent = detail;
                card.appendChild(paragraph);
            });

            const status = document.createElement("p");
            status.textContent = `Status: ${report.status}`;
            status.className = "report-status";
            status.classList.add(report.status.toLowerCase());
            card.appendChild(status);

            reportsContainer.appendChild(card);
        });

    } catch (error) {
        message.textContent = error.message;
    }
}

loadMyReports();
