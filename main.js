const pup = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

console.log("stealth plugin starting");
pup.use(StealthPlugin());
console.log("loading settings");
const cookies = JSON.parse(fs.readFileSync("data/cookies.json", "utf8", () => {}));
const settings = JSON.parse(fs.readFileSync("data/settings.txt", "utf8", () => {}));

class EbayScraper {
  constructor(page) {
    this.page = page;
  }

  searchfor (item) {
    return new Promise(async (resolve, reject) => {
      await this.page.goto(settings.ebayUrl);
      this.page.evaluate(async (item) => {
        const searchElem = document.querySelector("input[type='text'][placeholder='Search for anything']");
        searchElem.value = item;
        searchElem.dispatchEvent(new InputEvent("input", {bubbles : true, cancelable : true}));

        await new Promise((res) => {setTimeout(res, 300)});

        const buttonElem = document.querySelector("input[type=submit][value=Search]");
        buttonElem.click();
        buttonElem.dispatchEvent(new MouseEvent("click", {bubbles : true, cancelable : true}));
      }, item)
        .then(() => {resolve()})
        .catch((err) => {reject(err)});
    });
  }

  async setItemsPerPage(to=60, minprice=0, maxprice=99999) {
    let url = await this.page.url();
    if (url.includes("_ipg=")) {
      ["60", "120", "240"].forEach((possibleipg) => {url = url.replace(`&_ipg=${possibleipg}`, `&_ipg=${to}`)});
    } else {
      url += `&_ipg=${to}`;
    };
	url += `&_udlo=${minprice}&_udhi=${maxprice}`
    console.log(`items per page now ${to}`);
    await this.page.goto(url);
    return;
  };

  scrapePage () {
    return new Promise((resolve, reject) => {
      this.page.evaluate(() => {

        function getNumbersFromString(string) {
          string = string.trim() + " ";
          const numchars = "1234567890.";
          const nums = [];
          let currentNumString = "";

          for (let i = 0; i < string.length; i++) {
            const currentchar = string[i];
            if (numchars.includes(currentchar)) {
              currentNumString += currentchar;
            } else if (currentNumString.length) {
              nums.push(parseFloat(currentNumString))
              currentNumString = "";
            }
          };

          return nums;
        };

        const itemElems = document.querySelectorAll("li.s-item");
        const items = [];

        itemElems.forEach((itemElem) => {

          const priceElem = itemElem.querySelector("span.s-item__price");
          const nameElem = itemElem.querySelector("div.s-item__title");
          const urlElem = itemElem.querySelector("a.s-item__link");

          let shippingCost = 0;

          const shippingElem = itemElem.querySelector("span.s-item__shipping");
          if (shippingElem) {const nums = getNumbersFromString(shippingElem.innerText); if (nums.length) {shippingCost = nums.slice(-1)[0]}};

          if (priceElem && nameElem && urlElem) {
            const prices = {low : null, high : null, mean : null};
            const nums = getNumbersFromString(priceElem.textContent.trim());

            prices.low = nums[0] + shippingCost;
            prices.high = nums.slice(-1)[0] + shippingCost;

            prices.mean = parseFloat(((prices.low + prices.high)/2).toFixed(2));
            prices.shipping = shippingCost;

            //items.push({name : nameElem.innerText.trim(), price : prices, url : urlElem.href.trim()});
			items.push({name : nameElem.innerText.trim(), price : prices.mean + prices.shipping, href : urlElem.href.split("?")[0]});
          };

        })

        return items;
      }).then((items) => {resolve(items)}).catch((err) => {reject(err)});
    });
  };

  static getMedianPrice(items, from="mean") {
    const prices = [];
    items.forEach((item) => {prices.push(item.price[from])});
    prices.sort();

    let median;

    if (prices.length % 2) { // is odd
      median = parseFloat(prices[Math.floor(prices.length/2)]);
    } else { // is even
      median = parseFloat(((prices[prices.length/2] + prices[(prices.length/2) - 1])/2).toFixed(2));
    };

    console.log(`median price ${median} && lowest price ${Math.min(...prices)}`)
    return median;
  };

