const fs = require('node:fs');
const file = 'android/app/build.gradle';
let source = fs.readFileSync(file, 'utf8');
source = source.replace(/versionCode \d+/, 'versionCode 20001').replace(/versionName "[^"]+"/, 'versionName "0.2.0-preview.1"');
// Preview installs alongside the old APK, whose CI debug signing key is not retained.
source = source.replace(/applicationId "[^"]+"/, 'applicationId "com.nexusai.agent.preview"');
fs.writeFileSync(file, source);
