import { Buffer } from "buffer";

// Normalize environment overrides (strip BOM and whitespace)
const rawApiRoot = (process.env.APIROOT || '').replace(/^[\uFEFF\s]+/, '').trim();
const rawAuthRoot = (process.env.AUTHROOT || '').replace(/^[\uFEFF\s]+/, '').trim();
const rawOrchestrateApiRoot = (process.env.ORCHESTRATEAPIROOT || '').replace(/^[\uFEFF\s]+/, '').trim();

const p1ApiRoot = rawApiRoot
  ? `${rawApiRoot}/environments/${process.env.ENVID}`
  : `https://api.pingone.com/v1/environments/${process.env.ENVID}`;
const p1AuthRoot = rawAuthRoot
  ? `${rawAuthRoot}/${process.env.ENVID}`
  : `https://auth.pingone.com/${process.env.ENVID}`;
const p1OrchestrateRoot = rawOrchestrateApiRoot
  ? `${rawOrchestrateApiRoot}/v1/company/${process.env.ENVID}`
  : `https://orchestrate.pingone.com/v1/company/${process.env.ENVID}`;


/********************************************
 * Helper Functions
 *******************************************/

// Obtains an access token for the PingOne worker application used to call PingOne API endpoints.
// This is a naive implementation that gets a token every time.
// It could be improved to cache the token and only get a new one when it is expiring.
/**
 * Cache for worker token to avoid fetching on every call.
 */
let _cachedWorkerToken = null;
let _cachedWorkerTokenExpiry = 0;

/**
 * Obtains an access token for the PingOne worker application.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<string>} Access token string.
 */
async function getWorkerToken(envObject) {
  // Return cached token if still valid (with 5s buffer)
  if (_cachedWorkerToken && Date.now() < _cachedWorkerTokenExpiry - 5000) {
    return _cachedWorkerToken;
  }
  const apiEndpoint = "as/token";
  const envId = envObject?.envId ?? process.env.ENVID;
  const workerId = envObject?.workerId ?? process.env.WORKERID;
  const workerSecret = envObject?.workerSecret ?? process.env.WORKERSECRET;
  const url = `https://auth.pingone.com/${envId}/${apiEndpoint}`;
  const authString = Buffer.from(`${workerId}:${workerSecret}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "client_credentials" });

  const response = await fetch(url, {
    method: "POST",
    body: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${authString}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to get worker token: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  _cachedWorkerToken = data.access_token;
  _cachedWorkerTokenExpiry = Date.now() + (data.expires_in * 1000);
  return _cachedWorkerToken;
}

// Obtains an "SDK token" that is passed into the DV widget to execute the flow policy.
// The session token is passed in via 'global.sessionToken' to make it available to the flow.
// exports.getSdkToken = async (sessionToken) => {
/**
 * Obtains an SDK token for the PingOne DevOps widget.
 * @param {string} policyId Policy ID to apply.
 * @param {string} [sessionToken] Optional session token to include.
 * @returns {Promise<object>} SDK token response.
 */
export async function getSdkToken(policyId, sessionToken) {
  const requestBody = { policyId };
  if (sessionToken) {
    requestBody.global = { sessionToken };
  }

  const url = `${p1OrchestrateRoot}/sdktoken`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SK-API-KEY": process.env.DVAPIKEY,
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error(`SDK token request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Make an authenticated API call to PingOne Protect endpoints.
 *
 * @param {string} url Full URL for the request.
 * @param {string} method HTTP method to use (GET, POST, PUT, etc.).
 * @param {object} [body] Optional request payload.
 * @param {object} [extraHeaders] Optional additional headers to merge.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<object>} Parsed JSON response.
 * @throws {Error} If the HTTP response status is not OK.
 */
async function makeApiCall(url, method, body, extraHeaders, envObject) {
  // Attempt up to two times: if we get 401/403, clear cached token and retry once.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const accessToken = await getWorkerToken(envObject);
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...(extraHeaders || {}),
    });

    const options = { method, headers };
    if (method.toLowerCase() !== 'get' && body != null) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (response.ok) {
      return response.json();
    }
    // On first 401/403, clear cached token (in case scopes/rights changed) and retry
    if (attempt === 1 && (response.status === 401 || response.status === 403)) {
      _cachedWorkerToken = null;
      _cachedWorkerTokenExpiry = 0;
      continue;
    }
    // Otherwise fail, including any error body
    const errorText = await response.text();
    throw new Error(
      `API call failed [${method} ${url}]: ${response.status} ${response.statusText}` +
        (errorText ? ` - ${errorText}` : '')
    );
  }
}

