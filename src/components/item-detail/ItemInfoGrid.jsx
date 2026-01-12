import React from 'react';
import { 
    Grid, Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, 
    Rating, OutlinedInput, Chip, InputBase 
} from '@mui/material';
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

// --- UNIFIED FIELD KOMPONENTE ---
// Handhabt intelligent den Wechsel zwischen Anzeige (Text) und Bearbeitung (Input)
const UnifiedField = ({ 
    label, value, icon, isEditing, 
    onChange, type = "text", options = [], 
    multiline = false, rows = 1 
}) => {
    return (
        <Box sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(255,255,255,0.03)', 
            borderRadius: 1, 
            height: '100%', 
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, opacity: 0.7 }}>
                {icon} {label}
            </Typography>

            {isEditing ? (
                type === 'select' ? (
                    <Select
                        value={value || ''}
                        onChange={onChange}
                        variant="standard"
                        disableUnderline
                        displayEmpty
                        sx={{ 
                            color: '#fff', 
                            fontSize: '1rem', 
                            fontWeight: 500,
                            '& .MuiSelect-select': { py: 0 }
                        }}
                    >
                        {options.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                    </Select>
                ) : type === 'rating' ? (
                    <Rating 
                        value={parseInt(value) || 0} 
                        onChange={(e, v) => onChange({ target: { value: v } })} 
                        size="small" 
                    />
                ) : (
                    <InputBase
                        value={value || ''}
                        onChange={onChange}
                        type={type}
                        multiline={multiline}
                        rows={rows}
                        fullWidth
                        placeholder="-"
                        sx={{ 
                            color: '#fff', 
                            fontSize: '1rem', 
                            fontWeight: 500,
                            padding: 0
                        }}
                    />
                )
            ) : (
                type === 'rating' ? (
                    <Rating value={parseInt(value) || 0} readOnly size="small" />
                ) : (
                    <Typography variant="body1" sx={{ fontWeight: 500, color: '#fff', whiteSpace: 'pre-wrap' }}>
                        {type === 'date' && value ? new Date(value).toLocaleDateString() : (value || '-')}
                    </Typography>
                )
            )}
        </Box>
    );
};

