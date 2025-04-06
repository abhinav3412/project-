// Function to calculate distance between two coordinates (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

let lastDatahash = null;
// Fetch sensor data from JSON file
async function fetchSensorData() {
    try {
        const response = await fetch("/user/get_sensor_data");
        if (!response.ok) {
            throw new Error("Failed to fetch sensor data");
        }
        return await response.json();
        // const data = await response.json();
        // const dataHash = JSON.stringify(data);

        // if(dataHash !== lastDatahash){
        //     lastDatahash = dataHash;
        //     location.reload();
        // }
    } catch (error) {
        console.error("Error fetching sensor data:", error);
        return [];
    }
}
// setInterval(fetchSensorData, 100000)

// Fetch hazardous features near a location using Overpass API
async function fetchHazardousFeatures(lat, lng, radius = 5) {
    const overpassUrl = `
        https://overpass-api.de/api/interpreter?data=
        [out:json];
        (
            node["natural"="water"](around:${radius * 1000},${lat},${lng});
            way["natural"="water"](around:${radius * 1000},${lat},${lng});
            relation["natural"="water"](around:${radius * 1000},${lat},${lng});
            node["natural"="cliff"](around:${radius * 1000},${lat},${lng});
            way["natural"="cliff"](around:${radius * 1000},${lat},${lng});
            relation["natural"="cliff"](around:${radius * 1000},${lat},${lng});
            node["landuse"="quarry"](around:${radius * 1000},${lat},${lng});
            way["landuse"="quarry"](around:${radius * 1000},${lat},${lng});
            relation["landuse"="quarry"](around:${radius * 1000},${lat},${lng});
            node["geological"="hazard"](around:${radius * 1000},${lat},${lng});
            way["geological"="hazard"](around:${radius * 1000},${lat},${lng});
            relation["geological"="hazard"](around:${radius * 1000},${lat},${lng});
        );
        out center;
    `.replace(/\s+/g, ''); // Remove whitespace for compact URL

    try {
        const response = await fetch(overpassUrl);
        const data = await response.json();
        return data.elements.map(element => {
            if (element.center) {
                return { lat: element.center.lat, lng: element.center.lon };
            } else if (element.lat && element.lon) {
                return { lat: element.lat, lng: element.lon };
            }
            return null;
        }).filter(Boolean); // Filter out invalid entries
    } catch (error) {
        console.error("Error fetching hazardous feature data:", error);
        return [];
    }
}

