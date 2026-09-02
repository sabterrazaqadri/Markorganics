import { ListSkeleton } from "@/components/admin/Skeletons";

export default function Loading() {
  return <ListSkeleton tabs={8} filters={8} rows={10} cols={6} />;
}
