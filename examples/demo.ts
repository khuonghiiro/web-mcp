import { demoServer } from './site.js';
demoServer().listen(4173, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4173'));