// Initialize the map with user's geolocation
async function initMap(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const accuracy = position.coords.accuracy; // Accuracy in meters

    // Initialize map centered on user's location
    const map = L.map('map').setView([userLat, userLng], 15);

    // OpenStreetMap standard tiles
    const normalLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Esri satellite tiles
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; GIS User Community',
    });

    // Add layer control for switching map views
    L.control.layers({ "Normal View": normalLayer, "Satellite View": satelliteLayer }).addTo(map);

    // Add a blue circle for the user’s location accuracy (PULSATING EFFECT)
    let userLocationCircle = L.circle([userLat, userLng], {
        color: '#4285F4', // Google Maps blue
        fillColor: '#4285F4',
        fillOpacity: 0.3, // Enhanced visibility
        radius: accuracy
    }).addTo(map);

    // Add a solid blue dot at the center (LARGER & BOLDER)
    let blueDot = L.circleMarker([userLat, userLng], {
        radius: 8, // Bigger for better visibility
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 1,
        weight: 2 // Bolder border
    }).addTo(map);

    // Animate the circle to create a pulsating effect
    function animateCircle() {
        let growing = true;
        setInterval(() => {
            let newRadius = growing ? userLocationCircle.getRadius() * 1.15 : userLocationCircle.getRadius() * 0.85;
            userLocationCircle.setRadius(newRadius);
            growing = !growing;
        }, 800); // Adjust speed of animation
    }
    animateCircle();

    // Add a "Recenter to Geolocation" button
    const recenterButton = L.Control.extend({
        options: {
            position: 'topleft' // Position the button in the top-left corner
        },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control'); // Create a button container
            container.style.backgroundColor = 'white';
            container.style.border = '1px solid #ccc';
            container.style.padding = '5px';
            container.style.cursor = 'pointer';
            container.style.borderRadius = '5px';

            // Add an icon or text to the button
            container.innerHTML = '<span>📍</span>'; // Use a location emoji as the icon
            container.title = 'Recenter'; // Tooltip for the button

            // Add click event to recenter the map
            L.DomEvent.on(container, 'click', () => {
                map.setView([userLat, userLng], 15); // Recenter to user's geolocation
                
            });

            return container;
        }
    });

    // Add the recenter button to the map
    map.addControl(new recenterButton());

    // Fetch sensor data
    const pinnedLocations = await fetchSensorData();

    // Add Sensor Markers and Affected Areas
    pinnedLocations.forEach(location => {
        const marker = L.marker([location.lat, location.lng]).addTo(map);
        marker.bindPopup(`
            ${location.label}<br>
            Status: ${location.status}<br>
            Rainfall: ${location.rainfall} mm<br>
            Soil Saturation: ${location.soil_saturation}%<br>
            Slope: ${location.slope}°<br>
            Seismic Activity: ${location.seismic_activity}<br>
            Soil Type: ${location.soil_type}<br>
            Risk Level: ${location.risk}<br>
            Predicted Landslide Time: ${location.predicted_landslide_time || "No prediction available"}
        `);

        // Highlight affected area based on risk level
        if (location.status === 'Alert') {
            // High-risk areas remain RED
            L.circle([location.lat, location.lng], {
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.5,
                radius: location.affectedRadius
            }).addTo(map);

            // Add a flashing danger sign
            const dangerSign = L.divIcon({
                className: 'danger-sign',
                html: '⚠️',
                iconSize: [30, 30]
            });
            L.marker([location.lat, location.lng], { icon: dangerSign }).addTo(map);
        } else if (location.status === 'Warning') {
            // Medium-risk areas are YELLOW
            L.circle([location.lat, location.lng], {
                color: 'orange',
                fillColor: '#ffcc00',
                fillOpacity: 0.5,
                radius: location.affectedRadius
            }).addTo(map);
        }
    });

    // Update Sensor Details Table
    const sensorTableBody = document.getElementById('sensor-table-body');
    pinnedLocations.forEach(location => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${location.label.split(":")[0].trim()}</td>
            <td><span style="color: ${location.status === 'Alert' ? 'red' : location.status === 'Warning' ? 'orange' : 'green'};">${location.status}</span></td>
            <td>${location.rainfall}</td>
            <td>${location.forecasted_rainfall}</td>
            <td>${location.soil_saturation}</td>
            <td>${location.slope}</td>
            <td>${location.seismic_activity}</td>
            <td>${location.soil_type}</td>
            <td>${location.risk}</td>
            <td>${location.predicted_landslide_time || "No prediction available"}</td>
        `;
        sensorTableBody.appendChild(row);
    });

    // Alert System
    const alertMessage = document.getElementById('alert-message');
    const alertSound = document.getElementById('alert-sound');
    const alertBox = document.getElementById('alert-box');

    function triggerAlert(location, distance) {
        // Create alert item
        const alertItem = document.createElement('div');
        alertItem.className = 'alert-item';
        alertItem.innerHTML = `
            <p><strong>${location.label}</strong></p>
            <p>Status: ${location.status}</p>
            <p>Predicted Landslide Time: ${location.predicted_landslide_time || "No prediction available"}</p>
            <p>Distance: ${distance.toFixed(20)} km away</p>
            <button class="share-alert-btn">Share Alert</button> <!-- Add Share Alert Button -->
        `;
        alertBox.appendChild(alertItem);
    
        // Play alert sound
        alertSound.play();
    
        // Redirect map view to the danger area
        map.setView([location.lat, location.lng], 12); // Zoom level 12 for closer view
    
        // Open the sensor's popup
        const marker = L.marker([location.lat, location.lng]).addTo(map);
        marker.bindPopup(`
            ${location.label}<br>
            Status: ${location.status}<br>
            Rainfall: ${location.rainfall} mm<br>
            Soil Saturation: ${location.soil_saturation}%<br>
            Slope: ${location.slope}°<br>
            Seismic Activity: ${location.seismic_activity}<br>
            Soil Type: ${location.soil_type}<br>
            Risk Level: ${location.risk}<br>
            Predicted Landslide Time: ${location.predicted_landslide_time || "No prediction available"}
        `).openPopup();
    
        // Add event listener to the "Share Alert" button
        const shareAlertBtn = alertItem.querySelector('.share-alert-btn');
        shareAlertBtn.addEventListener('click', () => {
            const message = `🚨 LANDSLIDE DETECTED 
                Location: ${location.label}
                Status: ${location.status}
                Predicted Landslide Time: ${location.predicted_landslide_time || "No prediction available"}
                More info: https://final-corrected.vercel.app/
            `.trim();
            showPopup(message); // Show the pop-up modal with the alert details
        });
    }
   // Function to display the pop-up modal
function showPopup(message) {
    const popupMessage = document.getElementById('popup-message');
    const popupModal = document.getElementById('popup-modal');

 // Set the alert message in the pop-up (using innerHTML to render the link)
    popupMessage.innerHTML = message;

    // Set the alert message in the pop-up
    popupMessage.textContent = message;

    // Show the pop-up modal
    popupModal.style.display = 'flex';

    // Get references to the buttons in the pop-up modal
    const confirmShare = document.getElementById('confirm-share');
    const cancelShare = document.getElementById('cancel-share');

    // Handle "Share on WhatsApp" button click
    confirmShare.onclick = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank'); // Redirect to WhatsApp
        popupModal.style.display = 'none'; // Hide the pop-up after sharing
    };

    // Handle "Cancel" button click
    cancelShare.onclick = () => {
        popupModal.style.display = 'none'; // Hide the pop-up
    };
}

    // Simulate alerts after 5 seconds
    setTimeout(() => {
        const alertLocations = pinnedLocations.filter(location => location.status === 'Alert' || location.status === 'Warning');

        // Calculate distances and find the nearest danger
        let nearestDanger = null;
        let minDistance = Infinity;
        alertLocations.forEach(location => {
            const distance = calculateDistance(userLat, userLng, location.lat, location.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearestDanger = location;
            }
            triggerAlert(location, distance);
        });

        // Redirect to the nearest danger
        if (nearestDanger) {
            map.setView([nearestDanger.lat, nearestDanger.lng], 12);
        }
    }, 5000);
// Function to check if the user is near or inside a hazardous area
function isUserNearHazard(userLat, userLng, hazardousAreas, bufferRadius = 10) {
    for (const area of hazardousAreas) {
        const distanceToArea = calculateDistance(userLat, userLng, area.lat, area.lng);
        const safetyBuffer = Math.max(bufferRadius, area.affectedRadius / 1000); // Buffer radius in km
        if (distanceToArea <= safetyBuffer) {
            return true; // User is near or inside a hazardous area
        }
    }
    return false; // User is not near any hazardous areas
}

async function simulateTrafficAndEvacuationRoutes(pinnedLocations, userLat, userLng) {
    // Define unsafe areas
    const unsafeAreas = pinnedLocations.filter(location => location.status === 'Alert' || location.status === 'Warning');

    // Check if the user is near or inside any hazardous areas
    if (!isUserNearHazard(userLat, userLng, unsafeAreas)) {
        console.log("User is not near any hazardous areas. Safe zone search skipped.");
        const routeInfo = document.getElementById('route-info');
        routeInfo.innerHTML = `You are safe! No evacuation required.`;
        return; // Exit the function early
    }

    // Draw unsafe areas on the map
    unsafeAreas.forEach(area => {
        L.circle([area.lat, area.lng], {
            color: area.status === 'Alert' ? 'red' : 'orange',
            fillColor: area.status === 'Alert' ? '#f03' : '#ffcc00',
            fillOpacity: 0.5,
            radius: area.affectedRadius
        }).addTo(map);
    });

    // Dynamically identify safe zones while avoiding hazardous areas
    let nearestSafeZone = null;
    let minSafeDistance = Infinity;
    let searchRadius = 25; // Start with a 5 km search radius
    const maxSearchRadius = 100; // Maximum search radius (50 km)

    while (!nearestSafeZone && searchRadius <= maxSearchRadius) {
        for (let i = 0; i < 360; i += 45) { // Check 8 directions around the user
            const angle = (i * Math.PI) / 180;
            const safeLat = userLat + (searchRadius / 111) * Math.cos(angle);
            const safeLng = userLng + (searchRadius / (111 * Math.cos(userLat * (Math.PI / 180)))) * Math.sin(angle);

            // Check if this point is outside all unsafe areas with dynamic safety buffer
            let isSafe = true;

            // Exclude points within unsafe areas
            for (const area of unsafeAreas) {
                const distanceToArea = calculateDistance(safeLat, safeLng, area.lat, area.lng);
                const safetyBuffer = Math.max(10, area.affectedRadius / 1000); // Dynamic buffer: at least 10 km or the impact radius
                if (distanceToArea <= safetyBuffer) { // Exclude points within the safety buffer
                    isSafe = false;
                    break;
                }
            }

            // Exclude points near hazardous features (e.g., water bodies, cliffs, quarries)
            if (isSafe) {
                const hazardousFeatures = await fetchHazardousFeatures(safeLat, safeLng, 20); // 20 km radius for hazard exclusion
                for (const hazard of hazardousFeatures) {
                    const distanceToHazard = calculateDistance(safeLat, safeLng, hazard.lat, hazard.lng);
                    if (distanceToHazard <= 1) { // Exclude points within 1 km of hazardous features
                        isSafe = false;
                        break;
                    }
                }
            }

            // Exclude points near seas or large water bodies
            if (isSafe) {
                const waterBodies = await fetchHazardousFeatures(safeLat, safeLng, 5); // 5 km radius for water body exclusion
                for (const waterBody of waterBodies) {
                    const distanceToWater = calculateDistance(safeLat, safeLng, waterBody.lat, waterBody.lng);
                    if (distanceToWater <= 5) { // Exclude points within 5 km of water bodies
                        isSafe = false;
                        break;
                    }
                }
            }

            if (isSafe) {
                const distanceToUser = calculateDistance(userLat, userLng, safeLat, safeLng);
                if (distanceToUser < minSafeDistance) {
                    minSafeDistance = distanceToUser;
                    nearestSafeZone = { lat: safeLat, lng: safeLng };
                }
            }
        }

        // Expand search radius if no safe zone is found
        searchRadius += 5;
    }

    if (nearestSafeZone) {
        // Use Nominatim API to get the name of the safe zone area
        const safeZoneName = await fetchSafeZoneName(nearestSafeZone.lat, nearestSafeZone.lng);

        // Use OSRM API to calculate the shortest route along roads
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${nearestSafeZone.lng},${nearestSafeZone.lat}?geometries=geojson&steps=true`;
        try {
            const response = await fetch(osrmUrl);
            const data = await response.json();
            if (data && data.routes && data.routes.length > 0) {
                const routeCoordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                const polyline = L.polyline(routeCoordinates, { color: 'green' }).addTo(map);

                // Fit the map to show the entire route
                //map.fitBounds(polyline.getBounds());

                // Add a circular safe zone at the endpoint
                L.circle([nearestSafeZone.lat, nearestSafeZone.lng], {
                    color: 'green',
                    fillColor: '#32CD32',
                    fillOpacity: 0.5,
                    radius: 1000 // 1 km radius for the safe zone
                }).addTo(map);

                // Add a marker for the safe zone
                L.marker([nearestSafeZone.lat, nearestSafeZone.lng], {
                    icon: L.divIcon({
                        className: 'safe-sign',
                    })
                }).addTo(map);

                // Display evacuation instructions with the safe zone name
                const routeInfo = document.getElementById('route-info');
                routeInfo.innerHTML = `
                    Evacuate to: ${safeZoneName || "Unknown Area"}<br>
                    Distance: ${minSafeDistance.toFixed(0)} km<br>
                    Route: Follow the green line on the map.<br>
                    🚨Assist Others and Stay Safe 🚨<br>
                    Take Essentials Only<br>
                    Follow Instructions from Authorities<br>
                `;
            } else {
                const routeInfo = document.getElementById('route-info');
                routeInfo.innerHTML = `No safe route found. Please stay cautious!`;
            }
        } catch (error) {
            console.error("Error fetching route data from OSRM:", error);
            const routeInfo = document.getElementById('route-info');
            routeInfo.innerHTML = `Failed to calculate evacuation route. Please try again later.`;
        }
    } else {
        const routeInfo = document.getElementById('route-info');
        routeInfo.innerHTML = `No safe zones found within ${maxSearchRadius} km. Please stay cautious!`;
    }
}

