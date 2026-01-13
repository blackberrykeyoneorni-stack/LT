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
  
  // STATE DEFINITIONS (Gekürzt: identisch zur alten Datei, nur UI ändert sich)
  const [brands, setBrands] = useState([]); const [newBrand, setNewBrand] = useState('');
  const [materials, setMaterials] = useState([]); const [newMaterial, setNewMaterial] = useState('');
  const [catStructure, setCatStructure] = useState({}); const [newMainCat, setNewMainCat] = useState(''); const [newSubCat, setNewSubCat] = useState(''); const [selectedMainForSub, setSelectedMainForSub] = useState('');
  const [locations, setLocations] = useState([]); const [newLocation, setNewLocation] = useState(''); const [locationIndex, setLocationIndex] = useState({}); const [pairingLocation, setPairingLocation] = useState(null);
  const [archiveReasons, setArchiveReasons] = useState([]); const [newArchiveReason, setNewArchiveReason] = useState(''); const [runLocations, setRunLocations] = useState([]); const [newRunLocation, setNewRunLocation] = useState(''); const [runCauses, setRunCauses] = useState([]); const [newRunCause, setNewRunCause] = useState('');
  const [dailyTargetHours, setDailyTargetHours] = useState(3); const [nylonRestingHours, setNylonRestingHours] = useState(24); const [maxInstructionItems, setMaxInstructionItems] = useState(1); const [previousTarget, setPreviousTarget] = useState(null);
  const [sissyProtocolEnabled, setSissyProtocolEnabled] = useState(false); const [nightReleaseProbability, setNightReleaseProbability] = useState(15);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [categoryWeights, setCategoryWeights] = useState({}); const [weightTarget, setWeightTarget] = useState(''); const [weightValue, setWeightValue] = useState(2);
  const [loading, setLoading] = useState(true); const [backupLoading, setBackupLoading] = useState(false); const [repairLoading, setRepairLoading] = useState(false); const [resetModalOpen, setResetModalOpen] = useState(false); const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
  const handleCloseToast = () => setToast({ ...toast, open: false });

  // LOAD & SAVE HANDLERS (Identisch zur Logik aus dem vorherigen Turn, hier ausgeblendet für Fokus auf UI)
  useEffect(() => { if (currentUser) { loadAll(); checkBiometrics(); } }, [currentUser]);
  // ... (Hier stehen die Funktionen loadAll, checkBiometrics, handleStartPairing, savePreferences etc.)
  // ... (Placeholder für die unveränderte Logik)
  const loadAll = async () => { /* ... */ setLoading(false); }; // Mock
  const checkBiometrics = async () => { /* ... */ }; 
  const handleStartPairing = (loc) => { /* ... */ };
  const savePreferences = async () => { /* ... */ };
  const addItemToList = async () => { /* ... */ };
  const removeItemFromList = async () => { /* ... */ };
  const addWeight = () => { /* ... */ };
  const removeWeight = () => { /* ... */ };
  const handleRepairDatabase = async () => { /* ... */ };
  const handleBackup = async () => { /* ... */ };
  const handleToggleBiometrics = async () => { /* ... */ };
  const handleSmartReset = async () => { /* ... */ };
  
  // Section Header Helper
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
      catStructure[main].forEach(sub => allCategoryOptions.push({ label: `• ${sub}`, value: sub }));
  });

  return (
    <Container maxWidth="md" disableGutters sx={{ pt: 1, pb: 10, px: 2 }}>
      <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Einstellungen</Typography>

      {/* --- PREFERENCES --- */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.primary.main}` }}>
        <AccordionSummary expandIcon={<Icons.Expand />}>
            <SectionHeader icon={Icons.Track} title="Ziele & Limits" color={PALETTE.primary.main} />
        </AccordionSummary>
        <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
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
                <Slider value={dailyTargetHours} min={1} max={12} step={0.5} onChange={(e, v) => setDailyTargetHours(v)} sx={{ color: PALETTE.primary.main }} />
            </Box>
            
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

      {/* --- KATEGORIEN & ORTE --- */}
      <Accordion sx={{ ...DESIGN_TOKENS.accordion.root, borderLeft: `4px solid ${PALETTE.accents.blue}` }}>
         <AccordionSummary expandIcon={<Icons.Expand />}><SectionHeader icon={Icons.Inventory} title="Lagerorte & NFC" color={PALETTE.accents.blue} /></AccordionSummary>
         <AccordionDetails sx={DESIGN_TOKENS.accordion.details}>
             <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField size="small" fullWidth label="Neuer Ort" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                <Button variant="contained" sx={{ bgcolor: PALETTE.accents.blue }} onClick={() => addItemToList('locations', newLocation, setLocations, locations)}><Icons.Add /></Button>
             </Box>
             <Stack spacing={1}>
                {locations.map(loc => (
                  <Paper key={loc} sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{loc}</Typography>
                      {Object.values(locationIndex).includes(loc) && <Chip icon={<Icons.Link style={{ fontSize: 14 }} />} label="NFC" size="small" color="secondary" variant="outlined" sx={{ height: 20 }} />}
                    </Box>
                    <IconButton size="small" onClick={() => handleStartPairing(loc)} disabled={isScanning}><Icons.Nfc fontSize="small" /></IconButton>
                  </Paper>
                ))}
             </Stack>
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
            <Button variant="outlined" color="warning" startIcon={<Icons.Build />} fullWidth onClick={handleRepairDatabase} disabled={repairLoading}>
                {repairLoading ? "Repariere..." : "DB Reparatur"}
            </Button>
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
        <DialogActions><Button onClick={() => setResetModalOpen(false)}>Abbrechen</Button><Button onClick={handleSmartReset} color="warning">Reset</Button></DialogActions>
      </Dialog>
      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}><Alert severity={toast.severity}>{toast.message}</Alert></Snackbar>
    </Container>
  );
}