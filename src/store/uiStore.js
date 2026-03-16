import { create } from 'zustand';

const useUIStore = create((set, get) => ({
    // Toast & Benachrichtigungen
    toast: { open: false, message: '', severity: 'success' },
    showToast: (message, severity = 'success') => set({ toast: { open: true, message, severity } }),
    handleCloseToast: () => set((state) => ({ toast: { ...state.toast, open: false } })),

    // Basis-Dialoge
    laundryOpen: false,
    setLaundryOpen: (val) => set({ laundryOpen: val }),

    auditOpen: false,
    setAuditOpen: (val) => set({ auditOpen: val }),

    indexDialogOpen: false,
    setIndexDialogOpen: (val) => set({ indexDialogOpen: val }),

    punishmentScanOpen: false,
    setPunishmentScanOpen: (val) => set({ punishmentScanOpen: val }),
    
    punishmentScanMode: null,
    setPunishmentScanMode: (val) => set({ punishmentScanMode: val }),

    // Release Protocol (Zwangsentladung)
    releaseDialogOpen: false,
    setReleaseDialogOpen: (val) => set({ releaseDialogOpen: val }),
    releaseStep: 'confirm',
    setReleaseStep: (val) => set({ releaseStep: val }),
    releaseTimer: 600,
    setReleaseTimer: (val) => set({ releaseTimer: typeof val === 'function' ? val(get().releaseTimer) : val }),
    releaseIntensity: 3,
    setReleaseIntensity: (val) => set({ releaseIntensity: val }),

    // Audit Daten
    pendingAuditItems: [],
    setPendingAuditItems: (val) => set({ pendingAuditItems: val }),
    currentAuditIndex: 0,
    setCurrentAuditIndex: (val) => set({ currentAuditIndex: typeof val === 'function' ? val(get().currentAuditIndex) : val }),
    currentCondition: 5,
    setCurrentCondition: (val) => set({ currentCondition: val }),

    // Instruction Manager Overlays
    instructionOpen: false,
    setInstructionOpen: (val) => set({ instructionOpen: val }),
    
    forcedReleaseOpen: false,
    setForcedReleaseOpen: (val) => set({ forcedReleaseOpen: val }),
    
    forcedReleaseMethod: null,
    setForcedReleaseMethod: (val) => set({ forcedReleaseMethod: val }),

    // Rapid UI States (Render-Isolierung für den Eid)
    oathProgress: 0,
    setOathProgress: (val) => set({ oathProgress: typeof val === 'function' ? val(get().oathProgress) : val }),
    isHoldingOath: false,
    setIsHoldingOath: (val) => set({ isHoldingOath: val }),
}));

export default useUIStore;