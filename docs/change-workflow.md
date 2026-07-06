# MarTech Scanner Change Workflow

Use this workflow for each release or task-sized change. The goal is to keep work small, traceable, tested, documented, and easy to repeat.

## 1. Define the release/task

**Owner:** Collaborative
**Tools:** ChatGPT, README, GitHub Issues optional

Decide the smallest useful unit of work.

Each release/task should have:

* Short name
* Goal
* Scope
* Out of scope
* Expected behavior
* Test/QA expectations
* Version number or release label

Recommended version format:

```text
v0.1.0
v0.1.1
v0.2.0
```

Use:

* Patch version for small fixes: `v0.1.1`
* Minor version for new features: `v0.2.0`
* Major version later when the tool becomes stable: `v1.0.0`

Copy/paste release note template:

```markdown
## Release: v0.X.X - [Short Name]

### Goal
[What this change is intended to accomplish.]

### Scope
- [Included item 1]
- [Included item 2]

### Out of Scope
- [Not included item 1]

### Expected Behavior
[What should be true after the change.]

### QA Checklist
- [ ] Existing tests pass
- [ ] New/updated tests added where appropriate
- [ ] Manual scan tested
- [ ] README updated
- [ ] Version updated
```

---

## 2. Check current repo status

**Owner:** Me
**Tools:** PowerShell, Git

From the project root:

```powershell
git status
git branch
git pull origin main
```

Confirm the working tree is clean before starting.

If there are uncommitted changes, either commit them, stash them, or intentionally include them in the new release.

---

## 3. Create a task branch

**Owner:** Me
**Tools:** PowerShell, Git

Use a short descriptive branch name.

```powershell
git checkout main
git pull origin main
git checkout -b feature/v0.X.X-short-name
```

Examples:

```powershell
git checkout -b feature/v0.2.0-url-prioritization
git checkout -b fix/v0.1.1-readme-cleanup
git checkout -b refactor/v0.3.0-evidence-merging
```

---

## 4. Update version and README first

**Owner:** Me
**Tools:** VS Code, README, package.json if applicable

Before coding, update the project status section in the README.

Suggested README status block:

```markdown
## Current Status

Current version: v0.X.X  
Status: In development  
Current focus: [short task/release name]

### Recently Completed
- [item]

### In Progress
- [item]

### Known Limitations
- [item]
```

If the project has `package.json`, update the version:

```json
{
  "version": "0.X.X"
}
```

This makes the project state visible before and after the work.

---

## 5. Implement the change

**Owner:** Me
**Tools:** VS Code, ChatGPT, PowerShell

Use ChatGPT for:

* code review
* refactor prompts
* test suggestions
* debugging errors
* README wording
* QA checklist generation

Keep changes compartmentalized. Avoid mixing unrelated improvements into the same release.

Good:

```text
Release v0.2.0: Improve URL prioritization
```

Avoid:

```text
Improve URL prioritization, rewrite output format, rename files, add logging, and change tests
```

---

## 6. Run automated tests

**Owner:** Me
**Tools:** PowerShell, npm, Playwright

Standard commands:

```powershell
npm install
npm test
```

If using the Playwright test suite:

```powershell
npm run test:playwright
```

If Playwright browsers are missing:

```powershell
npx playwright install
```

Then rerun:

```powershell
npm run test:playwright
```

If a test fails, capture:

```text
- Command run
- Error output
- File changed
- What you expected
- What happened instead
```

Then paste that into ChatGPT for debugging.

---

## 7. Run manual QA

**Owner:** Me
**Tools:** PowerShell, CLI, sample sites/files

Run at least one realistic manual scan.

Example:

```powershell
node src/scanner.js --domain=https://example.com
```

Or your actual command if different:

```powershell
npm run scan -- --domain=https://example.com
```

Manual QA checklist:

```markdown
### Manual QA

- [ ] CLI starts successfully
- [ ] Progress/status output appears
- [ ] Scanner does not hang
- [ ] Output directory is created as expected
- [ ] Markdown/report output is readable
- [ ] Detected vendors look reasonable
- [ ] Failed pages are reported clearly
- [ ] No unwanted generated files are staged for commit
```

---

## 8. Review Git diff

**Owner:** Me, optional ChatGPT review
**Tools:** Git, VS Code, ChatGPT

Check changed files:

```powershell
git status
git diff
```

For staged-only review later:

```powershell
git diff --staged
```

For an export file of changes:

```powershell
git diff > diff-unstaged.txt
git diff --staged > diff-staged.txt
```

Or if the diff is large:

```powershell
git diff --stat > diff-summary.txt
git diff > diff-full.txt
```

Good review questions for ChatGPT:

```text
Please review this diff for bugs, maintainability issues, and missing tests.
```

Or:

```text
Here is the current implementation and test output. What concerns do you see before I commit?
```

---

## 9. Update README and release notes

**Owner:** Me
**Tools:** VS Code, README

Before committing, update:

* Current version
* Current status
* New behavior
* Usage instructions if changed
* Test instructions if changed
* Known limitations
* Release notes/changelog

Suggested changelog format:

