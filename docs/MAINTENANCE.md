---
title: Documentation Maintenance Guide
description: Procedures for maintaining and updating project documentation
status: approved
last_updated: 2025-12-23
category: maintenance
tags: [maintenance, documentation]
---

# Documentation Maintenance Guide

This guide outlines the procedures for maintaining high-quality documentation for the nostr-BBS project.

## Table of Contents

- [Weekly Maintenance Tasks](#weekly-maintenance-tasks)
- [Monthly Maintenance Tasks](#monthly-maintenance-tasks)
- [Quarterly Reviews](#quarterly-reviews)
- [Validation Tools](#validation-tools)
- [Common Issues and Solutions](#common-issues-and-solutions)

## Weekly Maintenance Tasks

### Automated Tasks (via GitHub Actions)

The following tasks run automatically every week:

1. **External Link Validation** (Mondays, 9 AM UTC)
   - Checks all external links for availability
   - Creates issues for broken links
   - Review the workflow results and fix broken links

2. **Timestamp Updates** (Sundays, 22:00 UTC)
   - Updates `last_updated` fields based on git history
   - Creates automated PR for review
   - Merge the PR after verification

### Manual Tasks

1. **Review Outdated Documentation**
   - Check for documents older than 90 days
   - Update or deprecate as needed
   - Update status fields appropriately

2. **Monitor Validation Failures**
   - Review failed validation workflows
   - Address any new issues promptly
   - Update validation scripts if needed

## Monthly Maintenance Tasks

### Content Review

1. **Status Audit**
   ```bash
   # Count documents by status
   grep -r "status: draft" docs --include="*.md" | wc -l
   grep -r "status: review" docs --include="*.md" | wc -l
   grep -r "status: approved" docs --include="*.md" | wc -l
   ```

2. **Move Documents Through Pipeline**
   - Draft → Review: Check completeness and accuracy
   - Review → Approved: Verify technical accuracy and testing
   - Approved → Deprecated: Mark outdated content

3. **Update Metrics Dashboard**
   - Review quality metrics from CI/CD
   - Track documentation growth
   - Identify coverage gaps

### Quality Checks

1. **Run Full Validation Suite**
   ```bash
   # Local validation
   docs/scripts/validate-all.sh docs
   ```

2. **Check Diagram Accuracy**
   - Verify Mermaid diagrams render correctly
   - Update diagrams for code changes
   - Test diagram export functionality

3. **UK English Consistency**
   - Review spelling validation results
   - Update spelling rules if needed
   - Train contributors on UK English standards

## Quarterly Reviews

### Comprehensive Documentation Audit

1. **Coverage Analysis**
   - Identify undocumented features
   - Plan documentation for new features
   - Retire documentation for removed features

2. **User Feedback Integration**
   - Review documentation issues and PRs
   - Identify common questions
   - Update FAQs and troubleshooting guides

3. **Structure Review**
   - Evaluate information architecture
   - Reorganise if needed
   - Update navigation and cross-references

4. **Template Updates**
   - Review documentation templates
   - Update based on best practices
   - Ensure consistency across documents

### Technical Debt

1. **Update Dependencies**
   ```bash
   # Update validation tools
   npm update -g @mermaid-js/mermaid-cli
   ```

2. **Review Automation Scripts**
   - Test all validation scripts
   - Update for new requirements
   - Improve performance where needed

3. **Workflow Optimisation**
   - Review GitHub Actions efficiency
   - Reduce unnecessary runs
   - Update action versions

## Validation Tools

### Available Scripts

All validation scripts are located in `docs/scripts/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| `validate-links.sh` | Check internal markdown links | `./validate-links.sh docs` |
| `validate-frontmatter.sh` | Verify YAML front matter | `./validate-frontmatter.sh docs` |
| `validate-mermaid.sh` | Test Mermaid diagram syntax | `./validate-mermaid.sh docs` |
| `validate-spelling.sh` | Enforce UK English spelling | `./validate-spelling.sh docs` |
| `validate-all.sh` | Run all validators | `./validate-all.sh docs` |

### Running Validations Locally

```bash
# Make scripts executable
chmod +x docs/scripts/*.sh

# Run individual validator
docs/scripts/validate-links.sh docs

# Run complete validation suite
docs/scripts/validate-all.sh docs

# Validate specific subdirectory
docs/scripts/validate-frontmatter.sh docs/guides
```

### Pre-commit Hook

The pre-commit hook automatically validates staged markdown files:

```bash
# Install husky
npm install --save-dev husky

# Activate hooks
npx husky install

# Hook runs automatically on commit
git commit -m "docs: update guide"

# Skip hook if needed (not recommended)
git commit --no-verify -m "docs: emergency fix"
```

## Common Issues and Solutions

### Broken Links

**Issue**: Internal link validation fails

**Solutions**:
1. Check file exists at target path
2. Verify relative path is correct
3. Ensure anchor links match headings
4. Update path if file was moved

### Front Matter Errors

**Issue**: Missing or invalid front matter

**Required fields**:
```yaml
---
title: Document Title
description: Brief description
status: draft|review|approved|deprecated
last_updated: 2025-12-23
category: guide|reference|api|tutorial
tags: [maintenance, documentation]
---
```

**Solutions**:
1. Add missing required fields
2. Use valid status values
3. Format dates as YYYY-MM-DD
4. Add category-specific fields (difficulty, api_version)

### Mermaid Diagram Failures

**Issue**: Diagram syntax errors

**Solutions**:
1. Validate syntax at https://mermaid.live/
2. Check for typos in keywords
3. Ensure proper indentation
4. Test locally with `mmdc` CLI

### UK English Spelling

**Issue**: US English spelling detected

**Common corrections**:
- color → colour
- behaviour → behaviour
- organise → organise
- analyse → analyse
- centre → centre
- license → licence (noun)

**Exceptions**: Technical terms in code blocks use US spelling

### Outdated Timestamps

**Issue**: `last_updated` doesn't match git history

**Solutions**:
1. Wait for automated weekly update
2. Manually update with last commit date:
   ```bash
   git log -1 --format="%ad" --date=short -- docs/file.md
   ```
3. Update front matter with the date

## Escalation Procedures

### Critical Issues

If you encounter critical documentation issues:

1. **Security vulnerabilities in examples**
   - Immediately create issue with `security` label
   - Draft correction and create PR
   - Tag security team for review

2. **Incorrect technical information**
   - Verify with code/tests
   - Create issue with `bug` label
   - Update documentation with correction
   - Add test case if appropriate

3. **Broken CI/CD pipeline**
   - Check GitHub Actions logs
   - Test scripts locally
   - Create issue with `ci/cd` label
   - Fix and test thoroughly

### Getting Help

- **Documentation questions**: Create issue with `documentation` label
- **Validation tool issues**: Create issue with `tooling` label
- **Process questions**: Review this guide and CONTRIBUTION.md
- **Urgent issues**: Contact project maintainers directly

## Metrics and Reporting

### Weekly Reports

Automated reports are generated weekly:

- External link status
- Outdated documentation list
- Validation failure summary

### Monthly Metrics

Track these metrics monthly:

```bash
# Document count by status
grep -r "status:" docs --include="*.md" | cut -d':' -f3 | sort | uniq -c

# Average document age
find docs -name "*.md" -exec grep "last_updated:" {} \; | cut -d':' -f2 | xargs -I {} date -d {} +%s | awk '{sum+=$1; count++} END {print (systime()-sum/count)/86400 " days"}'

# Diagram usage
grep -r "\`\`\`mermaid" docs --include="*.md" | wc -l
```

### Quality Targets

Maintain these quality standards:

- **Link validation**: 100% pass rate
- **Front matter compliance**: 100%
- **UK English consistency**: 95%+
- **Document freshness**: 90% under 90 days old
- **Status distribution**: <20% in draft status

## Continuous Improvement

### Feedback Loop

1. Monitor user questions and issues
2. Identify documentation gaps
3. Update or create documentation
4. Measure impact on support volume

### Process Updates

1. Review this guide quarterly
2. Update based on lessons learnt
3. Incorporate team feedback
4. Align with project evolution

---

**Last Updated**: 2025-12-20
**Maintained by**: Documentation Team
**Next Review**: 2026-03-20
