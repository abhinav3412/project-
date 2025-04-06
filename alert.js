let map; // Make map variable global
let alertSound; // Make alertSound global

// Cache DOM elements
const mapElement = document.getElementById('map');
const sensorTableBody = document.getElementById('sensor-table-body');
const alertBox = document.getElementById('alert-box');
const routeInfo = document.getElementById('route-info');

// Cache map layers
let normalLayer;
let satelliteLayer;
let userLocationCircle;
let blueDot;

// Cache sensor data
let lastSensorData = null;
let lastDataHash = null;

// Optimized distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const lat1Rad = lat1 * (Math.PI / 180);
    const lat2Rad = lat2 * (Math.PI / 180);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Optimized sensor data fetching with caching
async function fetchSensorData() {
    try {
        const response = await fetch("/user/get_sensor_data");
        if (!response.ok) throw new Error("Failed to fetch sensor data");
        
        const data = await response.json();
        const dataHash = JSON.stringify(data);
        
        // Only update if data has changed
        if (dataHash !== lastDataHash) {
            lastDataHash = dataHash;
            lastSensorData = data;
            return data;
        }
        
        return lastSensorData;
    } catch (error) {
        console.error("Error fetching sensor data:", error);
        return lastSensorData || [];
    }
}

// Fetch hazardous features near a location using Overpass API
async function fetchHazardousFeatures(lat, lng, radius = 5) {
    const query = `
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
    `;

    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(overpassUrl, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.elements.map(element => {
            if (element.center) {
                return { lat: element.center.lat, lng: element.center.lon };
            } else if (element.lat && element.lon) {
                return { lat: element.lat, lng: element.lon };
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        console.error("Error fetching hazardous feature data:", error);
        return [];
    }
}

// Optimized map initialization
async function initMap(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Initialize map with optimized settings
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([0, 0], 2);

    // Add zoom control to top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initialize layers with optimized settings
    normalLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        updateWhenIdle: true
    }).addTo(map);

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        updateWhenIdle: true
    });

    // Add layer control
    L.control.layers({ "Normal View": normalLayer, "Satellite View": satelliteLayer }).addTo(map);

    // Add user location with optimized styling
    userLocationCircle = L.circle([userLat, userLng], {
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.3,
        radius: accuracy
    }).addTo(map);

    blueDot = L.circleMarker([userLat, userLng], {
        radius: 8,
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 1,
        weight: 2
    }).addTo(map);

    // Add user marker with optimized popup
    L.marker([userLat, userLng])
        .addTo(map)
        .bindPopup(`Your Location<br>Lat: ${userLat.toFixed(6)}<br>Lng: ${userLng.toFixed(6)}`);

    // Optimized circle animation
        let growing = true;
        setInterval(() => {
        const currentRadius = userLocationCircle.getRadius();
        userLocationCircle.setRadius(growing ? currentRadius * 1.15 : currentRadius * 0.85);
            growing = !growing;
    }, 800);

    // Add recenter button with optimized styling
    const recenterButton = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: () => {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            Object.assign(container.style, {
                backgroundColor: 'white',
                border: '1px solid #ccc',
                padding: '5px',
                cursor: 'pointer',
                borderRadius: '5px'
            });
            container.innerHTML = '<span>📍</span>';
            container.title = 'Recenter';
            L.DomEvent.on(container, 'click', () => map.setView([userLat, userLng], 15));
            return container;
        }
    });
    map.addControl(new recenterButton());

    // Initialize sensor data and map
    await initializeSensorData(userLat, userLng);
}

