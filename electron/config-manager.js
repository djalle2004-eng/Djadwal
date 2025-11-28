const { app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Config Manager - إدارة إعدادات التطبيق
 * يحفظ الإعدادات في مجلد userData للتطبيق
 */

class ConfigManager {
  constructor() {
    // مجلد الإعدادات في userData
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * تحميل الإعدادات من الملف
   */
  loadConfig() {
    try {
      console.log('📂 Config path:', this.configPath);
      
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        console.log('✅ Config loaded from file');
        console.log('   - useNeon:', config.database?.useNeon);
        console.log('   - hasNeonConnection:', !!config.database?.neonConnectionString);
        console.log('   - useSQLiteCloud:', config.database?.useSQLiteCloud);
        return config;
      } else {
        console.log('⚠️ No config file found at:', this.configPath);
        console.log('   Using default config');
        const defaultConfig = this.getDefaultConfig();
        console.log('   - Default useNeon:', defaultConfig.database.useNeon);
        return defaultConfig;
      }
    } catch (error) {
      console.error('❌ Error loading config:', error);
      console.log('   Falling back to default config');
      return this.getDefaultConfig();
    }
  }

  /**
   * الإعدادات الافتراضية
   */
  getDefaultConfig() {
    return {
      database: {
        useTurso: true,
        turso: {
          url: 'libsql://djadwal-djalle.aws-eu-west-1.turso.io',
          authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjE5MDkwMDYsImlkIjoiNzQyYmY2OTYtNDA3Zi00NDYwLWE4ZGEtZTQwNDJmMzQxZTY0IiwicmlkIjoiZDM1NjBjOTMtYzlmZi00OTliLWJkOTMtMDE5YmMwODAzOTUyIn0.eBc_mzZBjxIKGk67o7P0eae3fS4dJoerkiBurw92bhlUpAaKvCg2jGNDrG3IlPwCwNgjG8J5rOlhoRU2RfcWBA'
        }
      },
      app: {
        language: 'ar',
        theme: 'light'
      }
    };
  }

  /**
   * حفظ الإعدادات
   */
  saveConfig(newConfig) {
    try {
      // دمج الإعدادات الجديدة مع الحالية
      this.config = { ...this.config, ...newConfig };
      
      // حفظ في الملف
      fs.writeFileSync(
        this.configPath, 
        JSON.stringify(this.config, null, 2), 
        'utf8'
      );
      
      console.log('✅ Config saved to:', this.configPath);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * الحصول على الإعدادات الحالية
   */
  getConfig() {
    return this.config;
  }

  /**
   * الحصول على إعدادات قاعدة البيانات
   */
  getDatabaseConfig() {
    return this.config.database;
  }

  /**
   * تحديث إعدادات قاعدة البيانات
   */
  updateDatabaseConfig(dbConfig) {
    this.config.database = { ...this.config.database, ...dbConfig };
    return this.saveConfig(this.config);
  }

  /**
   * التحقق من وجود إعدادات قاعدة البيانات
   */
  isDatabaseConfigured() {
    const db = this.config.database;
    
    // إذا كان يستخدم Turso
    if (db.useTurso && db.turso && db.turso.url && db.turso.authToken) {
      console.log('✅ Turso configured');
      return true;
    }
    
    console.log('❌ Turso NOT configured:', {
      useTurso: db.useTurso,
      hasTurso: !!db.turso,
      hasUrl: !!db.turso?.url,
      hasToken: !!db.turso?.authToken
    });
    
    return false;
  }

  /**
   * الحصول على مسار ملف الإعدادات
   */
  getConfigPath() {
    return this.configPath;
  }
}

// تصدير instance واحد
let configManager = null;

module.exports = {
  getConfigManager: () => {
    if (!configManager) {
      configManager = new ConfigManager();
    }
    return configManager;
  }
};
