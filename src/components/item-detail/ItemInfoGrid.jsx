import React from 'react';
import { Grid, Box, Typography, TextField, Select, Rating, InputBase } from '@mui/material';
import LabelIcon from '@mui/icons-material/Label';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import StyleIcon from '@mui/icons-material/Style';
import CategoryIcon from '@mui/icons-material/Category';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotesIcon from '@mui/icons-material/Notes';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { PALETTE, DESIGN_TOKENS } from '../../theme/obsidianDesign';

const UnifiedField = ({ label, value, icon, isEditing, onChange, type = "text", options = [], multiline = false, rows = 1 }) => {
    return (
        <Box sx={{ 
            p: 1.5, ...DESIGN_TOKENS.glassCard, borderRadius: 2, height: '100%', 
            display: 'flex', flexDirection: 'column', justifyContent: 'center'
        }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: PALETTE.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {icon} {label}
            </Typography>
            {isEditing ? (
                type === 'select' ? (
                    <Select 
                        native
                        fullWidth // Hitbox-Sicherung
                        value={value || ''} 
                        onChange={onChange} 
                        variant="standard" 
                        disableUnderline 
                        displayEmpty 
                        sx={{ 
                            bgcolor: 'rgba(0,0,0,0.3)', // Verhindert 0-Pixel-Kollaps durch visuelle Präsenz
                            borderRadius: 1, 
                            px: 1, 
                            py: 0.5, 
                            color: '#fff', 
                            fontSize: '1rem', 
                            fontWeight: 500,
                            position: 'relative',
                            zIndex: 1 
                        }}
                    >
                        <option value="" style={{ background: '#111', color: '#fff' }}></option>
                        {options.map(opt => <option key={opt} value={opt} style={{ background: '#111', color: '#fff' }}>{opt}</option>)}
                    </Select>
                ) : type === 'rating' ? (
                    <Rating value={parseInt(value) || 0} onChange={(e, v) => onChange({ target: { value: v } })} size="small" sx={{ color: PALETTE.primary.main, position: 'relative', zIndex: 1 }} />
                ) : (
                    <InputBase 
                        fullWidth // Hitbox-Sicherung
                        value={value || ''} 
                        onChange={onChange} 
                        type={type} 
                        multiline={multiline} 
                        rows={rows} 
                        placeholder="-" 
                        sx={{ 
                            bgcolor: 'rgba(0,0,0,0.3)', // Verhindert 0-Pixel-Kollaps
                            borderRadius: 1, 
                            px: 1, 
                            py: 0.5, 
                            color: '#fff', 
                            fontSize: '1rem', 
                            fontWeight: 500,
                            position: 'relative',
                            zIndex: 1
                        }} 
                    />
                )
            ) : (
                type === 'rating' ? <Rating value={parseInt(value) || 0} readOnly size="small" sx={{ color: PALETTE.primary.main }} /> : <Typography variant="body1" sx={{ fontWeight: 700, color: '#fff', textShadow: '0 0 5px rgba(255,255,255,0.2)' }}>{type === 'date' && value ? new Date(value).toLocaleDateString() : (value || '-')}</Typography>
            )}
        </Box>
    );
};

export default function ItemInfoGrid({ isEditing, formData, item, setFormData, dropdowns }) {
    const safeDropdowns = dropdowns || { brands: [], materials: [], locations: [], categories: [] };
    const availableSubCats = (safeDropdowns.categoryStructure && formData?.mainCategory) ? (safeDropdowns.categoryStructure[formData.mainCategory] || []) : (safeDropdowns.categories || []);
    const handleChange = (field, val) => { if (setFormData) setFormData(prev => ({ ...prev, [field]: val })); };
    const displayItem = isEditing ? formData : item;

    return (
        <>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                {isEditing ? (
                    <TextField 
                        label="Name" 
                        variant="outlined" 
                        fullWidth 
                        value={formData.name || ''} 
                        onChange={e => handleChange('name', e.target.value)} 
                        sx={{ 
                            position: 'relative', 
                            zIndex: 1, 
                            '& .MuiInputBase-input': { fontSize: '1.2rem', textAlign: 'center' } 
                        }} 
                    />
                ) : (
                    <>
                        <Typography variant="overline" sx={{ color: PALETTE.primary.main, letterSpacing: 3, fontWeight: 900 }}>{displayItem.brand ? displayItem.brand.toUpperCase() : 'NO BRAND'}</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, color: '#FFF', textShadow: `0 0 15px ${PALETTE.primary.main}80` }}>{displayItem.name}</Typography>
                        <Typography variant="body1" sx={{ color: PALETTE.text.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>{displayItem.model}</Typography>
                    </>
                )}
            </Box>
            <Grid container spacing={2}>
                <Grid item xs={6}><UnifiedField label="Custom ID" value={displayItem.customId} icon={<LabelIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('customId', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Erworben" value={displayItem.purchaseDate} type="date" icon={<CalendarMonthIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('purchaseDate', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Marke" value={displayItem.brand} type="select" options={safeDropdowns.brands} icon={<BrandingWatermarkIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('brand', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Modell" value={displayItem.model} icon={<StyleIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('model', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Kategorie" value={displayItem.mainCategory} type="select" options={["Nylons", "Dessous", "Accessoires", "Schuhe"]} icon={<CategoryIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => { handleChange('mainCategory', e.target.value); handleChange('subCategory', ''); }}/></Grid>
                <Grid item xs={6}><UnifiedField label="Typ / Sub" value={displayItem.subCategory} type="select" options={availableSubCats} icon={<CategoryIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('subCategory', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Preis" value={displayItem.cost} type={isEditing ? "number" : "text"} icon={<AttachMoneyIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('cost', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Material" value={displayItem.material} type="select" options={safeDropdowns.materials} icon={<Inventory2Icon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('material', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Zustand" value={displayItem.condition} type="rating" isEditing={isEditing} onChange={e => handleChange('condition', e.target.value)}/></Grid>
                <Grid item xs={6}><UnifiedField label="Tragezeit" value={displayItem.suitablePeriod} type="select" options={["Tag", "Nacht", "Beide"]} icon={<AccessTimeIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('suitablePeriod', e.target.value)}/></Grid>
                <Grid item xs={12}><UnifiedField label="Lagerort" value={displayItem.location || displayItem.storageLocation} type="select" options={safeDropdowns.locations} icon={<LocationOnIcon fontSize="inherit"/>} isEditing={isEditing} onChange={e => handleChange('location', e.target.value)}/></Grid>
            </Grid>
            <Box sx={{ mt: 3 }}>
                {isEditing ? (
                    <Box>
                        <UnifiedField label="Notizen" value={formData.notes} multiline rows={3} icon={<NotesIcon fontSize="inherit" />} isEditing={true} onChange={e => handleChange('notes', e.target.value)}/>
                    </Box>
                ) : (
                    <>
                    {displayItem.notes && (<Box sx={{ p: 2, ...DESIGN_TOKENS.glassCard, borderRadius: 2, display:'flex', gap:1 }}><NotesIcon sx={{ color: PALETTE.text.secondary, fontSize: 'small' }} /><Typography variant="body2" sx={{ color: PALETTE.text.secondary, fontStyle: 'italic' }}>"{displayItem.notes}"</Typography></Box>)}
                    </>
                )}
            </Box>
        </>
    );
}