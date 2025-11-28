const axios = require('axios');

// Vercel API URL
const API_URL = process.env.VERCEL_API_URL || 'https://djadwal-95zzyaw3a-djalle2004-1566s-projects.vercel.app/api/query';

console.log('🌐 API Client initialized with URL:', API_URL);

class DatabaseAPIClient {
  constructor(credentials) {
    this.credentials = credentials;
  }

  async sql(query, ...params) {
    try {
      console.log('📬 Sending API request...');
      console.log('  Query:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
      console.log('  Params:', params);
      console.log('  URL:', API_URL);
      
      const response = await axios.post(API_URL, {
        query,
        params,
        credentials: this.credentials
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      });

      console.log('✅ API response received:', response.status);
      console.log('  Success:', response.data.success);
      console.log('  Data length:', Array.isArray(response.data.data) ? response.data.data.length : 'N/A');

      if (response.data.success) {
        return response.data.data;
      } else {
        console.error('❌ API returned error:', response.data.error);
        throw new Error(response.data.error || 'API query failed');
      }
    } catch (error) {
      console.error('❌ API request failed:');
      if (error.response) {
        console.error('  Status:', error.response.status);
        console.error('  Error:', error.response.data?.error || error.response.data);
        throw new Error(error.response.data?.error || 'API request failed');
      } else if (error.request) {
        console.error('  No response from server');
        console.error('  Request:', error.request);
        throw new Error('No response from API server');
      } else {
        console.error('  Error:', error.message);
        throw error;
      }
    }
  }

  close() {
    // لا حاجة لإغلاق اتصال HTTP
  }
}

module.exports = { DatabaseAPIClient };