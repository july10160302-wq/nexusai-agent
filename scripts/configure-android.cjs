const fs = require('node:fs');
const file = 'android/app/build.gradle';
let source = fs.readFileSync(file, 'utf8');
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const sequence = Number(version.match(/preview\.(\d+)/)?.[1] || 1);
source = source.replace(/versionCode \d+/, 'versionCode ' + (20000 + sequence)).replace(/versionName "[^"]+"/, 'versionName "' + version + '"');
// Preview installs alongside the old APK, whose CI debug signing key is not retained.
source = source.replace(/applicationId "[^"]+"/, 'applicationId "com.nexusai.agent.preview"');
fs.writeFileSync(file, source);
