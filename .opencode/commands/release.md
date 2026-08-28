---
description: Release new version
---

Release a new version of the app:

- verify git status, including untracked files
- verify with lint, tests and build
- update screenshots
- check if About and Help pages content is up to date
- check current version in package.json
- ask for new version number, suggest a minor version bump
- use the `changelog-generator` skill to update the CHANGELOG.md
- ask for confirmation on the changelog
- tag the release in git
- commit the changes
- push the changes to the remote repository, including the tag
