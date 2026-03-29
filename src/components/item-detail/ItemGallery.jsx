import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Typography, Dialog, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import NfcIcon from '@mui/icons-material/Nfc';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { PALETTE } from '../../theme/obsidianDesign';
import { useSecurity } from '../../contexts/SecurityContext'; // NEU: Security Import

import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const swiperStyles = {
    '--swiper-pagination-color': PALETTE.primary.main,
    '--swiper-navigation-color': '#fff',
    width: '100%',
    height: '100%'
};

export default function ItemGallery({ item, isEditing, onToggleEdit, onSave, onWriteNFC, onAddImages, displayImages }) {
    const navigate = useNavigate();
    const { prepareSystemDialog } = useSecurity(); // NEU: Bypass-Funktion laden
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [currentFullscreenIndex, setCurrentFullscreenIndex] = useState(0);

    const images = displayImages && displayImages.length > 0 
        ? displayImages 
        : (item.images && item.images.length > 0 ? item.images : [item.imageUrl].filter(Boolean));
    
    return (
        <Box sx={{ 
            position: 'relative', height: 400, bgcolor: 'rgba(0,0,0,0.8)', overflow: 'hidden',
            borderBottom: `1px solid rgba(255, 0, 127, 0.3)`, boxShadow: `0 4px 30px rgba(255, 0, 127, 0.2)`
        }}>
            {images.length > 0 ? (
                <Swiper grabCursor={true} allowTouchMove={true} modules={[Navigation, Pagination]} spaceBetween={0} slidesPerView={1} navigation pagination={{ clickable: true }} style={swiperStyles} loop={images.length > 1}>
                    {images.map((img, index) => (
                        <SwiperSlide key={index}>
                            <img src={img} alt={`Bild ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isEditing ? 0.6 : 1, transition: 'opacity 0.3s' }} onClick={() => { if (!isEditing) { setCurrentFullscreenIndex(index); setOverlayOpen(true); } }} />
                        </SwiperSlide>
                    ))}
                </Swiper>
            ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: PALETTE.primary.main }}><PhotoCamera sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} /><Typography sx={{ opacity: 0.5, textTransform: 'uppercase', letterSpacing: 2 }}>Kein Bild</Typography></Box>
            )}

            <Box sx={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
                <IconButton onClick={() => navigate(-1)} sx={{ pointerEvents: 'auto', bgcolor: 'rgba(17,13,16,0.6)', backdropFilter: 'blur(4px)', color: 'white', '&:hover':{bgcolor:'rgba(17,13,16,0.9)'} }}><ArrowBackIcon /></IconButton>
                <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto' }}>
                    {isEditing && (
                        // NEU: prepareSystemDialog beim Klick auf den Button triggern
                        <IconButton component="label" onClick={prepareSystemDialog} sx={{ bgcolor: PALETTE.accents.blue, color: '#000', '&:hover':{bgcolor: '#FFF'} }}>
                            <AddAPhotoIcon />
                            <input type="file" hidden accept="image/*" multiple onChange={onAddImages} onClick={prepareSystemDialog} />
                        </IconButton>
                    )}
                    <IconButton onClick={onWriteNFC} sx={{ bgcolor: 'rgba(17,13,16,0.6)', backdropFilter: 'blur(4px)', color: PALETTE.accents.blue, border: `1px solid ${PALETTE.accents.blue}40`, '&:hover':{bgcolor:'rgba(17,13,16,0.9)'} }}><NfcIcon /></IconButton>
                    <IconButton onClick={isEditing ? onSave : onToggleEdit} sx={{ bgcolor: isEditing ? PALETTE.primary.main : 'rgba(17,13,16,0.6)', backdropFilter: 'blur(4px)', color: isEditing ? '#000' : PALETTE.primary.main, border: `1px solid ${PALETTE.primary.main}40`, '&:hover':{bgcolor: isEditing ? PALETTE.primary.dark : 'rgba(17,13,16,0.9)'} }}>{isEditing ? <SaveIcon /> : <EditIcon />}</IconButton>
                </Stack>
            </Box>
            
            <Dialog fullScreen open={overlayOpen} onClose={() => setOverlayOpen(false)}>
                <Box sx={{ height: '100%', bgcolor: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                    <IconButton onClick={() => setOverlayOpen(false)} sx={{ position: 'absolute', top: 16, right: 16, color: PALETTE.primary.main, zIndex: 20 }}><CloseIcon /></IconButton>
                    {images.length > 0 && (
                        <Swiper grabCursor={true} allowTouchMove={true} modules={[Navigation, Pagination]} initialSlide={currentFullscreenIndex} spaceBetween={20} slidesPerView={1} navigation pagination={{ clickable: true }} style={swiperStyles}>
                            {images.map((img, idx) => (
                                <SwiperSlide key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src={img} style={{ width: '100%', maxHeight: '100vh', objectFit: 'contain' }} alt="Fullscreen" /></SwiperSlide>
                            ))}
                        </Swiper>
                    )}
                </Box>
            </Dialog>
        </Box>
    );
}