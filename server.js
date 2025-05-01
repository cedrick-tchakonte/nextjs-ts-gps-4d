const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

console.log("WebSocket Server is running on ws://localhost:8081/trajectory");

// Coordonnées par défaut
let currentLongitude = 2.430;
let currentLatitude = 48.632;
let currentAltitude = 100;
let takeoffCompleted = false;
let maxAltitude = 500;

// Données pour la trajectoire planifiée
let waypoints = [];
let currentWaypointIndex = 0;
let flightMode = 'default'; // 'default', 'planned'
let simulationSpeed = 1;
let minAltitude = 100;

wss.on('connection', ws => {
    console.log('Client connected');
    
    // Écouter les messages du client pour mettre à jour la trajectoire
    ws.on('message', function(message) {
        try {
            const data = JSON.parse(message.toString());
            
            if (data.type === 'flightPlan') {
                console.log('Received new flight plan');
                waypoints = data.waypoints || [];
                currentWaypointIndex = 0;
                flightMode = 'planned';
                maxAltitude = data.maxAltitude || 500;
                minAltitude = data.minAltitude || 100;
                
                // Réinitialiser à la position de départ
                if (waypoints.length > 0) {
                    currentLongitude = waypoints[0].lng;
                    currentLatitude = waypoints[0].lat;
                    currentAltitude = minAltitude;
                    takeoffCompleted = false;
                }
                
                console.log(`Flight plan with ${waypoints.length} waypoints loaded`);
            } 
            else if (data.type === 'simulationControl') {
                if (data.action === 'reset') {
                    // Réinitialiser la simulation
                    currentWaypointIndex = 0;
                    if (waypoints.length > 0) {
                        currentLongitude = waypoints[0].lng;
                        currentLatitude = waypoints[0].lat;
                        currentAltitude = minAltitude;
                        takeoffCompleted = false;
                    }
                } else if (data.action === 'setSpeed') {
                    simulationSpeed = data.speed || 1;
                }
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    const interval = setInterval(() => {
        if (flightMode === 'planned' && waypoints.length > 0) {
            // Simulation de vol planifié
            simulatePlannedFlight();
        } else {
            // Simulation de vol par défaut (comportement original)
            simulateDefaultFlight();
        }

        // Envoyer la position actuelle au client
        ws.send(JSON.stringify({
            longitude: currentLongitude,
            latitude: currentLatitude,
            altitude: currentAltitude,
            flightMode: flightMode,
            waypointIndex: currentWaypointIndex,
            totalWaypoints: waypoints.length
        }));
    }, 200); // Mise à jour plus fréquente pour un mouvement plus fluide

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});

// Simulation de vol par défaut (comportement original)
function simulateDefaultFlight() {
    if (!takeoffCompleted) {
        currentAltitude += Math.random() * 20 * simulationSpeed;
        if (currentAltitude >= maxAltitude) {
            takeoffCompleted = true;
            console.log("Takeoff completed. Switching to horizontal flight.");
        }
    } else {
        currentLongitude -= (Math.random() * 0.001) * simulationSpeed;
        currentLatitude += (Math.random() * 0.001) * simulationSpeed;
        currentAltitude += ((Math.random() - 0.5) * 5) * simulationSpeed;
    }
}

// Simulation de vol suivant une trajectoire planifiée
function simulatePlannedFlight() {
    if (currentWaypointIndex >= waypoints.length - 1) {
        // Arrivé au dernier waypoint, maintenir la position
        return;
    }

    const currentWaypoint = waypoints[currentWaypointIndex];
    const nextWaypoint = waypoints[currentWaypointIndex + 1];
    
    // Calculer la distance au prochain waypoint
    const distLat = nextWaypoint.lat - currentLatitude;
    const distLng = nextWaypoint.lng - currentLongitude;
    const distance = Math.sqrt(distLat * distLat + distLng * distLng);
    
    // Si on est assez proche du prochain waypoint, passer au suivant
    if (distance < 0.0002 * simulationSpeed) {
        currentWaypointIndex++;
        return;
    }
    
    // Calculer la direction vers le prochain waypoint
    const stepSize = Math.min(0.0003 * simulationSpeed, distance);
    const ratio = stepSize / distance;
    
    // Déplacer l'appareil vers le prochain waypoint
    currentLatitude += distLat * ratio;
    currentLongitude += distLng * ratio;
    
    // Gérer l'altitude en fonction de la phase de vol
    const totalWaypoints = waypoints.length;
    const progress = currentWaypointIndex / totalWaypoints;
    
    if (progress < 0.2) {
        // Phase de décollage et montée
        if (!takeoffCompleted) {
            currentAltitude += (5 + Math.random() * 2) * simulationSpeed;
            if (currentAltitude >= maxAltitude * 0.7) {
                takeoffCompleted = true;
            }
        } else {
            // Ajuster l'altitude vers l'altitude maximale
            const altDiff = maxAltitude - currentAltitude;
            currentAltitude += (altDiff * 0.05) * simulationSpeed;
        }
    } else if (progress > 0.8) {
        // Phase de descente pour l'atterrissage
        const targetAlt = minAltitude;
        const altDiff = targetAlt - currentAltitude;
        currentAltitude += (altDiff * 0.05) * simulationSpeed;
    } else {
        // Phase de croisière - légères variations d'altitude
        currentAltitude += ((Math.random() - 0.5) * 2) * simulationSpeed;
    }
}