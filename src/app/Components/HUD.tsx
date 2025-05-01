import React, { useEffect, useRef, useState } from 'react';
import type { Viewer, Cartesian3, Cartographic } from 'cesium';

const HUD: React.FunctionComponent<{
    viewer: Viewer | null; // Allow viewer to be null initially
    currentWeather: { windSpeed: number };
    Cesium: typeof import('cesium');
}> = ({ viewer, currentWeather, Cesium }) => {
    const lastPositionRef = useRef<Cartesian3 | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());
    const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
    const [distanceToZones, setDistanceToZones] = useState<{name: string, distance: number}[]>([]);

    // Fonction pour calculer la distance aux zones proches
    const findNearestZones = (position: Cartographic) => {
        if (!viewer) return [];
        
        const entityList = viewer.entities.values;
        const currentPos = Cesium.Cartesian3.fromRadians(position.longitude, position.latitude, position.height);
        
        const distances = entityList
            .filter(entity => entity.label && entity.position) // Seulement les entités avec un label et position
            .map(entity => {
                const entityPosition = entity.position?.getValue(Cesium.JulianDate.now());
                if (!entityPosition) return null;
                
                const distance = Cesium.Cartesian3.distance(currentPos, entityPosition);
                const name = entity.label?.text?.getValue(Cesium.JulianDate.now()) || 'Unknown';
                
                return { name, distance: Math.round(distance) };
            })
            .filter(item => item !== null) as {name: string, distance: number}[];
            
        // Trier par distance et prendre les 3 plus proches
        return distances.sort((a, b) => a.distance - b.distance).slice(0, 3);
    };

    useEffect(() => {
        if (!viewer) return; // Exit early if viewer is null

        function updateHUD() {
            if (!viewer) return; // Ensure viewer is still valid

            const now = Date.now();
            const dt = (now - lastUpdateTimeRef.current) / 1000;
            lastUpdateTimeRef.current = now;

            const position = Cesium.Cartographic.fromCartesian(viewer.camera.position);
            
            // Convertir les coordonnées en degrés pour affichage
            const latDegrees = Cesium.Math.toDegrees(position.longitude);
            const lngDegrees = Cesium.Math.toDegrees(position.latitude);
            setCoordinates({ lat: latDegrees, lng: lngDegrees });
            
            // Calculer la vitesse
            const speed = lastPositionRef.current
                ? Cesium.Cartesian3.distance(viewer.camera.position, lastPositionRef.current) / dt * 1.94384
                : 0;

            // Calculer les zones les plus proches
            const nearestZones = findNearestZones(position);
            setDistanceToZones(nearestZones);

            // Mise à jour des éléments HUD
            document.getElementById('altValue')!.textContent = Math.round(position.height).toString();
            document.getElementById('spdValue')!.textContent = Math.round(speed).toString();
            document.getElementById('hdgValue')!.textContent = Math.round(Cesium.Math.toDegrees(viewer.camera.heading))
                .toString()
                .padStart(3, '0');
            document.getElementById('wxValue')!.textContent = `${currentWeather.windSpeed} kt`;

            // Stocker la position pour le calcul de vitesse
            lastPositionRef.current = Cesium.Cartesian3.clone(viewer.camera.position);
            requestAnimationFrame(updateHUD);
        }

        updateHUD();
    }, [viewer, currentWeather, Cesium]);

    // Formater les coordonnées pour un affichage GPS
    const formatCoordinate = (value: number, isLatitude = false) => {
        const abs = Math.abs(value);
        const degrees = Math.floor(abs);
        const minutesValue = (abs - degrees) * 60;
        const minutes = Math.floor(minutesValue);
        const seconds = Math.floor((minutesValue - minutes) * 60);
        
        const direction = isLatitude 
            ? (value >= 0 ? 'N' : 'S') 
            : (value >= 0 ? 'E' : 'W');
            
        return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
    };

    return (
        <div className="hud-container" style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'sans-serif',
            zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(5px)',
            width: '280px'
        }}>
            <div style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '5px' }}>
                <h3 style={{ margin: '0 0 10px 0', textAlign: 'center', fontSize: '18px' }}>GPS Navigation</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="hud-item" style={{ padding: '5px', backgroundColor: 'rgba(0,120,255,0.2)', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>ALT:</span> <span id="altValue" style={{ float: 'right' }}>0</span> ft
                </div>
                <div className="hud-item" style={{ padding: '5px', backgroundColor: 'rgba(0,120,255,0.2)', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>SPD:</span> <span id="spdValue" style={{ float: 'right' }}>0</span> kt
                </div>
                <div className="hud-item" style={{ padding: '5px', backgroundColor: 'rgba(0,120,255,0.2)', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>HDG:</span> <span id="hdgValue" style={{ float: 'right' }}>000</span>°
                </div>
                <div className="hud-item" style={{ padding: '5px', backgroundColor: 'rgba(0,120,255,0.2)', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>WIND:</span> <span id="wxValue" style={{ float: 'right' }}>0</span>
                </div>
            </div>
            
            <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px' }}>
                <div style={{ marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>LAT: </span>
                    <span>{formatCoordinate(coordinates.lat, true)}</span>
                </div>
                <div style={{ fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>LNG: </span>
                    <span>{formatCoordinate(coordinates.lng, false)}</span>
                </div>
            </div>
            
            {distanceToZones.length > 0 && (
                <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Points d'intérêt proches:</div>
                    {distanceToZones.map((zone, index) => (
                        <div key={index} style={{ fontSize: '13px', marginBottom: '3px' }}>
                            • {zone.name}: {(zone.distance / 1000).toFixed(1)} km
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HUD;