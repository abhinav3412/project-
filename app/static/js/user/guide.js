// Save checkbox state to localStorage
function saveCheckboxState() {
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        localStorage.setItem(checkbox.id, checkbox.checked);
    });
}

// Restore checkbox state from localStorage
function restoreCheckboxState() {
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        const storedValue = localStorage.getItem(checkbox.id);
        checkbox.checked = storedValue === "true";
        checkbox.addEventListener('change', saveCheckboxState);
    });
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    // Restore checkbox states
    restoreCheckboxState();

    // Chatbot functionality
    const chatbotIcon = document.getElementById('chatbot-icon');
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatbotClose = document.getElementById('chatbot-close');

    chatbotIcon.addEventListener('click', () => {
        chatbotContainer.style.display = 'flex';
    });

    chatbotClose.addEventListener('click', () => {
        chatbotContainer.style.display = 'none';
    });

    // Add hover effects dynamically (optional)
    document.querySelectorAll('.guide-box').forEach(box => {
        box.addEventListener('mouseenter', () => {
            box.style.transform = 'translateY(-1vh)';
            box.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4)';
        });
        box.addEventListener('mouseleave', () => {
            box.style.transform = 'translateY(0)';
            box.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)';
        });
    });
});