// Fetch the name of the safe zone area using Nominatim API
async function fetchSafeZoneName(lat, lng) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    try {
        const response = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'Landslide-Evacuation-System' // Required by Nominatim usage policy
            }
        });
        const data = await response.json();

        if (data && data.address) {
            // Prioritize town, village, or city name
            return data.address.town || data.address.village || data.address.city || data.display_name.split(',')[0];
        }
        return null;
    } catch (error) {
        console.error("Error fetching safe zone name from Nominatim:", error);
        return null;
    }
}
    // Simulate traffic and evacuation routes after 10 seconds
    setTimeout(() => {
        simulateTrafficAndEvacuationRoutes(pinnedLocations, userLat, userLng);
    }, 10000);

    // Feedback Form Submission
    const feedbackForm = document.getElementById('feedback-form');
    feedbackForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const feedback = document.getElementById('feedback').value;
        alert('Thank you for your feedback!');
        feedbackForm.reset();
    });
}

// Show geolocation errors
function showError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            alert("User denied the request for geolocation.");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("Location information is unavailable.");
            break;
        case error.TIMEOUT:
            alert("The request to get user location timed out.");
            break;
        case error.UNKNOWN_ERROR:
            alert("An unknown error occurred.");
            break;
    }
}

// Automatically initialize map on page load
document.addEventListener("DOMContentLoaded", () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(initMap, showError);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
});


