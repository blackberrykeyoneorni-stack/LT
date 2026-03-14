import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Box, Typography, IconButton, Container, Button, CircularProgress, Divider, InputBase } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import ItemInfoGrid from '../item-detail/ItemInfoGrid';

const defaultNewItem = {
    name: '', brand: '', model: '', mainCategory: 'Nylons', subCategory: '',
    material: '', color: '', cost: '', condition: 5, suitablePeriod: 'Beide',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '', location: '', imageUrl: '', customId: ''
};

export default function AddItemDrawer({ open, onClose, dropdowns }) {
    const { currentUser } = useAuth();
    const [newItem, setNewItem] = useState(defaultNewItem);
    const [isSaving, setIsSaving] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    // Cleanup Preview URL
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        }
    }, [imagePreview]);

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = (e) => {
        e.stopPropagation();
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSaveItem = async () => {
        if (!newItem.brand || !newItem.mainCategory) {
            alert("Bitte mindestens Marke und Kategorie angeben.");
            return;
        }
        setIsSaving(true);
        try {
            let finalImageUrl = newItem.imageUrl;

            if (imageFile) {
                const storageRef = ref(storage, `users/${currentUser.uid}/items/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                finalImageUrl = await getDownloadURL(snapshot.ref);
            }

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

            onClose();
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

    return (
        <Drawer 
            anchor="bottom" 
            open={open} 
            onClose={onClose}
            disableEnforceFocus
            disableScrollLock
            PaperProps={DESIGN_TOKENS.bottomSheet}
        >
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 0, 127, 0.2)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AddIcon sx={{ color: PALETTE.primary.main }} />
                        <Typography variant="h6" sx={{ color: PALETTE.primary.main, textTransform: 'uppercase', fontWeight: 800 }}>Neues Item erfassen</Typography>
                    </Box>
                    <IconButton onClick={onClose} sx={{ color: PALETTE.text.primary }}><CloseIcon /></IconButton>
                </Box>

                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                    <Container maxWidth="sm" disableGutters>
                        
                        <Box sx={{ mb: 3, textAlign: 'center' }}>
                            {/* Verstecktes Input-Feld, angesteuert per useRef, umgeht den Focus-Trap */}
                            <Box 
                                sx={{
                                    width: '100%', height: 200, borderRadius: 4,
                                    border: `2px dashed ${imagePreview ? PALETTE.accents.green : PALETTE.primary.main}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', position: 'relative', bgcolor: 'rgba(0,0,0,0.4)',
                                    transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,0,127,0.1)' }
                                }}
                            >
                                <input 
                                    accept="image/*" 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImageChange} 
                                    style={{ 
                                        position: 'absolute', 
                                        top: 0, 
                                        left: 0, 
                                        width: '100%', 
                                        height: '100%', 
                                        opacity: 0, 
                                        zIndex: 2, 
                                        cursor: 'pointer' 
                                    }} 
                                />
                                
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1 }} />
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2, position: 'relative', zIndex: 1 }}>
                                        <CloudUploadIcon sx={{ fontSize: 40, color: PALETTE.primary.main }} />
                                        <Typography variant="body2" sx={{ color: PALETTE.text.secondary, textTransform: 'uppercase' }}>Bild hochladen</Typography>
                                    </Box>
                                )}
                            </Box>
                            
                            {imagePreview && (
                                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={handleRemoveImage} sx={{ mt: 1 }}>Bild entfernen</Button>
                            )}
                        </Box>

                        <Divider sx={{ mb: 3, borderColor: 'rgba(255, 0, 127, 0.1)' }} />
                        
                        <ItemInfoGrid isEditing={true} formData={newItem} setFormData={setNewItem} dropdowns={dropdowns} item={{}} />
                    </Container>
                </Box>

                <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 0, 127, 0.2)', bgcolor: 'rgba(0,0,0,0.6)' }}>
                    <Button 
                        variant="contained" fullWidth size="large"
                        startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        onClick={handleSaveItem} disabled={isSaving}
                        sx={{ ...DESIGN_TOKENS.buttonGradient, height: 56, borderRadius: '9999px' }}
                    >
                        {isSaving ? "Speichere..." : "Item Hinzufügen"}
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
}