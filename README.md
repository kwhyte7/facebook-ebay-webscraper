# Facebook and Ebay Webscraper

This was one of my earlier projects. This enables you to scrape ebay and facebook marketplace to find good prices on a product. It will post the results to a discord webhook.

## Requirements

You will need:

Nodejs
Node Package Manager NPM

Install the required packages:

```
npm install fs
npm install puppeteer
npm install puppeteer-extra
npm install puppeteer-extra-plugin-stealth
npm install node-fetch
```

You can edit the settings using the settings.txt file located at `data/settings.txt`
The settings file is in JSON format.

## Usage

Configure your settings first. You should input your discord webhook URL.

You will need to use the login.js file to set your cookies.
Use login.js and login to the sites. When you are finished, open a tab to save the cookies and the web browser should close on its own.

Once you have logged in, open the main.js file with nodejs. The programs should automatically scrape the websites. 

When finished, it will produce a log of all the data it collected in the logs/ folder. If you added a discord webhook it should output there