export default function ItemInfoGrid({ isEditing, formData, item, setFormData, dropdowns }) {
    
    // Fallback, falls dropdowns noch nicht geladen sind oder Struktur fehlt
    const safeDropdowns = dropdowns || { brands: [], materials: [], locations: [], categories: [], vibeTagsList: [] };
    
    // Dynamische Sub-Kategorien Logik
    const availableSubCats = (safeDropdowns.categoryStructure && formData?.mainCategory) 
        ? (safeDropdowns.categoryStructure[formData.mainCategory] || [])
        : (safeDropdowns.categories || []);

    // Helper für Form-Updates
    const handleChange = (field, val) => {
        if (setFormData) {
            setFormData(prev => ({ ...prev, [field]: val }));
        }
    };

    const displayItem = isEditing ? formData : item;

    return (
        <>
            {/* Header / Titel Area */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                {isEditing ? (
                    <TextField 
                        label="Bezeichnung / Name" 
                        variant="outlined" 
                        fullWidth 
                        value={formData.name || ''} 
                        onChange={e => handleChange('name', e.target.value)} 
                        sx={{ '& .MuiInputBase-input': { fontSize: '1.2rem', textAlign: 'center' } }}
                    />
                ) : (
                    <>
                        <Typography variant="overline" color="primary" sx={{ letterSpacing: 2, fontWeight: 'bold' }}>
                            {displayItem.brand ? displayItem.brand.toUpperCase() : 'NO BRAND'}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                            {displayItem.name}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {displayItem.model}
                        </Typography>
                    </>
                )}
            </Box>

            <Grid container spacing={2}>
                {/* ROW 1: ID & DATE */}
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Custom ID" 
                        value={displayItem.customId} 
                        icon={<LabelIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('customId', e.target.value)}
                    />
                </Grid>
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Erworben" 
                        value={displayItem.purchaseDate} 
                        type="date"
                        icon={<CalendarMonthIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('purchaseDate', e.target.value)}
                    />
                </Grid>

                {/* ROW 2: BRAND & MODEL */}
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Marke" 
                        value={displayItem.brand} 
                        type="select"
                        options={safeDropdowns.brands}
                        icon={<BrandingWatermarkIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('brand', e.target.value)}
                    />
                </Grid>
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Modell" 
                        value={displayItem.model} 
                        icon={<StyleIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('model', e.target.value)}
                    />
                </Grid>

                {/* ROW 3: CATEGORIES */}
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Kategorie" 
                        value={displayItem.mainCategory} 
                        type="select"
                        options={["Nylons", "Dessous", "Accessoires", "Schuhe"]}
                        icon={<CategoryIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => {
                            handleChange('mainCategory', e.target.value);
                            handleChange('subCategory', ''); // Reset Subcat bei Wechsel
                        }}
                    />
                </Grid>
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Typ / Sub" 
                        value={displayItem.subCategory} 
                        type="select"
                        options={availableSubCats}
                        icon={<CategoryIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('subCategory', e.target.value)}
                    />
                </Grid>

                {/* ROW 4: PRICE & MATERIAL */}
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Preis" 
                        value={displayItem.cost} 
                        type={isEditing ? "number" : "text"}
                        icon={<AttachMoneyIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('cost', e.target.value)}
                    />
                </Grid>
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Material" 
                        value={displayItem.material} 
                        type="select"
                        options={safeDropdowns.materials}
                        icon={<Inventory2Icon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('material', e.target.value)}
                    />
                </Grid>

                {/* ROW 5: CONDITION & PERIOD */}
                <Grid item xs={6}>
                    <UnifiedField 
                        label="Zustand" 
                        value={displayItem.condition} 
                        type="rating"
                        isEditing={isEditing}
                        onChange={e => handleChange('condition', e.target.value)}
                    />
                </Grid>
                <Grid item xs={6}>
                     <UnifiedField 
                        label="Tragezeit" 
                        value={displayItem.suitablePeriod} 
                        type="select"
                        options={["Tag", "Nacht", "Beide"]}
                        icon={<AccessTimeIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('suitablePeriod', e.target.value)}
                    />
                </Grid>

                {/* ROW 6: LOCATION */}
                <Grid item xs={12}>
                    <UnifiedField 
                        label="Lagerort" 
                        value={displayItem.location || displayItem.storageLocation} 
                        type="select"
                        options={safeDropdowns.locations}
                        icon={<LocationOnIcon fontSize="inherit"/>}
                        isEditing={isEditing}
                        onChange={e => handleChange('location', e.target.value)}
                    />
                </Grid>
            </Grid>

            {/* FULL WIDTH: NOTES & VIBE TAGS */}
            <Box sx={{ mt: 3 }}>
                {isEditing ? (
                    <Box>
                        <UnifiedField 
                            label="Notizen" 
                            value={formData.notes}
                            multiline
                            rows={3}
                            icon={<NotesIcon fontSize="inherit" />}
                            isEditing={true}
                            onChange={e => handleChange('notes', e.target.value)}
                        />
                        
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>Vibe Tags</InputLabel>
                            <Select
                                multiple
                                value={Array.isArray(formData.vibeTags) ? formData.vibeTags : []}
                                onChange={(e) => {
                                    const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                                    handleChange('vibeTags', val);
                                }}
                                input={<OutlinedInput label="Vibe Tags" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => <Chip key={value} label={value} size="small" />)}
                                    </Box>
                                )}
                            >
                                {safeDropdowns.vibeTagsList && safeDropdowns.vibeTagsList.map((tag) => (
                                    <MenuItem key={tag} value={tag}>{tag}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                ) : (
                    <>
                    {displayItem.vibeTags && displayItem.vibeTags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, justifyContent: 'center' }}>
                            {displayItem.vibeTags.map(tag => (
                                <Chip key={tag} label={tag} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', border: 'none' }} />
                            ))}
                        </Box>
                    )}
                    {displayItem.notes && (
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, display:'flex', gap:1 }}>
                            <NotesIcon color="action" fontSize="small" />
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                "{displayItem.notes}"
                            </Typography>
                        </Box>
                    )}
                    </>
                )}
            </Box>
        </>
    );
}
