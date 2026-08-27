// Thin feature hook over the drawer context. Components use this instead of the
// raw context, so the context shape can change without touching every consumer.
export { useDrawerContext as useDrawer } from "@/components/drawer-context"
