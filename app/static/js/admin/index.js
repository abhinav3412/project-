// Fake Data for Charts
const userActivityData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'User Activity',
      data: [65, 59, 80, 81, 56, 55],
      borderColor: '#ff6f61',
      fill: false,
    }]
  };
  
  // Initialize with empty data, will be updated with real data
  const sensorStatusData = {
    labels: ['Active', 'Inactive', 'Maintenance'],
    datasets: [{
      label: 'Sensor Status',
      data: [0, 0, 0],
      backgroundColor: ['#2575fc', '#6a11cb', '#ff6f61'],
    }]
  };
  
  let sensorStatusChart;

  // Initialize charts when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    try {
      // Initialize user activity chart
      const userActivityCtx = document.getElementById('userActivityChart');
      if (userActivityCtx) {
        const userActivityChart = new Chart(userActivityCtx, {
          type: 'line',
          data: userActivityData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
          }
        });
      }

      // Initialize sensor status chart
      const sensorStatusCtx = document.getElementById('sensorStatusChart');
      if (sensorStatusCtx) {
        sensorStatusChart = new Chart(sensorStatusCtx, {
          type: 'bar',
          data: sensorStatusData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        });
      }

      // Initial data update
      updateSensorCount();
    } catch (error) {
      console.error('Error initializing charts:', error);
    }
  });

// Function to update sensor status chart with real data
async function updateSensorStatusChart(sensors) {
    if (!sensorStatusChart) {
        console.error('Chart not initialized yet');
        return;
    }

    try {
        // Count sensors by operational status
        const statusCounts = {
            'Active': 0,
            'Inactive': 0,
            'Maintenance': 0
        };
        
        sensors.forEach(sensor => {
            if (!sensor) return; // Skip null values
            const status = sensor.operational_status || 'Active';
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
            } else {
                statusCounts['Active']++; // Default to Active if unknown status
            }
        });
        
        // Update chart data
        sensorStatusChart.data.datasets[0].data = [
            statusCounts['Active'],
            statusCounts['Inactive'],
            statusCounts['Maintenance']
        ];
        
        // Update the chart
        sensorStatusChart.update();
        
        console.log('Sensor status chart updated with real data:', statusCounts);
    } catch (error) {
        console.error('Error updating sensor status chart:', error);
    }
}

// Function to update sensor count
async function updateSensorCount(sensorCount) {
    try {
        // Update the sensor count in the quick stats
        const sensorStat = document.querySelector('.stat:nth-child(4) .value');
        if (sensorStat) {
            sensorStat.textContent = sensorCount;
        }
    } catch (error) {
        console.error('Error updating sensor count:', error);
    }
}

// Update sensor count every 5 seconds
setInterval(async () => {
    try {
        const response = await fetch('/admin/get_sensors');
        if (!response.ok) {
            console.error('Failed to fetch sensor data:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        if (!data.success || !data.sensors || !Array.isArray(data.sensors)) {
            console.error('Invalid sensor data format:', data);
            return;
        }
        
        // Filter out null values
        const validSensors = data.sensors.filter(sensor => sensor !== null);
        const sensorCount = validSensors.length;
        
        // Update the sensor count
        updateSensorCount(sensorCount);
    } catch (error) {
        console.error('Error updating sensor count:', error);
    }
}, 5000);

// Initial update
updateSensorCount();

// Cache DOM elements
const mapElement = document.getElementById('map');
const alertBox = document.getElementById('alert-box');
const alertMessage = document.getElementById('alert-message');
const alertSound = document.getElementById('alert-sound');
const popupModal = document.getElementById('popup-modal');
const popupMessage = document.getElementById('popup-message');
const confirmShare = document.getElementById('confirm-share');
const cancelShare = document.getElementById('cancel-share');

// Cache map layers
let map;
let normalLayer;
let satelliteLayer;
let userLocationCircle;
let blueDot;

// Cache sensor data
let lastSensorData = null;
let lastDataHash = null;
let markers = [];
let warningCircles = [];
let pulseIntervals = [];

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

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    console.log("Initializing map...");
    
    // Check if map element exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error("Map element not found!");
      return;
    }
    console.log("Map element found:", mapElement);
    
    // Initialize map
    map = L.map('map').setView([10.8505, 76.2711], 7); // Center on Kerala
    console.log("Map initialized with center:", [10.8505, 76.2711]);

    // Add tile layers
    normalLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    console.log("Normal layer added to map");

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });
    console.log("Satellite layer created");

    // Add layer control
    L.control.layers({
      "Normal": normalLayer,
      "Satellite": satelliteLayer
                }).addTo(map);
    console.log("Layer control added to map");

    // Initial data update
    console.log("Starting initial data update...");
    updateSensorCount();
    fetchSensorData();
    
    console.log("Map initialization complete");
  } catch (error) {
    console.error('Error initializing map:', error);
  }
});

