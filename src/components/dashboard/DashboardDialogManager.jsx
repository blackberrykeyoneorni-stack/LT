// src/components/dashboard/DashboardDialogManager.jsx
import React from 'react';
import useUIStore from '../../store/uiStore';
import TzdOverlay from './TzdOverlay';
import InflationOverlay from './InflationOverlay';
import OfferDialog from '../dialogs/OfferDialog';
import WeeklyReportDialog from '../dialogs/WeeklyReportDialog';
import InstructionDialog from '../dialogs/InstructionDialog';
import PunishmentDialog from '../dialogs/PunishmentDialog';
import ReleaseProtocolDialog from '../dialogs/ReleaseProtocolDialog';
import AuditDialog from '../dialogs/AuditDialog';
import LaundryDialog from '../dialogs/LaundryDialog';
import ForcedReleaseOverlay from './ForcedReleaseOverlay';

/**
 * DashboardDialogManager
 * Hält alle Overlays bereit und empfängt Daten direkt vom Dashboard.
 *
 */
export default function DashboardDialogManager({
    tzdActive, items, washingItems, onWashItem, onWashAll,
    handleConfirmForcedRelease, handleFailForcedRelease, handleRefuseForcedRelease,
    timeBankData, handleAcknowledgeInflation, offerOpen, gambleStake, 
    handleGambleAccept, handleGambleDecline, hasVoluntarySession, isForcedGamble,
    weeklyReport, currentUser, handleAcknowledgeReport, onCloseWeeklyReport,
    currentInstruction, startOathPress, cancelOathPress,
    handleDeclineOath, handleStartRequest, navigate, isFreeDay, freeDayReason, 
    instructionStatus, isNight, showToast, 
    punishmentItem, pendingPunishments, isNfcScanning, handlePunishmentScanTrigger, kpis, 
    handleStartReleaseTimer, handleSkipTimer, handleReleaseDecision, 
    handleConfirmAuditItem, indexDetails, activeSessions
}) {
    
    const { 
        instructionOpen, setInstructionOpen,
        punishmentScanOpen, setPunishmentScanOpen,
        releaseDialogOpen, setReleaseDialogOpen,
        releaseStep, releaseTimer, releaseIntensity,
        auditOpen, setAuditOpen,
        pendingAuditItems, currentAuditIndex,
        laundryOpen, setLaundryOpen,
        oathProgress, isHoldingOath 
    } = useUIStore();

    return (
        <>
            <TzdOverlay 
                active={tzdActive} 
                allItems={items}
                timeBankData={timeBankData}
                currentUser={currentUser}
            />
            
            {timeBankData?.pendingInflationNotice && (
                <InflationOverlay 
                    data={timeBankData.pendingInflationNotice} 
                    onClose={handleAcknowledgeInflation} 
                />
            )}

            <OfferDialog 
                open={offerOpen} stake={gambleStake} 
                onAccept={handleGambleAccept} onDecline={handleGambleDecline}
                hasActiveSession={hasVoluntarySession} isForced={isForcedGamble}
            />

            {weeklyReport && (
                <WeeklyReportDialog 
                    open={!!weeklyReport} report={weeklyReport} 
                    userId={currentUser?.uid} 
                    onClose={onCloseWeeklyReport}
                    onAcknowledge={handleAcknowledgeReport}
                />
            )}

            <InstructionDialog 
                open={instructionOpen} onClose={() => setInstructionOpen(false)}
                instruction={currentInstruction} onStartRequest={handleStartRequest}
                onDeclineOath={handleDeclineOath} onStartOath={startOathPress}
                onCancelOath={cancelOathPress} isNight={isNight}
                loadingStatus={instructionStatus}
                isFreeDay={isFreeDay} freeDayReason={freeDayReason}
                items={items} activeSessions={activeSessions}
                oathProgress={oathProgress} isHoldingOath={isHoldingOath} showToast={showToast}
            />

            <LaundryDialog 
                open={laundryOpen} onClose={() => setLaundryOpen(false)}
                washingItems={washingItems || []} onWashItem={onWashItem}
                onWashAll={onWashAll}
            />

            <PunishmentDialog 
                open={punishmentScanOpen} onClose={() => setPunishmentScanOpen(false)}
                pendingPunishments={pendingPunishments} items={items} isScanning={isNfcScanning}
                onScanTrigger={handlePunishmentScanTrigger}
            />

            <AuditDialog 
                open={auditOpen} items={pendingAuditItems}
                currentIndex={currentAuditIndex} onConfirm={handleConfirmAuditItem}
                onConditionChange={(c) => useUIStore.getState().setCurrentCondition(c)}
                onClose={() => setAuditOpen(false)}
            />

            <ReleaseProtocolDialog 
                open={releaseDialogOpen} onClose={() => setReleaseDialogOpen(false)}
                step={releaseStep} timer={releaseTimer} intensity={releaseIntensity}
                onStartTimer={handleStartReleaseTimer} onSkipTimer={handleSkipTimer}
                onDecision={handleReleaseDecision}
                setIntensity={(v) => useUIStore.getState().setReleaseIntensity(v)} 
            />

            {instructionStatus?.forcedReleaseRequired && !instructionStatus?.forcedReleaseExecuted && (
                <ForcedReleaseOverlay 
                    method={instructionStatus.forcedReleaseMethod}
                    onConfirm={handleConfirmForcedRelease}
                    onFail={handleFailForcedRelease}
                    onRefuse={handleRefuseForcedRelease}
                />
            )}
        </>
    );
}