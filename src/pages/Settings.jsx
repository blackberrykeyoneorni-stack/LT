import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateBackup, downloadBackupFile } from '../services/BackupService';
import { enableBiometrics, disableBiometrics, isBiometricSupported } from '../services/BiometricService';
import { useSecurity } from '../contexts/SecurityContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import {
  Box, Typography, TextField, Button, Paper,
  Accordion, AccordionSummary, AccordionDetails,
  Chip, Stack, Switch, Slider, Snackbar, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  LinearProgress, CircularProgress,
  List, ListItem, ListItemText, ListItemSecondaryAction, FormControl, InputLabel, Select, MenuItem,
  Grid, Divider, Avatar
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

const formatHours = (val) => `${val}h`;

export default function Settings() {
  const { currentUser, logout } = useAuth();
  const { isBiometricActive, updateStatus } = useSecurity();
  const { startBindingScan, isScanning } = useNFCGlobal();
  
  // STATE: Listen
  const [brands, setBrands] = useState([]);
  const [newBrand, setNewBrand] = useState('');
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState('');

  // STATE: Kategorien
  const [catStructure, setCatStructure] = useState({});
  const [newMainCat, setNewMainCat] = useState('');
  const [newSubCat, setNewSubCat] = useState('');
  const [selectedMainForSub, setSelectedMainForSub] = useState('');
  
  // STATE: Locations & NFC
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState('');
  const [locationIndex, setLocationIndex] = useState({});
  const [pairingLocation, setPairingLocation] = useState(null);

  // STATE: Archivierung
  const [archiveReasons, setArchiveReasons] = useState([]);
  const [newArchiveReason, setNewArchiveReason] = useState('');
  const [runLocations, setRunLocations] = useState([]);
  const [newRunLocation, setNewRunLocation] = useState('');
  const [runCauses, setRunCauses] = useState([]);
  const [newRunCause, setNewRunCause] = useState('');

  // STATE: Preferences
  const [dailyTargetHours, setDailyTargetHours] = useState(3);
  const [nylonRestingHours, setNylonRestingHours] = useState(24);
  const [maxInstructionItems, setMaxInstructionItems] = useState(1);
  const [previousTarget, setPreviousTarget] = useState(null);
  
  // STATE: Sissy Protokoll & Test State
  const [sissyProtocolEnabled, setSissyProtocolEnabled] = useState(false);
  const [tzdTestMode, setTzdTestMode] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // STATE: Gewichtung (Weights)
  const [categoryWeights, setCategoryWeights] = useState({});
  const [weightTarget, setWeightTarget] = useState('');
  const [weightValue, setWeightValue] = useState(2);

  // UI
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  useEffect(() => {
    if (currentUser) loadAll();
    checkBiometrics();
  }, [currentUser]);

  const checkBiometrics = async () => {
    const avail = await isBiometricSupported();
    setBiometricAvailable(avail);
  };

  const loadAll = async () => {
    try {
      const [bSnap, mSnap, cSnap, pSnap, lSnap, idxSnap, archSnap] = await Promise.all([
        getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
        getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
        getDoc(doc(db, `users/${currentUser.uid}/settings/categories`)),
        getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`)),
        getDoc(doc(db, `users/${currentUser.uid}/settings/locations`)),
        getDoc(doc(db, `users/${currentUser.uid}/settings/locationIndex`)),
        getDoc(doc(db, `users/${currentUser.uid}/settings/archive`))
      ]);

      if (bSnap.exists()) setBrands(bSnap.data().list || []);
      if (mSnap.exists()) setMaterials(mSnap.data().list || []);
      if (cSnap.exists()) setCatStructure(cSnap.data().structure || {});
      if (pSnap.exists()) {
        const data = pSnap.data();
        setDailyTargetHours(data.dailyTargetHours || 3);
        setNylonRestingHours(data.nylonRestingHours || 24);
        setMaxInstructionItems(data.maxInstructionItems || 1);
        setPreviousTarget(data.previousTargetHours || null);
        setSissyProtocolEnabled(data.sissyProtocolEnabled || false);
        setTzdTestMode(data.tzdTestMode || false);
        setCategoryWeights(data.categoryWeights || {});
      }

      if (lSnap.exists()) setLocations(lSnap.data().list || []);
      if (idxSnap.exists()) setLocationIndex(idxSnap.data() || {});
      if (archSnap.exists()) {
        const data = archSnap.data();
        setArchiveReasons(data.reasons || []);
        setRunLocations(data.runLocations || []);
        setRunCauses(data.runCauses || []);
      } else {
        setArchiveReasons([{ value: 'run', label: 'Laufmasche' }, { value: 'worn_out', label: 'Verschlissen' }]);
        setRunLocations(["Zeh", "Ferse", "Schenkel"]);
        setRunCauses(["Schuhe", "Reibung", "Unbekannt"]);
      }

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- NFC PAIRING LOGIC ---
  const handleStartPairing = (locName) => {
    setPairingLocation(locName);
    startBindingScan(async (tagId) => {
       await handleConfirmPairing(tagId, locName);
    });
  };

  const handleConfirmPairing = async (tagId, locName) => {
    const locationToPair = locName || pairingLocation;
    if (!locationToPair) return;

    try {
      const indexRef = doc(db, `users/${currentUser.uid}/settings/locationIndex`);
      await setDoc(indexRef, { [tagId]: locationToPair }, { merge: true });
      setLocationIndex(prev => ({ ...prev, [tagId]: locationToPair }));
      showToast(`Tag ${tagId} mit "${locationToPair}" verknüpft!`, "success");
    } catch (e) {
      showToast("Fehler beim Verknüpfen.", "error");
    } finally {
      setPairingLocation(null);
    }
  };

  // --- SAVE HANDLERS ---
  const savePreferences = async () => {
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/settings/preferences`), {
        dailyTargetHours,
        nylonRestingHours,
        maxInstructionItems,
        sissyProtocolEnabled, 
        tzdTestMode,
        categoryWeights
      });
      showToast("Alle Einstellungen gespeichert.", "success");
    } catch (e) { showToast("Fehler beim Speichern.", "error"); }
  };

  // --- WEIGHT HANDLERS ---
  const addWeight = () => {
      if (!weightTarget) return;
      const newWeights = { ...categoryWeights, [weightTarget]: weightValue };
      setCategoryWeights(newWeights);
      setWeightTarget('');
      setWeightValue(2);
  };
  
  const removeWeight = (target) => {
      const newWeights = { ...categoryWeights };
      delete newWeights[target];
      setCategoryWeights(newWeights);
  };

  // GENERIC LISTS
  const addItemToList = async (listName, item, setItems, items) => {
    if (!item) return;
    const newList = [...items, item];
    await setDoc(doc(db, `users/${currentUser.uid}/settings/${listName}`), { list: newList });
    setItems(newList);
  };

  const removeItemFromList = async (listName, item, setItems, items) => {
    const newList = items.filter(i => i !== item);
    await setDoc(doc(db, `users/${currentUser.uid}/settings/${listName}`), { list: newList });
    setItems(newList);
  };

  // ARCHIVE
  const addArchiveItem = async (field, value, setLocalState, currentList) => {
      if (!value) return;
      const newItem = field === 'reasons' ? { value: value.toLowerCase().replace(/\s/g, '_'), label: value } : value;
      const newList = [...currentList, newItem];
      try {
        await setDoc(doc(db, `users/${currentUser.uid}/settings/archive`), { [field]: newList }, { merge: true });
        setLocalState(newList);
        if (field === 'reasons') setNewArchiveReason('');
        if (field === 'runLocations') setNewRunLocation('');
        if (field === 'runCauses') setNewRunCause('');
      } catch (e) { showToast("Fehler", "error"); }
  };
  const removeArchiveItem = async (field, itemToRemove, setLocalState, currentList) => {
    const newList = currentList.filter(i => i !== itemToRemove);
    await updateDoc(doc(db, `users/${currentUser.uid}/settings/archive`), { [field]: newList });
    setLocalState(newList);
  };

  // CATEGORY HANDLERS
  const addMainCategory = async () => {
    if (!newMainCat) return;
    const newStruct = { ...catStructure, [newMainCat]: [] };
    await setDoc(doc(db, `users/${currentUser.uid}/settings/categories`), { structure: newStruct });
    setCatStructure(newStruct); setNewMainCat('');
  };
  const deleteMainCategory = async (mainCat) => {
    if (!window.confirm(`Kategorie "${mainCat}" und alle Unterkategorien löschen?`)) return;
    const newStruct = { ...catStructure };
    delete newStruct[mainCat];
    await setDoc(doc(db, `users/${currentUser.uid}/settings/categories`), { structure: newStruct });
    setCatStructure(newStruct);
  };
  const addSubCategory = async () => {
    if (!selectedMainForSub || !newSubCat) return;
    const currentSubs = catStructure[selectedMainForSub] || [];
    const newStruct = { ...catStructure, [selectedMainForSub]: [...currentSubs, newSubCat] };
    await setDoc(doc(db, `users/${currentUser.uid}/settings/categories`), { structure: newStruct });
    setCatStructure(newStruct); setNewSubCat('');
  };
  const deleteSubCategory = async (mainCat, subCat) => {
    const currentSubs = catStructure[mainCat] || [];
    const newSubs = currentSubs.filter(s => s !== subCat);
    const newStruct = { ...catStructure, [mainCat]: newSubs };
    await setDoc(doc(db, `users/${currentUser.uid}/settings/categories`), { structure: newStruct });
    setCatStructure(newStruct);
  };

  // ACTIONS
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const data = await generateBackup(currentUser.uid);
      downloadBackupFile(data);
      showToast("Backup heruntergeladen.");
    } catch (e) { showToast(e.message, "error"); } finally { setBackupLoading(false); }
  };

  // BIOMETRIE
  const handleToggleBiometrics = async (event) => {
    const targetState = event.target.checked; 
    
    if (!targetState) {
      disableBiometrics();
      updateStatus();
      showToast("Biometrische Sperre deaktiviert.", "info");
    } else {
      try {
        const success = await enableBiometrics(currentUser.uid);
        if (success) {
          updateStatus();
          showToast("Biometrie erfolgreich aktiviert!", "success");
        } else {
          updateStatus(); 
          showToast("Aktivierung fehlgeschlagen. Versuche es erneut.", "error");
        }
      } catch (e) {
        console.error("Biometrie Fehler:", e);
        showToast("Fehler: " + e.message, "error");
      }
    }
  };

  const handleSmartReset = async () => {
    if (previousTarget) {
      setDailyTargetHours(previousTarget);
      await updateDoc(doc(db, `users/${currentUser.uid}/settings/preferences`), {
        dailyTargetHours: previousTarget,
        lastWeeklyUpdate: serverTimestamp()
      });
      showToast(`Ziel auf ${previousTarget}h zurückgesetzt.`);
      setResetModalOpen(false);
    }
  };

  // --- REPAIR DATABASE (SAFE CHUNKING FIX) ---
  const handleRepairDatabase = async () => {
    if (!window.confirm("Dies berechnet alle Statistiken (Tragezeit, Cost per Wear) neu. Fortfahren?")) return;
    setRepairLoading(true);
    try {
      const itemsSnap = await getDocs(collection(db, `users/${currentUser.uid}/items`));
      const sessionSnap = await getDocs(collection(db, `users/${currentUser.uid}/sessions`));
      
      const itemStats = {};
      itemsSnap.docs.forEach(d => { itemStats[d.id] = { count: 0, minutes: 0, lastWorn: null }; });
      
      sessionSnap.docs.forEach(doc => {
        const s = doc.data();
        if (s.itemId && itemStats[s.itemId]) {
          itemStats[s.itemId].count += 1;
          if (s.durationMinutes) itemStats[s.itemId].minutes += s.durationMinutes;

          const sEnd = s.endTime ? s.endTime.toDate() : (s.startTime ? s.startTime.toDate() : null);
          if (sEnd) {
            const current = itemStats[s.itemId].lastWorn;
            if (!current || sEnd > current) itemStats[s.itemId].lastWorn = sEnd;
          }
        }
      });

      // BATCH CHUNKING (Max 500 Ops per Batch)
      const updates = Object.entries(itemStats);
      const CHUNK_SIZE = 450; // Sicherheitsabstand zu 500
      let processedCount = 0;

      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
          const chunk = updates.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          
          chunk.forEach(([id, stats]) => {
              const ref = doc(db, `users/${currentUser.uid}/items`, id);
              batch.update(ref, {
                  wearCount: stats.count,
                  totalMinutes: stats.minutes,
                  lastWorn: stats.lastWorn || null
              });
          });
          
          await batch.commit();
          processedCount += chunk.length;
      }

      showToast(`Datenbank repariert. ${processedCount} Items aktualisiert.`);
    } catch (e) { 
        console.error(e);
        showToast("Fehler bei Reparatur.", "error"); 
    } finally { 
        setRepairLoading(false); 
    }
  };

  const isLocationPaired = (locName) => { return Object.values(locationIndex).includes(locName); };
  
  // STYLES
  const accordionStyle = {
    bgcolor: 'transparent',
    backgroundImage: 'none',
    boxShadow: 'none',
    border: `1px solid ${PALETTE.background.glassBorder}`,
    borderRadius: '12px !important',
    marginBottom: 2,
    '&:before': { display: 'none' },
    '&.Mui-expanded': {
      margin: '0 0 16px 0',
      borderColor: PALETTE.primary.main
    }
  };
  const SectionHeader = ({ icon: Icon, title, color }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, color: color || 'text.primary' }}>
      <Avatar sx={{ bgcolor: `${color}22`, color: color, width: 32, height: 32 }}>
        <Icon fontSize="small" />
      </Avatar>
      <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</Typography>
    </Box>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  // Flatten Categories
  const allCategoryOptions = [];
  Object.keys(catStructure).forEach(main => {
      allCategoryOptions.push({ label: `HAUPT: ${main}`, value: main, type: 'main' });
      catStructure[main].forEach(sub => {
          allCategoryOptions.push({ label: `• ${sub}`, value: sub, type: 'sub' });
      });
  });

  return (
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Einstellungen</Typography>

      {/* --- PREFERENCES (ACCORDION - GESCHLOSSEN) --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Track} title="Ziele & Limits" color={PALETTE.primary.main} />
        </AccordionSummary>
        <AccordionDetails>
            <Box sx={{ mb: 4, mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Tagesziel</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography fontWeight="bold" color="primary">{dailyTargetHours} Std</Typography>
                {previousTarget && dailyTargetHours > previousTarget && (
                    <Chip icon={<Icons.Reset style={{ fontSize: 14 }} />} label={`Reset ${previousTarget}h`} size="small" color="warning" variant="outlined" onClick={() => setResetModalOpen(true)} />
                )}
                </Box>
            </Box>
            <Slider value={dailyTargetHours} min={1} max={12} step={0.5} valueLabelDisplay="auto" onChange={(e, v) => setDailyTargetHours(v)} sx={{ color: PALETTE.primary.main }} />
            </Box>

            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Elasthan-Ruhezeit</Typography>
                    <Typography fontWeight="bold" color="secondary">{nylonRestingHours} Std</Typography>
                </Box>
                <Slider value={nylonRestingHours} min={0} max={72} step={6} valueLabelDisplay="auto" onChange={(e, v) => setNylonRestingHours(v)} sx={{ color: PALETTE.secondary.main }} />
            </Box>

            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Max. Layering-Tiefe</Typography>
                    <Typography fontWeight="bold" sx={{ color: PALETTE.accents.purple }}>{maxInstructionItems} Items</Typography>
                </Box>
                <Slider value={maxInstructionItems} min={1} max={3} step={1} marks valueLabelDisplay="auto" onChange={(e, v) => setMaxInstructionItems(v)} sx={{ color: PALETTE.accents.purple }} />
            </Box>

            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="body1" color={sissyProtocolEnabled ? "error" : "text.primary"} fontWeight={sissyProtocolEnabled ? "bold" : "normal"}>Hardcore Protokoll</Typography>
                    <Typography variant="caption" color="text.secondary">Erzwingt Ingestion bei Nacht-Sessions</Typography>
                </Box>
                <Switch checked={sissyProtocolEnabled} onChange={(e) => setSissyProtocolEnabled(e.target.checked)} color="error" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="body1" color={tzdTestMode ? "warning.main" : "text.secondary"} sx={{ display:'flex', alignItems:'center', gap:1 }}>
                    <Icons.Build fontSize="small" /> Test-Modus (Dev)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Ignoriert 2026-Sperre</Typography>
                </Box>
                <Switch checked={tzdTestMode} onChange={(e) => setTzdTestMode(e.target.checked)} color="warning" disabled={!sissyProtocolEnabled} />
                </Stack>
            </Stack>
        </AccordionDetails>
      </Accordion>

      {/* --- ALGORITHMUS & WAHRSCHEINLICHKEITEN --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Brain} title="Algorithmus & Wahrscheinlichkeit" color={PALETTE.accents.purple} /></AccordionSummary>
         <AccordionDetails>
            <Alert severity="info" sx={{mb: 2, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff'}}>
                Definiere hier, welche Kategorien bevorzugt gezogen werden sollen ("Weighted Randomness").
            </Alert>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 3 }}>
                <FormControl fullWidth size="small">
                    <InputLabel>Kategorie wählen</InputLabel>
                    <Select value={weightTarget} label="Kategorie wählen" onChange={e => setWeightTarget(e.target.value)}>
                        {allCategoryOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                
                <Box sx={{ width: 150, px: 1 }}>
                      <Typography variant="caption" display="block">Gewicht: x{weightValue}</Typography>
                      <Slider 
                        value={weightValue} min={2} max={10} step={1} 
                        onChange={(e, v) => setWeightValue(v)} 
                        size="small"
                        sx={{ color: PALETTE.accents.purple }}
                      />
                </Box>
                
                <Button variant="contained" onClick={addWeight} sx={{ bgcolor: PALETTE.accents.purple, minWidth: 40 }}><Icons.Add /></Button>
            </Box>

            <Typography variant="caption" color="text.secondary" gutterBottom>AKTIVE GEWICHTUNGEN</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(categoryWeights).map(([cat, weight]) => (
                    <Chip 
                        key={cat} 
                        label={`${cat}: ${weight}x Chance`} 
                        onDelete={() => removeWeight(cat)} 
                        color="secondary" 
                        variant="outlined"
                        sx={{ borderColor: PALETTE.accents.purple, color: PALETTE.accents.purple }}
                    />
                ))}
                {Object.keys(categoryWeights).length === 0 && (
                    <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>Keine Anpassungen (Alle Items gleichberechtigt)</Typography>
                )}
            </Box>
         </AccordionDetails>
      </Accordion>

      {/* --- LOCATIONS (MIT NFC) --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Inventory} title="Lagerorte & NFC" color={PALETTE.accents.blue} /></AccordionSummary>
         <AccordionDetails>
             <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField size="small" fullWidth label="Neuer Ort (z.B. Box A)" value={newLocation} onChange={e => setNewLocation(e.target.value)} variant="outlined" />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.blue }} onClick={() => { addItemToList('locations', newLocation, setLocations, locations); setNewLocation(''); }}><Icons.Add /></Button>
             </Box>
             <Stack spacing={1}>
                {locations.map(loc => (
                  <Paper key={loc} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{loc}</Typography>
                      {isLocationPaired(loc) && <Chip icon={<Icons.Link style={{ fontSize: 14 }} />} label="NFC" size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                    </Box>
                    <Box>
                      <IconButton size="small" color={isLocationPaired(loc) ? "secondary" : "default"} onClick={() => handleStartPairing(loc)} disabled={isScanning}>
                        {isScanning && pairingLocation === loc ? <CircularProgress size={16} /> : <Icons.Nfc fontSize="small" />}
                      </IconButton>
                      <IconButton size="small" sx={{ color: PALETTE.accents.red }} onClick={() => removeItemFromList('locations', loc, setLocations, locations)}><Icons.Delete fontSize="small" /></IconButton>
                    </Box>
                  </Paper>
                ))}
             </Stack>
             {pairingLocation && <Alert severity="info" variant="outlined" sx={{ mt: 2, borderColor: PALETTE.accents.blue, color: PALETTE.accents.blue }}>Scanne NFC Tag für <strong>{pairingLocation}</strong>...</Alert>}
         </AccordionDetails>
      </Accordion>

      {/* --- ARCHIV KONFIG --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.accents.red}` }}>
           <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Archive} title="Archiv & Forensik" color={PALETTE.accents.red} /></AccordionSummary>
           <AccordionDetails>
             <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>GRÜNDE (DROPDOWN)</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField size="small" fullWidth label="Neuer Grund" value={newArchiveReason} onChange={e => setNewArchiveReason(e.target.value)} />
                    <Button variant="contained" sx={{ bgcolor: PALETTE.accents.red }} onClick={() => { addArchiveItem('reasons', newArchiveReason, setArchiveReasons, archiveReasons); }}><Icons.Add /></Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{archiveReasons.map((r, i) => <Chip key={i} label={r.label || r} size="small" variant="outlined" onDelete={() => removeArchiveItem('reasons', r, setArchiveReasons, archiveReasons)} />)}</Box>
                </Grid>
                <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} /></Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>LAUFMASCHEN-ORTE</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField size="small" fullWidth label="Ort (z.B. Knie)" value={newRunLocation} onChange={e => setNewRunLocation(e.target.value)} />
                    <Button variant="contained" sx={{ bgcolor: PALETTE.accents.red }} onClick={() => { addArchiveItem('runLocations', newRunLocation, setRunLocations, runLocations); }}><Icons.Add /></Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{runLocations.map((l, i) => <Chip key={i} label={l} size="small" variant="outlined" onDelete={() => removeArchiveItem('runLocations', l, setRunLocations, runLocations)} />)}</Box>
                </Grid>
                <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} /></Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>URSACHEN</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField size="small" fullWidth label="Ursache (z.B. Reibung)" value={newRunCause} onChange={e => setNewRunCause(e.target.value)} />
                    <Button variant="contained" sx={{ bgcolor: PALETTE.accents.red }} onClick={() => { addArchiveItem('runCauses', newRunCause, setRunCauses, runCauses); }}><Icons.Add /></Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{runCauses.map((c, i) => <Chip key={i} label={c} size="small" variant="outlined" onDelete={() => removeArchiveItem('runCauses', c, setRunCauses, runCauses)} />)}</Box>
                </Grid>
             </Grid>
           </AccordionDetails>
      </Accordion>

      {/* --- KATEGORIEN --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.accents.gold}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Category} title="Kategorien" color={PALETTE.accents.gold} /></AccordionSummary>
         <AccordionDetails>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>HAUPTKATEGORIE</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField size="small" fullWidth label="Name" value={newMainCat} onChange={e => setNewMainCat(e.target.value)} />
                  <Button variant="contained" sx={{ bgcolor: PALETTE.accents.gold, color: 'black' }} onClick={addMainCategory}><Icons.Add /></Button>
                </Box>
              </Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>SUB-KATEGORIE</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Hauptkategorie</InputLabel>
                    <Select value={selectedMainForSub} label="Hauptkategorie" onChange={e => setSelectedMainForSub(e.target.value)}>
                      {Object.keys(catStructure).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" fullWidth label="Name Sub" value={newSubCat} onChange={e => setNewSubCat(e.target.value)} />
                  <Button variant="contained" sx={{ bgcolor: PALETTE.accents.gold, color: 'black' }} onClick={addSubCategory}><Icons.Add /></Button>
                </Box>
              </Box>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
              <List disablePadding>
                  {Object.keys(catStructure).map(mainCat => (
                  <Box key={mainCat} sx={{ mb: 2 }}>
                    <ListItem sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <ListItemText primary={mainCat} primaryTypographyProps={{ fontWeight: 'bold', color: PALETTE.accents.gold }} />
                      <ListItemSecondaryAction><IconButton edge="end" size="small" sx={{ color: PALETTE.accents.red }} onClick={() => deleteMainCategory(mainCat)}><Icons.Delete fontSize="small" /></IconButton></ListItemSecondaryAction>
                    </ListItem>
                    <Box sx={{ pl: 2, mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {catStructure[mainCat].map(sub => (<Chip key={sub} label={sub} onDelete={() => deleteSubCategory(mainCat, sub)} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />))}
                    </Box>
                  </Box>
                ))}
              </List>
         </AccordionDetails>
      </Accordion>

      {/* --- MARKEN & MATERIALIEN --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.accents.green}` }}>
           <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Label} title="Marken & Materialien" color={PALETTE.accents.green} /></AccordionSummary>
           <AccordionDetails>
              <Typography variant="caption" color="text.secondary" gutterBottom>MARKEN</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth label="Neue Marke" value={newBrand} onChange={e => setNewBrand(e.target.value)} />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.green }} onClick={() => { addItemToList('brands', newBrand, setBrands, brands); setNewBrand(''); }}><Icons.Add /></Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>{brands.map(b => <Chip key={b} label={b} size="small" variant="outlined" onDelete={() => removeItemFromList('brands', b, setBrands, brands)} />)}</Box>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
              <Typography variant="caption" color="text.secondary" gutterBottom>MATERIALIEN</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth label="Neues Material" value={newMaterial} onChange={e => setNewMaterial(e.target.value)} />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.green }} onClick={() => { addItemToList('materials', newMaterial, setMaterials, materials); setNewMaterial(''); }}><Icons.Add /></Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{materials.map(m => <Chip key={m} label={m} size="small" variant="outlined" onDelete={() => removeItemFromList('materials', m, setMaterials, materials)} />)}</Box>
           </AccordionDetails>
      </Accordion>

      {/* --- SYSTEM (JETZT ALS ACCORDION) --- */}
      <Accordion sx={{ ...accordionStyle, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Settings} title="System" color={PALETTE.primary.main} /></AccordionSummary>
         <AccordionDetails>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Icons.Fingerprint sx={{ color: isBiometricActive ? PALETTE.primary.main : 'text.secondary' }} />
                <Box>
                    <Typography variant="body1">Biometrischer Schutz</Typography>
                    <Typography variant="caption" color="text.secondary">App sperren bei Inaktivität</Typography>
                </Box>
                </Box>
                <Switch checked={isBiometricActive} onChange={handleToggleBiometrics} disabled={!biometricAvailable} color="primary" />
            </Stack>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            <Button variant="outlined" color="warning" startIcon={<Icons.Build />} fullWidth onClick={handleRepairDatabase} disabled={repairLoading} sx={{ mb: 1, justifyContent: 'flex-start' }}>
                {repairLoading ? "Repariere..." : "Datenbank Reparatur (Recalc)"}
            </Button>
            {repairLoading && <LinearProgress color="warning" sx={{ mb: 2, borderRadius: 1 }} />}
         </AccordionDetails>
      </Accordion>

      {/* --- GLOBALER SPEICHERN BUTTON --- */}
      <Button 
        variant="contained" 
        size="large" 
        fullWidth 
        sx={{ ...DESIGN_TOKENS.buttonGradient, mt: 2, mb: 4, height: 56, fontSize: '1.1rem' }} 
        onClick={savePreferences}
      >
        Alle Einstellungen Speichern
      </Button>

      {/* --- FOOTER: BACKUP & LOGOUT --- */}
      <Paper sx={{ p: 2, mb: 4, ...DESIGN_TOKENS.glassCard, display: 'flex', gap: 2 }}>
        <Button variant="outlined" color="primary" fullWidth startIcon={backupLoading ? <CircularProgress size={20} /> : <Icons.Cloud />} onClick={handleBackup} disabled={backupLoading}>Backup</Button>
        <Button variant="outlined" color="error" fullWidth onClick={logout} startIcon={<Icons.Close />}>Abmelden</Button>
      </Paper>

      {/* --- DIALOGE --- */}
      <Dialog open={resetModalOpen} onClose={() => setResetModalOpen(false)}>
        <DialogTitle>Ziel wiederherstellen?</DialogTitle>
        <DialogContent><DialogContentText>Reset auf {previousTarget ? formatHours(previousTarget) : "unbekannt"} (Vorwoche)?</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setResetModalOpen(false)}>Abbrechen</Button><Button onClick={handleSmartReset} color="warning" variant="contained">Reset</Button></DialogActions>
      </Dialog>
      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}><Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>{toast.message}</Alert></Snackbar>
    </Box>
  );
}
