import { ListSkeleton } from "@/components/admin/Skeletons";

export default function Loading() {
  return <ListSkeleton tabs={0} filters={0} rows={8} cols={6} />;
}
