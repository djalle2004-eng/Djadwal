import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid,
  InputAdornment
} from '@mui/material';
import {
  ClipboardList,
  Search,
  User,
  Activity,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name?: string;
  full_name?: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, actionFilter, entityFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      if (typeof window !== 'undefined' && window.db && typeof window.db.getAuditLogs === 'function') {
        data = await window.db.getAuditLogs();
      } else {
        const res = await fetch('/api/audit-logs');
        if (res.ok) {
          data = await res.json();
        }
      }
      setLogs(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError('فشل تحميل سجل الأنشطة');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Entity filter
    if (entityFilter !== 'all') {
      filtered = filtered.filter(log => log.entity_type === entityFilter);
    }

    setFilteredLogs(filtered);
    setPage(0);
  };

  const formatDateSafely = (dateStr?: string) => {
    if (!dateStr) return '---';
    try {
      const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, 'PPp', { locale: ar });
    } catch (e) {
      return dateStr;
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getActionColor = (action: string): "default" | "primary" | "success" | "error" | "warning" | "info" => {
    switch (action) {
      case 'login': return 'success';
      case 'logout': return 'default';
      case 'create': return 'primary';
      case 'update': return 'info';
      case 'delete': return 'error';
      case 'swap': return 'warning';
      case 'move': return 'info';
      case 'restore': return 'warning';
      case 'activate': return 'success';
      default: return 'default';
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: { [key: string]: string } = {
      'login': 'تسجيل دخول',
      'logout': 'تسجيل خروج',
      'create': 'إضافة',
      'update': 'تعديل',
      'delete': 'حذف',
      'swap': 'تبديل',
      'move': 'نقل',
      'restore': 'استرجاع',
      'activate': 'تفعيل'
    };
    return labels[action] || action;
  };

  const getEntityLabel = (entity: string): string => {
    const labels: { [key: string]: string } = {
      'user': 'مستخدم',
      'professor': 'أستاذ',
      'course': 'مقياس',
      'room': 'قاعة',
      'group': 'فوج',
      'assignment': 'حصة',
      'extra_session': 'حصة إضافية',
      'department': 'قسم',
      'specialization': 'تخصص',
      'academic_year': 'سنة دراسية',
      'semester': 'فصل',
      'print_settings': 'إعدادات الطباعة',
      'sandbox': 'مسودة تجربة'
    };
    return labels[entity] || entity;
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action).filter(Boolean)));
  const uniqueEntities = Array.from(new Set(logs.map(log => log.entity_type).filter(Boolean)));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          <ClipboardList style={{ display: 'inline', marginLeft: '8px', verticalAlign: 'middle' }} />
          سجل الأنشطة
        </Typography>
        <button
          onClick={loadAuditLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </Box>

      {/* Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <Activity style={{ display: 'inline', marginLeft: '8px' }} size={16} />
                إجمالي الأنشطة
              </Typography>
              <Typography variant="h4">{logs.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <User style={{ display: 'inline', marginLeft: '8px' }} size={16} />
                المستخدمون النشطون
              </Typography>
              <Typography variant="h4">
                {new Set(logs.map(l => l.user_id)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                اليوم
              </Typography>
              <Typography variant="h4">
                {logs.filter(l => {
                  const today = new Date().toDateString();
                  const logDate = new Date(l.created_at).toDateString();
                  return today === logDate;
                }).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                آخر نشاط
              </Typography>
              <Typography variant="body2">
                {logs.length > 0 
                  ? formatDateSafely(logs[0].created_at)
                  : 'لا يوجد'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>نوع العملية</InputLabel>
              <Select
                value={actionFilter}
                label="نوع العملية"
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <MenuItem value="all">الكل</MenuItem>
                {uniqueActions.map(action => (
                  <MenuItem key={action} value={action}>
                    {getActionLabel(action)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>نوع الكيان</InputLabel>
              <Select
                value={entityFilter}
                label="نوع الكيان"
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                <MenuItem value="all">الكل</MenuItem>
                {uniqueEntities.map(entity => (
                  <MenuItem key={entity} value={entity}>
                    {getEntityLabel(entity)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>الوقت</TableCell>
              <TableCell>المستخدم</TableCell>
              <TableCell>العملية</TableCell>
              <TableCell>الكيان</TableCell>
              <TableCell>التفاصيل</TableCell>
              <TableCell>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="textSecondary" sx={{ py: 3 }}>
                    لا توجد أنشطة
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((log) => (
                  <TableRow key={log.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">
                        {formatDateSafely(log.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {log.full_name || log.user_name || (log.user_id ? `مستخدم #${log.user_id}` : 'نظام')}
                        </Typography>
                        {log.full_name && log.user_name && log.full_name !== log.user_name && (
                          <Typography variant="caption" color="textSecondary">
                            @{log.user_name}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getActionLabel(log.action)}
                        color={getActionColor(log.action)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{getEntityLabel(log.entity_type)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.details || '---'}
                      </Typography>
                    </TableCell>
                    <TableCell>{log.ip_address || '---'}</TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredLogs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="عدد الصفوف:"
        />
      </TableContainer>
    </Box>
  );
}