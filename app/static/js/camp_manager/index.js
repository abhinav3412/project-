// Typewriter Text Loop
const texts = ["Lets's save!", "Protect Lives!"];
let textIndex = 0; // Tracks the current text
const typewriterElement = document.querySelector('.typewriter-text');

function typeWriter(text, element, callback) {
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

// Debug function to log information (only to console)
function debug(message) {
    console.log(message);
}

// Initialize everything when the page loads
window.addEventListener('load', async function() {
    try {
        // Start typewriter effect
        startTypewriter();

        // Fetch initial data
        await Promise.all([
            fetchCampDetails(),
            fetchPeople(),
            fetchUserRequests()
        ]);

        // Set up event listeners
        setupEventListeners();

        // Set up periodic updates
        setInterval(fetchUserRequests, 30000); // Refresh requests every 30 seconds

        // Initialize notification system
        initNotificationSystem();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Function to handle removing selected people
async function handleRemoveSelected() {
    try {
        const selectedPeople = Array.from(document.querySelectorAll('.remove-person-checkbox:checked'))
            .map(checkbox => {
                const item = checkbox.closest('.remove-person-item');
                return {
                    name: item.querySelector('.person-name').textContent,
                    phone: item.querySelector('.person-details').textContent.split(' | ')[0].replace('Phone: ', '')
                };
            });

        if (selectedPeople.length === 0) {
            alert('Please select at least one person to remove');
            return;
        }

        const response = await fetch('/camp_manager/remove_people', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ people: selectedPeople }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove people');
        }

        const result = await response.json();
        console.log('Server response:', result);
        
        if (result.success) {
            // Close modal
            const removeModal = document.getElementById('remove-person-modal');
            if (removeModal) {
                removeModal.style.display = "none";
            }
            
            // Show success message
            alert(result.message || `${selectedPeople.length} person(s) removed successfully`);
            
            // Refresh people list and camp details
            console.log('Refreshing people list and camp details...');
            
            // First refresh camp details to update occupancy
            await fetchCampDetails();
            console.log('Camp details refreshed');
            
            // Then refresh people list
            await fetchPeople();
            console.log('People list refreshed');
        } else {
            throw new Error(result.error || 'Failed to remove people');
        }
    } catch (error) {
        console.error('Error removing people:', error);
        alert('Error removing people: ' + error.message);
    }
}

// Function to set up event listeners
function setupEventListeners() {
    // Add event listener for the supply request button
    const sendSupplyRequestBtn = document.getElementById('send-supply-request');
    if (sendSupplyRequestBtn) {
        sendSupplyRequestBtn.addEventListener('click', sendResourceRequest);
    }

    // Add event listener for the filter input
    const filterInput = document.getElementById('filter');
    if (filterInput) {
        filterInput.addEventListener('input', filterPeople);
    }

    // Add event listener for the add person button
    const addPersonBtn = document.getElementById('add-person-btn');
    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', openAddPersonModal);
    }

    // Add event listener for the remove person button
    const removePersonBtn = document.getElementById('remove-person-btn');
    if (removePersonBtn) {
        removePersonBtn.addEventListener('click', openRemovePersonModal);
    }

    // Add event listener for the add person form
    const addPersonForm = document.getElementById('add-person-form');
    if (addPersonForm) {
        addPersonForm.addEventListener('submit', handleAddPerson);
    }

    // Add event listener for the remove selected button
    const removeSelectedBtn = document.getElementById('remove-selected-btn');
    if (removeSelectedBtn) {
        removeSelectedBtn.addEventListener('click', handleRemoveSelected);
    }

    // Add event listeners for modal close buttons
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Function to filter people in the list
function filterPeople(event) {
    const searchTerm = event.target.value.toLowerCase();
      const peopleList = document.getElementById('people-list');
    const people = peopleList.getElementsByClassName('person-item');

    for (let person of people) {
        const name = person.querySelector('.person-info p:first-child').textContent.toLowerCase();
        const phone = person.querySelector('.person-info p:nth-child(2)').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || phone.includes(searchTerm)) {
            person.style.display = '';
        } else {
            person.style.display = 'none';
        }
    }
}

// Function to send a resource request
async function sendResourceRequest() {
    try {
        // Get form values
        const foodQuantity = document.getElementById('food').value;
        const waterQuantity = document.getElementById('water').value;
        const essentialsQuantity = document.getElementById('essentials').value;
        const clothesQuantity = document.getElementById('clothes').value;
        const isEmergency = document.getElementById('emergency').checked;
        
        // Validate form
        if (!foodQuantity && !waterQuantity && !essentialsQuantity && !clothesQuantity) {
            alert('Please enter at least one resource quantity');
            return;
        }
        
        // Validate that quantities are non-negative
        if (foodQuantity < 0 || waterQuantity < 0 || essentialsQuantity < 0 || clothesQuantity < 0) {
            alert('Resource quantities cannot be negative');
      return;
    }

        // Prepare request data
        const requestData = {
            food: parseInt(foodQuantity) || 0,
            water: parseInt(waterQuantity) || 0,
            essentials: parseInt(essentialsQuantity) || 0,
            clothes: parseInt(clothesQuantity) || 0,
            priority: isEmergency ? 'emergency' : 'general' // Set priority based on checkbox
        };
        
        // Send request
        const response = await fetch('/camp_manager/send_resource_request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
            body: JSON.stringify(requestData)
      });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send resource request');
        }

      const data = await response.json();

      if (data.success) {
            alert('Resource request sent successfully');

        // Clear form
        document.getElementById('food').value = '';
        document.getElementById('water').value = '';
        document.getElementById('essentials').value = '';
        document.getElementById('clothes').value = '';
            document.getElementById('emergency').checked = false;

            // Update delivery status
            updateDeliveryStatus();
      } else {
            alert(`Error: ${data.error}`);
      }
    } catch (error) {
        console.error('Error sending resource request:', error);
        alert('Error sending resource request: ' + error.message);
    }
}

  // Function to update delivery status
  async function updateDeliveryStatus() {
    try {
      const response = await fetch('/camp_manager/get_delivery_status');
      if (!response.ok) throw new Error('Failed to fetch delivery status');
      
      const data = await response.json();
      const deliveryStatusContainer = document.getElementById('delivery-status');
      
      if (data.success && data.deliveries && data.deliveries.length > 0) {
        // Show the delivery status container
        deliveryStatusContainer.style.display = 'block';
        
        let html = '<h3>Resource Delivery Status</h3>';
        html += '<div class="delivery-list">';
        
        data.deliveries.forEach(delivery => {
            html += `
                <div class="delivery-item">
                    <div class="delivery-info">
                        <p><strong>Vehicle ID:</strong> ${delivery.vehicle_id}</p>
                        <p><strong>Warehouse:</strong> ${delivery.warehouse}</p>
                        <p><strong>Status:</strong> ${delivery.status}</p>
                        <p><strong>ETA:</strong> ${delivery.eta}</p>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        deliveryStatusContainer.innerHTML = html;
      } else {
        // Hide the delivery status container if no deliveries
        deliveryStatusContainer.style.display = 'none';
        deliveryStatusContainer.innerHTML = '<p class="no-deliveries">No active deliveries</p>';
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      const deliveryStatusContainer = document.getElementById('delivery-status');
      if (deliveryStatusContainer) {
        deliveryStatusContainer.style.display = 'none';
      }
    }
  }

// Function to fetch and display people in camp
async function fetchPeople() {
    try {
        console.log('Fetching people from server...');
        const response = await fetch('/camp_manager/get_camp_people');
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch people');
        }
        
        const data = await response.json();
        console.log('Received people data:', data);
        
        const peopleList = document.getElementById('people-list');
        if (!peopleList) {
            console.error('People list element not found');
            return;
        }
        
        peopleList.innerHTML = '';
        
        if (!data.success || !Array.isArray(data.people) || data.people.length === 0) {
            console.log('No people in camp');
            const noPersonItem = document.createElement('li');
            noPersonItem.textContent = 'No people in camp';
            noPersonItem.style.color = 'gray';
            noPersonItem.style.fontStyle = 'italic';
            peopleList.appendChild(noPersonItem);
            return;
        }

        console.log(`Displaying ${data.people.length} people in the list`);
        data.people.forEach(person => {
            const li = document.createElement('li');
            li.className = 'person-item';
            li.innerHTML = `
                <div class="person-info">
                    <p><strong>Name:</strong> ${person.name || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${person.phone || 'N/A'}</p>
                    <p><strong>Entry Date:</strong> ${person.entry_date || 'N/A'}</p>
                </div>
            `;
            peopleList.appendChild(li);
        });
    } catch (error) {
        console.error('Error fetching people:', error);
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Failed to load people data. Please refresh the page.';
        document.body.appendChild(errorMessage);
    }
}

// Update charts with camp data
function updateCharts(campData) {
    // Destroy existing charts if they exist
    if (window.foodChart) window.foodChart.destroy();
    if (window.waterChart) window.waterChart.destroy();
    if (window.clothesChart) window.clothesChart.destroy();
    if (window.essentialsChart) window.essentialsChart.destroy();

    // Common chart configuration
    const chartConfig = {
        type: 'doughnut',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    };

    // Helper function to get safe numeric value
    const getSafeValue = (value) => {
        return value !== null && value !== undefined ? value : 0;
    };

    // Food Chart
    const foodCtx = document.getElementById('food-chart').getContext('2d');
    window.foodChart = new Chart(foodCtx, {
        ...chartConfig,
        data: {
            labels: ['Available', 'Used'],
            datasets: [{
                data: [
                    getSafeValue(campData.food_stock_quota),
                    getSafeValue(campData.food_used)
                ],
                backgroundColor: ['#a2fd65', '#ff6b6b'],
                borderWidth: 0
            }]
        }
    });

    // Water Chart
    const waterCtx = document.getElementById('water-chart').getContext('2d');
    window.waterChart = new Chart(waterCtx, {
        ...chartConfig,
        data: {
            labels: ['Available', 'Used'],
            datasets: [{
                data: [
                    getSafeValue(campData.water_stock_litres),
                    getSafeValue(campData.water_used)
                ],
                backgroundColor: ['#a2fd65', '#ff6b6b'],
                borderWidth: 0
            }]
        }
    });

    // Clothes Chart
    const clothesCtx = document.getElementById('clothes-chart').getContext('2d');
    window.clothesChart = new Chart(clothesCtx, {
        ...chartConfig,
        data: {
            labels: ['Available', 'Used'],
            datasets: [{
                data: [
                    getSafeValue(campData.clothes_stock),
                    getSafeValue(campData.clothes_used)
                ],
                backgroundColor: ['#a2fd65', '#ff6b6b'],
                borderWidth: 0
            }]
        }
    });

    // Essentials Chart
    const essentialsCtx = document.getElementById('essentials-chart').getContext('2d');
    window.essentialsChart = new Chart(essentialsCtx, {
        ...chartConfig,
        data: {
            labels: ['Available', 'Used'],
            datasets: [{
                data: [
                    getSafeValue(campData.essentials_stock),
                    getSafeValue(campData.essentials_used)
                ],
                backgroundColor: ['#a2fd65', '#ff6b6b'],
                borderWidth: 0
            }]
        }
    });

    // Update resource details with safe values
    const updateElementText = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = getSafeValue(value);
        }
    };

    // Update resource details
    updateElementText('food-stock', campData.food_stock_quota);
    updateElementText('food-used', campData.food_used);
    updateElementText('water-stock', campData.water_stock_litres);
    updateElementText('water-used', campData.water_used);
    updateElementText('clothes-stock', campData.clothes_stock);
    updateElementText('clothes-used', campData.clothes_used);
    updateElementText('essentials-stock', campData.essentials_stock);
    updateElementText('essentials-used', campData.essentials_used);
}

// Function to fetch camp details and update charts
async function fetchCampDetails() {
    try {
        const response = await fetch('/camp_manager/get_camp_details');
        if (!response.ok) {
            throw new Error('Failed to fetch camp details');
        }
        const campData = await response.json();
        
        if (!campData.success) {
            throw new Error(campData.error || 'Failed to fetch camp details');
        }
        
        // Update resource displays with null checks
        const updateElementText = (id, value, unit = '') => {
            const element = document.getElementById(id);
            if (element) {
                const displayValue = value !== null && value !== undefined ? value : 0;
                element.textContent = `${displayValue}${unit ? ' ' + unit : ''}`;
            }
        };
        
        // Update camp details
        updateElementText('camp-name', campData.name);
        updateElementText('camp-location', campData.location);
        updateElementText('camp-capacity', campData.capacity);
        updateElementText('current-occupancy', campData.current_occupancy);
        updateElementText('camp-phone', campData.phone);
        
        // Update resource capacities with units
        updateElementText('food-capacity-detail', campData.food_capacity, 'kg');
        updateElementText('water-capacity-detail', campData.water_capacity, 'L');
        updateElementText('essentials-capacity-detail', campData.essentials_capacity, 'kits');
        updateElementText('clothes-capacity-detail', campData.clothes_capacity, 'units');
        
        // Update resource details with units
        updateElementText('food-stock', campData.food_stock_quota, 'kg');
        updateElementText('food-used', campData.food_used, 'kg');
        updateElementText('water-stock', campData.water_stock_litres, 'L');
        updateElementText('water-used', campData.water_used, 'L');
        updateElementText('essentials-stock', campData.essentials_stock, 'kits');
        updateElementText('essentials-used', campData.essentials_used, 'kits');
        updateElementText('clothes-stock', campData.clothes_stock, 'sets');
        updateElementText('clothes-used', campData.clothes_used, 'sets');
        
        // Update charts
        updateCharts(campData);
        
    } catch (error) {
        console.error('Error fetching camp details:', error);
        alert('Failed to fetch camp details. Please try again.');
    }
}

// Function to fetch and display user requests
async function fetchUserRequests() {
    try {
        console.log('Fetching user requests...');
        const response = await fetch('/camp_manager/get_user_requests');
        if (!response.ok) {
            throw new Error('Failed to fetch user requests');
        }
        const data = await response.json();
        
        // Ensure we have a valid array of requests
        const requests = data.success ? data.requests : [];
        const requestsList = document.getElementById('requests-list');
        
        if (!requestsList) {
            console.error('Requests list element not found');
            return;
        }

        // Clear existing list
        requestsList.innerHTML = '';

        if (requests.length === 0) {
            const noRequestItem = document.createElement('li');
            noRequestItem.innerHTML = `
                <div class="request-info">
                    <p style="text-align: center; color: #888;">No pending requests</p>
                </div>
            `;
            requestsList.appendChild(noRequestItem);
            return;
        }
        
        requests.forEach(request => {
            const li = document.createElement('li');
            li.className = 'request-item';
            li.innerHTML = `
                <div class="request-info">
                    <p><strong>Name:</strong> ${request.name}</p>
                    <p><strong>Phone:</strong> ${request.phone}</p>
                    <p><strong>Slots Requested:</strong> ${request.number_slots}</p>
                    <p><strong>Request Date:</strong> ${request.request_date || 'N/A'}</p>
                </div>
                <div class="request-actions">
                    <button class="accept-btn" onclick="handleRequest(${request.id}, 'accept')">Accept</button>
                    <button class="decline-btn" onclick="handleRequest(${request.id}, 'decline')">Decline</button>
                </div>
            `;
            requestsList.appendChild(li);
        });
    } catch (error) {
        console.error('Error fetching user requests:', error);
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Failed to load user requests. Please refresh the page.';
        document.body.appendChild(errorMessage);
    }
}

// Function to handle request actions (accept/decline)
async function handleRequest(requestId, action) {
    try {
        const response = await fetch('/camp_manager/update_request_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                request_id: requestId,
                status: action === 'accept' ? 'Approved' : 'Rejected'
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Show success message
            alert('Request ' + (action === 'accept' ? 'accepted' : 'declined') + ' successfully');
            
            // Refresh the requests list
            await fetchUserRequests();
            
            // If request was accepted, also refresh the people list and camp details
            if (action === 'accept') {
                // Wait for a short delay to ensure the server has processed the request
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Refresh both lists in parallel
                await Promise.all([
                    fetchPeople(),
                    fetchCampDetails()
                ]);
            }
        } else {
            throw new Error(result.error || 'Failed to handle request');
        }
    } catch (error) {
        console.error('Error handling request:', error);
        alert('Error handling request: ' + error.message);
    }
}

// Function to update resource charts
function updateResourceCharts() {
    const chartIds = ['food-chart', 'water-chart', 'clothes-chart', 'essentials-chart'];
    chartIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }
    });
}

// Modal functionality
const modal = document.getElementById('add-person-modal');
const removeModal = document.getElementById('remove-person-modal');
const addPersonBtn = document.getElementById('add-person-btn');
const removePersonBtn = document.getElementById('remove-person-btn');
const closeBtn = document.querySelector('.close');
const removeCloseBtn = removeModal.querySelector('.close');
const addPersonForm = document.getElementById('add-person-form');
const removeSelectedBtn = document.getElementById('remove-selected-btn');

// Open add person modal
addPersonBtn.onclick = function() {
    modal.style.display = "block";
}

// Open remove person modal
removePersonBtn.onclick = function() {
    removeModal.style.display = "block";
    loadPeopleForRemoval();
}

// Close add person modal
closeBtn.onclick = function() {
    modal.style.display = "none";
}

// Close remove person modal
removeCloseBtn.onclick = function() {
    removeModal.style.display = "none";
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
    if (event.target == removeModal) {
        removeModal.style.display = "none";
    }
}

// Function to load people for removal
async function loadPeopleForRemoval() {
    try {
        console.log('Loading people for removal...');
        const response = await fetch('/camp_manager/get_camp_people');
        if (!response.ok) throw new Error('Failed to fetch people');
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to fetch people');
        
        const people = data.people;
        console.log('Received people data for removal:', people);
        
        const removePeopleList = document.getElementById('remove-people-list');
        removePeopleList.innerHTML = '';
        
        if (!Array.isArray(people) || people.length === 0) {
            console.log('No people in camp to remove');
            const noPersonItem = document.createElement('div');
            noPersonItem.textContent = 'No people in camp';
            noPersonItem.style.color = 'gray';
            noPersonItem.style.fontStyle = 'italic';
            noPersonItem.style.textAlign = 'center';
            noPersonItem.style.padding = '20px';
            removePeopleList.appendChild(noPersonItem);
            return;
        }

        console.log(`Displaying ${people.length} people for removal`);
        people.forEach((person, index) => {
            const div = document.createElement('div');
            div.className = 'remove-person-item';
            div.innerHTML = `
                <input type="checkbox" class="remove-person-checkbox" id="person-${index}" data-name="${person.name}" data-phone="${person.phone}">
                <div class="remove-person-info">
                    <p class="person-name">${person.name}</p>
                    <p class="person-details">Phone: ${person.phone} | Entry Date: ${person.entry_date}</p>
                </div>
            `;
            removePeopleList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading people for removal:', error);
        alert('Error loading people: ' + error.message);
    }
}

// Function to handle adding a person
async function handleAddPerson(event) {
    event.preventDefault();
    
    const name = document.getElementById('person-name').value;
    const phone = document.getElementById('person-phone').value;
    
    if (!name || !phone) {
        alert('Please enter both name and phone number');
        return;
    }
    
    try {
        const response = await fetch('/camp_manager/add_person', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, phone })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add person');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('Person added successfully');
            
            // Close the modal
            const modal = document.getElementById('add-person-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            
            // Clear the form
            document.getElementById('add-person-form').reset();
            
            // Refresh the people list
            await fetchPeople();
        } else {
            throw new Error(data.error || 'Failed to add person');
        }
    } catch (error) {
        console.error('Error adding person:', error);
        alert('Error adding person: ' + error.message);
    }
}

// Function to open the add person modal
function openAddPersonModal() {
    const modal = document.getElementById('add-person-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Function to open the remove person modal
function openRemovePersonModal() {
    const modal = document.getElementById('remove-person-modal');
    if (modal) {
        modal.style.display = 'block';
        loadPeopleForRemoval();
    }
}

// Resource update modal functionality
const updateResourceModal = document.getElementById('update-resource-modal');
const updateResourceForm = document.getElementById('update-resource-form');
const resourceTypeInput = document.getElementById('resource-type');
const resourceValueInput = document.getElementById('resource-value-input');
const updateTypeInput = document.getElementById('update-type');

// Add click event listeners to update resource buttons
document.querySelectorAll('.update-stock-btn').forEach(button => {
    button.addEventListener('click', () => {
        const resourceType = button.dataset.resource;
        const currentStock = document.getElementById(`${resourceType}-stock`).textContent;
        
        resourceTypeInput.value = resourceType;
        updateTypeInput.value = 'stock';
        resourceValueInput.value = currentStock;
        resourceValueInput.placeholder = `Enter new ${resourceType} stock value`;
        
        updateResourceModal.style.display = 'block';
    });
});

document.querySelectorAll('.update-used-btn').forEach(button => {
    button.addEventListener('click', () => {
        const resourceType = button.dataset.resource;
        const currentUsed = document.getElementById(`${resourceType}-used`).textContent;
        
        resourceTypeInput.value = resourceType;
        updateTypeInput.value = 'used';
        resourceValueInput.value = currentUsed;
        resourceValueInput.placeholder = `Enter new ${resourceType} used value`;
        
        updateResourceModal.style.display = 'block';
    });
});

// Close modal when clicking the close button
const closeButtons = document.querySelectorAll('.close');
closeButtons.forEach(button => {
    button.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === updateResourceModal) {
        updateResourceModal.style.display = 'none';
    }
});

// Handle form submission
updateResourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const resourceType = resourceTypeInput.value;
    const updateType = updateTypeInput.value;
    const value = parseInt(resourceValueInput.value);
    
    if (!resourceType || !updateType || isNaN(value)) {
        alert('Please fill in all fields with valid values');
        return;
    }
    
    try {
        // Get the current camp ID
        const campResponse = await fetch('/camp_manager/get_current_camp');
        if (!campResponse.ok) {
            const errorData = await campResponse.json();
            throw new Error(errorData.error || 'Failed to get camp ID');
        }
        
        const campData = await campResponse.json();
        if (!campData.success) {
            throw new Error(campData.error || 'Failed to get camp ID');
        }
        
        const formData = {
            resource_type: resourceType,
            update_type: updateType,
            amount: value,
            camp_id: campData.camp_id
        };
        
        const response = await fetch('/camp_manager/update_resource', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update resource');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Close the modal first
            updateResourceModal.style.display = 'none';
            
            // Fetch latest camp details to update UI
            await fetchCampDetails();
            
            // Show success message
            alert(data.message);
        } else {
            throw new Error(data.message || 'Failed to update resource');
        }
    } catch (error) {
        console.error('Error updating resource:', error);
        alert('Error: ' + error.message);
    }
});

// Function to check for notifications
async function checkNotifications() {
    try {
        const response = await fetch('/camp_manager/get_notifications');
        if (!response.ok) {
            throw new Error('Failed to fetch notifications');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch notifications');
        }

        const notificationsContainer = document.getElementById('notifications-container');
        if (!notificationsContainer) {
            console.error('Notifications container not found');
            return;
        }

        // Clear existing notifications
        notificationsContainer.innerHTML = '';

        if (!data.notifications || data.notifications.length === 0) {
            notificationsContainer.innerHTML = '<p>No active notifications</p>';
            return;
        }

        // Process each notification
        data.notifications.forEach(notification => {
            if (notification.type === 'vehicle_dispatch') {
                // Ensure notification data is properly formatted
                const formattedNotification = {
                    id: notification.id,
                    type: notification.type,
                    message: notification.message || 'Vehicle dispatched',
                    data: {
                        vehicle_id: notification.data.vehicle_id,
                        warehouse_name: notification.data.warehouse_name,
                        eta: notification.data.eta,
                        request_id: notification.data.request_id
                    }
                };
                showVehicleDispatchNotification(formattedNotification);
            }
        });

  } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// Function to show vehicle dispatch notification
async function showVehicleDispatchNotification(notification) {
    try {
        // Check if the request is already completed
        const response = await fetch(`/camp_manager/check_request_status/${notification.data.request_id}`);
        if (!response.ok) {
            throw new Error('Failed to check request status');
        }
        const data = await response.json();
        
        // If request is already completed, don't show the notification
        if (data.status === 'completed') {
            return;
        }

        const notificationsContainer = document.getElementById('notifications-container');
        
        // Create notification item
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item';
        notificationItem.id = `notification-${notification.id}`;
        
        // Format the notification data
        const vehicleId = notification.data.vehicle_id || 'N/A';
        const warehouseName = notification.data.warehouse_name || 'N/A';
        const eta = notification.data.eta || 'N/A';
        const message = notification.message || 'Vehicle dispatched';
        const requestId = notification.data.request_id || '';
        
        notificationItem.innerHTML = `
            <div class="notification-details">
                <p><strong>Vehicle ID:</strong> ${vehicleId}</p>
                <p><strong>Warehouse:</strong> ${warehouseName}</p>
                <p><strong>ETA:</strong> ${eta}</p>
                <p><strong>Message:</strong> ${message}</p>
            </div>
            <div class="notification-actions">
                <button class="completed-btn" data-notification-id="${notification.id}" data-request-id="${requestId}">
                    <i class="fas fa-check"></i> Mark as Completed
                </button>
            </div>
        `;
        
        // Add to container
        notificationsContainer.appendChild(notificationItem);
        
        // Add event listener to the completed button
        const completedBtn = notificationItem.querySelector('.completed-btn');
        completedBtn.addEventListener('click', function() {
            const notificationId = this.dataset.notificationId;
            markNotificationAsCompleted(notificationId, notification);
        });
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

// Function to mark a notification as completed
async function markNotificationAsCompleted(notificationId, notification) {
    try {
        // Get the request ID and vehicle ID from the notification data
        const requestId = notification.data.request_id;
        const vehicleId = notification.data.vehicle_id;

        if (!requestId || !vehicleId) {
            throw new Error('Missing request ID or vehicle ID');
        }

        // Call the API to mark the delivery as completed
        const response = await fetch('/camp_manager/complete_delivery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                request_id: requestId,
                vehicle_id: vehicleId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update vehicle status');
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to complete delivery');
        }

        // Remove the notification from active notifications
        const notificationElement = document.getElementById(`notification-${notificationId}`);
        if (notificationElement) {
            notificationElement.remove();
        }

        // Add to delivery history
        addToDeliveryHistory(notification);

        // Check if there are any active notifications left
        const notificationsContainer = document.getElementById('notifications-container');
        if (notificationsContainer && notificationsContainer.children.length === 0) {
            notificationsContainer.innerHTML = '<p>No active notifications</p>';
        }

  } catch (error) {
        console.error('Error completing delivery:', error);
        alert('Error completing delivery: ' + error.message);
    }
}

// Function to add a notification to delivery history
function addToDeliveryHistory(notification) {
    const historyContainer = document.getElementById('delivery-history-container');
    
    // Create history item
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // Get current date and time
    const now = new Date();
    const completedDate = now.toLocaleString();
    
    historyItem.innerHTML = `
        <div class="history-details">
        <p><strong>Vehicle ID:</strong> ${notification.data.vehicle_id || 'N/A'}</p>
        <p><strong>Warehouse:</strong> ${notification.data.warehouse_name || 'N/A'}</p>
        <p><strong>ETA:</strong> ${notification.data.eta || 'N/A'}</p>
        <p><strong>Message:</strong> ${notification.message}</p>
            <p class="completed-date"><strong>Completed:</strong> ${completedDate}</p>
      </div>
    `;
    
    // Add to container (at the top)
    if (historyContainer.firstChild) {
        historyContainer.insertBefore(historyItem, historyContainer.firstChild);
    } else {
        historyContainer.appendChild(historyItem);
    }
    
    // Save to localStorage for persistence
    saveDeliveryHistory(notification, completedDate);
}

// Function to save delivery history to localStorage
function saveDeliveryHistory(notification, completedDate) {
  try {
    // Get existing history
    let deliveryHistory = JSON.parse(localStorage.getItem('deliveryHistory')) || [];
    
    // Add new item
    deliveryHistory.unshift({
      id: notification.id || Date.now(),
      vehicle_id: notification.data.vehicle_id,
      warehouse_name: notification.data.warehouse_name,
      eta: notification.data.eta,
      message: notification.message,
      completed_date: completedDate
    });
    
    // Limit history to 50 items
    if (deliveryHistory.length > 50) {
      deliveryHistory = deliveryHistory.slice(0, 50);
    }
    
    // Save back to localStorage
    localStorage.setItem('deliveryHistory', JSON.stringify(deliveryHistory));
  } catch (error) {
    console.error('Error saving delivery history:', error);
  }
}

// Function to load delivery history from localStorage
function loadDeliveryHistory() {
  try {
    const deliveryHistory = JSON.parse(localStorage.getItem('deliveryHistory')) || [];
    const historyContainer = document.getElementById('delivery-history-container');
    
    // Clear container
    historyContainer.innerHTML = '';
    
    if (deliveryHistory.length === 0) {
      historyContainer.innerHTML = '<p style="text-align: center; color: #aaa;">No completed deliveries</p>';
      return;
    }
    
    // Add each history item
    deliveryHistory.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      historyItem.innerHTML = `
        <div class="history-details">
          <p><strong>Vehicle ID:</strong> ${item.vehicle_id || 'N/A'}</p>
          <p><strong>Warehouse:</strong> ${item.warehouse_name || 'N/A'}</p>
          <p><strong>ETA:</strong> ${item.eta || 'N/A'}</p>
          <p><strong>Message:</strong> ${item.message}</p>
          <p class="completed-date"><strong>Completed:</strong> ${item.completed_date}</p>
    </div>
  `;
  
      historyContainer.appendChild(historyItem);
    });
    
    // Ensure the popup is visible and scrollable
    const deliveryHistoryPopup = document.getElementById('delivery-history-popup');
    if (deliveryHistoryPopup) {
      deliveryHistoryPopup.style.display = 'block';
      
      // Reset scroll position to top
      const historyContent = deliveryHistoryPopup.querySelector('.delivery-history-content');
      if (historyContent) {
        historyContent.scrollTop = 0;
      }
    }
  } catch (error) {
    console.error('Error loading delivery history:', error);
  }
}

// Initialize notification system
function initNotificationSystem() {
  // Add notification styles
  addNotificationStyles();
  
  // Get elements
  const deliveryLogoBtn = document.getElementById('delivery-logo-btn');
  const deliveryPopup = document.getElementById('delivery-popup');
  const closePopup = document.querySelector('.close-popup');
  
  const deliveryHistoryBtn = document.getElementById('delivery-history-btn');
  const deliveryHistoryPopup = document.getElementById('delivery-history-popup');
  const closeHistoryPopup = document.querySelector('.close-history-popup');
  
  if (deliveryLogoBtn && deliveryPopup && closePopup) {
    // Add click event to delivery logo button
    deliveryLogoBtn.addEventListener('click', () => {
      deliveryPopup.style.display = 'block';
      checkNotifications();
    });

    // Add click event to close button
    closePopup.addEventListener('click', () => {
      deliveryPopup.style.display = 'none';
    });

    // Close popup when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === deliveryPopup) {
        deliveryPopup.style.display = 'none';
      }
    });
  }
  
  if (deliveryHistoryBtn && deliveryHistoryPopup && closeHistoryPopup) {
    // Add click event to delivery history button
    deliveryHistoryBtn.addEventListener('click', () => {
      deliveryHistoryPopup.style.display = 'block';
      loadDeliveryHistory();
    });

    // Add click event to close button
    closeHistoryPopup.addEventListener('click', () => {
      deliveryHistoryPopup.style.display = 'none';
    });

    // Close popup when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === deliveryHistoryPopup) {
        deliveryHistoryPopup.style.display = 'none';
      }
    });
  }
}

// Add notification styles
function addNotificationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .delivery-logo-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
    }

    .delivery-logo-btn {
      width: 60px;
      height: 60px;
      background-color: #2c3e50;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }

    .delivery-logo-btn:hover {
      transform: scale(1.1);
    }

    .delivery-logo-btn i {
      color: #4CAF50;
      font-size: 24px;
    }

    .delivery-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-height: 80vh;
      background-color: #2c3e50;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
      z-index: 1002;
      display: none;
    }
    
    .delivery-popup.show {
      display: block;
    }
    
    .delivery-popup-content {
      padding: 20px;
      color: white;
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .close-popup {
      color: white;
      float: right;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 30px;
      height: 30px;
      background-color: #ff4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      position: absolute;
      top: 15px;
      right: 15px;
      border: none;
      outline: none;
      z-index: 1003;
    }
    
    .close-popup:hover {
      background-color: #ff0000;
      transform: scale(1.1);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
    }
    
    .close-popup:active {
      transform: scale(0.95);
    }
    
    .delivery-popup h2 {
      color: #4CAF50;
      margin-bottom: 15px;
      text-align: center;
      position: sticky;
      top: 0;
      background-color: #2c3e50;
      padding: 10px 0;
      margin: 0;
      padding-right: 40px;
    }
    
    .notification-item {
      border-bottom: 1px solid #4CAF50;
      padding: 15px 0;
      margin-bottom: 15px;
      position: relative;
    }

    .notification-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    
    .notification-details {
      margin-top: 15px;
    }
    
    .notification-details p {
      margin: 8px 0;
    }
    
    .notification-details strong {
      color: #4CAF50;
    }
    
    .notification-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    
    .completed-btn {
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 8px 15px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
    }
    
    .completed-btn:hover {
      background-color: #3e8e41;
      transform: scale(1.05);
    }
    
    .completed-btn:active {
      transform: scale(0.95);
    }
    
    .delivery-history-btn {
      position: fixed;
      bottom: 20px;
      right: 90px;
      width: 60px;
      height: 60px;
      background-color: #2c3e50;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
      z-index: 1000;
    }
    
    .delivery-history-btn:hover {
      transform: scale(1.1);
    }
    
    .delivery-history-btn i {
      color: #4CAF50;
      font-size: 24px;
    }
    
    .delivery-history-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-height: 80vh;
      background-color: #2c3e50;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
      z-index: 1002;
      display: none;
      overflow: visible;
    }
    
    .delivery-history-popup.show {
      display: block;
    }
    
    .delivery-history-content {
      padding: 20px;
      color: white;
      max-height: 70vh;
      overflow-y: scroll;
      scrollbar-width: thin;
      scrollbar-color: #4CAF50 #2c3e50;
      position: relative;
      z-index: 1003;
      padding-right: 30px;
      margin-right: -10px;
    }
    
    /* Custom scrollbar for Webkit browsers (Chrome, Safari, etc.) */
    .delivery-history-content::-webkit-scrollbar {
      width: 10px;
      display: block;
      position: absolute;
      right: 0;
      z-index: 1005;
    }
    
    .delivery-history-content::-webkit-scrollbar-track {
      background: #2c3e50;
      border-radius: 4px;
      min-height: 100%;
      border: 1px solid rgba(76, 175, 80, 0.2);
      margin: 5px 0;
      position: relative;
      z-index: 1004;
    }
    
    .delivery-history-content::-webkit-scrollbar-thumb {
      background-color: #4CAF50;
      border-radius: 4px;
      border: 2px solid #2c3e50;
      min-height: 50px;
      box-shadow: 0 0 5px rgba(76, 175, 80, 0.5);
      position: relative;
      z-index: 1005;
    }
    
    .delivery-history-content::-webkit-scrollbar-thumb:hover {
      background-color: #3e8e41;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.7);
    }
    
    .close-history-popup {
      color: white;
      float: right;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 30px;
      height: 30px;
      background-color: #ff4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      position: absolute;
      top: 15px;
      right: 15px;
      border: none;
      outline: none;
      z-index: 1004;
    }
    
    .close-history-popup:hover {
      background-color: #ff0000;
      transform: scale(1.1);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
    }
    
    .close-history-popup:active {
      transform: scale(0.95);
    }
    
    .delivery-history-popup h2 {
      color: #4CAF50;
      margin-bottom: 15px;
      text-align: center;
      position: sticky;
      top: 0;
      background-color: #2c3e50;
      padding: 10px 0;
      margin: 0;
      padding-right: 40px;
    }
    
    .history-item {
      border-bottom: 1px solid #4CAF50;
      padding: 15px 0;
      margin-bottom: 15px;
      transition: background-color 0.3s ease;
    }
    
    .history-item:hover {
      background-color: rgba(76, 175, 80, 0.1);
    }
    
    .history-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    
    .history-details {
      margin-top: 15px;
    }
    
    .history-details p {
      margin: 8px 0;
    }
    
    .history-details strong {
      color: #4CAF50;
    }
    
    .completed-date {
      color: #4CAF50;
      font-style: italic;
      margin-top: 10px;
      font-size: 0.9em;
    }
    
    #delivery-history-container {
      padding-bottom: 10px;
    }

    .logout-btn {
      background-color: #ff4444;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 8px 15px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
      position: absolute;
      top: 15px;
      right: 15px;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    .logout-btn:hover {
      background-color: #ff0000;
      transform: scale(1.05);
      box-shadow: 0 3px 8px rgba(255, 0, 0, 0.3);
    }
    
    .logout-btn:active {
      transform: scale(0.95);
    }
  `;
  document.head.appendChild(style);
}