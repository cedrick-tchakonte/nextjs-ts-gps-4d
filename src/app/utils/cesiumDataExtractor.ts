'use client'

import { Building, RoadSegment } from './navigationAlgorithms';

// Fonction pour extraire les bâtiments à partir des primitives Cesium
export function extractBuildingsFromCesium(
    cesiumViewer: any,
    bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }
): Promise<Building[]> {
    return new Promise((resolve, reject) => {
        if (!cesiumViewer || !cesiumViewer.scene) {
            reject('Cesium Viewer not available');
            return;
        }

        // Liste des bâtiments extraits
        const buildings: Building[] = [];

        try {
            // Obtenir toutes les primitives 3D Tiles (qui contiennent généralement les bâtiments)
            const primitives = cesiumViewer.scene.primitives;
            
            for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i);
                
                // Vérifier s'il s'agit d'un tileset OSM Buildings
                if (primitive && primitive.tilesetType === '3DTILES' && primitive.ready) {
                    // Obtenir les emprises des tuiles contenant des bâtiments
                    const boundingSphere = primitive.boundingSphere;
                    if (boundingSphere) {
                        const cartographic = cesiumViewer.scene.globe.ellipsoid.cartesianToCartographic(boundingSphere.center);
                        const lat = cartographic.latitude * (180 / Math.PI);
                        const lng = cartographic.longitude * (180 / Math.PI);
                        
                        // Vérifier si le bâtiment est dans les limites de la zone d'intérêt
                        if (lat >= bounds.minLat && lat <= bounds.maxLat && 
                            lng >= bounds.minLng && lng <= bounds.maxLng) {
                            
                            // Pour chaque bâtiment visible, extraire ses informations
                            // Cela nécessite d'avoir accès aux tuiles spécifiques, ce qui peut être complexe
                            // Ici nous créons une approximation basée sur la position et la hauteur
                            
                            // Obtenir la hauteur approximative
                            const height = boundingSphere.radius / 2; // Approximation raisonnable
                            
                            // Créer un périmètre approximatif (carré centré sur le bâtiment)
                            const footprintSize = 0.0005; // Taille approximative en degrés
                            const footprint = [
                                { lat: lat - footprintSize, lng: lng - footprintSize },
                                { lat: lat - footprintSize, lng: lng + footprintSize },
                                { lat: lat + footprintSize, lng: lng + footprintSize },
                                { lat: lat + footprintSize, lng: lng - footprintSize }
                            ];
                            
                            buildings.push({
                                id: `building-${buildings.length}`,
                                position: { lat, lng },
                                height,
                                footprint,
                                type: 'unknown' // Type inconnu par défaut
                            });
                        }
                    }
                }
            }
            
            resolve(buildings);
        } catch (error) {
            console.error('Error extracting buildings from Cesium:', error);
            reject(error);
        }
    });
}

// Fonction pour obtenir les bâtiments de Cesium via un ray-casting sur le terrain
export function sampleBuildingHeightsFromCesium(
    cesiumViewer: any,
    bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number },
    gridResolution: number = 0.001 // Résolution de l'échantillonnage
): Promise<Building[]> {
    return new Promise((resolve, reject) => {
        if (!cesiumViewer || !cesiumViewer.scene) {
            reject('Cesium Viewer not available');
            return;
        }

        const buildings: Building[] = [];
        const Cesium = (window as any).Cesium; // Accès à l'API Cesium
        
        try {
            // Échantillonner la zone avec la résolution spécifiée
            for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += gridResolution) {
                for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += gridResolution) {
                    // Position cartésienne du point
                    const position = Cesium.Cartesian3.fromDegrees(lng, lat);
                    
                    // Obtenir la hauteur du terrain à cette position
                    const terrainHeight = cesiumViewer.scene.globe.getHeight(
                        Cesium.Cartographic.fromDegrees(lng, lat)
                    ) || 0;
                    
                    // Lancer un rayon vers le bas depuis une altitude élevée
                    const ray = new Cesium.Ray(
                        Cesium.Cartesian3.fromDegrees(lng, lat, 1000), // Point de départ à 1000m d'altitude
                        Cesium.Cartesian3.negate(Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3()) // Direction vers le bas
                    );
                    
                    // Effectuer le ray-casting pour détecter les bâtiments
                    const result = cesiumViewer.scene.pickFromRay(ray, [cesiumViewer.scene.primitives]);
                    
                    // Si on a touché quelque chose et que ce n'est pas le terrain
                    if (result && result.position) {
                        const hitPosition = result.position;
                        const hitCartographic = Cesium.Cartographic.fromCartesian(hitPosition);
                        const hitHeight = hitCartographic.height;
                        
                        // Si l'altitude du point d'impact est significativement supérieure au terrain,
                        // on peut supposer qu'il s'agit d'un bâtiment
                        if (hitHeight > terrainHeight + 5) { // 5m au-dessus du terrain = probablement un bâtiment
                            const buildingHeight = hitHeight - terrainHeight;
                            
                            // Vérifier si on a déjà un bâtiment à cette position
                            const existingBuilding = buildings.find(
                                b => Math.abs(b.position.lat - lat) < gridResolution && 
                                     Math.abs(b.position.lng - lng) < gridResolution
                            );
                            
                            if (existingBuilding) {
                                // Mettre à jour la hauteur si on trouve une valeur plus élevée
                                existingBuilding.height = Math.max(existingBuilding.height, buildingHeight);
                            } else {
                                // Créer un nouveau bâtiment avec un périmètre approximatif
                                const footprint = [
                                    { lat: lat - gridResolution/2, lng: lng - gridResolution/2 },
                                    { lat: lat - gridResolution/2, lng: lng + gridResolution/2 },
                                    { lat: lat + gridResolution/2, lng: lng + gridResolution/2 },
                                    { lat: lat + gridResolution/2, lng: lng - gridResolution/2 }
                                ];
                                
                                buildings.push({
                                    id: `building-${buildings.length}`,
                                    position: { lat, lng },
                                    height: buildingHeight,
                                    footprint,
                                    type: 'sampled'
                                });
                            }
                        }
                    }
                }
            }
            
            resolve(buildings);
        } catch (error) {
            console.error('Error sampling building heights from Cesium:', error);
            resolve([]); // Retourner une liste vide en cas d'erreur
        }
    });
}

