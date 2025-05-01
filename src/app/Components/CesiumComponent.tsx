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

    const resetCamera = React.useCallback(async () => {
        // Set the initial camera to look at Seattle
        // No need for dependancies since all data is static for this example.
        if (cesiumViewer.current !== null) {
            cesiumViewer.current.scene.camera.setView({
                destination: CesiumJs.Cartesian3.fromDegrees(2.2147, 48.7108, 500),
                orientation: {
                  heading: CesiumJs.Math.toRadians(10),
                  pitch: CesiumJs.Math.toRadians(-45),
                },
              });
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                                material: CesiumJs.Color.fromCssColorString(type.color).withAlpha(0.5),
                                outline: true,
                                outlineColor: CesiumJs.Color.BLACK,
                            },
                            label: {
                                text: label,
                                font: '14px Arial',
                                style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                                fillColor: CesiumJs.Color.WHITE,
                                pixelOffset: new CesiumJs.Cartesian2(0, -40),
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
                                material: CesiumJs.Color.fromCssColorString(type.color).withAlpha(0.5),
                                outline: true,
                                outlineColor: CesiumJs.Color.BLACK,
                            },
                            label: {
                                text: label,
                                font: '14px Arial',
                                style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                                fillColor: CesiumJs.Color.WHITE,
                                pixelOffset: new CesiumJs.Cartesian2(0, -40),
                            },
                        });
                    }
                }
                
            });
        }
    }, [CesiumJs]);

    const initializeCesiumJs = React.useCallback(async () => {
        if (cesiumViewer.current !== null) {
            //Using the Sandcastle example below
            //https://sandcastle.cesium.com/?src=3D%20Tiles%20Feature%20Styling.html
            const osmBuildingsTileset = await CesiumJs.createOsmBuildingsAsync();
            
            //Clean up potentially already-existing primitives.
            cleanUpPrimitives();

            //Adding tile and adding to addedScenePrimitives to keep track and delete in-case of a re-render.
            const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
            addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
            
            //Position camera per Sandcastle demo
            resetCamera();

            //We'll also add our own data here (In Philadelphia) passed down from props as an example
            positions.forEach(p => {
                cesiumViewer.current?.entities.add({
                    position: CesiumJs.Cartesian3.fromDegrees(p.lng, p.lat),
                    ellipse: {
                        semiMinorAxis: 50000.0,
                        semiMajorAxis: 50000.0,
                        height: 0,
                        material: CesiumJs.Color.RED.withAlpha(0.5),
                        outline: true,
                        outlineColor: CesiumJs.Color.BLACK,
                    }
                });
            });

            // Add real-time entity
            const entity = cesiumViewer.current.entities.add({
                position: CesiumJs.Cartesian3.fromDegrees(2.430, 48.632, 100),
                point: {
                    pixelSize: 20,
                    color: CesiumJs.Color.RED,
                },
                label: {
                    text: 'Real-Time Position',
                    font: '14px Arial',
                    style: CesiumJs.LabelStyle.FILL_AND_OUTLINE,
                    fillColor: CesiumJs.Color.WHITE,
                    pixelOffset: new CesiumJs.Cartesian2(0, -20),
                },
            });
            setRealTimeEntity(entity);

            addZones(zones);

            setIsLoaded(true);
        }
    }, [positions, addZones]);
    React.useEffect(() => {
        if (!isLoaded) return;

        const socket = new WebSocket('ws://localhost:8081/trajectory');
        socket.onmessage = function (event) {
            const data = JSON.parse(event.data);
            const position = CesiumJs.Cartesian3.fromDegrees(data.longitude, data.latitude, data.altitude);

            if (realTimeEntity) {
                realTimeEntity.position = new CesiumJs.ConstantPositionProperty(position);
            }
        };

        return () => {
            socket.close();
        };
    }, [isLoaded, CesiumJs, realTimeEntity]);

    React.useEffect(() => {
        if (cesiumViewer.current === null && cesiumContainerRef.current) {
            //OPTIONAL: Assign access Token here
            //Guide: https://cesium.com/learn/ion/cesium-ion-access-tokens/
            CesiumJs.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

            //NOTE: Always utilize CesiumJs; do not import them from "cesium"
            cesiumViewer.current = new CesiumJs.Viewer(cesiumContainerRef.current, {
                //Using the Sandcastle example below
                //https://sandcastle.cesium.com/?src=3D%20Tiles%20Feature%20Styling.html
                terrain: CesiumJs.Terrain.fromWorldTerrain()
            });

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
        </>
    )
}

export default CesiumComponent