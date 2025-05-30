// NodeJS imports
import { fileURLToPath } from "url";
import path from "path";

import fetch from "node-fetch";
import newman from "newman"

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

fastify.register(cors);

// Initialize variables that are no longer available by default in Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup our static files
fastify.register(import("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(import("@fastify/formbody"));

/******************************************
* PingOne Risk - Evaluation request
******************************************/
fastify.all("/getRiskDecision", async (req, res) => {  
  
  // console.log(req.headers['x-forwarded-for'])
  
  let ipAddress = null
  
  if (req.body.ipv4) {
    ipAddress = req.body.ipv4
  } else {
    ipAddress = req.headers['x-forwarded-for'].split(",")[0].trim()
  }
  
    const envObject = {
      envId: req.body.envId ?? process.env.ENVID,
      region: req.body.region ?? "com",
      workerId: req.body.workerId ?? process.env.WORKERID,
      workerSecret: req.body.workerSecret ?? process.env.WORKERSECRET
    }

  const username = req.body.username
  
  console.log("Getting Risk Eval for: ", username)
  
  // Construct Risk Eval body
    const body = {
      event: {
        "targetResource": { 
            "id": "Signals SDK demo",
            "name": "Signals SDK demo"
        },
        "ip": ipAddress, 
        "flow": { 
            "type": "AUTHENTICATION",
            "sub-type": "ACTIVE_SESSION"
        },
        "session": {
            "id": req.body.sessionId ?? "genericSessionId"
        },
        "browser": {
            "userAgent": req.headers['user-agent']
        },
        "sdk": {
          "signals": {
              "data": req.body.sdkpayload // Signals SDK payload from Client
          }
        },
        "user": {
          "id": username, // if P1, send in the UserId and set `type` to PING_ONE
          "name": username, // This is displayed in Dashboard and Audit
          "type": "EXTERNAL"
        },
        "sharingType": "PRIVATE", 
        "origin": "FACILE_DEMO"
      }
    } 
  
    const riskEval = await pingOneClient.getProtectDecision(body, envObject)
    console.log("Result: ", riskEval.result)
    if (!riskEval.result.recommendedAction){
      console.log("No Recommended Action - Sending SUCCESS")
      const updateEval = await pingOneClient.updateProtectDecision(riskEval.id, "SUCCESS", envObject)
    }
    
    console.log("Remember Device: ", req.body.rememberDevice)
  
    if (req.body.rememberDevice){
      const device = await pingOneClient.rememberDevice(req.body.sdkpayload, req.body.sessionId ?? "genericSessionId", username, envObject)
    }
  
    return riskEval
})

fastify.post("/generateDashboard", async (req, res) => {

    const envVars = {
        envId: req.body.envId,
        pingOneAuthNURL: `https://auth.pingone.${req.body.region}`,
        pingOneMgmtURL: `https://api.pingone.${req.body.region}`,
        workerId: req.body.workerId,
        workerSecret: req.body.workerSecret
    };

    res.send({"message": "Dashboard Events executing"});

    // Invoke the async function immediately
    (async () => {
        try {
            await runNewmanCollection(process.env.protectDashboardUrl, envVars, true, 100);
        } catch (error) {
            console.error("Error during cleanup:", error);
        }
    })(); // Notice the added parentheses here to call the function
});

// This allows you to run Newman as a function and receive a JSON object of the resulting Environment variables
// Call with the Collection and any starting variables (as an Array)
// Logging can be enabled with noLogs: false
async function runNewmanCollection(url, env, noLogs, iterationCount) {
    try {
        await newman.run({
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
        console.log(`Newman collection executed ${iterationCount} times.`);
    } catch (error) {
        console.error(`Error executing Newman collection: ${error}`);
    }
}

// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
