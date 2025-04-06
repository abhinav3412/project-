// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event listener to the form
    const sensorForm = document.getElementById('sensorForm');
    if (sensorForm) {
        sensorForm.addEventListener('submit', handleSensorFormSubmit);
    }
    
    // Get modal elements
    const modal = document.getElementById("sensorModal");
    const addBtn = document.getElementById("addSensorBtn");
    const closeBtns = document.getElementsByClassName("close");
    
    // Open modal when Add button is clicked
    if (addBtn) {
        addBtn.onclick = function() {
            modal.style.display = "block";
        }
    }
    
    // Close modal when X is clicked
    for (let i = 0; i < closeBtns.length; i++) {
        closeBtns[i].onclick = function() {
            modal.style.display = "none";
        }
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});

// Form submission handler
function handleSensorFormSubmit(e) {
    e.preventDefault();
    
    // Validate coordinates before submission
    if (typeof validateCoordinates === 'function' && !validateCoordinates()) {
        return;
    }
    
    // Show loading state
    const submitButton = this.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Adding...';
    submitButton.disabled = true;
    
    // Create JSON data
    const jsonData = {
        sensor_name: document.getElementById('sensor_name').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        soil_type: document.getElementById('soil_type').value
    };
    
    // Send as JSON
    fetch(this.action, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'alert alert-success';
            successMessage.textContent = 'Sensor added successfully!';
            this.insertBefore(successMessage, this.firstChild);
            
            // Reset form
            this.reset();
            
            // Close modal after a short delay
            setTimeout(() => {
                document.getElementById("sensorModal").style.display = "none";
                location.reload(); // Refresh to show new sensor
            }, 1500);
        } else {
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'alert alert-danger';
            errorMessage.textContent = data.message || 'Error adding sensor';
            this.insertBefore(errorMessage, this.firstChild);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Show error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger';
        errorMessage.textContent = 'Error adding sensor. Please try again.';
        this.insertBefore(errorMessage, this.firstChild);
    })
    .finally(() => {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        
        // Remove any messages after 3 seconds
        setTimeout(() => {
            const alerts = this.querySelectorAll('.alert');
            alerts.forEach(alert => alert.remove());
        }, 3000);
    });
}

// Coordinate validation function
function validateCoordinates() {
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const latValidation = document.getElementById('lat-validation');
    const lngValidation = document.getElementById('lng-validation');
    
    let isValid = true;
    
    // Validate latitude
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        latValidation.textContent = "Latitude must be between -90 and 90 degrees";
        isValid = false;
    } else {
        latValidation.textContent = "";
    }
    
    // Validate longitude
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        lngValidation.textContent = "Longitude must be between -180 and 180 degrees";
        isValid = false;
    } else {
        lngValidation.textContent = "";
    }
    
    return isValid;
} 