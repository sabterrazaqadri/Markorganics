import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="a-card a-empty">
      <h2>Not found</h2>
      <p className="text-[12.5px]">
        That record does not exist, or it was deleted. It may still be visible in the activity log.
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <Link href="/admin" className="a-btn a-btn-primary a-btn-xs">
          Dashboard
        </Link>
        <Link href="/admin/orders" className="a-btn a-btn-xs">
          Orders
        </Link>
      </div>
    </div>
  );
}
