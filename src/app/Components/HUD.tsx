import React, { useEffect, useRef } from 'react';
import type { Viewer, Cartesian3, Cartographic } from 'cesium';

const HUD: React.FunctionComponent<{
    viewer: Viewer | null; // Allow viewer to be null initially
    currentWeather: { windSpeed: number };
    Cesium: typeof import('cesium');
}> = ({ viewer, currentWeather, Cesium }) => {
    const lastPositionRef = useRef<Cartesian3 | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!viewer) return; // Exit early if viewer is null

        function updateHUD() {
            if (!viewer) return; // Ensure viewer is still valid

            const now = Date.now();
            const dt = (now - lastUpdateTimeRef.current) / 1000;
            lastUpdateTimeRef.current = now;

            const position = Cesium.Cartographic.fromCartesian(viewer.camera.position);
            const speed = lastPositionRef.current
                ? Cesium.Cartesian3.distance(viewer.camera.position, lastPositionRef.current) / dt * 1.94384
                : 0;

            document.getElementById('altValue')!.textContent = Math.round(position.height).toString();
            document.getElementById('spdValue')!.textContent = Math.round(speed).toString();
            document.getElementById('hdgValue')!.textContent = Math.round(Cesium.Math.toDegrees(viewer.camera.heading))
                .toString()
                .padStart(3, '0');
            document.getElementById('wxValue')!.textContent = `${currentWeather.windSpeed} kt`;

            lastPositionRef.current = Cesium.Cartesian3.clone(viewer.camera.position);
            requestAnimationFrame(updateHUD);
        }

        updateHUD();
    }, [viewer, currentWeather, Cesium]);

    return (
        <div className="hud-container">
            <div className="hud-item">
                <span>ALT:</span> <span id="altValue">0</span> ft
            </div>
            <div className="hud-item">
                <span>SPD:</span> <span id="spdValue">0</span> kt
            </div>
            <div className="hud-item">
                <span>HDG:</span> <span id="hdgValue">000</span> °
            </div>
            <div className="hud-item">
                <span>WX:</span> <span id="wxValue">0</span>
            </div>
        </div>
    );
};

export default HUD;