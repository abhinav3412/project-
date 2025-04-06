document.addEventListener("DOMContentLoaded", () => {
    let camps = [];
    let currentCampIndex = 0;
    let map = null; // Ensure map is only initialized once

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

            initializeAppWithCamps();
        } catch (error) {
            console.error("Error fetching camps:", error);
            alert("Error fetching camps.");
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
        if (!camp || !camp.coordinates) {
            console.error("Invalid camp data for map initialization.");
            return;
        }

        const center = [camp.coordinates.lat, camp.coordinates.lng];

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
        if (!currentCamp || !currentCamp.coordinates) return;

        const center = [currentCamp.coordinates.lat, currentCamp.coordinates.lng];

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
                labels: ["Food (meals)", "Water (liters)"],
                datasets: [{
                    label: "Resources Available",
                    data: [food, water],
                    backgroundColor: ["rgba(75, 192, 192, 0.6)", "rgba(153, 102, 255, 0.6)"],
                    borderColor: ["rgba(75, 192, 192, 1)", "rgba(153, 102, 255, 1)"],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Update Camp Details
    function updateCampDetails() {
        if (!camps || camps.length === 0) return;

        const currentCamp = camps[currentCampIndex];

        document.getElementById("camp-id").textContent = currentCamp.cid || "N/A";
        document.getElementById("camp-location").textContent = currentCamp.location || "N/A";
        document.getElementById("camp-status").textContent = currentCamp.status || "N/A";
        document.getElementById("camp-capacity").textContent = `${currentCamp.num_people_present || 0} / ${currentCamp.capacity || 0} people`;
        document.getElementById("camp-food").textContent = `${currentCamp.food_stock_quota || 0} meals`;
        document.getElementById("camp-water").textContent = `${currentCamp.water_stock_litres || 0} liters`;
        document.getElementById("camp-contact").textContent = currentCamp.contact_number || "N/A";

        initializeChart(currentCamp.food_stock_quota, currentCamp.water_stock_litres);
        updateMap();
        fetchAndDisplayNotifications(currentCamp.cid);
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

        document.getElementById("search-btn").addEventListener("click", async () => {
            const searchInput = document.getElementById("search-input").value.trim().toLowerCase();
            const currentCamp = camps[currentCampIndex];
            const searchResultContainer = document.getElementById("search-result");
        
            try {
                const response = await fetch(`/user/people-list/${currentCamp.cid}`);
                if (!response.ok) throw new Error("Failed to fetch people list");
        
                const people = await response.json();
                searchResultContainer.innerHTML = ""; // Clear previous results
        
                if (!Array.isArray(people) || people.length === 0) {
                    searchResultContainer.textContent = "No people found in this camp.";
                    return;
                }
 
                const matchingPeople = people.filter(person =>
                    person.name.toLowerCase().includes(searchInput)
                );
                
                if (matchingPeople.length === 0) {
                    searchResultContainer.textContent = "No matching records found.";
                } else {
                    const list = document.createElement("ul");
                    matchingPeople.forEach(person => {
                        const listItem = document.createElement("li");
                        listItem.textContent = `${person.name} (UID: ${person.uid})`;
                        list.appendChild(listItem);
                    });
                    searchResultContainer.appendChild(list);
                }
            } catch (error) {
                console.error("Error fetching people list:", error);
                searchResultContainer.textContent = "Error fetching people list.";
            }
        });
    }

    // Fetch and Display Notifications for a each Camp
    async function fetchAndDisplayNotifications(camp_id) {
        try {
            const response = await fetch(`/user/camp_notification/${camp_id}`);
            if (!response.ok) throw new Error("Failed to fetch notifications");
            const notifications = await response.json();

            const announcementsList = document.getElementById("announcements-list");
            announcementsList.innerHTML = ""; // Clear existing announcements

            if (notifications.length === 0) {
                const noAnnouncementItem = document.createElement("li");
                noAnnouncementItem.textContent = "No announcements available.";
                noAnnouncementItem.style.color = "gray";
                noAnnouncementItem.style.fontStyle = "italic";
                announcementsList.appendChild(noAnnouncementItem);
            } else {
                notifications.forEach(notification => {
                    const listItem = document.createElement("li");
                    listItem.textContent = notification.message;
                    announcementsList.appendChild(listItem);
                });
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
            const announcementsList = document.getElementById("announcements-list");
            announcementsList.innerHTML = ""; // Clear existing announcements
            const errorItem = document.createElement("li");
            errorItem.textContent = "Error loading announcements.";
            errorItem.style.color = "red";
            announcementsList.appendChild(errorItem);
        }
    }




    // Show/hide request form popup
    const requestSlotBtn = document.getElementById('request-slot-btn');
    const requestFormPopup = document.getElementById('request-form-popup');
    const closeBtn = document.querySelector('.close-btn');

    requestSlotBtn.addEventListener('click', () => {
        requestFormPopup.style.display = 'flex';
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

    // Fetch Camps on Page Load
    fetchCamps();
});


