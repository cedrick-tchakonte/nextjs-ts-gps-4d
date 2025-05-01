import { ZONE_TYPES } from "./zoneTypes";

// Adding zones
export const zones: { position: [number, number]; type: any; label: string }[] = [
    { position: [2.430, 48.632], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.420, 58.632], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.435, 48.628], type: ZONE_TYPES.DEPOSE, label: 'Dépose Minute' },
    { position: [2.425, 48.635], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },
    { position: [2.440, 48.630], type: ZONE_TYPES.RELIGIEUX, label: 'Site Religieux' },
    { position: [2.420, 48.625], type: ZONE_TYPES.CRASH, label: 'Zone de Crash Historique' },


    //ensta
    { position: [2.2183296038567275, 48.713579025539424], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.2188754333938645, 48.71356132768844,], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.2182814138971425, 48.712931460389676], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.2188272351872635, 48.712914345801245], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },

    { position: [2.2171164978859252, 48.71342940979042], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },
    { position: [2.220430128684691, 48.712583532204235], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },
    { position: [2.2183511144837644, 48.71489626577724], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },

    { position: [2.2218681571137378, 48.710946699854695], type: ZONE_TYPES.CRASH, label: 'Zone de Crash Historique' },
    { position: [2.212356165264561, 48.70965564515431], type: ZONE_TYPES.CRASH, label: 'Zone de Crash Historique' },
    { position: [2.215392761517896, 48.7098661251907], type: ZONE_TYPES.CRASH, label: 'Zone de Crash Historique' },

    // Cluster 1 : Zones d'atterrissage (LANDING)
    { position: [2.2205, 48.7135], type: ZONE_TYPES.LANDING, label: 'ENSTA - Zone Atterrissage 1' },

    // Ajout de 50 nouvelles zones dans un rayon de 10 km autour de l'ENSTA Paris
    { position: [2.2201, 48.7131], type: ZONE_TYPES.LANDING, label: 'ENSTA - Zone Atterrissage 7' },
    { position: [2.2212, 48.7142], type: ZONE_TYPES.LANDING, label: 'ENSTA - Zone Atterrissage 8' },

    // Zones d'atterrissage (LANDING) sur des espaces dégagés ou toits plats
    { position: [2.2185, 48.7132], type: ZONE_TYPES.LANDING, label: 'ENSTA - Zone Atterrissage 1' },
    { position: [2.2190, 48.7138], type: ZONE_TYPES.LANDING, label: 'ENSTA - Zone Atterrissage 2' },
    { position: [2.2180, 48.7128], type: ZONE_TYPES.LANDING, label: 'ENSTA - Zone Atterrissage 3' },

    // Zones d'urgence (URGENCE) entre les bâtiments
    { position: [2.2178, 48.7135], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Parking Urgence 1' },
    { position: [2.2182, 48.7130], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Parking Urgence 2' },
    { position: [2.2192, 48.7134], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Parking Urgence 3' },

    // Zones de dépose-minute (DEPOSE) près des entrées principales
    { position: [2.2184, 48.7134], type: ZONE_TYPES.DEPOSE, label: 'ENSTA - Dépose Minute 1' },
    { position: [2.2186, 48.7130], type: ZONE_TYPES.DEPOSE, label: 'ENSTA - Dépose Minute 2' },

    // Zones LANDING sur toits de bâtiments et zones dégagées
    { position: [2.2183, 48.7134], type: ZONE_TYPES.LANDING, label: 'ENSTA - Toit Bâtiment Principal' },
    { position: [2.2187, 48.7137], type: ZONE_TYPES.LANDING, label: 'ENSTA - Toit Bâtiment Recherche' },
    { position: [2.2179, 48.7131], type: ZONE_TYPES.LANDING, label: 'ENSTA - Toit Bâtiment Est' },
    { position: [2.2189, 48.7129], type: ZONE_TYPES.LANDING, label: 'ENSTA - Parking Principal' },
    { position: [2.2195, 48.7135], type: ZONE_TYPES.LANDING, label: 'ENSTA - Terrain Nord' },
    
    // Zones URGENCE près des accès principaux et parkings
    { position: [2.2181, 48.7127], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Accès Sud' },
    { position: [2.2193, 48.7133], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Entrée Nord' },
    { position: [2.2177, 48.7136], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Accès Ouest' },
    { position: [2.2188, 48.7141], type: ZONE_TYPES.URGENCE, label: 'ENSTA - Parking Nord-Est' },
    
    // Zones CRASH sur espaces dégagés autour du campus
    { position: [2.2176, 48.7132], type: ZONE_TYPES.CRASH, label: 'ENSTA - Zone Ouest' },
    { position: [2.2196, 48.7130], type: ZONE_TYPES.CRASH, label: 'ENSTA - Zone Est' },
    { position: [2.2186, 48.7124], type: ZONE_TYPES.CRASH, label: 'ENSTA - Zone Sud' },
    
    // Zones RELIGIEUX à proximité des lieux de rassemblement
    { position: [2.2184, 48.7138], type: ZONE_TYPES.RELIGIEUX, label: 'ENSTA - Salle Polyvalente' },
    { position: [2.2191, 48.7136], type: ZONE_TYPES.RELIGIEUX, label: 'ENSTA - Espace Commun' },
    
    // Zones DEPOSE aux entrées et sorties
    { position: [2.2190, 48.7132], type: ZONE_TYPES.DEPOSE, label: 'ENSTA - Dépose Entrée Principale' },
    { position: [2.2182, 48.7139], type: ZONE_TYPES.DEPOSE, label: 'ENSTA - Dépose Bâtiment Nord' },
    
    // Zones autour de Polytechnique (distribution non linéaire)
    { position: [2.2107, 48.7145], type: ZONE_TYPES.LANDING, label: 'Polytechnique - Toit Bâtiment Central' },
    { position: [2.2115, 48.7138], type: ZONE_TYPES.LANDING, label: 'Polytechnique - Esplanade' },
    { position: [2.2129, 48.7147], type: ZONE_TYPES.LANDING, label: 'Polytechnique - Terrain Nord' },
    { position: [2.2118, 48.7152], type: ZONE_TYPES.URGENCE, label: 'Polytechnique - Accès Urgence Est' },
    { position: [2.2134, 48.7139], type: ZONE_TYPES.URGENCE, label: 'Polytechnique - Parking Secours' },
    { position: [2.2124, 48.7131], type: ZONE_TYPES.CRASH, label: 'Polytechnique - Zone Sud' },
    { position: [2.2139, 48.7145], type: ZONE_TYPES.RELIGIEUX, label: 'Polytechnique - Bâtiment Central' },
    { position: [2.2112, 48.7135], type: ZONE_TYPES.DEPOSE, label: 'Polytechnique - Entrée Principale' },
    
    // Zones autour d'Orly (distribution non linéaire)
    { position: [2.3935, 48.7255], type: ZONE_TYPES.LANDING, label: 'Orly - Toit Terminal Sud' },
    { position: [2.3912, 48.7235], type: ZONE_TYPES.LANDING, label: 'Orly - Zone Technique' },
    { position: [2.3952, 48.7238], type: ZONE_TYPES.LANDING, label: 'Orly - Héliport' },
    { position: [2.3927, 48.7263], type: ZONE_TYPES.URGENCE, label: 'Orly - Accès Pompiers' },
    { position: [2.3942, 48.7247], type: ZONE_TYPES.URGENCE, label: 'Orly - Zone Sécurité' },
    { position: [2.3962, 48.7252], type: ZONE_TYPES.CRASH, label: 'Orly - Zone Est' },
    { position: [2.3923, 48.7241], type: ZONE_TYPES.CRASH, label: 'Orly - Zone Périphérique' },
    { position: [2.3932, 48.7257], type: ZONE_TYPES.RELIGIEUX, label: 'Orly - Espace Prière' },
    { position: [2.3947, 48.7231], type: ZONE_TYPES.DEPOSE, label: 'Orly - Dépose Rapide' },

    //orly heli
    { position: [2.319915406557164, 48.713224058383226], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.3231816613506666, 48.71177603456451], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.3668396932003035, 48.73084274683367], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.368105695816573, 48.73106920103319], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },

    { position: [2.389426825359386, 48.73668155831142], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },
    { position: [2.3377567524783984, 48.71709168511466], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },
    { position: [2.342134117456688, 48.73707780646991], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },

    // Ajout de nouvelles zones dans le rayon de l'Aéroport d’Orly
    { position: [2.3900, 48.7220], type: ZONE_TYPES.LANDING, label: 'Orly - Piste 3' },
    { position: [2.3915, 48.7215], type: ZONE_TYPES.LANDING, label: 'Orly - Piste 4' },
    { position: [2.3925, 48.7235], type: ZONE_TYPES.URGENCE, label: 'Orly - Parking Urgence 1' },
    { position: [2.3935, 48.7245], type: ZONE_TYPES.URGENCE, label: 'Orly - Parking Urgence 2' },
    { position: [2.3945, 48.7255], type: ZONE_TYPES.CRASH, label: 'Orly - Zone de Crash 1' },
    { position: [2.3955, 48.7265], type: ZONE_TYPES.CRASH, label: 'Orly - Zone de Crash 2' },

    // Réorganisation des zones autour de l'Aéroport d’Orly
    { position: [2.3915, 48.7225], type: ZONE_TYPES.LANDING, label: 'Orly - Piste Réorganisée 1' },
    { position: [2.3925, 48.7235], type: ZONE_TYPES.LANDING, label: 'Orly - Piste Réorganisée 2' },
    { position: [2.3935, 48.7245], type: ZONE_TYPES.URGENCE, label: 'Orly - Parking Urgence Réorganisé 1' },
    { position: [2.3945, 48.7255], type: ZONE_TYPES.URGENCE, label: 'Orly - Parking Urgence Réorganisé 2' },
    { position: [2.3955, 48.7265], type: ZONE_TYPES.CRASH, label: 'Orly - Zone de Crash Réorganisée 1' },
    { position: [2.3965, 48.7275], type: ZONE_TYPES.CRASH, label: 'Orly - Zone de Crash Réorganisée 2' },
    { position: [2.3975, 48.7285], type: ZONE_TYPES.RELIGIEUX, label: 'Orly - Site Religieux Réorganisé 1' },
    { position: [2.3985, 48.7295], type: ZONE_TYPES.RELIGIEUX, label: 'Orly - Site Religieux Réorganisé 2' },
    { position: [2.3995, 48.7305], type: ZONE_TYPES.DEPOSE, label: 'Orly - Dépose Minute Réorganisée 1' },

    //Issy-les-Moulineaux Heliport
    { position: [2.271759643338353, 48.832786867931276], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.2738965646864515, 48.833557791460436], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },
    { position: [2.2729841343577726, 48.83265909879192], type: ZONE_TYPES.LANDING, label: 'Zone Atterrissage Principale' },

    { position: [2.2716466323463607, 48.83144353052858], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },
    { position: [2.2726615892908, 48.831508857995104], type: ZONE_TYPES.URGENCE, label: 'Urgence - Parking' },

    { position: [2.274520088292593, 48.831785014081206], type: ZONE_TYPES.CRASH, label: 'Zone de Crash Historique' },

    // Ajout de nouvelles zones réelles
    // Héliport de Paris
    { position: [2.2769, 48.8352], type: ZONE_TYPES.LANDING, label: 'Héliport de Paris' },
    { position: [2.2775, 48.8348], type: ZONE_TYPES.LANDING, label: 'Héliport de Paris - Zone 2' },

    // Aéroport Charles de Gaulle
    { position: [2.5479, 49.0097], type: ZONE_TYPES.LANDING, label: 'Aéroport Charles de Gaulle - Piste 1' },
    { position: [2.5558, 49.0128], type: ZONE_TYPES.LANDING, label: 'Aéroport Charles de Gaulle - Piste 2' },

    // Dépose-minute Gare Montparnasse
    { position: [2.3191, 48.8414], type: ZONE_TYPES.DEPOSE, label: 'Gare Montparnasse - Dépose Minute' },

    // Parking d'urgence à l’Hôpital Européen Georges-Pompidou
    { position: [2.2731, 48.8383], type: ZONE_TYPES.URGENCE, label: 'Hôpital Georges-Pompidou - Parking Urgence' },

    // Cathédrale Notre-Dame de Paris
    { position: [2.3499, 48.8529], type: ZONE_TYPES.RELIGIEUX, label: 'Cathédrale Notre-Dame de Paris' },

    // Site de crash historique à Ermenonville
    { position: [2.6086, 49.1231], type: ZONE_TYPES.CRASH, label: 'Site de Crash Historique - Ermenonville' },

    // Ajout de nouvelles zones et complétion des zones existantes

    // Héliport de Paris (ajout de zones supplémentaires)
    { position: [2.2780, 48.8355], type: ZONE_TYPES.LANDING, label: 'Héliport de Paris - Zone 3' },
    { position: [2.2785, 48.8350], type: ZONE_TYPES.LANDING, label: 'Héliport de Paris - Zone 4' },

    // Aéroport Charles de Gaulle (ajout de pistes supplémentaires)
    { position: [2.5600, 49.0150], type: ZONE_TYPES.LANDING, label: 'Aéroport Charles de Gaulle - Piste 3' },
    { position: [2.5700, 49.0200], type: ZONE_TYPES.LANDING, label: 'Aéroport Charles de Gaulle - Piste 4' },

    // Dépose-minute Gare Montparnasse (ajout de zones de dépose supplémentaires)
    { position: [2.3200, 48.8410], type: ZONE_TYPES.DEPOSE, label: 'Gare Montparnasse - Dépose Minute 2' },
    { position: [2.3210, 48.8420], type: ZONE_TYPES.DEPOSE, label: 'Gare Montparnasse - Dépose Minute 3' },

    // Parking d'urgence à l’Hôpital Européen Georges-Pompidou (ajout de parkings supplémentaires)
    { position: [2.2740, 48.8385], type: ZONE_TYPES.URGENCE, label: 'Hôpital Georges-Pompidou - Parking Urgence 2' },
    { position: [2.2750, 48.8380], type: ZONE_TYPES.URGENCE, label: 'Hôpital Georges-Pompidou - Parking Urgence 3' },

    // Cathédrale Notre-Dame de Paris (ajout de zones religieuses supplémentaires)
    { position: [2.3505, 48.8530], type: ZONE_TYPES.RELIGIEUX, label: 'Cathédrale Notre-Dame - Zone 2' },
    { position: [2.3510, 48.8535], type: ZONE_TYPES.RELIGIEUX, label: 'Cathédrale Notre-Dame - Zone 3' },

    // Site de crash historique à Ermenonville (ajout de zones de crash supplémentaires)
    { position: [2.6090, 49.1240], type: ZONE_TYPES.CRASH, label: 'Site de Crash Historique - Ermenonville 2' },
    { position: [2.6100, 49.1250], type: ZONE_TYPES.CRASH, label: 'Site de Crash Historique - Ermenonville 3' },

    // Ajout de nouvelles zones dans d'autres lieux

    // Aéroport d’Orly
    { position: [2.3910, 48.7230], type: ZONE_TYPES.LANDING, label: 'Aéroport d’Orly - Piste 1' },
    { position: [2.3920, 48.7240], type: ZONE_TYPES.LANDING, label: 'Aéroport d’Orly - Piste 2' },

    // Basilique du Sacré-Cœur de Montmartre
    { position: [2.3430, 48.8867], type: ZONE_TYPES.RELIGIEUX, label: 'Basilique du Sacré-Cœur - Zone 1' },
    { position: [2.3440, 48.8870], type: ZONE_TYPES.RELIGIEUX, label: 'Basilique du Sacré-Cœur - Zone 2' },

    // Gare de Lyon (zones de dépose)
    { position: [2.3730, 48.8440], type: ZONE_TYPES.DEPOSE, label: 'Gare de Lyon - Dépose Minute 1' },
    { position: [2.3740, 48.8450], type: ZONE_TYPES.DEPOSE, label: 'Gare de Lyon - Dépose Minute 2' },

    // Site de crash historique à Gonesse
    { position: [2.4700, 48.9870], type: ZONE_TYPES.CRASH, label: 'Site de Crash Historique - Gonesse 1' },
    { position: [2.4710, 48.9880], type: ZONE_TYPES.CRASH, label: 'Site de Crash Historique - Gonesse 2' },

    // Ajout de nouvelles zones dans le rayon de Polytechnique
    { position: [2.2100, 48.7100], type: ZONE_TYPES.LANDING, label: 'Polytechnique - Zone Atterrissage 1' },
    { position: [2.2110, 48.7110], type: ZONE_TYPES.LANDING, label: 'Polytechnique - Zone Atterrissage 2' },
    { position: [2.2120, 48.7120], type: ZONE_TYPES.URGENCE, label: 'Polytechnique - Parking Urgence 1' },
    { position: [2.2130, 48.7130], type: ZONE_TYPES.URGENCE, label: 'Polytechnique - Parking Urgence 2' },
    { position: [2.2140, 48.7140], type: ZONE_TYPES.CRASH, label: 'Polytechnique - Zone de Crash 1' },
    { position: [2.2150, 48.7150], type: ZONE_TYPES.CRASH, label: 'Polytechnique - Zone de Crash 2' },

    // Zones ajoutées pour Palaiseau
    { position: [2.2430, 48.7160], type: ZONE_TYPES.LANDING, label: 'Palaiseau - Zone Atterrissage 1' },
    { position: [2.2450, 48.7170], type: ZONE_TYPES.LANDING, label: 'Palaiseau - Zone Atterrissage 2' },
    { position: [2.2470, 48.7180], type: ZONE_TYPES.URGENCE, label: 'Palaiseau - Parking Urgence 1' },
    { position: [2.2490, 48.7190], type: ZONE_TYPES.URGENCE, label: 'Palaiseau - Parking Urgence 2' },
    { position: [2.2510, 48.7200], type: ZONE_TYPES.CRASH, label: 'Palaiseau - Zone de Crash 1' },
    { position: [2.2530, 48.7210], type: ZONE_TYPES.CRASH, label: 'Palaiseau - Zone de Crash 2' },
    { position: [2.2550, 48.7220], type: ZONE_TYPES.RELIGIEUX, label: 'Palaiseau - Site Religieux 1' },
    { position: [2.2570, 48.7230], type: ZONE_TYPES.RELIGIEUX, label: 'Palaiseau - Site Religieux 2' },
    { position: [2.2590, 48.7240], type: ZONE_TYPES.DEPOSE, label: 'Palaiseau - Dépose Minute 1' },
    { position: [2.2610, 48.7250], type: ZONE_TYPES.DEPOSE, label: 'Palaiseau - Dépose Minute 2' },
];