import React, { useEffect, useState } from 'react';
import { Container, Grid, Box, Typography, Button, IconButton } from '@mui/material';
import { motion } from 'framer-motion';

// CONTEXTS & HOOKS
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemContext';
import useSessionProgress from '../hooks/dashboard/useSessionProgress';
import useFemIndex from '../hooks/dashboard/useFemIndex';
import { getGreeting } from '../utils/formatters';

// SERVICES
import { getLastInstruction, generateDailyInstruction } from '../services/InstructionService';
import { getActivePunishment } from '../services/PunishmentService';

// COMPONENTS
import ProgressBar from '../components/dashboard/ProgressBar';
import ActiveSessionsList from '../components/dashboard/ActiveSessionsList';
import InfoTiles from '../components/dashboard/InfoTiles';
import FemIndexBar from '../components/dashboard/FemIndexBar';
import TzdOverlay from '../components/dashboard/TzdOverlay';

// DIALOGS
import InstructionDialog from '../components/dialogs/InstructionDialog';
import PunishmentDialog from '../components/dialogs/PunishmentDialog';
import LaundryDialog from '../components/dialogs/LaundryDialog';

// ICONS
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

// DESIGN SYSTEM (ZENTRALISIERT)
import { DESIGN_TOKENS, PALETTE, MOTION } from '../theme/obsidianDesign';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { items } = useItems();
  
  // Custom Hooks
  const { 
    activeSessions, progress, loading: progressLoading, 
    startInstructionSession, stopSession, registerRelease,
    loadActiveSessions
  } = useSessionProgress(currentUser, items);

  const { femIndex, trend, loading: femLoading } = useFemIndex(currentUser);

  // Local State
  const [instruction, setInstruction] = useState(null);
  const [instructionLoading, setInstructionLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [punishment, setPunishment] = useState(null);
  const [punishmentOpen, setPunishmentOpen] = useState(false);

  const [laundryOpen, setLaundryOpen] = useState(false);
  const washingItems = items.filter(i => i.status === 'washing');

  // --- INIT LOAD ---
  useEffect(() => {
    if (currentUser) {
        checkPunishments();
    }
  }, [currentUser]);

  const checkPunishments = async () => {
      const p = await getActivePunishment(currentUser.uid);
      if (p) {
          setPunishment(p);
          setPunishmentOpen(true);
      }
  };

  // --- HANDLERS ---
  const handleOpenInstruction = async () => {
      setDialogOpen(true);
      setInstructionLoading(true); // UI Status: "loading" im Dialog
      try {
        // 1. Prüfen ob schon eine existiert
        let data = await getLastInstruction(currentUser.uid);
        
        // 2. Wenn keine heutige da ist -> Neu generieren
        if (!data) {
             console.log("Generiere neue Instruction...");
             data = await generateDailyInstruction(currentUser.uid, items);
        }
        
        setInstruction(data);
      } catch (e) {
          console.error(e);
      } finally {
          setInstructionLoading(false); // UI Status: "ready"
      }
  };

  const handleStartInstruction = async (itemsToStart) => {
      if (!instruction) return;
      await startInstructionSession(instruction, itemsToStart); // Übergebe explizit Items
      setDialogOpen(false);
      loadActiveSessions(); // Refresh UI
  };

  const handleNavigateItem = (itemId) => {
      // Navigation Logik (optional)
      console.log("Nav to", itemId);
  };

  // OATH LOGIK (Simulation)
  const [isHoldingOath, setIsHoldingOath] = useState(false);
  const [oathProgress, setOathProgress] = useState(0);
  
  // ... (Oath Handler Code könnte hier stehen, gekürzt für Fokus auf Design) ...

  const handleWashItem = (id) => { console.log("Wash", id); };
  const handleWashAll = () => { console.log("Wash All"); };


  // --- RENDER ---
  return (
    <Container maxWidth="md" disableGutters sx={{ pt: 1 }}>
        
        {/* HEADER SECTION */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, px: 1 }}>
            <Box>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.75rem' }}>
                    {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                </Typography>
                <Typography variant="h4" sx={DESIGN_TOKENS.textGradient}>
                    {getGreeting()}
                </Typography>
            </Box>
            <Box>
                <IconButton onClick={() => setLaundryOpen(true)} color={washingItems.length > 0 ? "info" : "default"}>
                    <Box sx={{ position: 'relative' }}>
                        <HistoryIcon />
                        {washingItems.length > 0 && (
                            <Box sx={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', bgcolor: PALETTE.accents.blue }} />
                        )}
                    </Box>
                </IconButton>
                <IconButton><NotificationsIcon /></IconButton>
            </Box>
        </Box>

        {/* PROGRESS BAR (Zentralisiert) */}
        <Box sx={{ mb: 4 }}>
            <ProgressBar progress={progress} loading={progressLoading} />
        </Box>

        {/* KPI & INDEX AREA */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12}>
                <FemIndexBar value={femIndex} trend={trend} loading={femLoading} />
            </Grid>
            <Grid item xs={12}>
                {/* INFO TILES (Nutzen intern jetzt DESIGN_TOKENS wenn refactored, sonst hier Props übergeben) */}
                <InfoTiles activeSessions={activeSessions} /> 
            </Grid>
        </Grid>

        {/* MAIN ACTION CARD */}
        <Box 
            component={motion.div} 
            whileHover={{ scale: 1.01 }} 
            whileTap={{ scale: 0.99 }}
            onClick={handleOpenInstruction}
            sx={{
                ...DESIGN_TOKENS.glassCard, // <--- DAS IST DIE MAGIE
                p: 3,
                mb: 4,
                cursor: 'pointer',
                border: `1px solid ${PALETTE.primary.main}40`, // Leichter Primary Border für Fokus
                background: `linear-gradient(145deg, ${PALETTE.primary.main}10 0%, rgba(0,0,0,0) 100%)` // Subtiler Verlauf
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h6" sx={{ color: PALETTE.text.primary, fontWeight: 'bold' }}>
                        Tages-Anweisung
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Tippen zum Öffnen & Starten
                    </Typography>
                </Box>
                <AddCircleOutlineIcon sx={{ fontSize: 40, color: PALETTE.primary.main, opacity: 0.8 }} />
            </Box>
        </Box>

        {/* ACTIVE SESSIONS LIST */}
        <Typography variant="caption" sx={DESIGN_TOKENS.sectionHeader}>Laufende Sessions</Typography>
        <ActiveSessionsList 
            sessions={activeSessions} 
            onStop={stopSession} 
            onRelease={registerRelease}
        />

        {/* TZD OVERLAY (Time Zone Difference / Status) */}
        <TzdOverlay />

        {/* --- DIALOGE --- */}
        <InstructionDialog 
            open={dialogOpen} 
            onClose={() => setDialogOpen(false)}
            instruction={instruction}
            items={items}
            loadingStatus={instructionLoading ? 'loading' : 'ready'}
            // ... Props durchreichen ...
            isNight={false} // Demo Logic
            onStartRequest={handleStartInstruction}
        />

        <PunishmentDialog 
            open={punishmentOpen}
            onClose={() => setPunishmentOpen(false)}
            activePunishment={punishment}
        />

        <LaundryDialog 
            open={laundryOpen}
            onClose={() => setLaundryOpen(false)}
            washingItems={washingItems}
            onWashItem={handleWashItem}
            onWashAll={handleWashAll}
        />

    </Container>
  );
}