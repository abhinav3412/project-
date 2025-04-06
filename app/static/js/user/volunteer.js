function submitForm(e) {
    e.preventDefault();
    // Get values from the form fields
    const name = document.getElementById('name').value;
    const mobile = document.getElementById('mobile').value;
    const email = document.getElementById('email').value;
    const location = document.getElementById('location').value;
    const role_id = document.getElementById('role_id').value;
    
    // Create a JSON object with the volunteer form data
    const volunteerData = { name, mobile, email, location, role_id };

    // Send a POST request with the JSON payload
    fetch('/user/submit_volunteer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(volunteerData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'error') {
            alert(data.errors);
        } else {
            alert(data.message);
            // Clear the form after successful submission
            document.getElementById('volunteer-form').reset();
        }
    })
    .catch(error => console.error("Error submitting volunteer form:", error));
}

// Attach the submit event listener once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('volunteer-form').addEventListener('submit', submitForm);
});


// Typewriter Text Loop
const texts = ["Your contribution can save lives !.", "Be the change !."];
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

function updateVolunteerHistory(user_id){
    const url = `/user/volunteer/get_volunteer_history/${user_id}`;
    const historyList = document.getElementById('history-list');
    
    fetch(url)
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch volunteer history');
        }
        return response.json();
    })
    .then(history => {
        historyList.innerHTML = '';
        
        if (history.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No volunteer history found.';
            li.style.color = 'gray';
            li.style.fontStyle = 'italic';
            historyList.appendChild(li);
            return;
        }

        history.forEach(record => {
            const li = document.createElement('li');
            const status = record.status ? ` (${record.status})` : '';
            const endDate = record.end_date ? ` until ${record.end_date}` : '';
            li.textContent = `You volunteered as ${record.role} at ${record.camp_name} on ${record.created_at}${status}${endDate}`;
            historyList.appendChild(li);
        });
    })
    .catch(error => {
        console.error('Error fetching volunteer history:', error);
        historyList.innerHTML = '<li style="color: red;">Error loading volunteer history.</li>';
    });
}


// Start the typewriter effect on page load
document.addEventListener('DOMContentLoaded', () => {
    startTypewriter();
    document.getElementById('volunteer-form').addEventListener('submit', submitForm);
    container = document.getElementById('history-list');
    const user_id = container.getAttribute('data-user_id');
    
    updateVolunteerHistory(user_id);
});