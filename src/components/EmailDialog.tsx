import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Checkbox,
    FormControlLabel,
    Box,
    Divider,
    Alert
} from '@mui/material';

interface Professor {
    id: number;
    name: string;
    email?: string;
}

interface EmailDialogProps {
    open: boolean;
    onClose: () => void;
    professors: Professor[];
    onSend: (selectedIds: number[]) => void | Promise<void>;
    isSending: boolean;
}

const EmailDialog: React.FC<EmailDialogProps> = ({
    open,
    onClose,
    professors,
    onSend,
    isSending
}) => {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [sendToAll, setSendToAll] = useState(false);

    // Filter professors with email
    const professorsWithEmail = professors.filter(p => p.email && p.email.trim() !== '');
    const professorsWithoutEmail = professors.filter(p => !p.email || p.email.trim() === '');

    useEffect(() => {
        if (open) {
            setSelectedIds([]);
            setSendToAll(false);
        }
    }, [open]);

    const handleToggleAll = (checked: boolean) => {
        setSendToAll(checked);
        if (checked) {
            setSelectedIds(professorsWithEmail.map(p => p.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleToggleProfessor = (id: number) => {
        const currentIndex = selectedIds.indexOf(id);
        const newChecked = [...selectedIds];

        if (currentIndex === -1) {
            newChecked.push(id);
        } else {
            newChecked.splice(currentIndex, 1);
        }

        setSelectedIds(newChecked);
        setSendToAll(newChecked.length === professorsWithEmail.length);
    };

    const handleSend = () => {
        onSend(selectedIds);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>إرسال الجداول عبر البريد الإلكتروني</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 2 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        سيتم إرسال الجداول الدراسية كملفات PDF مرفقة إلى الأساتذة المحددين.
                    </Alert>

                    {professorsWithoutEmail.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            يوجد {professorsWithoutEmail.length} أستاذ ليس لديهم بريد إلكتروني مسجل ولن يظهروا في القائمة.
                        </Alert>
                    )}

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={sendToAll}
                                onChange={(e) => handleToggleAll(e.target.checked)}
                                indeterminate={selectedIds.length > 0 && selectedIds.length < professorsWithEmail.length}
                            />
                        }
                        label={`تحديد الكل (${professorsWithEmail.length} أستاذ)`}
                    />
                </Box>

                <Divider />

                <List sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
                    {professorsWithEmail.map((professor) => {
                        const labelId = `checkbox-list-label-${professor.id}`;

                        return (
                            <ListItem
                                key={professor.id}
                                disablePadding
                            >
                                <ListItemButton role={undefined} onClick={() => handleToggleProfessor(professor.id)} dense>
                                    <Checkbox
                                        edge="start"
                                        checked={selectedIds.indexOf(professor.id) !== -1}
                                        tabIndex={-1}
                                        disableRipple
                                        inputProps={{ 'aria-labelledby': labelId }}
                                    />
                                    <ListItemText
                                        id={labelId}
                                        primary={professor.name}
                                        secondary={professor.email}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSending}>
                    إلغاء
                </Button>
                <Button
                    onClick={handleSend}
                    variant="contained"
                    disabled={selectedIds.length === 0 || isSending}
                    color="primary"
                >
                    {isSending ? 'جاري الإرسال...' : `إرسال (${selectedIds.length})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EmailDialog;
