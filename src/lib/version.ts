import version from "../../version.json";
import { displayVersion, packageVersion } from "./release-version";

export const APP_VERSION = displayVersion(version);
export const APP_LABEL = `Sellora ${APP_VERSION}`;
export const APP_PACKAGE_VERSION = packageVersion(version);
