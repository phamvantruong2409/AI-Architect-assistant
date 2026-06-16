const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (msg) => {
    if (msg.text().includes("DEBUG")) console.log(msg.text());
  });

  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle" });
  const textarea = await page.waitForSelector("textarea");
  await textarea.fill("test debug stop button");
  await page.keyboard.press("Enter");

  await page.waitForTimeout(3000);

  await browser.close();
})();
