import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Card,
  CardContent,
  Grid,
  Divider
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

interface BackupRecord {
  id: number;
  backup_name: string;
  backup_path: string;
  backup_type: string;
  backup_format: string;
  file_size: number;
  created_by: number;
  created_by_username?: string;
  created_at: string;
}

export default function BackupRestore() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [backupFormat, setBackupFormat] = useState('json');
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const { user } = useAuth();

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const history = await window.db.getBackupHistory();
      setBackups(history || []);
      setError('');
    } catch (err: any) {
      console.error('Error loading backups:', err);
      setError('فشل تحميل سجل النسخ الاحتياطية');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setError('');
      
      await window.db.createBackup({
        format: backupFormat,
        userId: user?.id || 1,
        type: 'full'
      });

      setSuccess('تم إنشاء النسخة الاحتياطية بنجاح');
      setCreateDialogOpen(false);
      await loadBackups();
    } catch (err: any) {
      console.error('Error creating backup:', err);
      setError('فشل إنشاء النسخة الاحتياطية: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      setLoading(true);
      setError('');
      
      await window.db.restoreBackup({
        backupPath: selectedBackup.backup_path,
        mode: restoreMode
      });

      setSuccess('تم استعادة النسخة الاحتياطية بنجاح');
      setRestoreDialogOpen(false);
      setSelectedBackup(null);
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      setError('فشل استعادة النسخة الاحتياطية: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) return;

    try {
      setLoading(true);
      await window.db.deleteBackup(backupId);
      setSuccess('تم حذف النسخة الاحتياطية بنجاح');
      await loadBackups();
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      setError('فشل حذف النسخة الاحتياطية');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* رأس الصفحة */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          إدارة النسخ الاحتياطي
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<BackupIcon />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={loading}
        >
          إنشاء نسخة احتياطية
        </Button>
      </Box>

      {/* إحصائيات سريعة */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                إجمالي النسخ
              </Typography>
              <Typography variant="h4">{backups.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                الحجم الإجمالي
              </Typography>
              <Typography variant="h4">
                {formatFileSize(backups.reduce((sum, b) => sum + (b.file_size || 0), 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                آخر نسخة
              </Typography>
              <Typography variant="h6">
                {backups.length > 0 
                  ? format(new Date(backups[0].created_at), 'PPp', { locale: ar })
                  : 'لا يوجد'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* رسائل */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* جدول النسخ */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>الاسم</TableCell>
              <TableCell>النوع</TableCell>
              <TableCell>الصيغة</TableCell>
              <TableCell>الحجم</TableCell>
              <TableCell>أنشئ بواسطة</TableCell>
              <TableCell>التاريخ</TableCell>
              <TableCell align="center">الإجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary" sx={{ py: 3 }}>
                    لا توجد نسخ احتياطية
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>{backup.backup_name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={backup.backup_type === 'full' ? 'كامل' : 'جزئي'} 
                      color={backup.backup_type === 'full' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{backup.backup_format.toUpperCase()}</TableCell>
                  <TableCell>{formatFileSize(backup.file_size)}</TableCell>
                  <TableCell>{backup.created_by_username || '---'}</TableCell>
                  <TableCell>
                    {format(new Date(backup.created_at), 'PPp', { locale: ar })}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="primary"
                      onClick={() => {
                        setSelectedBackup(backup);
                        setRestoreDialogOpen(true);
                      }}
                      title="استعادة"
                    >
                      <RestoreIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteBackup(backup.id)}
                      title="حذف"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* مربع حوار إنشاء نسخة */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إنشاء نسخة احتياطية جديدة</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>صيغة النسخة</InputLabel>
              <Select
                value={backupFormat}
                label="صيغة النسخة"
                onChange={(e) => setBackupFormat(e.target.value)}
              >
                <MenuItem value="json">JSON</MenuItem>
                <MenuItem value="sql">SQL</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 2 }}>
              سيتم إنشاء نسخة احتياطية كاملة من كل بيانات النظام
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>إلغاء</Button>
          <Button 
            onClick={handleCreateBackup} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            إنشاء
          </Button>
        </DialogActions>
      </Dialog>

      {/* مربع حوار استعادة نسخة */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>استعادة نسخة احتياطية</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedBackup && (
              <>
                <Typography variant="body2" gutterBottom>
                  <strong>الاسم:</strong> {selectedBackup.backup_name}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>التاريخ:</strong> {format(new Date(selectedBackup.created_at), 'PPp', { locale: ar })}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <FormControl fullWidth>
                  <InputLabel>وضع الاستعادة</InputLabel>
                  <Select
                    value={restoreMode}
                    label="وضع الاستعادة"
                    onChange={(e) => setRestoreMode(e.target.value as 'replace' | 'merge')}
                  >
                    <MenuItem value="replace">استبدال البيانات الحالية</MenuItem>
                    <MenuItem value="merge">دمج مع البيانات الحالية</MenuItem>
                  </Select>
                </FormControl>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {restoreMode === 'replace' 
                    ? 'تحذير: سيتم حذف كل البيانات الحالية!'
                    : 'سيتم دمج البيانات مع البيانات الحالية'
                  }
                </Alert>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>إلغاء</Button>
          <Button 
            onClick={handleRestoreBackup} 
            variant="contained" 
            color="warning"
            disabled={loading}
          >
            استعادة
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}