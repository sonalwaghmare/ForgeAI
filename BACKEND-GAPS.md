# Backend gaps found while wiring the frontend

Written from the frontend side, against `forgeai-backend` as of this branch. Each item is
something the UI either had to drop or had to work around. Nothing here is a complaint about
design — several are deliberate choices that simply need confirming as such.

Ordered by consequence.

---

## 0. `AnomalyOut` omits `rca_status`, so a detail read cannot say whether an analysis exists

**Where it bites.** `app/schemas/anomaly.py` puts `rca_status` on `AnomalyListItem` and not on
`AnomalyOut` — both extend `AnomalyBase`, and only the list item was extended. So
`GET /anomalies/{id}` and `PATCH /anomalies/{id}` never report it, while `GET /anomalies` does.

**What the UI had to do.** The anomaly detail screen shows an RCA badge in its header. It cannot
read that from the record it just fetched, so it reads it from `GET /anomalies/{id}/rca` and
renders nothing until that second request lands. That works — the screen needs the RCA anyway —
but it means the field is silently untrustworthy on one of the two reads that return it, and the
frontend mapper's `row.rca_status ?? 'pending'` fallback turns a missing value into a plausible
wrong one. Any future surface that shows an anomaly detail *without* also fetching its RCA will
render "No analysis" over a finished report and nothing will look broken.

**Smallest thing that would fix it.** Move the field up, and pass it in `_to_out` the way
`list_anomalies` already passes it:

```python
class AnomalyBase(BaseModel):
    ...
    rca_status: AnomalyRcaStatus


def _to_out(anomaly, plant, line, machine, rca_status=AnomalyRcaStatus.pending) -> AnomalyOut:
    return AnomalyOut(..., rca_status=rca_status)
```

`get_anomaly` and `update_anomaly` already load the row by id, so resolving the RCA status is the
same one-row lookup `_get_rca` performs.

**Related, and worth deciding together:** nothing in `app/api/v1/anomalies.py` generates RCA
content yet — `request_anomaly_rca` carries a standing note to that effect and creates the
`queued` row only. The frontend polls `GET .../rca` every 2s and caps at two minutes, so it
degrades to "still analysing" rather than spinning forever, but the cap is the only thing
bounding it.

---

## 1. A site has nowhere to store its engineering unit system — **safety-relevant**

**What the UI lost.** Settings → Sites & Hierarchy used to set, per site, whether its readings
are metric or imperial, which fixed the unit of every vibration, temperature, pressure and flow
figure beneath it. `Plant` has no column for it, so the control was removed rather than left
collecting a value the server would discard.

**Why it is not a formatting preference.** A vibration threshold of `12.5 mm/s` and one of
`0.49 in/s` describe the same physical limit. If a reading is rendered without a unit that
belongs to the *site*, a German plant's figure can be read as an American one. `PRODUCT.md`
states this as a safety property and the unit is deliberately never converted anywhere in the
client — `src/lib/units.js` exports no `convert()` at all, so no screen can reach for one.

**Smallest thing that would fix it**

```python
class PlantUnitSystem(str, enum.Enum):
    metric = "metric"
    imperial = "imperial"

# app/models/plant.py
unit_system: Mapped[PlantUnitSystem] = mapped_column(
    SQLEnum(PlantUnitSystem), nullable=False, default=PlantUnitSystem.metric
)
```

Non-nullable with a default matters: a plant with no unit system makes every reading beneath it
unitless, which is worse than a wrong default because nothing surfaces it. The derived units
(`mm/s` vs `in/s` and so on) do not need columns — the client derives all five from this one
value.

Also absent, and much less important: `city`, `country`, `timezone`. Those were dropped from the
same form. Timezone is the one worth having next, because shift boundaries are local to a plant.

---

## 2. Deleting a parent leaves its children listed and orphaned

**What happens.** `DELETE /regions/{id}` sets `deleted_at` on that one row. Its sub-regions keep
`deleted_at = NULL`, and `list_subregions` filters on the child's own deleted flag but not its
parent's:

```python
# app/api/v1/subregions.py
select(SubRegion)
  .join(Region, Region.id == SubRegion.region_id)
  .where(Region.account_id == account_id, SubRegion.deleted_at.is_(None))
  #      ^ no Region.deleted_at.is_(None)
```

So after deleting a region, `GET /subregions` still returns its children, now pointing at a
parent that no longer exists. The same pattern is in `plants.py`, `lines.py` and `machines.py`,
so it compounds down the tree.

**It also makes two endpoints disagree.** `GET /asset-hierarchy` walks down from live parents, so
those same records vanish from the tree while remaining in the collections. Two callers reading
the same account get two different answers about whether a plant exists.

