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

        // --- HILFSFUNKTION: DYNAMISCHER MEDIAN-PREIS ---
        const getMedianPrice = (subCatName, fallbackPrice) => {
            if (!items || items.length === 0) return parseFloat(fallbackPrice) || 0;
            
            // Alle Items (inkl. Archiv) dieser Subkategorie mit gültigem Preis filtern
            const subCatItems = items.filter(i => 
                i.subCategory === subCatName && 
                i.cost !== undefined && 
                i.cost !== null && 
                parseFloat(i.cost) > 0
            );

            if (subCatItems.length === 0) return parseFloat(fallbackPrice) || 0;

            // Helfer zum sicheren Extrahieren des Zeitstempels
            const getTime = (val) => {
                if (!val) return 0;
                if (typeof val.toDate === 'function') return val.toDate().getTime();
                if (val.seconds) return val.seconds * 1000;
                return new Date(val).getTime();
            };

            // Nach Aktualität sortieren (neueste zuerst)
            subCatItems.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

            // Die aktuellsten 12 nehmen (wenn weniger da sind, nimmt slice automatisch alle vorhandenen)
            const recentItems = subCatItems.slice(0, 12);
            
            // Preise extrahieren und aufsteigend sortieren für die Median-Berechnung
            const costs = recentItems.map(i => parseFloat(i.cost)).sort((a, b) => a - b);
            
            const mid = Math.floor(costs.length / 2);
            if (costs.length % 2 === 0) {
                return (costs[mid - 1] + costs[mid]) / 2;
            } else {
                return costs[mid];
            }
        };

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
                    
                    // Dynamischen Median-Preis berechnen
                    const calculatedCost = getMedianPrice(subCat, fallbackPrice);

                    for (let i = 0; i < missing; i++) {
                        priorities.push({
                            id: `gap_${cat}_${subCat}_${i}`,
                            name: `Nachkauf: ${subCat}`,
                            brand: 'Qualitätssicherung',
                            type: 'recommendation', // Markiert als Empfehlung (nicht bindend)
                            reason: `Mindestbestand unterschritten (${current}/${required} intakt)`,
                            cost: parseFloat(calculatedCost.toFixed(2)),
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