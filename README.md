# PingOne Protect - Signals SDK Demo

This demo application illustrates how to integrate the [PingOne Signals SDK](https://apidocs.pingidentity.com/pingone/native-sdks/v1/api/#pingone-risk-sdk-for-web) for browser profiling and use the [PingOne Protect Risk API](https://developer.pingidentity.com/en/cloud-services/pingone-risk.html) to retrieve risk decisions.

## Features

- **Basic Profiling** (`/index.html`): Initialize the Signals SDK and obtain raw payload.
- **Form Interaction** (`/form.html`): Profile user interactions on a form and perform a risk evaluation.
- **Simulate Traffic** (`/simulate.html`): Send periodic, randomized risk evaluation calls to simulate ongoing user activity.
- **Hijack Payload** (`/hijack.html`): Inject a captured Signals payload into a new session to demonstrate hijack detection.

## Prerequisites
- Node.js v20.x (latest LTS)
- A PingOne Protect Environment (Environment ID, Worker credentials, etc.)

## Setup

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd pingone-protect-signals
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with your PingOne credentials:

  ```ini
   # .env
   ENVID=<Your PingOne Environment ID>
   WORKERID=<Your Worker (Client) ID>
   WORKERSECRET=<Your Worker Secret>
   DVAPIKEY=<Your DevOps API Key for SDK Token>
   # Optional overrides:
   APIROOT=https://api.pingone.com/v1/environments
   AUTHROOT=https://auth.pingone.com
   ORCHESTRATEAPIROOT=https://orchestrate.pingone.com
   protectDashboardUrl=<Newman collection URL or file path>
  ```

> **Note:** Your Worker (client) credentials must have the proper PingOne Protect API permissions (e.g. to call riskEvaluations). If you recently updated the worker scopes, restart the server to fetch a fresh token.

4. Start the server:

   ```bash
   npm start
   ```

5. Open your browser to `http://localhost:3000/` and explore the demo pages.

## Environment Variables

| Variable             | Description                                             |
|----------------------|---------------------------------------------------------|
| `ENVID`              | PingOne Protect Environment ID                          |
| `WORKERID`           | PingOne Worker (Client) ID                              |
| `WORKERSECRET`       | PingOne Worker Secret                                   |
| `DVAPIKEY`           | API key for obtaining SDK token                         |
| `APIROOT`            | (Optional) PingOne API root URL                         |
| `AUTHROOT`           | (Optional) PingOne Auth root URL                        |
| `ORCHESTRATEAPIROOT` | (Optional) PingOne Orchestrate API root URL             |
| `protectDashboardUrl`| (Optional) Newman collection URL or local file path      |

## Docker

Build the Docker image:

```bash
docker build -t pingone-protect-signals .
```

Run the container (using your `.env` file for environment variables):

```bash
docker run -d -p 3000:3000 --env-file .env --name pingone-protect-signals pingone-protect-signals
```

Open your browser to `http://localhost:3000/` to access the demo.

## License

MIT
