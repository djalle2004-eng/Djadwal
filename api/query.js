const { Database } = require('@sqlitecloud/drivers');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json(corsHeaders);
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, params = [], credentials } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  let db = null;
  
  try {
    // استخدام بيانات الاعتماد من الطلب أو من environment variables
    const username = credentials?.username || process.env.SQLITECLOUD_USERNAME;
    const password = credentials?.password || process.env.SQLITECLOUD_PASSWORD;
    const host = credentials?.host || process.env.SQLITECLOUD_HOST;
    const port = credentials?.port || process.env.SQLITECLOUD_PORT || '8860';
    const database = credentials?.database || process.env.SQLITECLOUD_DATABASE;

    if (!username || !password || !host || !database) {
      return res.status(400).json({ 
        error: 'Missing SQLiteCloud credentials',
        required: ['username', 'password', 'host', 'database']
      });
    }

    const connectionString = `sqlitecloud://${username}:${password}@${host}:${port}/${database}`;
    
    // الاتصال بـ SQLiteCloud
    db = new Database(connectionString);
    
    // تنفيذ الاستعلام
    const result = await db.sql(query, ...params);
    
    // إغلاق الاتصال
    if (db) {
      db.close();
    }
    
    // إرجاع النتائج
    return res.status(200).json({
      success: true,
      data: result,
      rowCount: Array.isArray(result) ? result.length : 1
    });
    
  } catch (error) {
    console.error('SQLiteCloud Error:', error);
    
    // إغلاق الاتصال في حالة الخطأ
    if (db) {
      try { db.close(); } catch (e) {}
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Database query failed'
    });
  }
};