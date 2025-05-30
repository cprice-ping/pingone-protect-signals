# PingOne Signals SDK

This project is a demo of using the [PingOne Signals SDK](https://apidocs.pingidentity.com/pingone/native-sdks/v1/api/#pingone-risk-sdk-for-web) to profile a webpage 
and use it to receive a decision from the [PingOne Risk](https://developer.pingidentity.com/en/cloud-services/pingone-risk.html) service

## What's in this project?

← `README.md`: That’s this file, where you can tell people what your cool website does and how you built it.

← `server.js`: The **Node.js** server script for your new site. The server is used to perform the Risk Evaluation call using a Worker token from PingOne.

← `.env`: Contains the secrets for the P1 Worker app

← `package.json`: The NPM packages for your project's dependencies.

← `public/`: This folder holds the demo website

← `public/index.html`: This is the main page. The Signals SDK is loaded in the `<head>` section

← `public/scripts/profile.js`: A script to initialize the Signals SDK and perform the `getData()` request when the button is pressed

**_Want a minimal version of this project to build your own Node.js app? Check out [Blank Node](https://glitch.com/edit/#!/remix/glitch-blank-node)!_**

![Glitch](https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576)

## You built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Need more help? [Check out our Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
