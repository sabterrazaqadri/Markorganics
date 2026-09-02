import { ListSkeleton } from "@/components/admin/Skeletons";

export default function Loading() {
  return <ListSkeleton tabs={4} filters={6} rows={10} cols={6} />;
}
