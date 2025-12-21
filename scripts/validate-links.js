#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '../docs');

// Results storage
const results = {
  totalFiles: 0,
  totalLinks: 0,
  brokenInternalLinks: [],
  invalidAnchorLinks: [],
  externalLinks: [],
  orphanedFiles: [],
  deadEndFiles: [],
  linkGraph: new Map(), // file -> [files it links to]
  inboundLinks: new Map() // file -> [files that link to it]
};

// Extract all markdown links from content
function extractLinks(content, filePath) {
  const links = [];

  // Markdown link pattern: [text](url) or [text](url#anchor)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  let lineNumber = 1;
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    lineNumber = idx + 1;
    let lineMatch;
    const lineRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    while ((lineMatch = lineRegex.exec(line)) !== null) {
      const linkText = lineMatch[1];
      const linkUrl = lineMatch[2];

      links.push({
        text: linkText,
        url: linkUrl,
        line: lineNumber,
        file: filePath
      });
    }
  });

  return links;
}

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

// Check if anchor exists in file
function anchorExists(filePath, anchor) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const anchorId = anchor.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

    // Check for headers that would generate this anchor
    const headerRegex = new RegExp(`^#{1,6}\\s+.*${anchor.replace(/-/g, '[ -]')}`, 'im');
    if (headerRegex.test(content)) return true;

    // Check for explicit anchor tags
    if (content.includes(`id="${anchor}"`) || content.includes(`id='${anchor}'`)) return true;
    if (content.includes(`name="${anchor}"`) || content.includes(`name='${anchor}'`)) return true;

    return false;
  } catch (e) {
    return false;
  }
}

// Get all markdown files recursively
function getAllMarkdownFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile() && item.endsWith('.md')) {
        files.push(fullPath);
      }
    });
  }

  traverse(dir);
  return files;
}

// Resolve relative link to absolute path
function resolveLink(fromFile, linkUrl) {
  // Remove anchor
  const [urlPath, anchor] = linkUrl.split('#');

  if (!urlPath) {
    // Just an anchor link to current file
    return { resolved: fromFile, anchor };
  }

  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, urlPath);

  return { resolved, anchor };
}

// Main validation function
function validateLinks() {
  console.log('Starting link validation...\n');

  const allFiles = getAllMarkdownFiles(DOCS_DIR);
  results.totalFiles = allFiles.length;

  console.log(`Found ${allFiles.length} markdown files\n`);

  // Initialize link graph
  allFiles.forEach(file => {
    results.linkGraph.set(file, []);
    results.inboundLinks.set(file, []);
  });

  // Process each file
  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const links = extractLinks(content, file);

    links.forEach(link => {
      results.totalLinks++;

      const url = link.url;

      // External link
      if (url.startsWith('http://') || url.startsWith('https://')) {
        results.externalLinks.push(link);
        return;
      }

      // Email link
      if (url.startsWith('mailto:')) {
        return;
      }

      // Internal link
      const { resolved, anchor } = resolveLink(file, url);

      // Add to link graph
      if (resolved !== file) {
        const outbound = results.linkGraph.get(file) || [];
        outbound.push(resolved);
        results.linkGraph.set(file, outbound);

        const inbound = results.inboundLinks.get(resolved) || [];
        inbound.push(file);
        results.inboundLinks.set(resolved, inbound);
      }

      // Check if file exists
      if (!fileExists(resolved)) {
        results.brokenInternalLinks.push({
          ...link,
          resolvedPath: resolved,
          reason: 'File not found'
        });
        return;
      }

      // Check anchor if present
      if (anchor && !anchorExists(resolved, anchor)) {
        results.invalidAnchorLinks.push({
          ...link,
          resolvedPath: resolved,
          anchor: anchor,
          reason: 'Anchor not found'
        });
      }
    });
  });

  // Find orphaned files (no inbound links)
  allFiles.forEach(file => {
    const inbound = results.inboundLinks.get(file) || [];
    if (inbound.length === 0) {
      const relativePath = path.relative(DOCS_DIR, file);
      // Skip the report file itself and index/readme files
      const filename = path.basename(file).toLowerCase();
      if (filename !== 'readme.md' && filename !== 'index.md' && filename !== 'link-validation-report.md') {
        results.orphanedFiles.push(relativePath);
      }
    }
  });

  // Find dead-end files (no outbound links)
  allFiles.forEach(file => {
    const outbound = results.linkGraph.get(file) || [];
    if (outbound.length === 0) {
      const relativePath = path.relative(DOCS_DIR, file);
      results.deadEndFiles.push(relativePath);
    }
  });
}

