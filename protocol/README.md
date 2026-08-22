# TLL OS Protocol

This directory contains the **TLL OS Protocol Specification** — the stable, language-agnostic standard that defines what TLL OS is.

## Protocol vs Runtime

```
TLL OS Protocol 2.0          TLL OS Runtime
(This directory)             (../src/)
     │                              │
     │  稳定的规范                   │  参考实现
     │  Stable specification        │  Reference implementation
     │  可以有多种Runtime实现         │  可以被重写/替换
     │                              │
     └────────── 一致 ──────────────┘
```

- **Protocol** defines the contracts, models, and rules. It is stable and frozen.
- **Runtime** is one implementation of the Protocol. There can be multiple runtimes in different languages.
- Anyone can implement their own TLL Runtime without using this codebase, as long as it follows Protocol 2.0.
- Even if the Runtime is completely rewritten, Protocol 2.0 applications and Agents remain valid.

## Version

- **Current**: Protocol 2.0.0 (FROZEN)
- **Frozen**: 2026-08-22
- **Next major**: Protocol 3.0 (if breaking changes are needed)

## Files

- `SPECIFICATION.md` — The full Protocol 2.0 specification (the "constitution")
- `FREEZE.md` — Freeze record with verification evidence

## Key Concepts

- **5 Models**: Application, AI Development, Ecosystem, Build, Evolution
- **17 Contracts**: Application, Application Graph, Module, Plugin, Agent, Tool, Skill, Context, Permission, Workflow, Event, Adapter, Projection, BuildTarget, Capability, Compatibility Manifest, Evolution Proposal
- **Application Graph**: The primary source of truth — machine-readable map of application structure
- **Agent Protocol**: AI Agents are first-class citizens
- **TEP**: TLL Evolution Protocol — how the protocol evolves

## Implementing a TLL Runtime

To implement your own TLL OS Runtime:

1. Read `SPECIFICATION.md` thoroughly
2. Implement all 17 contracts
3. Implement the Application Graph (nodes, edges, queries, impact analysis)
4. Implement the Public Contract entry point (`createTllOS()`)
5. Pass the verification examples (see `../examples/`)
6. Your runtime is now TLL OS Protocol 2.0 compatible

## Modifying the Protocol

The Protocol is frozen. To propose changes:

1. Submit a TEP (see `../proposals/README.md`)
2. Breaking changes require Protocol 3.0
3. All changes go through the TEP process (AI review + human review)
