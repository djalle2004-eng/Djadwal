const { Client } = require('pg');
const bcrypt = require('bcrypt');

/**
 * PostgreSQL Database Adapter for Neon
 * محول قاعدة بيانات PostgreSQL لـ Neon
 */
class NeonDatabaseAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // 2 seconds
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 30000; // 30 seconds
  }

  /**
   * Initialize database connection
   * تهيئة اتصال قاعدة البيانات
   */
  async connect() {
    try {
      if (!this.client) {
        this.client = new Client({
          connectionString: this.connectionString,
          // Connection pool settings
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
      }

      if (!this.isConnected) {
        await this.client.connect();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('✅ تم الاتصال بـ Neon PostgreSQL');
        
        // Start health monitoring
        this.startHealthMonitoring();
      }

      return this.client;
    } catch (error) {
      console.error('❌ خطأ في الاتصال بـ Neon:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Execute SQL query
   * تنفيذ استعلام SQL
   */
  async sql(query, ...params) {
    try {
      await this.ensureConnection();
      
      // Flatten parameters if they're nested arrays
      const flatParams = params.flat();
      
      // Handle different query types
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        const result = await this.client.query(query, flatParams);
        return result.rows;
      } else {
        const result = await this.client.query(query, flatParams);
        return result.rows || [];
      }
    } catch (error) {
      console.error('❌ خطأ في تنفيذ الاستعلام:', error.message);
      console.error('📝 الاستعلام:', query);
      console.error('📝 المعاملات:', params);
      
      // Try to reconnect on connection errors
      if (this.isConnectionError(error)) {
        await this.handleConnectionError();
        // Retry once
        try {
          await this.ensureConnection();
          const flatParams = params.flat();
          const result = await this.client.query(query, flatParams);
          return result.rows || [];
        } catch (retryError) {
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute query with parameters (array format)
   * تنفيذ استعلام مع معاملات (تنسيق مصفوفة)
   */
  async query(query, params = []) {
    return await this.sql(query, ...params);
  }

  /**
   * Ensure connection is active
   * التأكد من أن الاتصال نشط
   */
  async ensureConnection() {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }
  }

  /**
   * Check if error is connection-related
   * فحص ما إذا كان الخطأ متعلق بالاتصال
   */
  isConnectionError(error) {
    const connectionErrors = [
      'connection terminated',
      'connection lost',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'connection timeout'
    ];
    
    return connectionErrors.some(errType => 
      error.message.toLowerCase().includes(errType.toLowerCase())
    );
  }

  /**
   * Handle connection errors
   * معالجة أخطاء الاتصال
   */
  async handleConnectionError() {
    this.isConnected = false;
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      console.log(`🔄 محاولة إعادة الاتصال (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      try {
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        await this.connect();
      } catch (error) {
        console.error('❌ فشل إعادة الاتصال:', error.message);
        throw error;
      }
    } else {
      throw new Error('تم تجاوز الحد الأقصى لمحاولات إعادة الاتصال');
    }
  }

  /**
   * Start health monitoring
   * بدء مراقبة صحة الاتصال
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.client.query('SELECT 1');
      } catch (error) {
        console.error('⚠️ فشل فحص صحة الاتصال:', error.message);
        this.isConnected = false;
      }
    }, this.healthCheckIntervalMs);

    console.log(`🔍 بدء مراقبة صحة الاتصال (كل ${this.healthCheckIntervalMs}ms)`);
  }

  /**
   * Close connection
   * إغلاق الاتصال
   */
  close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client && this.isConnected) {
      try {
        this.client.end();
        console.log('🔗 تم إغلاق الاتصال بـ Neon');
      } catch (error) {
        console.error('⚠️ خطأ في إغلاق الاتصال:', error.message);
      }
    }

    this.isConnected = false;
    this.client = null;
  }

  /**
   * Get connection status
   * الحصول على حالة الاتصال
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

module.exports = NeonDatabaseAdapter;
