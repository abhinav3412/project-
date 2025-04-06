document.addEventListener("DOMContentLoaded", () => {
    // Get DOM elements
    const warehouseList = document.getElementById("warehouse-list");
    const warehouseModal = document.getElementById("warehouse-modal");
    const closeModalBtn = document.querySelector(".close-btn");
    const warehouseForm = document.getElementById("warehouse-form");
    const addWarehouseBtn = document.getElementById("add-warehouse-btn");
    const searchNameInput = document.getElementById("name-filter");
    const searchLocationInput = document.getElementById("location-filter");
    const clearFiltersBtn = document.getElementById("clear-filters");
    const managerSelect = document.getElementById("manager_id");

    let editingWarehouseId = null;
    let warehousesData = [];

    // Fetch and Render Warehouses
    async function fetchAndRenderWarehouses() {
        try {
            const response = await fetch("/admin/get_all_warehouses");
            if (!response.ok) throw new Error("Failed to fetch warehouses");
            warehousesData = await response.json();
            renderWarehouses(warehousesData);
        } catch (error) {
            console.error("Error fetching warehouses:", error);
        }
    }

    // Fetch Warehouse Managers
    async function fetchWarehouseManagers() {
        try {
            const response = await fetch("/admin/get_warehouse_managers");
            if (!response.ok) throw new Error("Failed to fetch warehouse managers");
            const managers = await response.json();
            
            // Clear existing options except the first one
            while (managerSelect.options.length > 1) {
                managerSelect.remove(1);
            }
            
            // Add manager options
            managers.forEach(manager => {
                const option = document.createElement("option");
                option.value = manager.uid;
                option.textContent = manager.username;
                managerSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching warehouse managers:", error);
        }
    }

    // Render Warehouses from Data
    function renderWarehouses(warehouses) {
        warehouseList.innerHTML = "";
        warehouses.forEach((warehouse) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${warehouse.wid}</td>
                <td>${warehouse.name}</td>
                <td>${warehouse.location}</td>
                <td>${warehouse.coordinates_lat}, ${warehouse.coordinates_lng}</td>
                <td>${warehouse.food_capacity}</td>
                <td>${warehouse.water_capacity}</td>
                <td>${warehouse.essential_capacity}</td>
                <td>${warehouse.clothes_capacity}</td>
                <td>${warehouse.manager_name || "No Manager"}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(warehouse.status)}">
                        ${warehouse.status}
                    </span>
                </td>
                <td>${warehouse.created_at}</td>
                <td>
                    <button class="edit-btn" data-id="${warehouse.wid}">Edit</button>
                    <button class="delete-btn" data-id="${warehouse.wid}">Delete</button>
                </td>
            `;
            warehouseList.appendChild(row);
        });

        attachEventListeners();
    }

    // Get Status Badge Class
    function getStatusBadgeClass(status) {
        switch (status) {
            case "Operational":
                return "bg-success";
            case "Maintenance":
                return "bg-warning";
            case "Closed":
                return "bg-danger";
            default:
                return "bg-secondary";
        }
    }

    // Attach Event Listeners to Buttons
    function attachEventListeners() {
        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", (e) => {
                deleteWarehouse(e.target.dataset.id);
            });
        });

        document.querySelectorAll(".edit-btn").forEach(button => {
            button.addEventListener("click", (e) => {
                openEditModal(e.target.dataset.id);
            });
        });
    }

    // Filter Warehouses by Name
    function filterByName() {
        const query = searchNameInput.value.toLowerCase().trim();
        const filteredWarehouses = warehousesData.filter(warehouse =>
            warehouse.name.toLowerCase().includes(query)
        );
        renderWarehouses(filteredWarehouses);
    }

    // Filter Warehouses by Location
    function filterByLocation() {
        const query = searchLocationInput.value.toLowerCase().trim();
        const filteredWarehouses = warehousesData.filter(warehouse =>
            warehouse.location.toLowerCase().includes(query)
        );
        renderWarehouses(filteredWarehouses);
    }

    // Clear Filters
    function clearFilters() {
        searchNameInput.value = "";
        searchLocationInput.value = "";
        renderWarehouses(warehousesData);
    }

    // Delete Warehouse Function
    async function deleteWarehouse(warehouseId) {
        if (!confirm("Are you sure you want to delete this warehouse?")) return;

        try {
            const response = await fetch(`/admin/delete_warehouse/${warehouseId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete warehouse");
            fetchAndRenderWarehouses();
        } catch (error) {
            console.error("Error deleting warehouse:", error);
        }
    }

    // Open Modal for Editing Warehouse
    async function openEditModal(warehouseId) {
        try {
            const warehouse = warehousesData.find(w => w.wid === parseInt(warehouseId));
            if (!warehouse) throw new Error("Warehouse not found");

            // Fetch warehouse managers
            await fetchWarehouseManagers();

            document.getElementById("name").value = warehouse.name;
            document.getElementById("location").value = warehouse.location;
            document.getElementById("latitude").value = warehouse.coordinates_lat;
            document.getElementById("longitude").value = warehouse.coordinates_lng;
            document.getElementById("food_capacity").value = warehouse.food_capacity;
            document.getElementById("water_capacity").value = warehouse.water_capacity;
            document.getElementById("essential_capacity").value = warehouse.essential_capacity;
            document.getElementById("clothes_capacity").value = warehouse.clothes_capacity;
            document.getElementById("status").value = warehouse.status;
            document.getElementById("manager_id").value = warehouse.manager_id || "";

            editingWarehouseId = warehouseId;
            warehouseModal.style.display = "block";
        } catch (error) {
            console.error("Error fetching warehouse details:", error);
        }
    }

    // Open Modal for Adding New Warehouse
    async function openAddModal() {
        warehouseForm.reset();
        editingWarehouseId = null;
        
        // Fetch warehouse managers
        await fetchWarehouseManagers();
        
        warehouseModal.style.display = "block";
    }

    // Handle Form Submission (Add or Edit Warehouse)
    warehouseForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const warehouseData = {
            name: document.getElementById("name").value.trim(),
            location: document.getElementById("location").value.trim(),
            coordinates_lat: parseFloat(document.getElementById("latitude").value),
            coordinates_lng: parseFloat(document.getElementById("longitude").value),
            food_capacity: parseInt(document.getElementById("food_capacity").value),
            water_capacity: parseInt(document.getElementById("water_capacity").value),
            essential_capacity: parseInt(document.getElementById("essential_capacity").value),
            clothes_capacity: parseInt(document.getElementById("clothes_capacity").value),
            status: document.getElementById("status").value
        };

        // Add manager_id if selected
        const managerId = document.getElementById("manager_id").value;
        if (managerId) {
            warehouseData.manager_id = parseInt(managerId);
        }

        try {
            const url = editingWarehouseId
                ? `/admin/update_warehouse/${editingWarehouseId}`
                : "/admin/create_warehouse";
            const method = editingWarehouseId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(warehouseData),
            });

            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.error || "Failed to save warehouse");
            }

            // Show success message
            alert(editingWarehouseId ? "Warehouse updated successfully" : "Warehouse created successfully");
            
            // Close modal and refresh list
            warehouseModal.style.display = "none";
            fetchAndRenderWarehouses();
        } catch (error) {
            console.error("Error saving warehouse:", error);
            alert("Error: " + error.message);
        }
    });

    // Close Modal Button
    closeModalBtn.addEventListener("click", () => {
        warehouseModal.style.display = "none";
    });

    // Open Add Warehouse Modal on Button Click
    addWarehouseBtn.addEventListener("click", openAddModal);

    // Close Modal if clicked outside content
    window.addEventListener("click", (e) => {
        if (e.target === warehouseModal) {
            warehouseModal.style.display = "none";
        }
    });

    // Attach Filter Event Listeners
    searchNameInput.addEventListener("input", filterByName);
    searchLocationInput.addEventListener("input", filterByLocation);
    clearFiltersBtn.addEventListener("click", clearFilters);

    // Initial load of warehouses
    fetchAndRenderWarehouses();
}); 