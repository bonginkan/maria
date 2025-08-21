# MARIA Platform - Version Management System

## Overview

Starting with v1.1.0, MARIA Platform implements a comprehensive version management system for all documentation files to ensure historical reference, seamless upgrades, and consistent versioning across the platform.

## Versioning Strategy

### Semantic Versioning
- **Major versions** (x.0.0): Breaking changes, major feature additions, architecture changes
- **Minor versions** (x.y.0): New features, significant enhancements, non-breaking changes
- **Patch versions** (x.y.z): Bug fixes, minor improvements, documentation updates

### Documentation Versioning

#### Core Documentation Files
Each major/minor release maintains versioned documentation:

```
SPEC_SHEET_v1.1.0.md         # Technical specifications
DEVELOPER_GUIDE_v1.1.0.md    # Developer documentation  
USER_MANUAL_v1.1.0.md        # User guide and tutorials
```

#### Living Documentation Files
These files are continuously updated and don't require versioning:
- `README.md` - Always reflects latest version
- `CLAUDE.md` - Updated with latest platform capabilities
- `CHANGELOG.md` - Cumulative change history

## Version Management Process

### For New Releases

#### Minor Version Release (e.g., v1.1.0 → v1.2.0)
1. **Create new versioned documents**:
   ```bash
   cp SPEC_SHEET_v1.1.0.md SPEC_SHEET_v1.2.0.md
   cp DEVELOPER_GUIDE_v1.1.0.md DEVELOPER_GUIDE_v1.2.0.md
   cp USER_MANUAL_v1.1.0.md USER_MANUAL_v1.2.0.md
   ```

2. **Update new versions** with latest features and changes

3. **Update living documents**:
   - Update `README.md` with v1.2.0 information
   - Update `CLAUDE.md` with new capabilities
   - Update `package.json` version

4. **Maintain historical files** - Keep all previous versions for reference

#### Patch Version Release (e.g., v1.1.0 → v1.1.1)
1. **Update existing versioned documents** in place
2. **Update living documents** with patch information
3. **No need for new versioned files** unless significant documentation changes

### File Organization

```
/maria_code/
├── README.md                    # Latest version (living)
├── CLAUDE.md                    # Latest version (living)
├── CHANGELOG.md                 # Cumulative history (living)
├── VERSION_MANAGEMENT.md        # This file (living)
│
├── SPEC_SHEET_v1.1.0.md        # v1.1.0 specifications
├── DEVELOPER_GUIDE_v1.1.0.md   # v1.1.0 developer guide
├── USER_MANUAL_v1.1.0.md       # v1.1.0 user manual
│
├── SPEC_SHEET_v1.2.0.md        # v1.2.0 specifications (future)
├── DEVELOPER_GUIDE_v1.2.0.md   # v1.2.0 developer guide (future)
├── USER_MANUAL_v1.2.0.md       # v1.2.0 user manual (future)
│
└── archive/                     # Archived old versions if needed
    ├── v1.0.x/
    └── v0.x.x/
```

## NPM Package Management

### Version Synchronization
- NPM package version in `package.json` must match documentation versions
- Release workflow automatically publishes to `@bonginkan/maria`

### Release Process
```bash
# 1. Update version in package.json
npm version minor  # or major/patch

# 2. Update documentation versions (see above process)

# 3. Build and test
pnpm build && pnpm test

# 4. Commit changes
git add .
git commit -m "feat: release v1.2.0 with [new features]"

# 5. Tag release
git tag v1.2.0

# 6. Push with tags
git push origin main --tags

# 7. Publish to NPM
npm publish --otp=<otp_code>
```

## Documentation Standards

### Version Headers
All versioned documents must include:
```markdown
# MARIA Platform v1.1.0 - [Document Type]

**Version**: 1.1.0  
**Release Date**: August 20, 2025  
**Document Type**: [Technical Specification/Developer Guide/User Manual]
```

### Cross-References
- Always reference specific version numbers in links
- Update README.md links to point to latest versions
- Maintain backward compatibility references

### Content Guidelines
- **Technical Specifications**: Complete implementation details, architecture, metrics
- **Developer Guide**: API reference, customization, enterprise deployment
- **User Manual**: Step-by-step tutorials, best practices, troubleshooting

## Quality Assurance

### Pre-Release Checklist
- [ ] All version numbers updated consistently
- [ ] Documentation reflects actual implementation
- [ ] Cross-references and links verified
- [ ] NPM package version matches documentation
- [ ] Build and test passes with zero errors
- [ ] Previous versions preserved

### Post-Release Validation
- [ ] NPM package published successfully
- [ ] Documentation accessible and formatted correctly
- [ ] Version tags created in Git
- [ ] README.md reflects latest version
- [ ] All links functional

## Historical Reference

### Version History
- **v1.1.0** (August 20, 2025): Phase 6 Complete - Enterprise Code Quality Analysis Platform
- **v1.0.7** (Prior): CLI improvements and basic command system
- **v1.0.x** (Prior): Initial platform development and feature implementation

### Breaking Changes
Document breaking changes between versions:
- API changes requiring code updates
- Configuration file format changes  
- Command-line interface modifications
- Dependency requirement updates

## Future Considerations

### Long-term Archival
- Consider moving very old versions (>2 major versions behind) to `/archive`
- Maintain at least 2 major version histories in root directory
- Implement automated archival process for efficiency

### Automation Opportunities
- GitHub Actions for automated version management
- NPM publish automation with proper version checks
- Documentation generation from code annotations
- Cross-reference link validation

---

This version management system ensures MARIA Platform maintains professional documentation standards while supporting seamless upgrades and historical reference for enterprise customers.