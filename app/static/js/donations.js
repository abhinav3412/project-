// Utility function to show/hide elements
function toggleDisplay(element, displayStyle) {
    element.style.display = displayStyle;
}

// Initialize event listeners for essential form popup
function initEssentialFormPopup() {
    const essentialBtn = document.getElementById('essential-btn');
    const essentialFormPopup = document.getElementById('essential-form-popup');
    const closeBtn = document.querySelector('.close-btn');

    essentialBtn.addEventListener('click', () => toggleDisplay(essentialFormPopup, 'flex'));
    closeBtn.addEventListener('click', () => toggleDisplay(essentialFormPopup, 'none'));

    window.addEventListener('click', (event) => {
        if (event.target === essentialFormPopup) {
            toggleDisplay(essentialFormPopup, 'none');
        }
    });
}

// Add a new item group dynamically
function addItemGroup() {
    const container = document.getElementById('items-container');
    const newItemGroup = document.createElement('div');
    newItemGroup.classList.add('item-group');

    newItemGroup.innerHTML = `
        <label for="item">Item:</label>
        <input type="text" class="item-name" name="item[]" required>

        <label for="quantity">Quantity:</label>
        <input type="number" class="item-quantity" name="quantity[]" min="1" required>

        <label for="condition">Condition:</label>
        <select class="item-condition" name="condition[]">
            <option value="new">New</option>
            <option value="used">Used (Good)</option>
            <option value="used-fair">Used (Fair)</option>
        </select>

        <button type="button" class="remove-item-btn">Remove Item</button>
    `;

    container.appendChild(newItemGroup);
}

// Initialize event listeners for adding/removing item groups
function initItemGroupHandlers() {
    document.getElementById('add-item-btn').addEventListener('click', addItemGroup);

    document.getElementById('items-container').addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('remove-item-btn')) {
            e.target.parentElement.remove();
        }
    });
}

// Validate form before submission
function validateForm(event) {
    const quantities = document.querySelectorAll('.item-quantity');
    let isValid = true;

    quantities.forEach(quantity => {
        if (quantity.value <= 0) {
            alert('Quantity must be greater than zero.');
            isValid = false;
        }
    });

    if (!isValid) {
        event.preventDefault();
    }
}

// Submit donation form
function submitDonationForm(event) {
    event.preventDefault();

    const items = document.querySelectorAll('.item-group');
    const itemData = Array.from(items).map(item => ({
        name: item.querySelector('.item-name').value,
        quantity: item.querySelector('.item-quantity').value,
        condition: item.querySelector('.item-condition').value
    }));

    fetch('/user/donate_items', {
        method: 'POST',
        body: JSON.stringify({ items: itemData }),
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                toggleDisplay(document.getElementById('essential-form-popup'), 'none'); // Close the dialog
                fetchDonationSummary(); // Refresh donation summary and chart
            } else {
                alert('An error occurred. Please try again.');
                console.error(data.error);
            }
        });
}

let donationChart; // Store the chart instance globally

// Render donation summary chart
function renderDonationChart(itemSummary) {
    const labels = Object.keys(itemSummary);
    const quantities = Object.values(itemSummary);

    const ctx = document.getElementById('myChart').getContext('2d');

    // Destroy the existing chart instance if it exists
    if (donationChart) {
        donationChart.destroy();
    }

    // Create a new chart instance
    donationChart = new Chart(ctx, {
        type: 'doughnut', // Doughnut chart
        data: {
            labels: labels,
            datasets: [{
                data: quantities,
                backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1'], // Add more colors if needed
                borderColor: '#000',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true // Show legend for doughnut chart
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(2);
                            return `${context.label}: ${context.raw} units (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Fetch and display donation summary
function fetchDonationSummary() {
    fetch('/user/user-donation-summary')
        .then(response => response.json())
        .then(data => {
            if (data) {
                const amountDonated = data.amount_donated;
                const itemsDonated = data.items_donated;

                // Aggregate item quantities
                const itemSummary = itemsDonated.reduce((summary, [itemName, quantity]) => {
                    summary[itemName] = (summary[itemName] || 0) + parseInt(quantity, 10);
                    return summary;
                }, {});

                renderDonationChart(itemSummary);

                document.getElementById('amount-donated').textContent = amountDonated ? `Amount Donated: ₹${amountDonated}` : 'Amount Donated: None';
                document.getElementById('items-donated').innerHTML = Object.keys(itemSummary).length > 0
                    ? `Items Donated: ${Object.entries(itemSummary).map(([label, quantity]) => `<br>${label}: ${quantity} units`).join(", ")}`
                    : "Items Donated: None";
            } else {
                console.error("Failed to fetch donation summary:", data.error);
            }
        })
        .catch(error => console.error("Error fetching donation summary:", error));
}

// Initialize all event listeners and fetch data on DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
    initEssentialFormPopup();
    initItemGroupHandlers();

    const essentialForm = document.getElementById('essential-form');
    essentialForm.addEventListener('submit', validateForm);
    essentialForm.addEventListener('submit', submitDonationForm);

    fetchDonationSummary();
});