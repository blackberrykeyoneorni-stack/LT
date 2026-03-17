import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
    doc, getDoc, updateDoc, collection, query, where, getDocs, 
    serverTimestamp, arrayUnion 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNFCGlobal } from '../contexts/NFCContext'; 
import { calculateItemRecoveryStatus } from '../services/ItemService'; 
import { startSession as startSessionService } from '../services/SessionService'; 
import { safeDate } from '../utils/dateUtils';
import { DEFAULT_ARCHIVE_REASONS, DEFAULT_RUN_LOCATIONS, DEFAULT_RUN_CAUSES } from '../utils/constants';

// ==========================================
// 1. DATA FETCHER HOOK
// ==========================================
function useItemFetcher(id, currentUser, navigate) {
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBusy, setIsBusy] = useState(false); 
    const [sessions, setSessions] = useState([]);
    const [dropdowns, setDropdowns] = useState({
        brands: [], categoryStructure: {}, materials: [], locations: [],
        archiveReasons: DEFAULT_ARCHIVE_REASONS, runLocations: DEFAULT_RUN_LOCATIONS, runCauses: DEFAULT_RUN_CAUSES
    });

    useEffect(() => {
        if (!currentUser || !id) return;
        
        const fetchData = async () => {
            try {
                // Waterfall Fix: Item, Settings & Global Dropdowns absolut parallel laden
                const [
                    itemSnap, prefSnap, brandSnap, catSnap, 
                    matSnap, locSnap, archiveSnap
                ] = await Promise.all([
                    getDoc(doc(db, `users/${currentUser.uid}/items`, id)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/categories`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/locations`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/archive`))
                ]);
                
                if (!itemSnap.exists()) {
                    navigate('/inventory'); 
                    return;
                }

                const itemData = { id: itemSnap.id, ...itemSnap.data() };
                setItem(itemData);
                
                // Dropdowns Init
                let newDropdowns = {
                    brands: brandSnap.exists() ? (brandSnap.data().list || []) : [],
                    categoryStructure: catSnap.exists() ? (catSnap.data().structure || {}) : {},
                    materials: matSnap.exists() ? (matSnap.data().list || []) : [],
                    locations: locSnap.exists() ? (locSnap.data().list || []) : [],
                    archiveReasons: DEFAULT_ARCHIVE_REASONS,
                    runLocations: DEFAULT_RUN_LOCATIONS,
                    runCauses: DEFAULT_RUN_CAUSES
                };

                if(archiveSnap.exists()) {
                    const arcData = archiveSnap.data();
                    if (arcData.reasons?.length > 0) newDropdowns.archiveReasons = arcData.reasons;
                    if (arcData.runLocations?.length > 0) newDropdowns.runLocations = arcData.runLocations;
                    if (arcData.runCauses?.length > 0) newDropdowns.runCauses = arcData.runCauses;
                }
                setDropdowns(newDropdowns);

                // KORREKTUR: Umgehung des Firebase Composite Index Fehlers.
                let snapLegacy = { docs: [] };
                let snapNew = { docs: [] };
                
                try {
                    const qLegacy = query(
                        collection(db, `users/${currentUser.uid}/sessions`),
                        where('itemId', '==', id)
                    );
                    const qNew = query(
                        collection(db, `users/${currentUser.uid}/sessions`),
                        where('itemIds', 'array-contains', id)
                    );
                    
                    const [resLegacy, resNew] = await Promise.all([getDocs(qLegacy), getDocs(qNew)]);
                    snapLegacy = resLegacy;
                    snapNew = resNew;
                } catch (sessionErr) {
                    console.error("Fehler beim Abrufen der Sessions (möglicherweise blockiert durch Firebase):", sessionErr);
                }

                const sessionMap = new Map();
                snapLegacy.docs.forEach(d => sessionMap.set(d.id, { id: d.id, ...d.data() }));
                snapNew.docs.forEach(d => sessionMap.set(d.id, { id: d.id, ...d.data() }));

                const sessionList = Array.from(sessionMap.values()).sort((a, b) => {
                    const startA = a.startTime?.toDate ? a.startTime.toDate().getTime() : new Date(a.startTime || 0).getTime();
                    const startB = b.startTime?.toDate ? b.startTime.toDate().getTime() : new Date(b.startTime || 0).getTime();
                    return startB - startA;
                });
                
                setSessions(sessionList);

                const runningSession = sessionList.find(s => !s.endTime);
                setIsBusy(!!runningSession);

            } catch (e) {
                console.error("Error loading details:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, id, navigate]);

    const stats = useMemo(() => {
        const wearCount = item?.wearCount || 0;
        const totalWearTime = item?.totalMinutes || 0; 

        let releaseCount = 0;
        let survivedCount = 0;

        sessions.forEach(s => { 
            if (s.releases && Array.isArray(s.releases)) {
                s.releases.forEach(r => {
                    releaseCount++;
                    if (r.outcome === 'maintained') survivedCount++;
                });
            }
        });

        return { 
            totalWearTime, 
            wearCount,
            releaseCount,
            survivalRate: releaseCount > 0 ? Math.round((survivedCount / releaseCount) * 100) : 100,
            cpw: (item?.cost && wearCount) ? (item.cost / wearCount).toFixed(2) : (item?.cost || 0)
        };
    }, [sessions, item]);

    const recoveryInfo = useMemo(() => {
        return calculateItemRecoveryStatus(item, sessions);
    }, [item, sessions]);

    const historyEvents = useMemo(() => {
        const events = [];
        sessions.forEach(s => {
            events.push({ type: 'session', date: safeDate(s.startTime), data: s });
            if (s.releases && Array.isArray(s.releases)) {
                s.releases.forEach(r => events.push({ type: 'release', date: safeDate(r.timestamp), data: { ...r, sessionId: s.id } }));
            }
        });
        if (item?.historyLog) {
            item.historyLog.forEach(log => {
                events.push({ type: log.type, date: new Date(log.date), data: log });
            });
        } else if (item?.cleanDate) {
            events.push({ type: 'wash', date: safeDate(item.cleanDate), data: { legacy: true } });
        }

        return events.sort((a, b) => {
            const timeA = a.date instanceof Date && !isNaN(a.date) ? a.date.getTime() : 0;
            const timeB = b.date instanceof Date && !isNaN(b.date) ? b.date.getTime() : 0;
            return timeB - timeA;
        });
    }, [sessions, item]);

    return { item, setItem, loading, isBusy, dropdowns, stats, recoveryInfo, historyEvents };
}

// ==========================================
// 2. FORM & UI STATE HOOK
// ==========================================
function useItemForm(item) {
    const [isEditing, setIsEditing] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [formData, setFormData] = useState({});
    const [archiveDialog, setArchiveDialog] = useState({
        open: false, reason: '', runLocation: '', runCause: ''
    });

    useEffect(() => {
        if (item && !isEditing) {
            setFormData({
                name: item.name || '',
                customId: item.customId || '', 
                brand: item.brand || '',
                model: item.model || '',
                mainCategory: item.mainCategory || 'Nylons',
                subCategory: item.subCategory || '',
                material: item.material || '',
                cost: item.cost || '',
                condition: item.condition || 5,
                location: item.location || '',
                suitablePeriod: item.suitablePeriod || 'Beide', 
                purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : '', 
                notes: item.notes || ''
            });
        }
    }, [item, isEditing]);

    const galleryImages = useMemo(() => {
        const existing = item?.images || (item?.imageUrl ? [item.imageUrl] : []);
        const pending = pendingFiles.map(p => p.preview);
        return [...existing, ...pending];
    }, [item, pendingFiles]);

    const handleAddImages = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const newPending = files.map(file => ({
                file,
                preview: URL.createObjectURL(file)
            }));
            setPendingFiles(prev => [...prev, ...newPending]);
        }
    };

    return {
        isEditing, setIsEditing, formData, setFormData, archiveDialog, setArchiveDialog,
        pendingFiles, setPendingFiles, galleryImages, handleAddImages
    };
}

// ==========================================
// 3. ACTIONS HOOK
// ==========================================
function useItemActions(config) {
    const {
        id, currentUser, navigate, item, formData, pendingFiles, archiveDialog,
        recoveryInfo, isBusy, writeTag, setItem, setIsEditing, setPendingFiles, setArchiveDialog
    } = config;

    const handleStartSession = async (force = false, viaNFC = false) => {
        if (!currentUser || !id) return;
        if (isBusy) { alert("Dieses Item wird bereits getragen!"); return; }
        if (recoveryInfo?.isResting && !force) {
            if (!window.confirm(`ACHTUNG: Elasthan Recovery nicht abgeschlossen. Trotzdem tragen?`)) return;
        }
        try {
            let type = 'voluntary';
            let periodId = null;
            let acceptedAt = null;

            const instrRef = doc(db, `users/${currentUser.uid}/status/dailyInstruction`);
            const instrSnap = await getDoc(instrRef);
            if (instrSnap.exists()) {
                const instr = instrSnap.data();
                if (instr.items && instr.items.some(i => i.id === id)) {
                    type = 'instruction';
                    periodId = instr.periodId;
                    acceptedAt = instr.acceptedAt; 
                }
            }

            await startSessionService(currentUser.uid, {
                itemId: id,
                type,
                periodId,
                acceptedAt,
                verifiedViaNfc: viaNFC
            });
            navigate('/');
        } catch (e) { console.error(e); alert("Fehler beim Starten."); }
    };

    const handleSave = async () => {
        if (!currentUser || !id) return;
        try {
            let uploadedUrls = [];
            
            if (pendingFiles.length > 0) {
                const uploadPromises = pendingFiles.map(async (p) => {
                    const fileRef = ref(storage, `users/${currentUser.uid}/items/${Date.now()}_${p.file.name}`);
                    const snapshot = await uploadBytes(fileRef, p.file);
                    return await getDownloadURL(snapshot.ref);
                });
                uploadedUrls = await Promise.all(uploadPromises);
            }

            const existingImages = item.images || (item.imageUrl ? [item.imageUrl] : []);
            const finalImages = [...existingImages, ...uploadedUrls];

            const costNum = parseFloat(formData.cost);
            const updatedData = { 
                ...formData, 
                cost: isNaN(costNum) ? 0 : costNum, 
                updatedAt: serverTimestamp(),
                images: finalImages,
                imageUrl: finalImages.length > 0 ? finalImages[0] : null
            };

            await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), updatedData);
            setItem({ ...item, ...updatedData });
            setPendingFiles([]); 
            setIsEditing(false);
            
        } catch (e) { console.error(e); alert("Fehler beim Speichern"); }
    };

    const handleWash = async () => {
        try {
            const timestamp = new Date().toISOString();
            await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), {
                status: 'washing', 
                cleanDate: null, 
                historyLog: arrayUnion({ type: 'wash_pending', date: timestamp })
            });
            setItem(prev => ({ 
                ...prev, 
                status: 'washing',
                cleanDate: null, 
                historyLog: [...(prev.historyLog || []), { type: 'wash_pending', date: timestamp }] 
            }));
            navigate('/inventory');

        } catch (e) { console.error(e); }
    };

    const handleArchive = async () => {
        try {
            const timestamp = new Date().toISOString();
            await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), {
                status: 'archived',
                archiveReason: archiveDialog.reason,
                archiveDate: serverTimestamp(),
                runLocation: archiveDialog.reason === 'run' ? archiveDialog.runLocation : null,
                runCause: archiveDialog.reason === 'run' ? archiveDialog.runCause : null,
                historyLog: arrayUnion({ type: 'archived', date: timestamp, reason: archiveDialog.reason })
            });
            setArchiveDialog(prev => ({ ...prev, open: false }));
            navigate('/inventory');
        } catch(e) { console.error(e); }
    };

    const handleWriteNFC = async () => {
        if (!item) return;
        const idToWrite = formData.customId || item.id;
        const confirm = window.confirm(`ID auf Tag schreiben?\nID: ${idToWrite}`);
        if(confirm) {
            await writeTag(idToWrite);
        }
    };

    return { handleStartSession, handleSave, handleWash, handleArchive, handleWriteNFC };
}

// ==========================================
// MAIN COMPOSER HOOK (Exportiert)
// ==========================================
export function useItemDetailLogic() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation(); 
    const { currentUser } = useAuth();
    const { writeTag } = useNFCGlobal();

    const { item, setItem, loading, isBusy, dropdowns, stats, recoveryInfo, historyEvents } = useItemFetcher(id, currentUser, navigate);
    const form = useItemForm(item);
    
    const actions = useItemActions({
        id, currentUser, navigate, item, 
        formData: form.formData, pendingFiles: form.pendingFiles, archiveDialog: form.archiveDialog,
        recoveryInfo, isBusy, writeTag, setItem, 
        setIsEditing: form.setIsEditing, setPendingFiles: form.setPendingFiles, setArchiveDialog: form.setArchiveDialog
    });

    useEffect(() => {
        if (!loading && item && location.state?.nfcAction === 'start_session') {
            navigate(location.pathname, { replace: true, state: {} });
            setTimeout(() => {
                actions.handleStartSession(false, true);
            }, 100);
        }
    }, [loading, item, location.state, navigate]);

    return {
        item, loading, isEditing: form.isEditing, isBusy, recoveryInfo, 
        formData: form.formData, dropdowns, stats, historyEvents, archiveDialog: form.archiveDialog,
        galleryImages: form.galleryImages,
        setIsEditing: form.setIsEditing, setFormData: form.setFormData, setArchiveDialog: form.setArchiveDialog,
        actions: {
            startSession: actions.handleStartSession,
            save: actions.handleSave,
            wash: actions.handleWash,
            archive: actions.handleArchive,
            writeNFC: actions.handleWriteNFC,
            addImages: form.handleAddImages
        }
    };
}