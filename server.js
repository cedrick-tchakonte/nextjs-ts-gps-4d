const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

console.log("WebSocket Server is running on ws://localhost:8081/trajectory");

let currentLongitude = 2.430;
let currentLatitude = 48.632;
let currentAltitude = 100;
let takeoffCompleted = false;  
let maxAltitude = 500;  

wss.on('connection', ws => {
    console.log('Client connected');

    setInterval(() => {
        if (!takeoffCompleted) {
            currentAltitude += Math.random() * 100;  
            if (currentAltitude >= maxAltitude) {
                takeoffCompleted = true;
                console.log("Takeoff completed. Switching to horizontal flight.");
            }
        } else {
            currentLongitude -= Math.random() * 0.005;  
            currentLatitude += Math.random() * 0.005;  
            currentAltitude += (Math.random() - 0.1) * 5; 
        }

        const data = JSON.stringify({
            longitude: currentLongitude,
            latitude: currentLatitude,
            altitude: currentAltitude
        });

        ws.send(data);
        console.log("Sent: ", data);
    }, 1000);

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});