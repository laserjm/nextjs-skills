# src/app: routes

Routes compose. They hold no business logic, no db access and no zod parsing.
Full rules: `docs/conventions/architecture.md#layer-rules`.

## Imports

- ✅ `@/modules/<name>` (the module's `index.ts`), `@/components/ui/*`, `@/lib/*` (env, auth), siblings in `app/`
- ❌ `@/modules/<name>/application/...`, `.../infra/...`, or any other deep module path
- ❌ `drizzle-orm`, `@/lib/db`, `zod`

```tsx
// ✅ app/(app)/orders/[orderId]/page.tsx
import { getOrder, OrderSummary } from "@/modules/orders";

export default async function OrderPage({ params }: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;
  const order = await getOrder(orderId);
  return <OrderSummary order={order} />;
}
```

## Errors and permissions

| Case | In a page / RSC |
| --- | --- |
| `NotFound` | `notFound()` → `not-found.tsx` (usually thrown by the module's query) |
| `Forbidden` | `forbidden()` if `experimental.authInterrupts` is on; otherwise redirect to sign-in (no session) or render an inline "no access" state |
| Tagged domain error | render inline, through the module's `_tag` → copy map |
| Unexpected | let it throw → `error.tsx` |

Pages never compute permissions. They pass the `can.*` flags returned by the module's query on to components.

## Where UI goes

- One route uses it → `app/.../_components/<noun>-<role>.tsx`.
- A second route needs it, or it needs the module's types or actions → move it to `modules/<name>/components/`.
- Design-system primitive → `components/ui/` (never feature-aware).

## api/

Webhooks and route handlers only. Verify the signature, then hand the raw payload to a function exported by the module. That function validates the payload with its zod schema. Route handlers can't use `updateTag`: revalidate with `revalidateTag(tag, "max")` through a helper the module exports.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Segment | `kebab-case`, plural for collections | `orders/`, `price-lists/` |
| Dynamic param | `camelCase`, ends in `Id` for ids | `[orderId]`, never `[id]` or `[order_id]` |
| Route group | `(kebab-case)`, describes layout or audience | `(app)`, `(marketing)`, `(auth)` |
| Private folder | `_kebab-case` | `_components/`, `_lib/` |
| Page component | `<Noun>Page`, default export | `OrdersPage` (list), `OrderPage` (detail) |
| Route files | Next conventions, unchanged | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` |

Links use typed routes (`typedRoutes: true`). Never build an href by string concatenation and then cast it.
