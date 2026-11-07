import type { ComponentProps } from "react";
import { dashboardTone } from "@/lib/visualization";
import { StatusBadge as BaseStatusBadge, TonePill as BaseTonePill } from "./badge";

/** Somente os módulos comerciais optam pela nova paleta. */
export function StatusBadge(props: ComponentProps<typeof BaseStatusBadge>) {
  return <BaseStatusBadge {...props} color={props.color ?? dashboardTone[props.tone]} />;
}

export function TonePill(props: ComponentProps<typeof BaseTonePill>) {
  return <BaseTonePill {...props} color={props.color ?? dashboardTone[props.tone]} />;
}
