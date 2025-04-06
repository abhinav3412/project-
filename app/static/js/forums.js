
// FAQ Toggle Functionality
document.querySelectorAll('.faq-question').forEach((question) => {
    question.addEventListener('click', () => {
        const answer = question.nextElementSibling;

        // Close all other answers
        document.querySelectorAll('.faq-answer').forEach((otherAnswer) => {
            if (otherAnswer !== answer && otherAnswer.style.display === 'block') {
                otherAnswer.style.display = 'none';
            }
        });

        // Toggle the clicked answer
        if (answer.style.display === 'block') {
            answer.style.display = 'none'; // Hide the answer
        } else {
            answer.style.display = 'block'; // Show the answer
        }
    });
});

// load threads on page load
document.addEventListener("DOMContentLoaded", function () {
    loadThreads();
});

// 🔹 Load threads (Reusable function)
// Fetch threads from the server and display them in the thread list
// Load threads on page load and after adding a new thread
function loadThreads() {
    fetch("/user/forums/get_threads")
        .then(response => response.json())
        .then(data => {
            const threadList = document.getElementById("thread-list");
            threadList.innerHTML = ""; // Clear the list

            if(data.length === 0) {
                threadList.innerHTML = "<p>No threads found.</p>";
                return;
            }
            data.forEach(thread => {
                const threadItem = createThreadElement(thread);
                threadList.appendChild(threadItem);
            });
        })
        .catch(error => console.error("Error loading threads:", error));
}

// 🔹 Create a thread element (Reusable function)
// Create a new list item element for the thread
function createThreadElement(thread) {
    const threadItem = document.createElement("li");
    threadItem.className = "thread-item";

    threadItem.innerHTML = `
        <div class="thread-header">
            <span class="thread-title">${thread.title}</span>
            <span class="thread-timestamp">${thread.timestamp}</span>
        </div>
        <div class="thread-body">
            <p>${thread.content}</p>
        </div>

        <div class="thread-stats">
            ${thread.reply_count > 0 
                ? `<button class="toggle-replies-btn" data-thread-id="${thread.tid}">
                    Replies: ${thread.reply_count}
                </button>` 
                : ""
            }
        </div>

        <div class="replies" id="replies-${thread.tid}" style="display: none;">
            ${thread.replies.map(reply => `<p><strong>${reply.username}:</strong> ${reply.content}</p>`).join("")}
        </div>

        <button class="reply-button">Reply</button>
        
        <form style="display: none;" method="post" class="reply-form">
            <label for="reply-content">Reply:</label>
            <input type="text" class="reply-content" name="content" required>
            <button type="submit">Submit</button>
            <input type="hidden" name="thread_id" value="${thread.tid}">
        </form>
    `;

    // attach event listeners to the thread
    attachEventListeners(threadItem, thread.tid);
    return threadItem;
}

// 🔹 Attach event listeners to thread (Encapsulation)
function attachEventListeners(threadItem, threadId) {
    const replyButton = threadItem.querySelector(".reply-button");
    const replyForm = threadItem.querySelector(".reply-form");
    const toggleRepliesBtn = threadItem.querySelector(".toggle-replies-btn");
    const repliesDiv = threadItem.querySelector(".replies");

    // Show reply form on button click
    // Button: "Reply"
    replyButton.addEventListener("click", function () {
        replyButton.style.display = "none";
        replyForm.style.display = "block";
    });

    // Handle reply form submission
    // Form: "Reply submit"
    replyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitReply(replyForm, threadId);
    });

    // Toggle replies display
    // Button: "Replies: x"
    if (toggleRepliesBtn) {
        toggleRepliesBtn.addEventListener("click", function () {
            repliesDiv.style.display = "block"; 
            toggleRepliesBtn.style.display = "none";
        });
    }
}

//  Submit reply (Reusable function)
//  Create a new reply for the thread
function submitReply(replyForm, threadId) {
    fetch('/user/forums/add_reply', {
        method: 'POST',
        body: new FormData(replyForm),
        headers: { "Accept": "application/json" }
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            console.error("Error adding reply:", result.error);
        } else {
            loadThreads(); // Reload threads
            setTimeout(() => toggleReplies(threadId), 500); // Ensure new replies are visible
        }
    })
    .catch(error => console.error("Error submitting reply:", error));
}

//  Toggle replies (Reusable function)
// Open the replies section for a thread
function toggleReplies(threadId) {
    const toggleBtn = document.querySelector(`.toggle-replies-btn[data-thread-id="${threadId}"]`);
    if (toggleBtn) {
        toggleBtn.click(); // Click the button to show replies
    }
}

//  Submit feedback
//  Submit feedback form to the server
function submitFeedback(feedbackForm) {
    fetch("/user/submit_feedback", {
        method: "POST",
        body: new FormData(feedbackForm),
        headers: { "Accept": "application/json" }
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            feedbackForm.reset(); // Clear the form

            // Show success message
            const successMessage = document.createElement("p");
            successMessage.textContent = "Feedback submitted successfully!";
            successMessage.style.color = "green";
            successMessage.style.marginTop = "10px";
            feedbackForm.appendChild(successMessage);

            // Remove success message after 5 seconds
            setTimeout(() => successMessage.remove(), 5000);
        }
    })
    .catch(error => {
        console.error("Error submitting feedback:", error);
    });
}


function submitQuestion(){
    const questionForm = document.getElementById("question-form");
    fetch('/user/forums/add_thread', {
        method: 'POST',
        body: new FormData(questionForm),
        headers: { "Accept": "application/json" }
    })
    .then(response => response.json())
    .then(result => {
        if(result.error){
            console.error("Error adding question:", result.error);
        }else{
            loadThreads();
        }
    })
}

document.addEventListener("DOMContentLoaded", function () {
    const feedbackForm = document.getElementById("feedback-form");
    const questionForm = document.getElementById("question-form");

    if (feedbackForm) {
        feedbackForm.addEventListener("submit", function (event) {
            event.preventDefault();
            submitFeedback(feedbackForm);
        });
    }

    if(questionForm){
        questionForm.addEventListener("submit", function(event){
            event.preventDefault();
            submitQuestion();
        });
    }
});