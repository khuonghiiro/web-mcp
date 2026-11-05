import { ExtensionBridge } from './src/generator/extension-bridge.js';

async function main() {
  console.log('Starting ExtensionBridge with autoDiscover = true on 127.0.0.1:43119...');
  const bridge = new ExtensionBridge();
  const info = await bridge.start(true);
  console.log('Bridge started:', info);
  console.log('Waiting for extension to auto-connect (up to 45 seconds)...');
  
  const start = Date.now();
  while (!bridge.connected && Date.now() - start < 45000) {
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  console.log('\n');
  
  if (!bridge.connected) {
    console.error('Extension did not connect within 45s.');
    process.exit(1);
  }
  
  console.log('SUCCESS! Extension connected.');
  console.log('Tab URL:', bridge.tabUrl);
  
  const inspectData = await bridge.rpc('inspect');
  console.log('Page Title / URL:', inspectData.url);
  console.log('Controls found:', inspectData.controls?.length ?? 0);
  if (inspectData.controls) {
    console.log('Sample controls:', JSON.stringify(inspectData.controls.slice(0, 10), null, 2));
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

