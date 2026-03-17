import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, LinearProgress, TextField, Snackbar, Alert } from '@mui/material';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TimerIcon from '@mui/icons-material/Timer';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import useUIStore from '../../store/uiStore';

import TzdOverlay from './TzdOverlay';
import ForcedReleaseOverlay from './ForcedReleaseOverlay';
import InflationOverlay from './InflationOverlay';
import OfferDialog from '../dialogs/OfferDialog';
import InstructionDialog from '../dialogs/InstructionDialog';
import PunishmentDialog from '../dialogs/PunishmentDialog';
import LaundryDialog from '../dialogs/LaundryDialog';
import ReleaseProtocolDialog from '../dialogs/ReleaseProtocolDialog';

const formatTime = (totalMins) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    return `${h}h ${m}m`;
};

const IndexDetailDialog = ({ open, onClose, details }) => {
    if (!details) return null;
    const renderMetricRow = (label, value, color, icon) => (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{icon}<Typography variant="body2" color="text.secondary">{label}</Typography></Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: color }}>{Math.round(value)}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={value} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
        </Box>
    );
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={DESIGN_TOKENS.dialog.paper}>
            <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}><AnalyticsIcon color="primary" /> Fem-Index 2.0</DialogTitle>
            <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                <Box sx={{ textAlign: 'center', mb: 4 }}><Typography variant="h2" sx={{ ...DESIGN_TOKENS.textGradient, fontWeight: 'bold', fontSize: '3.5rem' }}>{details.score}</Typography><Typography variant="overline" color="text.secondary">COMPOSITE SCORE</Typography></Box>
                <Box sx={{ px: 1 }}>
                    {renderMetricRow("Physis (Körper)", details.subScores.physis, '#00e5ff', <CheckCircleOutlineIcon fontSize="small" sx={{color: '#00e5ff'}} />)}
                    {renderMetricRow("Psyche (Wille)", details.subScores.psyche, '#ffeb3b', <TimerIcon fontSize="small" sx={{ color: '#ffeb3b' }} />)}
                    {renderMetricRow("Infiltration (Alltag)", details.subScores.infiltration, '#f50057', <LinkOffIcon fontSize="small" sx={{ color: '#f50057' }} />)}
                </Box>
            </DialogContent>
            <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}><Button onClick={onClose} fullWidth color="inherit">Schließen</Button></DialogActions>
        </Dialog>
    );
};

