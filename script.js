// --- CONFIGURATION ---
// IMPORTANT: Replace this with your own secret topic from ntfy.sh
const NTFY_TOPIC = 'YOUR_SECRET_TOPIC_NAME';
// -------------------

const statusElement = document.getElementById('status');
const liveFeedImg = document.getElementById('live-feed-img');
const notificationsList = document.getElementById('notifications-list');

// 1. Register the Service Worker for Push Notifications
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(registration => {
            console.log('Service Worker registered successfully:', registration);
        })
        .catch(error => {
            console.error('Service Worker registration failed:', error);
            statusElement.textContent = 'Error: Push notifications disabled.';
        });
}

// 2. Function to connect to the ntfy.sh stream
async function connectToNtfy() {
    statusElement.textContent = 'Connecting to notification stream...';
    try {
        const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}/json`);
        statusElement.textContent = '✅ Connected and monitoring.';
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Clear the "No alerts yet" message
        if (notificationsList.children.length === 1 && notificationsList.children[0].textContent.includes("No alerts")) {
            notificationsList.innerHTML = '';
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                statusElement.textContent = 'Stream finished. Reconnecting...';
                setTimeout(connectToNtfy, 5000); // Reconnect after 5 seconds
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            lines.forEach(line => {
                if (line.trim() === '') return;
                try {
                    const event = JSON.parse(line);
                    handleNtfyEvent(event);
                } catch (e) {
                    // Ignore parsing errors for incomplete lines
                }
            });
        }
    } catch (error) {
        console.error('Failed to connect to ntfy.sh stream:', error);
        statusElement.textContent = 'Connection failed. Retrying in 10 seconds...';
        setTimeout(connectToNtfy, 10000);
    }
}

// 3. Function to handle incoming events (messages and image updates)
function handleNtfyEvent(event) {
    if (event.event !== 'message') {
        return; // Only handle messages
    }

    console.log('Received event:', event);

    // Update the image if an attachment URL is provided
    if (event.attach) {
        // Add a timestamp to the URL to bypass browser cache
        liveFeedImg.src = `${event.attach}?t=${new Date().getTime()}`;
    }

    // Add the alert message to the list
    const listItem = document.createElement('li');
    const timestamp = new Date(event.time * 1000).toLocaleTimeString();
    listItem.innerHTML = `<strong>${event.title || 'Alert'} at ${timestamp}:</strong><br>${event.message}`;
    notificationsList.prepend(listItem); // Add new alerts to the top
}

// Start the connection
connectToNtfy();
