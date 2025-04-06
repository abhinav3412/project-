// Typewriter Text Loop
const texts = ["Your contribution can save lives!", "Be the change!"];
let textIndex = 0; // Tracks the current text
const typewriterElement = document.querySelector('.typewriter-text');

function typeWriter(text, element, callback) {
  if (!element) return; // Add null check
  
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i); // Add one character at a time
      i++;
    } else {
      clearInterval(interval); // Stop typing
      setTimeout(() => {
        eraseText(element, callback); // Call erasing function
      }, 2000); // Wait 2 seconds before erasing
    }
  }, 100); // Adjust typing speed (100ms per character)
}

function eraseText(element, callback) {
  let text = element.textContent;
  const interval = setInterval(() => {
    if (text.length > 0) {
      text = text.slice(0, -1); // Remove one character at a time
      element.textContent = text;
    } else {
      clearInterval(interval); // Stop erasing
      callback(); // Call the callback to type the next text
    }
  }, 50); // Adjust erasing speed (50ms per character)
}

function startTypewriter() {
  const currentText = texts[textIndex];
  typeWriter(currentText, typewriterElement, () => {
    textIndex = (textIndex + 1) % texts.length; // Cycle through texts
    startTypewriter(); // Loop back to the next text
  });
}

// Start the typewriter effect on page load
document.addEventListener('DOMContentLoaded', () => {
  startTypewriter();

  // Get DOM elements
  const logoutBtn = document.querySelector(".logout");
  const warehouseId = document.getElementById("warehouse-id");
  const warehouseLocation = document.getElementById("warehouse-location");
  const warehouseCoordinates = document.getElementById("warehouse-coordinates");
  const warehouseStatus = document.getElementById("warehouse-status");
  const foodAvailable = document.getElementById("food-available");
  const foodCapacity = document.getElementById("food-capacity");
  const waterAvailable = document.getElementById("water-available");
  const waterCapacity = document.getElementById("water-capacity");
  const clothesAvailable = document.getElementById("clothes-available");
  const clothesCapacity = document.getElementById("clothes-capacity");
  const essentialsAvailable = document.getElementById("essentials-available");
  const essentialsCapacity = document.getElementById("essentials-capacity");
  const requestsList = document.getElementById('requests-list');

  // Add vehicle form event listener
  const addVehicleForm = document.getElementById('add-vehicle-form');
  if (addVehicleForm) {
    addVehicleForm.addEventListener('submit', addVehicle);
  }

  // Initialize charts
  let availableResourcesChart = null;
  let requestsChart = null;

  // Initialize resource charts
  let foodChart = null;
  let waterChart = null;
  let essentialsChart = null;
  let clothesChart = null;

  // Initialize Available Resources Chart
  function initializeAvailableResourcesChart(data) {
    const chartElement = document.getElementById('availableResourcesChart');
    if (!chartElement) return; // Add null check
    
    const ctx = chartElement.getContext('2d');
    
    if (availableResourcesChart) {
      availableResourcesChart.destroy();
    }

    availableResourcesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Food', 'Water', 'Clothes', 'Essentials'],
        datasets: [{
          label: 'Available Resources',
          data: [
            data.food_available,
            data.water_available,
            data.clothes_available,
            data.essentials_available
          ],
          backgroundColor: ['#2575fc', '#6a11cb', '#ff6f61', '#28a745'],
        }],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.raw || 0;
                return `${label}: ${value}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Quantity',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Resources',
            },
          },
        },
      },
    });
  }

  // Initialize Requests Over Time Chart
  function initializeRequestsChart(data) {
    const chartElement = document.getElementById('requestsChart');
    if (!chartElement) return; // Add null check
    
    const ctx = chartElement.getContext('2d');
    
    if (requestsChart) {
      requestsChart.destroy();
    }

    requestsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Requests Over Time',
          data: data.values,
          borderColor: '#ff6f61',
          fill: false,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  // Function to initialize resource charts
  function initializeResourceCharts(data) {
    // Initialize Food Chart
    const foodChartElement = document.getElementById('food-chart');
    if (foodChartElement) {
        const foodCtx = foodChartElement.getContext('2d');
        if (foodChart) {
            foodChart.destroy();
        }
        foodChart = new Chart(foodCtx, {
            type: 'doughnut',
            data: {
                labels: ['Available', 'Used'],
                datasets: [{
                    data: [data.food_available, data.food_used || 0],
                    backgroundColor: ['#4CAF50', '#f44336'],
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }
    
    // Initialize Water Chart
    const waterChartElement = document.getElementById('water-chart');
    if (waterChartElement) {
        const waterCtx = waterChartElement.getContext('2d');
        if (waterChart) {
            waterChart.destroy();
        }
        waterChart = new Chart(waterCtx, {
            type: 'doughnut',
            data: {
                labels: ['Available', 'Used'],
                datasets: [{
                    data: [data.water_available, data.water_used || 0],
                    backgroundColor: ['#4CAF50', '#f44336'],
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }
    
    // Initialize Essentials Chart
    const essentialsChartElement = document.getElementById('essentials-chart');
    if (essentialsChartElement) {
        const essentialsCtx = essentialsChartElement.getContext('2d');
        if (essentialsChart) {
            essentialsChart.destroy();
        }
        essentialsChart = new Chart(essentialsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Available', 'Used'],
                datasets: [{
                    data: [data.essentials_available, data.essentials_used || 0],
                    backgroundColor: ['#4CAF50', '#f44336'],
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }
    
    // Initialize Clothes Chart
    const clothesChartElement = document.getElementById('clothes-chart');
    if (clothesChartElement) {
        const clothesCtx = clothesChartElement.getContext('2d');
        if (clothesChart) {
            clothesChart.destroy();
        }
        clothesChart = new Chart(clothesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Available', 'Used'],
                datasets: [{
                    data: [data.clothes_available, data.clothes_used || 0],
                    backgroundColor: ['#4CAF50', '#f44336'],
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }
    
    // Update resource details
    const foodStockElement = document.getElementById('food-stock');
    const foodUsedElement = document.getElementById('food-used');
    const waterStockElement = document.getElementById('water-stock');
    const waterUsedElement = document.getElementById('water-used');
    const essentialsStockElement = document.getElementById('essentials-stock');
    const essentialsUsedElement = document.getElementById('essentials-used');
    const clothesStockElement = document.getElementById('clothes-stock');
    const clothesUsedElement = document.getElementById('clothes-used');
    
    if (foodStockElement) foodStockElement.textContent = data.food_available;
    if (foodUsedElement) foodUsedElement.textContent = data.food_used || 0;
    if (waterStockElement) waterStockElement.textContent = data.water_available;
    if (waterUsedElement) waterUsedElement.textContent = data.water_used || 0;
    if (essentialsStockElement) essentialsStockElement.textContent = data.essentials_available;
    if (essentialsUsedElement) essentialsUsedElement.textContent = data.essentials_used || 0;
    if (clothesStockElement) clothesStockElement.textContent = data.clothes_available;
    if (clothesUsedElement) clothesUsedElement.textContent = data.clothes_used || 0;
  }

  // Function to update warehouse details
  function updateWarehouseDetails(data) {
    if (warehouseId) warehouseId.textContent = data.id;
    if (warehouseLocation) warehouseLocation.textContent = data.location;
    if (warehouseCoordinates) warehouseCoordinates.textContent = `${data.latitude}, ${data.longitude}`;
    if (warehouseStatus) {
        warehouseStatus.className = `badge ${data.status === 'active' ? 'bg-success' : 'bg-warning'}`;
        warehouseStatus.textContent = data.status;
    }
    if (foodAvailable) foodAvailable.textContent = data.food_available;
    if (foodCapacity) foodCapacity.textContent = data.food_capacity;
    if (waterAvailable) waterAvailable.textContent = data.water_available;
    if (waterCapacity) waterCapacity.textContent = data.water_capacity;
    if (clothesAvailable) clothesAvailable.textContent = data.clothes_available;
    if (clothesCapacity) clothesCapacity.textContent = data.clothes_capacity;
    if (essentialsAvailable) essentialsAvailable.textContent = data.essentials_available;
    if (essentialsCapacity) essentialsCapacity.textContent = data.essential_capacity;

    // Update chart values
    const foodStockElement = document.getElementById('food-stock');
    const foodUsedElement = document.getElementById('food-used');
    const waterStockElement = document.getElementById('water-stock');
    const waterUsedElement = document.getElementById('water-used');
    const essentialsStockElement = document.getElementById('essentials-stock');
    const essentialsUsedElement = document.getElementById('essentials-used');
    const clothesStockElement = document.getElementById('clothes-stock');
    const clothesUsedElement = document.getElementById('clothes-used');

    if (foodStockElement) foodStockElement.textContent = data.food_available;
    if (foodUsedElement) foodUsedElement.textContent = data.food_used || 0;
    if (waterStockElement) waterStockElement.textContent = data.water_available;
    if (waterUsedElement) waterUsedElement.textContent = data.water_used || 0;
    if (essentialsStockElement) essentialsStockElement.textContent = data.essentials_available;
    if (essentialsUsedElement) essentialsUsedElement.textContent = data.essentials_used || 0;
    if (clothesStockElement) clothesStockElement.textContent = data.clothes_available;
    if (clothesUsedElement) clothesUsedElement.textContent = data.clothes_used || 0;

    // Update charts
    initializeResourceCharts(data);
  }

  // Fetch warehouse data
  async function fetchWarehouseData() {
    try {
      const response = await fetch("/warehouse_manager/get_warehouse");
      if (!response.ok) throw new Error("Failed to fetch warehouse data");
      const data = await response.json();
      updateWarehouseDetails(data);
      initializeAvailableResourcesChart(data);
      return data;
    } catch (error) {
      console.error("Error fetching warehouse data:", error);
      alert("Failed to load warehouse data. Please refresh the page.");
      return null;
    }
  }

  // Handle logout
  function handleLogout() {
    window.location.href = "/auth/logout";
  }

  // Vehicle Management Functions
  async function fetchVehicles() {
    try {
      const response = await fetch("/warehouse_manager/list_vehicles");
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const vehicles = await response.json();
      if (vehicles && Array.isArray(vehicles)) {
      updateVehiclesList(vehicles);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  }

  function updateVehiclesList(vehicles) {
    const vehiclesList = document.getElementById('vehicles-list');
    if (!vehiclesList) {
      console.warn('Vehicles list element not found');
      return;
    }
    
    vehiclesList.innerHTML = ''; // Clear existing list

    vehicles.forEach(vehicle => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="vehicle-info" style="color: white;">
          <strong style="color: white;">ID:</strong> ${vehicle.vehicle_id}<br>
          <strong style="color: white;">Capacity:</strong> ${vehicle.capacity} kg<br>
          <strong style="color: white;">Status:</strong> ${vehicle.status}
        </div>
        <div class="vehicle-actions">
          <button class="edit-btn" onclick="editVehicle(${vehicle.vid})">Edit</button>
          <button class="delete-btn" onclick="deleteVehicle(${vehicle.vid})">Delete</button>
        </div>
      `;
      vehiclesList.appendChild(li);
    });
  }

  async function addVehicle(event) {
    event.preventDefault();
    const vehicleId = document.getElementById('vehicle-id').value;
    const capacity = document.getElementById('vehicle-capacity').value;

    if (!vehicleId || !capacity) {
      alert('Please fill in all fields');
      return;
    }

    try {
        const response = await fetch("/warehouse_manager/add_vehicle", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                vehicle_id: vehicleId,
                capacity: parseFloat(capacity)
            })
        });

        const data = await response.json();

        if (response.ok) {
        await fetchVehicles(); // Refresh the vehicles list
        document.getElementById('add-vehicle-form').reset();
        alert("Vehicle added successfully!");
        } else {
            throw new Error(data.error || "Failed to add vehicle");
        }
    } catch (error) {
        console.error("Error adding vehicle:", error);
        alert(error.message || "Failed to add vehicle");
    }
  }

  async function editVehicle(vid) {
    try {
      const vehicle = await fetch(`/warehouse_manager/list_vehicles`).then(res => res.json())
        .then(vehicles => vehicles.find(v => v.vid === vid));

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      // Create modal container
      const modalContainer = document.createElement('div');
      modalContainer.className = 'modal-container';
      modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(8px);
      `;

      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';
      modalContent.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        padding: 20px;
        border-radius: 15px;
        width: 400px;
        max-width: 90%;
        color: black;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
      `;

      // Create form
      const form = document.createElement('form');
      form.innerHTML = `
        <h3 style="margin-top: 0; color: #a2fd65; font-weight: bold; font-size: 20px; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">Edit Vehicle</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #a2fd65; font-weight: bold; font-size: 16px;">Vehicle ID</label>
          <input type="text" id="edit-vehicle-id" value="${vehicle.vehicle_id}" required
            style="width: 100%; padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #000; background: rgba(255, 255, 255, 0.1); font-weight: bold; font-size: 16px; backdrop-filter: blur(5px);">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #a2fd65; font-weight: bold; font-size: 16px;">Capacity (kg)</label>
          <input type="number" id="edit-vehicle-capacity" value="${vehicle.capacity}" required
            style="width: 100%; padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #000; background: rgba(255, 255, 255, 0.1); font-weight: bold; font-size: 16px; backdrop-filter: blur(5px);">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #a2fd65; font-weight: bold; font-size: 16px;">Status</label>
          <select id="edit-vehicle-status" style="width: 100%; padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #000; background: rgba(255, 255, 255, 0.1); font-weight: bold; font-size: 16px; backdrop-filter: blur(5px);">
            <option value="Available" ${vehicle.status === 'Available' ? 'selected' : ''}>Available</option>
            <option value="In Use" ${vehicle.status === 'In Use' ? 'selected' : ''}>In Use</option>
            <option value="Maintenance" ${vehicle.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" onclick="closeModal()" style="padding: 8px 16px; background: rgba(108, 117, 125, 0.8); color: white; border: none; border-radius: 8px; cursor: pointer; backdrop-filter: blur(5px);">Cancel</button>
          <button type="button" onclick="submitEditVehicle(${vid})" style="padding: 8px 16px; background: rgba(0, 123, 255, 0.8); color: white; border: none; border-radius: 8px; cursor: pointer; backdrop-filter: blur(5px);">Save Changes</button>
        </div>
      `;

      // Add form to modal content
      modalContent.appendChild(form);
      modalContainer.appendChild(modalContent);
      document.body.appendChild(modalContainer);

      // Store form elements for later use
      window.editForm = form;
      window.currentModal = modalContainer;
    } catch (error) {
      console.error('Error editing vehicle:', error);
      alert('Failed to edit vehicle: ' + error.message);
    }
  }

  function closeModal() {
    if (window.currentModal) {
      window.currentModal.remove();
      window.currentModal = null;
    }
  }

  async function submitEditVehicle(vid) {
    try {
      const form = window.editForm;
      const vehicleId = form.querySelector('#edit-vehicle-id').value;
      const capacity = form.querySelector('#edit-vehicle-capacity').value;
      const status = form.querySelector('#edit-vehicle-status').value;

      const response = await fetch(`/warehouse_manager/update_vehicle/${vid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          capacity: parseFloat(capacity),
          status: status
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update vehicle');
      }

      // Close modal and refresh list
      closeModal();
      await fetchVehicles();
      alert('Vehicle updated successfully');
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Failed to update vehicle: ' + error.message);
    }
  }

  async function deleteVehicle(vid) {
    if (!confirm('Are you sure you want to delete this vehicle?')) {
      return;
    }

    try {
      const response = await fetch(`/warehouse_manager/delete_vehicle/${vid}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete vehicle');
      }

      await fetchVehicles();
      alert('Vehicle deleted successfully');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert(error.message);
    }
  }

  // Make functions available globally
  window.editVehicle = editVehicle;
  window.submitEditVehicle = submitEditVehicle;
  window.deleteVehicle = deleteVehicle;
  window.closeModal = closeModal;

  // Fetch initial data
  fetchWarehouseData();
  fetchVehicles();
  fetchResourceRequests();

  // Initialize everything when the page loads
  window.addEventListener('load', async function() {
    try {
      // Start typewriter effect if element exists
      if (typewriterElement) {
        startTypewriter();
      }
      
      // Fetch initial data
      await Promise.all([
        fetchWarehouseDetails(),
        fetchResourceRequests()
      ]);

      // Set up event listeners
      setupEventListeners();

      // Set up periodic updates if requests list exists
      if (requestsList) {
        setInterval(fetchResourceRequests, 30000); // Refresh requests every 30 seconds
      }
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  });

  // Function to set up event listeners
  function setupEventListeners() {
    // Add event listener for the process request button
    const processRequestBtn = document.getElementById('process-request-btn');
    if (processRequestBtn) {
      processRequestBtn.addEventListener('click', processResourceRequest);
    }
    
    // Add event listener for the update available resources form
    const updateAvailableResourcesForm = document.getElementById('update-available-resources-form');
    if (updateAvailableResourcesForm) {
      updateAvailableResourcesForm.addEventListener('submit', handleUpdateAvailableResources);
    }
    
    // Add event listener for the update used resources form
    const updateUsedResourcesForm = document.getElementById('update-used-resources-form');
    if (updateUsedResourcesForm) {
      updateUsedResourcesForm.addEventListener('submit', handleUpdateUsedResources);
    }
    
    // Add event listener for the logout button
    const logoutBtn = document.querySelector('.logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  }

  // Function to fetch warehouse details
  async function fetchWarehouseDetails() {
    try {
        const response = await fetch('/warehouse_manager/get_warehouse');
        if (!response.ok) {
            throw new Error('Failed to fetch warehouse details');
        }
        
        const data = await response.json();
        
        // Update warehouse details
        document.getElementById('warehouse-name').textContent = data.name;
        document.getElementById('warehouse-location').textContent = data.location;
        document.getElementById('food-capacity').textContent = data.food_capacity;
        document.getElementById('water-capacity').textContent = data.water_capacity;
        document.getElementById('essentials-capacity').textContent = data.essential_capacity;
        document.getElementById('clothes-capacity').textContent = data.clothes_capacity;
        
        // Initialize resource charts
        initializeResourceCharts(data);
        
    } catch (error) {
        console.error('Error fetching warehouse details:', error);
    }
  }

  // Function to fetch resource requests
  async function fetchResourceRequests() {
    try {
        const response = await fetch('/warehouse_manager/get_resource_requests');
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            const requestsTableBody = document.getElementById('requests-table-body');
            if (requestsTableBody) {
                if (data.requests.length > 0) {
                    requestsTableBody.innerHTML = '';
                    data.requests.forEach(request => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${request.camp_name}</td>
                            <td>${request.location}</td>
                            <td>${request.distance.toFixed(2)} km</td>
                            <td>${request.food_quantity}</td>
                            <td>${request.water_quantity}</td>
                            <td>${request.essentials_quantity}</td>
                            <td>${request.clothes_quantity}</td>
                            <td>${request.priority}</td>
                            <td>${request.created_at}</td>
                            <td>
                                <button onclick="processResourceRequest(${request.id}, 'accept')" 
                                    class="action-button accept">Accept</button>
                                <button onclick="processResourceRequest(${request.id}, 'reject')" 
                                    class="action-button reject">Reject</button>
                            </td>
                        `;
                        requestsTableBody.appendChild(row);
                    });
                } else {
                    requestsTableBody.innerHTML = '<tr><td colspan="10" class="no-requests">No pending resource requests</td></tr>';
                }
            }

            // Display waiting vehicles information
            const waitingVehiclesContainer = document.getElementById('waiting-vehicles-container');
            if (waitingVehiclesContainer) {
                if (data.waiting_vehicles.length > 0) {
                    waitingVehiclesContainer.innerHTML = `
                        <h3>Vehicles Waiting for More Requests</h3>
                        <div class="waiting-vehicles-list">
                            ${data.waiting_vehicles.map(vehicle => `
                                <div class="waiting-vehicle-item">
                                    <div class="vehicle-info">
                                        <strong>Vehicle ID:</strong> ${vehicle.vehicle_id}<br>
                                        <strong>Total Capacity:</strong> ${vehicle.capacity} kg<br>
                                        <strong>Current Load:</strong> ${vehicle.current_load} kg<br>
                                        <strong>Available Capacity:</strong> ${vehicle.available_capacity} kg<br>
                                        <strong>Status:</strong> ${vehicle.needs_more ? 'Waiting for more requests to reach 90% capacity' : 'Ready to dispatch'}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                } else {
                    waitingVehiclesContainer.innerHTML = '<p>No vehicles waiting for more requests</p>';
                }
            }
        } else {
            throw new Error(data.error || 'Failed to fetch resource requests');
        }
    } catch (error) {
        console.error('Error fetching resource requests:', error);
        const requestsTableBody = document.getElementById('requests-table-body');
        if (requestsTableBody) {
            requestsTableBody.innerHTML = '<tr><td colspan="10" class="no-requests">Error loading resource requests</td></tr>';
        }
        const waitingVehiclesContainer = document.getElementById('waiting-vehicles-container');
        if (waitingVehiclesContainer) {
            waitingVehiclesContainer.innerHTML = '<p>Error loading waiting vehicles information</p>';
        }
    }
  }

  // Function to process a resource request
  async function processResourceRequest(requestId, action) {
    try {
        if (action === 'accept') {
            // Show vehicle selection popup
            const vehicles = await fetchAvailableVehicles(requestId);
            if (!vehicles.success) {
                throw new Error(vehicles.error || 'Failed to fetch available vehicles');
            }
            
            if (vehicles.vehicles.length === 0) {
                alert('No suitable vehicles available for this request');
                return;
            }
            
            showVehicleSelectionPopup(requestId, vehicles.vehicles);
        } else if (action === 'reject') {
            const response = await fetch('/warehouse_manager/process_resource_request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    request_id: requestId,
                    action: action
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                if (data.status === 'rejected_and_forwarded') {
                    alert(`Request rejected and forwarded to ${data.next_warehouse}`);
                } else {
                    alert(data.message);
                }
                
                // Force refresh the resource requests list
                await fetchResourceRequests();
                
                // Also refresh the warehouse data to update resource counts
                await fetchWarehouseData();
            } else {
                alert(`Error: ${data.error}`);
            }
        }
    } catch (error) {
        console.error('Error processing resource request:', error);
        alert(`Error processing request: ${error.message}`);
    }
  }

  // Function to fetch available vehicles for a request
  async function fetchAvailableVehicles(requestId) {
    try {
        const response = await fetch(`/warehouse_manager/get_available_vehicles/${requestId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching available vehicles:', error);
        return { success: false, error: error.message };
    }
  }

  // Function to show vehicle selection popup
  function showVehicleSelectionPopup(requestId, vehicles) {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';
    modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(8px);
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
        background: rgba(30, 30, 30, 0.9);
        padding: 20px;
        border-radius: 15px;
        width: 600px;
        max-width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        color: white;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    `;

    // Create vehicle list
    const vehicleList = document.createElement('div');
    vehicleList.className = 'vehicle-list';
    vehicleList.style.cssText = `
        margin: 20px 0;
        max-height: 400px;
        overflow-y: auto;
    `;

    vehicles.forEach(vehicle => {
        const vehicleItem = document.createElement('div');
        vehicleItem.className = 'vehicle-item';
        vehicleItem.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        vehicleItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #a2fd65;">Vehicle ID:</strong> ${vehicle.vehicle_id}<br>
                    <strong style="color: #a2fd65;">Total Capacity:</strong> ${vehicle.capacity} kg<br>
                    <strong style="color: #a2fd65;">Current Load:</strong> ${vehicle.current_load} kg<br>
                    <strong style="color: #a2fd65;">Available Capacity:</strong> ${vehicle.available_capacity} kg
                </div>
                <button onclick="selectVehicle(${requestId}, ${vehicle.vid})" 
                    style="background: #a2fd65; color: black; border: none; padding: 8px 16px; 
                    border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Select
                </button>
            </div>
        `;
        vehicleList.appendChild(vehicleItem);
    });

    // Add content to modal
    modalContent.innerHTML = `
        <h3 style="color: #a2fd65; margin-top: 0; text-align: center;">Select Vehicle</h3>
        <div style="text-align: center; margin-bottom: 15px;">
            Please select a vehicle to assign this request to.
        </div>
    `;
    modalContent.appendChild(vehicleList);

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
        width: 100%;
    `;
    closeButton.onclick = () => modalContainer.remove();
    modalContent.appendChild(closeButton);

    // Add modal to page
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
  }

  // Function to select a vehicle and process the request
  async function selectVehicle(requestId, vehicleId) {
    try {
        const response = await fetch('/warehouse_manager/process_resource_request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                request_id: requestId,
                action: 'accept',
                vehicle_id: vehicleId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Request accepted successfully. ETA: ${data.eta}`);
            // Close the modal
            document.querySelector('.modal-container').remove();
            // Refresh the requests list
            await fetchResourceRequests();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error processing request:', error);
        alert(`Error processing request: ${error.message}`);
    }
  }

  // Make functions available globally
  window.processResourceRequest = processResourceRequest;
  window.selectVehicle = selectVehicle;

  // Function to handle updating available resources
  async function handleUpdateAvailableResources(event) {
    event.preventDefault();
    
    const food = document.getElementById('update-food-available').value;
    const water = document.getElementById('update-water-available').value;
    const essentials = document.getElementById('update-essentials-available').value;
    const clothes = document.getElementById('update-clothes-available').value;
    
    // Validate inputs
    if (!food && !water && !essentials && !clothes) {
        alert('Please enter at least one resource quantity to update');
        return;
    }
    
    // Validate that quantities are non-negative
    if (food < 0 || water < 0 || essentials < 0 || clothes < 0) {
        alert('Resource quantities cannot be negative');
        return;
    }
    
    try {
        const response = await fetch('/warehouse_manager/update_available_resources', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                food: parseInt(food) || 0,
                water: parseInt(water) || 0,
                essentials: parseInt(essentials) || 0,
                clothes: parseInt(clothes) || 0
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update available resources');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('Available resources updated successfully');
            
            // Clear form
            document.getElementById('update-available-resources-form').reset();
            
            // Refresh warehouse details
            fetchWarehouseDetails();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error updating available resources:', error);
        alert('Error updating available resources: ' + error.message);
    }
  }

  // Function to handle updating used resources
  async function handleUpdateUsedResources(event) {
    event.preventDefault();
    
    const food = document.getElementById('update-food-used').value;
    const water = document.getElementById('update-water-used').value;
    const essentials = document.getElementById('update-essentials-used').value;
    const clothes = document.getElementById('update-clothes-used').value;
    
    // Validate inputs
    if (!food && !water && !essentials && !clothes) {
        alert('Please enter at least one resource quantity to update');
        return;
    }
    
    // Validate that quantities are non-negative
    if (food < 0 || water < 0 || essentials < 0 || clothes < 0) {
        alert('Resource quantities cannot be negative');
        return;
    }
    
    try {
        const response = await fetch('/warehouse_manager/update_used_resources', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                food: parseInt(food) || 0,
                water: parseInt(water) || 0,
                essentials: parseInt(essentials) || 0,
                clothes: parseInt(clothes) || 0
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update used resources');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('Used resources updated successfully');
            
            // Clear form
            document.getElementById('update-used-resources-form').reset();
            
            // Refresh warehouse details
            fetchWarehouseDetails();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error updating used resources:', error);
        alert('Error updating used resources: ' + error.message);
    }
  }
});