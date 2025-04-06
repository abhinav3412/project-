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
    document.querySelector(".refresh-btn").addEventListener("click", refreshWeather);
}

// Handle the "Next Camp" button click
function handleNextCampClick() {
    camp_index = (camp_index + 1) % all_camps.length;
    updateCampDetailsAndChart(all_camps[camp_index]);
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
    document.getElementById("camp-capacity").textContent = `${camp.current_occupancy || 0} / ${camp.capacity || 30}`;
    document.getElementById("food-supply").textContent = `${camp.food_capacity || 0} kg`;
    document.getElementById("water-supply").textContent = `${camp.water_capacity || 0} liters`;
    document.getElementById("camp-location").textContent = `${camp.location || 'N/A'}`;
}

// Update the Relief Camps Chart
function updateReliefCampChart(camp) {
    const campChart = Chart.getChart("campChart");
    if (campChart) {
        campChart.data.datasets[0].data = [camp.food_capacity || 0, camp.water_capacity || 0];
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

// Chatbot functionality
document.addEventListener('DOMContentLoaded', function() {
    const chatbotIcon = document.getElementById('chatbot-icon');
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const quickReplies = document.getElementById('quick-replies');

    // Quick reply options
    const quickReplyOptions = [
        "Check Alerts",
        "Safety Guidelines",
        "Donate",
        "Volunteer",
        "Weather Info",
        "Relief Camps",
        "Emergency Contacts"
    ];

    // Emergency contact information
    const emergencyContacts = {
        "National Emergency": "112",
        "Police": "100",
        "Fire": "101",
        "Ambulance": "108",
        "Disaster Management": "1070",
        "Landslide Helpline": "1800-XXX-XXXX",
        "Rescue Operations": "1800-XXX-XXXX"
    };

    // Conversation context
    let conversationContext = {
        lastTopic: null,
        userPreferences: {},
        previousMessages: []
    };

    // Toggle chatbot visibility
    chatbotIcon.addEventListener('click', () => {
        chatbotContainer.classList.add('active');
        if (chatbotMessages.children.length === 0) {
            showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addMessage("Hello! I'm your Assistant. How can I help you today?", 'bot');
                showQuickReplies();
            }, 1500);
        }
    });

    chatbotClose.addEventListener('click', () => {
        chatbotContainer.classList.remove('active');
        hideQuickReplies();
    });

    // Handle message sending
    function sendMessage() {
        const message = chatbotInput.value.trim();
        if (message) {
            addMessage(message, 'user');
            chatbotInput.value = '';
            hideQuickReplies();
            processMessage(message);
        }
    }

    chatbotSend.addEventListener('click', sendMessage);
    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add message to chat with animation
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        // Process text for special formatting
        if (sender === 'bot') {
            text = formatBotMessage(text);
        }
        
        messageDiv.innerHTML = text;
        chatbotMessages.appendChild(messageDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Format bot messages with special elements
    function formatBotMessage(text) {
        // Convert URLs to clickable links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" class="message-link" target="_blank">$1</a>');
        
        // Convert lists
        text = text.replace(/\n- (.*?)(?=\n|$)/g, '<ul class="message-list"><li>$1</li></ul>');
        
        // Convert code blocks
        text = text.replace(/`(.*?)`/g, '<code class="message-code">$1</code>');
        
        return text;
    }

    // Show typing indicator
    function showTypingIndicator() {
        typingIndicator.style.display = 'block';
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Hide typing indicator
    function hideTypingIndicator() {
        typingIndicator.style.display = 'none';
    }

    // Show quick reply buttons
    function showQuickReplies() {
        quickReplies.innerHTML = quickReplyOptions
            .map(option => `<button class="quick-reply-btn">${option}</button>`)
            .join('');
        
        // Add click handlers to quick reply buttons
        quickReplies.querySelectorAll('.quick-reply-btn').forEach(button => {
            button.addEventListener('click', () => {
                const message = button.textContent;
                addMessage(message, 'user');
                hideQuickReplies();
                processMessage(message);
            });
        });
    }

    // Hide quick reply buttons
    function hideQuickReplies() {
        quickReplies.innerHTML = '';
    }

    // Process user message and generate response
    async function processMessage(message) {
        showTypingIndicator();
        
        // Update conversation context
        conversationContext.previousMessages.push(message);
        if (conversationContext.previousMessages.length > 5) {
            conversationContext.previousMessages.shift();
        }

        try {
            // Analyze message intent and generate response
            const response = await generateResponse(message);
            
            // Simulate typing delay
            setTimeout(() => {
                hideTypingIndicator();
                addMessage(response, 'bot');
                showQuickReplies();
            }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
        } catch (error) {
            console.error('Error processing message:', error);
            hideTypingIndicator();
            addMessage("I apologize, but I encountered an error while processing your request. Please try again or check the specific section directly.", 'bot');
            showQuickReplies();
        }
    }

    // Generate response based on message analysis
    async function generateResponse(message) {
        const lowerMessage = message.toLowerCase();
        let response = '';

        // Check for greetings
        if (lowerMessage.match(/^(hi|hello|hey|greetings)/i)) {
            return "Hello! I'm here to help you with landslide detection and safety information. What would you like to know?";
        }

        // Check for emergency contact queries
        if (lowerMessage.match(/emergency|contact|helpline|phone|number|rescue|help/i)) {
            return formatEmergencyContacts();
        }

        // Check for weather-related queries
        if (lowerMessage.match(/weather|rain|storm|precipitation/i)) {
            const weatherInfo = getCurrentWeatherInfo();
            return `Current weather conditions in ${weatherInfo.location}:\n- Temperature: ${weatherInfo.temperature}\n- Condition: ${weatherInfo.condition}\n- Humidity: ${weatherInfo.humidity}\n\nThis information is crucial for landslide risk assessment. Would you like to know more about weather's impact on landslide risks?\n\nFor emergency assistance, please call:\n- National Emergency: 112\n- Disaster Management: 1070`;
        }

        // Check for alert-related queries
        if (lowerMessage.match(/alert|warning|danger|risk/i)) {
            const alertResponse = await fetchAndFormatAlerts();
            return `${alertResponse}\n\nFor emergency assistance, please call:\n- National Emergency: 112\n- Disaster Management: 1070`;
        }

        // Check for safety-related queries
        if (lowerMessage.match(/safety|prevent|protect|guide/i)) {
            return "For comprehensive safety guidelines, visit our Guide section. Key topics include:\n- Emergency preparedness\n- Evacuation procedures\n- Risk assessment\n- Safety protocols\n\nWould you like specific information about any of these topics?\n\nFor emergency assistance, please call:\n- National Emergency: 112\n- Disaster Management: 1070";
        }

        // Check for donation-related queries
        if (lowerMessage.match(/donate|help|support|contribute/i)) {
            return await fetchAndFormatDonations();
        }

        // Check for volunteer-related queries
        if (lowerMessage.match(/volunteer|help|assist|join/i)) {
            return "Interested in volunteering? We have various roles available:\n- Rescue operations\n- Relief camp management\n- Medical assistance\n- Community support\n\nCheck out our Volunteer section to find the right role for you!\n\nFor emergency assistance, please call:\n- National Emergency: 112\n- Disaster Management: 1070";
        }

        // Check for relief camp queries
        if (lowerMessage.match(/camp|relief|shelter|refuge/i)) {
            const campResponse = await fetchAndFormatReliefCamps();
            return `${campResponse}\n\nFor emergency assistance, please call:\n- National Emergency: 112\n- Disaster Management: 1070`;
        }

        // Check for gratitude
        if (lowerMessage.match(/thank|thanks|appreciate/i)) {
            return "You're welcome! Is there anything else you'd like to know about landslide detection or safety measures?";
        }

        // Default response with suggestions
        return "I'm here to help! You can ask me about:\n- Real-time alerts and warnings\n- Safety guidelines and prevention\n- Donation opportunities\n- Volunteering options\n- Weather conditions\n- Relief camp information\n- Emergency contacts\n\nWhat would you like to know?";
    }

    // Format emergency contacts
    function formatEmergencyContacts() {
        let contactMessage = "Emergency Contact Numbers:\n\n";
        Object.entries(emergencyContacts).forEach(([service, number]) => {
            contactMessage += `- ${service}: ${number}\n`;
        });
        contactMessage += "\nFor immediate assistance, please call the National Emergency number: 112";
        return contactMessage;
    }

    // Fetch and format alerts
    async function fetchAndFormatAlerts() {
        try {
            const response = await fetch('/user/get_alerts');
            if (!response.ok) throw new Error('Failed to fetch alerts');
            const alerts = await response.json();
            
            if (alerts.length === 0) {
                return "Currently, there are no active alerts. The system is monitoring landslide-prone areas continuously.";
            }

            let alertMessage = "Current Alerts:\n";
            alerts.forEach(alert => {
                alertMessage += `- ${alert.message}\n  Location: ${alert.location}\n  Time: ${alert.timestamp}\n\n`;
            });
            alertMessage += "Would you like more details about any specific alert?";
            return alertMessage;
        } catch (error) {
            console.error('Error fetching alerts:', error);
            return "I'm having trouble fetching the alerts right now. Please check the Alerts section directly.";
        }
    }

    // Fetch and format donations
    async function fetchAndFormatDonations() {
        try {
            const response = await fetch('/user/donation-summary');
            if (!response.ok) throw new Error('Failed to fetch donation summary');
            const data = await response.json();
            
            const itemsDonated = data.items_donated || {};
            const amountDonated = data.amount_donated || 0;

            let donationMessage = `Current Donation Status:\n- Total Amount: ₹${amountDonated}\n\nItems Donated:\n`;
            Object.entries(itemsDonated).forEach(([item, count]) => {
                donationMessage += `- ${item.charAt(0).toUpperCase() + item.slice(1)}: ${count}\n`;
            });
            donationMessage += "\nWould you like to make a donation?";
            return donationMessage;
        } catch (error) {
            console.error('Error fetching donation summary:', error);
            return "I'm having trouble fetching the donation information right now. Please check the Donations section directly.";
        }
    }

    // Fetch and format relief camps
    async function fetchAndFormatReliefCamps() {
        try {
            const response = await fetch('/user/list_all_camps');
            if (!response.ok) throw new Error('Failed to fetch relief camps');
            const camps = await response.json();
            
            if (camps.length === 0) {
                return "Currently, there are no active relief camps.";
            }

            const currentCamp = camps[camp_index];
            let campMessage = `Current Relief Camp Information:\n`;
            campMessage += `- Location: ${currentCamp.location}\n`;
            campMessage += `- Capacity: ${currentCamp.num_people_present}/${currentCamp.capacity} people\n`;
            campMessage += `- Food Supply: ${currentCamp.food_stock_quota} meals\n`;
            campMessage += `- Water Supply: ${currentCamp.water_stock_litres} litres\n\n`;
            campMessage += "Would you like to see information about other relief camps?";
            return campMessage;
        } catch (error) {
            console.error('Error fetching relief camps:', error);
            return "I'm having trouble fetching the relief camp information right now. Please check the Relief Camps section directly.";
        }
    }

    // Get current weather information
    function getCurrentWeatherInfo() {
        const location = document.getElementById('location')?.textContent || 'Location not available';
        const temperature = document.getElementById('weather')?.textContent || 'N/A';
        const condition = document.getElementById('condition')?.textContent || 'N/A';
        const humidity = document.getElementById('humidity')?.textContent || 'N/A';

        return {
            location,
            temperature,
            condition,
            humidity
        };
    }
});

// Function to add people to the camp
async function addPeopleToCamp(campId) {
    try {
        // Add two people to the camp
        const people = [
            { name: "Person 1", phone: "1234567890" },
            { name: "Person 2", phone: "0987654321" }
        ];

        for (const person of people) {
            const response = await fetch('/camp_manager/add_person', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(person)
            });

            if (!response.ok) {
                throw new Error('Failed to add person to camp');
            }
        }

        // Refresh camp data after adding people
        await fetchAllCampsData();
    } catch (error) {
        console.error('Error adding people to camp:', error);
    }
}

// Call addPeopleToCamp when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    fetchAllCampsData().then(() => {
        if (all_camps.length > 0) {
            addPeopleToCamp(all_camps[0].cid);
        }
    });
});