// Function to update map markers
function updateMapMarkers(sensors) {
  console.log("Updating map markers with sensors:", sensors);
  
  // Clear existing markers and warning circles
  markers.forEach(marker => marker.remove());
  markers = [];
  warningCircles.forEach(circle => circle.remove());
  warningCircles = [];
  pulseIntervals.forEach(interval => clearInterval(interval));
  pulseIntervals = [];

  // Add new markers for each sensor
  sensors.forEach(sensor => {
    if (!sensor || !sensor.latitude || !sensor.longitude) {
      console.log("Skipping sensor with missing coordinates:", sensor);
      return;
    }

    const lat = parseFloat(sensor.latitude);
    const lng = parseFloat(sensor.longitude);
    const isInactive = sensor.is_inactive || sensor.operational_status?.toLowerCase() !== 'active';

    console.log("Processing sensor:", {
      id: sensor.id,
      name: sensor.name,
      lat: lat,
      lng: lng,
      isInactive: isInactive,
      operational_status: sensor.operational_status
    });

    // Create marker with different style for inactive sensors
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'marker-icon',
        html: `<div class="marker-icon ${isInactive ? 'inactive' : 'active'}"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    });

    // Add marker to map
    marker.addTo(map);
    console.log("Marker added to map for sensor:", sensor.id);

    // Create popup content with enhanced data
    let popupContent = '';
    
    if (isInactive) {
      // Simplified popup for inactive sensors
      popupContent = `
        <div class="popup-content">
          <h3>Sensor ${sensor.id}</h3>
          <p>Name: ${sensor.name || 'N/A'}</p>
          <p>Status: <span class="status-badge status-inactive">Inactive</span></p>
          <p>Soil Type: ${sensor.soil_type || 'N/A'}</p>
          <p class="inactive-message">This sensor is currently inactive. No data is available.</p>
          <p>Last Known Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
      `;
    } else {
      // Full popup for active sensors
      popupContent = `
        <div class="popup-content">
          <h3>Sensor ${sensor.id}</h3>
          <p>Name: ${sensor.name || 'N/A'}</p>
          <p>Status: <span class="status-badge status-active">Active</span></p>
          <p>Rainfall: ${sensor.rainfall || 'N/A'} mm</p>
          <p>Soil Saturation: ${sensor.soil_saturation || 'N/A'}%</p>
          <p>Risk Level: <span class="risk-${sensor.risk_level?.toLowerCase() || 'low'}">${sensor.risk_level || 'N/A'}</span></p>
          <p>Soil Type: ${sensor.soil_type || 'N/A'}</p>
          <p>Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
      `;
    }

    marker.bindPopup(popupContent);
            markers.push(marker);

    // Add warning circle only for active high-risk sensors
    if (!isInactive && (sensor.risk_level === 'High' || sensor.risk_level === 'Critical')) {
      console.log("Adding warning circle for high-risk sensor:", sensor.id);
      
      const warningCircle = L.circle([lat, lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.3,
        radius: 5000,
        weight: 2
                }).addTo(map);
                
      // Add pulsing effect
      let opacity = 0.3;
      let increasing = true;
                const pulseInterval = setInterval(() => {
        if (increasing) {
          opacity += 0.1;
          if (opacity >= 0.6) increasing = false;
        } else {
          opacity -= 0.1;
          if (opacity <= 0.3) increasing = true;
        }
        warningCircle.setStyle({ fillOpacity: opacity });
      }, 500);

      warningCircles.push(warningCircle);
                pulseIntervals.push(pulseInterval);
    }
  });
  
  // Fit map to show all markers if there are any
  if (markers.length > 0) {
    console.log("Fitting map to show all markers:", markers.length);
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.1));
  } else {
    console.log("No markers to display on map");
  }
}

// Optimized sensor data fetching with caching
async function fetchSensorData() {
  try {
    console.log("Fetching sensor data...");
    const response = await fetch("/admin/get_sensor_data");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    console.log("Raw response data:", data);
    
    if (!data.success) {
      console.error('Invalid response format:', data);
      return;
    }
    
    const sensors = data.sensors;
    console.log("Raw sensor data received:", sensors);
    
    // Filter out any null or undefined sensors
    const validSensors = sensors.filter(sensor => {
      const isValid = sensor && sensor.latitude && sensor.longitude;
      if (!isValid) {
        console.log("Invalid sensor data:", sensor);
      }
      return isValid;
    });
    
    console.log("Valid sensors for map:", validSensors.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
      status: s.operational_status,
      is_inactive: s.is_inactive
    })));
    
    // Update sensor details table
    updateSensorDetailsTable(validSensors);
    
    // Update map markers
    console.log("Calling updateMapMarkers with valid sensors:", validSensors.length);
    updateMapMarkers(validSensors);
    
    // Update sensor status chart
    updateSensorStatusChart(validSensors);
    
    // Update sensor count
    updateSensorCount(validSensors.length);
    
    // Check for high-risk sensors (only active ones)
    const highRiskSensors = validSensors.filter(sensor => 
      !sensor.is_inactive && 
      sensor.operational_status?.toLowerCase() === 'active' &&
      (sensor.risk_level === 'High' || sensor.risk_level === 'Critical')
    );
    
    if (highRiskSensors.length > 0) {
      console.log("High-risk sensors detected:", highRiskSensors);
      const alertMessage = document.getElementById('alert-message');
      if (alertMessage) {
        alertMessage.textContent = `Warning: ${highRiskSensors.length} sensor(s) at high risk of landslide!`;
        alertMessage.style.display = 'block';
      }
    }
    
    // Cache the data
    lastSensorData = validSensors;
    lastDataHash = JSON.stringify(validSensors);
    
    // Return the sensors for other functions to use
    return validSensors;
    
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return null;
  }
}

// Update sensor data every 30 seconds
setInterval(fetchSensorData, 30000);

// Initial data update
fetchSensorData();

// Function to update sensor details table
function updateSensorDetailsTable(sensors) {
  console.log("Updating sensor details table with sensors:", sensors);
  
  const tableBody = document.getElementById('sensor-table-body');
  if (!tableBody) {
    console.error("Sensor table body element not found");
    return;
  }

  // Clear existing rows
  tableBody.innerHTML = '';

  // Add a row for each sensor
  sensors.forEach(sensor => {
    if (!sensor) {
      console.log("Skipping null sensor");
      return;
    }
    
    console.log("Adding row for sensor:", sensor.id);
    
    const row = document.createElement('tr');
    
    // Check if sensor is inactive
    const isInactive = sensor.is_inactive || sensor.operational_status?.toLowerCase() !== 'active';
    
    // Add cells with sensor data
    row.innerHTML = `
      <td>${sensor.id || 'N/A'}</td>
      <td>${sensor.name || 'N/A'}</td>
      <td><span class="status-badge status-${isInactive ? 'inactive' : 'active'}">${sensor.operational_status || 'Active'}</span></td>
      <td>${isInactive ? 'N/A' : (sensor.rainfall || 'N/A')}</td>
      <td>${isInactive ? 'N/A' : (sensor.forecasted_rainfall || 'N/A')}</td>
      <td>${isInactive ? 'N/A' : (sensor.soil_saturation || 'N/A')}</td>
      <td>${isInactive ? 'N/A' : (sensor.slope || 'N/A')}</td>
      <td>${isInactive ? 'N/A' : (sensor.seismic_activity || 'N/A')}</td>
      <td>${sensor.soil_type || 'N/A'}</td>
      <td>${isInactive ? 'N/A' : (sensor.risk_level || 'N/A')}</td>
      <td>${isInactive ? 'N/A' : (sensor.predicted_landslide_time || 'N/A')}</td>
    `;

    // Add row to table
    tableBody.appendChild(row);
  });
}

// Clean up intervals when page is unloaded
window.addEventListener('beforeunload', function() {
    clearAllIntervals();
});

// Disable share alert functionality
document.addEventListener('click', e => {
    if (e.target.classList.contains('share-alert-btn')) {
        // Prevent default behavior
        e.preventDefault();
        e.stopPropagation();
    }
});

// Handle share confirmation - disable
if (confirmShare) {
confirmShare.addEventListener('click', () => {
        // Prevent default behavior
    popupModal.style.display = 'none';
});
}

// Handle share cancellation - disable
if (cancelShare) {
cancelShare.addEventListener('click', () => {
    popupModal.style.display = 'none';
});
}

// Close modal when clicking outside
window.addEventListener('click', e => {
    if (e.target === popupModal) {
        popupModal.style.display = 'none';
    }
});

// Set up periodic data refresh with optimized interval
setInterval(async () => {
    const newSensors = await fetchSensorData();
    if (newSensors !== lastSensorData) {
        updateAlerts(newSensors);
        updateSensorStatusChart(newSensors);
    }
}, 60000);

// Update alerts based on sensor data
function updateAlerts(sensors) {
  const alertBox = document.getElementById('alert-box');
  if (!alertBox) return;

  // Filter out inactive sensors for high-risk alerts
  const activeHighRiskSensors = sensors.filter(sensor => 
    !sensor.is_inactive && 
    sensor.operational_status?.toLowerCase() === 'active' &&
    (sensor.risk_level === 'High' || sensor.risk_level === 'Critical')
  );

  // Get inactive sensors
  const inactiveSensors = sensors.filter(sensor => 
    sensor.is_inactive || 
    sensor.operational_status?.toLowerCase() !== 'active'
  );

  let alertContent = '';

  // Add high-risk sensor alerts
  if (activeHighRiskSensors.length > 0) {
    alertContent += '<div class="high-risk-alerts">';
    alertContent += '<h3>High Risk Sensors</h3>';
    activeHighRiskSensors.forEach(sensor => {
      alertContent += `
        <div class="alert-item">
          <strong>${sensor.name}</strong> (ID: ${sensor.id})<br>
          Risk Level: ${sensor.risk_level}<br>
          Location: ${sensor.latitude}, ${sensor.longitude}<br>
          Last Updated: ${sensor.last_updated || 'N/A'}
        </div>
      `;
    });
    alertContent += '</div>';
  }

  // Add inactive sensor alerts
  if (inactiveSensors.length > 0) {
    alertContent += '<div class="inactive-sensors-section">';
    alertContent += '<h3>Inactive Sensors</h3>';
    inactiveSensors.forEach(sensor => {
      alertContent += `
        <div class="inactive-sensor-item">
          <strong>${sensor.name}</strong> (ID: ${sensor.id})<br>
          <span class="status-badge">Inactive</span><br>
          <span class="no-data-message">No data available</span>
        </div>
      `;
    });
    alertContent += '</div>';
  }

  // If no alerts, show a message
  if (!alertContent) {
    alertContent = '<div class="no-alerts">No active alerts at this time.</div>';
  }

  alertBox.innerHTML = alertContent;
}

// Clear all intervals to prevent memory leaks
function clearAllIntervals() {
    pulseIntervals.forEach(interval => clearInterval(interval));
    pulseIntervals = [];
}