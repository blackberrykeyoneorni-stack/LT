import React from 'react';
import { Box, Container, CircularProgress, Paper, Button } from '@mui/material';
import { DESIGN_TOKENS } from '../theme/obsidianDesign';

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
    const { 
        item, loading, isEditing, isBusy, recoveryInfo, 
        formData, dropdowns, stats, historyEvents, archiveDialog,
        galleryImages, // NEU: Kombinierte Bilderliste (Bestand + Preview)
        setIsEditing, setFormData, setArchiveDialog,
        actions 
    } = useItemDetailLogic();

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
    if (!item) return null;

    return (
        <Box sx={{ pb: 10 }}>
            {/* 1. Header Bild & Toolbar */}
            <ItemGallery 
                item={item} 
                isEditing={isEditing} 
                onToggleEdit={() => setIsEditing(!isEditing)}
                onSave={actions.save}
                onWriteNFC={actions.writeNFC}
                onAddImages={actions.addImages} // NEU
                displayImages={galleryImages}   // NEU
            />

            <Container sx={{ mt: -3, position: 'relative', zIndex: 2 }}>
                <Paper sx={{ p: 3, mb: 3, ...DESIGN_TOKENS.glassCard }}>
                    
                    {/* 2. Actions & Status (Only when not editing) */}
                    {!isEditing && (
                        <ActionPanel 
                            isBusy={isBusy} 
                            recoveryInfo={recoveryInfo} 
                            onStartSession={actions.startSession} 
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
                        <Button variant="contained" onClick={actions.save} fullWidth sx={{ mt: 3, ...DESIGN_TOKENS.buttonGradient }}>
                            Änderungen Speichern
                        </Button>
                    )}
                </Paper>

                {/* 5. Footer Actions (Waschen / Archiv) */}
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
