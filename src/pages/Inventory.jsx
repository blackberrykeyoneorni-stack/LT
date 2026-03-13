import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { safeDate } from '../utils/dateUtils'; 

// COMPONENTS
import AddItemDrawer from '../components/inventory/AddItemDrawer'; 

// FRAMER MOTION
import { motion } from 'framer-motion';

// UI Components
import { 
  Grid, Card, CardMedia, CardContent, Typography, 
  Fab, Box, Rating, Chip, Stack, Drawer, TextField, 
  MenuItem, Button, IconButton, CardActionArea, CircularProgress, Tooltip,
  Container
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SnoozeIcon from '@mui/icons-material/Snooze'; 
import NfcIcon from '@mui/icons-material/Nfc';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CheckroomIcon from '@mui/icons-material/Checkroom'; 
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService'; 

// DESIGN SYSTEM
import { DESIGN_TOKENS, PALETTE, MOTION } from '../theme/obsidianDesign';

// --- PERSISTENCE HELPER ---
const usePersistentState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
        const storedValue = localStorage.getItem(key);
        return storedValue !== null ? storedValue : defaultValue;
    });

    useEffect(() => {
        localStorage.setItem(key, state);
    }, [key, state]);

    return [state, setState];
};

export default function Inventory() {
  const { items, loading } = useItems(); 
  const [filteredItems, setFilteredItems] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const locationRouter = useLocation();

  const { startGlobalScan, isScanning: nfcScanning } = useNFCGlobal();

  // Settings & Filter States
  const [dropdowns, setDropdowns] = useState({ 
      brands: [], materials: [], locations: [], categoryStructure: {} 
  });
  const [restingHours, setRestingHours] = useState(24);
   
  // UI States
  const [filterOpen, setFilterOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false); 

  // --- PERSISTENT FILTER VALUES ---
  const [filterStatus, setFilterStatus] = usePersistentState('inv_filterStatus', 'active');
  const [filterCategory, setFilterCategory] = usePersistentState('inv_filterCategory', 'All');
  const [filterBrand, setFilterBrand] = usePersistentState('inv_filterBrand', 'All');
  const [filterMaterial, setFilterMaterial] = usePersistentState('inv_filterMaterial', 'All'); 
  const [filterLocation, setFilterLocation] = usePersistentState('inv_filterLocation', 'All'); 
  const [filterMinRating, setFilterMinRating] = usePersistentState('inv_filterMinRating', '0'); 
  const [sortBy, setSortBy] = usePersistentState('inv_sortBy', 'dateDesc');
  
  // Temporärer State für NFC Scans
  const [scannedLocation, setScannedLocation] = useState(null);

  // LOAD SETTINGS
  useEffect(() => {
    if (!currentUser) return;
    const loadSettings = async () => {
      try {
        const [bSnap, mSnap, pSnap, lSnap, cSnap] = await Promise.all([
            getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/locations`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/categories`))
        ]);

        setDropdowns({
            brands: bSnap.exists() ? bSnap.data().list : [],
            materials: mSnap.exists() ? mSnap.data().list : [],
            locations: lSnap.exists() ? lSnap.data().list : [],
            categoryStructure: cSnap.exists() ? cSnap.data().structure : {}
        });

        if (pSnap.exists()) {
            setRestingHours(pSnap.data().nylonRestingHours || 24);
        }
      } catch (e) {
          console.error("Error loading inventory settings:", e);
      }
    };
    loadSettings();
  }, [currentUser]);

  // ROUTER STATE LISTENER
  useEffect(() => {
      if (locationRouter.state?.filterLocation) {
          setScannedLocation(locationRouter.state.filterLocation);
      }
  }, [locationRouter]);

  // --- COMBINED LOCATIONS ---
  const availableLocations = useMemo(() => {
      const fromSettings = dropdowns.locations || [];
      const fromItems = items.map(i => i.location || i.storageLocation).filter(l => l && l.trim() !== '');
      return [...new Set([...fromSettings, ...fromItems])].sort();
  }, [dropdowns.locations, items]);

  // --- FILTER LOGIC ---
  const getRecoveryInfo = (item) => {
      if (!item) return null;
      
      const cat = (item.mainCategory || '').toLowerCase();
      const sub = (item.subCategory || '').toLowerCase();
      const isNylonRelated = cat.includes('nylon') || cat.includes('strumpf') || cat.includes('tights') || 
                             sub.includes('nylon') || sub.includes('strumpf') || sub.includes('tights');

      if (!isNylonRelated) return null;

      let lastWornDate = null;
      if (item.lastWorn) {
        if (typeof item.lastWorn.toDate === 'function') {
            lastWornDate = item.lastWorn.toDate();
        } else {
            lastWornDate = new Date(item.lastWorn);
        }
      }

      if (!lastWornDate || isNaN(lastWornDate.getTime())) return null;
      
      const hoursSince = (new Date() - lastWornDate) / (1000 * 60 * 60);
      if (hoursSince < restingHours) {
          return { isResting: true, remaining: Math.ceil(restingHours - hoursSince) };
      }
      return null;
  };

  useEffect(() => {
    let res = [...items];
    
    if (scannedLocation) {
        res = res.filter(i => {
            const loc = i.location || i.storageLocation;
            return loc && loc.trim() === scannedLocation.trim();
        });
    } else {
        if (filterStatus === 'active') {
            res = res.filter(i => (i.status === 'active' || !i.status));
        } else if (filterStatus !== 'All') {
            res = res.filter(i => i.status === filterStatus);
        }

        if (filterCategory !== 'All') res = res.filter(i => i.mainCategory === filterCategory || i.category === filterCategory);
        if (filterBrand !== 'All') res = res.filter(i => i.brand === filterBrand);
        if (filterMaterial !== 'All') res = res.filter(i => i.material === filterMaterial); 
        
        if (filterLocation !== 'All') {
            res = res.filter(i => (i.location || i.storageLocation) === filterLocation);
        }

        if (parseInt(filterMinRating) > 0) res = res.filter(i => i.condition >= parseInt(filterMinRating));
    }
    
    res.sort((a, b) => {
      switch (sortBy) {
        case 'dateDesc': return (safeDate(b.purchaseDate) || 0) - (safeDate(a.purchaseDate) || 0);
        case 'dateAsc': return (safeDate(a.purchaseDate) || 0) - (safeDate(b.purchaseDate) || 0);
        case 'priceDesc': return (b.cost || 0) - (a.cost || 0);
        case 'priceAsc': return (a.cost || 0) - (b.cost || 0);
        case 'conditionDesc': return (b.condition || 0) - (a.condition || 0);
        case 'nameAsc': 
            const nameA = (a.brand || '') + (a.model || '') + (a.name || '');
            const nameB = (b.brand || '') + (b.model || '') + (b.name || '');
            return nameA.localeCompare(nameB);
        default: return 0;
      }
    });
    setFilteredItems(res);
  }, [items, filterCategory, filterBrand, filterMaterial, filterMinRating, filterStatus, filterLocation, sortBy, scannedLocation, restingHours]);

  const getDisplayName = (item) => item.name || `${item.brand} ${item.model}`;
  const getImage = (item) => {
    if (item.imageUrl) return item.imageUrl;
    if (item.images && item.images.length > 0) return item.images[0];
    return null; 
  };
  const categories = ['All', ...new Set(items.map(i => i.mainCategory || i.category).filter(Boolean))];
  
  if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

  return (
    <Container maxWidth="md" disableGutters sx={{ pt: 1, pb: 10 }}> 
      <motion.div initial="hidden" animate="show" variants={MOTION.listContainer}>
          
          {/* HEADER */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
                <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>Inventar ({filteredItems.length})</Typography>
                <Box>
                    <IconButton color="primary" onClick={startGlobalScan} disabled={nfcScanning}>
                        {nfcScanning ? <CircularProgress size={24} color="primary" /> : <NfcIcon />}
                    </IconButton>
                    <IconButton onClick={() => setFilterOpen(true)} sx={{ color: PALETTE.text.primary }}><FilterListIcon /></IconButton>
                </Box>
          </Box>

          {/* ACTIVE FILTERS */}
          <Box sx={{ mb: 2, px: 2, display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {scannedLocation && <Chip icon={<Inventory2Icon />} label={`Ort: ${scannedLocation}`} onDelete={() => { setScannedLocation(null); }} sx={DESIGN_TOKENS.chip.active}/>}
                
                {!scannedLocation && (
                    <>
                        {filterCategory !== 'All' && <Chip label={filterCategory} onDelete={() => setFilterCategory('All')} sx={DESIGN_TOKENS.chip.active} />}
                        {filterBrand !== 'All' && <Chip label={filterBrand} onDelete={() => setFilterBrand('All')} sx={DESIGN_TOKENS.chip.active} />}
                        {filterLocation !== 'All' && <Chip icon={<Inventory2Icon style={{fontSize: 16}}/>} label={filterLocation} onDelete={() => setFilterLocation('All')} sx={DESIGN_TOKENS.chip.active} />}
                        {filterStatus !== 'active' && filterStatus !== 'All' && <Chip label={filterStatus} onDelete={() => setFilterStatus('active')} sx={DESIGN_TOKENS.chip.active} />}
                    </>
                )}
          </Box>

          {/* GRID (THE CATALOG OF OBJECTIFICATION) */}
          <Grid container spacing={2} sx={{ px: 2 }}>
            {filteredItems.map((item) => {
            const recoveryInfo = getRecoveryInfo(item);
            const isResting = recoveryInfo?.isResting;
            const imgUrl = getImage(item);
            const isWashing = item.status === 'washing';
            const isArchived = item.status === 'archived';

            // Base Style for "Sheer Nylon" Cards
            let borderColor = 'rgba(255, 0, 127, 0.3)'; // Sheer pink seam
            let imgFilter = 'none';
            let idChipBg = 'rgba(0,0,0,0.6)';
            let idChipColor = PALETTE.accents.blue; // Synthetic Cyan

            if (isArchived) {
                idChipBg = PALETTE.accents.red;
                idChipColor = '#FFF';
                borderColor = PALETTE.accents.red;
                imgFilter = 'grayscale(1)';
            } 
            else if (isWashing) {
                idChipBg = PALETTE.accents.blue;
                idChipColor = '#000';
                borderColor = PALETTE.accents.blue;
                imgFilter = 'grayscale(0.8)';
            }
            else if (isResting) {
                idChipBg = '#ffc107'; 
                idChipColor = '#000';
            }
            
            return (
                <Grid item xs={6} sm={4} md={3} key={item.id} component={motion.div} variants={MOTION.listItem} layout>
                    <Card sx={{ 
                        height: '100%', display: 'flex', flexDirection: 'column',
                        ...DESIGN_TOKENS.glassCard, borderColor: borderColor,
                    }}>
                        <CardActionArea sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }} onClick={() => navigate('/item/' + item.id)}>
                        <Box sx={{ position: 'relative', pt: '100%', bgcolor: 'rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                            {imgUrl ? (
                                <CardMedia component="img" image={imgUrl} alt={getDisplayName(item)} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: imgFilter }} />
                            ) : (<CheckroomIcon sx={{ position: 'absolute', top: '35%', left: '35%', fontSize: 40, opacity: 0.3, color: PALETTE.primary.main }} />)}
                            
                            {/* --- NEON BARCODE ID CHIP --- */}
                            {item.customId && (
                                <Chip 
                                    icon={<FingerprintIcon style={{ fontSize: 14, color: idChipColor }} />} 
                                    label={item.customId} 
                                    size="small" 
                                    sx={{ 
                                        position: 'absolute', 
                                        top: 8, 
                                        left: 8, 
                                        bgcolor: idChipBg, 
                                        backdropFilter: 'blur(4px)', 
                                        color: idChipColor, 
                                        fontWeight: 800,
                                        border: `1px solid ${idChipColor}40`,
                                        height: '22px',       
                                        fontSize: '0.7rem',  
                                        '& .MuiChip-icon': { marginLeft: '4px' } 
                                    }} 
                                />
                            )}

                            {isWashing && <LocalLaundryServiceIcon sx={{ position: 'absolute', bottom: 8, right: 8, color: PALETTE.accents.blue, filter: `drop-shadow(0 0 6px ${PALETTE.accents.blue})` }} />}
                            
                            {/* --- RECOVERY CHIP --- */}
                            {isResting && item.status === 'active' && (
                                <Tooltip title={`Erholung: noch ${recoveryInfo.remaining}h`}>
                                    <Chip 
                                        icon={<SnoozeIcon style={{ fontSize: 16, color: '#000' }} />} 
                                        label={`${recoveryInfo.remaining}h`} 
                                        size="small" 
                                        sx={{ 
                                            position: 'absolute', 
                                            top: 8, 
                                            right: 8, 
                                            bgcolor: '#ffc107', 
                                            color: '#000',      
                                            fontWeight: 'bold',
                                            border: `1px solid #e0a800`,
                                            backdropFilter: 'blur(4px)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                        }} 
                                    />
                                </Tooltip>
                            )}
                        </Box>
                        <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, color: '#FFF' }}>{getDisplayName(item)}</Typography>
                            <Typography variant="caption" noWrap display="block" sx={{ color: PALETTE.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                                {item.mainCategory}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                                <Chip label={item.brand} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, ...DESIGN_TOKENS.chip.default }} />
                                <Rating value={item.condition} readOnly size="small" max={5} sx={{ fontSize: '0.8rem', color: PALETTE.primary.main }} />
                            </Stack>
                        </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>
            );
            })}
          </Grid>
      </motion.div>
      
      {/* PERFORMANCE FIX: AddItemDrawer Kapselung verhindert Re-Rendering des gesamten Inventars beim Tippen */}
      <AddItemDrawer 
          open={addItemOpen} 
          onClose={() => setAddItemOpen(false)} 
          dropdowns={dropdowns} 
      />

      {/* --- FILTER DRAWER --- */}
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { bgcolor: 'rgba(17, 13, 16, 0.95)', backdropFilter: 'blur(16px)', borderLeft: `1px solid rgba(255,0,127,0.3)` } }}>
        <Box sx={{ width: 280, p: 3, pt: 8, height: '100%', overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ color: PALETTE.primary.main, textTransform: 'uppercase', fontWeight: 800 }}>Filtern & Sortieren</Typography>
              <IconButton onClick={() => setFilterOpen(false)} sx={{ color: PALETTE.text.primary }}><CloseIcon /></IconButton>
          </Box>
          
          <TextField select fullWidth size="small" margin="dense" label="Sortierung" value={sortBy} onChange={e => setSortBy(e.target.value)} sx={DESIGN_TOKENS.inputField}>
            <MenuItem value="dateDesc">Neueste zuerst</MenuItem>
            <MenuItem value="dateAsc">Älteste zuerst</MenuItem>
            <MenuItem value="priceDesc">Preis (Hoch {'>'} Niedrig)</MenuItem>
            <MenuItem value="priceAsc">Preis (Niedrig {'>'} Hoch)</MenuItem>
            <MenuItem value="conditionDesc">Zustand (Best)</MenuItem>
            <MenuItem value="nameAsc">Name A-Z</MenuItem>
          </TextField>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: PALETTE.text.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>Filter</Typography>
          
          <TextField select fullWidth label="Status" margin="dense" size="small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={DESIGN_TOKENS.inputField}>
              <MenuItem value="active">Verfügbar</MenuItem>
              <MenuItem value="All">Alle</MenuItem>
              <MenuItem value="washing">In der Wäsche</MenuItem>
              <MenuItem value="archived">Archiviert</MenuItem>
          </TextField>

          <TextField select fullWidth label="Lagerort" margin="dense" size="small" value={filterLocation} onChange={e => setFilterLocation(e.target.value)} sx={DESIGN_TOKENS.inputField}>
              <MenuItem value="All">Alle Orte</MenuItem>
              {availableLocations.map(loc => (<MenuItem key={loc} value={loc}>{loc}</MenuItem>))}
          </TextField>

          <TextField select fullWidth label="Kategorie" margin="dense" size="small" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} sx={DESIGN_TOKENS.inputField}>
              <MenuItem value="All">Alle</MenuItem>
              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <TextField select fullWidth label="Marke" margin="dense" size="small" value={filterBrand} onChange={e => setFilterBrand(e.target.value)} sx={DESIGN_TOKENS.inputField}>
              <MenuItem value="All">Alle Marken</MenuItem>
              {dropdowns.brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </TextField>

          <TextField select fullWidth label="Material" margin="dense" size="small" value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)} sx={DESIGN_TOKENS.inputField}>
              <MenuItem value="All">Alle Materialien</MenuItem>
              {dropdowns.materials.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>

          <Button variant="outlined" fullWidth sx={{ mt: 4, ...DESIGN_TOKENS.buttonSecondary }} onClick={() => { 
              setFilterStatus('active'); setFilterCategory('All'); setFilterBrand('All'); setFilterMaterial('All'); 
              setFilterLocation('All'); setFilterMinRating('0'); setSortBy('dateDesc'); setScannedLocation(null); 
          }}>
              Zurücksetzen
          </Button>
        </Box>
      </Drawer>

      <Fab sx={{ position: 'fixed', bottom: 90, right: 20, bgcolor: PALETTE.primary.main, color: '#000', boxShadow: `0 0 20px ${PALETTE.primary.main}80`, '&:hover': {bgcolor: PALETTE.primary.dark} }} onClick={() => setAddItemOpen(true)}>
        <AddIcon />
      </Fab>
    </Container>
  );
}