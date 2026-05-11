// This module wraps the bundler-provided default exports of asset modules
// (.svg, etc.) and re-exports them with stable named identifiers, so that
// consumers can use named imports without violating the no-default-export rule.
import faviconUrlDefault from "../../favicon.svg";

export const faviconUrl: string = faviconUrlDefault;
