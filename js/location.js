
const API_URL = "http://127.0.0.1:8000";

// Stores all locations received from the backend
let allLocations = [];
// Stores the interactive Leaflet map
let locationsMap = null;

// Stores map markers
let locationMarkers = [];

// Stores the visitor's current coordinates
let currentUserCoordinates = null;

// Create the interactive map
function initializeMap() {

    const mapContainer = document.getElementById("locations-map");

    if (!mapContainer || typeof L === "undefined") {
        console.error("Map container or Leaflet library not found.");
        return;
    }

    // Prevent creating the map more than once
    if (locationsMap !== null) {
        return;
    }

    // Initial map view near our demo locations
    locationsMap = L.map("locations-map").setView(
        [17.72, 83.30],
        12
    );

    // Load free OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(locationsMap);
}

// Display database locations as map markers
function displayLocationMarkers(locations) {

    if (!locationsMap) {
        return;
    }

    // Remove old markers
    locationMarkers.forEach(marker => {
        locationsMap.removeLayer(marker);
    });

    locationMarkers = [];

    const validLocations = locations.filter(location =>
        location.latitude !== null &&
        location.longitude !== null &&
        Number.isFinite(Number(location.latitude)) &&
        Number.isFinite(Number(location.longitude)) &&
        Math.abs(Number(location.latitude)) <= 90 &&
        Math.abs(Number(location.longitude)) <= 180
    );

    validLocations.forEach(location => {

        const latitude = Number(location.latitude);
        const longitude = Number(location.longitude);

        const marker = L.marker([latitude, longitude])
            .addTo(locationsMap);

        const popup = document.createElement("div");

        const heading = document.createElement("strong");
        heading.textContent = location.name;

        const address = document.createElement("p");
        address.textContent = location.address || "Address not available";

        const detailsLink = document.createElement("a");

detailsLink.href =
    `location-details.html?id=${encodeURIComponent(location.location_id)}`;

detailsLink.textContent = "View Location Details";

const routeButton = document.createElement("button");

routeButton.textContent = "Get Directions";

routeButton.type = "button";

routeButton.style.display = "block";
routeButton.style.marginTop = "10px";

routeButton.addEventListener("click", function () {
    showRouteToLocation(location);
});

popup.append(heading, address, detailsLink, routeButton);

        marker.bindPopup(popup);

        locationMarkers.push(marker);
    });

    // Automatically adjust the map to show all markers
    if (validLocations.length > 0) {

        const markerGroup = L.featureGroup(locationMarkers);

        locationsMap.fitBounds(markerGroup.getBounds(), {
            padding: [30, 30],
            maxZoom: 15
        });
    }
}

