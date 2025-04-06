// DOM Elements
const sensorTableBody = document.getElementById("sensor-table-body");
const addSensorBtn = document.getElementById("add-sensor-btn");
const sensorModal = document.getElementById("sensor-modal");
const closeModalBtn = document.querySelector(".close");
const sensorForm = document.getElementById("sensor-form");

// Populate Table
function populateTable(sensors) {
    const tbody = document.querySelector('#sensorTable tbody');
    tbody.innerHTML = '';
    
    sensors.forEach((sensor, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sensor.name}</td>
            <td>${sensor.latitude}</td>
            <td>${sensor.longitude}</td>
            <td>${sensor.soil_type}</td>
            <td>
                <span class="status-badge ${sensor.status.toLowerCase()}">${sensor.status}</span>
            </td>
            <td>
                <span class="status-badge ${sensor.operational_status.toLowerCase()}">${sensor.operational_status}</span>
            </td>
            <td>
                <button class="edit-btn" data-sensor-id="${sensor.id}" data-source="${sensor.source}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" data-sensor-id="${sensor.id}" data-source="${sensor.source}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sensorId = btn.getAttribute('data-sensor-id');
            const source = btn.getAttribute('data-source');
            editSensor(sensorId, source);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sensorId = btn.getAttribute('data-sensor-id');
            const source = btn.getAttribute('data-source');
            deleteSensor(sensorId, source);
        });
    });
}

// Add Sensor
addSensorBtn.addEventListener("click", () => {
    document.getElementById("modal-title").textContent = "Add New Sensor";
    sensorModal.style.display = "flex";
});

// Close Modal
closeModalBtn.addEventListener("click", () => {
    sensorModal.style.display = "none";
});

// Handle Form Submission
sensorForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const sensor = {
        id: document.getElementById("sensor-id").value,
        location: document.getElementById("location").value,
        coordinates: document.getElementById("coordinates").value,
        status: document.getElementById("status").value,
        description: document.getElementById("description").value,
    };

    const modalTitle = document.getElementById("modal-title").textContent;
    if (modalTitle === "Add New Sensor") {
        sensors.push(sensor);
    } else {
        const index = parseInt(document.getElementById("sensor-index").value);
        sensors[index] = sensor;
    }

    populateTable(sensors);
    sensorModal.style.display = "none";
    sensorForm.reset();
});

// Delete Sensor
function deleteSensor(sensorId, source) {
    if (confirm('Are you sure you want to delete this sensor?')) {
        if (source === 'database') {
            fetch(`/admin/delete_sensor/${sensorId}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    loadSensors();
                }
            });
        } else {
            // For JSON sensors, update the JSON file
            fetch('/admin/delete_json_sensor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sensor_id: sensorId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    loadSensors();
                }
            });
        }
    }
}

// Edit Sensor
function editSensor(sensorId, source) {
    // Fetch sensor data based on source
    if (source === 'database') {
        fetch(`/admin/get_sensor/${sensorId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    populateEditForm(data.sensor);
                    document.getElementById('editSensorModal').style.display = 'block';
                }
            });
    } else {
        // For JSON sensors, fetch from sensor_data.json
        fetch('/admin/get_sensor_data')
            .then(response => response.json())
            .then(data => {
                const sensor = data.sensors.find(s => s.id === parseInt(sensorId));
                if (sensor) {
                    populateEditForm(sensor);
                    document.getElementById('editSensorModal').style.display = 'block';
                }
            });
    }
}

// Show Sensor Details
function showSensorDetails(sensor) {
    const detailsModal = document.getElementById("sensor-details-modal");
    document.getElementById("details-id").textContent = sensor.id;
    document.getElementById("details-location").textContent = sensor.location;
    document.getElementById("details-coordinates").textContent = sensor.coordinates;
    document.getElementById("details-status").textContent = sensor.status;
    document.getElementById("details-description").textContent = sensor.description;

    detailsModal.style.display = "flex";
}

// Close Sensor Details Modal
document.querySelectorAll(".close").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".modal").forEach((modal) => {
            modal.style.display = "none";
        });
    });
});

