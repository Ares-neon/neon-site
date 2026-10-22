import {Config} from '@remotion/cli/config';

// Deterministic, CPU-only WebGL (SwiftShader through ANGLE). Works on any
// machine; on a Mac with a GPU, `--gl=angle` renders faster.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(17);
Config.setPixelFormat('yuv420p');
Config.setX264Preset('slow');
Config.setAudioCodec('aac');
Config.setAudioBitrate('320k');
Config.setOverwriteOutput(true);
// Software WebGL + heavy frames: allow up to 5 min per frame before failing.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Optional: point Remotion at an already-installed Chrome Headless Shell
// instead of letting it download one (used in CI / sandboxed containers).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
