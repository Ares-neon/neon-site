import {chromium} from 'playwright-core';
const [,, input, output, w='1600', h='900'] = process.argv;
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:+w,height:+h}});
await p.goto('file://'+input); await p.waitForTimeout(300);
await p.screenshot({path:output}); await b.close();
