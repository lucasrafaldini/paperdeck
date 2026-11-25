// Hook `afterSign` do electron-builder: no build de macOS, compila a extensão
// WidgetKit (macos-widget/) e a embute em PaperDeck.app/Contents/PlugIns,
// reassinando o app. Desative com PAPERDECK_MAC_WIDGET=0.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.PAPERDECK_MAC_WIDGET === '0') {
    console.log('  • mac widget: skipped (PAPERDECK_MAC_WIDGET=0)');
    return;
  }
  try {
    execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'ignore' });
  } catch {
    console.warn('  • mac widget: skipped (Xcode / swiftc not found)');
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  // Arch do electron-builder: x64 = 1, arm64 = 3, universal = 4.
  const archs = context.arch === 4 ? 'arm64 x86_64' : (context.arch === 1 ? 'x86_64' : 'arm64');
  const script = path.join(__dirname, '..', 'macos-widget', 'build.sh');
  execFileSync(script, ['--embed', appPath], {
    stdio: 'inherit',
    env: { ...process.env, WIDGET_ARCHS: archs },
  });
};
