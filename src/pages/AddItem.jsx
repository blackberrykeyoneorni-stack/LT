import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
// NEU: Globaler NFC Context
import { useNFCGlobal } from '../contexts/NFCContext';
import { 
    Box, TextField, Button, Container, Typography, FormControl, InputLabel, 
    Select, MenuItem, Stack, Paper, Rating, InputAdornment, Chip, 
    OutlinedInput, CircularProgress, IconButton, Grid 
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import NfcIcon from '@mui/icons-material/Nfc';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';
import { loadVibeTags } from '../services/ItemService';
import { MAIN_CATEGORIES } from '../utils/constants';

export default function AddItem() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  // NEUE NFC LOGIK
  const { startBindingScan, isScanning: isNfcScanning, writeTag } = useNFCGlobal();
  const [scannedTagId, setScannedTagId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false); 

  // IMAGE STATES (Jetzt Arrays für Multi-Upload)
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    customId: '', // NEU: Manuelle ID
    brand: '',
    model: '',
    mainCategory: 'Nylons',
    subCategory: '',
    material: '',
    // color entfernt
    cost: '',
    condition: 5,
    location: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
    vibeTags: []
  });

  // Dropdown Lists State
  const [brands, setBrands] = useState([]);
  const [catStructure, setCatStructure] = useState({}); 
  const [materials, setMaterials] = useState([]);
  const [locations, setLocations] = useState([]);
  const [vibeTagsList, setVibeTagsList] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const loadLists = async () => {
        try {
            const [bSnap, cSnap, mSnap, lSnap] = await Promise.all([
                getDoc(doc(db, `users/${currentUser.uid}/settings/brands`)),
                getDoc(doc(db, `users/${currentUser.uid}/settings/categories`)),
                getDoc(doc(db, `users/${currentUser.uid}/settings/materials`)),
                getDoc(doc(db, `users/${currentUser.uid}/settings/locations`))
            ]);
            
            if (bSnap.exists()) setBrands(bSnap.data().list || []);
            if (cSnap.exists()) setCatStructure(cSnap.data().structure || {});
            if (mSnap.exists()) setMaterials(mSnap.data().list || []);
            if (lSnap.exists()) setLocations(lSnap.data().list || []);
            
            const tags = await loadVibeTags(currentUser.uid);
            setVibeTagsList(tags);
        } catch(e) {
            console.error("Listen konnten nicht geladen werden", e);
        } finally {
            setLoading(false);
        }
    };
    loadLists();
  }, [currentUser]);

  // LOGIK: Berechnet alle verfügbaren Hauptkategorien (Standard + Eigene)
  const availableMainCats = useMemo(() => {
      const customCats = Object.keys(catStructure);
      return [...new Set([...MAIN_CATEGORIES, ...customCats])].sort();
  }, [catStructure]);

  // LOGIK: Berechnet verfügbare Unterkategorien basierend auf der gewählten Hauptkategorie
  const availableSubCats = useMemo(() => {
      if (!formData.mainCategory) return [];
      return catStructure[formData.mainCategory] || [];
  }, [catStructure, formData.mainCategory]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // KORREKTUR: Wenn Hauptkategorie gewechselt wird, Unterkategorie leeren
    if (name === 'mainCategory') {
        setFormData(prev => ({ ...prev, [name]: value, subCategory: '' }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // HANDLE IMAGE SELECTION (MULTIPLE)
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));

      setImageFiles(prev => [...prev, ...newFiles]);
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
      setImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
      setImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // SCAN HANDLER
  const handleScanClick = () => {
      startBindingScan((id) => {
          setScannedTagId(id);
      });
  };

  const handleSave = async () => {
    if (!formData.name) { alert("Bitte mindestens einen Namen eingeben."); return; }
    
    setUploading(true);
    try {
        const uploadedImageUrls = [];

        // 1. UPLOAD IMAGES (Loop)
        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                const fileRef = ref(storage, `users/${currentUser.uid}/items/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                const url = await getDownloadURL(fileRef);
                uploadedImageUrls.push(url);
            }
        }

        // 2. NFC ID LOGIC (using local state)
        const finalNfcId = scannedTagId || null;

        // 3. SAVE TO FIRESTORE
        await addDoc(collection(db, `users/${currentUser.uid}/items`), {
            ...formData,
            cost: parseFloat(formData.cost) || 0,
            wearCount: 0,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // Speichere das erste Bild als Hauptbild (Thumbnail Logic), alle Bilder in 'images'
            imageUrl: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null, 
            images: uploadedImageUrls, 
            nfcTagId: finalNfcId,
            customId: formData.customId || finalNfcId // Nutze manuelle ID, Fallback auf Tag ID
        });

        // 4. WRITE NFC TAG OPTIONAL
        if (finalNfcId) {
             const confirmWrite = window.confirm("Soll die ID auf den NFC-Tag geschrieben werden?");
             if (confirmWrite) {
                 await writeTag(finalNfcId);
             }
        }

        navigate('/inventory');
    } catch (e) {
        console.error("Fehler beim Speichern:", e);
        alert("Fehler beim Speichern.");
    } finally {
        setUploading(false);
    }
  };

  if (loading) return <Box sx={{ display:'flex', justifyContent:'center', mt:10 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="sm" sx={{ pb: 10 }}>
        <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>
            Neues Item
        </Typography>

        <Paper sx={{ p: 3, mb: 3, ...DESIGN_TOKENS.glassCard }}>
            <Stack spacing={3}>
                
                {/* --- MULTI IMAGE UPLOAD SECTION --- */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {imagePreviews.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', py: 1 }}>
                            {imagePreviews.map((preview, index) => (
                                <Box key={index} sx={{ position: 'relative', minWidth: 100, width: 100, height: 100, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <img src={preview} alt={`Preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }} />
                                    <IconButton 
                                        onClick={() => handleRemoveImage(index)}
                                        size="small"
                                        sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover':{bgcolor:'rgba(0,0,0,0.8)'}, p: 0.5 }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                            {/* Add More Button in List */}
                            <Button
                                component="label"
                                sx={{ minWidth: 100, height: 100, border: '1px dashed rgba(255,255,255,0.3)', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <PhotoCamera />
                                <Typography variant="caption" sx={{ mt: 1 }}>+</Typography>
                                <input type="file" hidden accept="image/*" multiple onChange={handleImageChange} />
                            </Button>
                        </Box>
                    ) : (
                        <Button
                            variant="outlined"
                            component="label"
                            fullWidth
                            sx={{ height: 100, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)' }}
                            startIcon={<PhotoCamera sx={{ fontSize: 40 }} />}
                        >
                            Fotos hinzufügen (Multi)
                            <input type="file" hidden accept="image/*" multiple onChange={handleImageChange} />
                        </Button>
                    )}
                </Box>

                {/* NFC SECTION */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                    <NfcIcon sx={{ color: scannedTagId ? 'success.main' : 'text.secondary', fontSize: 40 }} />
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2">NFC Status</Typography>
                        <Typography variant="body2" color={scannedTagId ? 'success.light' : 'text.secondary'}>
                            {scannedTagId ? `Gescannt: ${scannedTagId}` : 'Nicht gescannt'}
                        </Typography>
                    </Box>
                    <Button variant="outlined" startIcon={<NfcIcon />} onClick={handleScanClick} disabled={isNfcScanning}>
                        {isNfcScanning ? 'Scan...' : 'Scan'}
                    </Button>
                </Box>

                {/* BASIC INFO */}
                <TextField label="Bezeichnung" name="name" fullWidth required value={formData.name} onChange={handleChange} />
                
                {/* NEU: Custom ID Feld */}
                <TextField 
                    label="Eigene ID" 
                    name="customId" 
                    fullWidth 
                    value={formData.customId} 
                    onChange={handleChange} 
                    placeholder="Optional (z.B. Panty_01)"
                    helperText="Wird für manuelle Eingabe verwendet"
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl fullWidth>
                        <InputLabel>Marke</InputLabel>
                        <Select name="brand" value={formData.brand} onChange={handleChange} label="Marke">
                            {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField label="Modell" name="model" fullWidth value={formData.model} onChange={handleChange} />
                </Box>

                {/* CATEGORIES */}
                <FormControl fullWidth>
                    <InputLabel>Hauptkategorie</InputLabel>
                    <Select name="mainCategory" value={formData.mainCategory} onChange={handleChange} label="Hauptkategorie">
                        {availableMainCats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl fullWidth>
                        <InputLabel>Sub-Kategorie</InputLabel>
                        <Select name="subCategory" value={formData.subCategory} onChange={handleChange} label="Sub-Kategorie">
                            {availableSubCats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Material</InputLabel>
                        <Select name="material" value={formData.material} onChange={handleChange} label="Material">
                            {materials.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                {/* DETAILS - Color entfernt, Cost und Location bleiben */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField 
                        label="Preis" name="cost" type="number" fullWidth 
                        InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
                        value={formData.cost} onChange={handleChange} 
                    />
                     <FormControl fullWidth>
                        <InputLabel>Lagerort</InputLabel>
                        <Select name="location" value={formData.location} onChange={handleChange} label="Lagerort">
                            {locations.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                <TextField 
                    label="Kaufdatum" name="purchaseDate" type="date" fullWidth 
                    InputLabelProps={{ shrink: true }}
                    value={formData.purchaseDate} onChange={handleChange} 
                />

                <Box sx={{ border: '1px solid rgba(255,255,255,0.23)', borderRadius: 1, p: 2 }}>
                    <Typography component="legend" variant="caption">Zustand</Typography>
                    <Rating 
                        name="condition" 
                        value={parseInt(formData.condition)} 
                        onChange={(event, newValue) => {
                            setFormData(prev => ({...prev, condition: newValue}));
                        }}
                    />
                </Box>

                <TextField label="Notizen" name="notes" multiline rows={3} fullWidth value={formData.notes} onChange={handleChange} />
                
                <FormControl fullWidth>
                    <InputLabel>Vibe Tags</InputLabel>
                    <Select
                        multiple
                        name="vibeTags"
                        value={formData.vibeTags}
                        onChange={handleChange}
                        input={<OutlinedInput label="Vibe Tags" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                    <Chip key={value} label={value} size="small" />
                                ))}
                            </Box>
                        )}
                    >
                        {vibeTagsList.map((tag) => (
                            <MenuItem key={tag} value={tag}>{tag}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Button 
                    variant="contained" 
                    size="large" 
                    startIcon={uploading ? <CircularProgress size={24} color="inherit" /> : <SaveIcon />} 
                    onClick={handleSave}
                    disabled={uploading}
                    sx={DESIGN_TOKENS.buttonGradient}
                >
                    {uploading ? 'Speichern...' : 'Speichern'}
                </Button>

            </Stack>
        </Paper>
    </Container>
  );
}
