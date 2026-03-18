import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { DESIGN_TOKENS, PALETTE, MOTION } from '../../theme/obsidianDesign';
import { Icons } from '../../theme/appIcons';

import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed'; 
import TimerIcon from '@mui/icons-material/Timer';
import SecurityIcon from '@mui/icons-material/Security';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'; 
import ShieldIcon from '@mui/icons-material/Shield'; 
import PsychologyIcon from '@mui/icons-material/Psychology'; 

export default function CoreMetricsGrid({ coreMetrics, onCardClick }) {
    if (!coreMetrics) return null;

    const metrics = [
        { id: 'nylonEnclosure', title: 'Nylon Enclosure', val: `${coreMetrics.nylonEnclosure}%`, sub: 'Tragezeit-Anteil', icon: Icons.Layers, color: PALETTE.accents.pink },
        { id: 'nocturnal', title: 'Nocturnal', val: `${coreMetrics.nocturnal}%`, sub: 'Nacht-Quote', icon: Icons.Night, color: PALETTE.accents.purple },
        { id: 'nylonGap', title: 'Nylon Gap', val: coreMetrics.nylonGap, sub: 'Ø Lücke/Tag', icon: HourglassEmptyIcon, color: '#00e5ff' },
        { id: 'cpnh', title: 'CPNH', val: `${coreMetrics.cpnh}€`, sub: 'Cost/Hour', icon: TrendingUpIcon, color: PALETTE.accents.green },
        { id: 'compliance', title: 'Compliance Lag', val: coreMetrics.complianceLag, sub: 'Ø Verzögerung', icon: TimerIcon, color: PALETTE.accents.red },
        { id: 'coverage', title: 'Coverage', val: `${coreMetrics.coverage}%`, sub: 'Abdeckung (7d)', icon: ShieldIcon, color: PALETTE.primary.main },
        { id: 'resistance', title: 'Resistance', val: `${coreMetrics.resistance}%`, sub: 'Straf-Quote', icon: SecurityIcon, color: PALETTE.accents.gold },
        { id: 'voluntarism', title: 'Voluntarism', val: coreMetrics.voluntarism, sub: 'Zeit-Verhältnis', icon: PsychologyIcon, color: PALETTE.accents.blue },
        { id: 'endurance', title: 'Endurance', val: coreMetrics.endurance, sub: `Nyl: ${coreMetrics.enduranceNylon} • Des: ${coreMetrics.enduranceDessous}`, icon: SpeedIcon, color: PALETTE.text.secondary },
    ];

    return (
        <Grid container spacing={2} sx={{ mb: 4 }}>
            {metrics.map((m) => (
                <Grid item xs={6} sm={3} key={m.id}>
                    <motion.div variants={MOTION.listItem} style={{ height: '100%' }}>
                        <Card 
                            onClick={() => onCardClick(m.id, m.title)}
                            sx={{ 
                                height: '100%', 
                                ...DESIGN_TOKENS.glassCard,
                                borderColor: `1px solid ${m.color}40`,
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'translateY(-2px)', borderColor: m.color }
                            }}
                        >
                            <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                <m.icon sx={{ color: m.color, fontSize: 28, mb: 1 }} />
                                <Typography variant="h5" fontWeight="bold" sx={{ color: PALETTE.text.primary, fontSize: '1.1rem' }}>{m.val}</Typography>
                                <Typography variant="caption" sx={{ color: m.color, display:'block', fontWeight:'bold', textTransform:'uppercase', fontSize:'0.65rem' }}>{m.title}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize:'0.6rem' }}>{m.sub}</Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>
            ))}
        </Grid>
    );
}