  static filterForGoodPrices(items, anchorprice, deviation=0.1, from="mean") {
    return items.filter((item) => ((item.price[from] <= anchorprice*(1 - deviation)) && (item.price[from] >= anchorprice*0.1)));
  };

  async getItems (productname, minprice=0, maxprice=99999, itemamount=240) {
    await this.searchfor(productname);
    await new Promise((res) => {setTimeout(res, 2300)});
    await this.setItemsPerPage(itemamount, minprice, maxprice);
    await new Promise((res) => {setTimeout(res, 6000)});
    return await this.scrapePage();
  };

  getCheapItems(productname, deviation=0.1, from="mean", itemamount=240) {
    return new Promise((resolve, reject) => {
      this.getItems(productname, itemamount)
        .then((items) => {
          console.log("items:", items.length);
          const median = Scraper.getMedianPrice(items);
          resolve([Scraper.filterForGoodPrices(items, median, deviation, "high"), median])})
        .catch((err) => {reject(err)});
    });
  };

};


async function main() {
	
	// open browser
	console.log("opening browser");
	const browser = await pup.launch({"headless" : settings["If you want to show browser then make this say false, if not make it say new"]});
	await browser.newPage();
	const pages = await browser.pages();
	const [page, ebayPage] = pages;
	const ebayScraper = new EbayScraper(ebayPage);
	
	//go to website
	
	await page.setViewport({width: 1280, height: 720});
	
	function delay(t) {
		return new Promise(r => setTimeout(r, t));
	}
	
	console.log("logging into facebook site")
	await page.goto("https://www.facebook.com/marketplace/");
	await page.setCookie(...cookies) //load cookies
	console.log("setting cookies");
	await delay(1000);
	await page.goto("https://www.facebook.com/marketplace/"); // reload page
	console.log("loaded cookies");
	

	
	async function searchbar(thing, minprice=0, maxprice=99999) {
		await page.type('input[placeholder="Search Marketplace"][type=search]', thing + "\n");
		await delay(3000)
		await page.type('input[aria-label="Minimum range"]', minprice.toString());
		await page.type('input[aria-label="Maximum range"]', maxprice.toString()); 
	}

	async function scrapeFacebook(thing, scrolls=1, minprice=0, maxprice=99999, delaytime=2000) {
		
		await delay(delaytime);
		await searchbar(thing); //add price info
		for (let i = -1; i < scrolls; i++) {
			await delay(delaytime);
			await page.evaluate(() => {
				const scrollElement = document.querySelector('div[aria-label="Collection of Marketplace items"][role = "main"]');
				scrollElement.focus();
				window.scroll(0, 10000)
			});
		};
		delay(delaytime);
		
		//get data
		rawData = await page.evaluate(() => {
			const searchEle = document.querySelector('div[aria-label="Collection of Marketplace items"][role = "main"]');
			const listingElements = Array.from(searchEle.querySelectorAll("a[href]"));
			
			const listingsData = [];
			
			listingElements.forEach(listingElement => {
				const listingText = listingElement.innerText.split("\n");
				if (listingText[1].includes("£")) {
					listingText.splice(1, 1)
				};
				listingsData.push({
					href : listingElement.href.split("?")[0],
					price : listingText[0].trim() == "Free" ? 0 : Number(listingText[0].replaceAll("£", "").replaceAll(",", "")),
					name : listingText[1].trim(),
					location : listingText[2].trim()
				});
			});
			
			return JSON.stringify(listingsData);
		});
		
		return JSON.parse(rawData);
		
	}
	
	function scrapeEbay(thing, minprice=0, maxprice=99999, e) {
		return ebayScraper.getItems(thing, minprice, maxprice, e);
	};
	
	function calculateMedianFromResults(results) {
		
		const priceList = [];
		results.forEach(result => {priceList.push(result.price)});
		priceList.sort((a, b) => {return a - b});
		if (priceList.length % 2 == 0) { // even
			return (priceList[priceList.length / 2 - 1] + priceList[priceList.length / 2]) / 2
		} else { // odd
			return priceList[(priceList.length - 1) / 2]
		}
		
	}
	
	async function displayResultsOnDiscord(thing, scroll=2, minprice=0, maxprice=99999, viablePriceMultiplier=0.7, viablePriceOffset=30, ebayitems=240) {
		console.log("looking for facebook results...");
		const facebookResults = await scrapeFacebook(thing, scroll, minprice, maxprice);
		console.log("looking for ebay results...");
		const ebayResults = await scrapeEbay(thing, minprice, maxprice, ebayitems);
		results = [...facebookResults, ...ebayResults];
		console.log("found, calculating and sending to discord");
		const median = calculateMedianFromResults(results);
		console.log(median);
		console.log("saving results as backup");
		fs.writeFile(`logs/${thing}_${new Date().getTime()}.json`, JSON.stringify(results, null, 2), () => {});
		const viableResults = results.filter(a => a.price < median*viablePriceMultiplier || a.price < median-viablePriceOffset);
		
		//present on discord using fetch

		const color =  "#" + Math.floor(Math.random() * 16777215).toString(16);
  
		let embedlength = 0;
			
		let embed = {
			title : thing,
			description : `Median price £${median.toFixed(2)}\nPresenting results that are ${(viablePriceMultiplier)*100}% the price of median or ${viablePriceOffset}£ off.\nThere are ${viableResults.length} results`,			
			//color : color,
			fields : []
		};
			
		embedlength = embed.title.length + embed.description.length
		const embeds = [embed];
		
		for (let i = 0; i < viableResults.length; i ++) {
			const r = viableResults[i];
			const newField = {
				name : `${r.price.toFixed(2)}£ ${r.name}`,
				value : `Save ${(median - r.price).toFixed(2)}£ (${((median - r.price)/median * 100).toFixed(2)}%)\n${r.href}`
			}
			newfieldLength = newField.name.length + newField.value.length;
			
			if (embedlength + newfieldLength < 2000) {
				embedlength += newfieldLength;
				embed.fields.push(newField);
			} else {
				i --;
				embed = {
//color : color,
					fields : [],
				};
				embeds.push(embed);
				embedlength = 0;
			}
		};
		
		for (let i = 0; i < embeds.length; i ++) {
			console.log("posting");//, embeds[i]);
			const response = await fetch(settings.webhookUrl, {
				method: "POST",
				headers: {
				  "Content-Type": "application/json",
				},
			body: JSON.stringify({embeds : [embeds[i]]}),
			});
			await delay(5000);
			try {
				console.log( await response.json() );
			} catch (err) {
				console.log(err);
			};
		};
	}
	
	const keys = Object.keys(settings["INSERT WHAT YOU ARE SEARCHING BELOW LIKE THE FOLLOWING"]);
	for (let i = 0; i < keys.length; i++) {
		const item = settings["INSERT WHAT YOU ARE SEARCHING BELOW LIKE THE FOLLOWING"][keys[i]];
		//displayResultsOnDiscord(thing, scroll=2, minprice=0, maxprice=99999, viablePriceMultiplier=0.7, viablePriceOffset=30, ebayitems=240)
		await displayResultsOnDiscord(
			keys[i],
			item["facebook pages"],
			item["minimum price"],
			item["maximum price"],
			item["show items that are x% of average"] / 100,
			item["show items that are x£ off the average"],
			item["ebay items (240, 120, 60)"]
		);
		await delay(2000);
	}
}
	
	/*
	
	{
"webhookUrl" : "https://discord.com/api/webhooks/1253703329633144853/s7KOVZ_6u7GhOCgBKZanpJH9rZUYE3-rNSqwlx5trk6BTFIowHutM-pM2Mf9Wlkk5TLA",
"ebayUrl" : "https://www.ebay.co.uk/",

"INSERT WHAT YOU ARE SEARCHING BELOW LIKE THE FOLLOWING" : [
"Laptop" : {"facebook pages" : 4, "ebay items (240, 120, 60)" : 60, "minimum price" : 0, "maximum price" : 99999, "show items that are x% of average" : 60, "show items that are x£ off the average" : 0}
]
}

	{
	  "title": "Search results from : laptops",
	  "description": "Median price 99.20£\nfound 30 under",
	  "fields": [
		{
		  "name": "69.20£ Laptop_Name",
		  "value": "Save 30£ \nhttps://connersuckscok"
		}
	  ],
	  "color": "#00b0f4",
	  "footer": {
		"text": "page 1"
	  },
	}
	*/

	

main();