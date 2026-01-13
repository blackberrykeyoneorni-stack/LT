import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemAvatar, Avatar, ListItemText } from '@mui/material';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import { DESIGN_TOKENS, PALETTE } from '../../theme/obsidianDesign'; // NEU

export default function LaundryDialog({ open, onClose, washingItems, onWashItem, onWashAll }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={DESIGN_TOKENS.dialog.paper}>
        <DialogTitle sx={{ ...DESIGN_TOKENS.dialog.title.sx, color: PALETTE.accents.blue }}>
            <LocalLaundryServiceIcon color="inherit" /> Wäschekorb
        </DialogTitle>
        <DialogContent dividers sx={DESIGN_TOKENS.dialog.content.sx}>
            <List>
                {washingItems.map(item => (
                    <ListItem key={item.id} secondaryAction={
                        <Button size="small" variant="outlined" onClick={() => onWashItem(item.id)} startIcon={<RestoreFromTrashIcon />} 
                                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'text.primary' }}>
                            Waschen
                        </Button>
                    }>
                        <ListItemAvatar><Avatar src={item.imageUrl} variant="rounded" /></ListItemAvatar>
                        <ListItemText primary={item.name || item.brand} secondary={`${item.subCategory} • ID: ${item.customId || item.id}`} />
                    </ListItem>
                ))}
            </List>
        </DialogContent>
        <DialogActions sx={DESIGN_TOKENS.dialog.actions.sx}>
            <Button onClick={onClose} color="inherit">Schließen</Button>
            <Button variant="contained" onClick={onWashAll} sx={{ bgcolor: PALETTE.accents.blue }}>Alles waschen</Button>
        </DialogActions>
    </Dialog>
  );
}