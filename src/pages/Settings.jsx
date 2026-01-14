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

const formatHours = (val) => `${val}h`;

export default function Settings() {
  const { currentUser, logout } = useAuth();
  const { isBiometricActive, updateStatus } = useSecurity();
  const { startBindingScan, isScanning } = useNFCGlobal();
  
  // STATE DEFINITIONS
  const [brands, setBrands] = useState([]); const [newBrand, setNewBrand] = useState('');
  const [materials, setMaterials] = useState([]); const [newMaterial, setNewMaterial] = useState('');
  const [catStructure, setCatStructure] = useState({}); const [newMainCat, setNewMainCat] = useState(''); const [newSubCat, setNewSubCat] = useState(''); const [selectedMainForSub, setSelectedMainForSub] = useState('');
  const [locations, setLocations] = useState([]); const [newLocation, setNewLocation] = useState(''); const [locationIndex, setLocationIndex] = useState({}); const [pairingLocation, setPairingLocation] = useState(null);
  const [archiveReasons, setArchiveReasons] = useState([]); const [newArchiveReason, setNewArchiveReason] = useState(''); const [runLocations, setRunLocations] = useState([]); const [newRunLocation, setNewRunLocation] = useState(''); const [runCauses, setRunCauses] = useState([]); const [newRunCause, setNewRunCause] = useState('');
  
  // Preferences
  const [dailyTargetHours, setDailyTargetHours] = useState(3); const [nylonRestingHours, setNylonRestingHours] = useState(24); const [maxInstructionItems, setMaxInstructionItems] = useState(1); const [previousTarget, setPreviousTarget] = useState(null);
  const [sissyProtocolEnabled, setSissyProtocolEnabled] = useState(false); const [nightReleaseProbability, setNightReleaseProbability] = useState(15);
  
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  
  const [categoryWeights, setCategoryWeights] = useState({}); const [weightTarget, setWeightTarget] = useState(''); const [weightValue, setWeightValue] = useState(2);
  
  // UI States
  const [loading, setLoading] = useState(true); const [backupLoading, setBackupLoading] = useState(false); const [repairLoading, setRepairLoading] = useState(false); const [resetModalOpen, setResetModalOpen] = useState(false); const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  // LOAD ALL DATA
  useEffect(() => { 
    if (currentUser) { 
        loadAll(); 
        checkBiometrics(); 
    } 
  }, [currentUser]);

  const loadAll = async () => {
      try {
          const userId = currentUser.uid;
          const [bSnap, mSnap, catSnap, locSnap, locIdxSnap, prefSnap, arSnap, rlSnap, rcSnap] = await Promise.all([
              getDoc(doc(db, `users/${userId}/settings/brands`)),
              getDoc(doc(db, `users/${userId}/settings/materials`)),
              getDoc(doc(db, `users/${userId}/settings/categories`)),
              getDoc(doc(db, `users/${userId}/settings/locations`)),
              getDoc(doc(db, `users/${userId}/settings/locationIndex`)),
              getDoc(doc(db, `users/${userId}/settings/preferences`)),
              getDoc(doc(db, `users/${userId}/settings/archiveReasons`)),
              getDoc(doc(db, `users/${userId}/settings/runLocations`)),
              getDoc(doc(db, `users/${userId}/settings/runCauses`))
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

          setArchiveReasons(arSnap.exists() ? arSnap.data().list : [{label:'Laufmasche', value:'run'}, {label:'Verschlissen', value:'worn'}, {label:'Verloren', value:'lost'}]);
          setRunLocations(rlSnap.exists() ? rlSnap.data().list : ['Zehe', 'Ferse', 'Oberschenkel', 'Zwickel']);
          setRunCauses(rcSnap.exists() ? rcSnap.data().list : ['Schuhe', 'Nägel', 'Schmuck', 'Unbekannt']);

      } catch (e) {
          console.error("Load Settings Error:", e);
          showToast("Fehler beim Laden der Einstellungen", "error");
      } finally {
          setLoading(false);
      }
  };

  const checkBiometrics = async () => {
      const avail = await isBiometricSupported();
      setBiometricAvailable(avail);
  };

  // --- ACTIONS ---

  const handleStartPairing = (loc) => {
      setPairingLocation(loc);
      startBindingScan(async (tagId) => {
          try {
              const newMapping = { ...locationIndex, [tagId]: loc };
              await setDoc(doc(db, `users/${currentUser.uid}/settings/locationIndex`), { mapping: newMapping }, { merge: true });
              setLocationIndex(newMapping);
              showToast(`Ort ${loc} verknüpft!`, "success");
          } catch (e) {
              showToast("Fehler beim Verknüpfen", "error");
          } finally {
              setPairingLocation(null);
          }
      });
  };

  const savePreferences = async () => {
      try {
          await setDoc(doc(db, `users/${currentUser.uid}/settings/preferences`), {
              dailyTargetHours,
              nylonRestingHours,
              maxInstructionItems,
              sissyProtocolEnabled,
              nightReleaseProbability,
              categoryWeights
          }, { merge: true });
          showToast("Einstellungen gespeichert", "success");
      } catch (e) {
          showToast("Fehler beim Speichern", "error");
      }
  };

  // Generic List Manager
  const addItemToList = async (collectionName, newItem, setList, currentList) => {
      if (!newItem.trim()) return;
      try {
          const newList = [...currentList, newItem.trim()];
          await setDoc(doc(db, `users/${currentUser.uid}/settings/${collectionName}`), { list: newList }, { merge: true });
          setList(newList);
          showToast("Hinzugefügt", "success");
      } catch(e) { showToast("Fehler", "error"); }
  };

  const removeItemFromList = async (collectionName, itemToRemove, setList, currentList) => {
      try {
          const newList = currentList.filter(i => i !== itemToRemove);
          await setDoc(doc(db, `users/${currentUser.uid}/settings/${collectionName}`), { list: newList }, { merge: true });
          setList(newList);
      } catch(e) { showToast("Fehler", "error"); }
  };

  const updateCategories = async (newStruct) => {
      try {
          await setDoc(doc(db, `users/${currentUser.uid}/settings/categories`), { structure: newStruct }, { merge: true });
          setCatStructure(newStruct);
          showToast("Kategorien aktualisiert", "success");
      } catch (e) { showToast("Fehler beim Speichern", "error"); }
  };

  const addMainCategory = async () => {
    if (!newMainCat.trim()) return;
    if (catStructure[newMainCat.trim()]) return showToast("Kategorie existiert bereits", "error");
    const newStruct = { ...catStructure, [newMainCat.trim()]: [] };
    await updateCategories(newStruct);
    setNewMainCat('');
  };

  const removeMainCategory = async (main) => {
    if (!window.confirm(`Kategorie "${main}" und alle Subkategorien löschen?`)) return;
    const newStruct = { ...catStructure };
    delete newStruct[main];
    await updateCategories(newStruct);
  };

  const addSubCategory = async (main) => {
    if (!newSubCat.trim()) return;
    const currentSubs = catStructure[main] || [];
    if (currentSubs.includes(newSubCat.trim())) return showToast("Subkategorie existiert bereits", "error");
    const newStruct = { ...catStructure, [main]: [...currentSubs, newSubCat.trim()] };
    await updateCategories(newStruct);
    setNewSubCat('');
  };

  const removeSubCategory = async (main, sub) => {
      const newStruct = { ...catStructure, [main]: catStructure[main].filter(s => s !== sub) };
      await updateCategories(newStruct);
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

  const SectionHeader = ({ icon: Icon, title, color }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, color: color || 'text.primary' }}>
      <Avatar sx={{ bgcolor: `${color}22`, color: color, width: 32, height: 32 }}>
        <Icon fontSize="small" />
      </Avatar>
      <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</Typography>
    </Box>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  // Flatten Categories for Dropdown
  const allCategoryOptions = [];
  Object.keys(catStructure).forEach(main => {
      allCategoryOptions.push({ label: `HAUPT: ${main}`, value: main });
      if(catStructure[main]) catStructure[main].forEach(sub => allCategoryOptions.push({ label: `• ${sub}`, value: sub }));
  });

  return (
    // KORREKTUR: Padding reduziert (px: 0 statt px: 2), damit Accordions breiter werden
    <Container maxWidth="md" disableGutters sx={{ pt: 1, pb: 10, px: 0 }}>
      <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Einstellungen</Typography>

      {/* --- PREFERENCES --- */}
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
            
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="body1" color={sissyProtocolEnabled ? "error" : "text.primary"} fontWeight={sissyProtocolEnabled ? "bold" : "normal"}>Hardcore Protokoll</Typography>
                    <Typography variant="caption" color="text.secondary">Erzwingt Ingestion & Start-Challenges</Typography>
                </Box>
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

      {/* --- KATEGORIEN STRUKTUR (NEU) --- */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.green}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Category} title="Kategorie Struktur" color={PALETTE.accents.green} />
        </AccordionSummary>
        <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField 
                    size="small" fullWidth label="Neue Hauptkategorie" 
                    value={newMainCat} onChange={e => setNewMainCat(e.target.value)} 
                    placeholder="z.B. Nylons, Schuhe..."
                />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.green }} onClick={addMainCategory}><Icons.Add /></Button>
            </Box>

            <Stack spacing={2}>
                {Object.keys(catStructure).length === 0 && <Typography variant="caption" color="text.secondary" align="center">Keine Kategorien angelegt.</Typography>}
                {Object.keys(catStructure).map(main => (
                    <Paper key={main} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.accents.green}40` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: PALETTE.accents.green }}>{main}</Typography>
                            <IconButton size="small" color="error" onClick={() => removeMainCategory(main)}><Icons.Delete /></IconButton>
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {catStructure[main].map(sub => (
                                <Chip 
                                    key={sub} 
                                    label={sub} 
                                    onDelete={() => removeSubCategory(main, sub)}
                                    size="small"
                                />
                            ))}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField 
                                size="small" fullWidth placeholder={`Subkategorie für ${main}...`}
                                value={newSubCat} onChange={e => setNewSubCat(e.target.value)}
                                sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem' } }}
                            />
                            <Button size="small" variant="outlined" sx={{ minWidth: 40 }} onClick={() => addSubCategory(main)}><Icons.Add /></Button>
                        </Box>
                    </Paper>
                ))}
            </Stack>
        </AccordionDetails>
      </Accordion>

      {/* --- ALGORITHMUS --- */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.purple}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Brain} title="Algorithmus" color={PALETTE.accents.purple} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Alert severity="info" sx={{mb: 2, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff'}}>Weighted Randomness Anpassung.</Alert>
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

      {/* --- LISTEN MANAGER --- */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Inventory} title="Listen & Orte" color={PALETTE.accents.blue} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
             
             {/* Lagerorte */}
             <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, color: PALETTE.accents.blue }}>Lagerorte</Typography>
             <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth label="Neuer Ort" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.blue }} onClick={() => addItemToList('locations', newLocation, setLocations, locations)}><Icons.Add /></Button>
             </Box>
             <Stack spacing={1} sx={{ mb: 4 }}>
                {locations.map(loc => (
                  <Paper key={loc} sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{loc}</Typography>
                      {Object.values(locationIndex).includes(loc) && <Chip icon={<Icons.Link style={{ fontSize: 14 }} />} label="NFC" size="small" color="secondary" variant="outlined" sx={{ height: 20 }} />}
                    </Box>
                    <Box>
                        <IconButton size="small" onClick={() => handleStartPairing(loc)} disabled={isScanning}><Icons.Nfc fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => removeItemFromList('locations', loc, setLocations, locations)}><Icons.Delete fontSize="small" /></IconButton>
                    </Box>
                  </Paper>
                ))}
             </Stack>

             <Divider sx={{ my: 2 }} />

             {/* Marken */}
             <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Marken</Typography>
             <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth label="Neue Marke" value={newBrand} onChange={e => setNewBrand(e.target.value)} />
                <Button variant="contained" onClick={() => addItemToList('brands', newBrand, setBrands, brands)}>Add</Button>
             </Box>
             <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 4 }}>
                 {brands.map(b => <Chip key={b} label={b} onDelete={() => removeItemFromList('brands', b, setBrands, brands)} size="small" />)}
             </Box>

             <Divider sx={{ my: 2 }} />

             {/* Materialien (NEU) */}
             <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Materialien</Typography>
             <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField size="small" fullWidth label="Neues Material" value={newMaterial} onChange={e => setNewMaterial(e.target.value)} />
                <Button variant="contained" onClick={() => addItemToList('materials', newMaterial, setMaterials, materials)}>Add</Button>
             </Box>
             <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                 {materials.map(m => <Chip key={m} label={m} onDelete={() => removeItemFromList('materials', m, setMaterials, materials)} size="small" />)}
             </Box>

         </AccordionDetails>
      </Accordion>

      {/* --- SYSTEM --- */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Settings} title="System" color={PALETTE.primary.main} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Icons.Fingerprint sx={{ color: isBiometricActive ? PALETTE.primary.main : 'text.secondary' }} />
                <Box><Typography variant="body1">Biometrie</Typography></Box>
                </Box>
                <Switch checked={isBiometricActive} onChange={handleToggleBiometrics} disabled={!biometricAvailable} color="primary" />
            </Stack>
         </AccordionDetails>
      </Accordion>

      {/* --- SAVE BUTTON --- */}
      <Button variant="contained" size="large" fullWidth sx={{ ...DESIGN_TOKENS.buttonGradient, mt: 2, mb: 4, height: 56 }} onClick={savePreferences}>
        Einstellungen Speichern
      </Button>

      {/* --- FOOTER: BACKUP & LOGOUT --- */}
      <Paper sx={{ p: 2, mb: 4, ...DESIGN_TOKENS.glassCard, display: 'flex', gap: 2 }}>
        <Button variant="outlined" color="primary" fullWidth startIcon={backupLoading ? <CircularProgress size={20} /> : <Icons.Cloud />} onClick={handleBackup}>Backup</Button>
        <Button variant="outlined" color="error" fullWidth onClick={logout} startIcon={<Icons.Close />}>Abmelden</Button>
      </Paper>

      {/* --- DIALOGE --- */}
      <Dialog open={resetModalOpen} onClose={() => setResetModalOpen(false)} PaperProps={DESIGN_TOKENS.dialog.paper}>
        <DialogTitle>Reset?</DialogTitle>
        <DialogActions><Button onClick={() => setResetModalOpen(false)}>Abbrechen</Button><Button onClick={() => {/* TODO */}} color="warning">Reset</Button></DialogActions>
      </Dialog>
      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}><Alert severity={toast.severity}>{toast.message}</Alert></Snackbar>
    </Container>
  );
}