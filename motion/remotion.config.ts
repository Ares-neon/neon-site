import {Config} from '@remotion/cli/config';

// Chromium pré-instalado no ambiente (não baixar outro navegador).
Config.setBrowserExecutable(process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell');
Config.setVideoImageFormat('png');
Config.setConcurrency(4);
