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
let flightMode = 'planned'; // Changé de 'planned' à 'idle' pour ne pas bouger jusqu'à réception d'un plan
let simulationSpeed = 2;
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
    // La dynamique de vol est maintenant gérée différemment selon le mode
    if (flightMode !== 'planned' || waypoints.length === 0) {
        // En mode par défaut ou sans plan de vol, comportement d'origine avec turbulences aléatoires
        turbulence = Math.random() * 5 * simulationSpeed;
        
        // Mise à jour graduelle des angles pour des mouvements fluides mais aléatoires
        yawAngle += (Math.random() - 0.5) * 2 * simulationSpeed;
        pitchAngle = (Math.random() - 0.5) * 10 * simulationSpeed;
        rollAngle = Math.sin(Date.now() / 1000) * 5 * simulationSpeed; // oscillation sinusoïdale pour le roulis
    } else {
        // En mode planifié, le roulis est basé sur les changements de direction
        // mais la fonction simulatePlannedFlight gère les autres angles
        rollAngle = Math.sin(Date.now() / 2000) * 3 * simulationSpeed; // oscillation plus douce
    }
}

// Simulation de vol par défaut (comportement original)
function simulateDefaultFlight() {
    // Si le mode est 'idle', le drone ne bouge pas du tout
    if (flightMode === 'idle') {
        return;
    }
    
    if (!takeoffCompleted) {
        currentAltitude += (30 + Math.random() * 15) * simulationSpeed; // Montée plus rapide (20→30, 10→15)
        if (currentAltitude >= maxAltitude) {
            takeoffCompleted = true;
            console.log("Takeoff completed. Switching to horizontal flight.");
        }
    } else {
        // Augmenter la vitesse et l'amplitude des mouvements (valeurs multipliées par ~2)
        currentLongitude -= (Math.random() * 0.003 + 0.001) * simulationSpeed;
        currentLatitude += (Math.random() * 0.003 + 0.001) * simulationSpeed;
        
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
        // Arrivé au dernier waypoint, maintenir la position stable
        // Pas de modification de la position horizontale pour rester en place
        
        // Très légère oscillation d'altitude pour donner l'impression de vol stationnaire
        currentAltitude += ((Math.random() - 0.5) * 0.2) * simulationSpeed;
        
        // Réinitialiser les angles pour stabiliser le drone
        pitchAngle = 0;
        yawAngle = yawAngle; // Garder le cap actuel
        rollAngle = 0;
        turbulence = 0;
        return;
    }

    const currentWaypoint = waypoints[currentWaypointIndex];
    const nextWaypoint = waypoints[currentWaypointIndex + 1];
    
    // Calculer la distance au prochain waypoint
    const distLat = nextWaypoint.lat - currentLatitude;
    const distLng = nextWaypoint.lng - currentLongitude;
    const distance = Math.sqrt(distLat * distLat + distLng * distLng);
    
    // Si on est assez proche du prochain waypoint, passer au suivant
    // Seuil adapté à la vitesse de simulation pour une précision constante
    const proximityThreshold = 0.00002 * Math.max(1, simulationSpeed * 0.5);
    if (distance < proximityThreshold) {
        console.log(`Reached waypoint ${currentWaypointIndex + 1}/${waypoints.length}`);
        // Positionnement exact au waypoint avant de passer au suivant
        currentLatitude = nextWaypoint.lat;
        currentLongitude = nextWaypoint.lng;
        // Si l'altitude est spécifiée, utiliser cette valeur exacte
        if (nextWaypoint.alt !== undefined) {
            currentAltitude = nextWaypoint.alt;
        }
        currentWaypointIndex++;
        return;
    }
    
    // Calculer la direction vers le prochain waypoint de manière précise
    // Ajuster dynamiquement la vitesse selon la distance - plus lent à l'approche
    let stepRatio;
    if (distance < 0.0002) {
        // Ralentir à l'approche du waypoint pour plus de précision
        stepRatio = (0.08 + (distance * 350)) * simulationSpeed / distance; // Augmenté (0.05→0.08, 250→350)
    } else {
        // Vitesse normale pour les segments longs - augmentée (0.1→0.2)
        stepRatio = 0.2 * simulationSpeed / distance;
    }
    
    // Clamp le stepRatio pour éviter des déplacements trop grands ou trop petits
    // Augmentation des limites (0.2→0.4, 0.01→0.02) pour permettre des déplacements plus rapides
    stepRatio = Math.min(0.4, Math.max(0.02, stepRatio));
    
    // Déplacement direct et précis vers le prochain waypoint
    // Élimination quasi-totale des facteurs aléatoires pour un suivi exact
    currentLatitude += distLat * stepRatio;
    currentLongitude += distLng * stepRatio;
    
    // Gérer l'altitude de manière précise
    let targetAltitude;
    
    // Utiliser l'altitude du waypoint si elle est définie
    if (nextWaypoint.alt !== undefined) {
        targetAltitude = nextWaypoint.alt;
    } else {
        // Interpolation de l'altitude en fonction de la progression du plan de vol
        const progress = currentWaypointIndex / (waypoints.length - 1);
        targetAltitude = progress < 0.2 ? 
            minAltitude + (maxAltitude - minAltitude) * (progress / 0.2) : // Montée
            (progress > 0.8 ? 
                maxAltitude - (maxAltitude - minAltitude) * ((progress - 0.8) / 0.2) : // Descente
                maxAltitude); // Croisière
    }
    
    // Approche graduelle de l'altitude cible
    const altDiff = targetAltitude - currentAltitude;
    currentAltitude += altDiff * 0.2 * simulationSpeed; // Augmenté de 0.1 à 0.2 pour une montée/descente plus rapide
    
    // S'assurer que l'altitude reste dans des limites raisonnables
    if (currentAltitude < minAltitude) currentAltitude = minAltitude;
    if (currentAltitude > maxAltitude) currentAltitude = maxAltitude;
    
    // Mise à jour des angles pour une orientation réaliste
    // Calculer la direction du mouvement pour orienter le drone correctement
    const heading = Math.atan2(distLng, distLat);
    yawAngle = heading * (180 / Math.PI); // Convertir en degrés pour la visualisation
    
    // Angle de tangage basé sur la montée/descente
    pitchAngle = altDiff > 0 ? 10 * simulationSpeed : (altDiff < 0 ? -10 * simulationSpeed : 0);
    
    // Réduire les turbulences lors du suivi de trajectoire planifiée
    turbulence = Math.random() * 2 * simulationSpeed;
}