```markdown
## Changelog

### v0.X.X - YYYY-MM-DD

#### Added
- [New behavior]

#### Changed
- [Modified behavior]

#### Fixed
- [Bug fix]

#### Known Limitations
- [Current limitation]
```

---

## 10. Stage and commit

**Owner:** Me
**Tools:** PowerShell, Git

Check status:

```powershell
git status
```

Stage files:

```powershell
git add .
```

Review staged files:

```powershell
git status
git diff --staged
```

Commit:

```powershell
git commit -m "Release v0.X.X: short description"
```

Examples:

```powershell
git commit -m "Release v0.2.0: improve URL prioritization"
git commit -m "Release v0.1.1: update README and test docs"
```

---

## 11. Push branch to GitHub

**Owner:** Me
**Tools:** PowerShell, GitHub

```powershell
git push -u origin feature/v0.X.X-short-name
```

Example:

```powershell
git push -u origin feature/v0.2.0-url-prioritization
```

---

## 12. Open pull request

**Owner:** Me
**Tools:** GitHub

Pull request checklist:

```markdown
## Summary
[Briefly describe the change.]

## Release
v0.X.X

## Changes
- [Change 1]
- [Change 2]

## Testing
- [ ] npm test
- [ ] npm run test:playwright
- [ ] Manual scan completed

## README / Docs
- [ ] README updated
- [ ] Version updated
- [ ] Known limitations updated

## Notes
[Any concerns, follow-ups, or deferred work.]
```

Open the Pull Request:
```powershell
gh pr create --base main --head feature/v0.X.X-short-name --title "Release v0.X.X: short description" --body-file pr-release-notes.md
```

---

## 13. UAT / acceptance review

**Owner:** Collaborative
**Tools:** GitHub, PowerShell, CLI, ChatGPT

Before merging, confirm the release does what it was supposed to do.

UAT checklist:

```markdown
### UAT Checklist

- [ ] The change solves the intended problem
- [ ] No unrelated behavior changed unexpectedly
- [ ] Output is understandable to a team user
- [ ] Errors are handled clearly
- [ ] README accurately describes current behavior
- [ ] Known limitations are documented
```

If the change affects scanner output, compare before/after results when possible.

---

## 14. Merge to main

**Owner:** Me
**Tools:** GitHub, PowerShell, Git

After PR approval/review, merge in GitHub.

Then locally:

```powershell
git checkout main
git pull origin main
git branch
```

Optional cleanup:

```powershell
git branch -d feature/v0.X.X-short-name
```

If GitHub did not delete the remote branch:

```powershell
git push origin --delete feature/v0.X.X-short-name
```

---

## 15. Tag the release

**Owner:** Me
**Tools:** PowerShell, Git, GitHub

Create a Git tag:

```powershell
git tag v0.X.X
git push origin v0.X.X
```

Example:

```powershell
git tag v0.2.0
git push origin v0.2.0
```

This gives you a stable checkpoint for each release.

### Definition of Done

A release/task is done when:

- The intended behavior works.
- Existing tests pass.
- New tests are added when the behavior changes.
- Manual QA has been completed with at least one realistic scan.
- README reflects the current project status.
- CHANGELOG includes the release.
- Known limitations are documented.
- The release is committed, merged, and tagged.

---

## 16. Start the next cycle

**Owner:** Collaborative
**Tools:** ChatGPT, GitHub Issues optional

After merging:

```powershell
git status
git checkout main
git pull origin main
```

Then repeat the workflow for the next release/task.

---

# Copy/Paste: Standard Start Commands

```powershell
git status
git checkout main
git pull origin main
git checkout -b feature/v0.X.X-short-name
```

# Copy/Paste: Standard Test Commands

```powershell
npm install
npm test
npm run test:playwright
```

# Copy/Paste: Standard Commit Commands

```powershell
git status
git add .
git diff --staged
git commit -m "Release v0.X.X: short description"
git push -u origin feature/v0.X.X-short-name
```

# Copy/Paste: Standard Merge Sync Commands

```powershell
git checkout main
git pull origin main
git branch -d feature/v0.X.X-short-name
```

# Copy/Paste: Standard Tag Commands

```powershell
git tag v0.X.X
git push origin v0.X.X
```

# Recommended Ownership Summary

| Step                  | Owner         | Tools                          |
| --------------------- | ------------- | ------------------------------ |
| Define release/task   | w/ ChatGPT    | ChatGPT, README, GitHub Issues |
| Check repo status     | kk            | PowerShell, Git                |
| Create branch         | kk            | PowerShell, Git                |
| Update README/version | kk            | VS Code                        |
| Implement change      | kk            | VS Code, ChatGPT               |
| Automated tests       | kk            | PowerShell, npm, Playwright    |
| Manual QA             | kk            | CLI, sample URLs               |
| Code review           | w/ ChatGPT    | ChatGPT, Git diff              |
| Release notes         | kk            | README                         |
| Commit/push           | kk            | Git, PowerShell                |
| Pull request          | kk            | GitHub                         |
| UAT                   | w/ ChatGPT    | GitHub, CLI                    |
| Merge/tag             | kk            | GitHub, Git                    |
| Repeat                | w/ ChatGPT    | ChatGPT, Git                   |