// Optimized sensor data initialization
async function initializeSensorData(userLat, userLng) {
    const sensors = await fetchSensorData();
    const bounds = L.latLngBounds([]);

    // Clear existing markers and circles
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
            map.removeLayer(layer);
        }
    });

    // Filter for active sensors only
    const activeSensors = sensors.filter(sensor => sensor.operational_status === 'Active');

    // Add sensor markers with optimized rendering
    activeSensors.forEach(sensor => {
        const lat = parseFloat(sensor.latitude);
        const lng = parseFloat(sensor.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
            const marker = L.marker([lat, lng]).addTo(map);
            bounds.extend([lat, lng]);

            // Optimized popup content
            marker.bindPopup(`
                <strong>${sensor.name}</strong><br>
                Status: ${sensor.status}<br>
                Rainfall: ${sensor.rainfall} mm<br>
                Soil Saturation: ${sensor.soil_saturation}%<br>
                Slope: ${sensor.slope}°<br>
                Seismic Activity: ${sensor.seismic_activity}<br>
                Soil Type: ${sensor.soil_type}<br>
                Risk Level: ${sensor.risk_level}<br>
                Predicted Landslide Time: ${sensor.predicted_landslide_time}
            `);

            // Add affected area with optimized styling
            if (sensor.status === 'Alert' || sensor.status === 'Warning') {
                L.circle([lat, lng], {
                    color: sensor.status === 'Alert' ? 'red' : 'orange',
                    fillColor: sensor.status === 'Alert' ? '#f03' : '#ffcc00',
                    fillOpacity: 0.5,
                    radius: sensor.affected_radius
                }).addTo(map);

                if (sensor.status === 'Alert') {
                    L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'danger-sign',
                            html: '⚠️',
                            iconSize: [30, 30]
                        })
                    }).addTo(map);
                }
            }
        }
    });

    // Fit bounds with padding
    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        map.setView([userLat, userLng], 15);
    }

    // Update sensor table with optimized rendering
    updateSensorTable(sensors);

    // Update alerts with optimized rendering
    updateAlerts(sensors, userLat, userLng);

    // Calculate evacuation routes after a short delay
    setTimeout(() => simulateTrafficAndEvacuationRoutes(activeSensors, userLat, userLng), 1000);
}

// Optimized sensor table update
function updateSensorTable(sensors) {
    sensorTableBody.innerHTML = sensors.map(sensor => `
        <tr>
            <td>${sensor.name}</td>
            <td><span style="color: ${sensor.status.toLowerCase() === 'alert' ? 'red' : 
                               sensor.status.toLowerCase() === 'warning' ? 'orange' : 'green'}">${sensor.status}</span></td>
            <td>${sensor.rainfall}</td>
            <td>${sensor.forecasted_rainfall}</td>
            <td>${sensor.soil_saturation}</td>
            <td>${sensor.slope}</td>
            <td>${sensor.seismic_activity}</td>
            <td>${sensor.soil_type}</td>
            <td>${sensor.risk_level}</td>
            <td>${sensor.predicted_landslide_time}</td>
        </tr>
    `).join('');
}

// Optimized alerts update
function updateAlerts(sensors, userLat, userLng) {
    alertBox.innerHTML = '';
    
    sensors.forEach(sensor => {
        // Only show alerts for active sensors
        if (sensor.operational_status !== 'Active') {
            return;
        }
        
        if (sensor.status === 'Alert' || sensor.status === 'Warning') {
            const distance = calculateDistance(userLat, userLng, sensor.latitude, sensor.longitude);
            const alertItem = document.createElement('div');
            alertItem.className = 'alert-item';
            alertItem.innerHTML = `
                <p><strong>${sensor.name}</strong></p>
                <p>Status: ${sensor.status}</p>
                <p>Predicted Landslide Time: ${sensor.predicted_landslide_time}</p>
                <p>Distance: ${distance.toFixed(2)} km away</p>
                <button class="share-alert-btn">Share Alert</button>
            `;
            alertBox.appendChild(alertItem);
        
            // Add click handler for alert sound
            alertItem.addEventListener('click', () => {
                try {
                    alertSound.play().catch(console.log);
                } catch (error) {
                    console.log("Audio play error:", error);
                }
            });

            // Update map view and show popup
            map.setView([sensor.latitude, sensor.longitude], 12);
            const marker = L.marker([sensor.latitude, sensor.longitude]).addTo(map);
            marker.bindPopup(`
                ${sensor.name}<br>
                Status: ${sensor.status}<br>
                Rainfall: ${sensor.rainfall} mm<br>
                Soil Saturation: ${sensor.soil_saturation}%<br>
                Slope: ${sensor.slope}°<br>
                Seismic Activity: ${sensor.seismic_activity}<br>
                Soil Type: ${sensor.soil_type}<br>
                Risk Level: ${sensor.risk_level}<br>
                Predicted Landslide Time: ${sensor.predicted_landslide_time}
            `).openPopup();
        }
    });
}

