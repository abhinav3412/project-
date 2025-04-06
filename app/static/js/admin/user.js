document.addEventListener("DOMContentLoaded", () => {
    const userList = document.getElementById("user-list");
    const userModal = document.getElementById("user-modal");
    const closeModalBtn = document.querySelector(".close-btn");
    const userForm = document.getElementById("user-form");
    const addUserBtn = document.getElementById("add-user-btn");
    const roleSelect = document.getElementById("role");
    
    const searchNameInput = document.getElementById("name-filter"); // Name filter input
    const searchLocationInput = document.getElementById("location-filter"); // Location filter input

    let editingUserId = null;
    let usersData = []; // Store all users for filtering

    // Fetch and Render Users
    async function fetchAndRenderUsers() {
        try {
            const response = await fetch("/admin/get_all_users");
            if (!response.ok) throw new Error("Failed to fetch users");
            usersData = await response.json(); // Store data for filtering
            renderUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    }

    // Render Users from Data
    function renderUsers(users) {
        userList.innerHTML = "";
        users.forEach((user) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${user.uid}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.location || "N/A"}</td>
                <td>${user.mobile || "N/A"}</td>
                <td>${user.role}</td>
                <td>
                    <button class="edit-btn" data-id="${user.uid}">Edit</button>
                    <button class="delete-btn" data-id="${user.uid}">Delete</button>
                </td>
            `;
            userList.appendChild(row);
        });

        attachEventListeners();
    }

    // Attach Event Listeners to Buttons
    function attachEventListeners() {
        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", (e) => {
                deleteUser(e.target.dataset.id);
            });
        });

        document.querySelectorAll(".edit-btn").forEach(button => {
            button.addEventListener("click", (e) => {
                openEditModal(e.target.dataset.id);
            });
        });
    }

    // Filter Users by Name
    function filterByName() {
        const query = searchNameInput.value.toLowerCase().trim();
        const filteredUsers = usersData.filter(user =>
            user.username.toLowerCase().includes(query)
        );
        renderUsers(filteredUsers);
    }

    // Filter Users by Location
    function filterByLocation() {
        const query = searchLocationInput.value.toLowerCase().trim();
        const filteredUsers = usersData.filter(user =>
            user.location && user.location.toLowerCase().includes(query)
        );
        renderUsers(filteredUsers);
    }

    // Delete User Function
    async function deleteUser(userId) {
        if (!confirm("Are you sure you want to delete this user?")) return;

        try {
            const response = await fetch(`/admin/delete_user/${userId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete user");
            fetchAndRenderUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    }

    // Open Modal for Editing User
    async function openEditModal(userId) {
        try {
            const response = await fetch(`/admin/get_user/${userId}`);
            if (!response.ok) throw new Error("Failed to fetch user data");

            const user = await response.json();

            document.getElementById("username").value = user.username;
            document.getElementById("password").value = 'aaa';
            document.getElementById("email").value = user.email;
            document.getElementById("location").value = user.location || "";
            document.getElementById("role").value = user.role;
            document.getElementById("associated-camp-id").value = user.associated_camp_id || "";

            editingUserId = userId;
            userModal.style.display = "block";
        } catch (error) {
            console.error("Error fetching user details:", error);
        }
    }

    // Open Modal for Adding New User
    function openAddModal() {
        userForm.reset();
        editingUserId = null;
        userModal.style.display = "block";
    }

    // Handle Form Submission (Add or Edit User)
    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        let userData = {
            username: document.getElementById("username").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value.trim(),
            location: document.getElementById("location").value.trim(),
            role: document.getElementById("role").value,
            associated_camp_id: document.getElementById("associated-camp-id").value.trim()
        };

        if (editingUserId) {
            Object.keys(userData).forEach((key) => {
                if (userData[key] === "" || userData[key] === null) {
                    delete userData[key];
                }
            });
        } else {
            if (!userData.username || !userData.email || !userData.password) {
                alert("Please fill in all required fields");
                return;
            }
        }

        try {
            const url = editingUserId
                ? `/admin/update_user/${editingUserId}`
                : "/admin/add_user";
            const method = editingUserId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save user");
            }

            userModal.style.display = "none";
            fetchAndRenderUsers();
        } catch (error) {
            console.error("Error saving user:", error);
            alert(error.message);
        }
    });

    // Close Modal Button
    closeModalBtn.addEventListener("click", () => {
        userModal.style.display = "none";
    });

    // Open Add User Modal on Button Click
    addUserBtn.addEventListener("click", openAddModal);

    // Close Modal if clicked outside content
    window.addEventListener("click", (e) => {
        if (e.target === userModal) {
            userModal.style.display = "none";
        }
    });

    // Attach Filter Event Listeners
    searchNameInput.addEventListener("input", filterByName);
    searchLocationInput.addEventListener("input", filterByLocation);
    document.getElementById("clear-filters").addEventListener("click", () => {
        searchNameInput.value = "";
        searchLocationInput.value = "";
        renderUsers(usersData);
    });

    // Initial load of users
    fetchAndRenderUsers();
});
