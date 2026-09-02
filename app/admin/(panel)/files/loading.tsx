import { ListSkeleton } from "@/components/admin/Skeletons";

export default function Loading() {
  return <ListSkeleton tabs={0} filters={2} rows={6} cols={6} />;
}
