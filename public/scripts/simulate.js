const sessionId = crypto.randomUUID();

let countdownInterval; // Declare countdownInterval in a higher scope

function onPingOneSignalsReady(callback) {
  if (window["_pingOneSignalsReady"]) {
    callback();
  } else {
    document.addEventListener("PingOneSignalsReadyEvent", callback);
  }
}

onPingOneSignalsReady(function () {
  _pingOneSignals
    .init({
      behavioralDataCollection: true,
      disableTags: false,
      universalDeviceIdentification: true,
    })
    .then(function () {
      console.log("PingOne Signals initialized successfully");
      // Uncomment the below if you want to profile on init
      // return _pingOneSignals.getData()
    })
    .then(function (payload) {
      //document.getElementById("sdkPayload").innerText = payload;
    })
    .catch(function (e) {
      console.error("SDK Init failed", e);
      //document.getElementById("sdkPayload").value = e;
    });
});

// Perform Risk Eval on button click event
// This is a server-side call due to the P1 Protect request needing a Worker token
async function getRiskDecision() {
  const executeFetch = async () => {
    let sdkPayload = await _pingOneSignals.getData();

    let ipv4 = null; // Initialize ipv4 to null

    try {
      const response = await fetch("https://api.ipify.org?format=json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      ipv4 = data.ip; // Assign the IP address from the response
    } catch (error) {
      console.error("Error retrieving IPv4 address:", error);
    }
    
    const sendPayload = document.getElementById("sendSignalsToggle").checked
    if (!sendPayload) {     
      console.log("Signals payload removed")
      sdkPayload = undefined
    }
    
    const hijackedElem = document.getElementById("hijackedPayload");
    const hijackedPayload = hijackedElem.value || hijackedElem.textContent;
    if (hijackedPayload) {
      console.log("Hijacked payload added");
      sdkPayload = hijackedPayload;
    }

    const body = {
      username: document.getElementById("floatInputUsername").value,
      sdkpayload: sdkPayload,
      envId: document.getElementById("floatInputEnv").value,
      region: document.getElementById("regionSelect").value,
      workerId: document.getElementById("floatInputWorkerId").value,
      workerSecret: document.getElementById("floatInputWorkerSecret").value,
      sessionId: sessionId,
      ipv4: ipv4,
      rememberDevice: document.getElementById("rememberDeviceToggle").checked
    };

    console.log(body);

    try {
      const response = await fetch("/getRiskDecision", {
        headers: {
          "content-type": "application/json",
        },
        method: "post",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Display the decision result alongside the request payload as a table
      // Show decision JSON
      document.getElementById("riskResult").innerHTML =
        "<pre>" + JSON.stringify(data.result, null, 2) + "</pre>";

      // Display the Request Object (made Server-Side)
      document.getElementById("requestPayload").innerHTML =
          "<pre>" + JSON.stringify(data.request || {}, null, 2) + "</pre>";

      // Display the Evaluation Response Object
      // Remove the .request object that was returned - it's displayed above
      delete data.request
      document.getElementById("riskDetails").innerHTML =
        "<pre>" + JSON.stringify(data, null, 2) + "</pre>";

      const threatDetails = data.details;

      const high = jsonPath(threatDetails, '$.[?(@.level === "HIGH")]');
      const medium = jsonPath(
        threatDetails,
        '$.[?(@.level === "MEDIUM")].type'
      );
      const low = jsonPath(threatDetails, '$.[?(@.level === "LOW")].type');
      const training = jsonPath(
        threatDetails,
        '$.[?(@.status === "IN_TRAINING_PERIOD")].type'
      );

      document.getElementById("predictorsHigh").innerHTML =
        "<pre>" + JSON.stringify(high, null, 2) + "</pre>";
      document.getElementById("predictorsMed").innerHTML =
        "<pre>" + JSON.stringify(medium, null, 2) + "</pre>";
      document.getElementById("predictorsLow").innerHTML =
        "<pre>" + JSON.stringify(low, null, 2) + "</pre>";
      document.getElementById("predictorsTraining").innerHTML =
        "<pre>" + JSON.stringify(training, null, 2) + "</pre>";

      showAllTabs(); //Show all tabs after data is loaded.

      // Trigger tab re-render.
      const activeTab = document.querySelector("#myTabs .nav-link.active");
      if (activeTab) {
        const tab = new bootstrap.Tab(activeTab);
        tab.show();
      }
    } catch (err) {
      console.error("getRiskDecision: ", err);
    }
  };

  const generateRandomInterval = () => {
    const minMinutes = 5;
    const maxMinutes = 30;
    return (
      Math.floor(Math.random() * (maxMinutes - minMinutes + 1) + minMinutes) *
      60 *
      1000
    ); // Convert minutes to milliseconds
  };

  const scheduleNextExecution = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval); // Clear the previous interval
    }

    const interval = generateRandomInterval();
    const scheduledTime = new Date(Date.now() + interval);

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = scheduledTime - now;

      if (distance <= 0) {
        document.getElementById("countdown").textContent = "Now!";
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      document.getElementById("countdown").textContent =
        minutes + "m " + seconds + "s";
    };

    updateCountdown(); // Initial update
    countdownInterval = setInterval(updateCountdown, 1000); // Assign interval to the variable

    setTimeout(() => {
      clearInterval(countdownInterval);
      executeFetch();
      scheduleNextExecution(); // Reschedule after execution
    }, interval);
  };

  executeFetch(); // Execute immediately on first run
  scheduleNextExecution(); // Start the scheduling process
}

