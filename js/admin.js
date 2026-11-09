
const message = document.getElementById("admin-message");
const reportsContainer = document.getElementById("reports-container");

async function loadReports() {
    const token = localStorage.getItem("access_token");

    if (!token) {
        message.textContent = "Please log in first.";
        return;
    }

    try {
        const response = await fetch(
            "https://accessible-world.onrender.com/admin/reports",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load reports. Please check admin login.");
        }

        const reports = await response.json();

        reportsContainer.innerHTML = "";
        message.textContent = "";

        if (reports.length === 0) {
            message.textContent = "No accessibility reports found.";
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
                `User: ${report.full_name}`,
                `Email: ${report.email}`,
                `Location: ${report.location_name}`,
                `Description: ${report.report_description}`,
                `Status: ${report.status}`,
                `Submitted: ${report.created_at ? new Date(report.created_at).toLocaleString() : "Not available"}`
            ];

            details.forEach(detail => {
                const paragraph = document.createElement("p");
                paragraph.textContent = detail;
                card.appendChild(paragraph);
            });

            if (report.status === "PENDING") {
                const approveButton = document.createElement("button");
                approveButton.textContent = "Approve";
                approveButton.className = "approve-btn";

                approveButton.addEventListener("click", () => {
                    updateReportStatus(report.report_id, "APPROVED");
                });

                const rejectButton = document.createElement("button");
                rejectButton.textContent = "Reject";
                rejectButton.className = "reject-btn";

                rejectButton.addEventListener("click", () => {
                    updateReportStatus(report.report_id, "REJECTED");
                });

                card.appendChild(approveButton);
                card.appendChild(rejectButton);
            }

            reportsContainer.appendChild(card);
        });

    } catch (error) {
        message.textContent = error.message;
    }
}

async function updateReportStatus(reportId, newStatus) {
    const token = localStorage.getItem("access_token");

    if (!token) {
        message.textContent = "Please log in again.";
        return;
    }

    try {
        const response = await fetch(
            `https://accessible-world.onrender.com/admin/reports/${reportId}/status`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: newStatus
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Could not update report status.");
        }

        message.textContent = result.message;

        await loadReports();

    } catch (error) {
        message.textContent = error.message;
    }
}

loadReports();