// Optimized function to find safe zones in all directions
async function findSafeZones(userLat, userLng, unsafeAreas) {
    const searchRadius = 1.0; // Start with 1km search radius
    const maxSearchRadius = 5; // Maximum 5km search radius
    const points = 16; // More points to check in all directions
    let safeZones = [];

    // Pre-calculate unsafe area radii for faster comparison
    const unsafeRadii = unsafeAreas.map(area => ({
        lat: area.latitude,
        lng: area.longitude,
        radius: (area.affected_radius / 1000) * 1.5 // 1.5x safety buffer
    }));

    // Search in concentric circles with smaller increments for better coverage
    for (let radius = searchRadius; radius <= maxSearchRadius; radius += 0.5) {
        for (let i = 0; i < points; i++) {
            const angle = (i * 2 * Math.PI) / points;
            const lat = userLat + (radius * Math.cos(angle));
            const lng = userLng + (radius * Math.sin(angle));

            // Check if point is safe using optimized distance calculation
            const isSafe = !unsafeRadii.some(area => {
                const dx = lat - area.lat;
                const dy = lng - area.lng;
                return (dx * dx + dy * dy) < (area.radius * area.radius);
            });

            if (isSafe) {
                safeZones.push({ 
                    lat, 
                    lng, 
                    distance: radius,
                    direction: getDirection(angle)
                });
            }
        }
    }

    // If no safe zones found, create a default safe zone in the opposite direction of the hazard
    if (safeZones.length === 0 && unsafeAreas.length > 0) {
        // Find the closest hazard
        let closestHazard = null;
        let minDistance = Infinity;
        
        unsafeAreas.forEach(area => {
            const distance = calculateDistance(userLat, userLng, area.latitude, area.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                closestHazard = area;
            }
        });
        
        if (closestHazard) {
            // Calculate direction away from hazard
            const dx = userLat - closestHazard.latitude;
            const dy = userLng - closestHazard.longitude;
            const angle = Math.atan2(dy, dx);
            
            // Create a safe zone 3km away in the opposite direction
            const safeLat = userLat + (3 * Math.cos(angle));
            const safeLng = userLng + (3 * Math.sin(angle));
            
            safeZones.push({
                lat: safeLat,
                lng: safeLng,
                distance: 3,
                direction: getDirection(angle)
            });
        }
    }

    // Group safe zones by direction and find the best in each direction
    return groupSafeZonesByDirection(safeZones);
}

// Helper function to get cardinal direction from angle
function getDirection(angle) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(angle / (Math.PI / 4)) % 8;
    return directions[index];
}

// Helper function to group safe zones by direction and find the best in each
function groupSafeZonesByDirection(safeZones) {
    const grouped = {};
    safeZones.forEach(zone => {
        if (!grouped[zone.direction] || zone.distance < grouped[zone.direction].distance) {
            grouped[zone.direction] = zone;
        }
    });
    return Object.values(grouped);
}

// Optimized function to fetch safe zone name
async function fetchSafeZoneName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || 'Safe Zone';
    } catch (error) {
        console.error('Error fetching safe zone name:', error);
        return 'Safe Zone';
    }
}

