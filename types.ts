

export type Language = 'es' | 'en';

export enum Severity {
    CRITICAL = 'CRITICAL',
    RECOMMENDED = 'RECOMMENDED',
    GOOD_TO_KNOW = 'GOOD_TO_KNOW',
}

export interface RecommendationItem {
    headline: string;
    points: string[];
}

export interface AdvantagePlusRecommendation {
    enhancement: string;
    applicable: 'ACTIVATE' | 'CAUTION';
    justification: string;
}

export interface PlacementSpecificSummary {
    placementId: string;
    summary: string[];
}

export type ChecklistItemSeverity = 'CRITICAL' | 'ACTIONABLE' | 'POSITIVE';

export interface ChecklistItem {
    severity: ChecklistItemSeverity;
    text: string;
}

export interface OverallConclusion {
    headline: string;
    checklist: ChecklistItem[];
}

export interface AnalysisResult {
    creativeDescription: string;
    effectivenessScore: number;
    effectivenessJustification: string;
    clarityScore: number;
    clarityJustification: string;
    textToImageRatio: number;
    textToImageRatioJustification: string;
    funnelStage: 'TOFU' | 'MOFU' | 'BOFU' | 'Error' | 'N/A';
    funnelStageJustification: string;
    recommendations: RecommendationItem[];
    advantagePlusAnalysis: AdvantagePlusRecommendation[];
    placementSummaries: PlacementSpecificSummary[];
    overallConclusion: OverallConclusion;
}

export enum PlacementId {
    FB_FEED,
    FB_VIDEO_FEED,
    FB_STORIES,
    FB_MARKETPLACE,
    FB_REELS,
    IG_FEED,
    IG_STORIES,
    IG_REELS,
    IG_EXPLORE,
    MESSENGER_INBOX,
    MESSENGER_STORIES,
    AUDIENCE_NETWORK,
    MASTER_VIEW,
}

export type UiType = 'FEED' | 'STORIES' | 'REELS' | 'MARKETPLACE' | 'MESSENGER_INBOX' | 'GENERIC';
export type FormatGroup = 'SQUARE_LIKE' | 'VERTICAL';


export interface Placement {
    id: PlacementId;
    platform: 'Facebook' | 'Instagram' | 'Messenger' | 'Audience Network';
    name: string;
    uiType: UiType;
    group: FormatGroup;
    aspectRatios: string[];
    recommendedResolution: string;
    safeZone: {
        top: string;
        bottom: string;
        left?: string;
        right?: string;
    };
}

export interface Creative {
    file: File;
    url: string;
    type: 'image' | 'video';
    width: number;
    height: number;
    format: 'square' | 'vertical';
    hash: string;
}

export type CreativeSet = {
    square: Creative | null;
    vertical: Creative | null;
};

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface Client {
  id: string;
  name: string;
  logo: string;
  currency: string;
  userId: string;
  metaAccountName?: string;
}

export interface AnalysisHistoryEntry {
  clientId: string;
  filename: string;
  hash: string;
  size: number;
  date: string;
  description: string;
  dataUrl: string; // Base64 representation for preview
  fileType: 'image' | 'video';
}

export interface PerformanceRecord {
  clientId: string;
  uniqueId: string; // Composite key for deduplication
  campaignName: string;
  adSetName: string;
  adName: string;
  day: string;
  accountName: string;
  imageVideoPresentation: string;
  spend: number;
  campaignDelivery: string;
  adSetDelivery: string;
  adDelivery: string;
  impressions: number;
  reach: number;
  frequency: number;
  purchases: number;
  landingPageViews: number;
  clicksAll: number;
  cpm: number;
  ctrAll: number;
  cpcAll: number;
  videoPlays3s: number;
  checkoutsInitiated: number;
  purchaseRate: number;
  pageLikes: number;
  addsToCart: number;
  checkoutsInitiatedOnWebsite: number;
  campaignBudget: string;
  campaignBudgetType: string;
  includedCustomAudiences: string;
  excludedCustomAudiences: string;
  linkClicks: number;
  paymentInfoAdds: number;
  pageEngagement: number;
  postComments: number;
  postInteractions: number;
  postReactions: number;
  postShares: number;
  bid: string;
  bidType: string;
  websiteUrl: string;
  ctrLink: number;
  currency: string;
  purchaseValue: number;
  objective: string;
  purchaseType: string;
  reportStart: string;
  reportEnd: string;
  attention: number;
  desire: number;
  interest: number;
  videoPlays25percent: number;
  videoPlays50percent: number;
  videoPlays75percent: number;
  videoPlays95percent: number;
  videoPlays100percent: number;
  videoPlayRate3s: number;
  aov: number;
  lpViewRate: number;
  adcToLpv: number;
  videoCapture: string;
  landingConversionRate: number;
  percentPurchases: number;
  visualizations: number;
  imageId: string;
  imageName: string;
  cvrLinkClick: number;
  videoRetentionProprietary: number;
  videoRetentionMeta: number;
  videoAveragePlayTime: number;
  thruPlays: number;
  videoPlays: number;
  videoPlays2sContinuousUnique: number;
  ctrUniqueLink: number;
}

export interface AggregatedAdPerformance {
    adName: string;
    imageVideoPresentation: string;
    spend: number;
    purchases: number;
    purchaseValue: number;
    impressions: number;
    clicks: number;
    roas: number;
    cpa: number;
    cpm: number;
    ctr: number;
    isMatched: boolean;
    creativeDescription?: string;
    currency: string;
    inMultipleAdSets: boolean;
    creativeDataUrl?: string;
    creativeType?: 'image' | 'video';
}

export type LastUploadInfo = {
  clientId: string;
  fileHash: string;
  recordsAdded: number;
};