import React, { useState } from 'react';
import { 
    Box, 
    Typography, 
    LinearProgress, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    IconButton,
    Paper,
    Stack,
    Divider
} from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import CloseIcon from '@mui/icons-material/Close';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WaterDropIcon from '@mui/icons-material/WaterDrop'; 
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import { useFemIndex } from '../../hooks/dashboard/useFemIndex';

export default function FemIndexBar() {
    const { femIndex, details, loading } = useFemIndex();
    const [open, setOpen] = useState(false);

    // Farblogik: Rot (kritisch) -> Gold (ok) -> Grün (gut)
    const getColor = (value) => {
        if (value < 30) return PALETTE.accents.red;
        if (value < 70) return PALETTE.accents.gold;
        return PALETTE.accents.green; // oder '#00E676' passend zum ProgressBar Success
    };

    const currentColor = getColor(femIndex);

    const getTrendIcon = (trend) => {
        if (trend === 'rising') return <TrendingUpIcon fontSize="small" />;
        if (trend === 'falling') return <TrendingDownIcon fontSize="small" />;
        return <TrendingFlatIcon fontSize="small" />;
    };

    // Sub-Komponenten Icons
    const getIconForLabel = (label) => {
        if (label.includes('Physis')) return <CheckCircleIcon sx={{ color: '#00e5ff', fontSize: 20 }} />;
        if (label.includes('Psyche')) return <PsychologyIcon sx={{ color: '#ffeb3b', fontSize: 20 }} />;
        if (label.includes('Infiltration')) return <WaterDropIcon sx={{ color: '#f50057', fontSize: 20 }} />;
        return <AnalyticsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />;
    };
    
    const getColorForLabel = (label) => {
        if (label.includes('Physis')) return '#00e5ff';
        if (label.includes('Psyche')) return '#ffeb3b';
        if (label.includes('Infiltration')) return '#f50057';
        return 'text.primary';
    };

    if (loading) return null;

    return (
        <>
            {/* HAUPT-KOMPONENTE im ProgressBar Look */}
            <Paper 
                elevation={0}
                onClick={() => setOpen(true)}
                sx={{ 
                    p: 2.5, 
                    mb: 3, 
                    borderRadius: '16px',
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    border: `1px solid rgba(255,255,255,0.05)`,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, transform 0.1s',
                    '&:hover': {
                        borderColor: `${currentColor}40`,
                        bgcolor: 'rgba(255,255,255,0.07)'
                    },
                    '&:active': {
                        transform: 'scale(0.99)'
                    }
                }}
            >
                {/* Header Zeile: Titel und Wert */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', letterSpacing: 1, fontWeight: 'bold' }}>
                        FEM-INDEX
                    </Typography>
                    
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1, color: currentColor }}>
                            {femIndex}%
                        </Typography>
                    </Box>
                </Box>

                {/* Der Balken */}
                <LinearProgress 
                    variant="determinate" 
                    value={femIndex} 
                    sx={{ 
                        height: 12, 
                        borderRadius: 6,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        mb: 1.5,
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: currentColor,
                            borderRadius: 6,
                            boxShadow: `0 0 10px ${currentColor}40`
                        }
                    }}
                />

                {/* Footer Zeile: Status Text und Indikatoren */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: currentColor }}>
                        {getTrendIcon(details.trend || 'stable')}
                        <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {femIndex >= 70 ? "OPTIMIERT" : (femIndex < 30 ? "KRITISCH" : "STABIL")}
                        </Typography>
                    </Box>

                    {/* Kleine Icons rechts, um Physis/Psyche/Infiltration anzudeuten */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.7 }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#00e5ff' }} />
                        <PsychologyIcon sx={{ fontSize: 16, color: '#ffeb3b' }} />
                        <WaterDropIcon sx={{ fontSize: 16, color: '#f50057' }} />
                    </Stack>
                </Box>
            </Paper>


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
                            COMPOSITE SCORE
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