// Optimized function to simulate traffic and evacuation routes
async function simulateTrafficAndEvacuationRoutes(sensors, userLat, userLng) {
    if (!map) return;

    // Define unsafe areas
    const unsafeAreas = sensors.filter(sensor => 
        sensor.status === 'Alert' || sensor.status === 'Warning'
    );

    // Check if user is in or near an unsafe area
    const isUserInDanger = unsafeAreas.some(area => {
        const distance = calculateDistance(userLat, userLng, area.latitude, area.longitude);
        const affectedRadius = area.affected_radius / 1000; // Convert to kilometers
        return distance <= affectedRadius * 1.5; // Add 50% buffer to affected radius
    });

    // Only show evacuation routes if there are alerts/warnings AND user is in danger
    if (unsafeAreas.length === 0 || !isUserInDanger) {
        routeInfo.innerHTML = `
            <h3>✅ Safety Status: You are Safe</h3>
            <p>Your current location is not affected by any warnings or alerts.</p>
            <p>No evacuation is required at this time.</p>
            <p><strong>Important Notes:</strong></p>
            <ul>
                <li>Continue monitoring alerts for any changes</li>
                <li>Stay informed through official channels</li>
                <li>Be prepared but remain calm</li>
            </ul>
        `;
        return;
    }

    // Draw unsafe areas with optimized rendering
    unsafeAreas.forEach(area => {
        if (area.latitude && area.longitude) {
            L.circle([area.latitude, area.longitude], {
                color: area.status === 'Alert' ? 'red' : 'orange',
                fillColor: area.status === 'Alert' ? '#f03' : '#ffcc00',
                fillOpacity: 0.5,
                radius: area.affected_radius
            }).addTo(map);
        }
    });

    // Find safe zones in all directions
    const safeZones = await findSafeZones(userLat, userLng, unsafeAreas);

    if (safeZones.length === 0) {
        routeInfo.innerHTML = `
            <h3>🚨 Emergency Alert 🚨</h3>
            <p>No safe zones found. Please take immediate action:</p>
            <ul>
                <li>Contact emergency services</li>
                <li>Move to higher ground immediately</li>
                <li>Stay away from water bodies</li>
                <li>Follow local authorities' instructions</li>
                <li>If possible, seek shelter in a sturdy building</li>
                <li>Do not attempt to drive through flooded areas</li>
            </ul>
            <p><strong>Emergency Contacts:</strong></p>
            <ul>
                <li>Emergency Services: 112</li>
                <li>Police: 100</li>
                <li>Fire: 101</li>
            </ul>
        `;
        return;
    }

    // Sort safe zones by distance
    safeZones.sort((a, b) => a.distance - b.distance);

    // Get the best safe zone (closest)
    const bestSafeZone = safeZones[0];
    const safeZoneName = await fetchSafeZoneName(bestSafeZone.lat, bestSafeZone.lng);
    const waypoints = [
        `${userLng},${userLat}`,
        `${bestSafeZone.lng},${bestSafeZone.lat}`
    ];

    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${waypoints.join(';')}?geometries=geojson&steps=true`
        );
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (data?.routes?.[0]) {
            const route = data.routes[0];
            const routeCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // Draw route with green color
            L.polyline(routeCoordinates, { 
                color: '#00FF00',
                weight: 3,
                opacity: 0.8
            }).addTo(map);

            // Add safe zone marker
            L.circle([bestSafeZone.lat, bestSafeZone.lng], {
                color: 'green',
                fillColor: '#32CD32',
                fillOpacity: 0.5,
                radius: 150
            }).addTo(map);

            L.marker([bestSafeZone.lat, bestSafeZone.lng], {
                icon: L.divIcon({
                    className: 'safe-sign',
                    html: '🟢',
                    iconSize: [30, 30]
                })
            }).addTo(map);

            // Check if the route is too far (more than 3km)
            const routeDistanceKm = route.distance / 1000;
            const estimatedTimeMinutes = Math.ceil(route.duration / 60);
            const hours = Math.floor(estimatedTimeMinutes / 60);
            const minutes = estimatedTimeMinutes % 60;
            const timeDisplay = hours > 0 
                ? `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? `and ${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`
                : `${minutes} minute${minutes > 1 ? 's' : ''}`;
            
            // Update route info with best route details
            if (routeDistanceKm > 3) {
                routeInfo.innerHTML = `
                    <h3>🚨 Evacuation Route Available 🚨</h3>
                    <p><strong>Safe Zone:</strong> ${safeZoneName}</p>
                    <p><strong>Distance:</strong> ${routeDistanceKm.toFixed(1)} km</p>
                    <p><strong>Estimated Time:</strong> ${timeDisplay}</p>
                    <p><strong>⚠️ WARNING: This route is quite far (${routeDistanceKm.toFixed(1)} km). Consider these alternatives:</strong></p>
                    <ul>
                        <li>Seek immediate shelter in the nearest sturdy building</li>
                        <li>Move to higher ground if possible</li>
                        <li>Contact emergency services for assistance</li>
                    </ul>
                    <p><strong>Emergency Contacts:</strong></p>
                    <ul>
                        <li>Emergency Services: 112</li>
                        <li>Police: 100</li>
                        <li>Fire: 101</li>
                    </ul>
                    
                `;
            } else {
                routeInfo.innerHTML = `
                    <h3>🚨 Best Evacuation Route 🚨</h3>
                    <p><strong>Safe Zone:</strong> ${safeZoneName}</p>
                    <p><strong>Direction:</strong> ${bestSafeZone.direction}</p>
                    <p><strong>Distance:</strong> ${routeDistanceKm.toFixed(1)} km</p>
                    <p><strong>Estimated Time:</strong> ${timeDisplay}</p>
                    <p><strong>Emergency Contacts:</strong></p>
                    <ul>
                        <li>Emergency Services: 112</li>
                        <li>Police: 100</li>
                        <li>Fire: 101</li>
                    </ul>
                    <p><strong>Important Notes:</strong></p>
                    <ul>
                        <li>Follow the green route on the map</li>
                        <li>This is the shortest safe route</li>
                        <li>Take essential items only</li>
                        <li>Stay calm and follow instructions</li>
                        <li>Help others if possible</li>
                    </ul>
                `;
            }
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        routeInfo.innerHTML = `
            <h3>🚨 Emergency Alert 🚨</h3>
            <p>Error calculating evacuation route. Please:</p>
            <ul>
                <li>Contact emergency services (112)</li>
                <li>Move to higher ground</li>
                <li>Stay away from water bodies</li>
                <li>Follow local authorities' instructions</li>
            </ul>
        `;
    }
}

