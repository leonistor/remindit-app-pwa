---
description: Release coverage
---

Release a new version of the app:

- verify git status, including untracked files
- verify with lint, tests and build
- check current version in package.json
- ask for new version number, suggest a minor version bump
- use the `changelog-generator` skill to update the CHANGELOG.md
- ask for confirmation on the changelog
- tag the release in git
- commit the changes
- push the changes to the remote repository, including the tag
