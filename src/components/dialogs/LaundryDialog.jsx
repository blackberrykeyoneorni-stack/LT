import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  List, 
  ListItem, 
  ListItemAvatar, 
  Avatar, 
  ListItemText, 
  Typography 
} from '@mui/material';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign';

/**
 * LaundryDialog - Audit-Version
 * Fix: "Fatal Startup Error" durch Default-Parameter für washingItems
 */
export default function LaundryDialog({ 
  open, 
  onClose, 
  washingItems = [], // Sicherheitsnetz: Standardmäßig ein leeres Array
  onWashItem, 
  onWashAll 
}) {
  
  // Sicherstellen, dass wir immer mit einem Array arbeiten, 
  // selbst wenn die Props fehlerhaft sind.
  const items = Array.isArray(washingItems) ? washingItems : [];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm" 
      PaperProps={DESIGN_TOKENS.dialog.paper}
    >
        <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.blue, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalLaundryServiceIcon color="inherit" /> Wäschekorb
        </DialogTitle>
        
        <DialogContent dividers sx={DESIGN_TOKENS.dialog.content.sx}>
            <List>
                {/* Sicherer Loop über das validierte Array */}
                {items.map(item => (
                    <ListItem 
                      key={item?.id || Math.random()} 
                      alignItems="flex-start" 
                      secondaryAction={
                        <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => onWashItem && onWashItem(item.id)} 
                            startIcon={<RestoreFromTrashIcon fontSize="small" />} 
                            sx={{ 
                                borderColor: 'rgba(255,255,255,0.2)', 
                                color: 'text.primary',
                                minWidth: 'auto',
                                px: 1.5,
                                fontSize: '0.75rem',
                                ml: 1
                            }}
                        >
                            Waschen
                        </Button>
                    }>
                        <ListItemAvatar>
                            <Avatar 
                              src={item?.imageUrl} 
                              variant="rounded" 
                              sx={{ width: 50, height: 50, mr: 2, mt: 0.5 }} 
                            />
                        </ListItemAvatar>
                        <ListItemText 
                            primary={
                                <Typography variant="subtitle2" component="div" sx={{ fontWeight: 'bold' }}>
                                    {item?.name || item?.brand || 'Unbekanntes Teil'}
                                </Typography>
                            } 
                            secondary={
                                <>
                                    <Typography component="span" variant="body2" display="block" color="text.secondary">
                                        {item?.subCategory || 'Keine Kategorie'}
                                    </Typography>
                                    <Typography component="span" variant="caption" display="block" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                        ID: {item?.customId || item?.id || 'N/A'}
                                    </Typography>
                                </>
                            } 
                        />
                    </ListItem>
                ))}

                {/* Sicherer Check der Länge */}
                {items.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        Der Wäschekorb ist leer oder Daten werden geladen.
                    </Typography>
                )}
            </List>
        </DialogContent>

        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            <Button onClick={onClose} color="inherit">Schließen</Button>
            {items.length > 0 && (
                <Button 
                  variant="contained" 
                  onClick={onWashAll} 
                  sx={{ bgcolor: PALETTE.accents.blue }}
                >
                    Alles waschen ({items.length})
                </Button>
            )}
        </DialogActions>
    </Dialog>
  );
}