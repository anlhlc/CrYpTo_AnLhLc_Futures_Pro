const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Test başlatılıyor...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect console messages
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect errors
    const errors = [];
    page.on('pageerror', error => {
        errors.push(error.message);
    });

    try {
        // Test 1: Login page loads
        console.log('1. Login sayfası test ediliyor...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

        const title = await page.title();
        console.log(`   Title: ${title}`);

        const loginForm = await page.$('#loginFormElement');
        if (loginForm) {
            console.log('   ✅ Login formu bulundu');
        } else {
            console.log('   ❌ Login formu bulunamadı');
        }

        // Test 2: Try to access dashboard without login
        console.log('2. Korumalı sayfa testi...');
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

        // Should redirect to login
        const currentUrl = page.url();
        console.log(`   URL: ${currentUrl}`);

        if (currentUrl.includes('login')) {
            console.log('   ✅ Dashboard korumalı, login\'e yönlendirdi');
        } else {
            console.log('   ❌ Dashboard korumalı değil!');
        }

        // Test 3: Login with wrong credentials
        console.log('3. Hatalı giriş testi...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

        await page.fill('#username', 'wronguser');
        await page.fill('#password', 'wrongpass');
        await page.click('#submitBtn');

        await page.waitForTimeout(1000);

        const errorMsg = await page.$eval('#errorMessage', el => el.textContent);
        if (errorMsg && errorMsg.includes('Hatalı')) {
            console.log('   ✅ Hatalı giriş engellendi');
        } else {
            console.log('   ❌ Hata mesajı gösterilmedi');
        }

        // Test 4: Login with correct credentials
        console.log('4. Doğru giriş testi...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

        await page.fill('#username', 'admin');
        await page.fill('#password', 'BinanceSecure2024!');
        await page.click('#submitBtn');

        // Wait for redirect
        await page.waitForURL('**/', { timeout: 5000 }).catch(() => {
            console.log('   ⚠️ Yönlendirme timeout (normal olabilir)');
        });

        const finalUrl = page.url();
        if (finalUrl === 'http://localhost:3000/') {
            console.log('   ✅ Giriş başarılı, dashboard\'a yönlendirdi');
        } else {
            console.log(`   ⚠️ URL: ${finalUrl}`);
        }

        // Print console errors
        console.log('\n📋 Console Mesajları:');
        consoleMessages.forEach(msg => {
            if (msg.type === 'error') {
                console.log(`   ❌ ERROR: ${msg.text}`);
            }
        });

        if (errors.length > 0) {
            console.log('\n📋 Sayfa Hataları:');
            errors.forEach(err => {
                console.log(`   ❌ ${err}`);
            });
        } else {
            console.log('\n✅ Hiç sayfa hatası yok');
        }

        console.log('\n🎉 Test tamamlandı!');

    } catch (error) {
        console.error('❌ Test hatası:', error.message);
    } finally {
        await browser.close();
    }
})();
