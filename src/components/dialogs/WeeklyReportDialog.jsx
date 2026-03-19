import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import useUIStore from '../../store/uiStore';
import { acknowledgeWeeklyReport } from '../../services/ReportService';

export default function WeeklyReportDialog({ report, userId }) {
    const [loading, setLoading] = useState(false);
    const showToast = useUIStore(s => s.showToast);

    // Der Dialog rendert nur, wenn tatsächlich ein Report-Objekt existiert
    if (!report) return null;

    const handleAcknowledge = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            await acknowledgeWeeklyReport(userId);
            if (showToast) showToast("Wochenbericht quittiert.", "success");
        } catch (e) {
            console.error(e);
            if (showToast) showToast("Fehler beim Quittieren.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={!!report} disableEscapeKeyDown fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <AssessmentIcon color="primary" /> Wochenbericht
                </Box>
            </DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Typography variant="body2" color="text.secondary" paragraph align="center">
                    Dein Protokoll für die vergangene Woche wurde vom System ausgewertet.
                </Typography>
                
                <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 2, mb: 2, border: `1px dashed ${PALETTE.accents.purple}40` }}>
                    {report.femIndex !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">Fem-Index:</Typography>
                            <Typography variant="body2" fontWeight="bold">{report.femIndex}</Typography>
                        </Box>
                    )}
                    {report.compliance !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">Compliance Rate:</Typography>
                            <Typography variant="body2" fontWeight="bold" color={report.compliance >= 90 ? PALETTE.accents.green : PALETTE.accents.red}>{report.compliance}%</Typography>
                        </Box>
                    )}
                    {report.punishments !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Strafen:</Typography>
                            <Typography variant="body2" fontWeight="bold" color={report.punishments > 0 ? PALETTE.accents.red : PALETTE.accents.green}>{report.punishments}</Typography>
                        </Box>
                    )}
                    {report.message && (
                         <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', textAlign: 'center', color: PALETTE.text.primary }}>
                             "{report.message}"
                         </Typography>
                    )}
                </Box>

                <Typography variant="caption" color="error" align="center" display="block">
                    Die Kenntnisnahme dieses Berichts ist verpflichtend für die Fortsetzung des Protokolls.
                </Typography>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                <Button 
                    fullWidth 
                    variant="contained" 
                    onClick={handleAcknowledge} 
                    disabled={loading}
                    sx={DESIGN_TOKENS.buttonGradient}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Gelesen & Quittiert"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}