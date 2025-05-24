
# Contributing to BlogForge

First off, thank you for considering contributing to BlogForge! It's people like you that make BlogForge such a great tool.

## 🚀 Quick Start

1. **Fork the repository** and clone it locally
2. **Create a feature branch** from `master`: `git checkout -b feat/your-feature-name`
3. **Make your changes** following our guidelines
4. **Submit a pull request**

## 📋 Development Process

### Branch Naming Convention

Please use the following branch naming convention:
- `feat/feature-name` - for new features
- `fix/bug-name` - for bug fixes
- `docs/description` - for documentation updates
- `chore/description` - for maintenance tasks
- `refactor/description` - for code refactoring

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/). Your commit messages should be structured as follows:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Examples:**
```
feat(cli): add new article template command
fix(images): resolve image optimization bug
docs: update installation instructions
```

### Pull Request Process

1. **Create a descriptive PR title** following conventional commit format
2. **Fill out the PR template** completely
3. **Ensure all CI checks pass**
4. **Request review** from maintainers
5. **Address feedback** promptly
6. **Keep your branch up to date** with master

### Code Quality Standards

- **Linting**: Run `npm run lint` before committing
- **Building**: Ensure `npm run build` passes
- **Testing**: Add tests for new features (when test framework is available)
- **Documentation**: Update documentation for API changes

## 🐛 Reporting Bugs

Please use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when reporting bugs.

## 💡 Suggesting Features

Please use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) when suggesting new features.

## 📝 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## 🎯 What We're Looking For

- **Bug fixes**: Help us squash those pesky bugs!
- **New features**: Add functionality that benefits the community
- **Documentation**: Improve existing docs or add new ones
- **Performance**: Make BlogForge faster and more efficient
- **Testing**: Add test coverage for existing functionality

## 🚫 What We're Not Looking For

- **Breaking changes** without proper discussion
- **Large refactors** without prior agreement
- **Features that don't fit** the project scope

## ⚡ Quick Tips

- **Keep PRs small** and focused on a single change
- **Write clear commit messages** following our convention
- **Update documentation** when needed
- **Be patient** - reviews take time, but we appreciate your contribution!

Thank you for contributing! 🎉
