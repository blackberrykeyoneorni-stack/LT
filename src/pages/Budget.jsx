import React, { useState, useEffect } from 'react';
import { 
    Container, Typography, Paper, Box, Stack, LinearProgress, 
    Button, TextField, IconButton, Avatar, Dialog, DialogTitle, 
    DialogContent, DialogActions, Chip 
} from '@mui/material';
import { 
    collection, doc, getDoc, setDoc, query, where, getDocs, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DESIGN_TOKENS, PALETTE } from '../theme/obsidianDesign';

import WarningIcon from '@mui/icons-material/Warning';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function Budget() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    
    // Budget State
    const [budgetSettings, setBudgetSettings] = useState({ monthlyLimit: 100, currentSpent: 0 });
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempLimit, setTempLimit] = useState(100);

    // Lists
    const [wishlist, setWishlist] = useState([]);
    const [replacements, setReplacements] = useState([]);

    useEffect(() => {
        if (!currentUser) return;
        fetchData();
    }, [currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const settingsRef = doc(db, `users/${currentUser.uid}/settings/budget`);
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                setBudgetSettings(settingsSnap.data());
                setTempLimit(settingsSnap.data().monthlyLimit);
            } else {
                await setDoc(settingsRef, { monthlyLimit: 100, currentSpent: 0 });
            }

            const wishQ = query(collection(db, `users/${currentUser.uid}/wishlist`), orderBy('createdAt', 'desc'));
            const wishSnap = await getDocs(wishQ);
            setWishlist(wishSnap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(),
                cost: d.data().estimatedCost || d.data().cost || d.data().price || 0 
            })));

            const itemsRef = collection(db, `users/${currentUser.uid}/items`);
            const wornOutQ = query(itemsRef, where('condition', '<=', 2), where('status', '==', 'active'));
            const wornSnap = await getDocs(wornOutQ);
            setReplacements(wornSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        } catch (error) {
            console.error("Fehler beim Laden:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateBudget = async () => {
        const newSettings = { ...budgetSettings, monthlyLimit: parseFloat(tempLimit) };
        await setDoc(doc(db, `users/${currentUser.uid}/settings/budget`), newSettings);
        setBudgetSettings(newSettings);
        setIsEditingBudget(false);
    };

    const resetMonth = async () => {
        if(window.confirm("Neuen Monat starten? Ausgaben werden auf 0 gesetzt.")){
            const newSettings = { ...budgetSettings, currentSpent: 0 };
            await setDoc(doc(db, `users/${currentUser.uid}/settings/budget`), newSettings);
            setBudgetSettings(newSettings);
        }
    };

    const remaining = budgetSettings.monthlyLimit - (budgetSettings.currentSpent || 0);
    const progress = Math.min(((budgetSettings.currentSpent || 0) / budgetSettings.monthlyLimit) * 100, 100);
    
    const affordableWishes = wishlist.filter(w => w.cost > 0 && w.cost <= remaining);
    const expensiveWishes = wishlist.filter(w => w.cost > remaining || w.cost === 0);

    return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="sm" sx={{ pt: 2 }}>
                <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>
                    Budget
                </Typography>

                {/* 1. FINANCIAL OVERVIEW */}
                <Paper sx={{ p: 3, mb: 3, ...DESIGN_TOKENS.glassCard, textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">VERFÜGBAR</Typography>
                    <Typography variant="h2" sx={{ fontWeight: 'bold', color: remaining < 0 ? PALETTE.accents.red : '#fff', my: 1 }}>
                        {remaining.toFixed(2)} €
                    </Typography>
                    <LinearProgress 
                        variant="determinate" value={progress} 
                        sx={{ 
                            height: 8, borderRadius: 4, mb: 1, 
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: progress > 90 ? PALETTE.accents.red : PALETTE.accents.green
                            }
                        }}
                    />
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: PALETTE.text.secondary }}>Ausgegeben: {budgetSettings.currentSpent?.toFixed(2)}€</Typography>
                        <Typography variant="caption" sx={{ color: PALETTE.text.secondary }}>Limit: {budgetSettings.monthlyLimit?.toFixed(2)}€</Typography>
                    </Stack>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button size="small" sx={DESIGN_TOKENS.buttonSecondary} onClick={() => setIsEditingBudget(true)}>Limit ändern</Button>
                        <Button size="small" variant="outlined" color="warning" onClick={resetMonth}>Reset</Button>
                    </Stack>
                </Paper>

                {/* 2. REPLACEMENTS */}
                {replacements.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" sx={{ display:'flex', alignItems:'center', gap:1, mb: 1, color: PALETTE.accents.gold }}>
                            <WarningIcon fontSize="small" /> Ersatz notwendig
                        </Typography>
                        <Stack spacing={1}>
                            {replacements.map(item => (
                                <Paper key={item.id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: `${PALETTE.accents.gold}15`, border: `1px solid ${PALETTE.accents.gold}40` }}>
                                    <Avatar src={item.imageUrl} variant="rounded" sx={{ width: 40, height: 40, bgcolor: 'transparent' }}>!</Avatar>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2" fontWeight="bold">{item.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">Zustand: {item.condition}/5</Typography>
                                    </Box>
                                    <Chip label="Kaufen" sx={{ bgcolor: PALETTE.accents.gold, color: 'black', fontWeight: 'bold' }} size="small" onClick={() => window.open(`https://www.google.com/search?q=${item.brand}+${item.model}`, '_blank')} />
                                </Paper>
                            ))}
                        </Stack>
                    </Box>
                )}

                {/* 3. WISHLIST ANALYSIS */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display:'flex', alignItems:'center', gap:1 }}>
                        <ShoppingCartIcon fontSize="small" sx={{ color: PALETTE.primary.main }} /> Empfehlungen
                    </Typography>
                    <Button endIcon={<ArrowForwardIcon />} onClick={() => navigate('/wishlist')} color="inherit">
                        Zur Wishlist
                    </Button>
                </Box>

                {affordableWishes.length > 0 ? (
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        {affordableWishes.map(wish => (
                            <Paper key={wish.id} sx={{ p: 2, ...DESIGN_TOKENS.glassCard, borderLeft: `4px solid ${PALETTE.accents.green}` }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Typography variant="subtitle1">{wish.name}</Typography>
                                        <Typography variant="caption" sx={{ color: PALETTE.accents.green }}>Im Budget! ({wish.cost} €)</Typography>
                                    </Box>
                                    <CheckCircleIcon sx={{ color: PALETTE.accents.green }} />
                                </Box>
                            </Paper>
                        ))}
                    </Stack>
                ) : (
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Keine Wünsche passen aktuell in das verbleibende Budget.
                    </Typography>
                )}

                {expensiveWishes.length > 0 && (
                    <>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                            Sparen für:
                        </Typography>
                        <Stack spacing={1}>
                            {expensiveWishes.map(wish => (
                                <Paper key={wish.id} sx={{ p: 1.5, opacity: 0.6, bgcolor: PALETTE.background.lightGlass, border: `1px solid ${PALETTE.background.glassBorder}` }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2">{wish.name}</Typography>
                                        <Typography variant="body2">{wish.cost > 0 ? `${wish.cost} €` : 'Preis ?'}</Typography>
                                    </Box>
                                </Paper>
                            ))}
                        </Stack>
                    </>
                )}

                {/* BUDGET DIALOG */}
                <Dialog open={isEditingBudget} onClose={() => setIsEditingBudget(false)} PaperProps={DESIGN_TOKENS.dialog.paper}>
                    <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Monatslimit setzen</DialogTitle>
                    <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                        <TextField 
                            autoFocus margin="dense" label="Betrag in €" type="number" fullWidth 
                            value={tempLimit} onChange={(e) => setTempLimit(e.target.value)}
                            sx={{ mt: 1, ...DESIGN_TOKENS.inputField }}
                        />
                    </DialogContent>
                    <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                        <Button onClick={() => setIsEditingBudget(false)} color="inherit">Abbrechen</Button>
                        <Button onClick={handleUpdateBudget} variant="contained" sx={DESIGN_TOKENS.buttonGradient}>Speichern</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}