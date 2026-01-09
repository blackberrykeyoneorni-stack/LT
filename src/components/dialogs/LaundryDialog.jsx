import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemAvatar, Avatar, ListItemText } from '@mui/material';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';

export default function LaundryDialog({ 
  open, 
  onClose, 
  washingItems, 
  onWashItem, 
  onWashAll 
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalLaundryServiceIcon color="info" /> Wäschekorb
        </DialogTitle>
        <DialogContent dividers>
            <List>
                {washingItems.map(item => (
                    <ListItem key={item.id} secondaryAction={
                        <Button size="small" variant="outlined" onClick={() => onWashItem(item.id)} startIcon={<RestoreFromTrashIcon />}>
                            Waschen
                        </Button>
                    }>
                        <ListItemAvatar>
                            <Avatar src={item.imageUrl || (item.images && item.images[0])} variant="rounded" />
                        </ListItemAvatar>
                        <ListItemText 
                            primary={item.name || item.brand} 
                            secondary={item.subCategory} 
                        />
                    </ListItem>
                ))}
            </List>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Schließen</Button>
            <Button variant="contained" color="primary" onClick={onWashAll}>Alles waschen</Button>
        </DialogActions>
    </Dialog>
  );
}
