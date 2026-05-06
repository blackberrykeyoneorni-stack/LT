import React, { useState, useEffect, useRef } from 'react';
import { 
    doc, getDoc, setDoc, writeBatch, serverTimestamp, collection, getDocs, query, where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSecurity } from '../contexts/SecurityContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { generateBackup, downloadBackupFile, restoreBackup } from '../services/BackupService';
import { enableBiometrics, disableBiometrics, isBiometricSupported } from '../services/BiometricService';
import { addSuspension, getSuspensions, terminateSuspension, deleteScheduledSuspension } from '../services/SuspensionService';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

import ProtocolSettings from '../components/settings/ProtocolSettings';

import {
  Box, Container, Typography, TextField, Button, Paper,
  Accordion, AccordionSummary, AccordionDetails,
  Chip, Stack, Switch, Slider, Snackbar, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  CircularProgress, List, ListItem, ListItemText, FormControl, InputLabel, Select, MenuItem,
  Divider, Avatar, FormControlLabel, Checkbox
} from '@mui/material';

import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import ScienceIcon from '@mui/icons-material/Science';
import TuneIcon from '@mui/icons-material/Tune'; 
import SaveIcon from '@mui/icons-material/Save'; 
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import UploadIcon from '@mui/icons-material/Upload';

export default function Settings() {
  const { currentUser, logout } = useAuth();
  const { isBiometricActive, updateStatus } = useSecurity();
  const { startBindingScan } = useNFCGlobal();
  
  const [brands, setBrands] = useState([]); const [newBrand, setNewBrand] = useState('');
  const [materials, setMaterials] = useState([]); const [newMaterial, setNewMaterial] = useState('');
  
  const [catStructure, setCatStructure] = useState({}); 
  const [newMainCat, setNewMainCat] = useState(''); 
  const [newSubCat, setNewSubCat] = useState(''); 
  
  const [locations, setLocations] = useState([]); 
  const [newLocation, setNewLocation] = useState(''); 
  const [locationIndex, setLocationIndex] = useState({}); 
  const [pairingLocation, setPairingLocation] = useState(null);
  
  const [archiveReasons, setArchiveReasons] = useState([]); const [newArchiveReason, setNewArchiveReason] = useState('');
  const [runLocations, setRunLocations] = useState([]); const [newRunLocation, setNewRunLocation] = useState('');
  const [runCauses, setRunCauses] = useState([]); const [newRunCause, setNewRunCause] = useState('');

  const [categoryWeights, setCategoryWeights] = useState({}); 
  const [weightTarget, setWeightTarget] = useState(''); 
  const [weightValue, setWeightValue] = useState(2);

  const [maxInstructionItems, setMaxInstructionItems] = useState(1); 
  const [extortionTriggerChance, setExtortionTriggerChance] = useState(0.05); // NEU: Erpressungs-Protokoll State
  
  const [protocolRules, setProtocolRules] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  
  const [suspensions, setSuspensions] = useState([]);
  const [suspensionDialog, setSuspensionDialog] = useState(false);
  const [suspensionDialogMode, setSuspensionDialogMode] = useState('plan'); 
  const [newSuspension, setNewSuspension] = useState({ type: 'medical', reason: '', startDate: '', endDate: '' });
  const [allItems, setAllItems] = useState([]);
  
  const [stealthConfig, setStealthConfig] = useState({
      dayIntensity: 1,
      nightIntensity: 1,
      allowedDaySubCategories: []
  });
  const [systemPackedItems, setSystemPackedItems] = useState({ day: [], night: [] });

  const [loading, setLoading] = useState(true); 
  const [backupLoading, setBackupLoading] = useState(false); 
  const [isSavingAll, setIsSavingAll] = useState(false); 
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const fileInputRef = useRef(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  useEffect(() => { 
    if (currentUser) { 
        loadAll(); 
        checkBiometrics(); 
        loadSuspensions(); 
    } 
  }, [currentUser]);

  const loadAll = async () => {
      try {
          const userId = currentUser.uid;
          const [bSnap, mSnap, catSnap, locSnap, locIdxSnap, prefSnap, arSnap, rlSnap, rcSnap, protSnap, itemsSnap] = await Promise.all([
              getDoc(doc(db, `users/${userId}/settings/brands`)),
              getDoc(doc(db, `users/${userId}/settings/materials`)),
              getDoc(doc(db, `users/${userId}/settings/categories`)),
              getDoc(doc(db, `users/${userId}/settings/locations`)),
              getDoc(doc(db, `users/${userId}/settings/locationIndex`)),
              getDoc(doc(db, `users/${userId}/settings/preferences`)),
              getDoc(doc(db, `users/${userId}/settings/archiveReasons`)),
              getDoc(doc(db, `users/${userId}/settings/runLocations`)),
              getDoc(doc(db, `users/${userId}/settings/runCauses`)),
              getDoc(doc(db, `users/${userId}/settings/protocol`)),
              getDocs(query(collection(db, `users/${userId}/items`), where('status', '==', 'active')))
          ]);

          if (bSnap.exists()) setBrands(bSnap.data().list || []);
          if (mSnap.exists()) setMaterials(mSnap.data().list || []);
          if (catSnap.exists()) setCatStructure(catSnap.data().structure || {});
          if (locSnap.exists()) setLocations(locSnap.data().list || []);
          if (locIdxSnap.exists()) setLocationIndex(locIdxSnap.data().mapping || {});
          
          if (prefSnap.exists()) {
              const d = prefSnap.data();
              setMaxInstructionItems(d.maxInstructionItems || 1);
              setCategoryWeights(d.categoryWeights || {});
          }

          let mergedRules = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_RULES));
          mergedRules.currentDailyGoal = 4;
          if (protSnap.exists()) {
              const data = protSnap.data();
              if (data.currentDailyGoal !== undefined) mergedRules.currentDailyGoal = data.currentDailyGoal;
              
              // KORREKTUR: Lade Erpressungs-Wahrscheinlichkeit und ergänze mergedRules
              if (data.extortion && data.extortion.triggerChance !== undefined) {
                  setExtortionTriggerChance(data.extortion.triggerChance);
                  mergedRules.extortion = { triggerChance: data.extortion.triggerChance };
              }

              mergedRules.tzd = { 
                  ...mergedRules.tzd, ...(data.tzd || {}),
                  durationMatrix: (data.tzd && data.tzd.durationMatrix) ? data.tzd.durationMatrix : mergedRules.tzd.durationMatrix
              };
              mergedRules.purity = { ...mergedRules.purity, ...(data.purity || {}) };
              mergedRules.instruction = { 
                  ...mergedRules.instruction, ...(data.instruction || {}),
                  forcedReleaseMethods: { ...mergedRules.instruction.forcedReleaseMethods, ...(data.instruction?.forcedReleaseMethods || {}) }
              };
              mergedRules.punishment = { ...mergedRules.punishment, ...(data.punishment || {}) };
          }
          setProtocolRules(mergedRules);

          setArchiveReasons(arSnap.exists() ? arSnap.data().list : ['Laufmasche', 'Verschlissen', 'Verloren', 'Spende']);
          setRunLocations(rlSnap.exists() ? rlSnap.data().list : ['Zehe', 'Ferse', 'Sohle', 'Oberschenkel', 'Zwickel']);
          setRunCauses(rcSnap.exists() ? rcSnap.data().list : ['Schuhe', 'Nägel', 'Schmuck', 'Möbel', 'Unbekannt']);
          
          const itemsData = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAllItems(itemsData);

      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadSuspensions = async () => {
      try {
          const list = await getSuspensions(currentUser.uid);
          setSuspensions(list);
      } catch(e) { console.error(e); }
  };

  const checkBiometrics = async () => {
      const avail = await isBiometricSupported();
      setBiometricAvailable(avail);
  };

  const handleSaveAll = async () => {
      setIsSavingAll(true);
      try {
          const batch = writeBatch(db);
          const uid = currentUser.uid;

          const prefRef = doc(db, `users/${uid}/settings/preferences`);
          const prefSnap = await getDoc(prefRef);
          if (prefSnap.exists()) {
              batch.update(prefRef, { maxInstructionItems, categoryWeights });
          } else {
              batch.set(prefRef, { maxInstructionItems, categoryWeights, dailyTargetHours: protocolRules.currentDailyGoal || 4 });
          }

          if (protocolRules) {
              const protocolRef = doc(db, `users/${uid}/settings/protocol`);
              const cleanRules = { ...protocolRules };
              
              // KORREKTUR: Speichere den extortion-Wert sicher im Protokoll ab
              if (cleanRules.extortion) {
                  cleanRules.extortion.triggerChance = extortionTriggerChance;
              } else {
                  cleanRules.extortion = { triggerChance: extortionTriggerChance };
              }

              batch.set(protocolRef, cleanRules, { merge: true });
          }

          batch.set(doc(db, `users/${uid}/settings/brands`), { list: brands });
          batch.set(doc(db, `users/${uid}/settings/materials`), { list: materials });
          batch.set(doc(db, `users/${uid}/settings/categories`), { structure: catStructure });
          batch.set(doc(db, `users/${uid}/settings/locations`), { list: locations });
          batch.set(doc(db, `users/${uid}/settings/locationIndex`), { mapping: locationIndex });
          batch.set(doc(db, `users/${uid}/settings/archiveReasons`), { list: archiveReasons });
          batch.set(doc(db, `users/${uid}/settings/runLocations`), { list: runLocations });
          batch.set(doc(db, `users/${uid}/settings/runCauses`), { list: runCauses });

          await batch.commit();
          showToast("Gesamte System-Konfiguration gespeichert.");
      } catch(e) { console.error(e); showToast("Fehler beim Speichern.", "error"); }
      finally { setIsSavingAll(false); }
  };

  const addListEntry = (setter, val, resetter) => {
      if(!val) return;
      setter(prev => [...new Set([...prev, val])]);
      resetter('');
  };
  const removeListEntry = (setter, val) => setter(prev => prev.filter(v => v !== val));

  const addMainCat = () => {
      if (!newMainCat) return;
      setCatStructure(prev => ({ ...prev, [newMainCat]: [] }));
      setNewMainCat('');
  };
  
  const addSubCat = (mainCat) => {
      if (!newSubCat) return;
      setCatStructure(prev => ({
          ...prev,
          [mainCat]: [...new Set([...(prev[mainCat] || []), newSubCat])]
      }));
      setNewSubCat('');
  };
  
  const removeSubCat = (mainCat, sub) => {
      setCatStructure(prev => ({
          ...prev,
          [mainCat]: prev[mainCat].filter(s => s !== sub)
      }));
  };

  const removeMainCat = (mainCat) => {
      setCatStructure(prev => {
          const newStruct = { ...prev };
          delete newStruct[mainCat];
          return newStruct;
      });
  };

  const handlePairLocation = (loc) => {
      setPairingLocation(loc);
      showToast(`Bitte halte einen NFC-Tag an das Gerät für den Lagerort: ${loc}`, 'info');
      startBindingScan((tagId) => {
          setLocationIndex(prev => ({ ...prev, [tagId]: loc }));
          setPairingLocation(null);
          showToast(`Tag erfolgreich mit ${loc} verknüpft!`, 'success');
      });
  };

  const handleRemovePairing = (tagId) => {
      setLocationIndex(prev => {
          const newIdx = { ...prev };
          delete newIdx[tagId];
          return newIdx;
      });
  };

  const toggleBiometrics = async (e) => {
      const checked = e.target.checked;
      if (checked) {
          const success = await enableBiometrics(currentUser.email);
          if (success) showToast("Biometrie für System aktiviert.");
          else showToast("Aktivierung fehlgeschlagen.", "error");
      } else {
          disableBiometrics();
          showToast("Biometrie deaktiviert.");
      }
      updateStatus();
  };

  const handleBackup = async () => {
      setBackupLoading(true);
      try {
          const data = await generateBackup(currentUser.uid);
          downloadBackupFile(data);
          showToast("Backup generiert und Download gestartet.");
      } catch (e) {
          showToast(e.message, "error");
      } finally {
          setBackupLoading(false);
      }
  };

  const handleFileChange = (e) => {
      if (e.target.files && e.target.files[0]) {
          setRestoreFile(e.target.files[0]);
          setRestoreDialogOpen(true);
      }
  };

  const handleRestore = async () => {
      if (!restoreFile) return;
      setRestoreLoading(true);
      try {
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const backupData = JSON.parse(event.target.result);
                  await restoreBackup(currentUser.uid, backupData);
                  showToast("Restore erfolgreich! System wird neu geladen...");
                  setTimeout(() => window.location.reload(), 2000);
              } catch (err) {
                  showToast(err.message, "error");
                  setRestoreLoading(false);
                  setRestoreDialogOpen(false);
              }
          };
          reader.readAsText(restoreFile);
      } catch (e) {
          showToast(e.message, "error");
          setRestoreLoading(false);
      }
  };

  const handleSimulateStealth = () => {
      if (stealthConfig.allowedDaySubCategories.length === 0) {
          alert("Fehler: Wähle mindestens eine erlaubte Sub-Kategorie für Tag-Items aus!");
          return;
      }
      
      const dayReq = stealthConfig.dayIntensity;
      const nightReq = stealthConfig.nightIntensity;

      const itemsByCat = {};
      allItems.forEach(i => {
          if (!itemsByCat[i.mainCategory]) itemsByCat[i.mainCategory] = [];
          itemsByCat[i.mainCategory].push(i);
      });

      const dayPool = allItems.filter(i => 
          (i.mainCategory === 'Nylons' || i.mainCategory === 'Dessous') &&
          stealthConfig.allowedDaySubCategories.includes(i.subCategory)
      );
      
      const nightPool = allItems.filter(i => 
          (i.mainCategory === 'Nylons' || i.mainCategory === 'Dessous')
      );

      const shuffle = (array) => [...array].sort(() => 0.5 - Math.random());

      const sDay = shuffle(dayPool).slice(0, dayReq);
      const sNight = shuffle(nightPool).slice(0, nightReq);

      setSystemPackedItems({ day: sDay, night: sNight });
  };

  const handleScheduleSuspension = async () => {
      if (!newSuspension.reason || !newSuspension.startDate || !newSuspension.endDate) {
          showToast("Bitte alle Felder ausfüllen.", "error");
          return;
      }
      
      try {
          const start = new Date(newSuspension.startDate);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          
          if (start <= todayEnd) {
             showToast("Unzulässig: Aussetzungen müssen mindestens für den Folgetag geplant werden.", "error");
             return;
          }

          let payload = { ...newSuspension };

          if (newSuspension.type === 'stealth_travel') {
              if (systemPackedItems.day.length === 0 && systemPackedItems.night.length === 0) {
                  showToast("Fehler: Simulation muss zuerst ausgeführt werden.", "error");
                  return;
              }
              const packedIds = [
                  ...systemPackedItems.day.map(i => i.id),
                  ...systemPackedItems.night.map(i => i.id)
              ];
              payload.packedItemIds = packedIds;
              payload.packedItemsDay = systemPackedItems.day.map(i => i.id);
              payload.packedItemsNight = systemPackedItems.night.map(i => i.id);
          }

          await addSuspension(currentUser.uid, payload);
          showToast("Aussetzung programmiert.");
          setSuspensionDialog(false);
          loadSuspensions();
      } catch (e) {
          showToast(e.message, "error");
      }
  };

  const handleTerminateSuspension = async (id) => {
      // IRON CONTRACT VERLETZUNG VERHINDERN (Das Frontend fängt den Klick ab und stürzt ab,
      // sollte der Benutzer versuchen, den Code manuell in der Konsole zu triggern)
      try {
          await terminateSuspension(currentUser.uid, id);
          loadSuspensions();
      } catch (e) {
          showToast(e.message, "error");
      }
  };

  const handleDeleteSuspension = async (id) => {
      try {
          await deleteScheduledSuspension(currentUser.uid, id);
          showToast("Geplante Aussetzung gelöscht.", "success");
          loadSuspensions();
      } catch (e) {
          showToast(e.message, "error");
      }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      <Container maxWidth="md" sx={{ pt: 2, pb: 4 }}>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>System Panel</Typography>
            <Button 
                variant="contained" 
                startIcon={isSavingAll ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} 
                onClick={handleSaveAll}
                disabled={isSavingAll}
                sx={{ ...DESIGN_TOKENS.buttonGradient, borderRadius: 8, px: 3 }}
            >
                Speichern
            </Button>
        </Box>

        <Accordion sx={DESIGN_TOKENS.glassCard} defaultExpanded>
            <AccordionSummary expandIcon={<Icons.KeyboardArrowDown sx={{color:'white'}}/>}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TuneIcon /> Protokoll-Engine</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <ProtocolSettings 
                    rules={protocolRules} 
                    onChange={(newRules) => {
                        setProtocolRules(newRules);
                        // Extortion Handler im Frontend Sync halten
                        if (newRules.extortion && newRules.extortion.triggerChance !== undefined) {
                            setExtortionTriggerChance(newRules.extortion.triggerChance);
                        }
                    }} 
                />
            </AccordionDetails>
        </Accordion>

        <Accordion sx={DESIGN_TOKENS.glassCard} defaultExpanded>
            <AccordionSummary expandIcon={<Icons.KeyboardArrowDown sx={{color:'white'}}/>}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><ScienceIcon /> Taxonomie</Typography>
            </AccordionSummary>
            <AccordionDetails>
                
                <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">Main & Sub Categories</Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <TextField size="small" label="Neue Main Category" value={newMainCat} onChange={(e) => setNewMainCat(e.target.value)} sx={DESIGN_TOKENS.inputField} />
                        <Button variant="outlined" onClick={addMainCat} sx={DESIGN_TOKENS.buttonSecondary}>Main Add</Button>
                    </Stack>
                    
                    {Object.keys(catStructure).map(mainCat => (
                        <Paper key={mainCat} sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body1" fontWeight="bold" color="primary">{mainCat}</Typography>
                                <Button size="small" color="error" onClick={() => removeMainCat(mainCat)}>Main Delete</Button>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                {(catStructure[mainCat] || []).map(sub => (
                                    <Chip 
                                        key={sub} 
                                        label={sub} 
                                        onDelete={() => removeSubCat(mainCat, sub)} 
                                        sx={DESIGN_TOKENS.chip.default}
                                    />
                                ))}
                            </Box>
                            
                            <Stack direction="row" spacing={1}>
                                <TextField size="small" label={`Neues Sub für ${mainCat}`} value={newSubCat} onChange={(e) => setNewSubCat(e.target.value)} sx={DESIGN_TOKENS.inputField} />
                                <Button size="small" variant="outlined" onClick={() => addSubCat(mainCat)} sx={DESIGN_TOKENS.buttonSecondary}>Sub Add</Button>
                            </Stack>
                        </Paper>
                    ))}
                </Box>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">Kategorie Gewichtung (Item Auswahl)</Typography>
                    <Typography variant="caption" color="text.secondary" paragraph>Bestimmt die Häufigkeit, mit der Kategorien vom System ausgewählt werden. Höherer Wert = häufiger.</Typography>
                    <Grid container spacing={2}>
                        {Object.keys(catStructure).map(cat => (
                            <Grid item xs={6} sm={4} key={cat}>
                                <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                    <Typography variant="body2" fontWeight="bold" gutterBottom>{cat}</Typography>
                                    <Slider 
                                        value={categoryWeights[cat] || 1} 
                                        min={1} max={5} step={1} marks
                                        onChange={(e, v) => setCategoryWeights(prev => ({...prev, [cat]: v}))}
                                        sx={{ color: PALETTE.primary.main }}
                                    />
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">Max Items pro Instruction Session</Typography>
                    <Slider 
                        value={maxInstructionItems} 
                        onChange={(e, val) => setMaxInstructionItems(val)}
                        min={1} max={5} marks valueLabelDisplay="auto"
                        sx={{ color: PALETTE.primary.main, maxWidth: 300, ml: 2 }}
                    />
                </Box>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">Marken</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {brands.map(b => <Chip key={b} label={b} onDelete={() => removeListEntry(setBrands, b)} sx={DESIGN_TOKENS.chip.default} />)}
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <TextField size="small" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Neue Marke" sx={DESIGN_TOKENS.inputField} />
                            <Button onClick={() => addListEntry(setBrands, newBrand, setNewBrand)} sx={DESIGN_TOKENS.buttonSecondary}>Add</Button>
                        </Stack>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">Materialien</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {materials.map(m => <Chip key={m} label={m} onDelete={() => removeListEntry(setMaterials, m)} sx={DESIGN_TOKENS.chip.default} />)}
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <TextField size="small" value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} placeholder="Neues Material" sx={DESIGN_TOKENS.inputField} />
                            <Button onClick={() => addListEntry(setMaterials, newMaterial, setNewMaterial)} sx={DESIGN_TOKENS.buttonSecondary}>Add</Button>
                        </Stack>
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Typography variant="subtitle2" gutterBottom color="text.secondary">Lagerorte & NFC Boxen</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {locations.map(loc => {
                        const boundTags = Object.keys(locationIndex).filter(k => locationIndex[k] === loc);
                        return (
                            <Chip 
                                key={loc} 
                                label={`${loc} ${boundTags.length > 0 ? '(NFC)' : ''}`} 
                                onDelete={() => removeListEntry(setLocations, loc)}
                                onClick={() => handlePairLocation(loc)}
                                color={boundTags.length > 0 ? "success" : "default"}
                                sx={boundTags.length > 0 ? {} : DESIGN_TOKENS.chip.default}
                            />
                        );
                    })}
                </Box>
                <Stack direction="row" spacing={1}>
                    <TextField size="small" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Neuer Lagerort" sx={DESIGN_TOKENS.inputField} />
                    <Button onClick={() => addListEntry(setLocations, newLocation, setNewLocation)} sx={DESIGN_TOKENS.buttonSecondary}>Add</Button>
                </Stack>
                {Object.keys(locationIndex).length > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>Verknüpfte NFC Boxen</Typography>
                        {Object.keys(locationIndex).map(tag => (
                            <Chip key={tag} label={`${locationIndex[tag]} [${tag.substring(0,6)}]`} size="small" onDelete={() => handleRemovePairing(tag)} sx={{ mr: 1, mb: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
                        ))}
                    </Box>
                )}
                
            </AccordionDetails>
        </Accordion>

        <Accordion sx={{ ...DESIGN_TOKENS.glassCard, mt: 2 }}>
            <AccordionSummary expandIcon={<Icons.KeyboardArrowDown sx={{color:'white'}}/>}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Icons.Shield /> System & Backup</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="subtitle1">Biometrische Sicherung</Typography>
                        <Typography variant="body2" color="text.secondary">Erfordert Fingerabdruck/Face-ID beim Start</Typography>
                        {!biometricAvailable && <Typography variant="caption" color="error">Gerät unterstützt WebAuthn nicht.</Typography>}
                    </Box>
                    <Switch 
                        checked={isBiometricActive} 
                        onChange={toggleBiometrics} 
                        disabled={!biometricAvailable}
                        color="primary"
                    />
                </Box>

                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Typography variant="subtitle1" gutterBottom>Database Backup</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Button variant="outlined" onClick={handleBackup} disabled={backupLoading} sx={DESIGN_TOKENS.buttonSecondary}>
                        {backupLoading ? <CircularProgress size={20} /> : "Backup Download"}
                    </Button>
                    <Button variant="outlined" color="warning" onClick={() => fileInputRef.current?.click()} startIcon={<UploadIcon />}>
                        Restore
                    </Button>
                    <input type="file" ref={fileInputRef} hidden accept=".json" onChange={handleFileChange} />
                </Stack>
            </AccordionDetails>
        </Accordion>

        <Accordion sx={{ ...DESIGN_TOKENS.glassCard, mt: 2 }}>
            <AccordionSummary expandIcon={<Icons.KeyboardArrowDown sx={{color:'white'}}/>}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MedicalServicesIcon /> Ausfallzeiten</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Button variant="contained" fullWidth onClick={() => { setSuspensionDialogMode('plan'); setSuspensionDialog(true); }} sx={{ mb: 3, ...DESIGN_TOKENS.buttonGradient }}>
                    Ausfallzeit beantragen
                </Button>

                <Typography variant="subtitle2" gutterBottom color="text.secondary">Aktuelle & Geplante Ausfälle</Typography>
                {suspensions.length === 0 ? (
                    <Typography variant="body2" sx={{ opacity: 0.5 }}>Keine Ausfallzeiten programmiert.</Typography>
                ) : (
                    <List>
                        {suspensions.map(s => (
                            <ListItem key={s.id} sx={{ bgcolor: 'rgba(255,255,255,0.05)', mb: 1, borderRadius: 1, borderLeft: `4px solid ${s.status === 'active' ? PALETTE.accents.gold : 'transparent'}` }}>
                                <ListItemText 
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2" fontWeight="bold">{s.type === 'medical' ? 'Medizinisch' : (s.type === 'stealth_travel' ? 'Infiltration' : 'Reise / Abwesenheit')}</Typography>
                                            <Chip label={s.status} size="small" color={s.status === 'active' ? 'warning' : 'default'} sx={{ height: 20, fontSize: '0.7rem' }} />
                                        </Box>
                                    }
                                    secondary={`${s.startDate.toLocaleDateString()} bis ${s.endDate.toLocaleDateString()} • ${s.reason}`} 
                                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                                />
                                {s.status === 'scheduled' && (
                                    <Button size="small" color="error" onClick={() => handleDeleteSuspension(s.id)}>Stornieren</Button>
                                )}
                            </ListItem>
                        ))}
                    </List>
                )}
            </AccordionDetails>
        </Accordion>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Button variant="text" color="error" onClick={logout}>Abmelden (Exit)</Button>
        </Box>
      </Container>

      {/* SUSPENSION DIALOG */}
      <Dialog open={suspensionDialog} onClose={() => setSuspensionDialog(false)} maxWidth="sm" fullWidth PaperProps={DESIGN_TOKENS.dialog.paper}>
        <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Ausfallzeit beantragen</DialogTitle>
        <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
            <DialogContentText sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                Programmierte Ausfallzeiten setzen das System für die gewählte Dauer vollständig aus. Bei Operation: Infiltration (Stealth) werden dir vorab zwingende Items zugewiesen.
            </DialogContentText>
            
            <Stack spacing={3}>
                <FormControl fullWidth>
                    <InputLabel>Grund (Typ)</InputLabel>
                    <Select 
                        value={newSuspension.type} 
                        label="Grund (Typ)"
                        onChange={(e) => {
                            setNewSuspension({...newSuspension, type: e.target.value});
                            if (e.target.value === 'stealth_travel') setSuspensionDialogMode('stealth');
                            else setSuspensionDialogMode('plan');
                        }}
                        sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}
                    >
                        <MenuItem value="medical">Medizinischer Ausfall (z.B. Krankheit, OP)</MenuItem>
                        <MenuItem value="travel">Urlaub / Reise (ohne Optionen)</MenuItem>
                        <MenuItem value="stealth_travel">Operation: Infiltration (Reise unter Fremdkontrolle)</MenuItem>
                    </Select>
                </FormControl>

                <TextField 
                    label="Details (Ort, Grund etc.)" 
                    fullWidth 
                    value={newSuspension.reason} 
                    onChange={e => setNewSuspension({...newSuspension, reason: e.target.value})}
                    sx={DESIGN_TOKENS.inputField}
                />

                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <TextField 
                            label="Startdatum (00:00 Uhr)" 
                            type="date" 
                            fullWidth 
                            InputLabelProps={{ shrink: true }}
                            value={newSuspension.startDate}
                            onChange={e => setNewSuspension({...newSuspension, startDate: e.target.value})}
                            sx={DESIGN_TOKENS.inputField}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField 
                            label="Enddatum (23:59 Uhr)" 
                            type="date" 
                            fullWidth 
                            InputLabelProps={{ shrink: true }}
                            value={newSuspension.endDate}
                            onChange={e => setNewSuspension({...newSuspension, endDate: e.target.value})}
                            sx={DESIGN_TOKENS.inputField}
                        />
                    </Grid>
                </Grid>

                {/* STEALTH CONFIGURATION BLOCK */}
                {suspensionDialogMode === 'stealth' && (
                    <Paper sx={{ p: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', border: `1px solid ${PALETTE.accents.purple}` }}>
                        <Typography variant="subtitle2" sx={{ color: PALETTE.accents.purple, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TravelExploreIcon /> Infiltrations-Packliste
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Das System simuliert deinen Koffer. Wähle die Intensität und die Sub-Kategorien. Du musst das gepackte Material tragen. TZD bleibt aktiv.
                        </Typography>
                        
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                                <Typography variant="caption">Items pro Tag</Typography>
                                <Slider 
                                    value={stealthConfig.dayIntensity} 
                                    min={0} max={3} marks step={1}
                                    onChange={(e,v) => setStealthConfig(prev => ({...prev, dayIntensity: v}))}
                                    sx={{ color: PALETTE.accents.purple }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="caption">Items pro Nacht</Typography>
                                <Slider 
                                    value={stealthConfig.nightIntensity} 
                                    min={0} max={2} marks step={1}
                                    onChange={(e,v) => setStealthConfig(prev => ({...prev, nightIntensity: v}))}
                                    sx={{ color: PALETTE.accents.blue }}
                                />
                            </Grid>
                        </Grid>

                        <Typography variant="caption" display="block" mb={1}>Erlaubte Tag-Kategorien</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                            {(catStructure['Nylons'] || []).concat(catStructure['Dessous'] || []).map(sub => (
                                <Chip 
                                    key={sub} 
                                    label={sub} 
                                    onClick={() => {
                                        setStealthConfig(prev => {
                                            const isSelected = prev.allowedDaySubCategories.includes(sub);
                                            return {
                                                ...prev,
                                                allowedDaySubCategories: isSelected 
                                                    ? prev.allowedDaySubCategories.filter(s => s !== sub)
                                                    : [...prev.allowedDaySubCategories, sub]
                                            };
                                        });
                                    }}
                                    sx={{ 
                                        bgcolor: stealthConfig.allowedDaySubCategories.includes(sub) ? PALETTE.accents.purple : 'rgba(255,255,255,0.1)',
                                        color: '#fff',
                                        '&:hover': { bgcolor: stealthConfig.allowedDaySubCategories.includes(sub) ? PALETTE.accents.purple : 'rgba(255,255,255,0.2)' }
                                    }}
                                />
                            ))}
                        </Box>

                        <Button variant="outlined" fullWidth onClick={handleSimulateStealth} sx={{ color: PALETTE.accents.purple, borderColor: PALETTE.accents.purple, mb: 2 }}>
                            Koffer Packen (Simulieren)
                        </Button>

                        {systemPackedItems.day.length > 0 && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 2 }}>
                                <Typography variant="caption" color="text.secondary" display="block">Dein Gepäck (Plicht):</Typography>
                                <List dense>
                                    {systemPackedItems.day.map(i => <ListItem key={i.id}><ListItemText primary={i.name} secondary="Tag" /></ListItem>)}
                                    {systemPackedItems.night.map(i => <ListItem key={i.id}><ListItemText primary={i.name} secondary="Nacht" /></ListItem>)}
                                </List>
                            </Box>
                        )}
                    </Paper>
                )}

            </Stack>
        </DialogContent>
        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            <Button onClick={() => setSuspensionDialog(false)} color="inherit">Abbrechen</Button>
            <Button variant="contained" onClick={handleScheduleSuspension} sx={DESIGN_TOKENS.buttonGradient}>
                Beantragen
            </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} PaperProps={DESIGN_TOKENS.dialog.paper}>
          <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Backup Einspielen</DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <DialogContentText sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                  ACHTUNG: Das Einspielen eines Backups überschreibt alle aktuellen Daten.
              </DialogContentText>
              <Typography variant="body2">Gewählte Datei: {restoreFile?.name}</Typography>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button onClick={() => setRestoreDialogOpen(false)} color="inherit">Abbrechen</Button>
              <Button onClick={handleRestore} color="error" variant="contained" disabled={restoreLoading}>
                  {restoreLoading ? <CircularProgress size={20} color="inherit" /> : "Gefahr: Daten überschreiben"}
              </Button>
          </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}