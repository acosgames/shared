declare const RatingConfig: {
    muDefault: () => number;
    sigmaDefault: () => number;
    clampMu: (mu: any) => number;
    clampSigma: (sigma: any) => number;
    muRating: (mu: any) => number;
    ranks: () => string[];
    ratingToRankNumber: (rating: any) => number;
    ratingToRank: (rating: any) => string;
};
export default RatingConfig;
//# sourceMappingURL=ratingconfig.d.ts.map