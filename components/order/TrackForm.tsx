"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackOrder, type TrackState } from "@/app/(store)/track/actions";

export function TrackForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});

  useEffect(() => {
    if (state.orderNumber) router.push(`/order/${state.orderNumber}`);
  }, [state.orderNumber, router]);

  return (
    <form action={action} className="card mt-6 max-w-lg space-y-5 p-5 sm:p-6" noValidate>
      {state.error ? (
        <p role="alert" className="rounded border border-danger/40 bg-white px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="orderNumber" className="label">
          Order number
        </label>
        <input id="orderNumber" name="orderNumber" className="field uppercase" placeholder="MRK-ABC123" autoComplete="off" required />
      </div>
      <div>
        <label htmlFor="phone" className="label">
          Mobile number used on the order
        </label>
        <input id="phone" name="phone" type="tel" inputMode="tel" className="field" placeholder="0300 1234567" autoComplete="tel" required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending || !!state.orderNumber}>
        {pending || state.orderNumber ? "Looking up" : "Find my order"}
      </button>
    </form>
  );
}
