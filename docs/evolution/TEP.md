# TLL Evolution Protocol (TEP)

> Version: 2.0 | Status: Active

## What is TEP?

TEP (TLL Evolution Protocol) is the process by which TLL OS Protocol and Runtime evolve. Both humans and AI Agents can propose changes.

## TEP Flow

```
1. DISCOVER
   Agent or human finds: bug / optimization / new capability / protocol gap

2. PROPOSE
   Create an Evolution Proposal in proposals/
   - Problem description
   - Impact analysis (based on Application Graph)
   - ChangeSet (protocol + runtime + tests + docs)
   - Auto-generated tests

3. VALIDATE
   - Run all existing tests (npm test)
   - Compatibility verification
   - AI Review (automated checklist)

4. REVIEW
   - GitHub PR
   - Maintainer review (human)
   - Community discussion

5. MERGE
   - Approved changes merged

6. RELEASE
   - Protocol / Runtime release
```

## TEP Types

| Type | Description | Review Required |
|------|-------------|-----------------|
| `feature` | New feature or capability | AI + Human |
| `bugfix` | Bug fix | AI + Human (simple: AI only) |
| `breaking` | Breaking change | AI + Human + RFC + migration guide |
| `deprecation` | Deprecate contract/feature | AI + Human + replacement plan |
| `refactor` | Refactor (no behavior change) | AI (Human optional) |

## TEP Status

```
draft → review → approved → merged
              ↓
           rejected
```

## TEP Structure

```yaml
id: TEP-XXXX
title: "Short description"
type: feature | bugfix | breaking | deprecation | refactor
status: draft | review | approved | rejected | merged
created: YYYY-MM-DD
author:
  type: agent | human
  id: agent:name or human:username
  source: "Where this was discovered"

problem: |
  Detailed description of the problem.

impact_analysis:
  affected_contracts: [ContractName]
  affected_nodes: [node_type]
  breaking: true | false
  backward_compatible: true | false
  migration_required: true | false
  risk_level: low | medium | high | critical

change_set:
  protocol_changes:
    - file: path/to/file
      change: "What changes"
  runtime_changes: [...]
  test_changes: [...]
  doc_changes: [...]

validation:
  tests_passed: true | false
  test_count: N
  compatibility_verified: true | false
  ai_review: approved | rejected | pending

references:
  - "Related issues, PRs, discussions"
```

## AI Review Checklist

Every TEP must pass the AI Review checklist before human review:

1. **Contract consistency**: Does implementation match Contract types?
2. **Architecture boundaries**: Any out-of-bounds operations?
3. **Test sufficiency**: Does new code have enough tests?
4. **Wheel reinvention**: Is there a mature open source alternative?
5. **Security**: Any vulnerabilities (injection, privilege escalation, data leaks)?
6. **Compatibility**: Does it break existing Contracts or APIs?
7. **Performance**: Any obvious performance issues?
8. **Graph consistency**: Are Graph changes verified?
9. **Documentation**: Are there corresponding doc updates?

## How to Submit a TEP

### As a Human

1. Fork the repository
2. Create a file `proposals/TEP-XXXX-title.md`
3. Fill in the TEP structure above
4. Implement the ChangeSet
5. Run `npm test` — all tests must pass
6. Submit a Pull Request with "TEP: title" in the title

### As an AI Agent

1. Identify the problem while using TLL OS
2. Read `/agent/contracts.json` to understand affected contracts
3. Create a TEP following the structure
4. Implement the ChangeSet
5. Run all tests
6. Run the AI Review checklist
7. Submit a PR

## Versioning

- **Protocol**: 2.x stable. Breaking changes require Protocol 3.0.
- **Runtime**: 0.x evolving. Runtime 1.0 is first production-ready.
- Protocol and Runtime versions are independent.
- Deprecated contracts remain for 2 MINOR versions before removal.
- Every 4th Runtime MINOR is LTS (supported for 12 months).

## Active Proposals

See [`proposals/`](../../proposals/) directory for active TEPs.
