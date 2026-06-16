const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle" });
  const textarea = await page.waitForSelector("textarea");
  await textarea.fill("Cau thang toi thieu rong bao nhieu?");
  await page.keyboard.press("Enter");

  await page.waitForTimeout(300);
  const btnText = await page.locator("button:has-text('Dừng'), button:has-text('Gửi')").last().innerText();
  console.log("BUTTON_TEXT_DURING_STREAM:", btnText);
  await page.screenshot({ path: "screenshots2/during-stream.png" });

  await page.waitForTimeout(6000);
  const btnText2 = await page.locator("button:has-text('Dừng'), button:has-text('Gửi')").last().innerText();
  console.log("BUTTON_TEXT_AFTER:", btnText2);

  await browser.close();
})();
