// R14 deterministic browser acceptance: end-to-end UI/state with mocked
// source metadata/panorama/Gaze timers. This is NOT a live-provider test.
// Usage: PORTAL_URL=http://127.0.0.1:4173/ node tools/browser-afk-game-r14-check.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const errors=[];
const providerMock=String.raw