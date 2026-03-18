import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useKPIs from '../hooks/useKPIs'; 
import { fetchStatsData } from '../services/StatsService';
import { Box, Typography, CircularProgress, Container, Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import { motion } from 'framer-motion';

import { DESIGN_TOKENS, PALETTE, MOTION } from '../theme/obsidianDesign';
import { Icons } from '../theme/appIcons';

import CoreMetricsGrid from '../components/stats/CoreMetricsGrid';
import DeepAnalyticsPanel from '../components/stats/DeepAnalyticsPanel';
import ForensicsView from '../components/stats/ForensicsView';
import TrendDialog from '../components/stats/TrendDialog';
import { calculateTrend, calculateForensics } from '../utils/statsCalculator';

export default function Statistics() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [sessions, setSessions] = useState([]);
    
    // UI States
    const [selectedMetric, setSelectedMetric] = useState(null); 
    const [trendData, setTrendData] = useState([]); 
    const [selectedDefinition, setSelectedDefinition] = useState(null);

    useEffect(() => {
        if (!currentUser) return;
        const loadData = async () => {
            setLoading(true);
            try {
                // BUGFIX: Firebase ist hier weg, sauberer Aufruf des Data-Layers
                const data = await fetchStatsData(currentUser.uid);
                setItems(data.items);
                setSessions(data.sessions);
            } catch (e) { 
                console.error("Stats Load Error:", e); 
            } finally { 
                setLoading(false); 
            }
        };
        loadData();
    }, [currentUser]);

    const { coreMetrics, basics, deepAnalytics } = useKPIs(items, [], sessions);

    const handleCardClick = (metricId, title) => { 
        if (['coverage', 'nocturnal', 'nylonGap', 'resistance', 'nylonEnclosure', 'compliance', 'voluntarism', 'endurance', 'cpnh'].includes(metricId)) {
            const data = calculateTrend(metricId, sessions, items);
            setTrendData(data);
            setSelectedMetric({id: metricId, title}); 
        } else {
            setSelectedMetric(null);
        }
    };

    const forensics = calculateForensics(items, basics);

    if (loading) return <Box sx={{display:'flex', justifyContent:'center', mt:10}}><CircularProgress/></Box>;

    return (
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            <Container maxWidth="md">
            <motion.div variants={MOTION.listContainer} initial="hidden" animate="show">
                
                <motion.div variants={MOTION.listItem}>
                    <Typography variant="h4" gutterBottom sx={DESIGN_TOKENS.textGradient}>Statistik</Typography>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}><Icons.Flame color="secondary"/> Core Metrics</Typography>
                </motion.div>

                <CoreMetricsGrid coreMetrics={coreMetrics} onCardClick={handleCardClick} />

                {deepAnalytics && (
                    <DeepAnalyticsPanel deepAnalytics={deepAnalytics} onDefinitionClick={setSelectedDefinition} />
                )}

                <ForensicsView forensics={forensics} />

            </motion.div>

            <TrendDialog selectedMetric={selectedMetric} trendData={trendData} onClose={() => setSelectedMetric(null)} />

            {/* Dialog für Deep Analytics Definitionen */}
            <Dialog open={!!selectedDefinition} onClose={() => setSelectedDefinition(null)} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                    <Box><Typography variant="h6">{selectedDefinition?.title}</Typography></Box>
                    <IconButton onClick={() => setSelectedDefinition(null)} sx={{ color: 'white' }}><Icons.Close /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ ...DESIGN_TOKENS.dialog.content.sx, mt: 2 }}>
                    <Typography variant="body1" sx={{ color: PALETTE.text.secondary, lineHeight: 1.6 }}>
                        {selectedDefinition?.description}
                    </Typography>
                </DialogContent>
            </Dialog>

            </Container>
        </Box>
    );
}