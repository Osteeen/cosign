import Link from "next/link";
import { archiveAddressAction } from "@/app/actions";
import { AddressForm } from "@/components/address-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Notice } from "@/components/notice";
import { Topbar } from "@/components/topbar";
import { isDemoOwner } from "@/lib/demo/account";
import { requireOwner } from "@/lib/owner";
import { addressSummary, listAddresses } from "@/lib/services/addresses";

// Where agents' orders ship. Agents only ever see an address's label.
export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ notice?: string; back?: string }> }) {
  const owner = await requireOwner();
  const { notice, back: rawBack } = await searchParams;
  const back = rawBack && /^\/agents\/[0-9a-f-]{36}(\/slip)?$/.test(rawBack) ? rawBack : "/addresses";
  const addresses = await listAddresses(owner.id);
  const demo = isDemoOwner(owner.id);

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow-wide panel-stack rise">
          {back !== "/addresses" ? (
            <Link href={back} className="back-link">
              Back to the permission slip
            </Link>
          ) : null}
          <h1 className="panel-title">Shipping addresses</h1>
          <p className="panel-text">
            Choose one for each permission slip. When an agent pays, the store gets the order with this address and sees it in PayPal too. Agents only
            see the label.
          </p>
          <Notice code={notice} />

          {addresses.length ? (
            <ul className="hold-list">
              {addresses.map((a) => (
                <li className="hold" key={a.id}>
                  <div className="hold-head">
                    <span>{a.label}</span>
                  </div>
                  <p className="muted address-lines">
                    {a.recipient}
                    <br />
                    {addressSummary(a)}
                  </p>
                  {demo ? (
                    <p className="muted">A sample address shared by everyone in the demo. It can't be changed.</p>
                  ) : (
                    <div className="toolbar">
                      <details className="inline-edit">
                        <summary className="button button-quiet">Edit</summary>
                        <AddressForm
                          back={back}
                          submitLabel="Save address"
                          initial={{ id: a.id, label: a.label, recipient: a.recipient, line1: a.line1, line2: a.line2 ?? "", city: a.city, region: a.region, postal_code: a.postalCode }}
                        />
                      </details>
                      <ConfirmDialog trigger="Remove" title={`Remove "${a.label}"?`} confirmLabel="Remove address" pendingLabel="Removing" action={archiveAddressAction}>
                        <p>Orders already sent keep their copy of this address. Change any permission slip that ships here first.</p>
                        <input type="hidden" name="addressId" value={a.id} />
                      </ConfirmDialog>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No addresses yet. Add one below, then choose it on a permission slip.</p>
          )}

          {demo ? null : (
            <section className="panel-stack" aria-label="Add an address">
              <h2 className="section-title">Add an address</h2>
              <AddressForm back={back} submitLabel="Add address" />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
