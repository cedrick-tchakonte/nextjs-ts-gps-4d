'use client'

import React from 'react'
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
    const [cameraFollowMode, setCameraFollowMode] = React.useState(true);
    const [webSocket, setWebSocket] = React.useState<WebSocket | null>(null);
    const [currentFlightPlan, setCurrentFlightPlan] = React.useState<FlightPlan | null>(null);
    const [flightPathEntities, setFlightPathEntities] = React.useState<Entity[]>([]);
    const [simulationControls, setSimulationControls] = React.useState({
        isPlaying: true,
        speed: 1
    });

    const resetCamera = React.useCallback(async () => {
        // Set the initial camera to look at a default location
        if (cesiumViewer.current !== null) {
            cesiumViewer.current.scene.camera.setView({
                destination: CesiumJs.Cartesian3.fromDegrees(2.2147, 48.7108, 500),
                orientation: {
                  heading: CesiumJs.Math.toRadians(10),
                  pitch: CesiumJs.Math.toRadians(-45),
                },
              });
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

    // Gestion du plan de vol créé
    const handleFlightPlanCreated = React.useCallback((plan: FlightPlan) => {
        setCurrentFlightPlan(plan);
        visualizeFlightPath(plan);
        sendFlightPlanToServer(plan);
        
        // Ajouter un bouton de contrôle pour réinitialiser la simulation
        addSimulationControls();
    }, [visualizeFlightPath, sendFlightPlanToServer]);

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
            if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                webSocket.send(JSON.stringify({
                    type: 'simulationControl',
                    action: 'reset'
                }));
            }
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
        speedSlider.value = '1';
        
        const speedValue = document.createElement('span');
        speedValue.textContent = '1x';
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
        
        controlsContainer.appendChild(resetButton);
        controlsContainer.appendChild(speedContainer);
        
        cesiumContainerRef.current.appendChild(controlsContainer);
    }, [webSocket]);

    const toggleCameraFollowMode = React.useCallback(() => {
        setCameraFollowMode(!cameraFollowMode);
    }, [cameraFollowMode]);

    // Fonction pour ajouter un contrôle de suivi à l'interface
    const addCameraFollowButton = React.useCallback(() => {
        if (!cesiumViewer.current || !cesiumContainerRef.current) return;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'camera-follow-button';
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '30px';
        buttonContainer.style.right = '30px';
        buttonContainer.style.zIndex = '1000';
        
        const button = document.createElement('button');
        button.textContent = 'Suivre la position';
        button.style.padding = '10px';
        button.style.backgroundColor = cameraFollowMode ? '#4CAF50' : '#f1f1f1';
        button.style.color = cameraFollowMode ? 'white' : 'black';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        
        button.addEventListener('click', () => {
            toggleCameraFollowMode();
            button.style.backgroundColor = !cameraFollowMode ? '#4CAF50' : '#f1f1f1';
            button.style.color = !cameraFollowMode ? 'white' : 'black';
        });
        
        buttonContainer.appendChild(button);
        cesiumContainerRef.current.appendChild(buttonContainer);
    }, [cameraFollowMode, toggleCameraFollowMode]);

    const initializeCesiumJs = React.useCallback(async () => {
        if (cesiumViewer.current !== null) {
            // Optimisations pour GPS: réduire les détails du terrain et des bâtiments
            const osmBuildingsTileset = await CesiumJs.createOsmBuildingsAsync();
            osmBuildingsTileset.maximumScreenSpaceError = 16; // Valeur plus élevée = moins de détails
            
            // Nettoyer les primitives potentiellement existantes
            cleanUpPrimitives();

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

            // Ajouter l'entité en temps réel avec une meilleure visibilité
            const entity = cesiumViewer.current.entities.add({
                position: CesiumJs.Cartesian3.fromDegrees(2.430, 48.632, 200),
                point: {
                    pixelSize: 24, // Augmenter pour meilleure visibilité
                    color: CesiumJs.Color.YELLOW,
                    outlineColor: CesiumJs.Color.BLACK,
                    outlineWidth: 2,
                },
                billboard: {
                    image: 'https://cesium.com/docs/tutorials/creating-entities/images/NavigationIcon.png',
                    scale: 0.5,
                    heightReference: CesiumJs.HeightReference.RELATIVE_TO_GROUND,
                },
                label: {
                    text: 'Position Actuelle',
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
            setRealTimeEntity(entity);

            // Ajouter les zones avec une meilleure visibilité
            addZones(zones);
            
            // Ajouter le bouton de suivi de caméra
            addCameraFollowButton();

            setIsLoaded(true);
        }
    }, [positions, addZones, cleanUpPrimitives, resetCamera, addCameraFollowButton, CesiumJs]);

    React.useEffect(() => {
        if (!isLoaded) return;

        // Connexion WebSocket pour les mises à jour de position en temps réel
        const socket = new WebSocket('ws://localhost:8081/trajectory');
        setWebSocket(socket);
        
        socket.onmessage = function (event) {
            const data = JSON.parse(event.data);
            const position = CesiumJs.Cartesian3.fromDegrees(data.longitude, data.latitude, data.altitude);

            if (realTimeEntity) {
                realTimeEntity.position = new CesiumJs.ConstantPositionProperty(position);
                
                // Si le mode de suivi de caméra est activé, déplacer la caméra avec l'entité
                if (cameraFollowMode && cesiumViewer.current) {
                    cesiumViewer.current.camera.flyTo({
                        destination: CesiumJs.Cartesian3.fromDegrees(
                            data.longitude, 
                            data.latitude, 
                            data.altitude + 300 // Hauteur de la caméra au-dessus de l'entité
                        ),
                        orientation: {
                            heading: cesiumViewer.current.camera.heading,
                            pitch: CesiumJs.Math.toRadians(-45),
                            roll: 0.0
                        },
                        duration: 0.5 // Transition douce mais rapide
                    });
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