// Fonction pour extraire les routes à partir des primitives Cesium
export function extractRoadsFromCesium(
    cesiumViewer: any,
    bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }
): Promise<RoadSegment[]> {
    return new Promise((resolve, reject) => {
        if (!cesiumViewer || !cesiumViewer.scene) {
            reject('Cesium Viewer not available');
            return;
        }

        const roads: RoadSegment[] = [];
        const Cesium = (window as any).Cesium; // Accès à l'API Cesium
        
        try {
            // On va utiliser une approche simplifiée en échantillonnant les routes principales
            // dans la région d'intérêt
            
            // Définir quelques routes principales manuellement (à adapter selon les besoins)
            // Ces routes sont des approximations et devraient être remplacées par des données plus précises
            
            // Route nord-sud
            const northSouthPoints = [];
            for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += 0.001) {
                northSouthPoints.push({ lat, lng: (bounds.minLng + bounds.maxLng) / 2 });
            }
            
            roads.push({
                id: 'road-ns',
                path: northSouthPoints,
                type: 'primary',
                width: 10
            });
            
            // Route est-ouest
            const eastWestPoints = [];
            for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += 0.001) {
                eastWestPoints.push({ lat: (bounds.minLat + bounds.maxLat) / 2, lng });
            }
            
            roads.push({
                id: 'road-ew',
                path: eastWestPoints,
                type: 'primary',
                width: 10
            });
            
            // Tentative d'extraction des routes réelles depuis Cesium
            // Rechercher les entités de type polyline qui pourraient représenter des routes
            const entities = cesiumViewer.entities.values;
            for (let i = 0; i < entities.length; i++) {
                const entity = entities[i];
                
                if (entity.polyline) {
                    // Extraction des positions si disponibles
                    const polyline = entity.polyline;
                    
                    if (polyline.positions && polyline.positions.getValue) {
                        const positions = polyline.positions.getValue();
                        if (positions && positions.length > 1) {
                            const roadPoints = [];
                            
                            // Convertir les positions cartésiennes en lat/lng
                            for (let j = 0; j < positions.length; j++) {
                                const cartographic = Cesium.Cartographic.fromCartesian(positions[j]);
                                const point = {
                                    lat: cartographic.latitude * (180 / Math.PI),
                                    lng: cartographic.longitude * (180 / Math.PI)
                                };
                                
                                // Vérifier si le point est dans les limites
                                if (point.lat >= bounds.minLat && point.lat <= bounds.maxLat &&
                                    point.lng >= bounds.minLng && point.lng <= bounds.maxLng) {
                                    roadPoints.push(point);
                                }
                            }
                            
                            // Si on a au moins 2 points, c'est un segment de route valide
                            if (roadPoints.length >= 2) {
                                roads.push({
                                    id: `road-entity-${i}`,
                                    path: roadPoints,
                                    type: 'secondary',
                                    width: 8
                                });
                            }
                        }
                    }
                }
            }
            
            resolve(roads);
        } catch (error) {
            console.error('Error extracting roads from Cesium:', error);
            resolve(roads); // Retourner ce qu'on a pu extraire
        }
    });
}

// Fonction pour obtenir des routes simplifiées dans une région, à partir d'un quadrillage
export function generateSimplifiedRoadGrid(
    bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number },
    gridSpacing: number = 0.005 // Espacement de la grille en degrés
): RoadSegment[] {
    const roads: RoadSegment[] = [];
    let roadId = 0;
    
    // Créer des routes Nord-Sud
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += gridSpacing) {
        const points = [];
        
        for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += gridSpacing / 10) {
            points.push({ lat, lng });
        }
        
        // Déterminer le type de route (les routes principales sont espacées davantage)
        const isMainRoad = Math.abs((lng - bounds.minLng) % (gridSpacing * 3)) < 0.00001;
        
        roads.push({
            id: `road-ns-${roadId++}`,
            path: points,
            type: isMainRoad ? 'primary' : 'secondary',
            width: isMainRoad ? 12 : 8
        });
    }
    
    // Créer des routes Est-Ouest
    for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += gridSpacing) {
        const points = [];
        
        for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += gridSpacing / 10) {
            points.push({ lat, lng });
        }
        
        // Déterminer le type de route (les routes principales sont espacées davantage)
        const isMainRoad = Math.abs((lat - bounds.minLat) % (gridSpacing * 3)) < 0.00001;
        
        roads.push({
            id: `road-ew-${roadId++}`,
            path: points,
            type: isMainRoad ? 'primary' : 'secondary',
            width: isMainRoad ? 12 : 8
        });
    }
    
    return roads;
}