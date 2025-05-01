'use client'

import React, { useState, useEffect } from 'react';
import { Position } from '../types/position';

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

    // Génération d'une trajectoire optimisée (simulée)
    const generateOptimizedPath = (start: { lat: number, lng: number }, end: { lat: number, lng: number }, type: OptimizationType) => {
        const waypoints: Position[] = [];
        
        // Calculer la distance directe
        const distance = Math.sqrt(
            Math.pow(end.lat - start.lat, 2) + 
            Math.pow(end.lng - start.lng, 2)
        );
        
        // Calculer le nombre de points intermédiaires (plus la distance est grande, plus il y a de points)
        const numPoints = Math.max(5, Math.floor(distance * 5000));
        
        // Définir l'altitude en fonction du type d'optimisation
        let minAltitude = 100;
        let maxAlt = maxAltitude;
        
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
                // Sinusoïdal pour éviter certaines zones
                break;
            default:
                break;
        }
        
        // Créer les points de la trajectoire
        for (let i = 0; i <= numPoints; i++) {
            const ratio = i / numPoints;
            const lat = start.lat + (end.lat - start.lat) * ratio;
            const lng = start.lng + (end.lng - start.lng) * ratio;
            
            // Variation d'altitude en fonction de la phase de vol (montée, croisière, descente)
            let altitude;
            if (i < numPoints * 0.2) {
                // Phase de montée
                altitude = minAltitude + (maxAlt - minAltitude) * (i / (numPoints * 0.2));
            } else if (i > numPoints * 0.8) {
                // Phase de descente
                const descentRatio = (i - numPoints * 0.8) / (numPoints * 0.2);
                altitude = maxAlt - (maxAlt - minAltitude) * descentRatio;
            } else {
                // Phase de croisière
                altitude = maxAlt;
            }
            
            // Ajouter des variations selon le type d'optimisation
            if (type === OptimizationType.AVOID_ZONES) {
                // Ajouter des sinuosités pour éviter certaines zones
                const sinOffset = Math.sin(ratio * Math.PI * 4) * 0.005;
                waypoints.push({ lat: lat + sinOffset, lng: lng + sinOffset });
            } else if (type === OptimizationType.COMFORTABLE) {
                // Trajectoire plus douce
                waypoints.push({ lat, lng });
            } else {
                waypoints.push({ lat, lng });
            }
        }
        
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
        
        // Simuler un temps de calcul
        setTimeout(() => {
            const { waypoints, minAltitude, maxAltitude: maxAlt } = generateOptimizedPath(start, end, optimizationType);
            
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
            setIsPlanning(false);
        }, 1000);
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