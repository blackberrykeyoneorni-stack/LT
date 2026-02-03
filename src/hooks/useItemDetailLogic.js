import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
    doc, getDoc, updateDoc, collection, query, where, getDocs, 
    orderBy, serverTimestamp, arrayUnion 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNFCGlobal } from '../contexts/NFCContext'; 
import { loadVibeTags, calculateItemRecoveryStatus } from '../services/ItemService'; // SSOT Import
import { startSession as startSessionService } from '../services/SessionService'; 
import { safeDate } from '../utils/dateUtils';
import { DEFAULT_ARCHIVE_REASONS, DEFAULT_RUN_LOCATIONS, DEFAULT_RUN_CAUSES } from '../utils/constants';

export function useItemDetailLogic() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation(); 
    const { currentUser } = useAuth();
    
    const { writeTag } = useNFCGlobal();

    // --- STATES ---
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isBusy, setIsBusy] = useState(false); 
    const [restingHoursSetting, setRestingHoursSetting] = useState(24);
    
    // IMAGE UPLOAD STATE
    const [pendingFiles, setPendingFiles] = useState([]); 

    // Form Data
    const [formData, setFormData] = useState({});

    // Dropdown Data
    const [dropdowns, setDropdowns] = useState({
        brands: [],
        categoryStructure: {}, 
        materials: [],
        locations: [],
        vibeTagsList: [],
        archiveReasons: DEFAULT_ARCHIVE_REASONS,
        runLocations: DEFAULT_RUN_LOCATIONS,
        runCauses: DEFAULT_RUN_CAUSES
    });

    // Archive Dialog State
    const [archiveDialog, setArchiveDialog] = useState({
        open: false,
        reason: '',
        runLocation: '',
        runCause: ''
    });

    const [sessions, setSessions] = useState([]);

    // --- LOAD DATA ---
    useEffect(() => {
        if (!currentUser || !id) return;
        
        const fetchData = async () => {
            try {
                // 1. Item & Settings
                const [itemSnap, prefSnap] = await Promise.all([
                    getDoc(doc(db, `users/${currentUser.uid}/items`, id)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`))
                ]);
                
                if (!itemSnap.exists()) {
                    navigate('/inventory'); 
                    return;
                }

                const itemData = { id: itemSnap.id, ...itemSnap.data() };
                setItem(itemData);

                if (prefSnap.exists()) {
                    setRestingHoursSetting(prefSnap.data().nylonRestingHours || 24);
                }
                
                // Form Init
                setFormData({
                    name: itemData.name || '',
                    customId: itemData.customId || '', 
                    brand: itemData.brand || '',
                    model: itemData.model || '',
                    mainCategory: itemData.mainCategory || 'Nylons',
                    subCategory: itemData.subCategory || '',
                    material: itemData.material || '',
                    cost: itemData.cost || '',
                    condition: itemData.condition || 5,
                    location: itemData.location || '',
                    suitablePeriod: itemData.suitablePeriod || 'Beide', 
                    purchaseDate: itemData.purchaseDate ? new Date(itemData.purchaseDate).toISOString().split('T')[0] : '', 
                    vibeTags: itemData.vibeTags || [],
                    notes: itemData.notes || ''
                });

                // 2. Dropdowns
                const [brandSnap, catSnap, matSnap, locSnap, archiveSnap] = await Promise.all([
                    getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/categories`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/locations`)),
                    getDoc(doc(db, `users/${currentUser.uid}/settings/archive`))
                ]);

                let newDropdowns = {
                    brands: brandSnap.exists() ? (brandSnap.data().list || []) : [],
                    categoryStructure: catSnap.exists() ? (catSnap.data().structure || {}) : {},
                    materials: matSnap.exists() ? (matSnap.data().list || []) : [],
                    locations: locSnap.exists() ? (locSnap.data().list || []) : [],
                    vibeTagsList: await loadVibeTags(currentUser.uid),
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

                // 3. Sessions
                const sessionsQ = query(
                    collection(db, `users/${currentUser.uid}/sessions`),
                    where('itemId', '==', id),
                    orderBy('startTime', 'desc')
                );
                const sessionSnaps = await getDocs(sessionsQ);
                const sessionList = sessionSnaps.docs.map(d => ({ id: d.id, ...d.data() }));
                setSessions(sessionList);

                // Busy Check
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

    // --- COMPUTED VALUES ---

    const stats = useMemo(() => {
        let totalMins = 0;
        let releaseCount = 0;
        let survivedCount = 0;
        const wearCount = item?.wearCount || 0;

        sessions.forEach(s => { 
            if (s.durationMinutes) totalMins += s.durationMinutes; 
            if (s.releases && Array.isArray(s.releases)) {
                s.releases.forEach(r => {
                    releaseCount++;
                    if (r.outcome === 'maintained') survivedCount++;
                });
            }
        });

        return { 
            totalWearTime: totalMins, 
            wearCount,
            releaseCount,
            survivalRate: releaseCount > 0 ? Math.round((survivedCount / releaseCount) * 100) : 100,
            cpw: (item?.cost && wearCount) ? (item.cost / wearCount).toFixed(2) : (item?.cost || 0)
        };
    }, [sessions, item]);

    // SSOT FIX: Logik wurde in den Service ausgelagert
    const recoveryInfo = useMemo(() => {
        return calculateItemRecoveryStatus(item, sessions, restingHoursSetting);
    }, [item, sessions, restingHoursSetting]);

    const historyEvents = useMemo(() => {
        const events = [];
        sessions.forEach(s => {
            events.push({ type: 'session', date: safeDate(s.startTime), data: s });
            if (s.releases && Array.isArray(s.releases)) {
                s.releases.forEach(r => events.push({ type: 'release', date: safeDate(r.timestamp), data: { ...r, sessionId: s.id } }));
            }
        });
        if (item?.historyLog) item.historyLog.forEach(log => events.push({ type: log.type, date: new Date(log.date), data: log }));
        else if (item?.cleanDate) events.push({ type: 'wash', date: safeDate(item.cleanDate), data: { legacy: true } });

        return events.sort((a, b) => (b.date || 0) - (a.date || 0));
    }, [sessions, item]);

    const galleryImages = useMemo(() => {
        const existing = item?.images || (item?.imageUrl ? [item.imageUrl] : []);
        const pending = pendingFiles.map(p => p.preview);
        return [...existing, ...pending];
    }, [item, pendingFiles]);

    // --- ACTIONS ---

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

    const handleSave = async () => {
        if (!currentUser || !id) return;
        try {
            const uploadedUrls = [];
            if (pendingFiles.length > 0) {
                for (const p of pendingFiles) {
                    const fileRef = ref(storage, `users/${currentUser.uid}/items/${Date.now()}_${p.file.name}`);
                    await uploadBytes(fileRef, p.file);
                    const url = await getDownloadURL(fileRef);
                    uploadedUrls.push(url);
                }
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

    useEffect(() => {
        if (!loading && item && location.state?.nfcAction === 'start_session') {
            navigate(location.pathname, { replace: true, state: {} });
            setTimeout(() => {
                handleStartSession(false, true);
            }, 100);
        }
    }, [loading, item, location.state]);

    return {
        item, loading, isEditing, isBusy, recoveryInfo, 
        formData, dropdowns, stats, historyEvents, archiveDialog,
        galleryImages,
        setIsEditing, setFormData, setArchiveDialog,
        actions: {
            startSession: handleStartSession,
            save: handleSave,
            wash: handleWash,
            archive: handleArchive,
            writeNFC: handleWriteNFC,
            addImages: handleAddImages
        }
    };
}