import React from 'react';
import { Grid, Paper, Typography, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE, MOTION } from '../../theme/obsidianDesign';
import PsychologyIcon from '@mui/icons-material/Psychology'; 
import WarningIcon from '@mui/icons-material/Warning';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import Battery0BarIcon from '@mui/icons-material/Battery0Bar';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { DEEP_ANALYTICS_DEFINITIONS } from '../../utils/statsCalculator';

export default function DeepAnalyticsPanel({ deepAnalytics, onDefinitionClick }) {
    if (!deepAnalytics) return null;

    return (
        <motion.div variants={MOTION.listItem}>
            <Divider sx={{ my: 4, borderColor: PALETTE.background.glassBorder }} />
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: PALETTE.accents.purple, mb: 2 }}>
                <PsychologyIcon /> Deep Analytics (Psycho-Profil)
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                    <Paper 
                        onClick={() => onDefinitionClick(DEEP_ANALYTICS_DEFINITIONS['crisis'])}
                        sx={{ 
                            p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%', 
                            cursor: 'pointer', transition: 'all 0.2s ease-in-out',
                            '&:hover': { transform: 'translateY(-2px)', borderColor: PALETTE.accents.red } 
                        }}>
                        <WarningIcon sx={{ color: PALETTE.accents.red, mb: 1 }}/>
                        <Typography variant="h6" color="text.primary">{deepAnalytics.krisenPraediktion.day}</Typography>
                        <Typography variant="caption" color="error" display="block" sx={{ fontWeight: 'bold' }}>Risiko: {deepAnalytics.krisenPraediktion.level}</Typography>
                        <Typography variant="caption" color="text.secondary">Krisen-Prädiktion</Typography>
                    </Paper>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                    <Paper 
                        onClick={() => onDefinitionClick(DEEP_ANALYTICS_DEFINITIONS['adaption'])}
                        sx={{ 
                            p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%',
                            cursor: 'pointer', transition: 'all 0.2s ease-in-out',
                            '&:hover': { transform: 'translateY(-2px)', borderColor: PALETTE.accents.blue }
                        }}>
                        <NightlightRoundIcon sx={{ color: PALETTE.accents.blue, mb: 1 }}/>
                        <Typography variant="h6" color="text.primary">{deepAnalytics.unterbewussteAdaption.toFixed(1)}%</Typography>
                        <Typography variant="caption" sx={{ color: PALETTE.accents.blue, fontWeight: 'bold' }} display="block">Physische Assimilation</Typography>
                        <Typography variant="caption" color="text.secondary">Unterbewusste Adaption</Typography>
                    </Paper>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                    <Paper 
                        onClick={() => onDefinitionClick(DEEP_ANALYTICS_DEFINITIONS['depletion'])}
                        sx={{ 
                            p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%',
                            cursor: 'pointer', transition: 'all 0.2s ease-in-out',
                            '&:hover': { transform: 'translateY(-2px)', borderColor: PALETTE.accents.gold }
                        }}>
                        <Battery0BarIcon sx={{ color: PALETTE.accents.gold, mb: 1 }}/>
                        <Typography variant="h6" color="text.primary">{deepAnalytics.egoDepletionHours > 0 ? deepAnalytics.egoDepletionHours.toFixed(1) : '-'} h</Typography>
                        <Typography variant="caption" sx={{ color: PALETTE.accents.gold, fontWeight: 'bold' }} display="block">Kritischer Brechpunkt</Typography>
                        <Typography variant="caption" color="text.secondary">Ego-Depletion</Typography>
                    </Paper>
                </Grid>

                <Grid item xs={6} sm={3}>
                    <Paper 
                        onClick={() => onDefinitionClick(DEEP_ANALYTICS_DEFINITIONS['infiltration'])}
                        sx={{ 
                            p: 2, ...DESIGN_TOKENS.glassCard, textAlign: 'center', height: '100%',
                            cursor: 'pointer', transition: 'all 0.2s ease-in-out',
                            '&:hover': { transform: 'translateY(-2px)', borderColor: PALETTE.accents.pink }
                        }}>
                        <VisibilityOffIcon sx={{ color: PALETTE.accents.pink, mb: 1 }}/>
                        <Typography variant="h6" color="text.primary">{deepAnalytics.infiltrationEskalation.toFixed(1)}%</Typography>
                        <Typography variant="caption" sx={{ color: PALETTE.accents.pink, fontWeight: 'bold' }} display="block">Komplexe Tages-Dessous</Typography>
                        <Typography variant="caption" color="text.secondary">Infiltrations-Eskalation</Typography>
                    </Paper>
                </Grid>
            </Grid>
        </motion.div>
    );
}