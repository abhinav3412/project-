document.addEventListener("DOMContentLoaded", () => {
    const campTableBody = document.getElementById("camp-table-body");
    const addCampBtn = document.getElementById("add-camp-btn");
    const modal = document.getElementById("camp-modal");
    const closeModal = document.querySelector(".close");
    const campForm = document.getElementById("camp-form");
    const modalTitle = document.getElementById("modal-title");

    let editingCampId = null;

    // Fetch and Render Camps
    async function fetchAndRenderCamps(filter = "") {
        try {
            const response = await fetch('/admin/get_all_camps');
            if (!response.ok) throw new Error("Failed to fetch camps");
            const camps = await response.json();

            campTableBody.innerHTML = "";

            camps
                .filter(camp => camp.cid.toString().includes(filter)) // Filtering logic
                .forEach((camp) => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${camp.cid}</td>
                        <td>${camp.camp_name}</td>
                        <td>${camp.capacity}</td>
                        <td>${camp.location}</td>
                        <td>${camp.coordinates.lat}, ${camp.coordinates.lng}</td>
                        <td>${camp.contact_number || "N/A"}</td>
                        <td>${camp.status}</td>
                        <td>
                            <button class="edit-btn" data-id="${camp.cid}">Edit</button>
                            <button class="delete-btn" data-id="${camp.cid}">Delete</button>
                        </td>
                    `;
                    campTableBody.appendChild(row);
                });

            attachEditListeners();
            attachDeleteListeners();
        } catch (error) {
            console.error("Error fetching camps:", error);
        }
    }

    // Attach Event Listeners for Edit Buttons
    function attachEditListeners() {
        document.querySelectorAll(".edit-btn").forEach(button => {
            button.addEventListener("click", (e) => {
                const campId = e.target.dataset.id;
                openModalForEdit(campId);
            });
        });
    }

    // Attach Event Listeners for Delete Buttons
    function attachDeleteListeners() {
        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", (e) => {
                const campId = e.target.dataset.id;
                deleteCamp(campId);
            });
        });
    }

    // Open Modal for Adding a New Camp
    function openModalForCreate() {
        modalTitle.textContent = "Add New Camp";
        campForm.reset();
        editingCampId = null;
        modal.style.display = "flex";
    }

    // Open Modal for Editing an Existing Camp
    async function openModalForEdit(campId) {
        try {
            const response = await fetch(`/admin/get_camp_data/${campId}`);
            if (!response.ok) throw new Error("Failed to fetch camp details");
            const camp = await response.json();

            modalTitle.textContent = "Edit Camp";
            document.getElementById("camp-name").value = camp.camp_name;
            document.getElementById("camp-capacity").value = camp.capacity;
            document.getElementById("location").value = camp.location;
            document.getElementById("coordinates").value = `${camp.coordinates.lat}, ${camp.coordinates.lng}`;
            document.getElementById("phone").value = camp.contact_number || "";

            editingCampId = camp.cid;
            modal.style.display = "flex";
        } catch (error) {
            console.error("Error fetching camp details:", error);
        }
    }

    // Close Modal
    closeModal.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

    // Handle Form Submission (Create or Edit)
    campForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Get values from form inputs
        let coordinatesInput = document.getElementById("coordinates").value.trim();
        let [lat, lng] = coordinatesInput.split(",").map(coord => coord.trim());

        // Convert to float if possible
        lat = parseFloat(lat);
        lng = parseFloat(lng);

        if (isNaN(lat) || isNaN(lng)) {
            alert("Invalid coordinates. Please enter in 'lat, lng' format.");
            return;
        }

        let formData = {
            camp_name: document.getElementById("camp-name").value.trim(),
            camp_capacity: parseInt(document.getElementById("camp-capacity").value.trim()),
            location: document.getElementById("location").value.trim(),
            lat: lat,
            lng: lng,
            contact_number: document.getElementById("phone").value.trim()
        };

        try {
            if (editingCampId) {
                // If `editingCampId` is set, update the existing camp
                await updateCamp(editingCampId, formData);
                fetchAndRenderCamps();
                document.getElementById('camp-modal').style.display = "none";
            } else {
                // Otherwise, create a new camp
                await createCamp(formData);
                fetchAndRenderCamps();
                document.getElementById('camp-modal').style.display = "none";
            }
        } catch (error) {
            alert("Error creating camp: " + error.message);
        }
    });

    // Create a New Camp
    async function createCamp(formData) {
        try {
            // Convert array to string if it's an array
            if (Array.isArray(formData.coordinates)) {
                formData.coordinates = formData.coordinates.join(", "); // Convert to "lat, lng"
}
            const response = await fetch("/admin/create_camp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error("Failed to create camp");
        } catch (error) {
            console.error("Error creating camp:", error);
            throw error;
        }
    }

    // Update an Existing Camp
    async function updateCamp(campId, formData) {
        try {
            const response = await fetch(`/admin/update_camp_data/${campId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error("Failed to update camp");
        } catch (error) {
            console.error("Error updating camp:", error);
            throw error;
        }
    }

    // Delete a Camp
    async function deleteCamp(campId) {
        if (!confirm("Are you sure you want to delete this camp?")) return;

        try {
            const response = await fetch(`/admin/delete-camp/${campId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete camp");
            fetchAndRenderCamps();
        } catch (error) {
            console.error("Error deleting camp:", error);
        }
    }

    // Filter Camps
    document.getElementById("camp-id-filter").addEventListener("input", (e) => {
        const filter = e.target.value.toLowerCase();
        fetchAndRenderCamps(filter);
    });

    document.getElementById("clear-search").addEventListener("click", () => {
        document.getElementById("camp-id-filter").value = "";
        fetchAndRenderCamps();
    });

    // Initial Render
    fetchAndRenderCamps();

    // Add Camp Button
    addCampBtn.addEventListener("click", () => {
        openModalForCreate();
    });
});