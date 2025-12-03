import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    CircularProgress,
    Typography,
    Box,
    LinearProgress
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Pending as PendingIcon
} from '@mui/icons-material';
import { EmailStatus } from '../services/emailService';

interface EmailStatusTrackerProps {
    statuses: EmailStatus[];
    open: boolean;
    onClose: () => void;
}

const EmailStatusTracker: React.FC<EmailStatusTrackerProps> = ({
    statuses,
    open,
    onClose
}) => {
    const total = statuses.length;
    const sent = statuses.filter(s => s.status === 'sent').length;
    const failed = statuses.filter(s => s.status === 'failed').length;
    const pending = statuses.filter(s => s.status === 'pending').length;
    const sending = statuses.filter(s => s.status === 'sending').length;

    const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;
    const isFinished = pending === 0 && sending === 0;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'sent':
                return <CheckCircleIcon color="success" />;
            case 'failed':
                return <ErrorIcon color="error" />;
            case 'sending':
                return <CircularProgress size={20} />;
            default:
                return <PendingIcon color="disabled" />;
        }
    };

    const getStatusText = (status: string, error?: string) => {
        switch (status) {
            case 'sent':
                return 'تم الإرسال بنجاح';
            case 'failed':
                return `فشل الإرسال: ${error || 'خطأ غير معروف'}`;
            case 'sending':
                return 'جاري الإرسال...';
            default:
                return 'في الانتظار';
        }
    };

    return (
        <Dialog open={open} maxWidth="md" fullWidth>
            <DialogTitle>
                حالة إرسال الإيميلات
                <Typography component="div" variant="subtitle2" color="textSecondary">
                    {isFinished
                        ? `اكتملت العملية: ${sent} نجاح، ${failed} فشل`
                        : `جاري المعالجة: ${sent + failed} من ${total}`}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 2 }}>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        color={failed > 0 ? "warning" : "primary"}
                        sx={{ height: 10, borderRadius: 5 }}
                    />
                </Box>

                <List sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
                    {statuses.map((status) => (
                        <ListItem key={status.professorId} divider>
                            <ListItemIcon>
                                {getStatusIcon(status.status)}
                            </ListItemIcon>
                            <ListItemText
                                primary={status.professorName}
                                secondary={
                                    <React.Fragment>
                                        <Typography component="span" variant="body2" color="textPrimary">
                                            {status.email}
                                        </Typography>
                                        {" — " + getStatusText(status.status, status.error)}
                                    </React.Fragment>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={!isFinished} variant="contained">
                    إغلاق
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EmailStatusTracker;
