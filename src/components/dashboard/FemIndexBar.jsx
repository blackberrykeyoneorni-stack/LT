import React, { useState } from 'react';
import { 
    Box, 
    Typography, 
    LinearProgress, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider,
    Paper,
    Stack
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WaterDropIcon from '@mui/icons-material/WaterDrop'; // Für Infiltration/Fluidity
import { useFemIndex } from '../../hooks/dashboard/useFemIndex';

export default function FemIndexBar() {
    const { femIndex, details, loading } = useFemIndex();
    const [open, setOpen] = useState(false);

    // Farbe basierend auf Index (wie im Original-Konzept: Rot -> Gold -> Grün)
    const getColor = (value) => {
        if (value < 30) return PALETTE.accents.red;
        if (value < 70) return PALETTE.accents.gold;
        return PALETTE.accents.green;
    };

    const currentColor = getColor(femIndex);

    const handleClick = () => {
        setOpen(true);
    };

    // Icons für die Sub-Scores
    const getIconForLabel = (label) => {
        if (label.includes('Physis')) return <CheckCircleIcon sx={{ color: '#00e5ff', fontSize: 20 }} />;
        if (label.includes('Psyche')) return <PsychologyIcon sx={{ color: '#ffeb3b', fontSize: 20 }} />;
        if (label.includes('Infiltration')) return <WaterDropIcon sx={{ color: '#f50057', fontSize: 20 }} />;
        return <AnalyticsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />;
    };
    
    // Farbe für Sub-Scores (Hardcoded passend zu den Icons im Dashboard)
    const getColorForLabel = (label) => {
        if (label.includes('Physis')) return '#00e5ff';
        if (label.includes('Psyche')) return '#ffeb3b';
        if (label.includes('Infiltration')) return '#f50057';
        return 'text.primary';
    };

    if (loading) return null;

    return (
        <>
            {/* Klickbarer Container */}
            <Box 
                onClick={handleClick}
                sx={{ 
                    width: '100%', 
                    mb: 2, 
                    cursor: 'pointer',
                    position: 'relative',
                    '&:hover': { opacity: 0.9 }
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    {/* HIER: Schrift exakt wie "TAGESZIEL" im ProgressBar (body2, secondary, bold) */}
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            color: 'text.secondary', 
                            fontWeight: 'bold',
                            textTransform: 'uppercase', // "TAGESZIEL" ist uppercase
                            letterSpacing: 1 // Matching ProgressBar spacing
                        }}
                    >
                        FEM-INDEX
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: currentColor }}>
                            {femIndex}%
                        </Typography>
                        <InfoIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    </Box>
                </Box>

                <LinearProgress 
                    variant="determinate" 
                    value={femIndex} 
                    sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: currentColor,
                            borderRadius: 4,
                            boxShadow: `0 0 8px ${currentColor}40` // Leichter Glow
                        }
                    }} 
                />
            </Box>

            {/* OVERLAY: Detaillierte Berechnung */}
            <Dialog 
                open={open} 
                onClose={() => setOpen(false)}
                PaperProps={{ 
                    sx: DESIGN_TOKENS.dialog?.paper?.sx || { borderRadius: '20px', bgcolor: '#1e1e1e', p: 1 }
                }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AnalyticsIcon color="primary" />
                        <Typography variant="h6">Index Analyse</Typography>
                    </Box>
                    <IconButton onClick={() => setOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Typography variant="h2" sx={{ fontWeight: 'bold', color: currentColor, textShadow: `0 0 20px ${currentColor}40` }}>
                            {femIndex}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 2 }}>
                            GESAMT SCORE
                        </Typography>
                    </Box>
                    
                    <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />

                    <Stack spacing={2} sx={{ mt: 2 }}>
                        {details.components.map((comp, index) => (
                            <Paper 
                                key={index} 
                                variant="outlined" 
                                sx={{ 
                                    p: 1.5, 
                                    bgcolor: 'rgba(255,255,255,0.02)', 
                                    borderColor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 2
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getIconForLabel(comp.label)}
                                        <Typography variant="body2" fontWeight="bold">
                                            {comp.label.split('(')[0].trim()}
                                        </Typography>
                                    </Box>
                                    <Typography 
                                        variant="h6" 
                                        fontWeight="bold"
                                        sx={{ color: getColorForLabel(comp.label) }}
                                    >
                                        {comp.value}%
                                    </Typography>
                                </Box>
                                
                                <LinearProgress 
                                    variant="determinate" 
                                    value={comp.value} 
                                    sx={{ 
                                        height: 4, 
                                        borderRadius: 2, 
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                        '& .MuiLinearProgress-bar': { bgcolor: getColorForLabel(comp.label) }
                                    }} 
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    {comp.description}
                                </Typography>
                            </Paper>
                        ))}
                    </Stack>
                </DialogContent>
            </Dialog>
        </>
    );
}