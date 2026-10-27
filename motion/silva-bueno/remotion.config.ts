import {Config} from '@remotion/cli/config';

// Deterministic, high-quality master: PNG frames -> H.264 (yuv420p), AAC 48 kHz.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setCrf(14);
Config.setPixelFormat('yuv420p');
Config.setAudioCodec('aac');
Config.setAudioBitrate('320k');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);
Config.setConcurrency(4);

// Use a locally installed Chrome Headless Shell when one is provided.
if (process.env.REMOTION_BROWSER) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
