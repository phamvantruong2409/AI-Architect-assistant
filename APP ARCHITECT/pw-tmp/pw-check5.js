const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle" });
  const textarea = await page.waitForSelector("textarea");
  await textarea.fill("Hay viet mot doan van dai khoang 300 chu ve kien truc xanh tai Viet Nam, phan tich chi tiet nhieu khia canh.");
  await page.keyboard.press("Enter");

  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(150);
    const btn = page.locator("button:has-text('Dừng'), button:has-text('Gửi')").last();
    const text = await btn.innerText().catch(() => "?");
    const disabled = await btn.getAttribute("disabled").catch(() => null);
    console.log(`t=${i * 150}ms text=${text} disabled=${disabled !== null}`);
  }

  await browser.close();
})();
