// NodeJS imports
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
import 'dotenv/config';
import './modules/config.js';
import { fileURLToPath } from "url";
import path from "path";

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const newman = require('newman');

// PingOne Server SDK
import * as pingOneClient from "./modules/pingOneSDK.js"

// Require the fastify framework and instantiate it
import Fastify from "fastify"
import cors from '@fastify/cors'
const fastify = Fastify({
  // Set this to true for detailed logging
  logger: false,
  ignoreTrailingSlash: true,
  trustProxy: true
});

// Enable CORS for all origins
fastify.register(cors, { origin: true });

// Initialize variables that are no longer available by default in Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Formbody lets us parse incoming forms
fastify.register(import("@fastify/formbody"));


/******************************************
* PingOne Risk - Evaluation request
******************************************/
fastify.post('/getRiskDecision', async (request, reply) => {
  try {
    const { ipv4, envId, region, workerId, workerSecret, username, sessionId, sdkpayload, rememberDevice } = request.body;
    const ipAddress = ipv4 ?? request.ip;
    const envObject = {
      envId: envId || process.env.ENVID,
      region: region || 'com',
      workerId: workerId || process.env.WORKERID,
      workerSecret: workerSecret || process.env.WORKERSECRET,
    };

    const eventPayload = {
      targetResource: { id: 'Signals SDK demo', name: 'Signals SDK demo' },
      ip: ipAddress,
      flow: { type: 'AUTHENTICATION' },
      session: { id: sessionId ?? 'genericSessionId' },
      browser: { userAgent: request.body.browser?.userAgent || request.headers['user-agent'] },
      sdk: { signals: { data: sdkpayload } },
      user: { id: username, name: username, type: 'EXTERNAL' },
      sharingType: 'PRIVATE',
      origin: 'FACILE_DEMO',
    };

    const decision = await pingOneClient.getProtectDecision({ event: eventPayload }, envObject);
    if (!decision.result.recommendedAction) {
      await pingOneClient.updateProtectDecision(decision.id, 'SUCCESS', envObject);
    }
    if (rememberDevice) {
      await pingOneClient.rememberDevice(sdkpayload, sessionId ?? 'genericSessionId', username, envObject);
    }
    // Echo back the incoming request body for client-side display
    return { ...decision, request: eventPayload };
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

fastify.post('/generateDashboard', async (request, reply) => {
  const { envId, region, workerId, workerSecret } = request.body;
  const envVars = {
    envId,
    pingOneAuthNURL: `https://auth.pingone.${region}`,
    pingOneMgmtURL: `https://api.pingone.${region}`,
    workerId,
    workerSecret,
  };
  reply.send({ message: 'Dashboard events executing' });
  await runNewmanCollection(process.env.protectDashboardUrl, envVars, true, 10);
});

// This allows you to run Newman as a function and receive a JSON object of the resulting Environment variables
// Call with the Collection and any starting variables (as an Array)
// Logging can be enabled with noLogs: false
async function runNewmanCollection(url, env, noLogs, iterationCount) {
  try {
      newman.run({
          collection: url,
            environment: {
              values: [
                { key: "envId", value: env.envId },
                { key: "pingOneAuthNURL", value: env.pingOneAuthNURL },
                { key: "pingOneMgmtURL", value: env.pingOneMgmtURL },
                { key: "workerId", value: env.workerId },
                { key: "workerSecret", value: env.workerSecret } 
              ]
            },
          reporters: ["cli"],
          reporter: { cli: { silent: noLogs } },
          iterationCount: iterationCount, // Specify the number of iterations
      });
      fastify.log.info(`Newman collection executed ${iterationCount} times.`);
  } catch (error) {
      fastify.log.error(`Error executing Newman collection: ${error}`);
  }
}

// Setup our static files (serve demo pages/assets)
fastify.register(import("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Run the server and report out to the logs
const port = process.env.PORT || 3000;
fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening at ${address}`);
});
