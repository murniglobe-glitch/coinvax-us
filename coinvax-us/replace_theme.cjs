const fs = require('fs');
const path = require('path');

const files = [
  'src/components/MainApp.tsx',
  'src/components/TradeView.tsx',
  'src/components/Auth.tsx'
];

const replacements = {
  'bg-zinc-950': 'bg-zinc-50 dark:bg-zinc-950',
  'bg-zinc-900': 'bg-white dark:bg-zinc-900',
  'bg-zinc-800': 'bg-zinc-100 dark:bg-zinc-800',
  'bg-zinc-700': 'bg-zinc-200 dark:bg-zinc-700',
  'text-zinc-50': 'text-zinc-900 dark:text-zinc-50',
  'text-zinc-100': 'text-zinc-800 dark:text-zinc-100',
  'text-zinc-300': 'text-zinc-600 dark:text-zinc-300',
  'text-zinc-400': 'text-zinc-500 dark:text-zinc-400',
  'text-zinc-500': 'text-zinc-400 dark:text-zinc-500',
  'border-zinc-800': 'border-zinc-200 dark:border-zinc-800',
  'border-zinc-700': 'border-zinc-300 dark:border-zinc-700',
};

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // To avoid double replacing (e.g. if dark:bg-zinc-950 is already there)
    // We can use a regex that only matches if not preceded by dark:
    for (const [oldClass, newClass] of Object.entries(replacements)) {
      const regex = new RegExp(`(?<!dark:)\\b${oldClass}\\b`, 'g');
      content = content.replace(regex, newClass);
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
