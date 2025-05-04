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
let flightMode = 'planned'; // Changé de 'default' à 'planned' pour suivre la trajectoire planifiée
let simulationSpeed = 1;
let minAltitude = 100;
let isSimulationPaused = false; // Nouvel état pour gérer la pause

// Variables pour les mouvements plus dynamiques
let turbulence = 0;
let yawAngle = 0;
let pitchAngle = 0;
let rollAngle = 0;

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
                    isSimulationPaused = false; // Réinitialise l'état de pause aussi
                    turbulence = 0;
                } else if (data.action === 'setSpeed') {
                    simulationSpeed = data.speed || 1;
                } else if (data.action === 'pause') {
                    isSimulationPaused = true;
                    console.log('Simulation paused');
                } else if (data.action === 'play') {
                    isSimulationPaused = false;
                    console.log('Simulation resumed');
                }
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    const interval = setInterval(() => {
        if (isSimulationPaused) {
            return;
        }

        // Mettre à jour les angles d'orientation pour la dynamique de vol
        updateFlightDynamics();

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
            totalWaypoints: waypoints.length,
            // Ajouter les informations d'orientation pour un vol plus réaliste
            yaw: yawAngle,
            pitch: pitchAngle,
            roll: rollAngle,
            turbulence: turbulence
        }));
    }, 100); // Mise à jour plus fréquente pour un mouvement plus fluide (100ms au lieu de 200ms)

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});

// Mettre à jour la dynamique de vol (angles et turbulence)
function updateFlightDynamics() {
    // Simuler des turbulences aléatoires
    turbulence = Math.random() * 5 * simulationSpeed;
    
    // Mise à jour graduelle des angles pour des mouvements fluides
    yawAngle += (Math.random() - 0.5) * 2 * simulationSpeed;
    pitchAngle = (Math.random() - 0.5) * 10 * simulationSpeed;
    rollAngle = Math.sin(Date.now() / 1000) * 5 * simulationSpeed; // oscillation sinusoïdale pour le roulis
}

// Simulation de vol par défaut (comportement original)
function simulateDefaultFlight() {
    if (!takeoffCompleted) {
        currentAltitude += (20 + Math.random() * 10) * simulationSpeed; // Plus rapide
        if (currentAltitude >= maxAltitude) {
            takeoffCompleted = true;
            console.log("Takeoff completed. Switching to horizontal flight.");
        }
    } else {
        // Augmenter la vitesse et l'amplitude des mouvements
        currentLongitude -= (Math.random() * 0.0015 + 0.0005) * simulationSpeed;
        currentLatitude += (Math.random() * 0.0015 + 0.0005) * simulationSpeed;
        
        // Variations d'altitude plus importantes
        currentAltitude += ((Math.random() - 0.5) * 15) * simulationSpeed;
        
        // Garder l'altitude dans des limites raisonnables
        if (currentAltitude < minAltitude) currentAltitude = minAltitude;
        if (currentAltitude > maxAltitude) currentAltitude = maxAltitude;
    }
}

// Simulation de vol suivant une trajectoire planifiée
function simulatePlannedFlight() {
    if (currentWaypointIndex >= waypoints.length - 1) {
        // Arrivé au dernier waypoint, ajouter des mouvements pour sembler moins statique
        currentAltitude += ((Math.random() - 0.5) * 5) * simulationSpeed;
        currentLongitude += ((Math.random() - 0.5) * 0.0001) * simulationSpeed;
        currentLatitude += ((Math.random() - 0.5) * 0.0001) * simulationSpeed;
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
    
    // Calculer la direction vers le prochain waypoint avec plus de dynamisme
    const stepSize = Math.min(0.0005 * simulationSpeed, distance); // Augmenté à 0.0005 (était 0.0003)
    const ratio = stepSize / distance;
    
    // Déplacer l'appareil vers le prochain waypoint avec un peu d'aléatoire
    currentLatitude += distLat * ratio + ((Math.random() - 0.5) * 0.00005) * simulationSpeed;
    currentLongitude += distLng * ratio + ((Math.random() - 0.5) * 0.00005) * simulationSpeed;
    
    // Gérer l'altitude en fonction de la phase de vol
    const totalWaypoints = waypoints.length;
    const progress = currentWaypointIndex / totalWaypoints;
    
    if (progress < 0.2) {
        // Phase de décollage et montée plus rapide
        if (!takeoffCompleted) {
            currentAltitude += (10 + Math.random() * 5) * simulationSpeed;
            if (currentAltitude >= maxAltitude * 0.7) {
                takeoffCompleted = true;
            }
        } else {
            // Ajuster l'altitude vers l'altitude maximale
            const altDiff = maxAltitude - currentAltitude;
            currentAltitude += (altDiff * 0.1) * simulationSpeed; // Plus rapide (0.1 au lieu de 0.05)
        }
    } else if (progress > 0.8) {
        // Phase de descente pour l'atterrissage
        const targetAlt = minAltitude;
        const altDiff = targetAlt - currentAltitude;
        currentAltitude += (altDiff * 0.1) * simulationSpeed; // Plus rapide
    } else {
        // Phase de croisière - variations d'altitude plus prononcées
        currentAltitude += ((Math.random() - 0.5) * 10) * simulationSpeed;
        
        // Conserver l'altitude dans des limites raisonnables
        if (currentAltitude < maxAltitude * 0.6) currentAltitude = maxAltitude * 0.6;
        if (currentAltitude > maxAltitude * 1.1) currentAltitude = maxAltitude * 1.1;
    }
}