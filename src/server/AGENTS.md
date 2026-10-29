# src/server: composition root

Wiring only, no logic. It is the one place allowed to know every module at once, which is why it isn't in `lib/` (`lib/` never imports modules).
Source: `docs/conventions/architecture.md#cross-module-communication`

## event-subscriptions.ts

```ts
import "server-only";
import { createEventBus } from "@/lib/events";
import { billingSubscribers } from "@/modules/billing";
import { notificationsSubscribers } from "@/modules/notifications";

export const dispatchEvents = createEventBus([billingSubscribers, notificationsSubscribers]);
```

- When a module adds or changes `subscribers.ts`, register it here in the same PR.
- Imports only `@/modules/<name>` (index) and `@/lib/*`. Only actions import this file, to dispatch after commit.
- Dispatch is in-process and after commit. A failing handler is logged and does not roll back the emitter. If an event must be delivered, raise it: that needs a transactional outbox, which we don't build until needed.
