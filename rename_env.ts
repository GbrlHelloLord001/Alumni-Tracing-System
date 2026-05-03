import fs from 'fs';
import path from 'path';

const servicesDir = path.join(process.cwd(), 'services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/process\.env\.GEMINI_API_KEY/g, 'undefined');
  fs.writeFileSync(filePath, content, 'utf-8');
});

console.log('Replaced process.env.GEMINI_API_KEY');
