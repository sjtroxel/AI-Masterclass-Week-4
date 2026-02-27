# Rule: No Git Operations

Claude must never perform any git operation. This includes but is not limited to:

- `git commit`, `git add`, `git push`, `git merge`, `git rebase`
- Amending commits or bypassing hooks (`--no-verify`)
- Adding "Co-Authored-By" lines to commit messages

The developer commits manually. If asked to commit, decline and remind the developer.
