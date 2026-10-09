const dns = require('dns');
const mongoose = require('mongoose');

// Some home routers (common on Windows PCs) refuse the SRV lookups that `mongodb+srv://` Atlas addresses need
// ("querySrv ECONNREFUSED"). DNS_SERVERS=8.8.8.8,1.1.1.1 makes Node ask public DNS servers instead.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean));
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chinu_dhaba';

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    if (/querySrv/.test(error.message) && !process.env.DNS_SERVERS) {
      console.error('Tip: your network blocks Atlas DNS lookups. Retry with DNS_SERVERS=8.8.8.8,1.1.1.1 set.');
    }
    throw error;
  }
};

module.exports = connectDB;
