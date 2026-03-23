// src/utils/constants.js

// ==========================================
// BESTEHENDE KONSTANTEN 
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
// LOGIK-KONFIGURATIONEN (INKL. BLIND COMPLIANCE)
// ==========================================

export const PUNISHMENT_CONFIG = {
    ITEM_CATEGORY: 'Accessoires',
    ITEM_SUBCATEGORY: 'Buttplug',
    START_HOUR: 23, // 23:00 Uhr
    END_HOUR: 7,    // 07:59 Uhr
    
    // NEU: Basiszeiten für die Zufallsgenerierung (Blind Compliance Protocol)
    MIN_BASE_MINUTES: 30,
    MAX_BASE_MINUTES: 90,

    // NEU: Instrumenten-Multiplikatoren
    PLUG_MULTIPLIER: 1.0,
    DILDO_MULTIPLIER: 0.5,

    // Strafmaß in Minuten (Limits für alte Fallbacks & das Ledger)
    MIN_DURATION: 15,
    MAX_DURATION: 360, // Angehoben, um gestapelte Zinsen aufzufangen
    OATH_REFUSAL_PENALTY: 45,
    
    // Bailout Parameter (Probability entfernt -> Strafe ist unausweichlich)
    BAILOUT_PENALTY_FACTOR: 0.5 
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
    ],

    // Konfigurationen für TZD Strafen und Abbrüche
    DEFAULT_MULTIPLIER: 1.5,
    PENALTY_MINUTES: 15,
    MAX_HOURS_HARD_CAP: 24,
    ABORT_PUNISHMENT_DURATION: 360 
};