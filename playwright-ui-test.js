const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:3000/index.html');

    await page.fill('#email', 'uitest@example.com');
    await page.fill('#username', 'uitest');
    await page.fill('#password', 'UiTest1234');
    await page.selectOption('#gender', 'hombre');
    await page.selectOption('#birth-day', '10');
    await page.selectOption('#birth-month', '5');
    await page.selectOption('#birth-year', '1990');
    await page.selectOption('#zodiac', 'leo');

    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await Promise.all([
      page.waitForURL('**/raceofthezodiac.html', { timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);

    const openVisible = await page.isVisible('#open-profile');
    if (!openVisible) throw new Error('El botón Perfil no es visible.');

    await page.click('#open-profile');

    const profileVisible = await page.isVisible('#profile-form');
    if (!profileVisible) throw new Error('El formulario de perfil no se abrió.');

    await page.fill('#p-username', 'uitest-updated');
    await page.click('#save-profile');

    // Wait a moment for localStorage save/alert handling
    await page.waitForTimeout(500);
    const saved = await page.$eval('#p-username', el => el.value);
    if (saved !== 'uitest-updated') throw new Error('El cambio de nombre no se guardó en la UI.');

    console.log('UI test passed: registro, redirección, perfil abierto y guardado.');
  } catch (err) {
    console.error('UI test FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();