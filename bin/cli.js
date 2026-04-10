#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PACKS = [
  {
    name: 'PayPal Standard Checkout',
    dir: 'paypal-checkout/standard-checkout',
    slug: 'paypal-standard-checkout',
  },
  {
    name: 'PayPal Expanded Checkout',
    dir: 'paypal-checkout/expanded-checkout',
    slug: 'paypal-expanded-checkout',
  },
  {
    name: 'PayPal Enterprise Checkout',
    dir: 'paypal-checkout/enterprise-checkout',
    slug: 'paypal-enterprise-checkout',
  },
  {
    name: 'PayPal BNPL US (Pay Later)',
    dir: 'paypal-bnpl-us',
    slug: 'paypal-bnpl-us',
  },
  {
    name: 'NVP/SOAP to REST Migration',
    dir: 'nvp-soap-to-rest-migration',
    slug: 'nvp-soap-to-rest-migration',
  },
  {
    name: 'v5 to v6 SDK Upgrade',
    dir: 'upgrade-to-v6-migration/v5-to-v6-upgrade',
    slug: 'v5-to-v6-upgrade',
  },
  {
    name: 'v4 to v6 SDK Upgrade',
    dir: 'upgrade-to-v6-migration/v4-to-v6-upgrade',
    slug: 'v4-to-v6-upgrade',
  },
];

const TARGETS = [
  { name: 'Cursor IDE', id: 'cursor' },
  { name: 'Claude Code', id: 'claude' },
];

// Arrow-key selector using raw stdin (TTY only)
function selectFromListTTY(title, items) {
  return new Promise((resolve) => {
    let selected = 0;

    function render() {
      if (render.drawn) {
        process.stdout.write(`\x1b[${items.length}A`);
      }
      items.forEach((item, i) => {
        const pointer = i === selected ? '\x1b[36m> ' : '  ';
        const label = i === selected ? `\x1b[1m${item.name}\x1b[0m` : item.name;
        process.stdout.write(`\x1b[2K${pointer}${label}\x1b[0m\n`);
      });
      render.drawn = true;
    }

    console.log(`\n  ${title}\n`);
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onKey(key) {
      if (key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKey);
        console.log('\n  Cancelled.\n');
        process.exit(0);
      }
      if (key === '\x1b[A') {
        selected = selected > 0 ? selected - 1 : items.length - 1;
        render();
      }
      if (key === '\x1b[B') {
        selected = selected < items.length - 1 ? selected + 1 : 0;
        render();
      }
      if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onKey);
        console.log();
        resolve(items[selected]);
      }
    }

    process.stdin.on('data', onKey);
  });
}

// Fallback selector for non-TTY environments
function selectFromListFallback(title, items) {
  return new Promise((resolve) => {
    console.log(`\n  ${title}\n`);
    items.forEach((item, i) => {
      console.log(`  ${i + 1}) ${item.name}`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`\n  Enter number (1-${items.length}): `, (answer) => {
      rl.close();
      const index = parseInt(answer, 10) - 1;
      if (index < 0 || index >= items.length || isNaN(index)) {
        console.error('\n  Invalid selection.');
        process.exit(1);
      }
      console.log();
      resolve(items[index]);
    });
  });
}

function selectFromList(title, items) {
  if (process.stdin.isTTY) {
    return selectFromListTTY(title, items);
  }
  return selectFromListFallback(title, items);
}

// Simple y/n prompt
function confirmPrompt(question) {
  if (process.stdin.isTTY) {
    return confirmPromptTTY(question);
  }
  return confirmPromptFallback(question);
}

function confirmPromptTTY(question) {
  return new Promise((resolve) => {
    process.stdout.write(`  ${question} (y/n) `);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onKey(key) {
      if (key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKey);
        console.log('\n  Cancelled.\n');
        process.exit(0);
      }
      const ch = key.toLowerCase();
      if (ch === 'y' || ch === 'n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onKey);
        console.log(ch);
        resolve(ch === 'y');
      }
    }

    process.stdin.on('data', onKey);
  });
}

function confirmPromptFallback(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`  ${question} (y/n) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`\n  Error: Source not found: ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const cwd = process.cwd();

  // Non-interactive mode: ruleshub --pack 4 --target 1
  const args = process.argv.slice(2);
  const packArg = args.indexOf('--pack') !== -1 ? args[args.indexOf('--pack') + 1] : null;
  const targetArg = args.indexOf('--target') !== -1 ? args[args.indexOf('--target') + 1] : null;

  console.log('\n  RulesHub - AI-optimized rules for PayPal APIs');
  console.log('  =============================================');

  let pack, target;

  if (packArg && targetArg) {
    pack = PACKS[parseInt(packArg, 10) - 1];
    target = TARGETS[parseInt(targetArg, 10) - 1];
    if (!pack || !target) {
      console.error('\n  Invalid --pack or --target value');
      process.exit(1);
    }
    console.log(`\n  Rule pack: ${pack.name}`);
    console.log(`  Target: ${target.name}`);
  } else {
    pack = await selectFromList('Select a rule pack to add:', PACKS);
    target = await selectFromList('Select target:', TARGETS);
  }

  const srcDir = path.join(repoRoot, pack.dir);

  if (!fs.existsSync(srcDir)) {
    console.error(`\n  Error: Rule pack not found at ${srcDir}`);
    process.exit(1);
  }

  let destDir;

  if (target.id === 'cursor') {
    destDir = path.join(cwd, '.cursor', 'rules', pack.slug);
    copyDir(srcDir, destDir);
    console.log(`  Copied ${pack.name} to .cursor/rules/${pack.slug}/`);
  } else {
    // Claude Code: copy rules.md as CLAUDE.md, rest into subfolder
    const srcRules = path.join(srcDir, 'rules.md');
    destDir = path.join(cwd, pack.slug);

    if (fs.existsSync(srcRules)) {
      const rulesFile = path.join(cwd, 'CLAUDE.md');
      if (fs.existsSync(rulesFile)) {
        const overwrite = await confirmPrompt('CLAUDE.md already exists. Overwrite?');
        if (!overwrite) {
          console.log('  Skipped CLAUDE.md');
        } else {
          fs.copyFileSync(srcRules, rulesFile);
          console.log(`  Copied rules to CLAUDE.md`);
        }
      } else {
        fs.copyFileSync(srcRules, rulesFile);
        console.log(`  Copied rules to CLAUDE.md`);
      }
    }

    // Copy mappings and snippets
    const subfolders = ['mappings', 'snippets'];
    let copiedSub = false;
    for (const sub of subfolders) {
      const subSrc = path.join(srcDir, sub);
      if (fs.existsSync(subSrc)) {
        const subDest = path.join(destDir, sub);
        copyDir(subSrc, subDest);
        copiedSub = true;
      }
    }
    if (copiedSub) {
      console.log(`  Copied mappings/snippets to ${pack.slug}/`);
    }
  }

  console.log('\n  Done!\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