/**
 * An asynchronous delay function using setTimeout to pause execution.
 * @param {number} ms The number of milliseconds to delay.
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Polls (GET) an API until the status changes from it's intitial text value.
 * @param {string} url The URL of the API to poll.
 * @param {string} status The starting string that you want to see when it changes.
 * @returns {Promise<any>} A promise that resolves when the status is not what was requested.
 */
async function pollApiCall(url, expectedStatus) {
  const accessToken = await getWorkerToken();
  while (true) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Polling API failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== expectedStatus) {
      return data;
    }
    await delay(2000);
  }
}

/*** Helper Functions ****

/********************************************
 * PingOne Sessions
 *******************************************/

// Retrieves the session identified by the provided token.
/**
 * Retrieves the current session.
 * @param {string} sessionToken Session token identifier.
 * @returns {Promise<object>} Session details.
 */
export async function getSession(sessionToken) {
  const accessToken = await getWorkerToken();
  const url = `${p1ApiRoot}/sessions/me`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Cookie': `ST=${sessionToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`getSession failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Updates the session identified by the provided token.
/**
 * Updates the current session.
 * @param {string} sessionToken Session token identifier.
 * @param {object} sessionData Updated session payload.
 * @returns {Promise<object>} Updated session details.
 */
export async function updateSession(sessionToken, sessionData) {
  const accessToken = await getWorkerToken();
  const url = `${p1ApiRoot}/sessions/me`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Cookie': `ST=${sessionToken}`,
    },
    body: JSON.stringify(sessionData),
  });
  if (!response.ok) {
    throw new Error(`updateSession failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
/* PingOne Sessions */

/******************************************
* PingOne Authorize
******************************************/
/**
 * Evaluate an authorization decision via PingOne Protect decision endpoint.
 * @param {string} decisionEndpoint Decision endpoint identifier.
 * @param {object} params Parameters to include in the decision request.
 * @returns {Promise<object>} Authorization decision response.
 */
export async function getAuthorizeDecision(decisionEndpoint, params) {
  const apiEndpoint = `decisionEndpoints/${decisionEndpoint}`;
  const url = `${p1ApiRoot}/${apiEndpoint}`;
  const body = { parameters: params };
  return makeApiCall(url, "post", body);
}

/******************************************
* PingOne Credentials
******************************************/
/**
 * Pair a digital wallet for a user in PingOne Protect.
 * @param {string} applicationInstanceID Application instance identifier.
 * @param {string} digitalWalletApplicationID Digital wallet application identifier.
 * @param {string} userId User identifier.
 * @returns {Promise<object>} Pairing response.
 */
export async function pairDigitalWallet(applicationInstanceID, digitalWalletApplicationID, userId) {
  const apiEndpoint = `users/${userId}/digitalWallets`;
  const url = `${p1ApiRoot}/${apiEndpoint}`;
  const body = {
    digitalWalletApplication: { id: digitalWalletApplicationID },
    applicationInstance: { id: applicationInstanceID },
  };
  return makeApiCall(url, "post", body);
}

/**
 * Poll a presentation session credential transaction until it leaves INITIAL status.
 * @param {string} transactionId Presentation session transaction identifier.
 * @returns {Promise<object>} Credential transaction result.
 */
export async function getCredentialTransaction(transactionId) {
  const apiEndpoint = `presentationSessions`;
  const url = `${p1ApiRoot}/${apiEndpoint}/${transactionId}`;
  return pollApiCall(url, "INITIAL");
}

/**
 * Evaluates a risk decision via the PingOne Protect API.
 * @param {object} body Risk evaluation payload.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<object>} Risk evaluation response.
 */
export async function getProtectDecision(body, envObject) {
  const apiEndpoint = `riskEvaluations`;
  const url = envObject
    ? `https://api.pingone.${envObject.region}/v1/environments/${envObject.envId}/${apiEndpoint}`
    : `${p1ApiRoot}/${apiEndpoint}`;
  return makeApiCall(url, "post", body, null, envObject);
}

/**
 * Updates a risk decision status via the PingOne Protect API.
 * @param {string} id Evaluation identifier.
 * @param {string} status Completion status.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<object>} Update response.
 */
export async function updateProtectDecision(id, status, envObject) {
  const body = { completionStatus: status };
  const apiEndpoint = `riskEvaluations/${id}/event`;
  const url = envObject
    ? `https://api.pingone.${envObject.region}/v1/environments/${envObject.envId}/${apiEndpoint}`
    : `${p1ApiRoot}/${apiEndpoint}`;
  return makeApiCall(url, "put", body, null, envObject);
}
/* PingOne Protect */

/********************************************
 * PingOne MFA
 *******************************************/
export async function createMfaDevice(userId, body){
  
  const apiEndpoint = `users/${userId}/devices`
  const url = `${p1ApiRoot}/${apiEndpoint}`
  
  const response = await makeApiCall(url, "post", body)
  
  return response
}

export async function activateMfaDevice(userId, deviceId, body){
  
  const apiEndpoint = `users/${userId}/devices/${deviceId}`;
  const url = `${p1ApiRoot}/${apiEndpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.pingidentity.device.activate+json',
      'Authorization': `Bearer ${await getWorkerToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`activateMfaDevice failed [${url}]: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function createMfaDeviceAuthentication(userId){
  
  const apiEndpoint = `deviceAuthentications`
  const url = `${p1ApiRoot}/${apiEndpoint}`
  
  const body = {
      "user": {
        "id": userId
      } 
    }

  const response = await makeApiCall(url, "post", body)
  
  return response
}

export async function validateMfaDeviceAuthentication(deviceAuthId, body){
  
  const apiEndpoint = `deviceAuthentications/${deviceAuthId}`;
  const url = `${p1ApiRoot}/${apiEndpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.pingidentity.assertion.check+json',
      'Authorization': `Bearer ${await getWorkerToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`validateMfaDeviceAuthentication failed [${url}]: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function rememberDevice(payload, sessionId, userId, envObject){
  
  const p1UserId = await findUserByUsername(userId, envObject)
  const apiEndpoint = `users/${p1UserId}/devices`
  
  if (envObject){
    var url = `https://api.pingone.${envObject.region}/v1/environments/${envObject.envId}/${apiEndpoint}`
  } else {
    var url = `${p1ApiRoot}/${apiEndpoint}`
  }
  
  const body = {
    "type": "BROWSER",
    "payload": payload,
    "session": {
        "id": sessionId
    }
  }
  
  const response = await makeApiCall(url, "post", body, null, envObject)

  return response
}
/* PingOne MFA */

/* PingOne SSO */
/**
 * Create a new user in the PingOne environment.
 * @param {string} username Username to create.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<object>} Created user object.
 */
export async function createUser(username, envObject) {

  const apiEndpoint = `users/`
  
  if (envObject){
    var url = `https://api.pingone.${envObject.region}/v1/environments/${envObject.envId}/${apiEndpoint}`
  } else {
    var url = `${p1ApiRoot}/${apiEndpoint}`
  }
  
  const population = await getDefaultPopulation(envObject)
  
  const body = {
    username: username,
    population: {
      id: population
    }
  }
  
  const response = await makeApiCall(url, "post", body, null, envObject);
  return response;
}

/**
 * Find a user by username, or create one if not found.
 * @param {string} username Username to search for.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<string>} User ID.
 */
export async function findUserByUsername(username, envObject) {
  const apiEndpoint = `users?filter=username eq "${username}"`;
  const url = envObject
    ? `https://api.pingone.${envObject.region}/v1/environments/${envObject.envId}/${apiEndpoint}`
    : `${p1ApiRoot}/${apiEndpoint}`;
  const response = await makeApiCall(url, "get", null, null, envObject);
  if (response.size === 1) {
    return response._embedded.users[0].id;
  }
  const newUser = await createUser(username, envObject);
  return newUser.id;
}

/**
 * Retrieve the default population ID in the environment.
 * @param {object} [envObject] Optional override for environment variables.
 * @returns {Promise<string>} Default population ID.
 */
export async function getDefaultPopulation(envObject) {
  const apiEndpoint = `populations`;
  const url = envObject
    ? `https://api.pingone.${envObject.region}/v1/environments/${envObject.envId}/${apiEndpoint}`
    : `${p1ApiRoot}/${apiEndpoint}`;
  const response = await makeApiCall(url, "get", null, null, envObject);
  const [defaultPop] = response._embedded.populations.filter(obj => obj.default === true);
  return defaultPop.id;
}

/* PingOne SSO */

/*********************************************
 * PingOne Images API
*********************************************/

// Uploads an base64 JPEG image to P1 Images API.
export async function uploadImage(filename, image) {
  
  const apiEndpoint = `images`;
  const url = `${p1ApiRoot}/${apiEndpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
      'Authorization': `Bearer ${await getWorkerToken()}`,
      'content-disposition': `attachment; filename=${filename}`,
    },
    body: image,
  });
  if (!response.ok) {
    throw new Error(`uploadImage failed [${url}]: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
//* PingOne Images API */
