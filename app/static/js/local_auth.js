// Typewriter Text Loop
const texts = ["Your contribution can save lives!", "Be the change!"];
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

// Start the typewriter effect on page load
document.addEventListener('DOMContentLoaded', () => {
  startTypewriter();
});

// Camp Data
const campData = {
  "Camp A": { food: 500, water: 2000, clothes: 300, essentials: 100 },
  "Camp B": { food: 800, water: 3000, clothes: 400, essentials: 150 },
  "Camp C": { food: 300, water: 1000, clothes: 200, essentials: 50 },
};

// Available Resources Chart
let availableResourcesChart;
const ctx = document.getElementById('availableResourcesChart').getContext('2d');
availableResourcesChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Food', 'Water', 'Clothes', 'Essentials'],
    datasets: [{
      label: 'Available Resources',
      data: [0, 0, 0, 0], // Initial data
      backgroundColor: ['#2575fc', '#6a11cb', '#ff6f61', '#28a745'],
    }],
  },
  options: {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  },
});

// Update Chart on Camp Click
document.querySelectorAll('#camps-list li').forEach((camp) => {
  camp.addEventListener('click', () => {
    const campName = camp.getAttribute('data-camp');
    const resources = campData[campName];
    availableResourcesChart.data.datasets[0].data = [
      resources.food,
      resources.water,
      resources.clothes,
      resources.essentials,
    ];
    availableResourcesChart.update();
  });
});


// Initialize the map
 // Initialize the OpenStreetMap using Leaflet.js
 function initMap() {
  const map = L.map('map').setView([12.9716, 77.5946], 10); // Default center (Bengaluru)

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Camp Locations
  const campLocations = [
    { name: 'Camp A', lat: 12.9716, lng: 77.5946 },
    { name: 'Camp B', lat: 12.9352, lng: 77.6245 },
    { name: 'Camp C', lat: 12.9538, lng: 77.5748 },
  ];

  // Add markers for each camp location
  campLocations.forEach((location) => {
    L.marker([location.lat, location.lng])
      .addTo(map)
      .bindPopup(location.name); // Add a popup with the camp name
  });
}

// Call the initMap function when the page loads
window.onload = initMap;

// Initialize Map
initMap();

// Submit Request to Add Warehouse
document.getElementById('submit-request').addEventListener('click', () => {
  const warehouseName = document.getElementById('warehouse-name').value;
  const warehouseLocation = document.getElementById('warehouse-location').value;

  if (warehouseName && warehouseLocation) {
    alert(`Request Submitted:\nWarehouse Name: ${warehouseName}\nLocation: ${warehouseLocation}`);
  } else {
    alert('Please fill in all fields.');
  }
});