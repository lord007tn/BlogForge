# 🚀 BlogForge Release Process Guide

This project uses a **simplified, powerful release process** that integrates seamlessly with your existing commitizen workflow and follows best practices.

## � Prerequisites

### 1. GitHub Secrets Setup
Make sure you have these secrets configured in your GitHub repository:
- `NPM_TOKEN`: Your npm authentication token for publishing packages
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### 2. NPM Token Setup
1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Go to Profile → Access Tokens
3. Create a new **Automation** token
4. Copy the token and add it as `NPM_TOKEN` in your GitHub repository secrets
- ✅ Manual release triggers for special cases
- ✅ Version management with standard-version

## 📝 Using Conventional Commits

We use commitizen to ensure consistent commit messages. Always commit using:

```bash
npm run commit
```

This will guide you through creating properly formatted commits like:
- `feat: add new blog template system`
- `fix: resolve markdown parsing issue`
- `docs: update API documentation`
- `chore: update dependencies`

### Commit Types and Their Impact

| Type | Description | Version Bump | Section in Changelog |
|------|-------------|--------------|---------------------|
| `feat` | New feature | Minor | 🚀 Features |
| `fix` | Bug fix | Patch | 🐛 Bug Fixes |
| `docs` | Documentation | Patch | 📚 Documentation |
| `chore` | Maintenance | Patch | 🧹 Maintenance |
| `ci` | CI/CD changes | Patch | 🧹 Maintenance |
| `refactor` | Code refactoring | Patch | 🧹 Maintenance |
| `perf` | Performance improvements | Patch | 🧹 Maintenance |
| `test` | Tests | Patch | 🧹 Maintenance |

**Breaking Changes**: Add `!` after the type (e.g., `feat!: redesign API interface`) to trigger a major version bump.

## 🔄 Automatic Release Workflow

### 1. Push to Master Triggers Release Draft

When you push commits to the `master` branch:

1. **Build & Test**: Code is built and linted automatically
2. **Change Detection**: System analyzes commits since last release
3. **Version Calculation**: Uses conventional commits to determine version bump
4. **Release Draft**: Creates a GitHub release draft with:
   - Automatically generated changelog
   - Categorized changes (Features, Bug Fixes, etc.)
   - Contributor information
   - Proper semantic versioning

### 2. Publishing the Release

To publish a release and trigger npm publication:

1. Go to your GitHub repository
2. Navigate to **Releases** tab
3. Find the draft release
4. Review the changelog and version
5. Edit if needed, then click **"Publish release"**

This will:
- ✅ Update `package.json` version
- ✅ Generate/update `CHANGELOG.md`
- ✅ Build the project
- ✅ Publish to npm automatically
- ✅ Push changes back to master

## 🎯 Manual Release Triggers

For special cases, you can manually trigger releases:

### Via GitHub Actions UI

1. Go to **Actions** tab in your repository
2. Select **"Manual Release Trigger"** workflow
3. Click **"Run workflow"**
4. Choose version bump type:
   - **patch**: 0.1.10 → 0.1.11 (bug fixes)
   - **minor**: 0.1.10 → 0.2.0 (new features)
   - **major**: 0.1.10 → 1.0.0 (breaking changes)
   - **prerelease**: 0.1.10 → 0.1.11-beta.0 (beta releases)

### Via Command Line (Local)

```bash
# Create and push a release
npm run release

# Specific version bumps
npx standard-version --release-as patch
npx standard-version --release-as minor
npx standard-version --release-as major

# Prerelease
npx standard-version --prerelease beta

# Then push tags
git push --follow-tags origin master
```

## 📋 Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Code is properly linted
- [ ] Documentation is up to date
- [ ] Breaking changes are documented
- [ ] Version bump is appropriate for changes

## 🔧 Setup Requirements

### GitHub Secrets

Make sure these secrets are configured in your repository:

1. **GITHUB_TOKEN**: Automatically provided by GitHub
2. **NPM_TOKEN**: Your npm authentication token
   - Get from [npmjs.com](https://www.npmjs.com/settings/tokens)
   - Use "Automation" token type
   - Add in repository Settings > Secrets and variables > Actions

### Package.json Configuration

Your `package.json` should have:

```json
{
  "scripts": {
    "commit": "cz",
    "release": "standard-version"
  }
}
```

## 🎨 Changelog Format

The generated changelog follows this structure:

```markdown
## [1.2.0] - 2024-01-15

### 🚀 Features
- feat: add new blog template system (a1b2c3d)
- feat: implement draft post functionality (d4e5f6g)

### 🐛 Bug Fixes
- fix: resolve markdown parsing issue (g7h8i9j)
- fix: correct file path handling on Windows (j1k2l3m)

### 📚 Documentation
- docs: update API documentation (m4n5o6p)
- docs: add contribution guidelines (p7q8r9s)

### 🧹 Maintenance
- chore: update dependencies (s1t2u3v)
- ci: improve build performance (v4w5x6y)

## Contributors

Thanks to all contributors who made this release possible! 🎉

* @username1
* @username2
```

## 🚨 Troubleshooting

### Release Draft Not Created

- Check that commits follow conventional format
- Ensure you're pushing to `master` branch
- Verify GitHub Actions are enabled

### NPM Publish Failed

- Check `NPM_TOKEN` secret is correct
- Verify package name is available
- Ensure version doesn't already exist

### Version Conflicts

- Let the workflow handle versioning automatically
- Don't manually edit `package.json` version
- Use the manual trigger if needed

## 📞 Support

For issues with the release process:
1. Check GitHub Actions logs
2. Verify conventional commit format
3. Ensure all secrets are configured
4. Review this guide for proper workflow

---

*This release system follows industry best practices and integrates seamlessly with your existing commitizen workflow.*
