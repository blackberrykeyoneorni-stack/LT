// src/utils/constants.js

// ==========================================
// BESTEHENDE KONSTANTEN (WIEDERHERGESTELLT)
// ==========================================

export const MAIN_CATEGORIES = [
    "Nylons", 
    "Lingerie", 
    "Toys", 
    "Schuhe", 
    "Accessoires", 
    "Bondage", 
    "Outfit"
];

export const REFLECTION_TAGS = [
    "Sicher / Geborgen", 
    "Erregt", 
    "Gedemütigt", 
    "Exponiert / Öffentlich", 
    "Feminin", 
    "Besitztum (Owned)", 
    "Unwürdig", 
    "Stolz"
];

// Archivierungs-Logik (genutzt in Settings & ItemDetail)
export const DEFAULT_ARCHIVE_REASONS = [
    { value: 'run', label: 'Laufmasche (Nylon)' }, 
    { value: 'worn_out', label: 'Verschlissen / Abgenutzt' },
    { value: 'fit_issue', label: 'Passt nicht mehr' },
    { value: 'vibe_mismatch', label: 'Vibe Shift (Gefällt nicht mehr)' },
    { value: 'sold_donated', label: 'Verkauft / Gespendet' },
    { value: 'seasonal', label: 'Saisonal eingelagert' }
];

export const DEFAULT_RUN_LOCATIONS = [
    "Zeh", "Ferse", "Sohle", "Knöchel", "Wade", "Knie", "Schenkel", "Panty / Schritt", "Bund"
];

export const DEFAULT_RUN_CAUSES = [
    "Schuhe (Reibung)", "Fingernagel / Schmuck", "Klettverschluss / Reißverschluss", "Hängen geblieben (Möbel)", "Materialfehler", "Unbekannt"
];

// ==========================================
// NEUE LOGIK-KONFIGURATIONEN (HINZUGEFÜGT)
// ==========================================

export const PUNISHMENT_CONFIG = {
    ITEM_CATEGORY: 'Accessoires',
    ITEM_SUBCATEGORY: 'Buttplug',
    START_HOUR: 23, // 23:00 Uhr
    END_HOUR: 7,    // 07:59 Uhr
    
    // Strafmaß in Minuten
    MIN_DURATION: 15,
    MAX_DURATION: 90,
    OATH_REFUSAL_PENALTY: 45,
    
    // Bailout Parameter
    BAILOUT_PROBABILITY: 0.25, // 25% Chance
    BAILOUT_PENALTY_FACTOR: 0.5 // Strafe = 50% der verpassten Zeit
};

export const TZD_CONFIG = {
    TRIGGER_CHANCE: 0.12, // 12% Wahrscheinlichkeit
    
    // Begriffe, die das Protokoll auslösen (Case-insensitive)
    TRIGGER_KEYWORDS: [
        'strumpfhose',
        'tights',
        'pantyhose',
        'nylons'
    ],
    
    // Standard Matrix, falls keine User-Settings existieren
    FALLBACK_MATRIX: [
        { label: 'The Bait', min: 2, max: 4, weight: 0.20 },
        { label: 'The Standard', min: 4, max: 8, weight: 0.70 },
        { label: 'The Wall', min: 8, max: 12, weight: 0.10 }
    ]
};