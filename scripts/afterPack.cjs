// @ts-check
//
// afterPack hook for electron-builder
// Applies Electron fuses to the packaged binary.
// Mirrors the fuse settings from the previous forge.config.ts.
//
// Reference: https://www.electronjs.org/docs/latest/tutorial/fuses

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
module.exports = async function afterPack(context) {
  const ext = {
    darwin: '.app',
    win32: '.exe',
    linux: '',
  };

  const platformExt = ext[context.electronPlatformName] || '';
  const executableName = context.packager.appInfo.productFilename;

  let executablePath;

  if (context.electronPlatformName === 'darwin') {
    executablePath = path.join(
      context.appOutDir,
      `${executableName}${platformExt}`,
      'Contents',
      'MacOS',
      executableName
    );
  } else {
    executablePath = path.join(
      context.appOutDir,
      `${executableName}${platformExt}`
    );
  }

  console.log(`[afterPack] Flipping fuses on: ${executablePath}`);

  await flipFuses(executablePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  console.log('[afterPack] Fuses applied successfully.');
};
