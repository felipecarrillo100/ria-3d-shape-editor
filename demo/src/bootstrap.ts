import { setLicenseText } from '@luciad/ria/util/License.js'
import licenseText from './license/luciadria_development.txt?raw'

setLicenseText(licenseText)

// main.ts awaits its tile-set models at the top level, so a failed fetch rejects the module itself
// rather than just one layer - without this catch that would surface only as an unhandled rejection.
import('./main.ts').catch((err: unknown) => console.error('demo failed to start:', err))
