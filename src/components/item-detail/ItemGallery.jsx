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
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [currentFullscreenIndex, setCurrentFullscreenIndex] = useState(0);

    const images = displayImages && displayImages.length > 0 
        ? displayImages 
        : (item.images && item.images.length > 0 ? item.images : [item.imageUrl].filter(Boolean));
    
    return (
        <Box sx={{ position: 'relative', height: 400, bgcolor: '#000', overflow: 'hidden' }}>
            {images.length > 0 ? (
                <Swiper modules={[Navigation, Pagination]} spaceBetween={0} slidesPerView={1} navigation pagination={{ clickable: true }} style={swiperStyles} loop={images.length > 1}>
                    {images.map((img, index) => (
                        <SwiperSlide key={index}>
                            <img src={img} alt={`Bild ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isEditing ? 0.6 : 1, transition: 'opacity 0.3s' }} onClick={() => { if (!isEditing) { setCurrentFullscreenIndex(index); setOverlayOpen(true); } }} />
                        </SwiperSlide>
                    ))}
                </Swiper>
            ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#333' }}><PhotoCamera sx={{ fontSize: 60, mb: 2 }} /><Typography>Kein Bild</Typography></Box>
            )}

            <Box sx={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover':{bgcolor:'rgba(0,0,0,0.8)'} }}><ArrowBackIcon /></IconButton>
                <Stack direction="row" spacing={1}>
                    {isEditing && (
                        <IconButton component="label" sx={{ bgcolor: PALETTE.accents.green, color: 'black', '&:hover':{bgcolor: PALETTE.primary.main} }}><AddAPhotoIcon /><input type="file" hidden accept="image/*" multiple onChange={onAddImages} /></IconButton>
                    )}
                    <IconButton onClick={onWriteNFC} sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover':{bgcolor:'rgba(0,0,0,0.8)'} }}><NfcIcon /></IconButton>
                    <IconButton onClick={isEditing ? onSave : onToggleEdit} sx={{ bgcolor: isEditing ? PALETTE.primary.main : 'rgba(0,0,0,0.6)', color: isEditing ? 'black' : 'white', '&:hover':{bgcolor: isEditing ? PALETTE.primary.dark : 'rgba(0,0,0,0.8)'} }}>{isEditing ? <SaveIcon /> : <EditIcon />}</IconButton>
                </Stack>
            </Box>
            
            <Dialog fullScreen open={overlayOpen} onClose={() => setOverlayOpen(false)}>
                <Box sx={{ height: '100%', bgcolor: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                    <IconButton onClick={() => setOverlayOpen(false)} sx={{ position: 'absolute', top: 16, right: 16, color: 'white', zIndex: 20 }}><CloseIcon /></IconButton>
                    {images.length > 0 && (
                        <Swiper modules={[Navigation, Pagination]} initialSlide={currentFullscreenIndex} spaceBetween={20} slidesPerView={1} navigation pagination={{ clickable: true }} style={swiperStyles}>
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