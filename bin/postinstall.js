#!/usr/bin/env node
try { process.cwd(); } catch { process.chdir(require('os').homedir()); }

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CLAUDE_MD = path.join(CLAUDE_DIR, 'CLAUDE.md');
const MARKER = '## RulesHub - PayPal Rule Packs';

const RULESHUB_SECTION = `
## RulesHub - PayPal Rule Packs
When the user asks to add rules or mentions any of these rule packs, run the corresponding command:
- "bnpl" / "pay later" → \`ruleshub --pack paypal-bnpl-us --target claude\`
- "standard checkout" → \`ruleshub --pack paypal-standard-checkout --target claude\`
- "expanded checkout" → \`ruleshub --pack paypal-expanded-checkout --target claude\`
- "enterprise checkout" → \`ruleshub --pack paypal-enterprise-checkout --target claude\`
- "soap to rest" / "nvp" → \`ruleshub --pack nvp-soap-to-rest-upgrade --target claude\`
- "v5 to v6" → \`ruleshub --pack v5-to-v6-upgrade --target claude\`
- "v4 to v6" → \`ruleshub --pack v4-to-v6-upgrade --target claude\`

To see all available packs: \`ruleshub --list\`
`;

try {
  // Ensure ~/.claude/ exists
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  // Read existing content
  let existing = '';
  if (fs.existsSync(CLAUDE_MD)) {
    existing = fs.readFileSync(CLAUDE_MD, 'utf8');
  }

  // Skip if already present
  if (existing.includes(MARKER)) {
    console.log('  RulesHub: Claude Code instructions already configured.');
    process.exit(0);
  }

  // Append ruleshub section
  fs.writeFileSync(CLAUDE_MD, existing + RULESHUB_SECTION, 'utf8');
  console.log('  RulesHub: Added rule pack instructions to ~/.claude/CLAUDE.md');
  console.log('  Claude Code will now recognize commands like "add bnpl rules to my project".');
} catch (err) {
  // Don't fail the install if this doesn't work
  console.warn('  RulesHub: Could not configure Claude Code instructions:', err.message);
}
