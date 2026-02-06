import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Stack, Tooltip } from '@mui/material';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';
import { motion } from 'framer-motion';

// Icons für die Säulen
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'; // Physis
import PsychologyIcon from '@mui/icons-material/Psychology'; // Psyche
import GridViewIcon from '@mui/icons-material/GridView'; // Infiltration (Alltag)

const PhaseIndicator = ({ score, phase }) => (
    <Box sx={{ position: 'relative', width: '100%', mt: 1, mb: 3 }}>
        {/* HINTERGRUND TRACK */}
        <Box sx={{ 
            height: 12, 
            borderRadius: 6, 
            bgcolor: 'rgba(255,255,255,0.1)', 
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
        }}>
            <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${score}%` }} 
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ 
                    height: '100%', 
                    background: `linear-gradient(90deg, #1a1a1a 0%, ${phase.color} 100%)`,
                    borderRadius: 6,
                    boxShadow: `0 0 15px ${phase.color}80`
                }} 
            />
        </Box>
        
        {/* PHASE LABEL */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" sx={{ color: phase.color, fontWeight: 'bold', letterSpacing: 1.5 }}>
                PHASE: {phase.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {score} / 100
            </Typography>
        </Box>
    </Box>
);

const DnaStrand = ({ label, value, icon, color, delay }) => (
    <Tooltip title={`${label}: ${Math.round(value)}%`}>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delay, duration: 0.5 }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5, color: color }}>
                    {icon}
                </Box>
                <LinearProgress 
                    variant="determinate" 
                    value={value} 
                    sx={{ 
                        height: 4, 
                        borderRadius: 2, 
                        bgcolor: 'rgba(255,255,255,0.05)', 
                        mb: 0.5,
                        '& .MuiLinearProgress-bar': { bgcolor: color } 
                    }} 
                />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                    {label}
                </Typography>
            </motion.div>
        </Box>
    </Tooltip>
);

export default function FemIndexBar({ femIndex, loading, phase, subScores }) {
  // Fallbacks falls Hooks noch laden
  const safeScore = femIndex || 0;
  const safePhase = phase || { name: "INIT", color: "#333", desc: "Lade..." };
  const safeSubs = subScores || { physis: 0, psyche: 0, infiltration: 0 };

  if (loading) return <LinearProgress color="secondary" sx={{ my: 2 }} />;

  return (
    <Card sx={{ ...DESIGN_TOKENS.glassCard, mb: 4, overflow: 'visible' }}>
      <CardContent sx={{ p: 3 }}>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                EROSION METRIC
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                {safePhase.desc}
            </Typography>
        </Box>

        {/* MAIN BAR */}
        <PhaseIndicator score={safeScore} phase={safePhase} />

        {/* DNA STRANDS (3 SÄULEN) */}
        <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <DnaStrand 
                label="PHYSIS" 
                value={safeSubs.physis} 
                icon={<AccessibilityNewIcon fontSize="small"/>} 
                color="#00e5ff" // Cyan
                delay={0.2}
            />
            <DnaStrand 
                label="PSYCHE" 
                value={safeSubs.psyche} 
                icon={<PsychologyIcon fontSize="small"/>} 
                color="#ffeb3b" // Yellow
                delay={0.4}
            />
            <DnaStrand 
                label="ALLTAG" 
                value={safeSubs.infiltration} 
                icon={<GridViewIcon fontSize="small"/>} 
                color="#f50057" // Pink (wichtigste Säule)
                delay={0.6}
            />
        </Stack>

      </CardContent>
    </Card>
  );
}