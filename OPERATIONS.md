# Pilot operations — Japan Physical Capability

## Goal

Prove one complete external-execution loop without building a marketplace:

`AI request -> manual review -> one worker -> evidence -> structured result -> AI resumes`

## State machine

- `pending_review`: request exists, but no promise or payment has been made.
- `open`: operator accepted the request into the pilot and generated one worker capability URL.
- `claimed`: the invited worker accepted the task.
- `completed`: structured observations and evidence were returned.
- `rejected`: operator declined the request.
- `cancelled`: requester cancelled before claim.

There is deliberately no bidding, worker search, public marketplace, escrow, or automated payment in v1.

## Human roles

### Requester AI

Creates a request, retains the returned `status_token`, polls status, and consumes the final structured result.

### Operator

Reviews safety/scope, decides whether the pilot can actually fulfill the request, and sends the generated worker URL to one known worker. Approval is not a payment or legal fulfillment guarantee.

### Worker

Receives a bearer capability URL, reads the task, claims it, performs only the allowed public-location work, and submits summary + observations + optional photos.

## Acceptance rule for the first real task

The probe passes only if all are true:

1. The requester did not need to talk directly to the worker.
2. The worker received enough context from the structured request to act.
3. The result returned to the requester in structured form.
4. Required evidence was accessible to the requester.
5. No manual copy/paste was needed to move the result back into the requester AI.

## Explicitly deferred

- payments and escrow
- open worker marketplace
- worker ratings
- automated pricing
- multi-worker routing/failover
- identity/KYC
- SLA promises
- regulated or private-location tasks

These are added only after repeated real requests show the need.
