import { activityTypeMeta } from "../constants";
import { addDays, daysBetween, startOfDay, type RangeKey } from "../dates";
import type { Database, Lead } from "../types";
import { sourceDistribution, funnel, isContactActivity } from "./leads";
import { commercialSeries } from "./home";

export interface RecentCommercialLead {
  lead: Lead;
  recentAt: string;
  activity: string;
  lastContactAt: string | null;
}

export function homePeriodOverview(db: Database, range: RangeKey, now = new Date()) {
  const series = commercialSeries(db, range, now);
  const start = series.buckets[0].start;
  const end = Math.min(series.buckets.at(-1)!.end, addDays(startOfDay(now), 1).getTime());
  const previousStart = addDays(new Date(start), -daysBetween(new Date(start), new Date(end))).getTime();
  const time = (value: string | null | undefined) => {
    const stamp = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(stamp) && stamp <= now.getTime() ? stamp : null;
  };
  const within = (value: string | null | undefined, from: number, to: number) => {
    const stamp = time(value);
    return stamp !== null && stamp >= from && stamp < to;
  };
  const count = (dates: (string | null | undefined)[], from: number, to: number) => dates.filter((date) => within(date, from, to)).length;

  const wonDates: string[] = [];
  let undatedWon = 0;
  for (const lead of db.leads.filter((item) => item.stage === "ganho")) {
    // O histórico de etapa é gravado pelo repositório nesse formato.
    const history = db.activities
      .filter((a) => a.leadId === lead.id && a.type === "etapa" && /→\s*Ganho\s*$/.test(a.description) && time(a.completedAt) !== null)
      .map((a) => a.completedAt as string)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const approvals = db.proposals
      .filter((p) => p.leadId === lead.id && p.status === "aprovada" && time(p.decidedAt) !== null)
      .map((p) => p.decidedAt as string)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const closedAt = history[0] ?? approvals[0];
    if (closedAt) wonDates.push(closedAt);
    else undatedWon++;
  }

  const dates = {
    leads: db.leads.map((lead) => lead.createdAt),
    contacts: db.activities.filter(isContactActivity).map((activity) => activity.completedAt),
    proposals: db.proposals.map((proposal) => proposal.sentAt),
    sales: wonDates,
  };
  const metric = (key: keyof typeof dates) => {
    const value = count(dates[key], start, end);
    const previous = count(dates[key], previousStart, start);
    return { value, previous, change: previous > 0 ? ((value - previous) / previous) * 100 : null };
  };

  const recent: RecentCommercialLead[] = [];
  for (const lead of db.leads) {
    let recentAt = time(lead.createdAt);
    let activity = "Lead cadastrado";
    let lastContact = time(lead.lastContactAt);
    for (const item of db.activities.filter((a) => a.leadId === lead.id)) {
      const stamp = time(item.completedAt ?? item.createdAt);
      if (stamp !== null && (recentAt === null || stamp > recentAt)) {
        recentAt = stamp;
        activity = `${activityTypeMeta[item.type].label} · ${item.description}`;
      }
      const contacted = isContactActivity(item) ? time(item.completedAt) : null;
      if (contacted !== null && (lastContact === null || contacted > lastContact)) lastContact = contacted;
    }
    if (lastContact !== null && (recentAt === null || lastContact > recentAt)) {
      recentAt = lastContact;
      activity = "Contato registrado";
    }
    if (recentAt !== null && recentAt >= start && recentAt < end) {
      recent.push({ lead, recentAt: new Date(recentAt).toISOString(), activity, lastContactAt: lastContact === null ? null : new Date(lastContact).toISOString() });
    }
  }
  recent.sort((a, b) => b.recentAt.localeCompare(a.recentAt) || a.lead.id.localeCompare(b.lead.id));

  return {
    series,
    start,
    end,
    previousStart,
    metrics: { leads: metric("leads"), contacts: metric("contacts"), proposals: metric("proposals"), sales: metric("sales") },
    sources: sourceDistribution(db.leads.filter((lead) => within(lead.createdAt, start, end))),
    conversion: funnel(db).conversion,
    undatedWon,
    recent,
  };
}
