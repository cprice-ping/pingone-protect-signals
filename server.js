// NodeJS imports
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
import 'dotenv/config';
import './modules/config.js';
import { fileURLToPath } from "url";
import { spawn } from 'child_process';
import path from 'path';

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

import { runProtectDashboard } from './modules/protectDashboardSimulator.js';

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
  // Run 100 sequentially
  (async () => {
    for (let i = 0; i < 100; i++) {
      try {
        await runProtectDashboard(envVars);
        console.log(`Protect Dashboard run ${i + 1}/100 completed`);
      } catch (err) {
        console.error(`Protect Dashboard run ${i + 1}/100 failed:`, err);
      }
    }
    console.log('All 100 Protect Dashboard runs completed');
  })();
});

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
