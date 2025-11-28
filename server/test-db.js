const db = require('./database');

async function testConnection() {
    try {
        console.log('🧪 Testing database connection...');
        const result = await db.executeQuery('SELECT 1 as test');
        console.log('✅ Connection successful!', result);
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
