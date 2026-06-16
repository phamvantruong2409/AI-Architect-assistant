const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle" });
  const textarea = await page.waitForSelector("textarea");
  await textarea.fill("Cau thang toi thieu rong bao nhieu lan 2?");
  await page.keyboard.press("Enter");

  await page.waitForTimeout(500);
  const html = await page.locator(".border-t.border-border.bg-background").last().innerHTML();
  console.log(html);

  await browser.close();
})();
