// Navigation Algorithms for Flight Path Planning
import { Position } from '../types/position';

// Structure représentant une zone interdite ou restreinte
export interface NoFlyZone {
    // Polygone délimitant la zone (dans le sens horaire)
    coordinates: { lat: number, lng: number }[];
    // Altitude min et max (en mètres)
    minAltitude?: number;
    maxAltitude?: number;
    // Type de restriction (complète, temporaire, conditionnelle)
    type: 'complete' | 'temporary' | 'conditional';
    // Identifiant de la zone
    id: string;
    // Raison de la restriction (militaire, aéroport, etc.)
    reason?: string;
}

// Structure pour représenter un bâtiment réel
export interface Building {
    // Position centrale du bâtiment
    position: { lat: number, lng: number };
    // Hauteur du bâtiment en mètres
    height: number;
    // Périmètre du bâtiment (polygone)
    footprint: { lat: number, lng: number }[];
    // Type de bâtiment (résidentiel, commercial, etc.)
    type?: string;
    // Identifiant unique
    id: string;
}

// Structure pour représenter une route terrestre
export interface RoadSegment {
    // Points définissant la route
    path: { lat: number, lng: number }[];
    // Type de route (autoroute, principale, secondaire)
    type: 'highway' | 'primary' | 'secondary' | 'residential';
    // Largeur approximative en mètres
    width: number;
    // Identifiant
    id: string;
}

// Types de mission/trajet
export enum MissionType {
    URGENT = 'urgent',          // Priorité à la vitesse, pas de contraintes sur le trajet
    NORMAL = 'normal',          // Équilibre entre sécurité et vitesse
    DELIVERY = 'delivery',      // Livraison de colis, priorité à l'efficacité énergétique
    SIGHTSEEING = 'sightseeing' // Vol touristique, suit les routes et points d'intérêt
}

// Structure pour les conditions météorologiques
export interface WeatherCondition {
    // Position centrale
    position: { lat: number, lng: number };
    // Rayon d'influence (en km)
    radius: number;
    // Type de condition météo
    type: 'turbulence' | 'storm' | 'wind' | 'fog';
    // Intensité (0-1)
    intensity: number;
}

