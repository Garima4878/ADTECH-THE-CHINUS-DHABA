// Website origins allowed to call the API with cookies (comma-separated CLIENT_URL).
// Browsers reject `Access-Control-Allow-Origin: *` together with credentials, so a list is required in production.
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isAllowedOrigin = (origin) => allowedOrigins.length === 0 || allowedOrigins.includes(origin);

module.exports = { allowedOrigins, isAllowedOrigin };
