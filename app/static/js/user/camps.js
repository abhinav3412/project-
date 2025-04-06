document.addEventListener("DOMContentLoaded", () => {
    let camps = [];
    let currentCampIndex = 0;
    let map = null; // Ensure map is only initialized once
    let notificationRefreshInterval = null; // Move this to the top level scope

    // Fetch Camps from Backend
    async function fetchCamps() {
        try {
            const response = await fetch('/user/list_all_camps');
            if (!response.ok) throw new Error("Failed to fetch camp data");

            camps = await response.json();
            console.log("Fetched camps:", camps);

            if (!Array.isArray(camps) || camps.length === 0) {
                alert("No camps available.");
                return;
            }

            // Update the map with the first camp
            if (camps[0]) {
                initMap(camps[0]);
            }

            // Update the camp details
            updateCampDetails();

            // Initialize the chart with the first camp's data
            if (camps[0]) {
                initializeChart(camps[0].food_capacity, camps[0].water_capacity);
            }

            // Add event listeners
            addEventListeners();

        } catch (error) {
            console.error("Error fetching camps:", error);
            alert("Error: Failed to fetch camp data");
        }
    }

    // Initialize App with Fetched Camps
    function initializeAppWithCamps() {
        currentCampIndex = 0; // Reset index
        initMap(camps[currentCampIndex]); // Initialize map with first camp
        updateCampDetails();
        addEventListeners();
    }

    // Initialize Map
    function initMap(camp) {
        if (!camp || !camp.coordinates_lat || !camp.coordinates_lng) {
            console.error("Invalid camp data for map initialization.");
            return;
        }

        const center = [camp.coordinates_lat, camp.coordinates_lng];

        if (!map) { 
            map = L.map("map").setView(center, 12);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        } 

        updateMap();
    }

    // Update Map
    function updateMap() {
        if (!camps || camps.length === 0) return;
        if (currentCampIndex >= camps.length) return;

        const currentCamp = camps[currentCampIndex];
        if (!currentCamp || !currentCamp.coordinates_lat || !currentCamp.coordinates_lng) return;

        const center = [currentCamp.coordinates_lat, currentCamp.coordinates_lng];

        map.setView(center, 12);

        // Remove existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        L.marker(center).addTo(map)
            .bindPopup(currentCamp.location)
            .openPopup();

        document.getElementById("directions-btn").onclick = () => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${center[0]},${center[1]}`, "_blank");
        };
    }

    // Initialize Chart
    let resourcesChart;

    function initializeChart(food, water) {
        const ctx = document.getElementById("resources-chart").getContext("2d");
        if (resourcesChart) resourcesChart.destroy();

        resourcesChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: ["Food Capacity (kg)", "Water Capacity (liters)"],
                datasets: [{
                    label: "Camp Resources Capacity",
                    data: [food, water],
                    backgroundColor: ["rgba(75, 192, 192, 0.6)", "rgba(153, 102, 255, 0.6)"],
                    borderColor: ["rgba(75, 192, 192, 1)", "rgba(153, 102, 255, 1)"],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Capacity'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Camp Resource Capacities'
                    }
                }
            }
        });
    }

    // Fetch and Display Notifications for a each Camp
    async function fetchAndDisplayNotifications(camp_id) {
        try {
            console.log("Fetching notifications for camp:", camp_id);
            const response = await fetch(`/user/camp_notification/${camp_id}`);
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error("User not authenticated");
                    const announcementsList = document.getElementById("announcements-list");
                    announcementsList.innerHTML = `
                        <li class="announcement-item">
                            <div class="announcement-message">Please log in to view announcements.</div>
                        </li>
                    `;
                    return;
                }
                if (response.status === 404) {
                    console.error("Camp not found");
                    const announcementsList = document.getElementById("announcements-list");
                    announcementsList.innerHTML = `
                        <li class="announcement-item">
                            <div class="announcement-message">Camp not found.</div>
                        </li>
                    `;
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const notifications = await response.json();
            console.log("Received notifications:", notifications);

            const announcementsList = document.getElementById("announcements-list");
            announcementsList.innerHTML = ""; // Clear existing announcements

            if (!notifications || notifications.length === 0) {
                const noAnnouncementItem = document.createElement("li");
                noAnnouncementItem.className = 'announcement-item';
                noAnnouncementItem.innerHTML = `
                    <div class="announcement-message">No announcements available.</div>
                `;
                announcementsList.appendChild(noAnnouncementItem);
                return;
            }

            notifications.forEach(notification => {
                const listItem = document.createElement("li");
                listItem.className = 'announcement-item';
                
                // Create timestamp element
                const timestamp = new Date(notification.timestamp);
                const timeString = timestamp.toLocaleString();
                
                // Add message and timestamp
                listItem.innerHTML = `
                    <div class="announcement-message">${notification.message}</div>
                    <div class="announcement-time">${timeString}</div>
                `;
                
                // Add appropriate class based on notification type and status
                if (notification.type === 'booking_status') {
                    if (notification.status === 'Approved') {
                        listItem.classList.add('approved');
                    } else if (notification.status === 'Rejected') {
                        listItem.classList.add('rejected');
                    } else if (notification.status === 'Pending') {
                        listItem.classList.add('pending');
                    }
                }
                
                announcementsList.appendChild(listItem);
            });
        } catch (error) {
            console.error("Error fetching notifications:", error);
            const announcementsList = document.getElementById("announcements-list");
            announcementsList.innerHTML = `
                <li class="announcement-item">
                    <div class="announcement-message">Error loading announcements. Please try again later.</div>
                </li>
            `;
        }
    }

    // Function to start periodic notification refresh with retry logic
    function startNotificationRefresh(camp_id) {
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 5000; // 5 seconds

        // Initial fetch
        fetchAndDisplayNotifications(camp_id);
        
        // Set up periodic refresh every 10 seconds (reduced from 30 seconds)
        const interval = setInterval(async () => {
            try {
                await fetchAndDisplayNotifications(camp_id);
                retryCount = 0; // Reset retry count on success
            } catch (error) {
                console.error("Error in notification refresh:", error);
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    console.error("Max retries reached, stopping notification refresh");
                    clearInterval(interval);
                } else {
                    console.log(`Retrying in ${retryDelay/1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
                    setTimeout(() => fetchAndDisplayNotifications(camp_id), retryDelay);
                }
            }
        }, 10000); // 10 seconds (reduced from 30 seconds)

        return interval;
    }

    // Update Camp Details
    function updateCampDetails() {
        if (!camps || camps.length === 0) return;

        const currentCamp = camps[currentCampIndex];

        // Clear existing notification refresh if any
        if (notificationRefreshInterval) {
            clearInterval(notificationRefreshInterval);
            notificationRefreshInterval = null;
        }

        document.getElementById("camp-id").textContent = currentCamp.cid || "N/A";
        document.getElementById("camp-location").textContent = currentCamp.location || "N/A";
        document.getElementById("camp-status").textContent = currentCamp.status || "N/A";
        document.getElementById("camp-capacity").textContent = `${currentCamp.current_occupancy || 0} / ${currentCamp.capacity || 0} people`;
        document.getElementById("camp-food").textContent = `${currentCamp.food_capacity || 0} kg`;
        document.getElementById("camp-water").textContent = `${currentCamp.water_capacity || 0} liters`;
        document.getElementById("camp-contact").textContent = currentCamp.contact_number || "N/A";

        // Update chart with current capacity data
        initializeChart(currentCamp.food_capacity, currentCamp.water_capacity);
        
        // Update map
        updateMap();
        
        // Start new notification refresh for current camp
        if (currentCamp.cid) {
            notificationRefreshInterval = startNotificationRefresh(currentCamp.cid);
        }
    }

    // Add Event Listeners
    function addEventListeners() {
        document.getElementById("next-camp-btn").addEventListener("click", () => {
            if (!camps.length) return;
            currentCampIndex = (currentCampIndex + 1) % camps.length;
            updateCampDetails();
        });

        document.getElementById("prev-camp-btn").addEventListener("click", () => {
            if (!camps.length) return;
            currentCampIndex = (currentCampIndex - 1 + camps.length) % camps.length;
            updateCampDetails();
        });

        // Add search functionality
        document.getElementById("search-btn").addEventListener("click", async () => {
            const searchInput = document.getElementById("search-input").value.trim().toLowerCase();
            const currentCamp = camps[currentCampIndex];
            const searchResultContainer = document.getElementById("search-result");
        
            try {
                console.log("Searching for people in camp:", currentCamp.cid);
                const response = await fetch(`/user/people-list/${currentCamp.cid}`);
                if (!response.ok) throw new Error("Failed to fetch people list");
        
                const people = await response.json();
                console.log("Received people list:", people);
                searchResultContainer.innerHTML = ""; // Clear previous results
        
                if (!Array.isArray(people) || people.length === 0) {
                    searchResultContainer.textContent = "No people found in this camp.";
                    return;
                }
 
                const matchingPeople = people.filter(person =>
                    person.name.toLowerCase().includes(searchInput)
                );
                
                console.log("Matching people:", matchingPeople);
                
                if (matchingPeople.length === 0) {
                    searchResultContainer.textContent = "No matching records found.";
                } else {
                    const list = document.createElement("ul");
                    list.style.listStyle = "none";
                    list.style.padding = "0";
                    list.style.margin = "0";
                    
                    matchingPeople.forEach(person => {
                        const listItem = document.createElement("li");
                        listItem.style.padding = "10px";
                        listItem.style.margin = "5px 0";
                        listItem.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                        listItem.style.borderRadius = "5px";
                        listItem.innerHTML = `
                            <div style="color: #a2fd65;">${person.name}</div>
                            <div style="color: #ffffff; font-size: 0.9em;">Phone: ${person.phone || 'N/A'}</div>
                        `;
                        list.appendChild(listItem);
                    });
                    searchResultContainer.appendChild(list);
                }
            } catch (error) {
                console.error("Error fetching people list:", error);
                searchResultContainer.textContent = "Error fetching people list.";
            }
        });

        // Add search on Enter key
        document.getElementById("search-input").addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                document.getElementById("search-btn").click();
            }
        });

        // Add clear notifications button event listener
        const clearNotificationsBtn = document.getElementById("clear-notifications-btn");
        if (clearNotificationsBtn) {
            clearNotificationsBtn.addEventListener("click", () => {
                if (!camps || camps.length === 0) return;
                const currentCamp = camps[currentCampIndex];
                if (currentCamp && currentCamp.cid) {
                    if (confirm("Are you sure you want to clear all notifications?")) {
                        clearNotifications(currentCamp.cid);
                    }
                }
            });
        }
    }

    // Function to fetch and populate camp options
    async function populateCampOptions() {
        try {
            const response = await fetch('/user/list_all_camps');
            if (!response.ok) throw new Error('Failed to fetch camps');
            const campsData = await response.json();
            
            // Get all select elements for priority camps
            const priority1Select = document.getElementById('priority1');
            const priority2Select = document.getElementById('priority2');
            const priority3Select = document.getElementById('priority3');
            
            // Clear existing options except the first one
            priority1Select.innerHTML = '<option value="" disabled selected>Select a Camp</option>';
            priority2Select.innerHTML = '<option value="" disabled selected>Select a Camp</option>';
            priority3Select.innerHTML = '<option value="" disabled selected>Select a Camp</option>';
            
            // Add camp options to each select
            campsData.forEach(camp => {
                const option = document.createElement('option');
                option.value = camp.cid;
                option.textContent = `${camp.name} (${camp.location})`;
                
                // Clone the option for each select
                priority1Select.appendChild(option.cloneNode(true));
                priority2Select.appendChild(option.cloneNode(true));
                priority3Select.appendChild(option.cloneNode(true));
            });
        } catch (error) {
            console.error('Error fetching camps:', error);
            alert('Failed to load camp options. Please try again later.');
        }
    }

    // Show/hide request form popup
    const requestSlotBtn = document.getElementById('request-slot-btn');
    const requestFormPopup = document.getElementById('request-form-popup');
    const closeBtn = document.querySelector('.close-btn');

    requestSlotBtn.addEventListener('click', () => {
        requestFormPopup.style.display = 'flex';
        populateCampOptions(); // Populate options when opening the form
    });

    closeBtn.addEventListener('click', () => {
        requestFormPopup.style.display = 'none';
    });

    // Close popup when clicking outside the content
    window.addEventListener('click', (event) => {
        if (event.target === requestFormPopup) {
            requestFormPopup.style.display = 'none';
        }
    });

    // Handle form submission
    const requestForm = document.getElementById('request-form');
    requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            number_slots: document.querySelector('.number_slot').value,
            priority1: document.getElementById('priority1').value,
            priority2: document.getElementById('priority2').value,
            priority3: document.getElementById('priority3').value
        };

        try {
            const response = await fetch('/user/request_camp_slot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                alert('Camp slot request submitted successfully!');
                requestFormPopup.style.display = 'none';
                requestForm.reset();
                
                // Refresh notifications immediately after submitting a request
                if (camps && camps.length > 0 && camps[currentCampIndex]) {
                    const currentCampId = camps[currentCampIndex].cid;
                    if (currentCampId) {
                        console.log("Refreshing notifications after request submission");
                        fetchAndDisplayNotifications(currentCampId);
                    }
                }
            } else {
                alert(data.message || 'Failed to submit request. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            alert('Failed to submit request. Please try again later.');
        }
    });

    // Function to clear notifications
    async function clearNotifications(camp_id) {
        try {
            const response = await fetch(`/user/clear_camp_notifications/${camp_id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                // Clear the announcements list in the UI
                const announcementsList = document.getElementById("announcements-list");
                announcementsList.innerHTML = `
                    <li class="announcement-item">
                        <div class="announcement-message">No announcements available.</div>
                    </li>
                `;
                console.log("Notifications cleared successfully");
            }
        } catch (error) {
            console.error("Error clearing notifications:", error);
            alert("Failed to clear notifications. Please try again.");
        }
    }

    // Fetch Camps on Page Load
    fetchCamps();
});


