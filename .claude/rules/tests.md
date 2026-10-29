---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/__fakes__/**"
  - "test/**"
  - "e2e/**"
---

# Tests

Source: `docs/conventions/naming.md#tests--misc`

| Kind | File | Identifier |
| --- | --- | --- |
| Unit | next to the file: `pay-order.test.ts` | `describe("payOrder")`, `it("rejects payment on an already paid order")` |
| Integration (real DB) | `order.repository.integration.test.ts` | same |
| E2E | `e2e/<flow>.spec.ts` | `test("<user goal>")` |
| Fake port | `application/__fakes__/order.repository.fake.ts` | `InMemoryOrderRepository`, `FakePaymentGateway` |
| Factory | `test/factories/order.ts` | `anOrder()`, `aPaidOrder()`, `aCustomer({ country: "DE" })` |
| Fixture | `test/fixtures/orders.json` | n/a |

- Domain and use case tests run without Next and without a database: `payOrder(input, { orders: new InMemoryOrderRepository(), … })`.
- Every RPC (an exception, see `infra-and-database.md`) has an integration test against a real database.
- Test names describe behaviour, not implementation: `it("rejects payment on an already paid order")`, not `it("returns err")`.
- `Fake` is a hand-written double with behaviour, `Stub` returns canned answers, and `Mock` is only for asserting calls. Don't call everything a mock.
