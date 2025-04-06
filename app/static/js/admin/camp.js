document.addEventListener("DOMContentLoaded", () => {
    const campList = document.getElementById("camp-list");
    const campModal = document.getElementById("camp-modal");
    const campForm = document.getElementById("camp-form");
    const addCampBtn = document.getElementById("add-camp-btn");
    const closeModalBtn = document.querySelector(".close-btn");
    const searchNameInput = document.getElementById("search-name");
    const searchLocationInput = document.getElementById("search-location");
    const campHeadSelect = document.getElementById("camp_head");
    
    let editingCampId = null;
    let campsData = [];

    // Fetch and Render Camps
    async function fetchAndRenderCamps() {
        try {
            const response = await fetch("/admin/get_all_camps");
            if (!response.ok) throw new Error("Failed to fetch camps");
            campsData = await response.json();
            renderCamps(campsData);
        } catch (error) {
            console.error("Error fetching camps:", error);
        }
    }

    // Render Camps from Data
    function renderCamps(camps) {
        campList.innerHTML = "";
        camps.forEach((camp) => {
            const row = document.createElement("tr");
            const campHead = camp.camp_head ? camp.camp_head.username : "No Camp Head";
            row.innerHTML = `
                <td>${camp.cid}</td>
                <td>${camp.name}</td>
                <td>${camp.location}</td>
                <td>${camp.capacity}</td>
                <td>${camp.current_occupancy}</td>
                <td>${camp.food_capacity || 0}</td>
                <td>${camp.water_capacity || 0}</td>
                <td>${camp.essentials_capacity || 0}</td>
                <td>${camp.clothes_capacity || 0}</td>
                <td>${camp.status}</td>
                <td>${campHead}</td>
                <td>
                    <button class="edit-btn" data-id="${camp.cid}">Edit</button>
                    <button class="delete-btn" data-id="${camp.cid}">Delete</button>
                </td>
            `;
            campList.appendChild(row);
        });

        attachEventListeners();
    }

    // Fetch Camp Heads
    async function fetchCampHeads() {
        try {
            const response = await fetch("/admin/get_camp_managers");
            if (!response.ok) throw new Error("Failed to fetch camp managers");
            const managers = await response.json();
            
            // Clear existing options except the first one
            while (campHeadSelect.options.length > 1) {
                campHeadSelect.remove(1);
            }
            
            // Add manager options
            managers.forEach(manager => {
                const option = document.createElement("option");
                option.value = manager.uid;
                option.textContent = manager.username;
                campHeadSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching camp heads:", error);
        }
    }

    // Open Modal for Editing Camp
    async function openEditModal(campId) {
        try {
            const camp = campsData.find(c => c.cid === parseInt(campId));
            if (!camp) throw new Error("Camp not found");

            // Fetch camp heads
            await fetchCampHeads();

            document.getElementById("name").value = camp.name;
            document.getElementById("location").value = camp.location;
            document.getElementById("capacity").value = camp.capacity;
            document.getElementById("coordinates_lat").value = camp.coordinates_lat;
            document.getElementById("coordinates_lng").value = camp.coordinates_lng;
            document.getElementById("contact_number").value = camp.contact_number || "";
            document.getElementById("camp_head").value = camp.camp_head_id || "";
            
            // Set resource capacity values
            document.getElementById("food_capacity").value = camp.food_capacity || 0;
            document.getElementById("water_capacity").value = camp.water_capacity || 0;
            document.getElementById("essentials_capacity").value = camp.essentials_capacity || 0;
            document.getElementById("clothes_capacity").value = camp.clothes_capacity || 0;

            editingCampId = campId;
            campModal.style.display = "block";
        } catch (error) {
            console.error("Error fetching camp details:", error);
        }
    }

    // Open Modal for Adding New Camp
    async function openAddModal() {
        campForm.reset();
        editingCampId = null;
        
        // Fetch camp heads
        await fetchCampHeads();
        
        campModal.style.display = "block";
    }

    // Handle Form Submission
    campForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById("name").value,
            location: document.getElementById("location").value,
            capacity: parseInt(document.getElementById("capacity").value),
            coordinates_lat: parseFloat(document.getElementById("coordinates_lat").value),
            coordinates_lng: parseFloat(document.getElementById("coordinates_lng").value),
            contact_number: document.getElementById("contact_number").value,
            food_capacity: parseInt(document.getElementById("food_capacity").value),
            water_capacity: parseInt(document.getElementById("water_capacity").value),
            essentials_capacity: parseInt(document.getElementById("essentials_capacity").value),
            clothes_capacity: parseInt(document.getElementById("clothes_capacity").value),
            camp_head_id: document.getElementById("camp_head").value ? parseInt(document.getElementById("camp_head").value) : null
        };

        try {
            const url = editingCampId 
                ? `/admin/update_camp/${editingCampId}` 
                : "/admin/add_camp";
            
            const method = editingCampId ? "PUT" : "POST";
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save camp");
            }

            // Close modal and refresh list
            campModal.style.display = "none";
            fetchAndRenderCamps();
            
            // Show success message
            alert(editingCampId ? "Camp updated successfully" : "Camp added successfully");
        } catch (error) {
            console.error("Error saving camp:", error);
            alert("Error: " + error.message);
        }
    });

    // Delete Camp
    async function deleteCamp(campId) {
        if (!confirm("Are you sure you want to delete this camp?")) {
            return;
        }

        try {
            const response = await fetch(`/admin/delete_camp/${campId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete camp");
            }

            fetchAndRenderCamps();
            alert("Camp deleted successfully");
        } catch (error) {
            console.error("Error deleting camp:", error);
            alert("Error: " + error.message);
        }
    }

    // Attach Event Listeners
    function attachEventListeners() {
        // Edit buttons
        document.querySelectorAll(".edit-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const campId = parseInt(btn.getAttribute("data-id"));
                openEditModal(campId);
            });
        });

        // Delete buttons
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const campId = parseInt(btn.getAttribute("data-id"));
                deleteCamp(campId);
            });
        });
    }

    // Filter Camps by Name
    function filterByName() {
        const query = searchNameInput.value.toLowerCase().trim();
        const filteredCamps = campsData.filter(camp =>
            camp.name.toLowerCase().includes(query)
        );
        renderCamps(filteredCamps);
    }

    // Filter Camps by Location
    function filterByLocation() {
        const query = searchLocationInput.value.toLowerCase().trim();
        const filteredCamps = campsData.filter(camp =>
            camp.location.toLowerCase().includes(query)
        );
        renderCamps(filteredCamps);
    }

    // Close Modal Button
    closeModalBtn.addEventListener("click", () => {
        campModal.style.display = "none";
    });

    // Open Add Camp Modal on Button Click
    addCampBtn.addEventListener("click", openAddModal);

    // Close Modal if clicked outside content
    window.addEventListener("click", (e) => {
        if (e.target === campModal) {
            campModal.style.display = "none";
        }
    });

    // Attach Filter Event Listeners
    searchNameInput.addEventListener("input", filterByName);
    searchLocationInput.addEventListener("input", filterByLocation);

    // Initial load of camps
    fetchAndRenderCamps();
}); 