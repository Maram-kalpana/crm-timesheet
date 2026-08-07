import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogActions, Box, Typography, IconButton } from '@mui/material';
import { Camera, RotateCcw, Check, X } from 'lucide-react';
import Button from './Button';

const CameraCapture = ({ open, onClose, onConfirm, title = 'Capture Selfie', confirmLoading }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setPhoto(null);
      setError('');
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permission to continue.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const handleRetake = () => {
    setPhoto(null);
    startCamera();
  };

  const handleConfirmClick = async () => {
    const blob = await (await fetch(photo)).blob();
    onConfirm(blob);
  };

  const handleClose = () => {
    stopCamera();
    setPhoto(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <Box display="flex" alignItems="center" justifyContent="space-between" px={3} pt={3}>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        <IconButton size="small" onClick={handleClose}><X size={20} /></IconButton>
      </Box>
      <DialogContent>
        {error ? (
          <Box textAlign="center" py={4}>
            <Typography color="error" mb={2}>{error}</Typography>
            <Button variant="outlined" onClick={startCamera}>Retry</Button>
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden',
              bgcolor: '#000', position: 'relative',
            }}
          >
            {!photo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            ) : (
              <Box component="img" src={photo} alt="Captured selfie" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </Box>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!error && (
          !photo ? (
            <Button fullWidth startIcon={<Camera size={18} />} onClick={handleCapture}>
              Capture Photo
            </Button>
          ) : (
            <Box display="flex" gap={2} width="100%">
              <Button fullWidth variant="outlined" startIcon={<RotateCcw size={18} />} onClick={handleRetake} disabled={confirmLoading}>
                Retake
              </Button>
              <Button fullWidth startIcon={<Check size={18} />} onClick={handleConfirmClick} loading={confirmLoading}>
                Confirm
              </Button>
            </Box>
          )
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CameraCapture;