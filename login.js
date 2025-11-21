const pup = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

console.log("stealth plugin starting");
pup.use(StealthPlugin());
console.log("loading settings");
//const settings = JSON.parse(fs.readFileSync("data/settings.txt", "utf8", () => {}));

async function login() {
	
	// open browser
	console.log("opening browser");
	const browser = await pup.launch({"headless" : false});
	const pages = await browser.pages();
	const [page] = pages;
	
	//go to website
	await page.goto("https://www.facebook.com/marketplace/");

	//wait for signal (opening another tab)
	while (true) {
		await new Promise(r => setTimeout(r, 200));
		const pagesAmount = (await browser.pages()).length;
		if (pagesAmount > 1) {
			break
		}
	}
	
	//save cookies
	const cookies = await page.cookies();
	await fs.writeFile('data/cookies.json', JSON.stringify(cookies, null, 2), () => {}); // Save cookies as JSON
	await browser.close();
	
}

login();