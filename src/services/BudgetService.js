import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Lädt das monatliche Budget-Limit
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
        await setDoc(docRef, { monthlyLimit: parseFloat(monthlyLimit), updatedAt: new Date() }, { merge: true });
    } catch (e) {
        console.error("Fehler beim Speichern des Budgets:", e);
    }
};

/**
 * Der "Smart Stock"-Algorithmus (Gap Analysis)
 * * Erstellt eine intelligente Einkaufsliste basierend auf:
 * 1. QUALITÄTSSICHERUNG (Intelligente Empfehlung): Bestandslücken nach Subkategorie (Score 200)
 * 2. NOTWENDIGKEIT (Verschleiß): Items mit Zustand <= 2 (Score 100)
 * 3. WUNSCH (Wishlist): Items aus der Wunschliste (Score 20-80)
 */
export const calculatePurchasePriority = async (userId, items, wishlist) => {
    try {
        const priorities = [];
        
        // Konfiguration laden (Bestands- und Qualitätsziele)
        const configRef = doc(db, `users/${userId}/settings/inventoryConfig`);
        const configSnap = await getDoc(configRef);
        const inventoryConfig = configSnap.exists() ? configSnap.data() : {};

        // --- SCHRITT A: GESUNDHEITSPRÜFUNG ---
        const healthyCounts = {}; 
        
        if (items && items.length > 0) {
            items.forEach(item => {
                if (item.status === 'active') {
                    let cat = item.mainCategory || '';
                    if (cat.toLowerCase().includes('nylon')) cat = 'Nylons';
                    if (cat.toLowerCase().includes('dessous') || cat.toLowerCase().includes('lingerie') || cat.toLowerCase().includes('wäsche')) cat = 'Dessous';
                    
                    const subCat = item.subCategory || '';
                    
                    if ((cat === 'Nylons' || cat === 'Dessous') && inventoryConfig[cat]) {
                        // Prüfen ob die Hauptkategorie-Qualitätsanforderung erfüllt ist
                        if (item.condition >= (inventoryConfig[cat].minCondition || 3)) {
                            if (!healthyCounts[cat]) healthyCounts[cat] = {};
                            if (!healthyCounts[cat][subCat]) healthyCounts[cat][subCat] = 0;
                            healthyCounts[cat][subCat]++;
                        }
                    }
                }
            });
        }

        // --- SCHRITT B: INTELLIGENTE NACHKAUF-EMPFEHLUNGEN (Lücken-Ermittlung) ---
        ['Nylons', 'Dessous'].forEach(cat => {
            const catConfig = inventoryConfig[cat] || { subcategories: {} };
            const subcategories = catConfig.subcategories || {};
            
            Object.keys(subcategories).forEach(subCat => {
                const required = subcategories[subCat].minCount || 0;
                const current = healthyCounts[cat]?.[subCat] || 0;
                const fallbackPrice = subcategories[subCat].fallbackPrice || 0;
                
                if (current < required) {
                    const missing = required - current;
                    for (let i = 0; i < missing; i++) {
                        priorities.push({
                            id: `gap_${cat}_${subCat}_${i}`,
                            name: `Nachkauf: ${subCat}`,
                            brand: 'Qualitätssicherung',
                            type: 'recommendation', // Markiert als Empfehlung (nicht bindend)
                            reason: `Mindestbestand unterschritten (${current}/${required} intakt)`,
                            cost: parseFloat(fallbackPrice) || 0,
                            score: 200, // Hohe Priorität, blockiert jedoch kein Budget
                            imageUrl: null
                        });
                    }
                }
            });
        });

        // --- SCHRITT C: GAP ANALYSIS (Verschleiß regulär) ---
        if (items && items.length > 0) {
            const wornOutItems = items.filter(i => i.status === 'active' && i.condition <= 2);
            
            wornOutItems.forEach(item => {
                priorities.push({
                    id: item.id,
                    name: item.name,
                    brand: item.brand,
                    type: 'replacement',
                    reason: `Verschlissen (Zustand ${item.condition}/5)`,
                    cost: parseFloat(item.cost) || 0, 
                    score: 100, 
                    imageUrl: item.imageUrl || null
                });
            });
        }

        // --- SCHRITT D: WISHLIST INTEGRATION ---
        if (wishlist && wishlist.length > 0) {
            wishlist.forEach(wish => {
                let score = 50; 
                if (wish.priority === 'high') score = 80;
                if (wish.priority === 'low') score = 20;

                priorities.push({
                    id: wish.id,
                    name: wish.name,
                    type: 'wish',
                    reason: 'Wunschliste',
                    cost: parseFloat(wish.estimatedCost || wish.cost || wish.price) || 0,
                    score: score,
                    imageUrl: null 
                });
            });
        }

        // --- SCHRITT E: SORTIERUNG ---
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