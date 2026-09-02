import { ListSkeleton } from "@/components/admin/Skeletons";

export default function Loading() {
  return <ListSkeleton tabs={3} filters={2} rows={12} cols={6} />;
}
