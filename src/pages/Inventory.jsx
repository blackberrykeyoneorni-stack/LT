import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import { useNFCGlobal } from '../contexts/NFCContext';
import { safeDate } from '../utils/dateUtils'; 

// COMPONENTS
import ItemInfoGrid from '../components/item-detail/ItemInfoGrid'; 

// FRAMER MOTION
import { motion } from 'framer-motion';

// UI Components
import { 
  Grid, Card, CardMedia, CardContent, Typography, 
  Fab, Box, Rating, Chip, Stack, Drawer, TextField, 
  MenuItem, Button, IconButton, CardActionArea, CircularProgress, Tooltip,
  Container, Divider
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
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload'; 
import DeleteIcon from '@mui/icons-material/Delete';

// DESIGN SYSTEM
import { DESIGN_TOKENS, PALETTE, getCategoryColor, MOTION } from '../theme/obsidianDesign';

// DEFAULT STATE
const defaultNewItem = {
    name: '', brand: '', model: '', mainCategory: 'Nylons', subCategory: '',
    material: '', color: '', cost: '', condition: 5, suitablePeriod: 'Beide',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '', vibeTags: [], location: '', imageUrl: '', customId: ''
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
      brands: [], materials: [], locations: [], 
      categoryStructure: {}, vibeTagsList: [] 
  });
  const [restingHours, setRestingHours] = useState(24);
  
  // UI States
  const [filterOpen, setFilterOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false); 
  const [newItem, setNewItem] = useState(defaultNewItem);
  const [isSaving, setIsSaving] = useState(false);

  // Image Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Filter Values
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
        const [bSnap, mSnap, pSnap, lSnap, cSnap, vSnap] = await Promise.all([
            getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/preferences`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/locations`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/categories`)),
            getDoc(doc(db, `users/${currentUser.uid}/settings/vibes`))
        ]);

        setDropdowns({
            brands: bSnap.exists() ? bSnap.data().list : [],
            materials: mSnap.exists() ? mSnap.data().list : [],
            locations: lSnap.exists() ? lSnap.data().list : [],
            categoryStructure: cSnap.exists() ? cSnap.data().structure : {},
            vibeTagsList: vSnap.exists() ? vSnap.data().list : ['Business', 'Casual', 'Shiny', 'Matte', 'Reinforced']
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
          setFilterCategory('All'); setFilterBrand('All'); setFilterStatus('All'); 
      }
  }, [locationRouter]);

  // Cleanup Preview URL
  useEffect(() => {
      return () => {
          if (imagePreview) URL.revokeObjectURL(imagePreview);
      }
  }, [imagePreview]);

  // --- IMAGE HANDLERS ---
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
      setImageFile(null);
      setImagePreview(null);
  };

  // --- SAVE NEW ITEM HANDLER ---
  const handleSaveItem = async () => {
      if (!newItem.brand || !newItem.mainCategory) {
          alert("Bitte mindestens Marke und Kategorie angeben.");
          return;
      }
      setIsSaving(true);
      try {
        let finalImageUrl = newItem.imageUrl; // Fallback auf existierenden Wert

        // 1. Upload Image if selected
        if (imageFile) {
            const storageRef = ref(storage, `users/${currentUser.uid}/items/${Date.now()}_${imageFile.name}`);
            const snapshot = await uploadBytes(storageRef, imageFile);
            finalImageUrl = await getDownloadURL(snapshot.ref);
        }

        // 2. Create Firestore Doc
        await addDoc(collection(db, `users/${currentUser.uid}/items`), {
            ...newItem,
            imageUrl: finalImageUrl,
            cost: parseFloat(newItem.cost) || 0,
            createdAt: serverTimestamp(),
            status: 'active',
            wearCount: 0,
            totalMinutes: 0,
            lastWorn: null
        });

        // 3. Reset
        setAddItemOpen(false);
        setNewItem(defaultNewItem);
        setImageFile(null);
        setImagePreview(null);

      } catch (e) {
          console.error(e);
          alert("Fehler beim Speichern: " + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  // --- FILTER LOGIC ---
  const getRecoveryInfo = (item) => {
      if (!item) return null;
      
      // Lockerer Kategorie-Check (Nylon, Strumpf, Tights...)
      const cat = (item.mainCategory || '').toLowerCase();
      const sub = (item.subCategory || '').toLowerCase();
      const isNylonRelated = cat.includes('nylon') || cat.includes('strumpf') || cat.includes('tights') || 
                             sub.includes('nylon') || sub.includes('strumpf') || sub.includes('tights');

      if (!isNylonRelated) return null;

      const lastWornDate = safeDate(item.lastWorn); 
      if (!lastWornDate) return null;
      
      const hoursSince = (new Date() - lastWornDate) / (1000 * 60 * 60);
      if (hoursSince < restingHours) {
          return { isResting: true, remaining: Math.ceil(restingHours - hoursSince) };
      }
      return null;
  };

  useEffect(() => {
    let res = [...items];
    if (scannedLocation) {
        res = res.filter(i => i.storageLocation && i.storageLocation.trim() === scannedLocation.trim());
    } else {
        if (filterStatus === 'active') {
            res = res.filter(i => (i.status === 'active' || !i.status));
        } else if (filterStatus !== 'All') {
            res = res.filter(i => i.status === filterStatus);
        }
    }
    if (filterCategory !== 'All') res = res.filter(i => i.mainCategory === filterCategory || i.category === filterCategory);
    if (filterBrand !== 'All') res = res.filter(i => i.brand === filterBrand);
    if (filterMaterial !== 'All') res = res.filter(i => i.material === filterMaterial); 
    if (filterMinRating > 0) res = res.filter(i => i.condition >= filterMinRating);
    
    // Sortierung mit Crash-Schutz
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
    <Container maxWidth="md" disableGutters sx={{ pt: 1, pb: 10 }}> 
      <motion.div initial="hidden" animate="show" variants={MOTION.listContainer}>
          
          {/* HEADER */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
                <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>Inventar ({filteredItems.length})</Typography>
                <Box>
                    <IconButton color="primary" onClick={startGlobalScan} disabled={nfcScanning}>
                        {nfcScanning ? <CircularProgress size={24} /> : <NfcIcon />}
                    </IconButton>
                    <IconButton onClick={() => setFilterOpen(true)}><FilterListIcon /></IconButton>
                </Box>
          </Box>

          {/* ACTIVE FILTERS */}
          <Box sx={{ mb: 2, px: 2, display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {scannedLocation && <Chip icon={<Inventory2Icon />} label={`Ort: ${scannedLocation}`} onDelete={() => { setScannedLocation(null); }} sx={DESIGN_TOKENS.chip.active}/>}
                {filterCategory !== 'All' && <Chip label={filterCategory} onDelete={() => setFilterCategory('All')} sx={DESIGN_TOKENS.chip.active} />}
                {filterBrand !== 'All' && <Chip label={filterBrand} onDelete={() => setFilterBrand('All')} sx={DESIGN_TOKENS.chip.active} />}
          </Box>

          {/* GRID */}
          <Grid container spacing={2} sx={{ px: 2 }}>
            {filteredItems.map((item) => {
            const recoveryInfo = getRecoveryInfo(item);
            const isResting = recoveryInfo?.isResting;
            const imgUrl = getImage(item);
            const catColors = getCategoryColor(item.mainCategory);
            const isWashing = item.status === 'washing';
            const isArchived = item.status === 'archived';

            let borderColor = catColors.border;
            let background = catColors.bg;
            let imgFilter = 'none';
            
            // --- ID CHIP STYLING LOGIC ---
            let idChipBg = 'rgba(0,0,0,0.6)';
            let idChipColor = 'white';

            if (isArchived) {
                // Roter Chip für Archiviert
                idChipBg = PALETTE.accents.red;
                
                // Card Styling für Archiviert
                borderColor = PALETTE.accents.red;
                background = 'rgba(20, 0, 0, 0.4)';
                imgFilter = 'grayscale(1)';
            } 
            else if (isWashing) {
                // Kräftiges Blau (#2979ff) für Wäsche statt Accent-Blue
                idChipBg = '#2979ff';

                // Card Styling für Wäsche
                borderColor = '#2979ff';
                background = `rgba(41, 121, 255, 0.1)`;
                imgFilter = 'grayscale(0.8)';
            }
            else if (isResting) {
                // Gelb/Gold (#ffc107) für Elasthan Recovery
                idChipBg = '#ffc107'; 
                idChipColor = 'black'; // Schwarze Schrift für Kontrast
            }
            
            return (
                <Grid item xs={6} sm={4} md={3} key={item.id} component={motion.div} variants={MOTION.listItem} layout>
                    <Card sx={{ 
                        height: '100%', display: 'flex', flexDirection: 'column',
                        ...DESIGN_TOKENS.glassCard, borderColor: borderColor, background: background,
                    }}>
                        <CardActionArea sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }} onClick={() => navigate('/item/' + item.id)}>
                        <Box sx={{ position: 'relative', pt: '100%', bgcolor: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                            {imgUrl ? (
                                <CardMedia component="img" image={imgUrl} alt={getDisplayName(item)} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: imgFilter }} />
                            ) : (<CheckroomIcon sx={{ position: 'absolute', top: '35%', left: '35%', fontSize: 40, opacity: 0.3 }} />)}
                            
                            {/* --- MODIFIED ID CHIP --- */}
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
                                        fontWeight: 'bold',
                                        height: '22px',      // Kleiner als Standard
                                        fontSize: '0.7rem',  // Kleinere Schrift
                                        '& .MuiChip-icon': { marginLeft: '4px' } 
                                    }} 
                                />
                            )}

                            {isWashing && <LocalLaundryServiceIcon sx={{ position: 'absolute', bottom: 8, right: 8, color: '#2979ff', filter: 'drop-shadow(0 0 4px black)' }} />}
                            {isResting && item.status === 'active' && (
                                <Tooltip title={`Erholung: noch ${recoveryInfo.remaining}h`}>
                                    <Chip icon={<SnoozeIcon style={{ fontSize: 16, color: '#fff' }} />} label={`${recoveryInfo.remaining}h`} size="small" sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', border: `1px solid ${PALETTE.secondary.main}`, backdropFilter: 'blur(4px)' }} />
                                </Tooltip>
                            )}
                        </Box>
                        <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold' }}>{getDisplayName(item)}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">{item.mainCategory}</Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                                <Chip label={item.brand} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, ...DESIGN_TOKENS.chip.default }} />
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
      
      {/* --- ADD ITEM DRAWER (Zentralisiertes Bottom Sheet) --- */}
      <Drawer 
        anchor="bottom" 
        open={addItemOpen} 
        onClose={() => setAddItemOpen(false)}
        PaperProps={DESIGN_TOKENS.bottomSheet}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon color="primary" />
                    <Typography variant="h6">Neues Item erfassen</Typography>
                </Box>
                <IconButton onClick={() => setAddItemOpen(false)}><CloseIcon /></IconButton>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                <Container maxWidth="sm" disableGutters>
                    
                    {/* IMAGE UPLOAD UI */}
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="raised-button-file"
                            type="file"
                            onChange={handleImageChange}
                        />
                        <label htmlFor="raised-button-file">
                            <Box sx={{
                                width: '100%',
                                height: 200,
                                borderRadius: 2,
                                border: `2px dashed ${imagePreview ? PALETTE.accents.green : PALETTE.primary.main}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                position: 'relative',
                                bgcolor: 'rgba(0,0,0,0.2)',
                                transition: 'all 0.2s',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                            }}>
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2 }}>
                                        <CloudUploadIcon sx={{ fontSize: 40, color: PALETTE.primary.main }} />
                                        <Typography variant="body2" color="text.secondary">
                                            Bild auswählen oder aufnehmen
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </label>
                        {imagePreview && (
                            <Button 
                                size="small" 
                                color="error" 
                                startIcon={<DeleteIcon />} 
                                onClick={handleRemoveImage} 
                                sx={{ mt: 1 }}
                            >
                                Bild entfernen
                            </Button>
                        )}
                    </Box>

                    <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                    
                    {/* REUSED ITEM GRID */}
                    <ItemInfoGrid 
                        isEditing={true}
                        formData={newItem}
                        setFormData={setNewItem}
                        dropdowns={dropdowns}
                        item={{}}
                    />
                </Container>
            </Box>

            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(0,0,0,0.4)' }}>
                <Button 
                    variant="contained" 
                    fullWidth 
                    size="large"
                    startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveItem}
                    disabled={isSaving}
                    sx={{ ...DESIGN_TOKENS.buttonGradient, height: 56 }}
                >
                    {isSaving ? "Lade hoch & Speichere..." : "Item Hinzufügen"}
                </Button>
            </Box>
        </Box>
      </Drawer>

      {/* --- FILTER DRAWER (VOLLSTÄNDIG) --- */}
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { bgcolor: '#121212', borderLeft: '1px solid #333' } }}>
        <Box sx={{ width: 280, p: 3, pt: 8, height: '100%', overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Filtern & Sortieren</Typography>
              <IconButton onClick={() => setFilterOpen(false)}><CloseIcon /></IconButton>
          </Box>
          
          <TextField select fullWidth size="small" margin="dense" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <MenuItem value="dateDesc">Neueste zuerst</MenuItem>
            <MenuItem value="priceDesc">Preis (Hoch {'>'} Niedrig)</MenuItem>
            <MenuItem value="conditionDesc">Zustand (Best)</MenuItem>
            <MenuItem value="nameAsc">Name A-Z</MenuItem>
          </TextField>

          <Typography variant="subtitle2" color="primary" sx={{ mt: 3, mb: 1 }}>Filter</Typography>
          
          <TextField select fullWidth label="Status" margin="dense" size="small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <MenuItem value="active">Verfügbar</MenuItem>
              <MenuItem value="All">Alle</MenuItem>
              <MenuItem value="washing">In der Wäsche</MenuItem>
              <MenuItem value="archived">Archiviert</MenuItem>
          </TextField>

          <TextField select fullWidth label="Kategorie" margin="dense" size="small" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <MenuItem value="All">Alle</MenuItem>
              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <TextField select fullWidth label="Marke" margin="dense" size="small" value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
              <MenuItem value="All">Alle Marken</MenuItem>
              {dropdowns.brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </TextField>

          <TextField select fullWidth label="Material" margin="dense" size="small" value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
              <MenuItem value="All">Alle Materialien</MenuItem>
              {dropdowns.materials.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>

          <Button variant="outlined" fullWidth sx={{ mt: 4 }} onClick={() => { setFilterStatus('active'); setFilterCategory('All'); setFilterBrand('All'); setFilterMaterial('All'); setFilterMinRating(0); setSortBy('dateDesc'); setScannedLocation(null); }}>
              Zurücksetzen
          </Button>
        </Box>
      </Drawer>

      <Fab color="primary" sx={{ position: 'fixed', bottom: 90, right: 20 }} onClick={() => setAddItemOpen(true)}>
        <AddIcon />
      </Fab>
    </Container>
  );
}