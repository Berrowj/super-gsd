# Simple Warp Plan -- Auth Refactor

A small sample Warp Plan for the converter self-test.

## Phase 1: Discovery

- Audit current auth surface across services
- Catalogue token issuance points
- List downstream consumers

## Phase 2: Design

- Draft target token contract
- Decide refresh-token vs session approach
- Document decision in ADR

## Phase 3: Implementation

- Land token contract module
- Migrate first consumer
- Remove legacy issuance path