export default function DashboardDialogManager(props) {
    const {
        toast, handleCloseToast,
        laundryOpen, setLaundryOpen,
        auditOpen, setAuditOpen, pendingAuditItems, currentAuditIndex, currentCondition, setCurrentCondition,
        indexDialogOpen, setIndexDialogOpen,
        punishmentScanOpen, setPunishmentScanOpen, punishmentScanMode,
        releaseDialogOpen, setReleaseDialogOpen, releaseStep, releaseTimer, releaseIntensity, setReleaseIntensity,
        instructionOpen, setInstructionOpen, forcedReleaseOpen, forcedReleaseMethod,
        oathProgress, isHoldingOath
    } = useUIStore();

    const {
        tzdActive, items, handleConfirmForcedRelease, handleFailForcedRelease, handleRefuseForcedRelease,
        timeBankData, handleAcknowledgeInflation, offerOpen, gambleStake, handleGambleAccept, handleGambleDecline, hasVoluntarySession, isForcedGamble,
        weeklyReport, currentUser, currentInstruction, startOathPress, cancelOathPress,
        handleDeclineOath, handleStartRequest, navigate, isFreeDay, freeDayReason, instructionStatus, isNight, showToast,
        punishmentItem, isNfcScanning, handlePunishmentScanTrigger,
        kpis, handleStartReleaseTimer, handleSkipTimer, handleReleaseDecision,
        handleConfirmAuditItem, indexDetails, activeSessions
    } = props;

    const auditItem = pendingAuditItems[currentAuditIndex];
    const auditImg = auditItem?.imageUrl || (auditItem?.images && auditItem.images.length > 0 ? auditItem.images[0] : null);

    return (
        <>
            {/* KORREKTUR: TzdOverlay erhält nun timeBankData und currentUser für den Freikauf */}
            <TzdOverlay active={tzdActive} allItems={items} timeBankData={timeBankData} currentUser={currentUser} />
            
            <ForcedReleaseOverlay open={forcedReleaseOpen} method={forcedReleaseMethod} onConfirm={handleConfirmForcedRelease} onFail={handleFailForcedRelease} onRefuse={handleRefuseForcedRelease} />
            <InflationOverlay open={!!timeBankData.pendingInflationNotice} noticeData={timeBankData.pendingInflationNotice} onAcknowledge={handleAcknowledgeInflation} />
            <OfferDialog open={offerOpen} stakeItems={gambleStake} onAccept={handleGambleAccept} onDecline={handleGambleDecline} hasActiveSession={hasVoluntarySession} isForced={isForcedGamble} />

            <Dialog open={!!weeklyReport} disableEscapeKeyDown PaperProps={{ sx: { ...DESIGN_TOKENS.dialog.paper.sx, border: `1px solid ${PALETTE.accents.gold}`, boxShadow: `0 0 20px ${PALETTE.accents.gold}40` } }}>
                <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.gold, justifyContent: 'center' }}>
                    <TrendingUpIcon sx={{ mr: 1 }} /> WOCHEN-EVALUIERUNG
                </DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>Das System hat deine Leistung in der vergangenen Woche protokolliert und die geforderte Tagestragezeit neu festgelegt.</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, mb: 2 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">Bisheriges Ziel</Typography>
                                <Typography variant="h6" sx={{ color: 'text.disabled', textDecoration: 'line-through' }}>{weeklyReport ? formatTime(weeklyReport.previousGoal * 60) : ''}</Typography>
                            </Box>
                            <TrendingUpIcon sx={{ color: PALETTE.accents.gold, fontSize: 30 }} />
                            <Box>
                                <Typography variant="caption" sx={{ color: PALETTE.accents.gold, fontWeight: 'bold' }} display="block">Neues Ziel</Typography>
                                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>{weeklyReport ? formatTime(weeklyReport.newGoal * 60) : ''}</Typography>
                            </Box>
                        </Box>
                        <Typography variant="caption" sx={{ color: PALETTE.accents.gold, display: 'block', mt: 4, fontWeight: 'bold' }}>RÜCKSTUFUNGEN SIND UNTERSAGT. DEINE ZEIT IST EIGENTUM DES PROTOKOLLS.</Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                    <Button fullWidth variant="contained" onClick={async () => { await updateDoc(doc(db, `users/${currentUser.uid}/settings/protocol`), { "weeklyReport.acknowledged": true }); }} sx={{ bgcolor: PALETTE.accents.gold, color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#fff' } }}>KENNTNISNAHME BESTÄTIGEN</Button>
                </DialogActions>
            </Dialog>

            <InstructionDialog open={instructionOpen} onClose={() => setInstructionOpen(false)} instruction={currentInstruction} items={items} isHoldingOath={isHoldingOath} oathProgress={oathProgress} onStartOath={startOathPress} onCancelOath={cancelOathPress} onDeclineOath={handleDeclineOath} onStartRequest={handleStartRequest} onNavigateItem={(id) => { setInstructionOpen(false); navigate(`/item/${id}`); }} isFreeDay={isFreeDay} freeDayReason={freeDayReason} loadingStatus={instructionStatus === 'idle' ? 'loading' : instructionStatus} isNight={isNight} showToast={showToast} activeSessions={activeSessions} />
            <PunishmentDialog open={punishmentScanOpen} onClose={() => setPunishmentScanOpen(false)} mode={punishmentScanMode} punishmentItem={punishmentItem} isScanning={isNfcScanning} onScan={handlePunishmentScanTrigger} />
            
            <LaundryDialog 
                open={laundryOpen} 
                onClose={() => setLaundryOpen(false)} 
                washingItems={items.filter(i => i.status === 'washing')} 
                onWashItem={async (id) => { 
                    try { 
                        await updateDoc(doc(db, `users/${currentUser.uid}/items`, id), { status: 'active', cleanDate: serverTimestamp(), historyLog: arrayUnion({ type: 'wash', date: new Date().toISOString() }) }); 
                        if(kpis?.basics?.washing <= 1) setLaundryOpen(false); 
                    } catch(e){}
                }} 
                onWashAll={async () => { 
                    try { 
                        const timestamp = new Date().toISOString(); 
                        const promises = items.filter(i=>i.status==='washing').map(i => updateDoc(doc(db, `users/${currentUser.uid}/items`, i.id), { status: 'active', cleanDate: serverTimestamp(), historyLog: arrayUnion({ type: 'wash', date: timestamp }) })); 
                        await Promise.all(promises); 
                        setLaundryOpen(false); 
                    } catch (e) {} 
                }} 
            />
            
            <ReleaseProtocolDialog open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)} step={releaseStep} timer={releaseTimer} intensity={releaseIntensity} setIntensity={setReleaseIntensity} onStartTimer={handleStartReleaseTimer} onSkipTimer={handleSkipTimer} onDecision={handleReleaseDecision} />
            
            <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} fullWidth PaperProps={DESIGN_TOKENS.dialog.paper}>
                <DialogTitle sx={DESIGN_TOKENS.dialog.title.sx}>Audit: {auditItem?.name}</DialogTitle>
                <DialogContent sx={DESIGN_TOKENS.dialog.content.sx}>
                    {auditImg && (
                        <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
                            <img 
                                src={auditImg} 
                                alt="Item" 
                                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }} 
                            />
                        </Box>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
                        ID: {auditItem?.customId || auditItem?.id || 'Keine ID'}
                    </Typography>
                    <TextField type="number" label="Zustand (1-5)" value={currentCondition} onChange={e => setCurrentCondition(parseInt(e.target.value))} fullWidth sx={{mt:2}} />
                </DialogContent>
                <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
                    <Button onClick={() => setAuditOpen(false)} color="inherit">Abbrechen</Button>
                    <Button onClick={handleConfirmAuditItem} variant="contained" color="warning">Bestätigen</Button>
                </DialogActions>
            </Dialog>

            <IndexDetailDialog open={indexDialogOpen} onClose={() => setIndexDialogOpen(false)} details={indexDetails} />
            
            <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast}>
                <Alert severity={toast.severity}>{toast.message}</Alert>
            </Snackbar>
        </>
    );
}