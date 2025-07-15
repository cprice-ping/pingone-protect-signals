// import fetch from 'node-fetch';
import { Buffer } from 'buffer';
import UserAgent from 'user-agents';

// Helper: Generate a random element from an array
const randomElement = arr => arr[Math.floor(Math.random() * arr.length)];

// Helper: Replace Postman dynamic variables (implement as needed)
function getRandomUserAgent() {
  const userAgent = new UserAgent();
  return userAgent.toString();
}
function getRandomIP() {
  return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join('.');
}

export async function runProtectDashboard(env) {
  // 1. Get Worker Token
  const tokenUrl = `${env.pingOneAuthNURL}/${env.envId}/as/token`;
  const basicAuth = Buffer.from(`${env.workerId}:${env.workerSecret}`).toString('base64');
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!tokenRes.ok) throw new Error('Failed to get access token');
  const tokenData = await tokenRes.json();
  const access_token = tokenData.access_token;

  // 2. Generate Sample Data (from pre-request script)
  const sampleData = [
    {
      username: "user.100",
      browserAgents: [getRandomUserAgent()],
      ipAddresses: [getRandomIP()],
      applications: [
        { type: "OIDC", appId: "PingRedirectless", appName: "Ping Redirectless" },
        { type: "SAML", appId: "Sample-SAML", appName: "Sample SAML" },
        { type: "SAML", appId: "Sample-Passwordless", appName: "Sample SAML - Passwordless" },
        { type: "OIDC", appId: "PingLogon", appName: "Ping Logon" }
      ],
      timezone: "America/Los_Angeles"
    },
    {
      username: "user.101",
      browserAgents: [getRandomUserAgent()],
      ipAddresses: [getRandomIP()],
      applications: [
        { type: "OIDC", appId: "PingRedirectless", appName: "Ping Redirectless" },
        { type: "OIDC", appId: "PingLogon", appName: "Ping Logon" },
        { type: "OIDC", appId: "dadmin", appName: "Delegator" }
      ],
      timezone: "America/New_York"
    },
    {
      username: "user.102",
      browserAgents: [getRandomUserAgent()],
      ipAddresses: [getRandomIP()],
      applications: [
        { type: "SAML", appId: "Sample-SAML", appName: "Sample SAML" },
        { type: "SAML", appId: "Sample-Widget", appName: "Sample SAML - Verify" },
        { type: "OIDC", appId: "PingRedirectless", appName: "Ping Redirectless" },
        { type: "OIDC", appId: "PingLogon", appName: "Ping Logon" }
      ],
      timezone: "Europe/London"
    },
    {
      username: "user.103",
      browserAgents: [getRandomUserAgent()],
      ipAddresses: [getRandomIP()],
      applications: [
        { type: "SAML", appId: "Sample-SAML", appName: "Sample SAML" },
        { type: "SAML", appId: "Sample-Widget", appName: "Sample SAML - Verify" },
        { type: "OIDC", appId: "PingRedirectless", appName: "Ping Redirectless" }
      ],
      timezone: "Australia/Sydney"
    },
    {
      username: "user.104",
      browserAgents: [getRandomUserAgent()],
      ipAddresses: [getRandomIP()],
      applications: [
        { type: "SAML", appId: "Sample-SAML", appName: "Sample SAML" },
        { type: "SAML", appId: "Sample-Widget", appName: "Sample SAML - Verify" },
        { type: "OIDC", appId: "PingRedirectless", appName: "Ping Redirectless" },
        { type: "OIDC", appId: "PingLogon", appName: "Ping Logon" },
        { type: "OIDC", appId: "dadmin", appName: "Delegator" }
      ],
      timezone: "America/New_York"
    }
  ];

  const randomUser = randomElement(sampleData);
  const userId = randomUser.username;
  const timezone = randomUser.timezone;
  const userAgent = randomElement(randomUser.browserAgents);
  const ipAddress = randomElement(randomUser.ipAddresses);
  const randomApp = randomElement(randomUser.applications);
  const appId = randomApp.appId;
  const appName = randomApp.appName;
  const eventsArray = ["AUTHENTICATION", "ACCESS", "AUTHORIZATION", "TRANSACTION", "REGISTRATION"];
  const eventType = randomElement(eventsArray);

  // 3. Generate Risk Call
  const riskUrl = `${env.pingOneMgmtURL}/v1/environments/${env.envId}/riskEvaluations`;
  const riskBody = {
    event: {
      targetResource: { id: appId, name: appName },
      ip: ipAddress,
      flow: { type: eventType },
      user: { id: userId, type: "EXTERNAL" },
      sharingType: "PRIVATE",
      browser: {
        userAgent,
        language: "en",
        colorDepth: 24,
        deviceMemory: 8,
        hardwareConcurrency: 8,
        screenResolution: [900, 1440],
        availableScreenResolution: [877, 1380],
        timezoneOffset: -120.0,
        timezone,
        sessionStorage: true,
        localStorage: true,
        indexedDb: true,
        addBehaviour: null,
        openDatabase: true,
        cpuClass: "not available",
        platform: "MacIntel",
        plugins: [
          ["Chrome PDF Plugin", "Portable Document Format", ["application x-google-chrome-pdf", "pfg"]],
          ["Chrome PDF Viewer", ["application x-google-chrome-pdf", "pdf"]]
        ],
        webglVendorAndRenderer: "Intel Inc.~Intel Iris Pro OpenGL Engine",
        webgl: [
          "webgl aliased line width range:[1, 1]",
          "webgl alpha bits:8",
          "webgl antialiasing:yes",
          "webgl blue bits:8",
          "webgl depth bits:24",
          "webgl green bits:8",
          "webgl max anisotropy:16"
        ],
        adBlock: false,
        hasLiedLanguages: false,
        hasLiedResolution: false,
        hasLiedOs: false,
        hasLiedBrowser: false,
        touchSupport: ["0", "false", "false"],
        fonts: ["Arial", "Comic Sans MS", "Courier", "Courier New", "Helvetica"],
        audio: "124.04345808873768"
      },
      origin: "Postman",
      riskPolicySet: {
        id: env.riskPolicyId || "YOUR_RISK_POLICY_ID",
        name: "Default Risk Policy"
      }
    }
  };

  const riskRes = await fetch(riskUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(riskBody)
  });
  if (!riskRes.ok) throw new Error('Risk evaluation failed');
  const riskData = await riskRes.json();
  const riskId = riskData.id;

  // 4. Update Risk Eval
  const updateUrl = `${env.pingOneMgmtURL}/v1/environments/${env.envId}/riskEvaluations/${riskId}/event`;
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ completionStatus: "SUCCESS" })
  });
  if (!updateRes.ok) throw new Error('Risk evaluation update failed');
  const updateData = await updateRes.json();

  return { riskId, update: updateData };
}
