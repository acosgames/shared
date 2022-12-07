module.exports = RatingText = {
    ratingToRank: (rating) => {
        let ranks = [
            'Bronze I',
            'Bronze II',
            'Bronze III',
            'Bronze IV',
            'Silver I',
            'Silver II',
            'Silver III',
            'Silver IV',
            'Gold I',
            'Gold II',
            'Gold III',
            'Gold IV',
            'Platinum I',
            'Platinum II',
            'Platinum III',
            'Platinum IV',
            'Champion I',
            'Champion II',
            'Champion III',
            'Champion IV',
            'Grand Champion I',
            'Grand Champion II',
            'Grand Champion III',
            'Grand Champion IV',
        ]

        const maxRating = 5000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt);
        return ranks[rt];

    }
}