// Generate report
function generateReport() {
  const lines = [];

  lines.push('# Documentation Link Validation Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Files:** ${results.totalFiles}`);
  lines.push(`- **Total Links:** ${results.totalLinks}`);
  lines.push(`- **Broken Internal Links:** ${results.brokenInternalLinks.length}`);
  lines.push(`- **Invalid Anchor Links:** ${results.invalidAnchorLinks.length}`);
  lines.push(`- **External Links:** ${results.externalLinks.length}`);
  lines.push(`- **Orphaned Files:** ${results.orphanedFiles.length}`);
  lines.push(`- **Dead-End Files:** ${results.deadEndFiles.length}`);
  lines.push('');

  // Broken internal links
  if (results.brokenInternalLinks.length > 0) {
    lines.push('## Broken Internal Links');
    lines.push('');
    lines.push('Links pointing to files that do not exist:');
    lines.push('');

    results.brokenInternalLinks.forEach(link => {
      const relFile = path.relative(DOCS_DIR, link.file);
      const relResolved = path.relative(DOCS_DIR, link.resolvedPath);
      lines.push(`- **${relFile}:${link.line}**`);
      lines.push(`  - Link text: "${link.text}"`);
      lines.push(`  - URL: \`${link.url}\``);
      lines.push(`  - Resolved to: \`${relResolved}\``);
      lines.push(`  - Reason: ${link.reason}`);
      lines.push('');
    });
  } else {
    lines.push('## Broken Internal Links');
    lines.push('');
    lines.push('✅ No broken internal links found!');
    lines.push('');
  }

  // Invalid anchor links
  if (results.invalidAnchorLinks.length > 0) {
    lines.push('## Invalid Anchor Links');
    lines.push('');
    lines.push('Links with anchors that do not exist in target files:');
    lines.push('');

    results.invalidAnchorLinks.forEach(link => {
      const relFile = path.relative(DOCS_DIR, link.file);
      const relResolved = path.relative(DOCS_DIR, link.resolvedPath);
      lines.push(`- **${relFile}:${link.line}**`);
      lines.push(`  - Link text: "${link.text}"`);
      lines.push(`  - URL: \`${link.url}\``);
      lines.push(`  - Target file: \`${relResolved}\``);
      lines.push(`  - Missing anchor: \`#${link.anchor}\``);
      lines.push('');
    });
  } else {
    lines.push('## Invalid Anchor Links');
    lines.push('');
    lines.push('✅ No invalid anchor links found!');
    lines.push('');
  }

  // External links
  lines.push('## External Links');
  lines.push('');
  if (results.externalLinks.length > 0) {
    lines.push(`Found ${results.externalLinks.length} external links (not validated):`);
    lines.push('');

    const uniqueExternal = new Map();
    results.externalLinks.forEach(link => {
      const existing = uniqueExternal.get(link.url) || [];
      const relFile = path.relative(DOCS_DIR, link.file);
      existing.push(`${relFile}:${link.line}`);
      uniqueExternal.set(link.url, existing);
    });

    Array.from(uniqueExternal.entries()).sort().forEach(([url, locations]) => {
      lines.push(`- ${url}`);
      if (locations.length <= 3) {
        locations.forEach(loc => lines.push(`  - ${loc}`));
      } else {
        lines.push(`  - Found in ${locations.length} locations`);
      }
    });
    lines.push('');
  } else {
    lines.push('No external links found.');
    lines.push('');
  }

  // Orphaned files
  lines.push('## Orphaned Files');
  lines.push('');
  if (results.orphanedFiles.length > 0) {
    lines.push('Files with no inbound links (not referenced by other docs):');
    lines.push('');
    results.orphanedFiles.sort().forEach(file => {
      lines.push(`- \`${file}\``);
    });
    lines.push('');
  } else {
    lines.push('✅ No orphaned files found!');
    lines.push('');
  }

  // Dead-end files
  lines.push('## Dead-End Files');
  lines.push('');
  if (results.deadEndFiles.length > 0) {
    lines.push('Files with no outbound links (do not link to other docs):');
    lines.push('');
    results.deadEndFiles.sort().forEach(file => {
      lines.push(`- \`${file}\``);
    });
    lines.push('');
  } else {
    lines.push('✅ No dead-end files found!');
    lines.push('');
  }

  lines.push('## Recommendations');
  lines.push('');

  if (results.brokenInternalLinks.length > 0) {
    lines.push('1. **Fix broken internal links** - Update or remove links to non-existent files');
  }

  if (results.invalidAnchorLinks.length > 0) {
    lines.push('2. **Fix invalid anchor links** - Update anchors to match actual section headers');
  }

  if (results.orphanedFiles.length > 0) {
    lines.push('3. **Review orphaned files** - Consider adding links from relevant documentation');
  }

  if (results.deadEndFiles.length > 0) {
    lines.push('4. **Review dead-end files** - Consider adding links to related documentation');
  }

  if (results.brokenInternalLinks.length === 0 &&
      results.invalidAnchorLinks.length === 0 &&
      results.orphanedFiles.length === 0 &&
      results.deadEndFiles.length === 0) {
    lines.push('✅ Documentation link structure is healthy!');
  }

  lines.push('');

  return lines.join('\n');
}

// Run validation
try {
  validateLinks();
  const report = generateReport();

  // Write report
  const reportPath = path.join(DOCS_DIR, 'link-validation-report.md');
  fs.writeFileSync(reportPath, report);

  console.log('Link Validation Complete!');
  console.log('=========================\n');
  console.log(`Total Files: ${results.totalFiles}`);
  console.log(`Total Links: ${results.totalLinks}`);
  console.log(`Broken Links: ${results.brokenInternalLinks.length}`);
  console.log(`Invalid Anchors: ${results.invalidAnchorLinks.length}`);
  console.log(`External Links: ${results.externalLinks.length}`);
  console.log(`Orphaned Files: ${results.orphanedFiles.length}`);
  console.log(`Dead-End Files: ${results.deadEndFiles.length}`);
  console.log(`\nReport written to: ${reportPath}`);

  // Exit with error if issues found
  if (results.brokenInternalLinks.length > 0 || results.invalidAnchorLinks.length > 0) {
    process.exit(1);
  }
} catch (error) {
  console.error('Error during validation:', error);
  process.exit(1);
}
