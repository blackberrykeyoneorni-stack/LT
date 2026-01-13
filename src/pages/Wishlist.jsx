import React, { useState, useEffect } from 'react';
import { 
    Container, Typography, Paper, Box, Stack, 
    Button, IconButton, Dialog, DialogTitle, DialogContent, 
    DialogActions, TextField, InputAdornment, Chip, CircularProgress 
} from '@mui/material';
import { 
    collection, addDoc, deleteDoc, doc, query, orderBy, 
    onSnapshot, serverTimestamp, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SavingsIcon from '@mui/icons-material/Savings';

export default function Wishlist() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [wishes, setWishes] = useState([]);
    const [budgetState, setBudgetState] = useState({ limit: 0, spent: 0 });
    
    const [openDialog, setOpenDialog] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: '', priority: 'medium' });

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, `users/${currentUser.uid}/wishlist`), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id, ...doc.data(),
                price: parseFloat(doc.data().price) || parseFloat(doc.data().estimatedCost) || 0
            }));
            setWishes(list);
            setLoading(false);
        });

        const loadBudget = async () => {
            try {
                const docRef = doc(db, `users/${currentUser.uid}/settings/budget`);
                const snap = await getDoc(docRef);
                if (snap.exists()) setBudgetState({ limit: snap.data().monthlyLimit || 0, spent: snap.data().currentSpent || 0 });
            } catch(e) { console.error(e); }
        };
        loadBudget();
        return () => unsubscribe();
    }, [currentUser]);

    const handleAddItem = async () => {
        if (!newItem.name) return;
        try {
            await addDoc(collection(db, `users/${currentUser.uid}/wishlist`), {
                name: newItem.name, price: parseFloat(newItem.price) || 0, priority: newItem.priority, createdAt: serverTimestamp()
            });
            setOpenDialog(false); setNewItem({ name: '', price: '', priority: 'medium' });
        } catch (error) { console.error(error); }
    };

    const handleDelete = async (id) => { if (window.confirm("Löschen?")) await deleteDoc(doc(db, `users/${currentUser.uid}/wishlist`, id)); };

    const available = budgetState.limit - budgetState.spent;
    if (loading) return <Box sx={{ display:'flex', justifyContent:'center', mt: 10 }}><CircularProgress /></Box>;

    return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="sm" sx={{ pt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>Wishlist</Typography>
                    <Chip 
                        icon={<SavingsIcon />} 
                        label={`${available.toFixed(2)} €`} 
                        sx={{ bgcolor: available > 0 ? `${PALETTE.accents.green}22` : `${PALETTE.accents.red}22`, color: available > 0 ? PALETTE.accents.green : PALETTE.accents.red, border: `1px solid ${available > 0 ? PALETTE.accents.green : PALETTE.accents.red}` }} 
                    />
                </Box>

                <Stack spacing={2}>
                    {wishes.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" align="center" sx={{ mt: 5 }}>Leer.</Typography>
                    ) : (
                        wishes.map(wish => {
                            const isAffordable = available >= wish.price;
                            return (
                                <Paper key={wish.id} sx={{ 
                                    p: 2, ...DESIGN_TOKENS.glassCard,
                                    borderLeft: isAffordable ? `4px solid ${PALETTE.accents.green}` : '4px solid transparent',
                                    opacity: isAffordable ? 1 : 0.7
                                }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{wish.name}</Typography>
                                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
                                                <Chip label={`${wish.price.toFixed(2)} €`} size="small" 
                                                    sx={isAffordable ? { bgcolor: PALETTE.accents.green, color: 'black', fontWeight: 'bold' } : DESIGN_TOKENS.chip.default} 
                                                />
                                                {isAffordable && (
                                                    <Typography variant="caption" sx={{ color: PALETTE.accents.green, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <CheckCircleIcon fontSize="inherit" /> Machbar
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Box>
                                        <IconButton size="small" onClick={() => handleDelete(wish.id)} sx={{ color: PALETTE.accents.red }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            );
                        })
                    )}
                </Stack>

                <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}
                    sx={{ position: 'fixed', bottom: 90, right: 20, borderRadius: 8, px: 3, ...DESIGN_TOKENS.buttonGradient }}>
                    Wunsch
                </Button>

                <Dialog open={openDialog} onClose={() => setOpenDialog(false)} PaperProps={DESIGN_TOKENS.dialog.paper} fullWidth>
                    <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Neuer Wunsch</DialogTitle>
                    <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField label="Name" fullWidth autoFocus value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} sx={DESIGN_TOKENS.inputField} />
                            <TextField label="Preis" type="number" fullWidth InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }} value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} sx={DESIGN_TOKENS.inputField} />
                            <TextField select label="Priorität" fullWidth SelectProps={{ native: true }} value={newItem.priority} onChange={(e) => setNewItem({...newItem, priority: e.target.value})} sx={DESIGN_TOKENS.inputField}>
                                <option value="high">Hoch</option><option value="medium">Mittel</option><option value="low">Niedrig</option>
                            </TextField>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                        <Button onClick={() => setOpenDialog(false)} color="inherit">Abbrechen</Button>
                        <Button onClick={handleAddItem} variant="contained" disabled={!newItem.name} sx={DESIGN_TOKENS.buttonGradient}>Hinzufügen</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}