async function generateDashboard() {
  const body = {
    envId: document.getElementById("floatInputEnv").value,
    region: document.getElementById("regionSelect").value,
    workerId: document.getElementById("floatInputWorkerId").value,
    workerSecret: document.getElementById("floatInputWorkerSecret").value,
  };

  const generateDashboard = await fetch("/generateDashboard", {
    headers: {
      "content-type": "application/json",
    },
    method: "post",
    body: JSON.stringify(body),
  });

  console.log(await generateDashboard.json());
}

/* Below functions used to parse and display the Evaluation response */
function showRiskResult() {
  document.getElementById("nextExecution").classList.remove("d-none");
  document.getElementById("configCard").classList.add("d-none");

  // Show only result tab and details tab.
  document.getElementById("navResult-tab").classList.remove("d-none");
  document.getElementById("navDetails-tab").classList.remove("d-none");

  // Hide all predictor tabs.
  document.getElementById("navHigh-tab").classList.add("d-none");
  document.getElementById("navMed-tab").classList.add("d-none");
  document.getElementById("navLow-tab").classList.add("d-none");
  document.getElementById("navTraining-tab").classList.add("d-none");

  // Trigger tab activation.
  const resultTab = new bootstrap.Tab(document.getElementById("navResult-tab"));
  resultTab.show();
}

//Function to show all tabs.
function showAllTabs() {
  document.getElementById("nextExecution").classList.remove("d-none");
  document.getElementById("configCard").classList.add("d-none");

  document.getElementById("navResult-tab").classList.remove("d-none");
  document.getElementById("navDetails-tab").classList.remove("d-none");
  document.getElementById("navRequest-tab").classList.remove("d-none");
  document.getElementById("navHigh-tab").classList.remove("d-none");
  document.getElementById("navMed-tab").classList.remove("d-none");
  document.getElementById("navLow-tab").classList.remove("d-none");
  document.getElementById("navTraining-tab").classList.remove("d-none");
}

{
  const hijackSignalsToggle = document.getElementById("hijackSignalsToggle");
  const hijackPayloadDisplay = document.getElementById("hijackPayloadDisplay");
  const hijackedPayloadDiv = document.getElementById("hijackedPayload");
  if (hijackSignalsToggle && hijackPayloadDisplay && hijackedPayloadDiv) {
    hijackSignalsToggle.addEventListener('change', async () => {
      if (hijackSignalsToggle.checked) {
        hijackPayloadDisplay.classList.remove("d-none");
        const sdkPayload = await _pingOneSignals.getData();
        hijackedPayloadDiv.innerText = sdkPayload;
        const copyButton = document.getElementById("copyPayloadButton");
        if (copyButton) {
          copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(sdkPayload)
              .then(() => {
                copyButton.innerHTML = '<i class="bi bi-clipboard-check"></i> <span class="visually-hidden">Copied!</span>';
                setTimeout(() => {
                  copyButton.innerHTML = '<i class="bi bi-clipboard"></i> <span class="visually-hidden">Copy</span>';
                }, 1500);
              })
              .catch(() => {
                copyButton.innerHTML = '<i class="bi bi-clipboard-x"></i> <span class="visually-hidden">Error</span>';
                setTimeout(() => {
                  copyButton.innerHTML = '<i class="bi bi-clipboard"></i> <span class="visually-hidden">Copy</span>';
                }, 1500);
              });
          });
        }
      } else {
        hijackPayloadDisplay.classList.add("d-none");
      }
    });
  }
}

{
  const aitmToggle = document.getElementById("aitmToggle");
  if (aitmToggle) {
    aitmToggle.addEventListener('change', () => {
      if (aitmToggle.checked) {
        // Redirect to the AITM demonstration environment
        window.open(
          'https://pingone-protect-signals.p1ng-demos.com/simulate.html',
          '_blank'
        );
      }
    });
  }
}
// Replace inline onclick handlers with event listeners

document.getElementById("formSubmit")?.addEventListener("click", getRiskDecision);
document.getElementById("evaluateButton")?.addEventListener("click", getRiskDecision);
document.getElementById("generateDashboardButton")?.addEventListener("click", generateDashboard);

// If running in the AITM demo domain, switch styling and title
(function () {
  const AITM_HOST = 'p1ngone-protect-signals.ping-demos.com';
  if (window.location.hostname === AITM_HOST) {
    // Switch from red to a darker blue background
    document.body.classList.remove('bg-danger');
    document.body.style.backgroundColor = '#0d1f47';
    const titleEl = document.querySelector('h5.card-title');
    if (titleEl) {
      titleEl.textContent = `${titleEl.textContent} (AITM)`;
    }
    document.title = `${document.title} (AITM)`;
  }
})();
