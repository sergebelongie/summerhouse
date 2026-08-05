async function loadArchitecture() {
    try {
        const response = await fetch('./data/architecture.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Successfully loaded architecture data:", data);
        
        // Next step: pass data.rooms to a builder function
        
    } catch (error) {
        console.error("Could not load architecture.json:", error);
    }
}

// Initialize the app
loadArchitecture();
