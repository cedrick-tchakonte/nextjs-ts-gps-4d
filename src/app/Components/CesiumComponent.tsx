'use client'

import React, { useState } from 'react'
import type { CesiumType } from '../types/cesium'
import { Cesium3DTileset, type Entity, type Viewer } from 'cesium';
import type { Position } from '../types/position';
//NOTE: It is important to assign types using "import type", not "import"
import { dateToJulianDate } from '../example_utils/date';
//NOTE: This is required to get the stylings for default Cesium UI and controls
import 'cesium/Build/Cesium/Widgets/widgets.css';
import HUD from './HUD';
import { zones } from './zones';
import FlightPlanner, { FlightPlan, OptimizationType } from './FlightPlanner';
// Ajouter cette importation aux importations existantes
import { NoFlyZone } from '../utils/navigationAlgorithms';
// Ajouter les imports pour les nouvelles fonctionnalités
import { 
    Building, 
    RoadSegment, 
    MissionType, 
    findOptimalPath,
    convertBuildingsToObstacles,
    generateAltitudeProfile
} from '../utils/navigationAlgorithms';
import { 
    extractBuildingsFromCesium, 
    sampleBuildingHeightsFromCesium, 
    extractRoadsFromCesium,
    generateSimplifiedRoadGrid
} from '../utils/cesiumDataExtractor';

