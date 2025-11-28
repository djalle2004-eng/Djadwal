import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as KeyIcon,
  PersonOff as DisableIcon,
  PersonAdd as EnableIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { User, UserRole, UserFormData, Permission, RolePermissions } from '../types/shared';
import * as authService from '../services/authService';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionGuard } from '../components/PermissionGuard';

const Users: React.FC = () => {
  const { isAdmin } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [permissionsUserId, setPermissionsUserId] = useState<number | null>(null);
  const [userPermissions, setUserPermissions] = useState<RolePermissions>(getDefaultPermissions());

  // Form fields
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'staff',
    is_active: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  // Load users
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await authService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      showSnackbar('خطأ في تحميل المستخدمين', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        full_name: user.full_name,
        email: user.email || '',
        role: user.role,
        professor_id: user.professor_id,
        is_active: user.is_active,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role: 'staff',
        is_active: true,
      });
    }
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      full_name: '',
      email: '',
      role: 'staff',
      is_active: true,
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'اسم المستخدم مطلوب';
    }

    if (!editingUser && !formData.password) {
      newErrors.password = 'كلمة المرور مطلوبة';
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'الاسم الكامل مطلوب';
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'البريد الإلكتروني غير صحيح';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (editingUser) {
        await authService.updateUser(editingUser.id, formData);
        showSnackbar('تم تحديث المستخدم بنجاح', 'success');
      } else {
        await authService.addUser(formData);
        showSnackbar('تم إضافة المستخدم بنجاح', 'success');
      }

      handleCloseDialog();
      loadUsers();
    } catch (error: any) {
      showSnackbar(error.message || 'حدث خطأ', 'error');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

    try {
      await authService.deleteUser(userId);
      showSnackbar('تم حذف المستخدم بنجاح', 'success');
      loadUsers();
    } catch (error: any) {
      showSnackbar(error.message || 'حدث خطأ في الحذف', 'error');
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await authService.toggleUserStatus(userId, !currentStatus);
      showSnackbar(
        `تم ${!currentStatus ? 'تفعيل' : 'تعطيل'} المستخدم بنجاح`,
        'success'
      );
      loadUsers();
    } catch (error: any) {
      showSnackbar(error.message || 'حدث خطأ', 'error');
    }
  };

  const handleOpenPasswordDialog = (userId: number) => {
    setResetPasswordUserId(userId);
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setOpenPasswordDialog(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setErrors({ password: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'كلمة المرور غير متطابقة' });
      return;
    }

    try {
      if (resetPasswordUserId) {
        await authService.resetPassword(resetPasswordUserId, newPassword);
        showSnackbar('تم إعادة تعيين كلمة المرور بنجاح', 'success');
        setOpenPasswordDialog(false);
        setResetPasswordUserId(null);
      }
    } catch (error: any) {
      showSnackbar(error.message || 'حدث خطأ', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const getRoleLabel = (role: UserRole): string => {
    const roleLabels = {
      admin: 'مدير',
      schedule_manager: 'مدير جداول',
      staff: 'موظف',
      professor: 'أستاذ',
    };
    return roleLabels[role] || role;
  };

  const getRoleColor = (role: UserRole) => {
    const colors = {
      admin: 'error',
      schedule_manager: 'primary',
      staff: 'default',
      professor: 'success',
    };
    return colors[role] || 'default';
  };

  // دالة للحصول على الصلاحيات الافتراضية
  function getDefaultPermissions(): RolePermissions {
    const fullPermission: Permission = { view: true, create: true, update: true, delete: true };
    const readOnly: Permission = { view: true, create: false, update: false, delete: false };
    const noAccess: Permission = { view: false, create: false, update: false, delete: false };

    return {
      academic_years: readOnly,
      professors: readOnly,
      courses: readOnly,
      rooms: readOnly,
      groups: readOnly,
      departments: readOnly,
      sessions: readOnly,
      extra_sessions: readOnly,
      reports: readOnly,
      users: noAccess,
      settings: noAccess,
      backup: noAccess,
    };
  }

  // دالة للحصول على الصلاحيات حسب الدور
  function getRoleDefaultPermissions(role: UserRole): RolePermissions {
    const fullPermission: Permission = { view: true, create: true, update: true, delete: true };
    const readOnly: Permission = { view: true, create: false, update: false, delete: false };
    const noAccess: Permission = { view: false, create: false, update: false, delete: false };

    if (role === 'admin') {
      return {
        academic_years: fullPermission,
        professors: fullPermission,
        courses: fullPermission,
        rooms: fullPermission,
        groups: fullPermission,
        departments: fullPermission,
        sessions: fullPermission,
        extra_sessions: fullPermission,
        reports: fullPermission,
        users: fullPermission,
        settings: fullPermission,
        backup: fullPermission,
      };
    } else if (role === 'schedule_manager') {
      return {
        academic_years: readOnly,
        professors: fullPermission,
        courses: fullPermission,
        rooms: fullPermission,
        groups: fullPermission,
        departments: readOnly,
        sessions: fullPermission,
        extra_sessions: fullPermission,
        reports: fullPermission,
        users: noAccess,
        settings: readOnly,
        backup: readOnly,
      };
    } else if (role === 'staff') {
      return {
        academic_years: readOnly,
        professors: readOnly,
        courses: readOnly,
        rooms: readOnly,
        groups: readOnly,
        departments: readOnly,
        sessions: readOnly,
        extra_sessions: readOnly,
        reports: readOnly,
        users: noAccess,
        settings: noAccess,
        backup: noAccess,
      };
    } else { // professor
      return {
        academic_years: readOnly,
        professors: readOnly,
        courses: readOnly,
        rooms: readOnly,
        groups: readOnly,
        departments: readOnly,
        sessions: readOnly,
        extra_sessions: noAccess,
        reports: readOnly,
        users: noAccess,
        settings: noAccess,
        backup: noAccess,
      };
    }
  }

  // فتح نافذة إدارة الصلاحيات
  const handleOpenPermissionsDialog = async (user: User) => {
    setPermissionsUserId(user.id);

    // تحميل الصلاحيات المحفوظة أو استخدام الصلاحيات الافتراضية حسب الدور
    try {
      const savedPermissions = await window.db.getUserPermissions(user.id);
      if (savedPermissions) {
        setUserPermissions(JSON.parse(savedPermissions));
      } else {
        setUserPermissions(getRoleDefaultPermissions(user.role));
      }
    } catch (error) {
      setUserPermissions(getRoleDefaultPermissions(user.role));
    }

    setOpenPermissionsDialog(true);
  };

  // حفظ الصلاحيات
  const handleSavePermissions = async () => {
    if (!permissionsUserId) return;

    try {
      await window.db.saveUserPermissions(permissionsUserId, JSON.stringify(userPermissions));
      showSnackbar('تم حفظ الصلاحيات بنجاح', 'success');
      setOpenPermissionsDialog(false);
    } catch (error: any) {
      showSnackbar(error.message || 'حدث خطأ في حفظ الصلاحيات', 'error');
    }
  };

  // تحديث صلاحية معينة
  const updatePermission = (module: keyof RolePermissions, permission: keyof Permission, value: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [permission]: value,
      },
    }));
  };

  // تفعيل/تعطيل جميع الصلاحيات لوحدة معينة
  const toggleModuleAccess = (module: keyof RolePermissions, enable: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [module]: {
        view: enable,
        create: enable,
        update: enable,
        delete: enable,
      },
    }));
  };

  // أسماء الوحدات بالعربية
  const moduleNames: Record<keyof RolePermissions, string> = {
    academic_years: 'السنوات الدراسية',
    professors: 'الأساتذة',
    courses: 'المقاييس',
    rooms: 'القاعات',
    groups: 'الأفواج',
    departments: 'الأقسام',
    sessions: 'الحصص والجداول',
    extra_sessions: 'الحصص الإضافية',
    reports: 'التقارير والجداول',
    users: 'المستخدمين',
    settings: 'الإعدادات',
    backup: 'النسخ الاحتياطي',
  };

  // أوصاف الوحدات (الصفحات المشمولة)
  const moduleDescriptions: Record<keyof RolePermissions, string> = {
    academic_years: 'إدارة السنوات والفصول الدراسية',
    professors: 'إدارة بيانات الأساتذة',
    courses: 'إدارة المقاييس والتكاليف',
    rooms: 'إدارة القاعات وعرض القاعات المتاحة',
    groups: 'إدارة الأفواج والتخصصات',
    departments: 'إدارة الأقسام والكليات',
    sessions: 'إدارة الحصص، الجدول الزمني، نقل وتبديل الحصص',
    extra_sessions: 'إدارة الحصص الإضافية والاستدراكية',
    reports: 'جداول الأفواج، عبء العمل، والتقارير الأخرى',
    users: 'إدارة المستخدمين وسجل الأنشطة',
    settings: 'إعدادات الطباعة والنظام',
    backup: 'النسخ الاحتياطي واستعادة البيانات',
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          ليس لديك صلاحية للوصول إلى هذه الصفحة
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          إدارة المستخدمين
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          إضافة مستخدم
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>اسم المستخدم</TableCell>
                <TableCell>الاسم الكامل</TableCell>
                <TableCell>البريد الإلكتروني</TableCell>
                <TableCell>الدور</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>آخر تسجيل دخول</TableCell>
                <TableCell align="center">الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={getRoleLabel(user.role)}
                      color={getRoleColor(user.role) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'نشط' : 'معطل'}
                      color={user.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString('ar-SA')
                      : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="تعديل">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(user)}
                        disabled={user.id === 1}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="إعادة تعيين كلمة المرور">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenPasswordDialog(user.id)}
                      >
                        <KeyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="إدارة الصلاحيات">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenPermissionsDialog(user)}
                        disabled={user.id === 1}
                      >
                        <SecurityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.is_active ? 'تعطيل' : 'تفعيل'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(user.id, user.is_active)}
                        disabled={user.id === 1}
                      >
                        {user.is_active ? <DisableIcon /> : <EnableIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="حذف">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(user.id)}
                        disabled={user.id === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="اسم المستخدم"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              error={!!errors.username}
              helperText={errors.username}
              fullWidth
              required
            />

            {!editingUser && (
              <TextField
                label="كلمة المرور"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={!!errors.password}
                helperText={errors.password}
                fullWidth
                required
              />
            )}

            <TextField
              label="الاسم الكامل"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              error={!!errors.full_name}
              helperText={errors.full_name}
              fullWidth
              required
            />

            <TextField
              label="البريد الإلكتروني"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={!!errors.email}
              helperText={errors.email}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>الدور</InputLabel>
              <Select
                value={formData.role}
                label="الدور"
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              >
                <MenuItem value="admin">مدير</MenuItem>
                <MenuItem value="schedule_manager">مدير جداول</MenuItem>
                <MenuItem value="staff">موظف</MenuItem>
                <MenuItem value="professor">أستاذ</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="نشط"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>إلغاء</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingUser ? 'تحديث' : 'إضافة'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={openPasswordDialog} onClose={() => setOpenPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="كلمة المرور الجديدة"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={!!errors.password}
              helperText={errors.password}
              fullWidth
              required
            />
            <TextField
              label="تأكيد كلمة المرور"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
              fullWidth
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPasswordDialog(false)}>إلغاء</Button>
          <Button onClick={handleResetPassword} variant="contained">
            تحديث كلمة المرور
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Management Dialog */}
      <Dialog open={openPermissionsDialog} onClose={() => setOpenPermissionsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon />
            إدارة الصلاحيات
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            يمكنك تخصيص الصلاحيات لهذا المستخدم. الصلاحيات تشمل: عرض، إنشاء، تعديل، وحذف.
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {(Object.keys(moduleNames) as Array<keyof RolePermissions>).map((module) => (
              <Paper key={module} elevation={1} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {moduleNames[module]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {moduleDescriptions[module]}
                    </Typography>
                  </Box>
                  <Box>
                    <Button
                      size="small"
                      onClick={() => toggleModuleAccess(module, true)}
                      sx={{ mr: 1 }}
                    >
                      تفعيل الكل
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => toggleModuleAccess(module, false)}
                    >
                      تعطيل الكل
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userPermissions[module].view}
                        onChange={(e) => updatePermission(module, 'view', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="عرض"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userPermissions[module].create}
                        onChange={(e) => updatePermission(module, 'create', e.target.checked)}
                        color="success"
                      />
                    }
                    label="إنشاء"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userPermissions[module].update}
                        onChange={(e) => updatePermission(module, 'update', e.target.checked)}
                        color="warning"
                      />
                    }
                    label="تعديل"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userPermissions[module].delete}
                        onChange={(e) => updatePermission(module, 'delete', e.target.checked)}
                        color="error"
                      />
                    }
                    label="حذف"
                  />
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPermissionsDialog(false)}>إلغاء</Button>
          <Button onClick={handleSavePermissions} variant="contained" color="primary">
            حفظ الصلاحيات
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Users;