import React, { useState, useEffect } from 'react';
import { 
    doc, getDoc, setDoc, updateDoc, collection, getDocs, 
    serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSecurity } from '../contexts/SecurityContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { generateBackup, downloadBackupFile } from '../services/BackupService';
import { enableBiometrics, disableBiometrics, isBiometricSupported } from '../services/BiometricService';
import { addSuspension, getSuspensions, terminateSuspension } from '../services/SuspensionService';

import {
  Box, Container, Typography, TextField, Button, Paper,
  Accordion, AccordionSummary, AccordionDetails,
  Chip, Stack, Switch, Slider, Snackbar, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  LinearProgress, CircularProgress,
  List, ListItem, ListItemText, ListItemSecondaryAction, FormControl, InputLabel, Select, MenuItem,
  Grid, Divider, Avatar
} from '@mui/material';

// --- ZENTRALES DESIGN ---
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import ScienceIcon from '@mui/icons-material/Science';

const formatHours = (val) => `${val}h`;

export default function Settings() {
  const { currentUser, logout } = useAuth();
  const { isBiometricActive, updateStatus } = useSecurity();
  const { startBindingScan, isScanning } = useNFCGlobal();
  
  // --- STATE DEFINITIONS ---
  
  // Listen
  const [brands, setBrands] = useState([]); const [newBrand, setNewBrand] = useState('');
  const [materials, setMaterials] = useState([]); const [newMaterial, setNewMaterial] = useState('');
  
  // Kategorien
  const [catStructure, setCatStructure] = useState({}); 
  const [newMainCat, setNewMainCat] = useState(''); 
  const [newSubCat, setNewSubCat] = useState(''); 
  
  // Orte & NFC
  const [locations, setLocations] = useState([]); 
  const [newLocation, setNewLocation] = useState(''); 
  const [locationIndex, setLocationIndex] = useState({}); 
  const [pairingLocation, setPairingLocation] = useState(null);
  
  // Forensik & Attribute
  const [archiveReasons, setArchiveReasons] = useState([]); const [newArchiveReason, setNewArchiveReason] = useState('');
  const [runLocations, setRunLocations] = useState([]); const [newRunLocation, setNewRunLocation] = useState('');
  const [runCauses, setRunCauses] = useState([]); const [newRunCause, setNewRunCause] = useState('');
  const [vibeTags, setVibeTags] = useState([]); const [newVibeTag, setNewVibeTag] = useState('');

  // Algorithmus & Gewichtung
  const [categoryWeights, setCategoryWeights] = useState({}); 
  const [weightTarget, setWeightTarget] = useState(''); 
  const [weightValue, setWeightValue] = useState(2);

  // Preferences
  const [dailyTargetHours, setDailyTargetHours] = useState(3); 
  const [nylonRestingHours, setNylonRestingHours] = useState(24); 
  const [maxInstructionItems, setMaxInstructionItems] = useState(1); 
  const [previousTarget, setPreviousTarget] = useState(null);
  const [sissyProtocolEnabled, setSissyProtocolEnabled] = useState(false); 
  const [nightReleaseProbability, setNightReleaseProbability] = useState(15);
  
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  
  // Suspension State
  const [suspensions, setSuspensions] = useState([]);
  const [suspensionDialog, setSuspensionDialog] = useState(false);
  const [newSuspension, setNewSuspension] = useState({ type: 'medical', reason: '', startDate: '', endDate: '' });

  // UI States
  const [loading, setLoading] = useState(true); 
  const [backupLoading, setBackupLoading] = useState(false); 
  const [resetModalOpen, setResetModalOpen] = useState(false); 
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  // --- LOAD DATA ---
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
          const [bSnap, mSnap, catSnap, locSnap, locIdxSnap, prefSnap, arSnap, rlSnap, rcSnap, vtSnap] = await Promise.all([
              getDoc(doc(db, `users/${userId}/settings/brands`)),
              getDoc(doc(db, `users/${userId}/settings/materials`)),
              getDoc(doc(db, `users/${userId}/settings/categories`)),
              getDoc(doc(db, `users/${userId}/settings/locations`)),
              getDoc(doc(db, `users/${userId}/settings/locationIndex`)),
              getDoc(doc(db, `users/${userId}/settings/preferences`)),
              getDoc(doc(db, `users/${userId}/settings/archiveReasons`)),
              getDoc(doc(db, `users/${userId}/settings/runLocations`)),
              getDoc(doc(db, `users/${userId}/settings/runCauses`)),
              getDoc(doc(db, `users/${userId}/settings/vibeTags`)),
          ]);

          if (bSnap.exists()) setBrands(bSnap.data().list || []);
          if (mSnap.exists()) setMaterials(mSnap.data().list || []);
          if (catSnap.exists()) setCatStructure(catSnap.data().structure || {});
          if (locSnap.exists()) setLocations(locSnap.data().list || []);
          if (locIdxSnap.exists()) setLocationIndex(locIdxSnap.data().mapping || {});
          
          if (prefSnap.exists()) {
              const d = prefSnap.data();
              setDailyTargetHours(d.dailyTargetHours || 3);
              setNylonRestingHours(d.nylonRestingHours || 24);
              setMaxInstructionItems(d.maxInstructionItems || 1);
              setSissyProtocolEnabled(d.sissyProtocolEnabled || false);
              setNightReleaseProbability(d.nightReleaseProbability || 15);
              setCategoryWeights(d.categoryWeights || {});
              setPreviousTarget(d.previousDailyTarget || null);
          }

          // Forensik Defaults laden falls leer
          setArchiveReasons(arSnap.exists() ? arSnap.data().list : ['Laufmasche', 'Verschlissen', 'Verloren', 'Spende']);
          setRunLocations(rlSnap.exists() ? rlSnap.data().list : ['Zehe', 'Ferse', 'Sohle', 'Oberschenkel', 'Zwickel']);
          setRunCauses(rcSnap.exists() ? rcSnap.data().list : ['Schuhe', 'Nägel', 'Schmuck', 'Möbel', 'Unbekannt']);
          setVibeTags(vtSnap.exists() ? vtSnap.data().list : ['Business', 'Casual', 'Fetisch', 'Sport', 'Alltag']);

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

  // --- ACTIONS: SUSPENSION ---
  const handleAddSuspension = async () => {
      if(!newSuspension.startDate || !newSuspension.endDate || !newSuspension.reason) return;
      try {
          await addSuspension(currentUser.uid, newSuspension);
          showToast("Auszeit beantragt & genehmigt.", "success");
          setSuspensionDialog(false);
          loadSuspensions();
          setNewSuspension({ type: 'medical', reason: '', startDate: '', endDate: '' });
      } catch (e) {
          showToast(e.message, "error");
      }
  };

  const handleTerminateSuspension = async (id) => {
      if(!window.confirm("Bist du sicher, dass du den Dienst vorzeitig wieder aufnehmen willst?")) return;
      await terminateSuspension(currentUser.uid, id);
      loadSuspensions();
      showToast("Willkommen zurück.", "success");
  };

  // --- ACTIONS: BIOMETRICS ---
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

  // --- ACTIONS: NFC LOCATIONS ---
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

  // --- ACTIONS: GENERAL SAVE ---
  const savePreferences = async () => {
      try {
          await setDoc(doc(db, `users/${currentUser.uid}/settings/preferences`), {
              dailyTargetHours, nylonRestingHours, maxInstructionItems, sissyProtocolEnabled, nightReleaseProbability, categoryWeights
          }, { merge: true });
          showToast("Gespeichert", "success");
      } catch (e) { showToast("Fehler", "error"); }
  };

  // --- ACTIONS: CATEGORIES ---
  const updateCategories = async (newStruct) => {
      try { await setDoc(doc(db, `users/${currentUser.uid}/settings/categories`), { structure: newStruct }, { merge: true }); setCatStructure(newStruct); } catch(e){}
  };
  
  const addMainCategory = async () => {
    if (!newMainCat.trim()) return;
    if (catStructure[newMainCat.trim()]) return showToast("Existiert bereits", "error");
    const newStruct = { ...catStructure, [newMainCat.trim()]: [] };
    await updateCategories(newStruct); setNewMainCat('');
  };

  const removeMainCategory = async (main) => {
    if (!window.confirm(`Kategorie "${main}" löschen?`)) return;
    const newStruct = { ...catStructure }; delete newStruct[main];
    await updateCategories(newStruct);
  };

  const addSubCategory = async (main) => {
    if (!newSubCat.trim()) return;
    const current = catStructure[main] || [];
    if (current.includes(newSubCat.trim())) return;
    await updateCategories({ ...catStructure, [main]: [...current, newSubCat.trim()] }); setNewSubCat('');
  };

  // --- ACTIONS: LISTS HELPER ---
  const addItemToList = async (n, i, s, c) => { 
      if (!i.trim()) return; 
      const l = [...c, i.trim()]; 
      await setDoc(doc(db, `users/${currentUser.uid}/settings/${n}`), { list: l }, { merge: true }); 
      s(l); 
  };
  
  const removeItemFromList = async (n, i, s, c) => { 
      const l = c.filter(x => x !== i); 
      await setDoc(doc(db, `users/${currentUser.uid}/settings/${n}`), { list: l }, { merge: true }); 
      s(l); 
  };

  // --- ACTIONS: ALGORITHM WEIGHTS ---
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

  // --- UI COMPONENTS ---
  const SectionHeader = ({ icon: Icon, title, color }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, color: color || 'text.primary' }}>
      <Avatar sx={{ bgcolor: `${color}22`, color: color, width: 32, height: 32 }}><Icon fontSize="small" /></Avatar>
      <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</Typography>
    </Box>
  );

  const ListManager = ({ title, items, newItem, setNewItem, listName, setList }) => (
      <Box sx={{ mb: 3 }}>
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

  // Flatten Categories for Dropdown in Algorithm
  const allCategoryOptions = [];
  Object.keys(catStructure).forEach(main => {
      allCategoryOptions.push({ label: `HAUPT: ${main}`, value: main });
      if(catStructure[main]) catStructure[main].forEach(sub => allCategoryOptions.push({ label: `• ${sub}`, value: sub }));
  });

  return (
    <Container maxWidth="md" disableGutters sx={{ pt: 1, pb: 10, px: 1 }}>
      <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Einstellungen</Typography>

      {/* 1. PROTOKOLL-VERWALTUNG */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.gold}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={MedicalServicesIcon} title="Protokoll-Verwaltung" color={PALETTE.accents.gold} />
        </AccordionSummary>
        <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Geplante Ausfallzeiten (Krankenhaus, Reisen)</Typography>
                <Button variant="contained" size="small" sx={{ bgcolor: PALETTE.accents.gold, color:'#000' }} onClick={() => setSuspensionDialog(true)} startIcon={<Icons.Add />}>
                    Beantragen
                </Button>
            </Box>
            <Stack spacing={1}>
                {suspensions.length === 0 && <Typography variant="caption" sx={{ fontStyle:'italic', color: PALETTE.text.muted }}>Keine geplanten Auszeiten.</Typography>}
                {suspensions.map(sus => (
                    <Paper key={sus.id} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderLeft: `2px solid ${PALETTE.accents.gold}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" fontWeight="bold">{sus.type.toUpperCase()}: {sus.reason}</Typography>
                            {sus.status === 'active' && <Chip label="AKTIV" color="warning" size="small" />}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {sus.startDate.toLocaleDateString()} - {sus.endDate.toLocaleDateString()}
                        </Typography>
                        {sus.status === 'active' && (
                            <Button size="small" color="inherit" onClick={() => handleTerminateSuspension(sus.id)} sx={{ mt: 1, fontSize:'0.7rem' }}>
                                Vorzeitig beenden
                            </Button>
                        )}
                    </Paper>
                ))}
            </Stack>
        </AccordionDetails>
      </Accordion>

      {/* 2. ZIELE & LIMITS */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Track} title="Ziele & Limits" color={PALETTE.primary.main} />
        </AccordionSummary>
        <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Box sx={{ mb: 4, mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Tagesziel (Stunden)</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography fontWeight="bold" color="primary">{dailyTargetHours} Std</Typography>
                    {previousTarget && dailyTargetHours > previousTarget && (
                        <Chip icon={<Icons.Reset style={{ fontSize: 14 }} />} label={`Reset ${previousTarget}h`} size="small" color="warning" variant="outlined" onClick={() => setResetModalOpen(true)} />
                    )}
                    </Box>
                </Box>
                <Slider value={dailyTargetHours} min={1} max={12} step={0.5} onChange={(e, v) => setDailyTargetHours(v)} sx={{ color: PALETTE.primary.main }} />
            </Box>
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Ruhezeit für Nylons</Typography>
                    <Typography fontWeight="bold" color="secondary">{nylonRestingHours} Std</Typography>
                </Box>
                <Slider value={nylonRestingHours} min={0} max={72} step={4} onChange={(e, v) => setNylonRestingHours(v)} sx={{ color: PALETTE.secondary.main }} />
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box><Typography variant="body1">Hardcore Protokoll</Typography><Typography variant="caption" color="text.secondary">Erzwingt Ingestion & Challenges</Typography></Box>
                <Switch checked={sissyProtocolEnabled} onChange={(e) => setSissyProtocolEnabled(e.target.checked)} color="error" />
            </Stack>
             {sissyProtocolEnabled && (
                <Box sx={{ mt: 2, pl: 2, borderLeft: `2px solid ${PALETTE.accents.red}` }}>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="error">Chance Start-Challenge</Typography>
                        <Typography variant="caption" color="error" fontWeight="bold">{nightReleaseProbability}%</Typography>
                     </Box>
                     <Slider value={nightReleaseProbability} min={0} max={100} step={5} onChange={(e, v) => setNightReleaseProbability(v)} sx={{ color: PALETTE.accents.red }} />
                </Box>
            )}
        </AccordionDetails>
      </Accordion>

      {/* 3. KATEGORIEN STRUKTUR */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.green}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Category} title="Kategorie Struktur" color={PALETTE.accents.green} />
        </AccordionSummary>
        <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
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

      {/* 4. ALGORITHMUS (WIEDERHERGESTELLT) */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Brain} title="Algorithmus" color={PALETTE.accents.purple} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Alert severity="info" sx={{mb: 2, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff'}}>Wahrscheinlichkeiten für die Zufallsauswahl.</Alert>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 3 }}>
                <FormControl fullWidth size="small">
                    <InputLabel>Kategorie</InputLabel>
                    <Select value={weightTarget} label="Kategorie" onChange={e => setWeightTarget(e.target.value)}>
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

      {/* 5. FORENSIK & ATTRIBUTE */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.red}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={ScienceIcon} title="Forensik & Attribute" color={PALETTE.accents.red} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
             <ListManager title="Verlust-Ursachen (Archiv)" items={archiveReasons} newItem={newArchiveReason} setNewItem={setNewArchiveReason} listName="archiveReasons" setList={setArchiveReasons} />
             <Divider sx={{ my: 2 }} />
             <ListManager title="Laufmaschen-Orte" items={runLocations} newItem={newRunLocation} setNewItem={setNewRunLocation} listName="runLocations" setList={setRunLocations} />
             <Divider sx={{ my: 2 }} />
             <ListManager title="Laufmaschen-Gründe" items={runCauses} newItem={newRunCause} setNewItem={setNewRunCause} listName="runCauses" setList={setRunCauses} />
             <Divider sx={{ my: 2 }} />
             <ListManager title="Vibe Tags" items={vibeTags} newItem={newVibeTag} setNewItem={setNewVibeTag} listName="vibeTags" setList={setVibeTags} />
         </AccordionDetails>
      </Accordion>

      {/* 6. LISTEN & ORTE */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Inventory} title="Listen & Orte" color={PALETTE.accents.blue} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
             <Typography variant="subtitle2" sx={{mb:1}}>Lagerorte</Typography>
             <Box sx={{ display: 'flex', gap: 1, mb: 2 }}><TextField size="small" fullWidth value={newLocation} onChange={e => setNewLocation(e.target.value)} /><Button onClick={() => addItemToList('locations', newLocation, setLocations, locations)}><Icons.Add /></Button></Box>
             <Stack spacing={1} sx={{mb:2}}>{locations.map(loc => <Paper key={loc} sx={{p:1, display:'flex', justifyContent:'space-between'}}><Typography>{loc}</Typography><IconButton size="small" onClick={()=>handleStartPairing(loc)}><Icons.Nfc fontSize="small"/></IconButton></Paper>)}</Stack>
             
             <Divider sx={{ my: 2 }} />
             <ListManager title="Marken" items={brands} newItem={newBrand} setNewItem={setNewBrand} listName="brands" setList={setBrands} />
             
             <Divider sx={{ my: 2 }} />
             <ListManager title="Materialien" items={materials} newItem={newMaterial} setNewItem={setNewMaterial} listName="materials" setList={setMaterials} />
         </AccordionDetails>
      </Accordion>

      {/* 7. SYSTEM */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Settings} title="System" color={PALETTE.primary.main} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}><Icons.Fingerprint /><Typography>Biometrie</Typography></Box>
                <Switch checked={isBiometricActive} onChange={handleToggleBiometrics} disabled={!biometricAvailable} />
            </Stack>
         </AccordionDetails>
      </Accordion>

      <Button variant="contained" size="large" fullWidth sx={{ ...DESIGN_TOKENS.buttonGradient, mt: 2, mb: 4 }} onClick={savePreferences}>Einstellungen Speichern</Button>
      <Paper sx={{ p: 2, mb: 4, ...DESIGN_TOKENS.glassCard, display: 'flex', gap: 2 }}>
        <Button variant="outlined" color="primary" fullWidth onClick={handleBackup}>Backup</Button>
        <Button variant="outlined" color="error" fullWidth onClick={logout}>Abmelden</Button>
      </Paper>

      {/* SUSPENSION DIALOG */}
      <Dialog open={suspensionDialog} onClose={() => setSuspensionDialog(false)} PaperProps={DESIGN_TOKENS.dialog.paper}>
          <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Auszeit Beantragen</DialogTitle>
          <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
              <DialogContentText sx={{ mb: 2 }}>Planung ist nur für die Zukunft möglich.</DialogContentText>
              <Stack spacing={2}>
                  <FormControl fullWidth>
                      <InputLabel>Grund</InputLabel>
                      <Select value={newSuspension.type} label="Grund" onChange={(e) => setNewSuspension({...newSuspension, type: e.target.value})}>
                          <MenuItem value="medical">Medizinisch / Krankenhaus</MenuItem>
                          <MenuItem value="travel">Dienstreise / Urlaub</MenuItem>
                          <MenuItem value="maintenance">Wartung / Inventur</MenuItem>
                      </Select>
                  </FormControl>
                  <TextField label="Start" type="date" InputLabelProps={{shrink: true}} fullWidth value={newSuspension.startDate} onChange={(e) => setNewSuspension({...newSuspension, startDate: e.target.value})} sx={DESIGN_TOKENS.inputField} />
                  <TextField label="Ende" type="date" InputLabelProps={{shrink: true}} fullWidth value={newSuspension.endDate} onChange={(e) => setNewSuspension({...newSuspension, endDate: e.target.value})} sx={DESIGN_TOKENS.inputField} />
                  <TextField label="Begründung (Pflicht)" multiline rows={3} fullWidth value={newSuspension.reason} onChange={(e) => setNewSuspension({...newSuspension, reason: e.target.value})} sx={DESIGN_TOKENS.inputField} />
              </Stack>
          </DialogContent>
          <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
              <Button onClick={() => setSuspensionDialog(false)} color="inherit">Abbrechen</Button>
              <Button onClick={handleAddSuspension} variant="contained" disabled={!newSuspension.reason} sx={DESIGN_TOKENS.buttonGradient}>Beantragen</Button>
          </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}><Alert severity={toast.severity}>{toast.message}</Alert></Snackbar>
    </Container>
  );
}