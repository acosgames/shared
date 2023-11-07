const ranks = [
    'Rookie I',
    'Rookie II',
    'Rookie III',
    'Rookie IV',
    'Minor I',
    'Minor II',
    'Minor III',
    'Minor IV',
    'Intermediate I',
    'Intermediate II',
    'Intermediate III',
    'Intermediate IV',
    'Major I',
    'Major II',
    'Major III',
    'Major IV',
    'Master I',
    'Master II',
    'Master III',
    'Master IV',
    'Senior Master I',
    'Senior Master II',
    'Senior Master III',
    'Senior Master IV',
    'Grandmaster',
]

module.exports = RatingText = {

    ranks: () => { return ranks },

    ratingToRankNumber: (rating) => {
        const maxRating = 5000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt) + 1;
        return rt;
    },

    ratingToRank: (rating) => {
        const maxRating = 5000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt);
        return ranks[rt];

    }
}