// src/config/defaultRules.js

export const DEFAULT_PROTOCOL_RULES = {
    // 1. Zeit-Definitionen (Aus Dashboard.jsx extrahiert)
    time: {
        dayStartHour: 7,
        dayStartMinute: 30, 
        nightStartHour: 23,
        nightStartMinute: 0,
        weekendExtensionMinutes: 0, 
    },

    // 2. Zeitloses Diktat (Exakt aus TZDService.js)
    tzd: {
        triggerChance: 0.08, // 8% Hardcoded im Service
        // Die Matrix definiert die Dauer-Wahrscheinlichkeiten
        // cumulative wird zur Berechnung genutzt, hier speichern wir Einzel-Wahrscheinlichkeiten für die UI
        durationMatrix: [
            { id: 'bait', label: 'The Bait', minHours: 6, maxHours: 12, weight: 0.20 },     // 20%
            { id: 'standard', label: 'The Standard', minHours: 12, maxHours: 24, weight: 0.50 }, // 50%
            { id: 'wall', label: 'The Wall', minHours: 24, maxHours: 36, weight: 0.30 }      // 30%
        ],
        lockInventory: true
    },

    // 3. Purity Roulette (Aus ForcedReleaseOverlay.jsx)
    purity: {
        cleanChance: 0.60, // 60/40 Logik
        allowBegging: true,
        beggingSuccessChance: 0.50
    },

    // 4. Instruktionen (Aus InstructionService.js)
    // HINWEIS: maxItems etc. kommen aus den User-Settings (Preferences), nicht von hier.
    // Hier regeln wir nur die "versteckten" Wahrscheinlichkeiten.
    instruction: {
        // Aktuell hardcoded: "if (Math.random() < 0.15)"
        forcedReleaseTriggerChance: 0.15, 
        
        // Aktuell hardcoded: 34% Hand, 33% Toy Vaginal, 33% Toy Anal
        forcedReleaseMethods: {
            hand: 0.34,
            toy_vaginal: 0.33,
            toy_anal: 0.33
        }
    },

    // 5. Bestrafung (Aus PunishmentService.js)
    punishment: {
        defaultDurationMinutes: 60,
        refusalMultiplier: 1.5,
        showTimer: true
    }
};