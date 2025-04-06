document.addEventListener("DOMContentLoaded", function () {
  fetchCampDetails();
  fetchCampList();
});

// Store the chart instance to prevent duplication
let availableResourcesChartInstance = null;

// Function to fetch and update camp details
async function fetchCampDetails() {
  try {
    const response = await fetch('/camp_manager/get_camp_details');
    if (!response.ok) {
      throw new Error('Failed to fetch camp details');
    }

    const data = await response.json();
    if (!data) return;

    const {
      camp_name,
      num_people_present = 0,
      capacity = 0,
      food_stock_quota = 0,
      water_stock_litres = 0,
      clothes_stock = 0,
      essentials_stock = 0,
      coordinates = { lat: 12.9716, lng: 77.5946 } // Default to Bangalore
    } = data;

    // ✅ Update Available Resources Chart
    const ctx = document.getElementById('availableResourcesChart');
    if (ctx) {
      const ctxContext = ctx.getContext('2d');

      // ✅ Destroy existing chart before creating a new one
      if (availableResourcesChartInstance) {
        availableResourcesChartInstance.destroy();
      }

      // ✅ Create a new chart and store the reference
      availableResourcesChartInstance = new Chart(ctxContext, {
        type: 'bar',
        data: {
          labels: ['Food', 'Water', 'Clothes', 'Essentials'],
          datasets: [{
            label: 'Available Resources',
            data: [food_stock_quota, water_stock_litres, clothes_stock, essentials_stock],
            backgroundColor: ['#2575fc', '#6a11cb', '#ff6f61', '#28a745'],
          }],
        },
        options: { scales: { y: { beginAtZero: true } } },
      });
    }

    // ✅ Initialize and Update Map
    const mapContainer = document.getElementById("map");
    if (mapContainer) {
      mapContainer.innerHTML = ""; // Clear previous map instance

      const map = L.map("map").setView([coordinates.lat, coordinates.lng], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add marker for this camp
      L.marker([coordinates.lat, coordinates.lng])
        .addTo(map)
        .bindPopup(`${camp_name}: ${num_people_present}/${capacity}`);
    }

  } catch (error) {
    console.error("Error fetching camp details:", error);
  }
}

// ✅ Function to fetch and update camp list from local_auth/get_camp_details
async function fetchCampList() {
  try {
    const response = await fetch('/local_auth/get_camp_list');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid data format: Expected an array");

    // Get the <ul> element
    const campsList = document.getElementById('camps-list');
    if (!campsList) return;

    // Clear existing list
    campsList.innerHTML = '';

    // Loop through the camp list and create <li> elements
    data.forEach(camp => {
      const { camp_name, num_people_present, capacity } = camp;

      const listItem = document.createElement('li');
      listItem.setAttribute('data-camp', camp_name);
      listItem.innerHTML = `<strong>${camp_name}:</strong> ${num_people_present}/${capacity}`;

      campsList.appendChild(listItem);
    });

  } catch (error) {
    console.error("Error fetching camp list:", error);
  }
}

// ✅ Submit Request to Add Warehouse
document.addEventListener('click', function (event) {
  if (event.target.id === 'submit-request') {
    const warehouseName = document.getElementById('warehouse-name')?.value;
    const warehouseLocation = document.getElementById('warehouse-location')?.value;

    if (warehouseName && warehouseLocation) {
      alert(`Request Submitted:\nWarehouse Name: ${warehouseName}\nLocation: ${warehouseLocation}`);
    } else {
      alert('Please fill in all fields.');
    }
  }
});
