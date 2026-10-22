import { ExternalLink, FileText, Globe, Play } from "lucide-react";
import type { AccountOrg, Creative } from "@/lib/types";
import { MEDIA_LABELS } from "@/lib/constants";
import { formatNumber, formatPercent, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";

export function CreativeCard({ creative, accountOrg, campaignName }: { creative: Creative; accountOrg?: AccountOrg; campaignName?: string }) {
  const isTla = !!creative.authorName || !!creative.authorPersonId;
  const orgName = accountOrg?.name || "Quarkslab";
  const displayName = creative.authorName || (isTla ? "Thought Leader Ad" : orgName);
  const hasVideo = creative.mediaType === "video" && !!creative.videoUrl;
  const hasImage = !!creative.localMediaPath;
  const ctr = creative.impressions ? ((creative.clicks || 0) / creative.impressions) * 100 : null;

  return (
    <article className="border border-border rounded-lg bg-card overflow-hidden flex flex-col">
      <div className="p-3 pb-2 flex items-start gap-2.5">
        {isTla ? (
          <div className="w-11 h-11 rounded-full shrink-0 bg-navy text-white flex items-center justify-center text-sm font-semibold">{initials(creative.authorName || "TL")}</div>
        ) : accountOrg?.logoPath ? (
          <img src={accountOrg.logoPath} alt={orgName} className="w-11 h-11 rounded-md shrink-0 object-cover" />
        ) : (
          <div className="w-11 h-11 rounded-md shrink-0 border border-border bg-white flex items-center justify-center p-1.5">
            <img src="/quarkslab-logo.svg" alt={orgName} className="w-full h-auto" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground leading-tight">{isTla ? `Thought Leader Ad · sponsored by ${orgName}` : `${formatNumber(accountOrg?.followerCount || 0)} followers`}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 leading-tight">
            Promoted <Globe className="w-3 h-3" />
          </p>
        </div>
      </div>

      {creative.adText && (
        <div className="px-3 pb-3">
          <p className="text-sm whitespace-pre-line leading-relaxed line-clamp-[9]">{creative.adText}</p>
        </div>
      )}

      {(hasVideo || hasImage || (!creative.adText && creative.mediaType !== "text")) && (
        <div className="bg-muted border-y border-border">
          {hasVideo ? (
            <video controls preload="metadata" className="w-full max-h-[420px] bg-black">
              <source src={creative.videoUrl} type="video/mp4" />
            </video>
          ) : hasImage ? (
            <img src={creative.localMediaPath!} alt={creative.headline || creative.name} className="w-full object-cover max-h-[420px]" />
          ) : (
            <div className="aspect-[16/9] flex items-center justify-center">
              <div className="w-14 h-14 rounded-lg bg-primary-soft flex items-center justify-center">
                {creative.mediaType === "video" ? <Play className="w-7 h-7 text-primary" /> : <FileText className="w-7 h-7 text-primary" />}
              </div>
            </div>
          )}
        </div>
      )}

      {(creative.headline || (creative.landingPageUrl && creative.mediaType !== "document")) && (
        <div className="px-3 py-2.5 border-b border-border bg-muted/40">
          {creative.headline && <p className="text-sm font-semibold leading-snug line-clamp-2">{creative.headline}</p>}
          {creative.landingPageUrl && creative.mediaType !== "document" && <p className="text-xs text-muted-foreground mt-0.5 truncate">{creative.landingPageUrl.replace(/^https?:\/\//, "")}</p>}
        </div>
      )}

      <div className="px-3 py-2.5 mt-auto flex flex-wrap items-center gap-1.5 text-xs">
        <Badge className="bg-muted text-muted-foreground">{MEDIA_LABELS[creative.mediaType]}</Badge>
        {ctr !== null && creative.impressions ? (
          <>
            <Badge className="bg-positive text-white">{formatPercent(ctr)} CTR</Badge>
            <span className="text-muted-foreground tnum">{formatNumber(creative.impressions)} impressions</span>
            {creative.leads ? <span className="text-muted-foreground tnum">· {creative.leads} lead{creative.leads > 1 ? "s" : ""}</span> : null}
            <span className="text-muted-foreground">· 90 days</span>
          </>
        ) : (
          <span className="text-muted-foreground">No delivery in the last 90 days</span>
        )}
        {creative.postUrl && (
          <a href={creative.postUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            View on LinkedIn <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {campaignName && <p className="px-3 pb-2.5 text-[11px] text-muted-foreground truncate">Ad set: {campaignName}</p>}
    </article>
  );
}
