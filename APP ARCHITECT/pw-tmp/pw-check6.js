const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle" });
  const textarea = await page.waitForSelector("textarea");
  await textarea.fill("Cau thang toi thieu rong bao nhieu?");
  await page.keyboard.press("Enter");

  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    const lastBubble = await page.locator(".mx-auto.flex.max-w-3xl.flex-col.gap-4 > div").last().innerText().catch(() => "(none)");
    console.log(`t=${(i+1)}s url=${url} lastBubbleLen=${lastBubble.length} preview="${lastBubble.slice(0,60).replace(/\n/g," ")}"`);
  }

  await page.screenshot({ path: "screenshots6/final.png" });
  await browser.close();
})();
