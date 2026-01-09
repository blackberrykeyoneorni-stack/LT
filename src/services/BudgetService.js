import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Lädt das monatliche Budget-Limit
// KORREKTUR: Nutzt 'monthlyLimit' statt 'amount' für Konsistenz mit Dashboard
export const loadMonthlyBudget = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/settings/budget`);
        const snap = await getDoc(docRef);
        // Fallback auf 0, falls noch nicht gesetzt
        return snap.exists() ? (snap.data().monthlyLimit || 0) : 0;
    } catch (e) {
        console.error("Fehler beim Laden des Budgets:", e);
        return 0;
    }
};

// Speichert das monatliche Budget
export const saveMonthlyBudget = async (userId, monthlyLimit) => {
    try {
        const docRef = doc(db, `users/${userId}/settings/budget`);
        // Wir speichern auch 'updatedAt', um Änderungen nachzuvollziehen
        await setDoc(docRef, { monthlyLimit: parseFloat(monthlyLimit), updatedAt: new Date() }, { merge: true });
    } catch (e) {
        console.error("Fehler beim Speichern des Budgets:", e);
    }
};

/**
 * Der "Smart Stock"-Algorithmus (Gap Analysis)
 * * Erstellt eine intelligente Einkaufsliste basierend auf:
 * 1. NOTWENDIGKEIT (Verschleiß): Items mit Zustand <= 2 (Score 100)
 * 2. WUNSCH (Wishlist): Items aus der Wunschliste (Score 20-80)
 * * Gibt eine sortierte Liste zurück, bei der notwendige Ersatzkäufe immer oben stehen.
 */
export const calculatePurchasePriority = async (userId, items, wishlist) => {
    try {
        const priorities = [];
        
        // --- SCHRITT 1: GAP ANALYSIS (Verschleiß prüfen) ---
        // Wir suchen in deinem Inventar nach aktiven Items, die kaputt gehen.
        if (items && items.length > 0) {
            const wornOutItems = items.filter(i => i.status === 'active' && i.condition <= 2);
            
            wornOutItems.forEach(item => {
                priorities.push({
                    id: item.id,
                    name: item.name,
                    brand: item.brand,
                    type: 'replacement', // Markiert als Ersatzkauf
                    reason: `Verschlissen (Zustand ${item.condition}/5)`,
                    // Nutzt den ursprünglichen Kaufpreis als Schätzung für Wiederbeschaffung
                    cost: parseFloat(item.cost) || 0, 
                    score: 100, // HÖCHSTE PRIORITÄT
                    imageUrl: item.imageUrl || null
                });
            });
        }

        // --- SCHRITT 2: WISHLIST INTEGRATION ---
        if (wishlist && wishlist.length > 0) {
            wishlist.forEach(wish => {
                // Score berechnen basierend auf Priorität in der Wishlist
                let score = 50; // Standard (Medium)
                if (wish.priority === 'high') score = 80;
                if (wish.priority === 'low') score = 20;

                priorities.push({
                    id: wish.id,
                    name: wish.name,
                    type: 'wish', // Markiert als Wunsch
                    reason: 'Wunschliste',
                    // Unterstützt verschiedene Feldnamen für den Preis
                    cost: parseFloat(wish.estimatedCost || wish.cost || wish.price) || 0,
                    score: score,
                    imageUrl: null // Wünsche haben meist noch kein Bild
                });
            });
        }

        // --- SCHRITT 3: SORTIERUNG ---
        // 1. Nach Score (Wichtigkeit) absteigend
        // 2. Bei gleichem Score: Günstigere Items zuerst (Quick Wins)
        return priorities.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.cost - b.cost;
        });

    } catch (e) {
        console.error("Fehler bei der Prioritätsberechnung:", e);
        return [];
    }
};
