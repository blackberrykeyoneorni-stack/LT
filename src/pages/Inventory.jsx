import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { safeDate } from '../utils/dateUtils'; 

// FRAMER MOTION
import { motion } from 'framer-motion';

// UI Components
import { 
  Grid, Card, CardMedia, CardContent, Typography, 
  Fab, Box, Rating, Chip, Stack, Drawer, TextField, 
  MenuItem, Button, IconButton, CardActionArea, CircularProgress, Tooltip 
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SortIcon from '@mui/icons-material/Sort';
import SnoozeIcon from '@mui/icons-material/Snooze'; 
import NfcIcon from '@mui/icons-material/Nfc';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CheckroomIcon from '@mui/icons-material/Checkroom'; 
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService'; 

// --- ZENTRALES DESIGN ---
import { DESIGN_TOKENS, PALETTE, getCategoryColor } from '../theme/obsidianDesign';

// --- MOTION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1 // Staggering für die Kinder (Items)
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 }
  }
};

export default function Inventory() {
  const { items, loading } = useItems(); 
  const [filteredItems, setFilteredItems] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const locationRouter = useLocation();

  // NFC Context
  const { startGlobalScan, isScanning: nfcScanning } = useNFCGlobal();

  // Settings & Filter States
  const [settings, setSettings] = useState({ brands: [], materials: [] });
  const [restingHours, setRestingHours] = useState(24); // Standardwert
  const [filterOpen, setFilterOpen] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterBrand, setFilterBrand] = useState('All');
  const [filterMaterial, setFilterMaterial] = useState('All'); 
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('dateDesc');
  const [scannedLocation, setScannedLocation] = useState(null);

  // LOAD SETTINGS
  useEffect(() => {
    if (!currentUser) return;
    const loadSettings = async () => {
      try {
        const [bSnap, mSnap, pSnap] = await Promise.all([
            getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`))
        ]);

        setSettings({
          brands: bSnap.exists() ? bSnap.data().list : [],
          materials: mSnap.exists() ? mSnap.data().list : []
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

  // ROUTER STATE LISTENER (NFC Navigation)
  useEffect(() => {
      if (locationRouter.state?.filterLocation) {
          setScannedLocation(locationRouter.state.filterLocation);
          setFilterCategory('All'); setFilterBrand('All'); setFilterStatus('All'); 
      }
  }, [locationRouter]);

  // --- HELPER: Recovery Status berechnen ---
  const getRecoveryInfo = (item) => {
      if (!item || item.mainCategory !== 'Nylons') return null;
      
      const lastWornDate = safeDate(item.lastWorn); 
      if (!lastWornDate) return null;

      const hoursSince = (new Date() - lastWornDate) / (1000 * 60 * 60);
      
      if (hoursSince < restingHours) {
          return {
              isResting: true,
              remaining: Math.ceil(restingHours - hoursSince)
          };
      }
      return null;
  };

  // FILTER LOGIC
  useEffect(() => {
    let res = [...items];

    // 1. Location Filter (NFC Priorität)
    if (scannedLocation) {
        res = res.filter(i => i.storageLocation && i.storageLocation.trim() === scannedLocation.trim());
    } else {
        // 2. Status Filter
        if (filterStatus === 'active') {
            res = res.filter(i => (i.status === 'active' || !i.status));
        } else if (filterStatus !== 'All') {
            res = res.filter(i => i.status === filterStatus);
        }
    }

    // 3. Attribute Filter
    if (filterCategory !== 'All') res = res.filter(i => i.mainCategory === filterCategory || i.category === filterCategory);
    if (filterBrand !== 'All') res = res.filter(i => i.brand === filterBrand);
    if (filterMaterial !== 'All') res = res.filter(i => i.material === filterMaterial); 
    if (filterMinRating > 0) res = res.filter(i => i.condition >= filterMinRating);
    
    // 4. Sortierung
    res.sort((a, b) => {
      switch (sortBy) {
        case 'dateDesc': return (safeDate(b.purchaseDate) || 0) - (safeDate(a.purchaseDate) || 0);
        case 'dateAsc': return (safeDate(a.purchaseDate) || 0) - (safeDate(b.purchaseDate) || 0);
        case 'priceDesc': return (b.cost || 0) - (a.cost || 0);
        case 'priceAsc': return (a.cost || 0) - (b.cost || 0);
        case 'conditionDesc': return (b.condition || 0) - (a.condition || 0);
        case 'conditionAsc': return (a.condition || 0) - (b.condition || 0);
        case 'nameAsc': return (a.brand + a.model).localeCompare(b.brand + b.model);
        default: return 0;
      }
    });
    setFilteredItems(res);
  }, [items, filterCategory, filterBrand, filterMaterial, filterMinRating, filterStatus, sortBy, scannedLocation, restingHours]);

  const getDisplayName = (item) => item.name || `${item.brand} ${item.model}`;
  const getImage = (item) => {
    if (item.imageUrl) return item.imageUrl;
    if (item.images && item.images.length > 0) return item.images[0];
    return null; 
  };

  const categories = ['All', ...new Set(items.map(i => i.mainCategory || i.category).filter(Boolean))];
  
  if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

  return (
    <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>Inventar ({filteredItems.length})</Typography>
                <Box>
                    <IconButton color="primary" onClick={startGlobalScan} disabled={nfcScanning}>
                        {nfcScanning ? <CircularProgress size={24} /> : <NfcIcon />}
                    </IconButton>
                    <IconButton onClick={() => setFilterOpen(true)}><FilterListIcon /></IconButton>
                </Box>
            </Box>
          </motion.div>

          {/* ACTIVE FILTERS CHIPS */}
          <motion.div variants={itemVariants}>
            <Box sx={{ mb: 2, display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {scannedLocation && <Chip icon={<Inventory2Icon />} label={`Ort: ${scannedLocation}`} onDelete={() => { setScannedLocation(null); }} color="success"/>}
                {filterCategory !== 'All' && <Chip label={filterCategory} onDelete={() => setFilterCategory('All')} />}
                {filterBrand !== 'All' && <Chip label={filterBrand} onDelete={() => setFilterBrand('All')} />}
                {sortBy !== 'dateDesc' && <Chip icon={<SortIcon />} label="Sortiert" onDelete={() => setSortBy('dateDesc')} />}
            </Box>
          </motion.div>

          {/* GRID - JETZT MIT MOTION COMPONENT UND VARIANTS FÜR KORREKTES STAGGERING */}
          <Grid 
            container 
            spacing={2} 
            component={motion.div} 
            variants={containerVariants} // Nutzt staggerChildren für die Items
          >
            {filteredItems.map((item) => {
            const recoveryInfo = getRecoveryInfo(item);
            const isResting = recoveryInfo?.isResting;
            const imgUrl = getImage(item);
            const catColors = getCategoryColor(item.mainCategory);
            const isArchived = item.status === 'archived';
            const isWashing = item.status === 'washing';

            let borderColor = catColors.border;
            let background = catColors.bg;
            let imgFilter = 'none';
            
            if (isWashing) {
                borderColor = PALETTE.accents.blue;
                background = `${PALETTE.accents.blue}1A`;
                imgFilter = 'grayscale(0.8)';
            } else if (isArchived) {
                borderColor = PALETTE.accents.red;
                background = 'rgba(20, 0, 0, 0.4)';
                imgFilter = 'grayscale(1)';
            } else if (isResting) {
                imgFilter = 'brightness(0.5) grayscale(0.3)';
            }

            return (
                <Grid item xs={6} sm={4} md={3} key={item.id} component={motion.div} variants={itemVariants} layout>
                    <Card sx={{ 
                        height: '100%', display: 'flex', flexDirection: 'column',
                        ...DESIGN_TOKENS.glassCard, 
                        borderColor: borderColor,
                        background: background,
                        transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                        <CardActionArea sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }} onClick={() => navigate('/item/' + item.id)}>
                        <Box sx={{ position: 'relative', pt: '100%', bgcolor: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                            {imgUrl ? (
                                <CardMedia component="img" image={imgUrl} alt={getDisplayName(item)} 
                                    sx={{ 
                                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
                                        filter: imgFilter 
                                    }} 
                                />
                            ) : (<CheckroomIcon sx={{ position: 'absolute', top: '35%', left: '35%', fontSize: 40, opacity: 0.3 }} />)}
                            
                            {item.customId && (
                                <Chip icon={<FingerprintIcon style={{ fontSize: 16, color: 'white' }} />} label={item.customId} size="small" sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: 'white', fontWeight: 'bold' }} />
                            )}
                            
                            {(isWashing) && (
                                <LocalLaundryServiceIcon sx={{ position: 'absolute', bottom: 8, right: 8, color: PALETTE.accents.blue, filter: 'drop-shadow(0 0 4px black)' }} />
                            )}
                            
                            {isResting && item.status === 'active' && (
                                <Tooltip title={`Erholung: noch ${recoveryInfo.remaining}h`}>
                                    <Chip 
                                        icon={<SnoozeIcon style={{ fontSize: 16, color: '#fff' }} />} 
                                        label={`${recoveryInfo.remaining}h`} 
                                        size="small" 
                                        sx={{ 
                                            position: 'absolute', top: 8, right: 8, 
                                            bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', border: `1px solid ${PALETTE.secondary.main}`,
                                            backdropFilter: 'blur(4px)'
                                        }} 
                                    />
                                </Tooltip>
                            )}
                        </Box>

                        <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold' }}>{getDisplayName(item)}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">{item.mainCategory}</Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                            <Chip label={item.brand} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                <Rating value={item.condition} readOnly size="small" max={5} sx={{ fontSize: '0.8rem' }} />
                            </Stack>
                        </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>
            );
            })}
          </Grid>
      </motion.div>
      
      {/* FILTER DRAWER */}
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { bgcolor: '#121212', borderLeft: '1px solid #333' } }}>
        <Box sx={{ width: 280, p: 3, pt: 8, height: '100%', overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}><Typography variant="h6">Filtern & Sortieren</Typography><IconButton onClick={() => setFilterOpen(false)}><CloseIcon /></IconButton></Box>
          
          <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>Sortierung</Typography>
          <TextField select fullWidth size="small" margin="dense" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <MenuItem value="dateDesc">Neueste zuerst</MenuItem>
            <MenuItem value="dateAsc">Älteste zuerst</MenuItem>
            <MenuItem value="priceDesc">Preis (Hoch {'>'} Niedrig)</MenuItem>
            <MenuItem value="priceAsc">Preis (Niedrig {'>'} Hoch)</MenuItem>
            <MenuItem value="conditionDesc">Zustand (Best)</MenuItem>
            <MenuItem value="nameAsc">Name (A-Z)</MenuItem>
          </TextField>

          <Typography variant="subtitle2" color="primary" sx={{ mt: 3 }}>Filter</Typography>
          <TextField select fullWidth label="Status" margin="dense" size="small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><MenuItem value="active">Verfügbar</MenuItem><MenuItem value="All">Alle</MenuItem><MenuItem value="washing">In der Wäsche</MenuItem><MenuItem value="archived">Archiviert</MenuItem></TextField>
          <TextField select fullWidth label="Kategorie" margin="dense" size="small" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><MenuItem value="All">Alle</MenuItem>{categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
          <TextField select fullWidth label="Marke" margin="dense" size="small" value={filterBrand} onChange={e => setFilterBrand(e.target.value)}><MenuItem value="All">Alle Marken</MenuItem>{settings.brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}</TextField>
          <TextField select fullWidth label="Material" margin="dense" size="small" value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}><MenuItem value="All">Alle Materialien</MenuItem>{settings.materials.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField>
          
          <Typography gutterBottom sx={{ mt: 2, fontSize: '0.9rem' }}>Mindest-Zustand</Typography>
          <Rating value={filterMinRating} onChange={(e, v) => setFilterMinRating(v)} />
          
          <Button variant="outlined" fullWidth sx={{ mt: 4 }} onClick={() => { setFilterStatus('active');
            setFilterCategory('All'); setFilterBrand('All'); setFilterMaterial('All'); setFilterMinRating(0); setSortBy('dateDesc'); setScannedLocation(null); }}>Zurücksetzen</Button>
        </Box>
      </Drawer>

      {/* FAB - ADD BUTTON */}
      <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 20 }} onClick={() => navigate('/add')}><AddIcon /></Fab>
    </Box>
  );
}