// Function to update sensor details box
function updateSensorDetails(sensor) {
    const detailsBox = document.getElementById('sensor-details');
    if (!detailsBox) return;

    // Clear previous content
    detailsBox.innerHTML = '';

    // Create details container
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'sensor-details-container';

    // Add sensor name and status
    const header = document.createElement('div');
    header.className = 'sensor-details-header';
    header.innerHTML = `
        <h3>${sensor.name}</h3>
        <span class="status-badge status-${sensor.operational_status.toLowerCase()}">${sensor.operational_status}</span>
    `;
    detailsContainer.appendChild(header);

    // Check if sensor is inactive
    if (sensor.is_inactive) {
        // For inactive sensors, show limited information
        const inactiveMessage = document.createElement('div');
        inactiveMessage.className = 'inactive-sensor-message';
        inactiveMessage.innerHTML = `
            <p>This sensor is currently inactive. No data is available.</p>
            <p>Last known location: ${sensor.latitude}, ${sensor.longitude}</p>
            <p>Soil Type: ${sensor.soil_type}</p>
        `;
        detailsContainer.appendChild(inactiveMessage);
    } else {
        // For active sensors, show all data
        const dataGrid = document.createElement('div');
        dataGrid.className = 'sensor-data-grid';
        dataGrid.innerHTML = `
            <div class="data-item">
                <span class="data-label">Rainfall:</span>
                <span class="data-value">${sensor.rainfall} mm</span>
            </div>
            <div class="data-item">
                <span class="data-label">Forecasted Rainfall:</span>
                <span class="data-value">${sensor.forecasted_rainfall} mm</span>
            </div>
            <div class="data-item">
                <span class="data-label">Soil Saturation:</span>
                <span class="data-value">${sensor.soil_saturation}%</span>
            </div>
            <div class="data-item">
                <span class="data-label">Slope:</span>
                <span class="data-value">${sensor.slope}°</span>
            </div>
            <div class="data-item">
                <span class="data-label">Seismic Activity:</span>
                <span class="data-value">${sensor.seismic_activity}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Risk Level:</span>
                <span class="data-value risk-${sensor.risk_level.toLowerCase()}">${sensor.risk_level}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Affected Radius:</span>
                <span class="data-value">${sensor.affected_radius} m</span>
            </div>
            <div class="data-item">
                <span class="data-label">Predicted Landslide:</span>
                <span class="data-value">${sensor.predicted_landslide_time}</span>
            </div>
        `;
        detailsContainer.appendChild(dataGrid);
    }

    detailsBox.appendChild(detailsContainer);
}

// Function to update map markers
function updateMapMarkers(sensors) {
    // Clear existing markers
    if (window.sensorMarkers) {
        window.sensorMarkers.forEach(marker => marker.setMap(null));
    }
    window.sensorMarkers = [];

    // Create new markers
    sensors.forEach(sensor => {
        const position = { lat: parseFloat(sensor.latitude), lng: parseFloat(sensor.longitude) };
        
        // Create marker with custom icon based on status
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: sensor.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: sensor.is_inactive ? 8 : 10,
                fillColor: sensor.is_inactive ? '#999999' : getStatusColor(sensor.status),
                fillOpacity: 0.7,
                strokeColor: '#000000',
                strokeWeight: 1
            }
        });

        // Create info window content
        const content = document.createElement('div');
        content.className = 'map-info-window';
        content.innerHTML = `
            <h4>${sensor.name}</h4>
            <p>Status: <span class="status-badge status-${sensor.operational_status.toLowerCase()}">${sensor.operational_status}</span></p>
            ${sensor.is_inactive ? '<p class="inactive-message">Sensor is currently inactive</p>' : ''}
            <p>Soil Type: ${sensor.soil_type}</p>
            ${!sensor.is_inactive ? `
                <p>Risk Level: <span class="risk-${sensor.risk_level.toLowerCase()}">${sensor.risk_level}</span></p>
                <p>Last Updated: ${new Date(sensor.timestamp).toLocaleString()}</p>
            ` : ''}
        `;

        // Create info window
        const infoWindow = new google.maps.InfoWindow({
            content: content
        });

        // Add click event to marker
        marker.addListener('click', () => {
            // Close any open info windows
            window.sensorMarkers.forEach(m => m.infoWindow.close());
            
            // Open this info window
            infoWindow.open(map, marker);
            
            // Update sensor details box
            updateSensorDetails(sensor);
        });

        // Store info window with marker
        marker.infoWindow = infoWindow;
        
        // Add marker to array
        window.sensorMarkers.push(marker);
    });
}

// Helper function to get color based on status
function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'alert':
            return '#FF0000';
        case 'warning':
            return '#FFA500';
        case 'normal':
            return '#00FF00';
        default:
            return '#999999';
    }
}

// Initialize Table
populateTable(sensors);