import { PROPOSAL_STATUSES } from "../constants";
import { buildBuckets, countByBucket, daysBetween, type RangeKey } from "../dates";
import type { Proposal, ProposalStatus } from "../types";
import { ratio, round2, sum } from "../utils";

export function proposalSubtotal(p: Pick<Proposal, "items">) {
  return round2(sum(p.items.map((i) => i.quantity * i.unitPrice)));
}

export function proposalTotal(p: Pick<Proposal, "items" | "discount">) {
  return round2(Math.max(0, proposalSubtotal(p) - p.discount));
}

export function proposalsByStatus(proposals: Proposal[]) {
  return PROPOSAL_STATUSES.map((status) => {
    const list = proposals.filter((p) => p.status === status);
    return { status, count: list.length, value: round2(sum(list.map(proposalTotal))) };
  });
}

/** Aprovadas ÷ decididas (aprovadas + recusadas). */
export function approvalRate(proposals: Proposal[]) {
  const approved = proposals.filter((p) => p.status === "aprovada").length;
  const refused = proposals.filter((p) => p.status === "recusada").length;
  return ratio(approved, approved + refused);
}

export function proposalSeries(proposals: Proposal[], range: RangeKey, now = new Date()) {
  const buckets = buildBuckets(range, now);
  return {
    buckets,
    created: countByBucket(buckets, proposals.map((p) => p.createdAt)),
    sent: countByBucket(buckets, proposals.map((p) => p.sentAt)),
  };
}

export function isExpired(p: Proposal, now = new Date()) {
  const open: ProposalStatus[] = ["rascunho", "pronta", "enviada", "negociacao"];
  return open.includes(p.status) && daysBetween(now, p.validUntil) < 0;
}
