import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Container,
  keyframes
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon
} from '@mui/icons-material';
import universityLogo from '/images/university-logo.svg';

// Animation keyframes
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
`;

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // التحقق من إعدادات قاعدة البيانات
  useEffect(() => {
    const checkDatabaseConfig = async () => {
      // Skip check if running in web mode (no electron)
      if (!window.electron) return;

      try {
        const isConfigured = await window.electron.invoke('is-database-configured');
        if (!isConfigured) {
          navigate('/database-settings');
        }
      } catch (error) {
        console.error('Error checking database config:', error);
        navigate('/database-settings');
      }
    };

    checkDatabaseConfig();
  }, [navigate]);

  // إعادة توجيه إذا كان المستخدم مسجل الدخول بالفعل
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // التحقق من وجود بيانات محفوظة عند تحميل الصفحة
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    const savedRememberMe = localStorage.getItem('rememberMe');
    if (savedUsername && savedRememberMe === 'true') {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    try {
      setLoading(true);
      await signIn({ username, password, remember_me: rememberMe });

      // حفظ اسم المستخدم إذا تم اختيار "تذكرني"
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      navigate('/');
    } catch (err: any) {
      console.error('خطأ في تسجيل الدخول:', err);
      setError(err?.message || 'فشل تسجيل الدخول. الرجاء التحقق من بيانات الاعتماد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          animation: `${float} 6s ease-in-out infinite`,
        }
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            animation: `${fadeIn} 0.6s ease-out`,
            position: 'relative',
            zIndex: 1
          }}
        >
          {/* Logo */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 3,
              animation: `${float} 3s ease-in-out infinite`
            }}
          >
            <img
              src={universityLogo}
              alt="شعار الجامعة"
              style={{ width: '120px', height: 'auto' }}
            />
          </Box>

          {/* العنوان */}
          <Typography
            variant="h4"
            align="center"
            sx={{
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            مرحباً بك
          </Typography>

          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            سجّل الدخول للوصول إلى نظام إدارة الجداول
          </Typography>

          {/* رسالة الخطأ */}
          {error && (
            <Alert
              severity="error"
              onClose={() => setError('')}
              sx={{ mb: 3, animation: `${fadeIn} 0.3s ease-out` }}
            >
              {error}
            </Alert>
          )}

          {/* النموذج */}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="اسم المستخدم"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
                dir: 'ltr'
              }}
            />

            <TextField
              fullWidth
              label="كلمة المرور"
              variant="outlined"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  color="primary"
                />
              }
              label="تذكرني"
              sx={{ mb: 3 }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={<LoginIcon />}
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 16px rgba(102, 126, 234, 0.4)'
                },
                transition: 'all 0.3s ease',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>
        </Paper>

        {/* حقوق النشر */}
        <Typography
          variant="body2"
          align="center"
          sx={{
            mt: 3,
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            animation: `${fadeIn} 1s ease-out`
          }}
        >
          تم البرمجة من طرف د. حسين علي - hussain-ali@univ-eloued.dz
        </Typography>
      </Container>
    </Box>
  );
}