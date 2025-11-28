# دليل النشر - Deployment Guide

<div align="center">

**دليل شامل لنشر تطبيق Djadwal على منصات مختلفة**

[العربية](#العربية) | [English](#english)

</div>

---

## العربية

### 📋 المتطلبات الأساسية

قبل البدء في عملية النشر، تأكد من توفر:

- ✅ حساب [Turso](https://turso.tech/) لقاعدة البيانات
- ✅ Node.js 18 أو أحدث
- ✅ Git مثبت على جهازك
- ✅ حساب على منصة النشر المختارة (Vercel/Railway/Render)

### 🗄️ إعداد قاعدة البيانات Turso

#### 1. إنشاء حساب Turso

```bash
# تثبيت Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# تسجيل الدخول
turso auth login
```

#### 2. إنشاء قاعدة البيانات

```bash
# إنشاء قاعدة بيانات جديدة
turso db create djadwal

# الحصول على URL قاعدة البيانات
turso db show djadwal --url

# إنشاء token للوصول
turso db tokens create djadwal
```

#### 3. تهيئة الجداول

```bash
# تشغيل سكريبت إنشاء الجداول
node electron/init-turso-schema.js
```

### 🌐 خيارات النشر

## الخيار 1: Vercel (موصى به)

### المميزات
- ✅ نشر مجاني للمشاريع الشخصية
- ✅ SSL تلقائي
- ✅ CDN عالمي
- ✅ تحديثات تلقائية من GitHub

### خطوات النشر

#### 1. تحضير المشروع

```bash
# تأكد من وجود ملف vercel.json
```

أنشئ ملف `vercel.json` في جذر المشروع:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

#### 2. النشر عبر Vercel CLI

```bash
# تثبيت Vercel CLI
npm i -g vercel

# تسجيل الدخول
vercel login

# النشر
vercel
```

#### 3. إعداد المتغيرات البيئية

في لوحة تحكم Vercel:
1. اذهب إلى Settings → Environment Variables
2. أضف المتغيرات التالية:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `NODE_ENV=production`

---

## الخيار 2: Railway

### المميزات
- ✅ دعم كامل لـ Node.js
- ✅ قاعدة بيانات مدمجة (اختياري)
- ✅ نشر تلقائي من GitHub

### خطوات النشر

#### 1. إنشاء مشروع جديد

1. اذهب إلى [Railway.app](https://railway.app/)
2. انقر على "New Project"
3. اختر "Deploy from GitHub repo"
4. اختر مستودع المشروع

#### 2. إعداد المتغيرات البيئية

في لوحة تحكم Railway:
```
TURSO_DATABASE_URL=your-database-url
TURSO_AUTH_TOKEN=your-auth-token
PORT=3001
NODE_ENV=production
```

#### 3. إعداد أمر البدء

في إعدادات المشروع، تأكد من:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

---

## الخيار 3: Render

### خطوات النشر

#### 1. إنشاء Web Service جديد

1. اذهب إلى [Render.com](https://render.com/)
2. انقر على "New +" → "Web Service"
3. اربط مستودع GitHub

#### 2. الإعدادات

```
Name: djadwal
Environment: Node
Build Command: npm install && npm run build
Start Command: npm start
```

#### 3. المتغيرات البيئية

أضف في قسم Environment:
```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
NODE_ENV=production
```

---

## الخيار 4: VPS (خادم خاص)

### المتطلبات
- خادم Ubuntu/Debian
- صلاحيات root أو sudo

### خطوات التثبيت

#### 1. تحديث النظام

```bash
sudo apt update && sudo apt upgrade -y
```

#### 2. تثبيت Node.js

```bash
# تثبيت Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# التحقق من التثبيت
node --version
npm --version
```

#### 3. تثبيت PM2

```bash
sudo npm install -g pm2
```

#### 4. استنساخ المشروع

```bash
cd /var/www
git clone https://github.com/your-username/djadwal.git
cd djadwal
```

#### 5. التثبيت والبناء

```bash
npm install
npm run build
```

#### 6. إعداد المتغيرات البيئية

```bash
nano .env
```

أضف:
```env
TURSO_DATABASE_URL=your-database-url
TURSO_AUTH_TOKEN=your-auth-token
PORT=3001
NODE_ENV=production
```

#### 7. تشغيل التطبيق مع PM2

```bash
pm2 start npm --name "djadwal" -- start
pm2 save
pm2 startup
```

#### 8. إعداد Nginx (اختياري)

```bash
sudo apt install nginx -y
```

أنشئ ملف إعداد:
```bash
sudo nano /etc/nginx/sites-available/djadwal
```

أضف:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

فعّل الإعداد:
```bash
sudo ln -s /etc/nginx/sites-available/djadwal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### 🔒 الأمان

#### SSL/HTTPS (للـ VPS)

```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx -y

# الحصول على شهادة SSL
sudo certbot --nginx -d your-domain.com
```

#### جدار الحماية

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

### 📊 المراقبة والصيانة

#### مراقبة PM2

```bash
# عرض الحالة
pm2 status

# عرض السجلات
pm2 logs djadwal

# إعادة التشغيل
pm2 restart djadwal
```

#### النسخ الاحتياطي

```bash
# نسخ احتياطي لقاعدة البيانات
turso db shell djadwal ".backup backup.db"
```

---

### 🐛 استكشاف الأخطاء

#### مشكلة: التطبيق لا يبدأ

```bash
# تحقق من السجلات
pm2 logs djadwal

# تحقق من المتغيرات البيئية
cat .env
```

#### مشكلة: خطأ في الاتصال بقاعدة البيانات

```bash
# تحقق من صحة URL و Token
echo $TURSO_DATABASE_URL
echo $TURSO_AUTH_TOKEN
```

---

## English

### 📋 Prerequisites

Before deployment, ensure you have:

- ✅ [Turso](https://turso.tech/) account for database
- ✅ Node.js 18 or newer
- ✅ Git installed
- ✅ Account on chosen platform (Vercel/Railway/Render)

### 🗄️ Turso Database Setup

#### 1. Create Turso Account

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login
```

#### 2. Create Database

```bash
# Create new database
turso db create djadwal

# Get database URL
turso db show djadwal --url

# Create access token
turso db tokens create djadwal
```

#### 3. Initialize Tables

```bash
# Run schema initialization script
node electron/init-turso-schema.js
```

### 🌐 Deployment Options

Refer to the Arabic section above for detailed deployment instructions for:
- Vercel (Recommended)
- Railway
- Render
- VPS (Private Server)

---

### 📞 Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Ensure database connectivity
4. Review platform-specific documentation

---

<div align="center">

**Made with ❤️ for educational institutions**

</div>
