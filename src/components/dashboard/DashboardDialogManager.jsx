import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, LinearProgress } from '@mui/material';
import { DESIGN_TOKENS } from '../../theme/obsidianDesign';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TimerIcon from '@mui/icons-material/Timer';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import TzdOverlay from './TzdOverlay';
import ForcedReleaseOverlay from './ForcedReleaseOverlay';
import InflationOverlay from './InflationOverlay';
import OfferDialog from '../dialogs/OfferDialog';
import WeeklyReportDialog from '../dialogs/WeeklyReportDialog';
import InstructionDialog from '../dialogs/InstructionDialog';
import PunishmentDialog from '../dialogs/PunishmentDialog';
import ReleaseProtocolDialog from '../dialogs/ReleaseProtocolDialog';
import AuditDialog from '../dialogs/AuditDialog';
import LaundryDialog from '../dialogs/LaundryDialog';
import useUIStore from '../../store/uiStore';

// RE-INTEGRIERT: Der reine UI-Dialog für die Fem-Index Details.
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

export default function DashboardDialogManager({
    tzdActive, items, 
    handleConfirmForcedRelease, handleFailForcedRelease, handleRefuseForcedRelease,
    timeBankData, handleAcknowledgeInflation, offerOpen, gambleStake, 
    handleGambleAccept, handleGambleDecline, hasVoluntarySession, isForcedGamble,
    weeklyReport, currentUser, 
    currentInstruction, startOathPress, cancelOathPress,
    handleDeclineOath, handleStartRequest, navigate, isFreeDay, freeDayReason, 
    instructionStatus, isNight, showToast, 
    punishmentItem, isNfcScanning, 
    handlePunishmentScanTrigger, kpis, 
    handleStartReleaseTimer, handleSkipTimer, 
    handleReleaseDecision, 
    handleConfirmAuditItem, 
    indexDetails, activeSessions 
}) {
    const transit = instructionStatus?.transitProtocol;
    const forcedRelease = instructionStatus?.forcedRelease;

    const {
        isInstructionOpen, setInstructionOpen,
        isPunishmentScanOpen, setPunishmentScanOpen, punishmentScanMode,
        isReleaseDialogOpen, setReleaseDialogOpen, releaseStep, releaseTimer, releaseIntensity, setReleaseIntensity,
        isAuditOpen, setAuditOpen, pendingAuditItems, currentAuditIndex,
        isLaundryOpen, setLaundryOpen,
        indexDialogOpen, setIndexDialogOpen
    } = useUIStore();

    return (
        <>
            <TzdOverlay tzdActive={tzdActive} items={items} />

            {/* GATEKEEPER KORREKTUR: Verhindert das verfrühte Rendern nach dem Blind Oath */}
            {instructionStatus?.isActive && forcedRelease?.required && !forcedRelease?.executed && (
                <ForcedReleaseOverlay 
                    onConfirm={handleConfirmForcedRelease} 
                    onFail={handleFailForcedRelease} 
                    onRefuse={handleRefuseForcedRelease}
                    instructionDuration={currentInstruction?.durationMinutes}
                />
            )}

            {timeBankData?.pendingInflationNotice && (
                <InflationOverlay 
                    notice={timeBankData.pendingInflationNotice} 
                    onAcknowledge={handleAcknowledgeInflation} 
                />
            )}

            <OfferDialog 
                open={offerOpen} 
                gambleStake={gambleStake} 
                onAccept={handleGambleAccept} 
                onDecline={handleGambleDecline} 
                hasVoluntarySession={hasVoluntarySession}
                isForced={isForcedGamble}
            />

            <WeeklyReportDialog report={weeklyReport} userId={currentUser?.uid} />

            <InstructionDialog 
                open={isInstructionOpen} 
                onClose={() => setInstructionOpen(false)}
                instruction={currentInstruction} 
                items={items}
                isNight={isNight}
                isFreeDay={isFreeDay}
                freeDayReason={freeDayReason}
                onStartOath={startOathPress}
                onCancelOath={cancelOathPress}
                onDeclineOath={handleDeclineOath}
                onStartRequest={handleStartRequest}
                onNavigateItem={(id) => { setInstructionOpen(false); navigate(`/item/${id}`); }}
                oathProgress={useUIStore.getState().oathProgress}
                isHoldingOath={useUIStore.getState().isHoldingOath}
                showToast={showToast}
                activeSessions={activeSessions}
            />

            <PunishmentDialog 
                open={isPunishmentScanOpen} 
                onClose={() => setPunishmentScanOpen(false)}
                punishmentItem={punishmentItem}
                isScanning={isNfcScanning}
                onScanTrigger={handlePunishmentScanTrigger}
                mode={punishmentScanMode}
            />

            <ReleaseProtocolDialog 
                open={isReleaseDialogOpen} 
                onClose={() => {
                    if (releaseStep === 'decision') return; 
                    setReleaseDialogOpen(false);
                }}
                step={releaseStep}
                timer={releaseTimer}
                intensity={releaseIntensity}
                setIntensity={setReleaseIntensity}
                onStartTimer={handleStartReleaseTimer}
                onSkipTimer={handleSkipTimer}
                onDecision={handleReleaseDecision}
            />

            <AuditDialog 
                open={isAuditOpen} 
                onClose={() => setAuditOpen(false)}
                currentItem={pendingAuditItems[currentAuditIndex]}
                progress={{ current: currentAuditIndex + 1, total: pendingAuditItems.length }}
                onConfirm={handleConfirmAuditItem}
            />

            <LaundryDialog
                open={isLaundryOpen}
                onClose={() => setLaundryOpen(false)}
                items={items}
                userId={currentUser?.uid}
            />

            {/* NEU: Einbindung des fehlenden Fem-Index Dialogs */}
            <IndexDetailDialog 
                open={indexDialogOpen} 
                onClose={() => setIndexDialogOpen(false)} 
                details={indexDetails} 
            />
        </>
    );
}