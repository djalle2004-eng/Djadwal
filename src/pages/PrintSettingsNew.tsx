/**
 * صفحة إعدادات الطباعة المحسّنة
 * تتضمن معاينة مباشرة وتنظيم أفضل للإعدادات
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  Tabs, 
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  Divider,
  Card,
  CardContent
} from '@mui/material';
import { 
  Save as SaveIcon, 
  RestartAlt as ResetIcon, 
  ArrowBack as BackIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';
import { usePrintSettings } from '../hooks/usePrintSettings';
import type { PrintSettings, PageSize, TextAlignment } from '../types/shared';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PrintSettingsNew() {
  const navigate = useNavigate();
  const { settings, isLoading, error, saveSettings, resetToDefaults } = usePrintSettings();
  const [localSettings, setLocalSettings] = useState<PrintSettings>(settings);
  const [tabValue, setTabValue] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // تحديث الإعدادات المحلية عند تغيير الإعدادات المحملة
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field: keyof PrintSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await saveSettings(localSettings);
      setSnackbar({ open: true, message: 'تم حفظ الإعدادات بنجاح', severity: 'success' });
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      setSnackbar({ open: true, message: 'فشل حفظ الإعدادات', severity: 'error' });
    }
  };

  const handleReset = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      resetToDefaults();
      setSnackbar({ open: true, message: 'تم إعادة تعيين الإعدادات', severity: 'success' });
    }
  };

  const handleLogoUpload = (type: 'university' | 'faculty', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (type === 'university') {
          handleChange('universityLogoUrl', dataUrl);
        } else {
          handleChange('facultyLogoUrl', dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePreviewHTML = () => {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            padding: ${localSettings.pageMarginTop}mm ${localSettings.pageMarginRight}mm ${localSettings.pageMarginBottom}mm ${localSettings.pageMarginLeft}mm;
            line-height: ${localSettings.lineHeight};
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            font-size: ${localSettings.titleFontSize}pt;
            margin: 5px 0;
          }
          .header h3 {
            font-size: ${localSettings.headerFontSize}pt;
            margin: 3px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: ${localSettings.tableBorderWidth}px solid ${localSettings.tableBorderColor};
            padding: ${localSettings.cellPadding}px;
            text-align: ${localSettings.tableCellAlignment};
            font-size: ${localSettings.cellContentFontSize}pt;
            line-height: ${localSettings.lineHeight};
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            font-size: ${localSettings.footerFontSize}pt;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${localSettings.universityLogoUrl ? `<img src="${localSettings.universityLogoUrl}" style="max-width: ${localSettings.logoSize}px; max-height: ${localSettings.logoSize}px;">` : ''}
          <h3>${localSettings.universityName || 'اسم الجامعة'}</h3>
          <h3>${localSettings.facultyName || 'اسم الكلية'}</h3>
          <h1>نموذج معاينة الطباعة</h1>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>العمود 1</th>
              <th>العمود 2</th>
              <th>العمود 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>بيانات تجريبية</td>
              <td>بيانات تجريبية</td>
              <td>بيانات تجريبية</td>
            </tr>
            <tr>
              <td>بيانات تجريبية</td>
              <td>بيانات تجريبية</td>
              <td>بيانات تجريبية</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          ${localSettings.showPrintDate ? `تاريخ الطباعة: ${new Date().toLocaleDateString('ar-DZ')}` : ''}
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          إعدادات الطباعة
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate(-1)}
            sx={{ mr: 1 }}
          >
            رجوع
          </Button>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={() => setShowPreview(!showPreview)}
            sx={{ mr: 1 }}
          >
            {showPreview ? 'إخفاء المعاينة' : 'معاينة'}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<ResetIcon />}
            onClick={handleReset}
            sx={{ mr: 1 }}
          >
            إعادة تعيين
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isLoading}
          >
            حفظ
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Settings Panel */}
        <Grid item xs={12} md={showPreview ? 6 : 12}>
          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="معلومات المؤسسة" />
              <Tab label="الشعارات" />
              <Tab label="أحجام الخطوط" />
              <Tab label="تنسيق الجداول" />
              <Tab label="هوامش الصفحة" />
              <Tab label="إعدادات إضافية" />
            </Tabs>

            {/* Tab 1: معلومات المؤسسة */}
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="اسم الجامعة"
                    value={localSettings.universityName || ''}
                    onChange={(e) => handleChange('universityName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="اسم الكلية"
                    value={localSettings.facultyName || ''}
                    onChange={(e) => handleChange('facultyName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="اسم القسم"
                    value={localSettings.departmentName || ''}
                    onChange={(e) => handleChange('departmentName', e.target.value)}
                  />
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 2: الشعارات */}
            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>شعار الجامعة</Typography>
                      {localSettings.universityLogoUrl && (
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                          <img 
                            src={localSettings.universityLogoUrl} 
                            alt="شعار الجامعة"
                            style={{ maxWidth: '200px', maxHeight: '200px' }}
                          />
                        </Box>
                      )}
                      <Button
                        variant="contained"
                        component="label"
                        fullWidth
                      >
                        تحميل شعار الجامعة
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleLogoUpload('university', e)}
                        />
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>شعار الكلية</Typography>
                      {localSettings.facultyLogoUrl && (
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                          <img 
                            src={localSettings.facultyLogoUrl} 
                            alt="شعار الكلية"
                            style={{ maxWidth: '200px', maxHeight: '200px' }}
                          />
                        </Box>
                      )}
                      <Button
                        variant="contained"
                        component="label"
                        fullWidth
                      >
                        تحميل شعار الكلية
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleLogoUpload('faculty', e)}
                        />
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Typography gutterBottom>حجم الشعار: {localSettings.logoSize}px</Typography>
                  <Slider
                    value={localSettings.logoSize || 80}
                    onChange={(_, value) => handleChange('logoSize', value)}
                    min={40}
                    max={200}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 3: أحجام الخطوط */}
            <TabPanel value={tabValue} index={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>حجم خط الترويسة: {localSettings.headerFontSize}pt</Typography>
                  <Slider
                    value={localSettings.headerFontSize || 16}
                    onChange={(_, value) => handleChange('headerFontSize', value)}
                    min={8}
                    max={24}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>حجم خط العنوان: {localSettings.titleFontSize}pt</Typography>
                  <Slider
                    value={localSettings.titleFontSize || 16}
                    onChange={(_, value) => handleChange('titleFontSize', value)}
                    min={10}
                    max={32}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>حجم خط العنوان الفرعي: {localSettings.subtitleFontSize}pt</Typography>
                  <Slider
                    value={localSettings.subtitleFontSize || 14}
                    onChange={(_, value) => handleChange('subtitleFontSize', value)}
                    min={8}
                    max={24}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>حجم خط محتوى الخلايا: {localSettings.cellContentFontSize}pt</Typography>
                  <Slider
                    value={localSettings.cellContentFontSize || 10}
                    onChange={(_, value) => handleChange('cellContentFontSize', value)}
                    min={6}
                    max={18}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>حجم خط التذييل: {localSettings.footerFontSize}pt</Typography>
                  <Slider
                    value={localSettings.footerFontSize || 10}
                    onChange={(_, value) => handleChange('footerFontSize', value)}
                    min={6}
                    max={16}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 4: تنسيق الجداول */}
            <TabPanel value={tabValue} index={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>المسافة الداخلية للخلايا: {localSettings.cellPadding}px</Typography>
                  <Slider
                    value={localSettings.cellPadding || 3}
                    onChange={(_, value) => handleChange('cellPadding', value)}
                    min={0}
                    max={20}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>ارتفاع السطر: {localSettings.lineHeight}</Typography>
                  <Slider
                    value={localSettings.lineHeight || 1.2}
                    onChange={(_, value) => handleChange('lineHeight', value)}
                    min={1}
                    max={3}
                    step={0.1}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>المسافة بين الحصص: {localSettings.sessionGap}px</Typography>
                  <Slider
                    value={localSettings.sessionGap || 8}
                    onChange={(_, value) => handleChange('sessionGap', value)}
                    min={0}
                    max={20}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>محاذاة محتوى الخلايا</InputLabel>
                    <Select
                      value={localSettings.tableCellAlignment || 'center'}
                      onChange={(e) => handleChange('tableCellAlignment', e.target.value as TextAlignment)}
                    >
                      <MenuItem value="right">يمين</MenuItem>
                      <MenuItem value="center">وسط</MenuItem>
                      <MenuItem value="left">يسار</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>عرض حدود الجدول: {localSettings.tableBorderWidth}px</Typography>
                  <Slider
                    value={localSettings.tableBorderWidth || 1}
                    onChange={(_, value) => handleChange('tableBorderWidth', value)}
                    min={0}
                    max={5}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="لون حدود الجدول"
                    type="color"
                    value={localSettings.tableBorderColor || '#000000'}
                    onChange={(e) => handleChange('tableBorderColor', e.target.value)}
                  />
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 5: هوامش الصفحة */}
            <TabPanel value={tabValue} index={4}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>الهامش العلوي: {localSettings.pageMarginTop}mm</Typography>
                  <Slider
                    value={localSettings.pageMarginTop || 5}
                    onChange={(_, value) => handleChange('pageMarginTop', value)}
                    min={0}
                    max={50}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>الهامش السفلي: {localSettings.pageMarginBottom}mm</Typography>
                  <Slider
                    value={localSettings.pageMarginBottom || 5}
                    onChange={(_, value) => handleChange('pageMarginBottom', value)}
                    min={0}
                    max={50}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>الهامش الأيمن: {localSettings.pageMarginRight}mm</Typography>
                  <Slider
                    value={localSettings.pageMarginRight || 5}
                    onChange={(_, value) => handleChange('pageMarginRight', value)}
                    min={0}
                    max={50}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>الهامش الأيسر: {localSettings.pageMarginLeft}mm</Typography>
                  <Slider
                    value={localSettings.pageMarginLeft || 5}
                    onChange={(_, value) => handleChange('pageMarginLeft', value)}
                    min={0}
                    max={50}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>حجم الصفحة</InputLabel>
                    <Select
                      value={localSettings.pageSize || 'A4'}
                      onChange={(e) => handleChange('pageSize', e.target.value as PageSize)}
                    >
                      <MenuItem value="A4">A4</MenuItem>
                      <MenuItem value="A3">A3</MenuItem>
                      <MenuItem value="Letter">Letter</MenuItem>
                      <MenuItem value="Legal">Legal</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 6: إعدادات إضافية */}
            <TabPanel value={tabValue} index={5}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localSettings.showPageNumbers || false}
                        onChange={(e) => handleChange('showPageNumbers', e.target.checked)}
                      />
                    }
                    label="إظهار أرقام الصفحات"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localSettings.showPrintDate ?? true}
                        onChange={(e) => handleChange('showPrintDate', e.target.checked)}
                      />
                    }
                    label="إظهار تاريخ الطباعة"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="نص العلامة المائية"
                    value={localSettings.watermarkText || ''}
                    onChange={(e) => handleChange('watermarkText', e.target.value)}
                    placeholder="اختياري"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography gutterBottom>شفافية العلامة المائية: {localSettings.watermarkOpacity}</Typography>
                  <Slider
                    value={localSettings.watermarkOpacity || 0.1}
                    onChange={(_, value) => handleChange('watermarkOpacity', value)}
                    min={0}
                    max={1}
                    step={0.05}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              </Grid>
            </TabPanel>
          </Paper>
        </Grid>

        {/* Preview Panel */}
        {showPreview && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '800px', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>معاينة مباشرة</Typography>
              <Divider sx={{ mb: 2 }} />
              <iframe
                srcDoc={generatePreviewHTML()}
                style={{ width: '100%', height: 'calc(100% - 50px)', border: '1px solid #ddd' }}
                title="معاينة الطباعة"
              />
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