// Calcule la distance haversine entre deux points (en km)
export function haversineDistance(pos1: Position, pos2: Position): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Vérifie si un point est à l'intérieur d'un polygone (algorithme ray casting)
export function isPointInPolygon(point: Position, polygon: { lat: number, lng: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const intersect = ((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
            (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / 
             (polygon[j].lat - polygon[i].lat) + polygon[i].lng);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Vérifie si un point est dans une zone de non-vol
export function isInNoFlyZone(point: Position, zones: NoFlyZone[]): boolean {
    for (const zone of zones) {
        if (isPointInPolygon(point, zone.coordinates)) {
            // Vérifier aussi les contraintes d'altitude si elles existent
            const altitudeRestricted = 
                (zone.minAltitude !== undefined && point.alt !== undefined && point.alt < zone.minAltitude) ||
                (zone.maxAltitude !== undefined && point.alt !== undefined && point.alt > zone.maxAltitude);
            
            // Si zone complète ou si l'altitude est dans la plage restreinte
            if (zone.type === 'complete' || altitudeRestricted) {
                return true;
            }
        }
    }
    return false;
}

// Calcule le coût d'un segment en fonction des conditions météo
export function calculateWeatherCost(start: Position, end: Position, weather: WeatherCondition[]): number {
    let cost = haversineDistance(start, end);
    
    // Augmenter le coût en fonction des conditions météo
    for (const condition of weather) {
        const midPoint: Position = {
            lat: (start.lat + end.lat) / 2,
            lng: (start.lng + end.lng) / 2,
            alt: start.alt !== undefined && end.alt !== undefined ? (start.alt + end.alt) / 2 : undefined
        };
        
        const distToWeather = haversineDistance(
            midPoint, 
            { lat: condition.position.lat, lng: condition.position.lng, alt: midPoint.alt }
        );
        
        if (distToWeather < condition.radius) {
            // Plus on est proche du centre de la perturbation, plus le coût augmente
            const factor = 1 + (condition.radius - distToWeather) / condition.radius * condition.intensity * 5;
            cost *= factor;
            
            // Bonus: éviter complètement les orages
            if (condition.type === 'storm' && distToWeather < condition.radius * 0.5) {
                cost *= 10; // Coût prohibitif pour traverser un orage
            }
        }
    }
    
    return cost;
}

// Génère un profil d'altitude en fonction du type d'optimisation
export function generateAltitudeProfile(
    waypoints: Position[],
    minAltitude: number,
    maxAltitude: number,
    optimizationType: string,
    terrain: { [key: string]: number } = {} // Carte d'altitude du terrain
): Position[] {
    const enhancedWaypoints = [...waypoints];
    const totalPoints = enhancedWaypoints.length;
    
    // Appliquer le profil d'altitude approprié
    for (let i = 0; i < totalPoints; i++) {
        const ratio = i / (totalPoints - 1);
        let altitude;
        
        // Déterminer la phase de vol
        if (ratio < 0.2) {
            // Phase de montée
            altitude = minAltitude + (maxAltitude - minAltitude) * (ratio / 0.2);
        } else if (ratio > 0.8) {
            // Phase de descente
            const descentRatio = (ratio - 0.8) / 0.2;
            altitude = maxAltitude - (maxAltitude - minAltitude) * descentRatio;
        } else {
            // Phase de croisière
            altitude = maxAltitude;
        }
        
        // Ajuster l'altitude en fonction du type d'optimisation
        switch (optimizationType) {
            case 'fuel_efficient':
                // Rester à une altitude plus basse pour économiser du carburant
                altitude = minAltitude + (altitude - minAltitude) * 0.8;
                break;
            case 'safe':
                // Ajouter une marge de sécurité supplémentaire
                altitude = Math.min(maxAltitude, altitude * 1.1);
                break;
            case 'comfortable':
                // Vol plus lisse avec moins de variations d'altitude
                if (i > 0 && i < totalPoints - 1) {
                    const prevAlt = enhancedWaypoints[i-1].alt || altitude;
                    altitude = prevAlt * 0.9 + altitude * 0.1; // Lissage
                }
                break;
            case 'avoid_zones':
                // Peut varier davantage en altitude pour éviter des zones
                break;
        }
        
        // Prendre en compte l'altitude du terrain si disponible
        const key = `${enhancedWaypoints[i].lat.toFixed(4)},${enhancedWaypoints[i].lng.toFixed(4)}`;
        if (terrain[key]) {
            // Assurer une distance minimale au-dessus du terrain
            const minTerrainClearance = 150; // 150 mètres au-dessus du terrain
            altitude = Math.max(altitude, terrain[key] + minTerrainClearance);
        }
        
        enhancedWaypoints[i].alt = altitude;
    }
    
    return enhancedWaypoints;
}

// Fonction qui lisse le chemin pour éviter les zigzags
export function smoothPath(path: Position[], smoothingFactor: number = 0.5): Position[] {
    if (path.length <= 2) return path;
    
    const smoothed: Position[] = [path[0]]; // Garder le point de départ
    
    for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const current = path[i];
        const next = path[i + 1];
        
        const smoothedPoint: Position = {
            lat: current.lat * (1 - smoothingFactor) + (prev.lat + next.lat) / 2 * smoothingFactor,
            lng: current.lng * (1 - smoothingFactor) + (prev.lng + next.lng) / 2 * smoothingFactor,
            alt: current.alt
        };
        
        smoothed.push(smoothedPoint);
    }
    
    smoothed.push(path[path.length - 1]); // Garder le point d'arrivée
    
    return smoothed;
}

// Convertit les bâtiments Cesium en obstacles pour la navigation
export function convertBuildingsToObstacles(
    buildings: Building[]
): NoFlyZone[] {
    return buildings.map((building, index) => {
        return {
            id: building.id || `building-${index}`,
            coordinates: building.footprint,
            type: 'complete', // Les bâtiments sont des obstacles complets
            minAltitude: 0,
            maxAltitude: building.height,
            reason: 'building'
        };
    });
}

// Vérifie si un point est au-dessus d'un bâtiment et ajuste l'altitude si nécessaire
export function adjustAltitudeForBuildings(
    position: Position,
    buildings: Building[],
    minClearance: number = 50 // 50 mètres au-dessus du bâtiment
): Position {
    const adjustedPosition = { ...position };
    
    for (const building of buildings) {
        if (isPointInPolygon(position, building.footprint)) {
            // Assurer que l'altitude est supérieure à la hauteur du bâtiment + marge de sécurité
            if (!adjustedPosition.alt || adjustedPosition.alt < building.height + minClearance) {
                adjustedPosition.alt = building.height + minClearance;
            }
            break; // On a trouvé un bâtiment, on arrête la recherche
        }
    }
    
    return adjustedPosition;
}

// Calcule le coût d'un segment pour favoriser le vol au-dessus des routes
export function calculateRoadPreferenceCost(
    start: Position,
    end: Position,
    roads: RoadSegment[],
    missionType: MissionType
): number {
    // Pour les missions urgentes, on ne prend pas en compte les routes
    if (missionType === MissionType.URGENT) {
        return haversineDistance(start, end);
    }
    
    let baseCost = haversineDistance(start, end);
    
    // Pour les missions non urgentes, vérifier la proximité aux routes
    if (missionType === MissionType.NORMAL || 
        missionType === MissionType.DELIVERY || 
        missionType === MissionType.SIGHTSEEING) {
        
        // Point médian du segment
        const midPoint: Position = {
            lat: (start.lat + end.lat) / 2,
            lng: (start.lng + end.lng) / 2,
            alt: start.alt !== undefined && end.alt !== undefined ? (start.alt + end.alt) / 2 : undefined
        };
        
        // Trouver la distance à la route la plus proche
        let minDistanceToRoad = Infinity;
        
        for (const road of roads) {
            for (let i = 0; i < road.path.length - 1; i++) {
                const roadStart = road.path[i];
                const roadEnd = road.path[i + 1];
                
                // Distance du point médian au segment de route (approximation)
                const distToRoad = distanceToLineSegment(
                    midPoint, 
                    { lat: roadStart.lat, lng: roadStart.lng },
                    { lat: roadEnd.lat, lng: roadEnd.lng }
                );
                
                minDistanceToRoad = Math.min(minDistanceToRoad, distToRoad);
            }
        }
        
        // Ajuster le coût en fonction de la distance à la route
        // Plus on est loin d'une route, plus le coût augmente pour les vols non urgents
        const roadBonus = 1 - Math.min(1, Math.max(0, (0.2 - minDistanceToRoad) / 0.2));
        
        // Facteur de préférence pour les routes selon le type de mission
        let roadPreferenceFactor;
        switch(missionType) {
            case MissionType.SIGHTSEEING:
                roadPreferenceFactor = 0.7; // Forte préférence pour suivre les routes
                break;
            case MissionType.DELIVERY:
                roadPreferenceFactor = 0.5; // Préférence modérée
                break;
            case MissionType.NORMAL:
                roadPreferenceFactor = 0.3; // Légère préférence
                break;
            default:
                roadPreferenceFactor = 0;
        }
        
        // Appliquer le bonus de route
        baseCost *= (1 + roadBonus * roadPreferenceFactor);
    }
    
    return baseCost;
}

// Calcule la distance d'un point à un segment de ligne
function distanceToLineSegment(
    point: Position,
    lineStart: Position,
    lineEnd: Position
): number {
    // Calculer le carré de la longueur du segment
    const lengthSquared = Math.pow(lineEnd.lat - lineStart.lat, 2) + 
                          Math.pow(lineEnd.lng - lineStart.lng, 2);
    
    // Si le segment est un point, retourner la distance à ce point
    if (lengthSquared === 0) {
        return haversineDistance(point, lineStart);
    }
    
    // Calculer le paramètre t de la projection du point sur la ligne
    const t = Math.max(0, Math.min(1, (
        (point.lat - lineStart.lat) * (lineEnd.lat - lineStart.lat) +
        (point.lng - lineStart.lng) * (lineEnd.lng - lineStart.lng)
    ) / lengthSquared));
    
    // Calculer le point de projection
    const projection: Position = {
        lat: lineStart.lat + t * (lineEnd.lat - lineStart.lat),
        lng: lineStart.lng + t * (lineEnd.lng - lineStart.lng)
    };
    
    // Retourner la distance haversine au point de projection
    return haversineDistance(point, projection);
}

// Fonction qui calcule le champ de potentiel (force) pour un point donné
function calculatePotentialField(
    pos: Position,
    goal: Position,
    buildings: Building[],
    noFlyZones: NoFlyZone[],
    weatherConditions: WeatherCondition[] = [],
    attractionStrength: number = 1.0,
    repulsionStrength: number = 2.0
): { forceLat: number, forceLng: number } {
    // Force d'attraction vers l'objectif (gradient négatif du potentiel attractif)
    const distToGoal = haversineDistance(pos, goal);
    const attractiveForceLat = attractionStrength * (goal.lat - pos.lat) / distToGoal;
    const attractiveForceLng = attractionStrength * (goal.lng - pos.lng) / distToGoal;
    
    // Forces de répulsion des obstacles (bâtiments et zones interdites)
    let repulsiveForceLat = 0;
    let repulsiveForceLng = 0;
    
    // Force répulsive des bâtiments
    for (const building of buildings) {
        if (isPointInPolygon(pos, building.footprint)) {
            // Si on est à l'intérieur d'un bâtiment, force de répulsion maximale
            const centerLat = building.position.lat;
            const centerLng = building.position.lng;
            const directionLat = pos.lat - centerLat;
            const directionLng = pos.lng - centerLng;
            const magnitude = Math.sqrt(directionLat * directionLat + directionLng * directionLng);
            
            if (magnitude > 0) {
                repulsiveForceLat += repulsionStrength * 50 * directionLat / magnitude;
                repulsiveForceLng += repulsionStrength * 50 * directionLng / magnitude;
            }
        } else {
            // Force inversement proportionnelle à la distance au carré
            const distToBuildingCenter = haversineDistance(pos, building.position);
            const influenceRadius = 0.05; // 50 mètres en degrés approx
            
            if (distToBuildingCenter < influenceRadius) {
                const force = repulsionStrength / Math.pow(distToBuildingCenter / influenceRadius, 2);
                const directionLat = pos.lat - building.position.lat;
                const directionLng = pos.lng - building.position.lng;
                const magnitude = Math.sqrt(directionLat * directionLat + directionLng * directionLng);
                
                if (magnitude > 0) {
                    repulsiveForceLat += force * directionLat / magnitude;
                    repulsiveForceLng += force * directionLng / magnitude;
                }
            }
        }
    }
    
    // Force répulsive des zones de non-vol
    for (const zone of noFlyZones) {
        // Calcul du centre de la zone
        const centerLat = zone.coordinates.reduce((sum, coord) => sum + coord.lat, 0) / zone.coordinates.length;
        const centerLng = zone.coordinates.reduce((sum, coord) => sum + coord.lng, 0) / zone.coordinates.length;
        const zoneCenter = { lat: centerLat, lng: centerLng };
        
        if (isPointInPolygon(pos, zone.coordinates)) {
            // Si on est à l'intérieur d'une zone, force de répulsion maximale
            const directionLat = pos.lat - centerLat;
            const directionLng = pos.lng - centerLng;
            const magnitude = Math.sqrt(directionLat * directionLat + directionLng * directionLng);
            
            if (magnitude > 0) {
                repulsiveForceLat += repulsionStrength * 100 * directionLat / magnitude;
                repulsiveForceLng += repulsionStrength * 100 * directionLng / magnitude;
            }
        } else {
            // Force inversement proportionnelle à la distance au carré
            const distToZoneCenter = haversineDistance(pos, zoneCenter);
            const influenceRadius = 0.1; // 100 mètres en degrés approx
            
            if (distToZoneCenter < influenceRadius) {
                const force = repulsionStrength / Math.pow(distToZoneCenter / influenceRadius, 2);
                const directionLat = pos.lat - centerLat;
                const directionLng = pos.lng - centerLng;
                const magnitude = Math.sqrt(directionLat * directionLat + directionLng * directionLng);
                
                if (magnitude > 0) {
                    repulsiveForceLat += force * directionLat / magnitude;
                    repulsiveForceLng += force * directionLng / magnitude;
                }
            }
        }
    }
    
    // Influence négative des conditions météo
    for (const condition of weatherConditions) {
        const distToWeather = haversineDistance(
            pos, 
            { lat: condition.position.lat, lng: condition.position.lng }
        );
        
        if (distToWeather < condition.radius) {
            const force = repulsionStrength * condition.intensity / Math.max(0.01, distToWeather / condition.radius);
            const directionLat = pos.lat - condition.position.lat;
            const directionLng = pos.lng - condition.position.lng;
            const magnitude = Math.sqrt(directionLat * directionLat + directionLng * directionLng);
            
            if (magnitude > 0) {
                repulsiveForceLat += force * directionLat / magnitude;
                repulsiveForceLng += force * directionLng / magnitude;
            }
        }
    }
    
    // Force totale comme somme des forces attractives et répulsives
    return {
        forceLat: attractiveForceLat + repulsiveForceLat,
        forceLng: attractiveForceLng + repulsiveForceLng
    };
}

// Implémente un algorithme basé sur les gradients pour la planification de chemin
// Remplace l'ancien algorithme A* par une approche de descente de gradient
export function findPathGradient(
    start: Position,
    goal: Position,
    buildings: Building[] = [],
    roads: RoadSegment[] = [],
    missionType: MissionType = MissionType.NORMAL,
    noFlyZones: NoFlyZone[] = [],
    weatherConditions: WeatherCondition[] = [],
    stepSize: number = 0.0005,
    maxSteps: number = 5000
): Position[] {
    const path: Position[] = [{ ...start }];
    let currentPos = { ...start };
    let steps = 0;
    
    // Paramètres pour l'algorithme de descente de gradient
    const attractionStrength = missionType === MissionType.URGENT ? 2.0 : 1.0;
    const repulsionStrength = missionType === MissionType.SAFE ? 3.0 : 2.0;
    const convergenceThreshold = 0.0002; // Seuil de convergence en degrés
    
    // Convertir les bâtiments en obstacles
    const buildingObstacles = convertBuildingsToObstacles(buildings);
    const allObstacles = [...noFlyZones, ...buildingObstacles];
    
    while (steps < maxSteps) {
        steps++;
        
        // Calculer la distance au but
        const distToGoal = haversineDistance(currentPos, goal);
        
        // Si on est assez proche du but, arrêter
        if (distToGoal < convergenceThreshold) {
            path.push({ ...goal });
            break;
        }
        
        // Calculer le champ de potentiel au point courant
        const { forceLat, forceLng } = calculatePotentialField(
            currentPos, 
            goal, 
            buildings, 
            allObstacles, 
            weatherConditions,
            attractionStrength,
            repulsionStrength
        );
        
        // Normaliser la force pour avoir un pas constant
        const forceMagnitude = Math.sqrt(forceLat * forceLat + forceLng * forceLng);
        
        if (forceMagnitude < 0.00001) {
            // Si la force est trop faible, avancer directement vers le but
            const dirToGoal = {
                lat: goal.lat - currentPos.lat,
                lng: goal.lng - currentPos.lng
            };
            const dirMagnitude = Math.sqrt(dirToGoal.lat * dirToGoal.lat + dirToGoal.lng * dirToGoal.lng);
            
            currentPos = {
                lat: currentPos.lat + (dirToGoal.lat / dirMagnitude) * stepSize,
                lng: currentPos.lng + (dirToGoal.lng / dirMagnitude) * stepSize,
                alt: currentPos.alt
            };
        } else {
            // Avancer selon le gradient avec un pas adaptatif
            const adaptiveStepSize = Math.min(stepSize, distToGoal / 10);
            currentPos = {
                lat: currentPos.lat + (forceLat / forceMagnitude) * adaptiveStepSize,
                lng: currentPos.lng + (forceLng / forceMagnitude) * adaptiveStepSize,
                alt: currentPos.alt
            };
        }
        
        // Ajouter le point au chemin (uniquement s'il est suffisamment différent du précédent)
        const lastPoint = path[path.length - 1];
        if (haversineDistance(lastPoint, currentPos) > stepSize / 2) {
            path.push({ ...currentPos });
        }
        
        // Si on est bloqué (force très faible mais loin du but), ajouter du bruit
        if (forceMagnitude < 0.0001 && distToGoal > convergenceThreshold * 10) {
            currentPos.lat += (Math.random() - 0.5) * stepSize;
            currentPos.lng += (Math.random() - 0.5) * stepSize;
        }
    }
    
    // Si on n'a pas atteint le but après le nombre maximum d'étapes,
    // ajouter le but directement à la fin du chemin
    if (haversineDistance(path[path.length - 1], goal) > convergenceThreshold) {
        path.push({ ...goal });
    }
    
    // Lisser le chemin pour éliminer les zigzags
    const smoothedPath = smoothPath(path, 0.6);
    
    // Ajuster les altitudes pour éviter les bâtiments
    return smoothedPath.map(pos => adjustAltitudeForBuildings(pos, buildings));
}

// Pour la compatibilité avec le code existant, on garde findPathAStar mais
// qui utilise maintenant findPathGradient en interne
export function findPathAStar(
    start: Position,
    goal: Position,
    noFlyZones: NoFlyZone[] = [],
    weatherConditions: WeatherCondition[] = [],
    gridResolution: number = 0.005,
    maxIterations: number = 1000
): Position[] {
    // Appelle simplement la nouvelle méthode basée sur les gradients
    return findPathGradient(
        start,
        goal,
        [],  // pas de bâtiments
        [],  // pas de routes
        MissionType.NORMAL,
        noFlyZones,
        weatherConditions,
        gridResolution,
        maxIterations
    );
}

// Utilise la nouvelle approche par gradients au lieu de A*
export function findOptimalPath(
    start: Position,
    goal: Position,
    buildings: Building[] = [],
    roads: RoadSegment[] = [],
    missionType: MissionType = MissionType.NORMAL,
    noFlyZones: NoFlyZone[] = [],
    weatherConditions: WeatherCondition[] = [],
    stepSize: number = 0.0005,
    maxIterations: number = 5000
): Position[] {
    return findPathGradient(
        start,
        goal,
        buildings,
        roads,
        missionType,
        noFlyZones,
        weatherConditions,
        stepSize,
        maxIterations
    );
}

// Cette fonction est seulement utilisée pour la compatibilité avec le code existant
// Elle ne génère plus d'obstacles artificiels
export function generateTestObstacles(
    bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number },
    count: number = 0
): NoFlyZone[] {
    // Retourne un tableau vide, sans obstacles artificiels
    return [];
}

// Pour la compatibilité, on garde cette fonction mais on retourne un tableau vide
export function generateTestWeather(
    bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number },
    count: number = 0
): WeatherCondition[] {
    // Retourne un tableau vide, sans conditions météo artificielles
    return [];
}