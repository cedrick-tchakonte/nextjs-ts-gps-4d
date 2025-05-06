'use client'

import React, { useState, useEffect } from 'react';
import { Position } from '../types/position';
import { 
    findPathAStar, 
    generateAltitudeProfile, 
    smoothPath,
    generateTestObstacles,
    generateTestWeather,
    NoFlyZone,
    WeatherCondition
} from '../utils/navigationAlgorithms';

// Types d'optimisation de trajectoire
export enum OptimizationType {
    FASTEST = 'fastest',
    FUEL_EFFICIENT = 'fuel_efficient',
    SAFE = 'safe',
    COMFORTABLE = 'comfortable',
    AVOID_ZONES = 'avoid_zones'
}

// Interface pour la trajectoire planifiée
export interface FlightPlan {
    startPosition: { lat: number, lng: number, label: string };
    endPosition: { lat: number, lng: number, label: string };
    optimizationType: OptimizationType;
    waypoints: Position[];
    corridorWidth: number;
    maxAltitude: number;
    minAltitude: number;
}

interface FlightPlannerProps {
    availableLocations: { position: [number, number], label: string }[];
    onPlanCreated: (plan: FlightPlan) => void;
}

const FlightPlanner: React.FC<FlightPlannerProps> = ({ availableLocations, onPlanCreated }) => {
    const [startLocation, setStartLocation] = useState<string>('');
    const [endLocation, setEndLocation] = useState<string>('');
    const [optimizationType, setOptimizationType] = useState<OptimizationType>(OptimizationType.FASTEST);
    const [maxAltitude, setMaxAltitude] = useState<number>(500);
    const [corridorWidth, setCorridorWidth] = useState<number>(200);
    const [isPlanning, setIsPlanning] = useState<boolean>(false);
    
    // Nouvelles structures de données pour les obstacles et la météo
    const [obstacles, setObstacles] = useState<NoFlyZone[]>([]);
    const [weatherConditions, setWeatherConditions] = useState<WeatherCondition[]>([]);
    const [useAdvancedAlgorithm, setUseAdvancedAlgorithm] = useState<boolean>(true);
    const [smoothingFactor, setSmoothingFactor] = useState<number>(0.5);
    const [pathResolution, setPathResolution] = useState<number>(0.005);
    
    // Générer des obstacles et des conditions météo aléatoires lors du premier rendu
    useEffect(() => {
        // Déterminer les limites approximatives de la région d'intérêt
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        
        availableLocations.forEach(location => {
            minLat = Math.min(minLat, location.position[1]);
            maxLat = Math.max(maxLat, location.position[1]);
            minLng = Math.min(minLng, location.position[0]);
            maxLng = Math.max(maxLng, location.position[0]);
        });
        
        // Étendre légèrement les limites
        const padding = 0.05;
        minLat -= padding;
        maxLat += padding;
        minLng -= padding;
        maxLng += padding;
        
        // Générer des obstacles aléatoires
        const newObstacles = generateTestObstacles(
            { minLat, maxLat, minLng, maxLng },
            5 // Nombre d'obstacles
        );
        
        // Générer des conditions météo aléatoires
        const newWeather = generateTestWeather(
            { minLat, maxLat, minLng, maxLng },
            3 // Nombre de zones météo
        );
        
        setObstacles(newObstacles);
        setWeatherConditions(newWeather);
    }, [availableLocations]);

    // Fonction pour trouver une position par son label
    const findPositionByLabel = (label: string) => {
        const location = availableLocations.find(loc => loc.label === label);
        if (!location) return null;
        
        return {
            lat: location.position[1],
            lng: location.position[0],
            label: location.label
        };
    };

    // Génération d'une trajectoire optimisée en utilisant les nouveaux algorithmes
    const generateOptimizedPath = (
        start: { lat: number, lng: number }, 
        end: { lat: number, lng: number }, 
        type: OptimizationType
    ) => {
        // Valeurs par défaut pour les altitudes
        let minAltitude = 100;
        let maxAlt = maxAltitude;
        
        // Ajuster les altitudes en fonction du type d'optimisation
        switch(type) {
            case OptimizationType.FUEL_EFFICIENT:
                maxAlt = 400; // Plus bas pour économiser du carburant
                break;
            case OptimizationType.SAFE:
                minAltitude = 200; // Un peu plus haut pour la sécurité
                break;
            case OptimizationType.COMFORTABLE:
                minAltitude = 300; // Plus haut pour éviter les turbulences
                break;
            case OptimizationType.AVOID_ZONES:
                // Pas de changement d'altitude par défaut
                break;
            default:
                break;
        }
        
        let waypoints: Position[];
        
        // Créer les positions de départ et d'arrivée avec des altitudes
        const startPos: Position = { ...start, alt: minAltitude };
        const endPos: Position = { ...end, alt: minAltitude };
        
        if (useAdvancedAlgorithm) {
            // Utiliser l'algorithme A* pour trouver un chemin optimal évitant les obstacles
            waypoints = findPathAStar(
                startPos,
                endPos,
                obstacles,
                weatherConditions,
                pathResolution // Résolution de la grille
            );
            
            // Lisser le chemin pour éviter les zigzags abruptes
            waypoints = smoothPath(waypoints, smoothingFactor);
        } else {
            // Méthode simple en ligne droite (comme avant) pour comparaison
            const distance = Math.sqrt(
                Math.pow(end.lat - start.lat, 2) + 
                Math.pow(end.lng - start.lng, 2)
            );
            
            const numPoints = Math.max(10, Math.floor(distance * 7000));
            waypoints = [];
            
            for (let i = 0; i <= numPoints; i++) {
                const ratio = i / numPoints;
                const lat = start.lat + (end.lat - start.lat) * ratio;
                const lng = start.lng + (end.lng - start.lng) * ratio;
                
                waypoints.push({ lat, lng });
            }
        }
        
        // Générer le profil d'altitude pour tous les waypoints
        waypoints = generateAltitudeProfile(
            waypoints,
            minAltitude,
            maxAlt,
            type
        );
        
        // Retourner les données nécessaires pour le plan de vol
        return {
            waypoints,
            minAltitude,
            maxAltitude: maxAlt
        };
    };

    const handleCreatePlan = () => {
        const start = findPositionByLabel(startLocation);
        const end = findPositionByLabel(endLocation);
        
        if (!start || !end) {
            alert('Veuillez sélectionner des lieux de départ et d\'arrivée valides');
            return;
        }
        
        setIsPlanning(true);
        
        // Simuler un temps de calcul (plus long pour l'algorithme avancé)
        setTimeout(() => {
            try {
                const { waypoints, minAltitude, maxAltitude: maxAlt } = generateOptimizedPath(
                    start, 
                    end, 
                    optimizationType
                );
                
                const plan: FlightPlan = {
                    startPosition: start,
                    endPosition: end,
                    optimizationType,
                    waypoints,
                    corridorWidth,
                    maxAltitude: maxAlt,
                    minAltitude
                };
                
                onPlanCreated(plan);
            } catch (error) {
                console.error("Erreur lors du calcul de la trajectoire:", error);
                alert("Une erreur est survenue lors du calcul de la trajectoire. Veuillez réessayer.");
            } finally {
                setIsPlanning(false);
            }
        }, useAdvancedAlgorithm ? 1500 : 1000);
    };

    return (
        <div className="flight-planner" style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            zIndex: 1000,
            width: '300px',
            fontFamily: 'sans-serif'
        }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Planificateur de Vol</h3>
            
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="start-location" style={{ display: 'block', marginBottom: '5px' }}>
                    Départ:
                </label>
                <select 
                    id="start-location"
                    value={startLocation} 
                    onChange={(e) => setStartLocation(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '8px',
                        backgroundColor: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px'
                    }}
                >
                    <option value="">Sélectionner un lieu de départ</option>
                    {availableLocations
                        .filter(loc => loc.label.includes('LANDING') || loc.label.includes('Atterrissage'))
                        .map((loc, index) => (
                            <option key={`start-${index}`} value={loc.label}>
                                {loc.label}
                            </option>
                        ))
                    }
                </select>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="end-location" style={{ display: 'block', marginBottom: '5px' }}>
                    Arrivée:
                </label>
                <select 
                    id="end-location"
                    value={endLocation} 
                    onChange={(e) => setEndLocation(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '8px',
                        backgroundColor: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px'
                    }}
                >
                    <option value="">Sélectionner un lieu d'arrivée</option>
                    {availableLocations
                        .filter(loc => loc.label.includes('LANDING') || loc.label.includes('Atterrissage'))
                        .map((loc, index) => (
                            <option key={`end-${index}`} value={loc.label}>
                                {loc.label}
                            </option>
                        ))
                    }
                </select>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="optimization-type" style={{ display: 'block', marginBottom: '5px' }}>
                    Type d'optimisation:
                </label>
                <select 
                    id="optimization-type"
                    value={optimizationType} 
                    onChange={(e) => setOptimizationType(e.target.value as OptimizationType)}
                    style={{ 
                        width: '100%', 
                        padding: '8px',
                        backgroundColor: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px'
                    }}
                >
                    <option value={OptimizationType.FASTEST}>Plus rapide</option>
                    <option value={OptimizationType.FUEL_EFFICIENT}>Économie de carburant</option>
                    <option value={OptimizationType.SAFE}>Sécurité maximale</option>
                    <option value={OptimizationType.COMFORTABLE}>Confort passagers</option>
                    <option value={OptimizationType.AVOID_ZONES}>Éviter zones sensibles</option>
                </select>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="max-altitude" style={{ display: 'block', marginBottom: '5px' }}>
                    Altitude maximale (m): {maxAltitude}
                </label>
                <input 
                    id="max-altitude"
                    type="range" 
                    min="200" 
                    max="1000" 
                    step="50"
                    value={maxAltitude} 
                    onChange={(e) => setMaxAltitude(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
                <label htmlFor="corridor-width" style={{ display: 'block', marginBottom: '5px' }}>
                    Largeur du couloir (m): {corridorWidth}
                </label>
                <input 
                    id="corridor-width"
                    type="range" 
                    min="50" 
                    max="500" 
                    step="50"
                    value={corridorWidth} 
                    onChange={(e) => setCorridorWidth(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>
            
            {/* Nouveaux contrôles pour les algorithmes avancés */}
            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={useAdvancedAlgorithm} 
                        onChange={(e) => setUseAdvancedAlgorithm(e.target.checked)}
                    />
                    Utiliser l'algorithme avancé
                </label>
            </div>
            
            {useAdvancedAlgorithm && (
                <>
                    <div style={{ marginBottom: '10px' }}>
                        <label htmlFor="smoothing" style={{ display: 'block', marginBottom: '5px' }}>
                            Lissage de trajectoire: {smoothingFactor.toFixed(1)}
                        </label>
                        <input 
                            id="smoothing"
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1"
                            value={smoothingFactor} 
                            onChange={(e) => setSmoothingFactor(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="resolution" style={{ display: 'block', marginBottom: '5px' }}>
                            Résolution: {pathResolution.toFixed(4)}
                        </label>
                        <input 
                            id="resolution"
                            type="range" 
                            min="0.001" 
                            max="0.01" 
                            step="0.001"
                            value={pathResolution} 
                            onChange={(e) => setPathResolution(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                </>
            )}
            
            <button 
                onClick={handleCreatePlan}
                disabled={!startLocation || !endLocation || isPlanning}
                style={{ 
                    width: '100%',
                    padding: '10px',
                    backgroundColor: (!startLocation || !endLocation || isPlanning) ? '#555' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!startLocation || !endLocation || isPlanning) ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                }}
            >
                {isPlanning ? 'Calcul en cours...' : 'Calculer la trajectoire'}
            </button>
        </div>
    );
};

export default FlightPlanner;