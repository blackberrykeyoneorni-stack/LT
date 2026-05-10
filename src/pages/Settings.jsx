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
import TimerIcon from '@mui/icons-material/Timer';

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
  const [inventoryConfig, setInventoryConfig] = useState({ Nylons: { minCondition: 3, subcategories: {} }, Dessous: { minCondition: 3, subcategories: {} } });
  const [dressingTimes, setDressingTimes] = useState({}); // NEU: Dressing Time Lock Configuration
  
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
          const [bSnap, mSnap, catSnap, locSnap, locIdxSnap, prefSnap, arSnap, rlSnap, rcSnap, protSnap, itemsSnap, invConfigSnap, dtSnap] = await Promise.all([
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
              getDocs(query(collection(db, `users/${userId}/items`), where('status', '==', 'active'))),
              getDoc(doc(db, `users/${userId}/settings/inventoryConfig`)),
              getDoc(doc(db, `users/${userId}/settings/dressingTimes`))
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
              
              // NEU: Lade Erpressungs-Wahrscheinlichkeit
              if (data.extortion && data.extortion.triggerChance !== undefined) {
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

          if (invConfigSnap.exists()) {
              setInventoryConfig(invConfigSnap.data());
          }

          if (dtSnap && dtSnap.exists()) {
              setDressingTimes(dtSnap.data().times || {});
          }

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
              const protRef = doc(db, `users/${uid}/settings/protocol`);
              const cleanRules = { ...protocolRules };

              batch.set(protRef, cleanRules, { merge: true });
          }

          batch.set(doc(db, `users/${uid}/settings/brands`), { list: brands }, { merge: true });
          batch.set(doc(db, `users/${uid}/settings/materials`), { list: materials }, { merge: true });
          batch.set(doc(db, `users/${uid}/settings/locations`), { list: locations }, { merge: true });
          batch.set(doc(db, `users/${uid}/settings/archiveReasons`), { list: archiveReasons }, { merge: true });
          batch.set(doc(db, `users/${uid}/settings/runLocations`), { list: runLocations }, { merge: true });
          batch.set(doc(db, `users/${uid}/settings/runCauses`), { list: runCauses }, { merge: true });

          const catRef = doc(db, `users/${uid}/settings/categories`);
          const catSnap = await getDoc(catRef);
          if (catSnap.exists()) {
              batch.update(catRef, { structure: catStructure });
          } else {
              batch.set(catRef, { structure: catStructure });
          }

          const locIdxRef = doc(db, `users/${uid}/settings/locationIndex`);
          const locIdxSnap = await getDoc(locIdxRef);
          if (locIdxSnap.exists()) {
              batch.update(locIdxRef, { mapping: locationIndex });
          } else {
              batch.set(locIdxRef, { mapping: locationIndex });
          }

          batch.set(doc(db, `users/${uid}/settings/inventoryConfig`), inventoryConfig, { merge: true });
          batch.set(doc(db, `users/${uid}/settings/dressingTimes`), { times: dressingTimes }, { merge: true });

          await batch.commit();
          showToast("Alle Einstellungen erfolgreich gespeichert.", "success");

      } catch (e) {
          showToast("Fehler beim Speichern: " + e.message, "error");
      } finally {
          setIsSavingAll(false);
      }
  };

  const handleAddSuspension = async () => {
      let currentReason = newSuspension.reason;
      
      if (newSuspension.type === 'stealth_travel' && !currentReason) {
          currentReason = 'Operation: Infiltration';
      }

      if(!newSuspension.startDate || !newSuspension.endDate || !currentReason) {
          showToast("Bitte fülle alle notwendigen Felder aus.", "error");
          return;
      }
      
      const start = new Date(newSuspension.startDate);
      const end = new Date(newSuspension.endDate);
      
      if (newSuspension.type === 'stealth_travel') {
          if (stealthConfig.allowedDaySubCategories.length === 0) {
              showToast("Bitte wähle mindestens eine erlaubte Subkategorie für den Tag aus.", "error");
              return;
          }

          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          const nights = diffDays > 1 ? diffDays - 1 : 1; 

          const neededDay = diffDays * stealthConfig.dayIntensity;
          const neededNight = nights * stealthConfig.nightIntensity;

          let availableNight = allItems.filter(i => i.status === 'active' && i.subCategory === 'Strumpfhose');
          let availableDay = allItems.filter(i => i.status === 'active' && stealthConfig.allowedDaySubCategories.includes(i.subCategory));

          availableNight.sort((a, b) => (a.wearCount || 0) - (b.wearCount || 0));
          availableDay.sort((a, b) => (a.wearCount || 0) - (b.wearCount || 0));

          if (availableNight.length < neededNight) {
              showToast(`Bestand zu gering: ${neededNight} Strumpfhosen benötigt, ${availableNight.length} sauber.`, "error");
              return;
          }
          if (availableDay.length < neededDay) {
              showToast(`Bestand zu gering: ${neededDay} Tag-Items benötigt, ${availableDay.length} sauber.`, "error");
              return;
          }

          setSystemPackedItems({ 
              day: availableDay.slice(0, neededDay), 
              night: availableNight.slice(0, neededNight) 
          });
          
          setNewSuspension(prev => ({...prev, reason: currentReason}));
          setSuspensionDialogMode('pack');
          return;
      }
      
      try {
          await addSuspension(currentUser.uid, { ...newSuspension, reason: currentReason });
          showToast("Auszeit beantragt & genehmigt.", "success");
          setSuspensionDialog(false);
          loadSuspensions();
          setNewSuspension({ type: 'medical', reason: '', startDate: '', endDate: '' });
      } catch (e) {
          showToast(e.message, "error");
      }
  };

  const handleConfirmPack = async () => {
      try {
          const payload = {
              ...newSuspension,
              packedItemsDay: systemPackedItems.day.map(i => i.id),
              packedItemsNight: systemPackedItems.night.map(i => i.id)
          };
          await addSuspension(currentUser.uid, payload);
          showToast("Operation registriert. Loadout diktiert und gesichert.", "success");
          setSuspensionDialog(false);
          setSuspensionDialogMode('plan');
          loadSuspensions();
          setNewSuspension({ type: 'medical', reason: '', startDate: '', endDate: '' });
          setStealthConfig({ dayIntensity: 1, nightIntensity: 1, allowedDaySubCategories: [] });
      } catch (e) {
          showToast(e.message, "error");
      }
  };

  const handleDeleteSuspension = async (id) => {
      if(!window.confirm("Bist du sicher, dass du diese geplante Auszeit löschen möchtest?")) return;
      await deleteScheduledSuspension(currentUser.uid, id);
      loadSuspensions();
      showToast("Geplante Auszeit verworfen.", "info");
  };

  const handleTerminateSuspension = async (id) => {
      if(!window.confirm("Bist du sicher, dass du den Dienst vorzeitig wieder aufnehmen willst?")) return;
      await terminateSuspension(currentUser.uid, id);
      loadSuspensions();
      showToast("Willkommen zurück.", "success");
  };

  const handleToggleBiometrics = async (e) => {
      const shouldEnable = e.target.checked;
      if (shouldEnable) {
          const success = await enableBiometrics();
          if (success) { updateStatus(); showToast("Biometrie aktiviert", "success"); }
          else showToast("Konnte Biometrie nicht aktivieren", "error");
      } else {
          disableBiometrics();
          updateStatus();
          showToast("Biometrie deaktiviert", "info");
      }
  };

  const handleStartPairing = (loc) => {
      setPairingLocation(loc);
      startBindingScan(async (tagId) => {
          try {
              const newMapping = { ...locationIndex, [tagId]: loc };
              await setDoc(doc(db, `users/${currentUser.uid}/settings/locationIndex`), { mapping: newMapping }, { merge: true });
              setLocationIndex(newMapping);
              showToast(`Ort ${loc} verknüpft!`, "success");
          } catch (e) { showToast("Fehler", "error"); } finally { setPairingLocation(null); }
      });
  };

  const updateCategories = (newStruct) => setCatStructure(newStruct);
  
  const addMainCategory = () => {
    if (!newMainCat.trim()) return;
    if (catStructure[newMainCat.trim()]) return showToast("Existiert bereits", "error");
    const newStruct = { ...catStructure, [newMainCat.trim()]: [] };
    updateCategories(newStruct); setNewMainCat('');
  };

  const removeMainCategory = (main) => {
    if (!window.confirm(`Kategorie "${main}" löschen?`)) return;
    const newStruct = { ...catStructure }; delete newStruct[main];
    updateCategories(newStruct);
  };

  const addSubCategory = (main) => {
    if (!newSubCat.trim()) return;
    const current = catStructure[main] || [];
    if (current.includes(newSubCat.trim())) return;
    updateCategories({ ...catStructure, [main]: [...current, newSubCat.trim()] }); setNewSubCat('');
  };

  const addItemToList = (listName, newItem, setList, currentList) => { 
      if (!newItem.trim()) return; 
      const l = [...currentList, newItem.trim()]; 
      setList(l); 
  };
  
  const removeItemFromList = (listName, item, setList, currentList) => { 
      const l = currentList.filter(x => x !== item); 
      setList(l); 
  };

  const handleWeightTargetChange = (e) => {
      const cat = e.target.value;
      setWeightTarget(cat);
      if (categoryWeights[cat]) {
          setWeightValue(categoryWeights[cat]);
      } else {
          setWeightValue(2);
      }
  };

  const addWeight = () => {
      if (weightTarget) {
          setCategoryWeights(prev => ({ ...prev, [weightTarget]: weightValue }));
          setWeightTarget('');
      }
  };
  
  const removeWeight = (cat) => {
      const next = { ...categoryWeights };
      delete next[cat];
      setCategoryWeights(next);
  };

  const handleBackup = async () => {
      setBackupLoading(true);
      try {
          const data = await generateBackup(currentUser.uid);
          downloadBackupFile(data);
          showToast("Backup erstellt", "success");
      } catch(e) { showToast("Backup Fehler", "error"); }
      finally { setBackupLoading(false); }
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setRestoreFile(file);
      setRestoreDialogOpen(true);
      e.target.value = null;
  };

  const executeRestore = async () => {
      if (!restoreFile) return;
      setRestoreLoading(true);
      try {
          const text = await restoreFile.text();
          const backupData = JSON.parse(text);
          
          await restoreBackup(currentUser.uid, backupData);
          
          showToast("Backup erfolgreich eingespielt! System wird neu geladen...", "success");
          setRestoreDialogOpen(false);
          setRestoreFile(null);
          
          setTimeout(() => window.location.reload(), 2000);
      } catch (e) {
          showToast("Fehler beim Restore: " + e.message, "error");
      } finally {
          setRestoreLoading(false);
      }
  };

  const SectionHeader = ({ icon: Icon, title, color }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, color: color || 'text.primary' }}>
      <Avatar sx={{ bgcolor: `${color}22`, color: color, width: 32, height: 32 }}><Icon fontSize="small" /></Avatar>
      <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</Typography>
    </Box>
  );

  const ListManager = ({ title, items, newItem, setNewItem, listName, setList }) => (
      <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>{title}</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField size="small" fullWidth value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Neuer Eintrag..." />
              <Button variant="contained" size="small" onClick={() => { addItemToList(listName, newItem, setList, items); setNewItem(''); }}><Icons.Add /></Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {items.map(item => (
                  <Chip key={item} label={item} onDelete={() => removeItemFromList(listName, item, setList, items)} size="small" />
              ))}
          </Box>
      </Box>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  const allCategoryOptions = [];
  const onlySubCategories = [];
  Object.keys(catStructure).forEach(main => {
      allCategoryOptions.push({ label: `HAUPT: ${main}`, value: main });
      if(catStructure[main]) {
          catStructure[main].forEach(sub => {
              allCategoryOptions.push({ label: `• ${sub}`, value: sub });
              if (!onlySubCategories.includes(sub)) onlySubCategories.push(sub);
          });
      }
  });

  return (
    <Container maxWidth="md" disableGutters sx={{ pt: 1, pb: 15, px: 0.5 }}>
      <Typography variant="h4" gutterBottom sx={{ ...DESIGN_TOKENS.textGradient, ml: 1 }}>Einstellungen</Typography>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.gold}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={MedicalServicesIcon} title="Protokoll-Verwaltung" color={PALETTE.accents.gold} />
        </AccordionSummary>
        <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Geplante Ausfallzeiten</Typography>
                <Button variant="contained" size="small" sx={{ bgcolor: PALETTE.accents.gold, color:'#000' }} onClick={() => { setSuspensionDialogMode('plan'); setSuspensionDialog(true); }} startIcon={<Icons.Add />}>
                    Beantragen
                </Button>
            </Box>
            <Stack spacing={1}>
                {suspensions.length === 0 && <Typography variant="caption" sx={{ fontStyle:'italic', color: PALETTE.text.muted }}>Keine geplanten Auszeiten.</Typography>}
                {suspensions.map(sus => (
                    <Paper key={sus.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `2px solid ${sus.type === 'stealth_travel' ? PALETTE.accents.purple : PALETTE.accents.gold}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" fontWeight="bold">{sus.type.toUpperCase()}: {sus.reason}</Typography>
                            {sus.status === 'active' && <Chip label="AKTIV" color="warning" size="small" />}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {sus.startDate.toLocaleDateString()} - {sus.endDate.toLocaleDateString()}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {sus.status === 'active' && (
                                <Button size="small" color="inherit" onClick={() => handleTerminateSuspension(sus.id)} sx={{ mt: 1, fontSize:'0.7rem' }}>
                                    Vorzeitig beenden
                                </Button>
                            )}
                            {sus.status === 'scheduled' && (
                                <Button size="small" color="error" onClick={() => handleDeleteSuspension(sus.id)} sx={{ mt: 1, fontSize:'0.7rem' }}>
                                    Planung verwerfen
                                </Button>
                            )}
                        </Box>
                    </Paper>
                ))}
            </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={TuneIcon} title="Protokoll Konfiguration (Core)" color={PALETTE.accents.purple} />
        </AccordionSummary>
        <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
             <ProtocolSettings 
                 rules={protocolRules} 
                 onChange={(newRules) => {
                     setProtocolRules(newRules);
                 }} 
             />
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Track} title="Präferenzen & Limits" color={PALETTE.primary.main} />
        </AccordionSummary>
        <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Max. Items pro Anweisung</Typography>
                    <Typography fontWeight="bold" color="primary">{maxInstructionItems}</Typography>
                </Box>
                <Slider 
                    value={maxInstructionItems} 
                    min={1} 
                    max={3} 
                    step={1} 
                    marks
                    onChange={(e, v) => setMaxInstructionItems(v)} 
                    sx={{ color: PALETTE.primary.main }} 
                />
            </Box>
            
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.green}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Category} title="Kategorie Struktur" color={PALETTE.accents.green} />
        </AccordionSummary>
        <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth label="Neue Hauptkategorie" value={newMainCat} onChange={e => setNewMainCat(e.target.value)} />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.green }} onClick={addMainCategory}><Icons.Add /></Button>
            </Box>
            <Stack spacing={2}>
                {Object.keys(catStructure).map(main => (
                    <Paper key={main} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: PALETTE.accents.green }}>{main}</Typography>
                            <IconButton size="small" color="error" onClick={() => removeMainCategory(main)}><Icons.Delete /></IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>{catStructure[main].map(sub => (<Chip key={sub} label={sub} size="small" onDelete={() => updateCategories({...catStructure, [main]: catStructure[main].filter(s=>s!==sub)})} />))}</Box>
                        <Box sx={{ display: 'flex', gap: 1 }}><TextField size="small" fullWidth placeholder="Sub..." value={newSubCat} onChange={e => setNewSubCat(e.target.value)} /><Button size="small" onClick={() => addSubCategory(main)}><Icons.Add /></Button></Box>
                    </Paper>
                ))}
            </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Brain} title="Algorithmus" color={PALETTE.accents.purple} /></AccordionSummary>
         <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
            <Alert severity="info" sx={{mb: 2, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff'}}>Wahrscheinlichkeiten für die Zufallsauswahl.</Alert>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 2 }}>
                <FormControl fullWidth size="small">
                    <InputLabel>Kategorie</InputLabel>
                    <Select value={weightTarget} label="Kategorie" onChange={handleWeightTargetChange}>
                        {allCategoryOptions.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                    </Select>
                </FormControl>
                <Box sx={{ width: 150, px: 1 }}>
                      <Typography variant="caption">Gewicht: x{weightValue}</Typography>
                      <Slider value={weightValue} min={2} max={10} onChange={(e, v) => setWeightValue(v)} size="small" sx={{ color: PALETTE.accents.purple }}/>
                </Box>
                <Button variant="contained" onClick={addWeight} sx={{ bgcolor: PALETTE.accents.purple, minWidth: 40 }}><Icons.Add /></Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(categoryWeights).map(([cat, weight]) => (
                    <Chip key={cat} label={`${cat}: ${weight}x`} onDelete={() => removeWeight(cat)} variant="outlined" sx={{ borderColor: PALETTE.accents.purple, color: PALETTE.accents.purple }}/>
                ))}
            </Box>
         </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.red}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={ScienceIcon} title="Forensik & Attribute" color={PALETTE.accents.red} /></AccordionSummary>
         <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
             <ListManager title="Verlust-Ursachen (Archiv)" items={archiveReasons} newItem={newArchiveReason} setNewItem={setNewArchiveReason} listName="archiveReasons" setList={setArchiveReasons} />
             <Divider sx={{ my: 1 }} />
             <ListManager title="Laufmaschen-Orte" items={runLocations} newItem={newRunLocation} setNewItem={setNewRunLocation} listName="runLocations" setList={setRunLocations} />
             <Divider sx={{ my: 1 }} />
             <ListManager title="Laufmaschen-Gründe" items={runCauses} newItem={newRunCause} setNewItem={setNewRunCause} listName="runCauses" setList={setRunCauses} />
         </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Inventory} title="Listen & Orte" color={PALETTE.accents.blue} /></AccordionSummary>
         <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
             <Typography variant="subtitle2" sx={{mb:1}}>Lagerorte</Typography>
             <Box sx={{ display: 'flex', gap: 1, mb: 2 }}><TextField size="small" fullWidth value={newLocation} onChange={e => setNewLocation(e.target.value)} /><Button onClick={() => { addItemToList('locations', newLocation, setLocations, locations); setNewLocation(''); }} variant="contained"><Icons.Add /></Button></Box>
             <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>{locations.map(l => <Chip key={l} label={l} onDelete={() => removeItemFromList('locations', l, setLocations, locations)} size="small" clickable onClick={() => handleStartPairing(l)} color={pairingLocation === l ? 'secondary' : 'default'} icon={pairingLocation === l ? <CircularProgress size={16} /> : <Icons.Nfc />} />)}</Box>
             <Divider sx={{ my: 2 }} />
             <ListManager title="Marken" items={brands} newItem={newBrand} setNewItem={setNewBrand} listName="brands" setList={setBrands} />
             <Divider sx={{ my: 2 }} />
             <ListManager title="Materialien" items={materials} newItem={newMaterial} setNewItem={setNewMaterial} listName="materials" setList={setMaterials} />
         </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Inventory} title="Bestands- & Qualitätsmanagement" color={PALETTE.accents.blue} /></AccordionSummary>
         <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
             {['Nylons', 'Dessous'].map(mainCat => {
                 const subs = catStructure[mainCat] || [];
                 return (
                 <Box key={mainCat} sx={{ mb: 3, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: `1px solid ${mainCat === 'Nylons' ? PALETTE.accents.pink : PALETTE.accents.blue}40` }}>
                     <Typography variant="h6" sx={{ color: mainCat === 'Nylons' ? PALETTE.accents.pink : PALETTE.accents.blue, mb: 2 }}>{mainCat}</Typography>
                     
                     <FormControl fullWidth sx={{ mb: 3 }}>
                         <InputLabel sx={{ color: 'text.secondary' }}>Mindestzustand für intakten Bestand</InputLabel>
                         <Select 
                             value={inventoryConfig[mainCat]?.minCondition || 3} 
                             label="Mindestzustand für intakten Bestand"
                             onChange={(e) => {
                                 setInventoryConfig(prev => ({
                                     ...prev,
                                     [mainCat]: { ...prev[mainCat], minCondition: e.target.value }
                                 }));
                             }}
                             sx={DESIGN_TOKENS.inputField}
                         >
                             {[1, 2, 3, 4, 5].map(v => <MenuItem key={v} value={v}>Zustand {v} oder besser</MenuItem>)}
                         </Select>
                     </FormControl>

                     <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2 }}>Spezifische Subkategorien-Ziele</Typography>
                     {subs.length === 0 ? (
                         <Typography variant="caption" color="text.disabled">Keine Subkategorien definiert.</Typography>
                     ) : (
                         subs.map(subCat => (
                             <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }} key={subCat}>
                                 <Typography variant="body2" sx={{ fontWeight: 'bold', width: '30%', wordWrap: 'break-word' }}>{subCat}</Typography>
                                 <TextField 
                                     label="Anzahl" 
                                     type="number" 
                                     size="small" 
                                     sx={{ width: '35%', ...DESIGN_TOKENS.inputField }}
                                     value={inventoryConfig[mainCat]?.subcategories?.[subCat]?.minCount || 0}
                                     onChange={(e) => {
                                         setInventoryConfig(prev => ({
                                             ...prev,
                                             [mainCat]: {
                                                 ...prev[mainCat],
                                                 subcategories: {
                                                     ...(prev[mainCat]?.subcategories || {}),
                                                     [subCat]: {
                                                         ...(prev[mainCat]?.subcategories?.[subCat] || {}),
                                                         minCount: parseInt(e.target.value) || 0
                                                     }
                                                 }
                                             }
                                         }));
                                     }}
                                 />
                                 <TextField 
                                     label="Preis (€)" 
                                     type="number" 
                                     size="small" 
                                     sx={{ width: '35%', ...DESIGN_TOKENS.inputField }}
                                     value={inventoryConfig[mainCat]?.subcategories?.[subCat]?.fallbackPrice || 0}
                                     onChange={(e) => {
                                         setInventoryConfig(prev => ({
                                             ...prev,
                                             [mainCat]: {
                                                 ...prev[mainCat],
                                                 subcategories: {
                                                     ...(prev[mainCat]?.subcategories || {}),
                                                     [subCat]: {
                                                         ...(prev[mainCat]?.subcategories?.[subCat] || {}),
                                                         fallbackPrice: parseFloat(e.target.value) || 0
                                                     }
                                                 }
                                             }
                                         }));
                                     }}
                                 />
                             </Box>
                         ))
                     )}
                 </Box>
             )})}
         </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 1, borderLeft: `4px solid ${PALETTE.accents.orange}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={TimerIcon} title="Diktat: Anziehzeiten" color={PALETTE.accents.orange} /></AccordionSummary>
        <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Definiere die exakte Zeit in Sekunden, die das System für das physische Anziehen der jeweiligen Subkategorie blockiert. 
            </Typography>
            {onlySubCategories.length === 0 && <Typography variant="caption" color="text.disabled">Keine Subkategorien definiert.</Typography>}
            {onlySubCategories.map(sub => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }} key={sub}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{sub}</Typography>
                    <TextField 
                        label="Sekunden" 
                        type="number" 
                        size="small" 
                        sx={{ width: 100, ...DESIGN_TOKENS.inputField }}
                        value={dressingTimes[sub] !== undefined ? dressingTimes[sub] : ''}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setDressingTimes(prev => ({ ...prev, [sub]: isNaN(val) ? 0 : val }));
                        }}
                    />
                </Box>
            ))}
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, mb: 10, borderLeft: '4px solid #fff' }}>
        <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Settings} title="System & Backup" color="#fff" /></AccordionSummary>
        <AccordionDetails sx={{ ...DESIGN_TOKENS.accordion.details, p: 1.5 }}>
            <FormControlLabel control={<Switch checked={isBiometricActive} onChange={handleToggleBiometrics} disabled={!biometricAvailable} />} label="Biometrische Authentifizierung (Fingerprint)" sx={{ mb: 2, display: 'block' }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3, mb: 2 }}>
                <Button variant="outlined" fullWidth onClick={handleBackup} disabled={backupLoading} startIcon={backupLoading ? <CircularProgress size={20} /> : <Icons.Cloud />}>
                    Backup herunterladen
                </Button>
                
                <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
                
                <Button variant="outlined" color="warning" fullWidth onClick={() => fileInputRef.current.click()} disabled={backupLoading || restoreLoading} startIcon={restoreLoading ? <CircularProgress size={20} /> : <UploadIcon />}>
                    Backup einspielen
                </Button>
            </Box>

            <Box sx={{ mt: 4, textAlign: 'center' }}><Button color="error" onClick={logout} startIcon={<Icons.Logout />}>Abmelden</Button></Box>
            <Typography variant="caption" display="block" align="center" sx={{ mt: 2, color: 'text.secondary' }}>Version 2.4.2 • Build 20251206</Typography>
        </AccordionDetails>
      </Accordion>

      <Paper sx={{ 
          position: 'fixed', bottom: 80, left: 0, right: 0, 
          zIndex: 1000, 
          p: 2, 
          bgcolor: 'rgba(0,0,0,0.8)', 
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'center'
      }}>
          <Button 
            variant="contained" 
            size="large"
            startIcon={isSavingAll ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveAll}
            disabled={isSavingAll}
            sx={{ ...DESIGN_TOKENS.buttonGradient, width: '90%', maxWidth: 400, height: 50, fontSize: '1rem' }}
          >
              {isSavingAll ? "Speichere..." : "Alle Änderungen speichern"}
          </Button>
      </Paper>

      <Dialog open={restoreDialogOpen} onClose={() => !restoreLoading && setRestoreDialogOpen(false)} PaperProps={DESIGN_TOKENS.dialog.paper}>
          <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.red }}>
              Backup Einspielen
          </DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <Alert severity="error" sx={{ mb: 3 }}>
                  ACHTUNG: Dies überschreibt alle aktuellen Daten unwiderruflich mit dem Inhalt des ausgewählten Backups.
              </Alert>
              <Typography variant="body2" sx={{ textAlign: 'center' }}>
                  Möchtest du das Backup <br /><strong>{restoreFile?.name}</strong><br /> wirklich einspielen?
              </Typography>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button onClick={() => setRestoreDialogOpen(false)} color="inherit" disabled={restoreLoading}>
                  Abbrechen
              </Button>
              <Button onClick={executeRestore} variant="contained" color="error" disabled={restoreLoading}>
                  {restoreLoading ? "Spiele ein..." : "Unwiderruflich einspielen"}
              </Button>
          </DialogActions>
      </Dialog>

      <Dialog open={suspensionDialog} onClose={() => setSuspensionDialog(false)} PaperProps={DESIGN_TOKENS.dialog.paper}>
        {suspensionDialogMode === 'plan' ? (
            <>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Auszeit planen</DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    <DialogContentText sx={{ mb: 2 }}>Die Auszeit beginnt am gewählten Starttag um 07:30 Uhr und endet am Endtag um 23:00 Uhr.</DialogContentText>
                    <TextField select fullWidth label="Grund" value={newSuspension.type} onChange={e => setNewSuspension({...newSuspension, type: e.target.value})} margin="dense">
                        <MenuItem value="medical">Medizinisch (Total)</MenuItem>
                        <MenuItem value="social">Sozial/Besuch (Total)</MenuItem>
                        <MenuItem value="stealth_travel" sx={{ color: PALETTE.accents.purple, fontWeight: 'bold' }}>Operation: Infiltration (Reise)</MenuItem>
                        <MenuItem value="other">Sonstiges</MenuItem>
                    </TextField>
                    <TextField fullWidth label="Beschreibung" value={newSuspension.reason} onChange={e => setNewSuspension({...newSuspension, reason: e.target.value})} margin="dense" placeholder="z.B. Grippe" />
                    <TextField fullWidth type="date" label="Startdatum" InputLabelProps={{ shrink: true }} value={newSuspension.startDate} onChange={e => setNewSuspension({...newSuspension, startDate: e.target.value})} margin="dense" />
                    <TextField fullWidth type="date" label="Enddatum" InputLabelProps={{ shrink: true }} value={newSuspension.endDate} onChange={e => setNewSuspension({...newSuspension, endDate: e.target.value})} margin="dense" />
                    
                    {newSuspension.type === 'stealth_travel' && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: PALETTE.accents.purple, mb: 2 }}>Infiltrations-Parameter</Typography>
                            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <TextField type="number" label="Tages-Stücke" value={stealthConfig.dayIntensity} onChange={e => setStealthConfig({...stealthConfig, dayIntensity: parseInt(e.target.value) || 1})} size="small" fullWidth />
                                <TextField type="number" label="Nacht-Stücke" value={stealthConfig.nightIntensity} onChange={e => setStealthConfig({...stealthConfig, nightIntensity: parseInt(e.target.value) || 1})} size="small" fullWidth />
                            </Box>
                            <FormControl fullWidth size="small">
                                <InputLabel>Erlaubte Tages-Subkategorien</InputLabel>
                                <Select
                                    multiple
                                    value={stealthConfig.allowedDaySubCategories}
                                    onChange={e => setStealthConfig({...stealthConfig, allowedDaySubCategories: e.target.value})}
                                    renderValue={(selected) => selected.join(', ')}
                                >
                                    {onlySubCategories.map(sub => (
                                        <MenuItem key={sub} value={sub}>
                                            <Checkbox checked={stealthConfig.allowedDaySubCategories.indexOf(sub) > -1} />
                                            <ListItemText primary={sub} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                *Nachts ist die Subkategorie "Strumpfhose" zwingend vorgeschrieben.
                            </Typography>
                        </Box>
                    )}

                </DialogContent>
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}><Button onClick={() => setSuspensionDialog(false)} color="inherit">Abbrechen</Button><Button onClick={handleAddSuspension} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Weiter</Button></DialogActions>
            </>
        ) : (
            <>
                <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.purple, justifyContent: 'center' }}>
                    <TravelExploreIcon sx={{ mr: 1 }} /> DIKTAT: KOFFERINHALT
                </DialogTitle>
                <DialogContent sx={{ ...DESIGN_TOKENS.dialog.content.sx, maxHeight: '60vh', overflowY: 'auto' }}>
                    <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                        Die folgenden Items wurden algorithmisch für deine Mission vorausgewählt. Du hast diese Items zwingend in das Gepäck zu überführen.
                    </Alert>

                    <Typography variant="subtitle2" sx={{ color: PALETTE.primary.main, mb: 1, mt: 3 }}>Tagtrage-Loadout</Typography>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        {systemPackedItems.day.map(i => {
                            const imgSrc = i.imageUrl || (i.images && i.images.length > 0 ? i.images[0] : null);
                            return (
                                <Paper key={i.id} elevation={0} sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.primary.main}`, borderRadius: 2 }}>
                                    <Avatar src={imgSrc} variant="rounded" sx={{ width: 40, height: 40, mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }}>{!imgSrc && (i.name ? i.name.charAt(0).toUpperCase() : '?')}</Avatar>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                                        <Typography variant="subtitle2" noWrap sx={{ color: PALETTE.primary.main }}>{i.brand ? `${i.brand} - ` : ''}{i.name || 'Unbenannt'}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>ID: {i.customId || i.id} • {i.subCategory}</Typography>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Stack>

                    <Typography variant="subtitle2" sx={{ color: PALETTE.primary.main, mb: 1 }}>Nachttrage-Loadout (Strumpfhosen)</Typography>
                    <Stack spacing={1}>
                        {systemPackedItems.night.map(i => {
                            const imgSrc = i.imageUrl || (i.images && i.images.length > 0 ? i.images[0] : null);
                            return (
                                <Paper key={i.id} elevation={0} sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.primary.main}`, borderRadius: 2 }}>
                                    <Avatar src={imgSrc} variant="rounded" sx={{ width: 40, height: 40, mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }}>{!imgSrc && (i.name ? i.name.charAt(0).toUpperCase() : '?')}</Avatar>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                                        <Typography variant="subtitle2" noWrap sx={{ color: PALETTE.primary.main }}>{i.brand ? `${i.brand} - ` : ''}{i.name || 'Unbenannt'}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>ID: {i.customId || i.id} • {i.subCategory}</Typography>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                    <Button onClick={() => setSuspensionDialogMode('plan')} color="inherit">Abbrechen</Button>
                    <Button onClick={handleConfirmPack} variant="contained" sx={{ bgcolor: PALETTE.accents.purple }}>Verstanden & Akzeptiert</Button>
                </DialogActions>
            </>
        )}
      </Dialog>
      
      <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>{toast.message}</Alert></Snackbar>
    </Container>
  );
}