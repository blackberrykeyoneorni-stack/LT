import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemAvatar, Avatar, ListItemText, Typography } from '@mui/material';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

export default function LaundryDialog({ open, onClose, washingItems, onWashItem, onWashAll }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
        <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.blue, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalLaundryServiceIcon color="inherit" /> Wäschekorb
        </DialogTitle>
        <DialogContent dividers sx={DESIGN_TOKENS.dialog.content.sx}>
            <List>
                {washingItems.map(item => (
                    <ListItem key={item.id} alignItems="flex-start" secondaryAction={
                        <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => onWashItem(item.id)} 
                            startIcon={<RestoreFromTrashIcon fontSize="small" />} 
                            sx={{ 
                                borderColor: 'rgba(255,255,255,0.2)', 
                                color: 'text.primary',
                                minWidth: 'auto', // Verhindert breite Standardgröße
                                px: 1.5, // Schmaleres Padding
                                fontSize: '0.75rem',
                                ml: 1
                            }}
                        >
                            Waschen
                        </Button>
                    }>
                        <ListItemAvatar>
                            <Avatar src={item.imageUrl} variant="rounded" sx={{ width: 50, height: 50, mr: 2, mt: 0.5 }} />
                        </ListItemAvatar>
                        <ListItemText 
                            primary={
                                <Typography variant="subtitle2" component="div" sx={{ fontWeight: 'bold' }}>
                                    {item.name || item.brand}
                                </Typography>
                            } 
                            secondary={
                                <>
                                    <Typography component="span" variant="body2" display="block" color="text.secondary">
                                        {item.subCategory}
                                    </Typography>
                                    <Typography component="span" variant="caption" display="block" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                        ID: {item.customId || item.id}
                                    </Typography>
                                </>
                            } 
                        />
                    </ListItem>
                ))}
                {washingItems.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        Der Wäschekorb ist leer.
                    </Typography>
                )}
            </List>
        </DialogContent>
        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            <Button onClick={onClose} color="inherit">Schließen</Button>
            {washingItems.length > 0 && (
                <Button variant="contained" onClick={onWashAll} sx={{ bgcolor: PALETTE.accents.blue }}>
                    Alles waschen ({washingItems.length})
                </Button>
            )}
        </DialogActions>
    </Dialog>
  );
}