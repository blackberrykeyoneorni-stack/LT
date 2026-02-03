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

    // 2. Zeitloses Diktat (Refaktoriert)
    tzd: {
        triggerChance: 0.08, // 8%
        tzdMaxHours: 36,     // Der neue Anker-Wert (Standard: 36h)
        lockInventory: true,
        // Fixe Gewichtung der Zonen (Bait / Standard / Wall)
        zoneWeights: [0.20, 0.50, 0.30] 
    },

    // 3. Purity Roulette
    purity: {
        cleanChance: 0.60,
        allowBegging: true,
        beggingSuccessChance: 0.50
    },

    // 4. Instruktionen
    instruction: {
        forcedReleaseTriggerChance: 0.15, 
        forcedReleaseMethods: {
            hand: 0.34,
            toy_vaginal: 0.33,
            toy_anal: 0.33
        }
    },

    // 5. Bestrafung
    punishment: {
        defaultDurationMinutes: 60,
        refusalMultiplier: 1.5,
        showTimer: true
    }
};