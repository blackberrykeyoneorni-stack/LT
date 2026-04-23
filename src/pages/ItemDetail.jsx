// src/pages/ItemDetail.jsx
import React, { useState, useEffect } from 'react';
import { Box, Container, CircularProgress, Paper, Button } from '@mui/material';
import { DESIGN_TOKENS } from '../theme/obsidianDesign';

// Contexts & Services
import { useAuth } from '../contexts/AuthContext';
import useUIStore from '../store/uiStore';
import { getUniformityStatus } from '../services/UniformityService';

// LOGIC HOOK
import { useItemDetailLogic } from '../hooks/useItemDetailLogic';

// COMPONENTS
import ItemGallery from '../components/item-detail/ItemGallery';
import ActionPanel from '../components/item-detail/ActionPanel';
import ItemInfoGrid from '../components/item-detail/ItemInfoGrid';
import ItemStats from '../components/item-detail/ItemStats';
import FooterActions from '../components/item-detail/FooterActions';
import ItemHistory from '../components/item-detail/ItemHistory';
import ArchiveDialog from '../components/item-detail/ArchiveDialog';

export default function ItemDetail() {
    const { currentUser } = useAuth();
    const showToast = useUIStore(s => s.showToast);
    
    const { 
        item, loading, isEditing, isBusy, recoveryInfo, 
        formData, dropdowns, stats, historyEvents, archiveDialog,
        galleryImages, 
        setIsEditing, setFormData, setArchiveDialog,
        actions 
    } = useItemDetailLogic();

    // --- ERZWUNGENE MONOTONIE STATE ---
    const [uniformity, setUniformity] = useState({ active: false });

    useEffect(() => {
        if (currentUser) {
            getUniformityStatus(currentUser.uid).then(status => setUniformity(status));
        }
    }, [currentUser]);

    const handleStartSession = (...args) => {
        if (uniformity.active && !uniformity.itemIds?.includes(item.id)) {
            showToast("SYSTEM SPERRE: Uniform-Protokoll aktiv.", "error");
            return;
        }
        actions.startSession(...args);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress color="primary" /></Box>;
    if (!item) return null;

    return (
        // WRAPPER FÜR HINTERGRUND & SPACING
        <Box sx={DESIGN_TOKENS.bottomNavSpacer}>
            
            {/* 1. Header Bild & Toolbar */}
            <ItemGallery 
                item={item} 
                isEditing={isEditing} 
                onToggleEdit={() => setIsEditing(!isEditing)}
                onSave={actions.save}
                onWriteNFC={actions.writeNFC}
                onAddImages={actions.addImages}
                displayImages={galleryImages}
            />

            <Container sx={{ mt: -3, position: 'relative', zIndex: 2, pb: 10 }}>
                <Paper sx={{ p: 3, mb: 3, ...DESIGN_TOKENS.glassCard }}>
                    
                    {/* 2. Actions & Status */}
                    {!isEditing && (
                        <ActionPanel 
                            isBusy={isBusy} 
                            recoveryInfo={recoveryInfo} 
                            onStartSession={handleStartSession} 
                        />
                    )}

                    {/* 3. Main Data Grid */}
                    <ItemInfoGrid 
                        isEditing={isEditing}
                        formData={formData}
                        item={item}
                        setFormData={setFormData}
                        dropdowns={dropdowns}
                    />

                    {/* 4. Stats & Edit Save */}
                    {!isEditing ? (
                        <ItemStats stats={stats} />
                    ) : (
                        <Button variant="contained" onClick={actions.save} fullWidth sx={{ mt: 3, py: 1.5, ...DESIGN_TOKENS.buttonGradient }}>
                            Änderungen Speichern
                        </Button>
                    )}
                </Paper>

                {/* 5. Footer Actions */}
                {!isEditing && (
                    <FooterActions 
                        onWash={actions.wash} 
                        onArchive={() => setArchiveDialog(prev => ({ ...prev, open: true }))} 
                    />
                )}
                
                {/* 6. History Timeline */}
                {!isEditing && <ItemHistory historyEvents={historyEvents} />}

            </Container>

            {/* Dialogs */}
            <ArchiveDialog 
                open={archiveDialog.open} 
                onClose={() => setArchiveDialog(prev => ({ ...prev, open: false }))}
                onConfirm={actions.archive}
                dropdowns={dropdowns}
                values={archiveDialog}
                setValues={setArchiveDialog}
            />
        </Box>
    );
}