// Find and display the visitor's current location
function findCurrentLocation() {

    const message = document.getElementById("currentLocationMessage");

    if (!navigator.geolocation) {
        message.textContent = "Your browser does not support location detection.";
        return;
    }

    message.textContent = "Finding your current location...";

    navigator.geolocation.getCurrentPosition(

        function (position) {

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            // Save coordinates for route calculation
currentUserCoordinates = [latitude, longitude];
            // Add a marker for the visitor
            const userMarker = L.marker([latitude, longitude])
                .addTo(locationsMap);

            userMarker.bindPopup("You are here!").openPopup();

            // Move the map to the visitor's location
            locationsMap.setView([latitude, longitude], 15);

            message.textContent = "Your current location was found successfully.";
        },

        function (error) {

            if (error.code === 1) {
                message.textContent = "Location permission was denied. Please allow location access.";
            } else if (error.code === 2) {
                message.textContent = "Your current location is unavailable.";
            } else {
                message.textContent = "Location request timed out. Please try again.";
            }
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}
// Draw a route from the visitor to a selected location
async function showRouteToLocation(location) {

    if (!currentUserCoordinates) {
        alert("Please find your current location first.");
        return;
    }

    if (
        location.latitude == null ||
        location.longitude == null
    ) {
        alert("Coordinates are not available for this location.");
        return;
    }

    const destinationLatitude = Number(location.latitude);
    const destinationLongitude = Number(location.longitude);

    const startLatitude = currentUserCoordinates[0];
    const startLongitude = currentUserCoordinates[1];

    const message = document.getElementById("currentLocationMessage");

    try {

        message.textContent = "Calculating your route...";

        const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${startLongitude},${startLatitude};` +
            `${destinationLongitude},${destinationLatitude}` +
            `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Route service unavailable.");
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            throw new Error("No route found.");
        }

        // Remove the previous route, if any
        if (window.routeLayer) {
            locationsMap.removeLayer(window.routeLayer);
        }

        // Draw the new route
        window.routeLayer = L.geoJSON(
            data.routes[0].geometry
        ).addTo(locationsMap);

        // Fit the map around the route
        locationsMap.fitBounds(
            window.routeLayer.getBounds(),
            { padding: [40, 40] }
        );

        const distance =
            (data.routes[0].distance / 1000).toFixed(2);

        const duration =
            Math.round(data.routes[0].duration / 60);

        message.textContent =
            `Route found! Distance: ${distance} km. Estimated driving time: ${duration} minutes.`;

    } catch (error) {

        console.error("Route error:", error);

        message.textContent =
            "Unable to calculate the route. Please try again later.";
    }
}
// Load locations from Oracle through FastAPI
async function loadLocations() {

    const container = document.getElementById("locations-container");

    if (!container) {
        console.error("Locations container not found.");
        return;
    }

    container.textContent = "Loading accessible locations...";

    try {

        const response = await fetch(`${API_URL}/locations`);

        if (!response.ok) {
            throw new Error("Unable to load locations");
        }

        allLocations = await response.json();

        displayLocations(allLocations);

        displayLocationMarkers(allLocations);

    } catch (error) {

        console.error("Location loading error:", error);

        container.textContent =
            "Unable to load locations. Please check the backend.";
    }
}


// Display location cards
function displayLocations(locations) {

    const container = document.getElementById("locations-container");
    const message = document.getElementById("searchMessage");

    container.replaceChildren();

    if (locations.length === 0) {

        container.textContent = "No matching locations found.";

        if (message) {
            message.textContent =
                "Try searching with another location name or city.";
        }

        return;
    }

    locations.forEach(location => {

        const card = document.createElement("div");
        card.className = "location-card";

        card.style.cursor = "pointer";

card.addEventListener("click", function () {
    window.location.href =
        `location-details.html?id=${encodeURIComponent(location.location_id)}`;
});

        const heading = document.createElement("h3");
        heading.textContent = location.name;

        const address = document.createElement("p");
        address.textContent =
            location.address || "Address not provided";

        const city = document.createElement("p");
        city.textContent = location.city || "";

        const description = document.createElement("p");
        description.textContent = location.description || "";

        const featureHeading = document.createElement("h4");
        featureHeading.textContent = "Accessibility Features";

        const featureList = document.createElement("ul");
        featureList.className = "feature-list";

        const features = location.features || [];

        if (features.length > 0) {

            features.forEach(feature => {

                const item = document.createElement("li");

                const featureName = document.createElement("strong");
                featureName.textContent = feature.feature_name;

                const status = document.createElement("span");
                status.textContent =
                    ` — ${feature.availability || "Not specified"}`;

                item.append(featureName, status);

                if (feature.notes) {

                    const note = document.createElement("small");
                    note.textContent = ` (${feature.notes})`;

                    item.appendChild(note);
                }

                featureList.appendChild(item);
            });

        } else {

            const item = document.createElement("li");

            item.textContent =
                "No accessibility information available.";

            featureList.appendChild(item);
        }

        card.append(
            heading,
            address,
            city,
            description,
            featureHeading,
            featureList
        );

        container.appendChild(card);
    });

    if (message) {
        message.textContent =
            `Showing ${locations.length} of ${allLocations.length} locations.`;
    }
}


// Search locations by name, city, address or description
function searchPlace() {

    const searchInput = document.getElementById("placeSearch");
    const searchTerm = searchInput.value.trim().toLowerCase();

    if (searchTerm === "") {

        displayLocations(allLocations);
        return;
    }

    const filteredLocations = allLocations.filter(location => {

        return (
            (location.name || "").toLowerCase().includes(searchTerm) ||
            (location.city || "").toLowerCase().includes(searchTerm) ||
            (location.address || "").toLowerCase().includes(searchTerm) ||
            (location.description || "").toLowerCase().includes(searchTerm)
        );

    });

    displayLocations(filteredLocations);
}


// Initialize after the page loads
document.addEventListener("DOMContentLoaded", function () {
    initializeMap();

    loadLocations();

    const searchInput = document.getElementById("placeSearch");

    if (searchInput) {

        // Update results while typing
        searchInput.addEventListener("input", searchPlace);
    }

        // Connect current-location button
    const currentLocationBtn = document.getElementById("currentLocationBtn");

    if (currentLocationBtn) {
        currentLocationBtn.addEventListener("click", findCurrentLocation);
    }
});