**Options, in the order we would suggest**

1. Filter the ancestor's `deleted_at` in each `_scoped_query`. One `.where()` per file, and it
   makes the collections agree with the tree.
2. Cascade the soft delete to descendants inside the same transaction.
3. Refuse with `409` when the record still has live children, and let the client empty it first.

**The frontend no longer implements (3), and that raises the stakes.** Settings → Sites &
Hierarchy used to refuse removal of a node with live children, which meant the orphaning path was
unreachable through the UI. That guard was removed on instruction: an administrator retiring a
region should not have to delete six levels bottom-up first. The screen now states the
consequence twice — beside the Remove button and again in the confirmation — but it does go
through, so orphans are now reachable by an ordinary click rather than only by a direct API
caller. Option (1) or (2) is worth more than it was a week ago.

---

## 3. `GET /asset-hierarchy` cannot drive an editable tree

It returns `{id, name}` per node. Every update is a full-replace `PUT` requiring `short_code`,
`is_active` and — on plant, line and machine — `asset_class_id`. A form cannot send back fields it
was never given, so the Settings screen fetches the tree **plus all five collections**: six
requests where one would do.

Adding `short_code`, `is_active` and `asset_class_id` to the tree nodes would collapse that to a
single call. Worth doing whenever this endpoint is next touched; not urgent, since the five
collections parallelise into roughly one round trip.

---

## 4. The account has no endpoint, so the enterprise root is read-only

Its name and alias are served **only** as two fields on `GET /asset-hierarchy`, and there is no
route to rename it. The tree therefore renders its top row with no edit and no remove control.

That is very likely intentional — an account name is not something a plant administrator should
change — but it is currently implicit. If it is intended, no action; the UI already matches. If
an admin is eventually meant to rename their own organisation, it needs a route.

---

## 5. Smaller notes

- **`AssetClassUpdate` accepts `name` only**, so `entity_type` is fixed at creation. The UI states
  the type as a fact on the rename form rather than offering a control that would be discarded.
  Intentional, we assume — flagging only because it is the kind of thing that reads as an
  oversight from the client side.
- **Deleting an asset class does not clear `asset_class_id`** on the plants, lines and machines
  pointing at it. Because the delete is soft the FK still resolves, so nothing breaks — but those
  records now reference a class that no longer appears in any listing. The confirmation dialog
  says so explicitly rather than implying a cascade.
- **Nothing records who approved an RCA, or when.** `AnomalyRcaUpdate` sets `status` with no
  actor and no history, and editing an approved analysis is permitted by product decision — so an
  approved row can be rewritten afterwards and the record cannot say by whom, or whether the text
  on screen is the text somebody signed off. Approval is the human signature PRODUCT.md's fourth
  principle rests on; today it is a single mutable enum value. An `approved_by` / `approved_at`
  pair, or a transition log, is what would make it mean something.
- **`POST /anomalies/{id}/rca/request` will not start a `pending` row.** It returns any existing
  row untouched with "RCA already requested.", so a record sitting at `pending` answers 202 and
  stays pending — there is no way to request an analysis for it through the API. Rows the request
  endpoint creates are always `queued`, so this only bites seeded or fixture data, which is
  exactly what the demo account has. The detail screen now says so on screen rather than looking
  like a dead button. Either re-queue a `pending` row on request, or drop `pending` from
  `AnomalyRcaStatus` and let the row's absence be the only way to say "not asked".
- **Neither transition out of `open` can record why it was made.** `AnomalyUpdate` is
  `title`, `severity` and `status`; `AnomalyRcaUpdate` is `content` and `status`. So
  `PATCH /anomalies/{id}` can record THAT an anomaly was dismissed and `PATCH .../rca` that an
  analysis was approved, and neither can say anything about why. Both confirmation dialogs now
  ask — a closed reason list plus a free-text comment — because the reason is the part with
  downstream value. On dismissal it is feedback about the DETECTOR: "41% of dismissals on this
  line are sensor faults" is a finding, and it is the only tuning signal this product currently
  has. On approval it is what the person is taking the record on FOR, which is the closest thing
  to an owner the anomaly gets. Neither field is sent today, and both dialogs say so on screen
  rather than implying they were filed. Two fields on each update schema, or the transition-log
  row the note above already asks for on RCA approval, would make the question worth asking.
- **`RegionOut` returns `created_at`; the other four `*Out` schemas do not.** Harmless, but the
  inconsistency will eventually be noticed by whoever wants to sort by age.
- **Login returns no account name or alias**, only `{name, email}` for the user. That is why the
  top bar has to call `/asset-hierarchy` before it can say which organisation you are signed in
  to. Adding the account to the login payload would remove a request from first paint.
