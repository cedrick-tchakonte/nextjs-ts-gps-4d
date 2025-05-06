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

// Ajouter ces structures de données au début du fichier, avec les autres variables globales
let obstacles = []; // Liste des zones interdites

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
            else if (data.type === 'obstacles') {
                // Recevoir et stocker les obstacles
                console.log(`Received ${data.obstacles.length} obstacles`);
                obstacles = data.obstacles || [];
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
    // Vérifier si on est arrivé à destination
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
        console.log(`Reached waypoint ${currentWaypointIndex} of ${waypoints.length}`);
        return;
    }
    
    // Calculer la direction vers le prochain waypoint avec plus de dynamisme
    const stepSize = Math.min(0.0005 * simulationSpeed, distance);
    const ratio = stepSize / distance;
    
    // Position prévue après le déplacement
    const nextLat = currentLatitude + distLat * ratio + ((Math.random() - 0.5) * 0.00005 * turbulence) * simulationSpeed;
    const nextLng = currentLongitude + distLng * ratio + ((Math.random() - 0.5) * 0.00005 * turbulence) * simulationSpeed;
    
    // Sauvegarder la position actuelle pour revenir en arrière si besoin
    const oldLat = currentLatitude;
    const oldLng = currentLongitude;
    const oldAlt = currentAltitude;
    
    // Déplacer l'appareil vers le prochain waypoint avec les perturbations
    currentLatitude = nextLat;
    currentLongitude = nextLng;
    
    // Vérifier si la nouvelle position est dans une zone restreinte
    if (isInRestrictedZone()) {
        // Si on entre dans une zone restreinte, reculer et tenter une autre direction
        console.log('Warning: Approaching restricted zone, adjusting course');
        
        // Revenir à la position précédente
        currentLatitude = oldLat;
        currentLongitude = oldLng;
        
        // Si le type d'optimisation est AVOID_ZONES, tenter de monter pour éviter l'obstacle
        if (flightMode === 'avoid_zones' && obstacles.some(o => o.maxAltitude !== undefined)) {
            // Trouver l'altitude maximale des obstacles dans la zone
            const nearbyObstacles = obstacles.filter(o => 
                isPointInPolygon({ lat: currentLatitude, lng: currentLongitude }, o.coordinates));
            
            if (nearbyObstacles.length > 0) {
                const maxObstacleAlt = Math.max(...nearbyObstacles
                    .filter(o => o.maxAltitude !== undefined)
                    .map(o => o.maxAltitude || 0));
                
                // Monter au-dessus de l'obstacle avec une marge de sécurité
                if (maxObstacleAlt > 0 && maxObstacleAlt < maxAltitude) {
                    currentAltitude = Math.min(maxAltitude, maxObstacleAlt + 50);
                    console.log(`Climbing to avoid obstacle: ${currentAltitude}m`);
                }
            }
        } else {
            // Tenter une direction légèrement différente
            const angleOffset = Math.random() * Math.PI / 2; // 0-90 degrés
            const newDistance = distance * 0.5; // Moitié de la distance originale
            
            // Calculer une nouvelle direction
            currentLatitude = oldLat + Math.sin(angleOffset) * newDistance * 0.0001;
            currentLongitude = oldLng + Math.cos(angleOffset) * newDistance * 0.0001;
        }
    }
    
    // Gérer l'altitude en fonction de la phase de vol
    const totalWaypoints = waypoints.length;
    const progress = currentWaypointIndex / totalWaypoints;
    
    if (progress < 0.2) {
        // Phase de décollage et montée
        if (!takeoffCompleted) {
            currentAltitude += (10 + Math.random() * 5) * simulationSpeed;
            if (currentAltitude >= nextWaypoint.alt || currentAltitude >= maxAltitude * 0.7) {
                takeoffCompleted = true;
            }
        } else {
            // Ajuster progressivement vers l'altitude cible du prochain waypoint
            const targetAlt = nextWaypoint.alt !== undefined ? nextWaypoint.alt : maxAltitude;
            const altDiff = targetAlt - currentAltitude;
            currentAltitude += (altDiff * 0.1) * simulationSpeed;
        }
    } else if (progress > 0.8) {
        // Phase de descente pour l'atterrissage
        const targetAlt = nextWaypoint.alt !== undefined ? nextWaypoint.alt : minAltitude;
        const altDiff = targetAlt - currentAltitude;
        currentAltitude += (altDiff * 0.1) * simulationSpeed;
    } else {
        // Phase de croisière - viser l'altitude du waypoint avec des variations
        const targetAlt = nextWaypoint.alt !== undefined ? nextWaypoint.alt : 
                          (waypoints[currentWaypointIndex].alt !== undefined ? 
                           waypoints[currentWaypointIndex].alt : maxAltitude * 0.8);
        
        const altDiff = targetAlt - currentAltitude;
        currentAltitude += (altDiff * 0.05 + (Math.random() - 0.5) * 10 * turbulence / 5) * simulationSpeed;
        
        // Limites d'altitude en fonction du plan de vol
        if (currentAltitude < minAltitude) currentAltitude = minAltitude;
        if (currentAltitude > maxAltitude) currentAltitude = maxAltitude;
    }
}

// Vérifier si un point est à l'intérieur d'un polygone (algorithme ray casting)
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const intersect = ((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
            (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / 
             (polygon[j].lat - polygon[i].lat) + polygon[i].lng);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Vérifier si la position actuelle est dans une zone restreinte
function isInRestrictedZone() {
    const currentPos = { lat: currentLatitude, lng: currentLongitude };
    
    for (const obstacle of obstacles) {
        if (isPointInPolygon(currentPos, obstacle.coordinates)) {
            // Vérifier aussi les contraintes d'altitude si elles existent
            const altitudeRestricted = 
                (obstacle.minAltitude !== undefined && currentAltitude < obstacle.minAltitude) ||
                (obstacle.maxAltitude !== undefined && currentAltitude > obstacle.maxAltitude);
            
            // Si zone complète ou si l'altitude est dans la plage restreinte
            if (obstacle.type === 'complete' || altitudeRestricted) {
                return true;
            }
        }
    }
    return false;
}