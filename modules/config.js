// modules/config.js
// Validate required environment variables at startup and fail fast.

const requiredVars = [
  'ENVID',
  'WORKERID',
  'WORKERSECRET',
  'DVAPIKEY'
];
const missing = requiredVars.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}`
  );
  process.exit(1);
}

// Export validated config values for potential use elsewhere
const config = Object.assign(
  {},
  ...requiredVars.map((name) => ({ [name]: process.env[name] })),
  {
    APIROOT: process.env.APIROOT,
    AUTHROOT: process.env.AUTHROOT,
    ORCHESTRATEAPIROOT: process.env.ORCHESTRATEAPIROOT,
    protectDashboardUrl: process.env.protectDashboardUrl,
    PORT: process.env.PORT
  }
);

export default config;