export const CesiumComponent: React.FunctionComponent<{
    CesiumJs: CesiumType,
    positions: Position[]
    currentWeather: { windSpeed: number };
}> = ({
    CesiumJs,
    positions,
    currentWeather
}) => {
    const cesiumViewer = React.useRef<Viewer | null>(null);
    const cesiumContainerRef = React.useRef<HTMLDivElement>(null);
    const addedScenePrimitives = React.useRef<Cesium3DTileset[]>([]);
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [realTimeEntity, setRealTimeEntity] = React.useState<Entity | null>(null);
    const [cameraFollowMode, setCameraFollowMode] = React.useState(false); // Désactiver le suivi automatique par défaut
    const [webSocket, setWebSocket] = React.useState<WebSocket | null>(null);
    const [currentFlightPlan, setCurrentFlightPlan] = React.useState<FlightPlan | null>(null);
    const [flightPathEntities, setFlightPathEntities] = React.useState<Entity[]>([]);
    const [simulationControls, setSimulationControls] = React.useState({
        isPlaying: true,
        speed: 1
    });
    // État pour stocker les obstacles visualisés
    const [obstacleEntities, setObstacleEntities] = useState<Entity[]>([]);
    // États pour stocker les bâtiments et les routes
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [roads, setRoads] = useState<RoadSegment[]>([]);
    const [missionType, setMissionType] = useState<MissionType>(MissionType.NORMAL);

    const resetCamera = React.useCallback(async () => {
        // Set the initial camera to look at a default location
        if (cesiumViewer.current !== null) {
            cesiumViewer.current.scene.camera.setView({
                destination: CesiumJs.Cartesian3.fromDegrees(2.2147, 48.7108, 2000), // Augmenter l'altitude pour une vue plus large
                orientation: {
                  heading: CesiumJs.Math.toRadians(0), // Vue orientée vers le nord
                  pitch: CesiumJs.Math.toRadians(-45),
                },
              });
              
            // Activer les contrôles de navigation pour permettre à l'utilisateur de se déplacer librement
            if (cesiumViewer.current.scene) {
                cesiumViewer.current.scene.screenSpaceCameraController.enableRotate = true;
                cesiumViewer.current.scene.screenSpaceCameraController.enableTranslate = true;
                cesiumViewer.current.scene.screenSpaceCameraController.enableZoom = true;
                cesiumViewer.current.scene.screenSpaceCameraController.enableTilt = true;
                cesiumViewer.current.scene.screenSpaceCameraController.enableLook = true;
            }
        }
    }, [CesiumJs]);

    const cleanUpPrimitives = React.useCallback(() => {
        //On NextJS 13.4+, React Strict Mode is on by default.
        //The block below will remove all added primitives from the scene.
        addedScenePrimitives.current.forEach(scenePrimitive => {
            if (cesiumViewer.current !== null) {
                cesiumViewer.current.scene.primitives.remove(scenePrimitive);
            }
        });
        addedScenePrimitives.current = [];
    }, []);

    // Fonction pour nettoyer les entités de trajectoire précédentes
    const cleanUpFlightPath = React.useCallback(() => {
        if (cesiumViewer.current) {
            flightPathEntities.forEach(entity => {
                cesiumViewer.current?.entities.remove(entity);
            });
        }
        setFlightPathEntities([]);
    }, [flightPathEntities]);

    // Fonction pour nettoyer l'entité du drone en temps réel
    const cleanUpRealTimeEntity = React.useCallback(() => {
        if (cesiumViewer.current && realTimeEntity) {
            cesiumViewer.current.entities.remove(realTimeEntity);
            setRealTimeEntity(null);
        }
    }, [realTimeEntity]);

    const addZones = React.useCallback((zones: { position: [number, number], type: any, label: string }[]) => {
        if (cesiumViewer.current) {
            zones.forEach(zone => {
                const { position, type, label } = zone;

                if (type.shape === "box") {
                    if (cesiumViewer.current) {
                        cesiumViewer.current.entities.add({
                            position: CesiumJs.Cartesian3.fromDegrees(position[0], position[1], type.height / 2),
                            box: {
                                dimensions: new CesiumJs.Cartesian3(type.length, type.width, type.height),
                                material: CesiumJs.Color.fromCssColorString(type.color).withAlpha(0.6),
                                outline: true,
                                outlineColor: CesiumJs.Color.BLACK,
                                outlineWidth: 2.0, // Plus visible pour GPS
                            },
                            label: {
                                text: label,
                                font: '16px sans-serif',
                                style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                                fillColor: CesiumJs.Color.WHITE,
                                outlineWidth: 2,
                                outlineColor: CesiumJs.Color.BLACK,
                                pixelOffset: new CesiumJs.Cartesian2(0, -45),
                                showBackground: true,
                                backgroundColor: CesiumJs.Color.BLACK.withAlpha(0.5),
                                disableDepthTestDistance: Number.POSITIVE_INFINITY // Toujours visible
                            },
                        });
                    }
                }

                else if (type.shape === "cylinder") {
                    if (cesiumViewer.current) {
                        cesiumViewer.current.entities.add({
                            position: CesiumJs.Cartesian3.fromDegrees(position[0], position[1], type.height / 2),
                            cylinder: {
                                length: type.height,
                                topRadius: type.radius,
                                bottomRadius: type.radius,
                                material: CesiumJs.Color.fromCssColorString(type.color).withAlpha(0.6),
                                outline: true,
                                outlineColor: CesiumJs.Color.BLACK,
                                outlineWidth: 2.0, // Plus visible pour GPS
                                slices: 16, // Réduire la complexité géométrique
                            },
                            label: {
                                text: label,
                                font: '16px sans-serif',
                                style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                                fillColor: CesiumJs.Color.WHITE,
                                outlineWidth: 2,
                                outlineColor: CesiumJs.Color.BLACK,
                                pixelOffset: new CesiumJs.Cartesian2(0, -45),
                                showBackground: true,
                                backgroundColor: CesiumJs.Color.BLACK.withAlpha(0.5),
                                disableDepthTestDistance: Number.POSITIVE_INFINITY // Toujours visible
                            },
                        });
                    }
                }
                
            });
        }
    }, [CesiumJs]);

    // Fonction pour visualiser la trajectoire planifiée
    const visualizeFlightPath = React.useCallback((flightPlan: FlightPlan) => {
        if (!cesiumViewer.current || !flightPlan.waypoints.length) return;
        
        cleanUpFlightPath();
        
        const newEntities: Entity[] = [];
        // Update the type definition to use proper typing
        const positions: Array<ReturnType<typeof CesiumJs.Cartesian3.fromDegrees>> = flightPlan.waypoints.map(wp => 
            CesiumJs.Cartesian3.fromDegrees(wp.lng, wp.lat, wp.alt ?? flightPlan.maxAltitude * 0.8)
        );
        
        // Ajouter des points de départ et d'arrivée
        const startEntity = cesiumViewer.current.entities.add({
            position: positions[0],
            point: {
                pixelSize: 16,
                color: CesiumJs.Color.GREEN,
                outlineColor: CesiumJs.Color.BLACK,
                outlineWidth: 2
            },
            label: {
                text: 'Départ: ' + flightPlan.startPosition.label,
                font: '16px sans-serif',
                style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                fillColor: CesiumJs.Color.WHITE,
                outlineWidth: 2,
                outlineColor: CesiumJs.Color.BLACK,
                pixelOffset: new CesiumJs.Cartesian2(0, -30),
                showBackground: true,
                backgroundColor: CesiumJs.Color.GREEN.withAlpha(0.7),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        
        const endEntity = cesiumViewer.current.entities.add({
            position: positions[positions.length - 1],
            point: {
                pixelSize: 16,
                color: CesiumJs.Color.RED,
                outlineColor: CesiumJs.Color.BLACK,
                outlineWidth: 2
            },
            label: {
                text: 'Arrivée: ' + flightPlan.endPosition.label,
                font: '16px sans-serif',
                style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                fillColor: CesiumJs.Color.WHITE,
                outlineWidth: 2,
                outlineColor: CesiumJs.Color.BLACK,
                pixelOffset: new CesiumJs.Cartesian2(0, -30),
                showBackground: true,
                backgroundColor: CesiumJs.Color.RED.withAlpha(0.7),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        
        newEntities.push(startEntity);
        newEntities.push(endEntity);
        
        // Ajouter la ligne de trajectoire
        let pathColor;
        switch(flightPlan.optimizationType) {
            case OptimizationType.FASTEST:
                pathColor = CesiumJs.Color.BLUE;
                break;
            case OptimizationType.FUEL_EFFICIENT:
                pathColor = CesiumJs.Color.GREEN;
                break;
            case OptimizationType.SAFE:
                pathColor = CesiumJs.Color.ORANGE;
                break;
            case OptimizationType.COMFORTABLE:
                pathColor = CesiumJs.Color.PURPLE;
                break;
            case OptimizationType.AVOID_ZONES:
                pathColor = CesiumJs.Color.YELLOW;
                break;
            default:
                pathColor = CesiumJs.Color.WHITE;
        }
        
        // Ajouter le couloir aérien
        const pathEntity = cesiumViewer.current.entities.add({
            corridor: {
                positions: positions,
                width: flightPlan.corridorWidth,
                material: pathColor.withAlpha(0.3),
                outline: true,
                outlineColor: pathColor,
                outlineWidth: 2
            }
        });
        
        newEntities.push(pathEntity);
        
        // Ajouter quelques points de passage intermédiaires pour des vols longs
        if (positions.length > 10) {
            for (let i = 1; i < positions.length - 1; i += Math.max(1, Math.floor(positions.length / 5))) {
                const waypointEntity = cesiumViewer.current.entities.add({
                    position: positions[i],
                    point: {
                        pixelSize: 8,
                        color: pathColor,
                        outlineColor: CesiumJs.Color.BLACK,
                        outlineWidth: 1
                    }
                });
                
                newEntities.push(waypointEntity);
            }
        }
        
        setFlightPathEntities(newEntities);
        
        // Zoomer pour montrer toute la trajectoire
        cesiumViewer.current.flyTo(newEntities, {
            duration: 2,
            offset: new CesiumJs.HeadingPitchRange(0, CesiumJs.Math.toRadians(-30), 0)
        });
        
    }, [CesiumJs, cleanUpFlightPath]);

    // Fonction pour envoyer le plan de vol au serveur WebSocket
    const sendFlightPlanToServer = React.useCallback((flightPlan: FlightPlan) => {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'flightPlan',
                waypoints: flightPlan.waypoints,
                maxAltitude: flightPlan.maxAltitude,
                minAltitude: flightPlan.minAltitude
            };
            
            webSocket.send(JSON.stringify(message));
        }
    }, [webSocket]);

    // Fonction pour visualiser les obstacles (no-fly zones)
    const visualizeObstacles = React.useCallback((obstacles: NoFlyZone[]) => {
        if (!cesiumViewer.current) return;
        
        // D'abord nettoyer les entités d'obstacles précédentes
        obstacleEntities.forEach((entity: Entity) => {
            cesiumViewer.current?.entities.remove(entity);
        });
        
        const newEntities: Entity[] = [];
        
        obstacles.forEach(obstacle => {
            // Créer les positions pour le polygone
            const positions = obstacle.coordinates.map(coord => 
                CesiumJs.Cartesian3.fromDegrees(coord.lng, coord.lat)
            );
            
            // Déterminer la couleur en fonction du type d'obstacle
            let color;
            switch(obstacle.type) {
                case 'complete':
                    color = CesiumJs.Color.RED.withAlpha(0.5);
                    break;
                case 'temporary':
                    color = CesiumJs.Color.ORANGE.withAlpha(0.5);
                    break;
                case 'conditional':
                    color = CesiumJs.Color.YELLOW.withAlpha(0.5);
                    break;
                default:
                    color = CesiumJs.Color.RED.withAlpha(0.5);
            }
            
            // Créer une entité pour le polygone
            if (cesiumViewer.current) {
                const entity = cesiumViewer.current.entities.add({
                    polygon: {
                        hierarchy: new CesiumJs.PolygonHierarchy(positions),
                        material: color,
                        outline: true,
                        outlineColor: CesiumJs.Color.BLACK,
                        outlineWidth: 2,
                        height: obstacle.minAltitude || 0,
                        extrudedHeight: obstacle.maxAltitude || 500
                    },
                    label: {
                        text: `Zone Restreinte: ${obstacle.reason || obstacle.id}`,
                        font: '14px sans-serif',
                        style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                        fillColor: CesiumJs.Color.WHITE,
                        outlineWidth: 2,
                        outlineColor: CesiumJs.Color.BLACK,
                        pixelOffset: new CesiumJs.Cartesian2(0, -30),
                        showBackground: true,
                        backgroundColor: color,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                
                newEntities.push(entity);
            }
        });
        
        setObstacleEntities(newEntities);
    }, [CesiumJs, obstacleEntities]);
    
    const toggleCameraFollowMode = React.useCallback(() => {
        setCameraFollowMode(!cameraFollowMode);
    }, [cameraFollowMode]);

    // Fonction pour ajouter un contrôle de suivi à l'interface
    const addCameraFollowButton = React.useCallback(() => {
        if (!cesiumViewer.current || !cesiumContainerRef.current) return;
        
        // Supprimer le bouton existant s'il existe
        const existingButton = document.querySelector('.camera-follow-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'camera-follow-button';
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '30px';
        buttonContainer.style.right = '30px';
        buttonContainer.style.zIndex = '1000';
        
        const button = document.createElement('button');
        button.textContent = cameraFollowMode ? 'Désactiver Suivi' : 'Suivre la position';
        button.style.padding = '10px';
        button.style.backgroundColor = cameraFollowMode ? '#f44336' : '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        
        button.addEventListener('click', () => {
            toggleCameraFollowMode();
        });
        
        buttonContainer.appendChild(button);
        cesiumContainerRef.current.appendChild(buttonContainer);
    }, [cameraFollowMode, toggleCameraFollowMode]);

    // Ajouter les contrôles de simulation
    const addSimulationControls = React.useCallback(() => {
        if (!cesiumContainerRef.current) return;
        
        // Supprimer les contrôles existants s'ils existent
        const existingControls = document.querySelector('.simulation-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'simulation-controls';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.bottom = '90px';
        controlsContainer.style.right = '30px';
        controlsContainer.style.zIndex = '1000';
        controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controlsContainer.style.padding = '10px';
        controlsContainer.style.borderRadius = '8px';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.flexDirection = 'column';
        controlsContainer.style.gap = '8px';
        
        // Bouton pour pause/play
        const playPauseButton = document.createElement('button');
        playPauseButton.textContent = simulationControls.isPlaying ? 'Pause' : 'Play';
        playPauseButton.style.padding = '8px';
        playPauseButton.style.backgroundColor = simulationControls.isPlaying ? '#FF9800' : '#4CAF50';
        playPauseButton.style.color = 'white';
        playPauseButton.style.border = 'none';
        playPauseButton.style.borderRadius = '4px';
        playPauseButton.style.cursor = 'pointer';
        playPauseButton.style.fontWeight = 'bold';
        
        playPauseButton.addEventListener('click', () => {
            const newIsPlaying = !simulationControls.isPlaying;
            setSimulationControls(prev => ({ ...prev, isPlaying: newIsPlaying }));
            
            if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                webSocket.send(JSON.stringify({
                    type: 'simulationControl',
                    action: newIsPlaying ? 'play' : 'pause'
                }));
            }
            
            // Mettre à jour l'interface immédiatement
            playPauseButton.textContent = newIsPlaying ? 'Pause' : 'Play';
            playPauseButton.style.backgroundColor = newIsPlaying ? '#FF9800' : '#4CAF50';
        });
        
        // Bouton pour réinitialiser la simulation
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Réinitialiser la simulation';
        resetButton.style.padding = '8px';
        resetButton.style.backgroundColor = '#f44336';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '4px';
        resetButton.style.cursor = 'pointer';
        
        resetButton.addEventListener('click', () => {
            // Réinitialiser l'état local avant d'envoyer le message au serveur
            if (cameraFollowMode) {
                setCameraFollowMode(false);
                addCameraFollowButton(); // Mettre à jour le bouton de suivi
            }
            
            // S'assurer que la simulation est en mode lecture après réinitialisation
            setSimulationControls(prev => ({ ...prev, isPlaying: true }));
            
            // Réinitialiser les contrôles de navigation et la caméra
            resetCamera();
            
            // Informer le serveur de la réinitialisation
            if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                webSocket.send(JSON.stringify({
                    type: 'simulationControl',
                    action: 'reset'
                }));
            }
            
            // Mettre à jour l'interface
            playPauseButton.textContent = 'Pause';
            playPauseButton.style.backgroundColor = '#FF9800';
        });
        
        // Contrôle de vitesse
        const speedContainer = document.createElement('div');
        speedContainer.style.display = 'flex';
        speedContainer.style.alignItems = 'center';
        speedContainer.style.gap = '8px';
        
        const speedLabel = document.createElement('label');
        speedLabel.textContent = 'Vitesse:';
        speedLabel.style.color = 'white';
        
        const speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.min = '0.5';
        speedSlider.max = '5';
        speedSlider.step = '0.5';
        speedSlider.value = simulationControls.speed.toString();
        
        const speedValue = document.createElement('span');
        speedValue.textContent = simulationControls.speed + 'x';
        speedValue.style.color = 'white';
        
        speedSlider.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const speed = parseFloat(target.value);
            speedValue.textContent = speed + 'x';
            
            setSimulationControls(prev => ({ ...prev, speed }));
            
            if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                webSocket.send(JSON.stringify({
                    type: 'simulationControl',
                    action: 'setSpeed',
                    speed
                }));
            }
        });
        
        speedContainer.appendChild(speedLabel);
        speedContainer.appendChild(speedSlider);
        speedContainer.appendChild(speedValue);
        
        controlsContainer.appendChild(playPauseButton);
        controlsContainer.appendChild(resetButton);
        controlsContainer.appendChild(speedContainer);
        
        cesiumContainerRef.current.appendChild(controlsContainer);
    }, [webSocket, cameraFollowMode, resetCamera, addCameraFollowButton, simulationControls]);

    // Fonction pour visualiser les bâtiments et les routes
    const visualizeBuildingsAndRoads = React.useCallback(async (
        buildings: Building[],
        roads: RoadSegment[]
    ) => {
        if (!cesiumViewer.current) return;
        
        // Visualiser les bâtiments
        buildings.forEach((building, index) => {
            // Créer les positions pour le polygone du bâtiment
            const positions = building.footprint.map(coord => 
                CesiumJs.Cartesian3.fromDegrees(coord.lng, coord.lat)
            );
            
            // Créer une entité pour le bâtiment
            cesiumViewer.current?.entities.add({
                name: `Building-${index}`,
                polygon: {
                    hierarchy: new CesiumJs.PolygonHierarchy(positions),
                    material: CesiumJs.Color.DARKGRAY.withAlpha(0.7),
                    outline: true,
                    outlineColor: CesiumJs.Color.BLACK,
                    outlineWidth: 1,
                    height: 0,
                    extrudedHeight: building.height // Hauteur du bâtiment
                }
            });
        });
        
        // Visualiser les routes
        roads.forEach((road, index) => {
            const positions = road.path.map(coord => 
                CesiumJs.Cartesian3.fromDegrees(coord.lng, coord.lat, 1) // Léger décalage en hauteur
            );
            
            // Déterminer le style de la route selon son type
            let color;
            let width;
            
            switch(road.type) {
                case 'highway':
                    color = CesiumJs.Color.DODGERBLUE;
                    width = road.width || 10;
                    break;
                case 'primary':
                    color = CesiumJs.Color.DEEPSKYBLUE;
                    width = road.width || 8;
                    break;
                case 'secondary':
                    color = CesiumJs.Color.LIGHTSKYBLUE;
                    width = road.width || 6;
                    break;
                case 'residential':
                    color = CesiumJs.Color.LIGHTSTEELBLUE;
                    width = road.width || 4;
                    break;
                default:
                    color = CesiumJs.Color.LIGHTGRAY;
                    width = road.width || 3;
            }
            
            // Créer une entité pour la route
            cesiumViewer.current?.entities.add({
                name: `Road-${index}`,
                polyline: {
                    positions: positions,
                    width: width,
                    material: color.withAlpha(0.7),
                    clampToGround: true
                }
            });
        });
    }, [CesiumJs]);

    // Fonctions pour extraire et stocker les bâtiments et routes
    const loadBuildingsAndRoads = React.useCallback(async (bounds: { 
        minLat: number, maxLat: number, minLng: number, maxLng: number 
    }) => {
        if (!cesiumViewer.current) return;
        
        try {
            // Essayer d'extraire les bâtiments réels de Cesium
            const extractedBuildings = await sampleBuildingHeightsFromCesium(
                cesiumViewer.current,
                bounds,
                0.002 // Résolution d'échantillonnage
            );
            
            if (extractedBuildings.length > 0) {
                setBuildings(extractedBuildings);
                console.log(`Extracted ${extractedBuildings.length} buildings`);
            } else {
                // Si l'extraction a échoué, créer des bâtiments simplifiés
                console.log('Creating simplified buildings');
                const simplifiedBuildings: Building[] = [];
                
                // Créer quelques bâtiments simplifiés dans la zone
                for (let i = 0; i < 10; i++) {
                    const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
                    const lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
                    
                    // Taille du footprint et hauteur du bâtiment
                    const size = 0.0005 + Math.random() * 0.001;
                    const height = 20 + Math.random() * 100;
                    
                    // Créer un périmètre approximatif (carré)
                    const footprint = [
                        { lat: lat - size, lng: lng - size },
                        { lat: lat - size, lng: lng + size },
                        { lat: lat + size, lng: lng + size },
                        { lat: lat + size, lng: lng - size }
                    ];
                    
                    simplifiedBuildings.push({
                        id: `building-${i}`,
                        position: { lat, lng },
                        height,
                        footprint,
                        type: 'generated'
                    });
                }
                
                setBuildings(simplifiedBuildings);
            }
            
            // Essayer d'extraire les routes réelles de Cesium
            const extractedRoads = await extractRoadsFromCesium(
                cesiumViewer.current,
                bounds
            );
            
            if (extractedRoads.length > 2) { // Si on a plus que les deux routes par défaut
                setRoads(extractedRoads);
                console.log(`Extracted ${extractedRoads.length} roads`);
            } else {
                // Si l'extraction a échoué, créer une grille de routes simplifiée
                console.log('Creating simplified road grid');
                const simplifiedRoads = generateSimplifiedRoadGrid(bounds, 0.005);
                setRoads(simplifiedRoads);
            }
        } catch (error) {
            console.error('Error loading buildings and roads:', error);
            
            // Fallback à des données simplifiées
            setBuildings([]);
            setRoads(generateSimplifiedRoadGrid(bounds, 0.005));
        }
    }, [cesiumViewer.current]);

    // Gestion du plan de vol créé - version améliorée
    const handleFlightPlanCreated = React.useCallback((plan: FlightPlan) => {
        setCurrentFlightPlan(plan);
        
        // Déterminer le type de mission en fonction du type d'optimisation
        let newMissionType = MissionType.NORMAL;
        switch(plan.optimizationType) {
            case OptimizationType.FASTEST:
                newMissionType = MissionType.URGENT;
                break;
            case OptimizationType.FUEL_EFFICIENT:
                newMissionType = MissionType.DELIVERY;
                break;
            case OptimizationType.SAFE:
                newMissionType = MissionType.NORMAL;
                break;
            case OptimizationType.COMFORTABLE:
                newMissionType = MissionType.SIGHTSEEING;
                break;
            case OptimizationType.AVOID_ZONES:
                newMissionType = MissionType.NORMAL;
                break;
        }
        setMissionType(newMissionType);
        
        // Calculer les limites de la région d'intérêt
        const bounds = {
            minLat: Math.min(plan.startPosition.lat, plan.endPosition.lat) - 0.05,
            maxLat: Math.max(plan.startPosition.lat, plan.endPosition.lat) + 0.05,
            minLng: Math.min(plan.startPosition.lng, plan.endPosition.lng) - 0.05,
            maxLng: Math.max(plan.startPosition.lng, plan.endPosition.lng) + 0.05
        };
        
        // Charger les bâtiments et routes pour cette région
        loadBuildingsAndRoads(bounds).then(() => {
            // Générer uniquement des obstacles aléatoires dans cette région
            import('../utils/navigationAlgorithms').then(({ generateTestObstacles }) => {
                const obstacles = generateTestObstacles(bounds, 3); // Moins d'obstacles aléatoires
                
                // Visualiser uniquement les obstacles
                visualizeObstacles(obstacles);
                
                // Visualiser les bâtiments et les routes
                visualizeBuildingsAndRoads(buildings, roads);
                
                // Envoyer les données au serveur
                if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                    webSocket.send(JSON.stringify({
                        type: 'obstacles',
                        obstacles: [...obstacles, ...convertBuildingsToObstacles(buildings)]
                    }));
                    
                    // Calculer un chemin optimal avec le nouvel algorithme
                    const startPos: Position = {
                        lat: plan.startPosition.lat,
                        lng: plan.startPosition.lng,
                        alt: plan.minAltitude
                    };
                    
                    const endPos: Position = {
                        lat: plan.endPosition.lat,
                        lng: plan.endPosition.lng,
                        alt: plan.minAltitude
                    };
                    
                    // Utiliser notre nouvel algorithme avancé pour la planification de trajectoire
                    const optimizedPath = findOptimalPath(
                        startPos,
                        endPos,
                        buildings,
                        roads,
                        newMissionType,
                        obstacles,
                        [], // Aucune condition météo
                        0.005,
                        2000
                    );
                    
                    // Générer le profil d'altitude
                    const enhancedPath = generateAltitudeProfile(
                        optimizedPath,
                        plan.minAltitude,
                        plan.maxAltitude,
                        plan.optimizationType
                    );
                    
                    // Mettre à jour le plan avec le chemin optimisé
                    const updatedPlan = {
                        ...plan,
                        waypoints: enhancedPath
                    };
                    
                    // Visualiser le chemin optimisé
                    visualizeFlightPath(updatedPlan);
                    
                    // Envoyer le plan mis à jour au serveur
                    sendFlightPlanToServer(updatedPlan);
                }
            });
        });
        
        // Ajouter les contrôles de simulation
        addSimulationControls();
    }, [
        addSimulationControls, 
        buildings, 
        convertBuildingsToObstacles, 
        generateAltitudeProfile, 
        loadBuildingsAndRoads, 
        roads, 
        sendFlightPlanToServer, 
        visualizeBuildingsAndRoads, 
        visualizeFlightPath, 
        visualizeObstacles, 
        webSocket
    ]);

    const initializeCesiumJs = React.useCallback(async () => {
        if (cesiumViewer.current !== null) {
            // Optimisations pour GPS: réduire les détails du terrain et des bâtiments
            const osmBuildingsTileset = await CesiumJs.createOsmBuildingsAsync();
            osmBuildingsTileset.maximumScreenSpaceError = 16; // Valeur plus élevée = moins de détails
            
            // Nettoyer les primitives potentiellement existantes
            cleanUpPrimitives();
            
            // Nettoyer l'entité drone en temps réel s'il en existe déjà une
            cleanUpRealTimeEntity();

            // Ajouter le tileset et le suivre pour le nettoyage en cas de re-rendu
            const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
            addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
            
            // Positionner la caméra
            resetCamera();

            // Réduire le nombre de positions avec des ellipses pour une meilleure lisibilité
            // Ne garder que les 5 positions les plus importantes ou pertinentes
            const filteredPositions = positions.slice(0, 5);
            filteredPositions.forEach(p => {
                cesiumViewer.current?.entities.add({
                    position: CesiumJs.Cartesian3.fromDegrees(p.lng, p.lat),
                    ellipse: {
                        semiMinorAxis: 30000.0, // Réduire la taille pour moins encombrer la carte
                        semiMajorAxis: 30000.0,
                        height: 0,
                        material: CesiumJs.Color.RED.withAlpha(0.6),
                        outline: true,
                        outlineColor: CesiumJs.Color.BLACK,
                        outlineWidth: 2.0, // Plus visible pour GPS
                    }
                });
            });

            // Ajouter l'entité en temps réel avec un modèle 3D de drone
            const entity = cesiumViewer.current.entities.add({
                position: CesiumJs.Cartesian3.fromDegrees(2.430, 48.632, 200),
                orientation: new CesiumJs.VelocityOrientationProperty(
                    new CesiumJs.SampledPositionProperty()
                ),
                model: {
                    uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb',
                    minimumPixelSize: 128, // Augmenté pour meilleure visibilité (était 64)
                    maximumScale: 3.0, // Augmenté (était 1.0)
                    silhouetteColor: CesiumJs.Color.CYAN, // Changé pour un contour plus visible
                    silhouetteSize: 3.0, // Plus épais (était 2.0)
                    scale: 10.0,  // Taille augmentée (était 6.0)
                    heightReference: CesiumJs.HeightReference.RELATIVE_TO_GROUND,
                    runAnimations: true,
                    nodeTransformations: {
                        // Configurations supplémentaires pour animer le drone
                        Propeller: new CesiumJs.TranslationRotationScale(
                            new CesiumJs.Cartesian3(0, 0, 0),    // translation
                            CesiumJs.Quaternion.fromAxisAngle(   // rotation
                                CesiumJs.Cartesian3.UNIT_X,
                                CesiumJs.Math.toRadians(0)
                            ),
                            new CesiumJs.Cartesian3(1, 1, 1)     // scale
                        )
                    }
                },
                label: {
                    text: 'Drone GPS-4D',
                    font: '18px sans-serif', // Police plus grande (était 16px)
                    style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                    fillColor: CesiumJs.Color.WHITE,
                    outlineWidth: 3, // Plus épais (était 2)
                    outlineColor: CesiumJs.Color.BLACK,
                    pixelOffset: new CesiumJs.Cartesian2(0, -100), // Déplacé plus bas (était -80)
                    showBackground: true,
                    backgroundColor: CesiumJs.Color.DARKBLUE.withAlpha(0.7), // Changé (était BLACK)
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    eyeOffset: new CesiumJs.Cartesian3(0, 0, 10)
                },
                // Propriété pour gérer l'orientation en fonction de la direction du mouvement
                viewFrom: new CesiumJs.Cartesian3(-30, 0, 20),
                // Ajouter un halo lumineux autour du drone pour une meilleure visibilité
                ellipsoid: {
                    radii: new CesiumJs.Cartesian3(15, 15, 15),
                    material: new CesiumJs.PolylineGlowMaterialProperty({
                        glowPower: 0.15,
                        color: CesiumJs.Color.AQUA.withAlpha(0.3)
                    }),
                    outline: true,
                    outlineColor: CesiumJs.Color.CYAN.withAlpha(0.8)
                },
                path: {
                    show: true,
                    leadTime: 0,
                    trailTime: 120, // Plus long pour voir l'historique (était 60)
                    width: 5, // Plus large (était 3)
                    material: new CesiumJs.PolylineGlowMaterialProperty({
                        glowPower: 0.2, // Plus intense (était 0.1)
                        color: CesiumJs.Color.AQUA // Changé (était CYAN)
                    })
                }
            });
            setRealTimeEntity(entity);

            // Ajouter les zones avec une meilleure visibilité
            addZones(zones);
            
            // Ajouter le bouton de suivi de caméra
            addCameraFollowButton();

            setIsLoaded(true);
        }
    }, [positions, addZones, cleanUpPrimitives, resetCamera, addCameraFollowButton, CesiumJs, cleanUpRealTimeEntity]);

    React.useEffect(() => {
        if (!isLoaded) return;

        // Connexion WebSocket pour les mises à jour de position en temps réel
        const socket = new WebSocket('ws://localhost:8081/trajectory');
        setWebSocket(socket);
        
        socket.onmessage = function (event) {
            const data = JSON.parse(event.data);
            const position = CesiumJs.Cartesian3.fromDegrees(data.longitude, data.latitude, data.altitude);

            if (realTimeEntity) {
                // Mettre à jour la position
                realTimeEntity.position = new CesiumJs.ConstantPositionProperty(position);
                
                // Utiliser les nouvelles données d'orientation (yaw, pitch, roll) pour des mouvements plus réalistes
                if (data.yaw !== undefined && data.pitch !== undefined && data.roll !== undefined) {
                    // Créer une orientation en fonction des angles reçus
                    const heading = CesiumJs.Math.toRadians(data.yaw);
                    const pitch = CesiumJs.Math.toRadians(data.pitch);
                    const roll = CesiumJs.Math.toRadians(data.roll);
                    
                    const orientation = CesiumJs.Transforms.headingPitchRollQuaternion(
                        position,
                        new CesiumJs.HeadingPitchRoll(heading, pitch, roll)
                    );
                    
                    realTimeEntity.orientation = new CesiumJs.ConstantProperty(orientation);
                } else {
                    // Calculer l'orientation du drone en fonction de son déplacement (méthode de secours)
                    // Récupérer l'heure actuelle pour les propriétés temporelles
                    const currentTime = cesiumViewer.current?.clock.currentTime || CesiumJs.JulianDate.now();
                    
                    // Mettre à jour l'orientation du modèle en fonction de la direction du mouvement
                    if (cesiumViewer.current && position) {
                        // Créer une propriété de position échantillonnée pour permettre l'orientation basée sur la vélocité
                        const sampledPosition = new CesiumJs.SampledPositionProperty();
                        sampledPosition.addSample(currentTime, position);
                        
                        // Utiliser une propriété d'orientation basée sur la vélocité pour orienter automatiquement le drone
                        const velocityOrientation = new CesiumJs.VelocityOrientationProperty(sampledPosition);
                        realTimeEntity.orientation = velocityOrientation;
                    }
                }
                
                // Ajouter des effets visuels en fonction de la turbulence
                if (data.turbulence !== undefined && realTimeEntity.ellipsoid) {
                    // Ajuster la taille du halo en fonction de la turbulence
                    const turbulenceFactor = Math.max(1, data.turbulence); 
                    // Utiliser un type plus général pour éviter les erreurs de namespace
                    const ellipsoidGraphics = realTimeEntity.ellipsoid;
                    
                    // Mettre à jour les radii de l'ellipsoïde
                    const baseSize = 15;
                    const newRadii = new CesiumJs.Cartesian3(
                        baseSize * turbulenceFactor,
                        baseSize * turbulenceFactor,
                        baseSize * turbulenceFactor
                    );
                    
                    ellipsoidGraphics.radii = new CesiumJs.ConstantProperty(newRadii);
                    
                    // Changer la couleur en fonction de la turbulence
                    const colorIntensity = Math.min(1, data.turbulence / 5);
                    const haloColor = CesiumJs.Color.fromAlpha(
                        CesiumJs.Color.lerp(
                            CesiumJs.Color.AQUA, 
                            CesiumJs.Color.RED, 
                            colorIntensity, 
                            new CesiumJs.Color()
                        ),
                        0.3 + (colorIntensity * 0.2)
                    );
                    
                    // Appliquer une nouvelle couleur au matériau 
                    // Sans accéder directement à la propriété color qui peut ne pas exister
                    if (ellipsoidGraphics.material) {
                        // Recréer un nouveau matériau complètement pour éviter les problèmes de type
                        ellipsoidGraphics.material = new CesiumJs.PolylineGlowMaterialProperty({
                            glowPower: 0.15,
                            color: haloColor
                        });
                    }
                }
                
                // Mettre à jour le chemin parcouru
                if (realTimeEntity.path) {
                    // Utiliser la ConstantProperty pour définir la propriété show
                    realTimeEntity.path.show = new CesiumJs.ConstantProperty(true);
                }
                
                // Si le mode de suivi de caméra est activé, déplacer la caméra avec l'entité
                if (cameraFollowMode && cesiumViewer.current) {
                    // Ajuster la position de la caméra en fonction de l'orientation du drone
                    // pour un suivi plus naturel
                    cesiumViewer.current.camera.setView({
                        destination: CesiumJs.Cartesian3.fromDegrees(
                            data.longitude, 
                            data.latitude, 
                            data.altitude + 100 // Hauteur adaptée au drone
                        ),
                        orientation: {
                            heading: cesiumViewer.current.camera.heading,
                            pitch: CesiumJs.Math.toRadians(-30), // Vue légèrement plus rasante
                            roll: 0.0
                        }
                    });
                }
                
                // Mettre à jour l'interface avec des informations sur le vol
                if (data.flightMode && data.totalWaypoints) {
                    const progressInfo = document.querySelector('.flight-progress-info');
                    if (progressInfo) {
                        progressInfo.textContent = `Waypoint: ${data.waypointIndex + 1}/${data.totalWaypoints}`;
                    } else if (cesiumContainerRef.current && data.totalWaypoints > 0) {
                        // Créer un élément pour afficher la progression
                        const infoElement = document.createElement('div');
                        infoElement.className = 'flight-progress-info';
                        infoElement.style.position = 'absolute';
                        infoElement.style.top = '20px';
                        infoElement.style.left = '20px';
                        infoElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
                        infoElement.style.color = 'white';
                        infoElement.style.padding = '10px';
                        infoElement.style.borderRadius = '4px';
                        infoElement.style.zIndex = '1000';
                        infoElement.textContent = `Waypoint: ${data.waypointIndex + 1}/${data.totalWaypoints}`;
                        cesiumContainerRef.current.appendChild(infoElement);
                    }
                }
            }
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed');
            setWebSocket(null);
        };

        return () => {
            socket.close();
        };
    }, [isLoaded, CesiumJs, realTimeEntity, cameraFollowMode]);

    React.useEffect(() => {
        if (cesiumViewer.current === null && cesiumContainerRef.current) {
            //OPTIONAL: Assign access Token here
            //Guide: https://cesium.com/learn/ion/cesium-ion-access-tokens/
            CesiumJs.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

            //NOTE: Always utilize CesiumJs; do not import them from "cesium"
            cesiumViewer.current = new CesiumJs.Viewer(cesiumContainerRef.current, {
                // Configuration optimisée pour GPS
                terrain: CesiumJs.Terrain.fromWorldTerrain({
                    requestVertexNormals: false, // Désactiver pour économiser de la bande passante
                    requestWaterMask: false      // Désactiver pour économiser de la bande passante
                }),
                baseLayerPicker: true,
                geocoder: true,
                navigationHelpButton: false,     // Simplifier l'interface
                homeButton: true,
                sceneModePicker: false,          // Simplifier l'interface
                animation: false,                // Simplifier l'interface
                timeline: false,                 // Simplifier l'interface
                fullscreenButton: true,
                infoBox: false,                  // Simplifier l'interface
                selectionIndicator: false,       // Simplifier l'interface
                scene3DOnly: true,               // Optimisation des performances
                shadows: false,                  // Désactiver pour améliorer les performances
                terrainShadows: CesiumJs.ShadowMode.DISABLED,
                shouldAnimate: true
            });

            // Optimisations supplémentaires
            if (cesiumViewer.current.scene) {
                // Réduire la qualité du terrain pour de meilleures performances
                cesiumViewer.current.scene.globe.maximumScreenSpaceError = 4;
                
                // Désactiver les effets post-traitement pour améliorer les performances
                cesiumViewer.current.scene.postProcessStages.fxaa.enabled = false;
                
                // Réduire la complexité du rendu
                cesiumViewer.current.scene.fog.enabled = false;
                cesiumViewer.current.scene.skyAtmosphere.show = true; // Conserver pour le contexte visuel
                
                // Améliorer la visibilité des éléments dans des conditions lumineuses variables
                cesiumViewer.current.scene.globe.enableLighting = false;
            }

            //NOTE: Example of configuring a Cesium viewer
            cesiumViewer.current.clock.clockStep = CesiumJs.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
        }
        
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (isLoaded) return;
        initializeCesiumJs();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positions, isLoaded]);

    //NOTE: Examples of typing... See above on "import type"
    const entities: Entity[] = [];
    //NOTE: Example of a function that utilizes CesiumJs features
    const julianDate = dateToJulianDate(CesiumJs, new Date());

    return (
        <>
            <div
                ref={cesiumContainerRef}
                id='cesium-container'
                style={{ height: '100vh', width: '100vw' }}
            />
            <HUD viewer={cesiumViewer.current!} currentWeather={currentWeather} Cesium={CesiumJs} />
            {isLoaded && (
                <FlightPlanner 
                    availableLocations={zones} 
                    onPlanCreated={handleFlightPlanCreated} 
                />
            )}
        </>
    )
}

export default CesiumComponent