// Helper function to get color based on direction
function getDirectionColor(direction) {
    const colors = {
        'N': '#FF0000',  // Red
        'NE': '#FF7F00', // Orange
        'E': '#FFFF00',  // Yellow
        'SE': '#00FF00', // Green
        'S': '#0000FF',  // Blue
        'SW': '#4B0082', // Indigo
        'W': '#8B00FF',  // Violet
        'NW': '#FF00FF'  // Magenta
    };
    return colors[direction] || '#00FF00';
}

// Optimized function to check if user is near hazardous areas
function isUserNearHazard(userLat, userLng, hazardousAreas) {
    return hazardousAreas.some(area => {
        const distance = calculateDistance(userLat, userLng, area.latitude, area.longitude);
        const affectedRadius = area.affected_radius / 1000; // Convert to kilometers
        return distance <= affectedRadius * 1.5; // Add 50% buffer to affected radius
    });
}

// Initialize map when geolocation is available
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(initMap, showError);
} else {
    showError("Geolocation is not supported by this browser.");
}

// Optimized error handling
function showError(error) {
    console.error("Error:", error);
    mapElement.innerHTML = `<div class="error-message">Error: ${error}</div>`;
}

// Optimized share alert functionality
document.addEventListener('click', e => {
    if (e.target.classList.contains('share-alert-btn')) {
        const alertText = e.target.closest('.alert-item').querySelector('p').textContent;
        window.open(`https://wa.me/?text=${encodeURIComponent(alertText)}`, '_blank');
    }
});

// Set up periodic data refresh with optimized interval
setInterval(async () => {
    const newSensors = await fetchSensorData();
    if (newSensors !== lastSensorData) {
        initializeSensorData(map.getCenter().lat, map.getCenter().lng);
    }
}, 60000);


