export interface ReleaseVersion { major: number; minor: number }

export function validateVersion(version: ReleaseVersion): ReleaseVersion {
  if (!Number.isSafeInteger(version.major) || version.major < 1 || !Number.isInteger(version.minor) || version.minor < 0 || version.minor > 9) {
    throw new Error("A versão deve conter major inteiro positivo e minor entre 0 e 9.");
  }
  return version;
}

export function displayVersion(version: ReleaseVersion): string {
  validateVersion(version);
  return `${version.major}.${version.minor}`;
}

export function nextVersion(version: ReleaseVersion): ReleaseVersion {
  validateVersion(version);
  return validateVersion(version.minor === 9 ? { major: version.major + 1, minor: 0 } : { major: version.major, minor: version.minor + 1 });
}

// npm e Electron exigem o campo patch. Ele é sempre zero e deriva da versão do produto.
export function packageVersion(version: ReleaseVersion): string { return `${displayVersion(version)}.0`; }

export function releaseIsCurrent(version: { lastRelease?: { fingerprint: string } }, fingerprint: string): boolean {
  return version.lastRelease?.fingerprint === fingerprint;
}
