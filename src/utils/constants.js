// src/utils/constants.js

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
