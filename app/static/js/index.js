let camp_index = 0; // Start with index 0 for easier array access
let all_camps = []; // Store all camps data fetched from the server
let notificationIntervalId = null; // To store the interval ID for notifications

document.addEventListener("DOMContentLoaded", initializePage);

// Initialize the page by setting up charts, fetching data, and event listeners
function initializePage() {
    setupCharts();
    fetchAllCampsData();
    setupEventListeners();
    setupWeather();
    fetchDonationSummary(); // Fetch donation summary on page load
}

// Set up the Donation and Relief Camps charts
function setupCharts() {
    setupDonationChart();
    setupReliefCampChart();
}

// Donation Pie Chart setup
function setupDonationChart() {
    const donationCtx = document.getElementById("myChart").getContext("2d");
    new Chart(donationCtx, {
        type: "doughnut",
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ["#007bff", "#ff6384", "#28a745", "#ffc107"],
            }],
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => `${context.label}: ${context.raw}`,
                    },
                },
            },
        },
    });
}

// Set up the Relief Camps Chart
function setupReliefCampChart() {
    const campCtx = document.getElementById("campChart").getContext("2d");
    new Chart(campCtx, {
        type: "doughnut",
        data: {
            labels: ["Food Supply", "Water Supply"],
            datasets: [{
                data: [0, 0],
                backgroundColor: ["#28a745", "#ffc107"],
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: "right" },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const labels = ["meals", "liters"];
                            return `${context.label}: ${context.raw} ${labels[context.dataIndex]}`;
                        },
                    },
                },
            },
        },
    });
}

// Set up event listeners for buttons and interactions
function setupEventListeners() {
    document.querySelector(".next-camp-btn").addEventListener("click", handleNextCampClick);
    document.getElementById("chatbot-icon").addEventListener("click", toggleChatbot);
    document.getElementById("chatbot-close").addEventListener("click", closeChatbot);
    document.querySelector(".refresh-btn").addEventListener("click", refreshWeather);
}

// Handle the "Next Camp" button click
function handleNextCampClick() {
    camp_index = (camp_index + 1) % all_camps.length;
    updateCampDetailsAndChart(all_camps[camp_index]);
}

// Toggle the chatbot popup
function toggleChatbot() {
    const chatbotContainer = document.getElementById("chatbot-container");
    if (chatbotContainer) {
        chatbotContainer.style.display = chatbotContainer.style.display === "none" ? "block" : "none";
    }
}

// Close the chatbot popup
function closeChatbot() {
    const chatbotContainer = document.getElementById("chatbot-container");
    if (chatbotContainer) {
        chatbotContainer.style.display = "none";
    }
}

// Refresh weather data
function refreshWeather() {
    getLocation();
    alert("Weather data refreshed!");
}

// Set up weather-related functionality
function setupWeather() {
    getLocation();
    setInterval(getLocation, 300000); // Refresh weather every 5 minutes
}

// Fetch location and weather data
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(getWeather, showError);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// Fetch weather data based on geolocation
function getWeather(position) {
    const apiKey = "b5dab13c4329459e80660419250202"; // Replace with your WeatherAPI API key
    const { latitude: lat, longitude: lon } = position.coords;
    const url = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=no`;

    fetch(url)
        .then(response => response.json())
        .then(data => updateWeatherUI(data))
        .catch(error => console.error("Error fetching weather data:", error));
}

// Update weather UI
function updateWeatherUI(data) {
    if (data.location) {
        document.getElementById("location").innerText = `${data.location.name}, ${data.location.country}`;
        document.getElementById("weather").innerText = `${data.current.temp_c}°C`;
        document.getElementById("condition").innerText = `${data.current.condition.text}`;
        document.getElementById("humidity").innerText = `${data.current.humidity}%`;
    } else {
        document.getElementById("location").innerText = "Location not found. Please try again.";
    }
}

// Show geolocation errors
function showError(error) {
    const errorMessages = {
        1: "User denied the request for geolocation.",
        2: "Location information is unavailable.",
        3: "The request to get user location timed out.",
        0: "An unknown error occurred.",
    };
    alert(errorMessages[error.code] || errorMessages[0]);
}

// Fetch all camps data from the server
async function fetchAllCampsData() {
    try {
        const response = await fetch("/user/list_all_camps");
        if (!response.ok) throw new Error("Failed to fetch camps data");

        all_camps = await response.json();
        if (all_camps.length > 0) {
            updateCampDetailsAndChart(all_camps[camp_index]);
        }
    } catch (error) {
        console.error("Error fetching camps data:", error);
    }
}

// Update camp details and chart with the selected camp's data
function updateCampDetailsAndChart(camp) {
    clearNotificationInterval();
    updateCampDetailsUI(camp);
    updateReliefCampChart(camp);
    fetchAndDisplayNotifications(camp.cid);
    startNotificationRefresh(camp.cid);
}

// Clear the previous notification interval
function clearNotificationInterval() {
    if (notificationIntervalId) {
        clearInterval(notificationIntervalId);
    }
}

// Update camp details in the UI
function updateCampDetailsUI(camp) {
    document.getElementById("camp-capacity").textContent = `${camp.num_people_present}/${camp.capacity}`;
    document.getElementById("food-supply").textContent = `${camp.food_stock_quota} Meals`;
    document.getElementById("water-supply").textContent = `${camp.water_stock_litres} Litres`;
    document.getElementById("camp-location").textContent = `${camp.location}`;
}

// Update the Relief Camps Chart
function updateReliefCampChart(camp) {
    const campChart = Chart.getChart("campChart");
    if (campChart) {
        campChart.data.datasets[0].data = [camp.food_stock_quota, camp.water_stock_litres];
        campChart.update();
    }
}

// Fetch and display notifications for a specific camp
async function fetchAndDisplayNotifications(camp_id) {
    try {
        const response = await fetch(`/user/camp_notification/${camp_id}`);
        if (!response.ok) throw new Error("Failed to fetch notifications");

        const notifications = await response.json();
        const notifList = document.getElementById("notification-content");
        notifList.innerHTML = notifications.length
            ? notifications.map(n => `<li>${n.message}</li>`).join("")
            : `<li>No announcements</li>`;
    } catch (error) {
        console.error("Error fetching notifications:", error);
    }
}

// Start periodic notification refresh
function startNotificationRefresh(camp_id) {
    notificationIntervalId = setInterval(() => fetchAndDisplayNotifications(camp_id), 10000);
}

// Fetch donation summary and update the chart
async function fetchDonationSummary() {
    try {
        const response = await fetch("/user/donation-summary");
        if (!response.ok) throw new Error("Failed to fetch donation summary");

        const data = await response.json();
        const itemsDonated = data.items_donated || {}; // Expecting an object
        const amountDonated = data.amount_donated || 0;

        // Extract keys (labels) and values (data) from the object
        const labels = Object.keys(itemsDonated).map(key => 
            key.charAt(0).toUpperCase() + key.slice(1) // Capitalize first letter
        );
        const dataValues = Object.values(itemsDonated);

        // Update the donation chart
        const donationChart = Chart.getChart("myChart");
        if (donationChart) {
            donationChart.data.labels = labels;
            donationChart.data.datasets[0].data = dataValues;
            donationChart.update();
        }

        // Display total donation amount below the chart
        const totalDonationElement = document.getElementById("total-donation");
        if (totalDonationElement) {
            totalDonationElement.textContent = `Total Amount Donated: ₹${amountDonated}`;
        }
    } catch (error) {
        console.error("Error fetching donation summary:", error);
    }
}