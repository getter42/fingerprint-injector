const FingerprintGenerator = require('fingerprint-generator');
const playwright = require('playwright');
const FingerprintInjector = require('../src');

jest.setTimeout(400000);

describe('FingerprintInjector', () => {
    let fpInjector;
    let fingerprintGenerator;
    beforeEach(() => {
        fingerprintGenerator = new FingerprintGenerator({
            devices: ['desktop'],
            operatingSystems: ['linux'],
            browsers: [{ name: 'firefox', minVersion: 86 }],
        });

        const { fingerprint } = fingerprintGenerator.getFingerprint();

        fpInjector = new FingerprintInjector({ fingerprint });
    });

    test('should initialize', async () => {
        await fpInjector.initialize();
        expect(fpInjector.utilsString).toBeTruthy();
    });
    describe('Injection methods', () => {
        let browser;
        let context;
        beforeEach(async () => {
            await fpInjector.initialize();
            browser = await playwright.firefox.launch({ headless: false });

            context = await browser.newContext();
        });

        afterEach(async () => {
            await browser.close().catch(() => {});
        });

        test('should override fingerprint in attach function', async () => {
            jest.setTimeout(60000);
            const { fingerprint } = fingerprintGenerator.getFingerprint();

            await fpInjector.attachFingerprintToPlaywright(context, fingerprint);

            const page = await context.newPage();
            await page.goto('https://google.com');
            const platform = await page.evaluate(() => navigator.platform);
            const hardwareConcurrency = await page.evaluate(() => navigator.hardwareConcurrency);
            const oscpu = await page.evaluate(() => navigator.oscpu);
            expect(platform).toBe(fingerprint.navigator.platform);
            expect(hardwareConcurrency).toBe(fingerprint.navigator.hardwareConcurrency);
            expect(oscpu).toBe(fingerprint.navigator.oscpu);
        });
    });

    describe('fingerprint overrides', () => {
        let browser;
        let page;

        beforeEach(async () => {
            jest.setTimeout(60000);
            await fpInjector.initialize();
            browser = await playwright.firefox.launch({ headless: false });

            const context = await browser.newContext();
            await fpInjector.attachFingerprintToPlaywright(context);

            page = await context.newPage();
            await page.goto('https://google.com');
        });

        afterEach(async () => {
            if (browser) {
                await browser.close();
            }
        });

        test('should override codecs', async () => {
            jest.setTimeout(60000);

            const { fingerprint } = fpInjector;
            const { videoCodecs, audioCodecs } = fingerprint;

            for (const [codec, canPlay] of Object.entries(videoCodecs)) {
                const canPlayBrowser = await page.evaluate((videoCodec) => {
                    const videoEl = document.createElement('video');
                    return videoEl.canPlayType(`video/${videoCodec}`);
                }, codec);
                expect(canPlay).toEqual(canPlayBrowser);
            }

            for (const [codec, canPlay] of Object.entries(audioCodecs)) {
                const canPlayBrowser = await page.evaluate((audioCodec) => {
                    const audioEl = document.createElement('audio');
                    return audioEl.canPlayType(`audio/${audioCodec}`);
                }, codec);
                expect(canPlay).toEqual(canPlayBrowser);
            }
        });
    });
});
